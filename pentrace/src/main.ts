import '@xterm/xterm/css/xterm.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles.css';

import { c } from './engine/ansi';
import { INDEX_BY_ID, INDEX_ENTRIES } from './engine/content/index-entries';
import type { GameEvent } from './engine/events';
import { Game, SaveData } from './engine/game';
import { findHost } from './engine/network';
import { Synth } from './ui/audio';
import {
  esc,
  guideHtml,
  indexModalHtml,
  jobsModalHtml,
  mailModalHtml,
  netmapHtml,
  ramHtml,
  shopModalHtml,
  targetHtml,
  traceHtml,
} from './ui/panels';
import { morph } from './ui/morph';
import { bindHotkeys, bindPressEnter } from './ui/prompt';
import { advanceClock } from './engine/clock';
import { GameTerminal } from './ui/terminal';
import { TUTORIAL_STEPS } from './engine/tutorial';
import { TRAINING_INTRUDER_IP, TRAINING_VAULT_IP } from './engine/network';
import { migrateLegacyStorage, PREFS_KEY, SAVE_KEY } from './engine/storage';

try {
  migrateLegacyStorage(localStorage);
} catch {
  // storage full or blocked: the game still runs, it just starts fresh
}
const params = new URLSearchParams(location.search);
const demoMode = params.has('demo');
const tutorialDemo = params.has('tutorialdemo');
if (params.has('fresh')) localStorage.removeItem(SAVE_KEY);

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}
const prefs: { tutorial: boolean } = { tutorial: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

const hadSave = !!loadSave();
const seedParam = params.get('seed');
let game = new Game(loadSave(), seedParam ? Number(seedParam) : undefined, { tutorial: !demoMode });
const synth = new Synth();
synth.enabled = game.profile.sound;

let focusIp: string | null = game.world.gatewayIp;
let modal: { kind: 'index' | 'shop' | 'jobs' | 'mail'; arg?: string } | null = null;
let shownCredits = game.profile.credits;

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
}

// ------------------------------------------------------------------ terminal
const term = new GameTerminal($('#terminal'), {
  prompt: () => game.prompt(),
  complete: (p) => game.completions(p),
  onKey: () => synth.key(),
  submit: (line) => runCommand(line),
});

function runCommand(line: string) {
  const ipMatch = line.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g);
  const out = game.exec(line);
  if (ipMatch) {
    const known = ipMatch.map((ip) => findHost(game.world, ip)).find((h) => h && h.discovered && h.role !== 'home');
    if (known && !line.includes('--src')) focusIp = known.ip;
    else if (known && line.startsWith('fwbypass')) focusIp = ipMatch[0];
  }
  if (/^\s*(connect)\b/.test(line) && game.run.connected) focusIp = game.run.connected;
  term.print(out);
  persist();
  renderAll();
}

// ------------------------------------------------------------------ events
function onEvent(e: GameEvent) {
  switch (e.type) {
    case 'print':
      term.print(e.lines);
      break;
    case 'clear':
      term.clear();
      break;
    case 'sound':
      synth.play(e.sound);
      break;
    case 'toast':
      toast(e.kind, e.title, e.body);
      break;
    case 'fx':
      fx(e.fx);
      break;
    case 'open':
      if (e.panel === 'index' || e.panel === 'shop') openModal(e.panel, e.arg);
      break;
    case 'traced':
      showTraced();
      break;
    case 'newRun':
      focusIp = game.world.gatewayIp;
      break;
  }
}
game.on(onEvent);

