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
import { GameTerminal } from './ui/terminal';

const SAVE_KEY = 'neontrace-save-v1';
const PREFS_KEY = 'neontrace-prefs-v1';
const params = new URLSearchParams(location.search);
const demoMode = params.has('demo');
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
let game = new Game(loadSave(), seedParam ? Number(seedParam) : undefined);
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

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && modal) closeModal();
  if (ev.key === 'F1') {
    ev.preventDefault();
    openModal('index');
  }
});

// ------------------------------------------------------------------ chrome buttons
$('#btn-mail').addEventListener('click', () => openModal('mail'));
$('#btn-jobs').addEventListener('click', () => openModal('jobs'));
$('#btn-shop').addEventListener('click', () => openModal('shop'));
$('#btn-index').addEventListener('click', () => openModal('index'));
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
  if (cmd.includes('<')) term.setInput(cmd.replace(/<.*$/, ''));
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
$('#app').addEventListener('mouseup', () => {
  if (!modal && !window.getSelection()?.toString()) term.focus();
});

// ------------------------------------------------------------------ traced
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
  $('#new-identity').addEventListener('click', () => {
    s.hidden = true;
    game.startRun();
    term.locked = false;
    term.clear();
    persist();
    void boot(true);
  });
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
    <div class="logo glitch-title" data-text="NEONTRACE">NEONTRACE</div>
    <div class="tagline">BREACH. GET PAID. <span>DON'T GET TRACED.</span></div>
    <div class="title-btns">
      <button class="big-btn" id="jack-in">${cont ? `CONTINUE // OP #${game.profile.runs} · ${game.profile.credits}¢` : 'JACK IN ▸'}</button>
      ${cont ? '<button class="ghost-btn" id="wipe">NEW GAME (wipe save)</button>' : ''}
    </div>
    <div class="press">press ENTER</div>
    <div class="disclaimer">Every network, host and target in this game is simulated. Real techniques, fictional victims.</div>
  </div>`;
  const go = () => {
    window.removeEventListener('keydown', onKey);
    t.classList.add('out');
    synth.play('granted');
    setTimeout(() => (t.hidden = true), 600);
    void boot().then(() => {
      if (demoMode) void runDemo();
    });
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Enter' && go();
  window.addEventListener('keydown', onKey);
  $('#jack-in').addEventListener('click', go);
  $('#wipe')?.addEventListener('click', () => {
    if (!confirm('Wipe your save and start over?')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });
  if (demoMode) setTimeout(go, 1800);
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
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let acc = 0;
let saveAcc = 0;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  game.tick(dt);
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
(window as unknown as { neontrace: unknown }).neontrace = { get game() { return game; }, INDEX_BY_ID, reset: () => (game = new Game(null)) };