function toast(kind: string, title: string, body?: string) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="toast-title">${esc(title)}</div>${body ? `<div class="toast-body">${esc(body)}</div>` : ''}${kind === 'index' ? '<div class="toast-cta">click to read</div>' : ''}`;
  if (kind === 'index') {
    const entry = INDEX_ENTRIES.find((x) => x.title === body);
    el.addEventListener('click', () => openModal('index', entry?.id));
  }
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4800);
}

function flashClass(el: HTMLElement, cls: string, ms: number) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

function banner(text: string, cls: string) {
  const b = $('#banner');
  b.innerHTML = `<div class="banner-text ${cls}" data-text="${esc(text)}">${esc(text)}</div>`;
  flashClass(b, 'show', 1900);
}

function fx(kind: string) {
  const app = $('#app');
  switch (kind) {
    case 'glitch':
      flashClass(app, 'glitch', 450);
      break;
    case 'shake':
      flashClass(app, 'shake', 500);
      break;
    case 'granted':
      flashClass(app, 'glitch', 600);
      banner('ACCESS GRANTED', 'granted');
      break;
    case 'paid':
      banner('PAYMENT RECEIVED', 'paid');
      flashClass($('#credits'), 'bump', 900);
      break;
    case 'portopen':
      flashClass($('#target'), 'flash', 500);
      break;
    case 'firewall':
      flashClass($('#target'), 'flash-fw', 600);
      break;
  }
}

// ------------------------------------------------------------------ render
const cache = new Map<string, string>();
function setHtml(id: string, html: string) {
  if (cache.get(id) === html) return;
  const first = !cache.has(id);
  cache.set(id, html);
  if (first) $(id).innerHTML = html;
  else morph($(id), html);
}

function renderAll() {
  setHtml('#trace', traceHtml(game));
  setHtml('#ram', ramHtml(game));
  setHtml('#guide', guideHtml(game, prefs.tutorial));
  const focus = (focusIp && findHost(game.world, focusIp)) || game.connectedHost || game.home;
  setHtml('#target', targetHtml(game, focus));
  setHtml('#netmap', netmapHtml(game, focus?.ip ?? null));
  const unreadMail = game.run.mails.filter((m) => !m.read).length;
  const unreadIdx = Object.values(game.profile.index).filter((x) => !x.read).length;
  setHtml(
    '#topinfo',
    `<span class="op">OP #${game.profile.runs}</span><span class="org">${esc(game.world.org)}</span>`,
  );
  setHtml('#mail-badge', unreadMail ? String(unreadMail) : '');
  setHtml('#index-badge', unreadIdx ? String(unreadIdx) : '');
  setHtml('#index-count', `${Object.keys(game.profile.index).length}/${INDEX_ENTRIES.length}`);
  $('#sound-btn').classList.toggle('off', !game.profile.sound);
  $('#guide-btn').classList.toggle('off', !prefs.tutorial);
  $('#trace').classList.toggle('danger', game.run.heat >= 75);
  $('#app').classList.toggle('hot', game.run.heat >= 75);
  if (modal) renderModal();
}

function renderCredits(dt: number) {
  const target = game.profile.credits;
  if (shownCredits !== target) {
    const step = Math.max(1, Math.abs(target - shownCredits) * Math.min(1, dt * 4));
    shownCredits = shownCredits < target ? Math.min(target, shownCredits + step) : Math.max(target, shownCredits - step);
  }
  $('#credits-val').textContent = String(Math.round(shownCredits));
}

// ------------------------------------------------------------------ modals
function openModal(kind: 'index' | 'shop' | 'jobs' | 'mail', arg?: string) {
  modal = { kind, arg };
  $('#modal').hidden = false;
  cache.delete('#modal-box');
  renderModal();
}
function closeModal() {
  modal = null;
  $('#modal').hidden = true;
  term.focus();
  renderAll();
}
function renderModal() {
  if (!modal) return;
  const html =
    modal.kind === 'index'
      ? indexModalHtml(game, modal.arg)
      : modal.kind === 'shop'
        ? shopModalHtml(game)
        : modal.kind === 'jobs'
          ? jobsModalHtml(game)
          : mailModalHtml(game, Number(modal.arg ?? game.run.mails.findIndex((m) => !m.read)) >= 0 ? Number(modal.arg ?? game.run.mails.findIndex((m) => !m.read)) : game.run.mails.length - 1);
  const box = $('#modal-box');
  box.className = `modal-box ${modal.kind}`;
  setHtml('#modal-box', html);
}

$('#modal').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.id === 'modal' || t.closest('[data-close]')) return closeModal();
  const idx = t.closest<HTMLElement>('[data-index]');
  if (idx) {
    modal = { kind: 'index', arg: idx.dataset.index };
    renderModal();
    return;
  }
  const buy = t.closest<HTMLElement>('[data-buy]');
  if (buy) {
    term.print([c.dim(`$ buy ${buy.dataset.buy}`)]);
    runCommand(`buy ${buy.dataset.buy}`);
    return;
  }
  const mail = t.closest<HTMLElement>('[data-mail]');
  if (mail) {
    modal = { kind: 'mail', arg: mail.dataset.mail };
    renderModal();
    renderAll();
  }
});

bindHotkeys(window, {
  Escape: () => {
    if (!modal) return false;
    closeModal();
    return true;
  },
  F1: () => {
    openModal('index');
    return true;
  },
});

// ------------------------------------------------------------------ chrome buttons
$('#btn-mail').addEventListener('click', () => openModal('mail'));
$('#btn-jobs').addEventListener('click', () => openModal('jobs'));
$('#btn-shop').addEventListener('click', () => openModal('shop'));
$('#btn-index').addEventListener('click', () => openModal('index'));
$('#btn-train').addEventListener('click', () => {
  if (modal) closeModal();
  if (!$('#traced').hidden) {
    disposeTracedPrompt?.();
    disposeTracedPrompt = null;
    $('#traced').hidden = true;
    term.locked = false;
  }
  term.print([c.dim('$ tutorial')]);
  runCommand('tutorial');
  banner('TRAINING SIM', 'training');
  term.focus();
});
$('#sound-btn').addEventListener('click', () => {
  game.profile.sound = !game.profile.sound;
  synth.enabled = game.profile.sound;
  persist();
  renderAll();
});
$('#guide-btn').addEventListener('click', () => {
  prefs.tutorial = !prefs.tutorial;
  savePrefs();
  renderAll();
});
$('#guide').addEventListener('click', (ev) => {
  const chip = (ev.target as HTMLElement).closest<HTMLElement>('[data-cmd]');
  if (!chip) return;
  const cmd = chip.dataset.cmd!;
  const stepId = game.run.tutorial ? TUTORIAL_STEPS[game.run.tutorial.step].id : '';
  if (cmd.startsWith('↑')) term.pressUp();
  else if (stepId === 'tab') term.setInput('cat brea');
  else if (cmd.includes('<')) term.setInput(cmd.replace(/<.*$/, ''));
  else void term.typeAndRun(cmd);
});
$('#netmap').addEventListener('click', (ev) => {
  const node = (ev.target as Element).closest<SVGGElement>('[data-ip]');
  if (!node) return;
  const ip = node.dataset.ip!;
  focusIp = ip;
  const h = findHost(game.world, ip)!;
  if (h.role !== 'home') term.setInput(`connect ${ip}`);
  renderAll();
});
/** Puts keyboard focus where the visible screen expects it: an overlay's main button, or the terminal. */
function refocus() {
  const overlayBtn = !$('#title').hidden ? $('#jack-in') : !$('#traced').hidden ? $('#new-identity') : null;
  if (overlayBtn) {
    const active = document.activeElement as HTMLElement | null;
    if (!active?.closest('#title, #traced') || active.tagName !== 'BUTTON') overlayBtn.focus();
    return;
  }
  if (!modal && !window.getSelection()?.toString()) term.focus();
}
document.addEventListener('mouseup', refocus);
window.addEventListener('focus', refocus);

// ------------------------------------------------------------------ traced
let disposeTracedPrompt: (() => void) | null = null;
function showTraced() {
  term.locked = true;
  const s = $('#traced');
  s.innerHTML = `<div class="traced-inner">
      <div class="glitch-title" data-text="TRACE COMPLETE">TRACE COMPLETE</div>
      <div class="traced-sub">IDENTITY BURNED // ${esc(game.world.org)} SOC has your source IP</div>
      <div class="traced-stats">
        <div><b>${game.run.earned}¢</b><span>earned this op (banked)</span></div>
        <div><b>${game.profile.credits}¢</b><span>credits carried over</span></div>
        <div><b>${Object.keys(game.profile.index).length}/${INDEX_ENTRIES.length}</b><span>index entries kept</span></div>
      </div>
      <p class="dim">Tools, upgrades and the Index persist. Quiet beats fast: let the trace cool between breaches, and scrub logs on boxes you own.</p>
      <button id="new-identity" class="big-btn">FORGE NEW IDENTITY ▸</button></div>`;
  s.hidden = false;
  term.blur();
  $('#new-identity').focus();
  disposeTracedPrompt = bindPressEnter(window, () => {
    disposeTracedPrompt = null;
    s.hidden = true;
    game.startRun();
    term.locked = false;
    term.clear();
    persist();
    term.focus();
    void boot(true);
  }, { clickTargets: [$('#new-identity')] });
}

// ------------------------------------------------------------------ boot
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function boot(short = false) {
  term.locked = true;
  const lines = short
    ? [c.magenta('NEON//OS') + c.dim(' new identity forged'), `${c.green('[ ok ]')} op #${game.profile.runs} loaded: ${game.world.org}`]
    : [
        c.magenta(c.bold('NEON//OS v2.0.77')) + c.dim('  ghost-rig'),
        `${c.green('[ ok ]')} mounting /home/ghost`,
        `${c.green('[ ok ]')} breach kit: nmap sshbrute webscan fwbypass getroot${game.owns('ftploot') ? ' ftploot' : ''}`,
        `${c.green('[ ok ]')} rig RAM ${game.maxRam} MB  //  trace monitor online`,
        `${c.green('[ ok ]')} uplink to Vex's relay ${c.dim('(encrypted)')}`,
      ];
  for (const l of lines) {
    term.writeRaw(l + '\r\n');
    synth.play('blip');
    await sleep(short ? 120 : 260);
  }
  if (game.inTutorial) {
    banner('TRAINING SIM', 'training');
    term.writeRaw('\r\n' + c.yellow('>> VEX TRAINING SIM loaded.') + c.dim(' Follow Vex one step at a time. The NEXT STEP panel shows what to type.') + '\r\n');
    term.writeRaw(game.tutorialStepLines().join('\r\n') + '\r\n\r\n');
    term.locked = false;
    term.showPrompt();
    term.focus();
    return;
  }
  const unread = game.run.mails.filter((m) => !m.read).length;
  term.writeRaw(
    '\r\n' +
      c.yellow(`>> ${unread || 'No'} unread message${unread === 1 ? '' : 's'}.`) +
      ` Type ${c.cyan('mail')}, or click the ${c.magenta('NEXT STEP')} panel. ${c.dim('help lists every command.')}\r\n\r\n`,
  );
  term.locked = false;
  term.showPrompt();
  term.focus();
  if (game.run.traced) showTraced();
}

function showTitle() {
  const t = $('#title');
  const cont = hadSave && !params.has('fresh');
  t.innerHTML = `<div class="title-inner">
    <div class="logo glitch-title" data-text="PenTrace">PenTrace</div>
    <div class="tagline">BREACH. GET PAID. <span>DON'T GET TRACED.</span></div>
    <div class="title-btns">
      <button class="big-btn" id="jack-in">${
        game.inTutorial || !game.profile.tutorialDone
          ? (game.run.tutorial?.step ?? 0) > 0
            ? `RESUME TRAINING // STEP ${(game.run.tutorial?.step ?? 0) + 1}`
            : 'START TRAINING ▸'
          : cont
            ? `CONTINUE // OP #${game.profile.runs} · ${game.profile.credits}¢`
            : 'JACK IN ▸'
      }</button>
      <div class="row">
        ${game.profile.tutorialDone && !game.inTutorial ? '<button class="ghost-btn" id="train">TRAINING SIM</button>' : ''}
        ${cont ? '<button class="ghost-btn" id="wipe">NEW GAME (wipe save)</button>' : ''}
      </div>
    </div>
    ${!game.profile.tutorialDone ? '<div class="first-note">First time? Vex runs you through a training sim before the real contracts unlock.</div>' : ''}
    <div class="press">press ENTER</div>
    <div class="disclaimer">Every network, host and target in this game is simulated. Real techniques, fictional victims.</div>
  </div>`;
  term.locked = true;
  term.blur();
  let started = false;
  const go = (training = false) => {
    if (started) return;
    started = true;
    disposeEnter();
    t.classList.add('out');
    synth.play('granted');
    setTimeout(() => {
      t.hidden = true;
      refocus();
    }, 600);
    term.focus();
    if (training && !game.inTutorial) game.startTutorial();
    game.routeFromTitle();
    persist();
    renderAll();
    void boot().then(() => {
      if (demoMode) void runDemo();
      if (tutorialDemo) void runTutorialDemo();
    });
  };
  const disposeEnter = bindPressEnter(window, () => go(), {
    clickTargets: [$('#jack-in')],
    ignore: () => ['train', 'wipe'].includes(document.activeElement?.id ?? ''),
  });
  $('#train')?.addEventListener('click', () => go(true));
  $('#wipe')?.addEventListener('click', () => {
    if (!confirm('Wipe your save and start over?')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });
  $('#jack-in').focus();
  if (demoMode || tutorialDemo) setTimeout(() => go(), 2200);
}

// ------------------------------------------------------------------ demo / attract mode
async function waitIdle() {
  await sleep(500);
  while (game.run.procs.length) await sleep(200);
  await sleep(900);
}
async function runDemo() {
  const type = async (cmd: string) => {
    await term.typeAndRun(cmd, 22);
    await waitIdle();
  };
  for (let i = 0; i < 40 && game.run.contracts.c2 !== 'done'; i++) {
    const h = game.nextHint();
    if (h.cmd) await type(h.cmd);
    else await sleep(500);
  }
  await sleep(1200);
  await type('rm /var/log/*');
  await type('dc');
  await sleep(600);
  await type('shop');
  await sleep(1800);
  const buy = document.querySelector<HTMLElement>('[data-buy="ram-512"]');
  buy?.classList.add('demo-hover');
  await sleep(900);
  buy?.click();
  await sleep(2200);
  closeModal();
  await type('index ssh-credential-attacks');
  await sleep(3500);
  const content = document.querySelector('.idx-detail');
  content?.scrollTo({ top: 400, behavior: 'smooth' });
  await sleep(3000);
  modal = { kind: 'index', arg: 'firewall-rules' };
  renderModal();
  await sleep(3500);
  closeModal();
  (window as unknown as { pentraceDemoDone: boolean }).pentraceDemoDone = true;
}

async function runTutorialDemo() {
  const pause = (ms: number) => sleep(ms);
  const step = () => (game.run.tutorial ? TUTORIAL_STEPS[game.run.tutorial.step].id : 'done');
  const type = async (cmd: string) => {
    await term.typeAndRun(cmd, 24);
    await waitIdle();
  };
  let askedHint = false;
  for (let i = 0; i < 70 && game.inTutorial; i++) {
    await pause(1300);
    const id = step();
    if (id === 'tab') {
      await term.typeText('cat brea', 20);
      await pause(500);
      term.pressTab();
      await pause(700);
      term.pressEnter();
      await waitIdle();
    } else if (id === 'history') {
      term.pressUp();
      await pause(900);
      term.pressEnter();
      await waitIdle();
    } else if (id === 'parallel') {
      await term.typeAndRun(`sshbrute ${TRAINING_VAULT_IP}`, 24);
      await pause(500);
      await type(`webscan ${TRAINING_VAULT_IP}`);
    } else if (id === 'submit') {
      await type(`submit drill ${TRAINING_INTRUDER_IP}`);
    } else if (id === 'index') {
      await type('index the-trace');
      await pause(3200);
      closeModal();
    } else if (id === 'shop') {
      await type('shop');
      await pause(1600);
      document.querySelector<HTMLElement>('[data-buy="ram-512"]')?.click();
      await pause(1800);
      closeModal();
      await waitIdle();
    } else if (id === 'jobs' || id === 'mail') {
      await type(id);
      await pause(1600);
      if (modal) closeModal();
    } else if (id === 'graduation' && !askedHint) {
      askedHint = true;
      await type('hint');
    } else {
      const cmd = game.nextHint(true).cmd;
      if (cmd) await type(cmd);
    }
  }
  await pause(4000);
  (window as unknown as { pentraceDemoDone: boolean }).pentraceDemoDone = true;
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let acc = 0;
let saveAcc = 0;
function frame(now: number) {
  const dt = advanceClock((now - last) / 1000, (step) => game.tick(step));
  last = now;
  acc += dt;
  saveAcc += dt;
  renderCredits(dt);
  if (acc > 0.1) {
    acc = 0;
    renderAll();
  }
  if (saveAcc > 3) {
    saveAcc = 0;
    persist();
  }
  requestAnimationFrame(frame);
}

renderAll();
showTitle();
requestAnimationFrame(frame);
window.addEventListener('beforeunload', persist);
(window as unknown as { pentrace: unknown }).pentrace = { get game() { return game; }, INDEX_BY_ID, reset: () => (game = new Game(null)) };
