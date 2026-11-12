import { CONTRACTS } from '../engine/content/contracts';
import { INDEX_BY_ID, INDEX_ENTRIES } from '../engine/content/index-entries';
import { SHOP_ITEMS } from '../engine/content/shop';
import { TUTORIAL_PAY_FIRST, TUTORIAL_PAY_REPLAY, TUTORIAL_STEPS } from '../engine/tutorial';
import type { Game } from '../engine/game';
import { findHost, Host, openPortCount } from '../engine/network';
import {
  FIXERS,
  FIXER_BY_ID,
  PERK_DEFS,
  contactVisibility,
  perkPointsAvailable,
  respecCreditCost,
  standingLabel,
  xpProgress,
} from '../engine/progression';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export function traceHtml(g: Game): string {
  const h = g.run.heat;
  const level = h >= 75 ? 'crit' : h >= 50 ? 'hot' : h >= 25 ? 'warm' : 'cool';
  const label = g.run.traced
    ? 'TRACED'
    : h >= 75
      ? 'SOURCE FLAGGED'
      : h >= 50
        ? 'ANALYST CORRELATING'
        : h > 0.5
          ? 'NOISE DETECTED'
          : 'GHOST MODE';
  const rising = g.run.procs.length > 0 || (g.connectedHost?.alerted ?? false);
  return `
    <div class="panel-title">TRACE <span class="dim">// soc detection</span></div>
    <div class="trace-readout ${level}">
      <span class="trace-pct">${Math.floor(h)}<small>%</small></span>
      <span class="trace-state">${label}${rising ? ' <b class="arrow">▲</b>' : h > 0.5 ? ' <b class="arrow down">▼</b>' : ''}</span>
    </div>
    <div class="meter trace-meter ${level}"><div class="fill" style="width:${h}%"></div>
      <i style="left:50%"></i><i style="left:75%"></i></div>
    <div class="meter-labels"><span>0</span><span>50 analyst</span><span>75 flag</span><span>100</span></div>`;
}

export function ramHtml(g: Game): string {
  const used = g.usedRam;
  const max = g.maxRam;
  const procs = g.run.procs
    .map((p) => {
      const pct = Math.min(100, (p.elapsed / p.duration) * 100);
      const host = findHost(g.world, p.target);
      return `<div class="proc" data-key="${p.pid}">
        <div class="proc-head"><span class="proc-name">${esc(p.toolId)}</span><span class="dim">${esc(host?.hostname ?? p.target)}</span><span class="proc-ram">${p.ram}MB</span></div>
        <div class="meter proc-meter"><div class="fill" style="width:${pct}%"></div></div></div>`;
    })
    .join('');
  return `
    <div class="panel-title">RAM <span class="dim">// ${used}/${max} MB</span></div>
    <div class="meter ram-meter"><div class="fill" style="width:${(used / max) * 100}%"></div></div>
    <div class="procs">${procs || '<div class="dim idle">idle. no processes running</div>'}</div>`;
}

export function guideHtml(g: Game, tutorial: boolean): string {
  const h = g.nextHint();
  const t = g.run.tutorial;
  if (t) {
    const pct = (t.step / TUTORIAL_STEPS.length) * 100;
    return `
    <div class="panel-title">TRAINING SIM <span class="dim">// step ${t.step + 1}/${TUTORIAL_STEPS.length}</span></div>
    <div class="meter train-meter"><div class="fill" style="width:${pct}%"></div></div>
    <div class="guide-text train-title">${esc(h.text)}</div>
    ${h.cmd ? `<div class="train-type dim">type this in the terminal:</div><button class="chip" data-cmd="${esc(h.cmd)}">▸ ${esc(h.cmd)}</button>` : ''}
    <div class="dim train-foot">Vex's instructions are in the terminal. The trace cannot burn you in here.${g.profile.tutorialDone ? ' Replay? tutorial skip leaves.' : ''}</div>`;
  }
  const job = CONTRACTS.find((c) => g.run.contracts[c.id] === 'active');
  return `
    <div class="panel-title">NEXT STEP <span class="dim">// ${tutorial ? 'guide on' : 'guide off'}</span></div>
    ${tutorial ? `<div class="guide-text">${esc(h.text)}</div>${h.cmd ? `<button class="chip" data-cmd="${esc(h.cmd)}">▸ ${esc(h.cmd)}</button>` : ''}` : '<div class="dim">Type hint if you get stuck.</div>'}
    ${job ? `<div class="job-mini"><span class="tag">${job.id.toUpperCase()} · ${esc(job.type)}</span><b>${esc(job.title)}</b><span class="pay">${job.payout}¢</span><div class="dim">${esc(job.objective(g.world))}</div></div>` : ''}`;
}

export function targetHtml(g: Game, focus: Host | null): string {
  if (!focus) return `<div class="panel-title">TARGET</div><div class="dim">no target</div>`;
  const h = focus;
  const connected = g.run.connected === h.ip;
  const ports = h.ports
    .map((p) => {
      const proc = g.run.procs.find((x) => x.target === h.ip && g.registry.get(x.toolId)?.targetPort === p.num);
      const state = p.open ? 'open' : proc ? 'cracking' : 'locked';
      const pct = proc ? Math.min(100, (proc.elapsed / proc.duration) * 100) : p.open ? 100 : 0;
      const known = h.scanned;
      return `<div class="port ${state}">
        <div class="port-num">${known ? p.num : '??'}</div>
        <div class="port-svc">${known ? esc(p.service) : '???'}</div>
        <div class="port-ver">${h.fingerprinted ? esc(p.version) : known ? 'nmap -sV for version' : ''}</div>
        <div class="port-state">${state === 'open' ? 'OPEN' : state === 'cracking' ? 'CRACKING' : p.crackedBy ? 'LOCKED' : 'NO EXPLOIT'}</div>
        <div class="meter port-meter"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join('');
  const fw = h.firewall
    ? `<div class="fw ${h.firewall.bypassed ? 'ok' : 'bad'}">FIREWALL ${h.firewall.bypassed ? 'BYPASSED' : 'ACTIVE'}${h.firewall.bypassed ? '' : ` <span class="dim">fwrules ${h.ip}</span>`}</div>`
    : h.role === 'home'
      ? ''
      : '<div class="fw none">NO FIREWALL</div>';
  const fwProc = g.run.procs.find((x) => x.target === h.ip && x.toolId === 'fwbypass');
  const rootProc = g.run.procs.find((x) => x.target === h.ip && x.toolId === 'getroot');
  return `
    <div class="panel-title">TARGET <span class="dim">// ${connected ? 'connected' : 'remote'}</span></div>
    <div class="target-head">
      <div><div class="target-name">${esc(h.hostname)}</div><div class="target-ip">${h.ip}</div></div>
      <div class="badge ${h.root ? 'root' : h.role === 'home' ? 'home' : 'guest'}">${h.role === 'home' ? 'YOUR RIG' : h.root ? 'ROOT' : 'NO ACCESS'}</div>
    </div>
    ${h.role === 'home' ? '<div class="dim">Your deck. Select a node on the netmap.</div>' : ''}
    ${fw}${fwProc ? `<div class="meter port-meter"><div class="fill" style="width:${(fwProc.elapsed / fwProc.duration) * 100}%"></div></div>` : ''}
    ${h.role !== 'home' ? `<div class="req">PORTS REQUIRED <b>${openPortCount(h)}/${h.portsRequired}</b>${h.alerted ? '<span class="alert">IDS ALERTED</span>' : ''}</div>` : ''}
    <div class="ports">${ports}</div>
    ${rootProc ? `<div class="rooting">ESCALATING PRIVILEGES<div class="meter port-meter"><div class="fill" style="width:${(rootProc.elapsed / rootProc.duration) * 100}%"></div></div></div>` : ''}
    ${h.credsFound && h.role !== 'home' ? `<div class="creds">creds: <b>${esc(h.account.user)}</b> / <b>${esc(h.account.pass)}</b></div>` : ''}`;
}

const POS: Record<string, [number, number]> = { home: [60, 160], gateway: [185, 160], soc: [310, 62], finance: [310, 258] };

export function netmapHtml(g: Game, focusIp: string | null): string {
  const hosts = g.world.hosts;
  const lines: string[] = [];
  for (const h of hosts) {
    if (!h.discovered) continue;
    for (const ip of h.links) {
      const o = findHost(g.world, ip);
      if (!o || !o.discovered || o.ip < h.ip) continue;
      const [x1, y1] = POS[h.role];
      const [x2, y2] = POS[o.role];
      lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="link ${g.run.connected === h.ip || g.run.connected === o.ip ? 'live' : ''}"/>`);
    }
  }
  const nodes = hosts
    .map((h) => {
      const [x, y] = POS[h.role];
      if (!h.discovered) return `<g class="node ghost" transform="translate(${x},${y})"><circle r="18"/><text y="5">?</text><text class="lbl" y="38">undiscovered</text></g>`;
      const cls = [
        'node',
        h.role === 'home' ? 'home' : h.root ? 'owned' : 'enemy',
        h.alerted ? 'alerted' : '',
        g.run.connected === h.ip ? 'connected' : '',
        focusIp === h.ip ? 'focus' : '',
      ].join(' ');
      return `<g class="${cls}" data-ip="${h.ip}" transform="translate(${x},${y})">
        <circle class="ring" r="26"/><circle r="18"/>
        <text y="5">${h.role === 'home' ? '◉' : h.root ? '♛' : h.firewall && !h.firewall.bypassed ? '⛨' : '◆'}</text>
        <text class="lbl" y="38">${esc(h.hostname)}</text><text class="lbl ip" y="52">${h.ip}</text></g>`;
    })
    .join('');
  return `<div class="panel-title">NETMAP <span class="dim">// ${esc(g.world.org)}</span></div>
    <svg viewBox="0 0 380 330" class="netmap-svg">${lines.join('')}${nodes}</svg>`;
}

export function indexModalHtml(g: Game, selected?: string): string {
  const unlocked = Object.keys(g.profile.index);
  const sel = selected && g.profile.index[selected] ? selected : unlocked[unlocked.length - 1];
  const list = INDEX_ENTRIES.map((e) => {
    const on = !!g.profile.index[e.id];
    const unread = on && !g.profile.index[e.id].read;
    return `<button class="idx-item ${on ? '' : 'locked'} ${e.id === sel ? 'sel' : ''}" ${on ? `data-index="${e.id}"` : 'disabled'}>
      <span class="idx-cat">${esc(e.category)}</span>${on ? esc(e.title) : '██████████'}${unread ? '<span class="new">NEW</span>' : ''}
      ${on ? '' : `<span class="idx-hint">${esc(e.unlockHint)}</span>`}</button>`;
  }).join('');
  const e = sel ? INDEX_BY_ID[sel] : null;
  if (e && g.profile.index[e.id]) g.profile.index[e.id].read = true;
  const section = (n: string, title: string, items: string[], cls: string) =>
    `<section class="idx-sec ${cls}"><h4><span>${n}</span>${title}</h4>${items.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`;
  const detail = e
    ? `<div class="idx-detail">
        <div class="idx-meta"><span class="tag">${esc(e.category)}</span><span class="tag">TIER ${e.tier}</span>${e.mitre ? `<span class="tag mitre">MITRE ATT&amp;CK ${esc(e.mitre)}</span>` : ''}</div>
        <h2 class="idx-title">${esc(e.title)}</h2>
        ${section('①', 'REAL WORLD', e.realWorld, 'rw')}
        ${section('②', 'IN GAME', e.inGame, 'ig')}
        ${section('③', 'DETECTION &amp; DEFENSE', e.defense, 'df')}
        <div class="idx-related">Related: ${e.related.map((r) => (g.profile.index[r] ? `<a data-index="${r}">${esc(INDEX_BY_ID[r].title)}</a>` : '<span class="dim">locked</span>')).join(' · ')}</div>
      </div>`
    : `<div class="idx-detail empty"><h2>THE INDEX</h2><p>Your codex of real attack techniques and how defenders catch them. Entries unlock as you use them in breaches.</p></div>`;
  return `<div class="modal-head"><h3>THE INDEX <span class="dim">${unlocked.length}/${INDEX_ENTRIES.length}</span></h3><button class="x" data-close>✕</button></div>
    <div class="idx-wrap"><div class="idx-list">${list}</div>${detail}</div>`;
}

export function operatorRankHtml(g: Game): string {
  const xp = xpProgress(g.profile.operatorRank, g.profile.operatorXp);
  return `<span class="rank-pill" title="Operator Rank / Street Cred">R${g.profile.operatorRank} <span class="rank-bar"><i style="width:${xp.pct}%"></i></span></span>`;
}

export function shopModalHtml(g: Game): string {
  const cards = SHOP_ITEMS.map((i) => {
    const owned = g.owns(i.id);
    const afford = g.profile.credits >= i.price;
    const rankOk = !i.minRank || g.profile.operatorRank >= i.minRank;
    const stOk = !i.standingGate || g.standingNow(i.standingGate.fixer) >= i.standingGate.level;
    const gated = !owned && i.minRank && i.standingGate ? !(rankOk || stOk) : !owned && i.minRank ? !rankOk : !owned && i.standingGate ? !stOk : false;
    const gateHint = gated
      ? i.standingGate && i.minRank
        ? `Relay run ${i.standingGate.level}+ or Rank ${i.minRank}+`
        : i.minRank
          ? `Rank ${i.minRank}+`
          : `Run standing ${i.standingGate!.level}+`
      : '';
    return `<div class="shop-card ${owned ? 'owned' : ''} ${gated ? 'gated' : ''} kind-${i.kind}">
      <div class="shop-kind">${i.kind.toUpperCase()}</div>
      <div class="shop-name">${esc(i.name)}</div>
      <p>${esc(i.blurb)}</p>
      <p class="effect">${esc(i.effect)}</p>
      ${gateHint ? `<p class="gate dim">${esc(gateHint)}</p>` : ''}
      <button class="buy" data-buy="${i.id}" ${owned || !afford || gated ? 'disabled' : ''}>${owned ? 'OWNED' : `BUY ${i.price}¢`}</button>
    </div>`;
  }).join('');
  return `<div class="modal-head"><h3>BLACK MARKET <span class="credits-pill">${g.profile.credits}¢</span></h3><button class="x" data-close>✕</button></div>
    <p class="dim modal-sub">Purchases are permanent. They carry over to every future op, even if you get traced.</p>
    <div class="shop-grid">${cards}</div>
    <div class="workshop-teaser"><b>WORKSHOP</b> <span class="dim">coming soon: build your own scanners, crackers and log watchers in Bash or Python. They plug into the same slots as these tools.</span></div>`;
}

export function jobsModalHtml(g: Game): string {
  const t = g.run.tutorial;
  const drill = t
    ? `<div class="job-card ${t.paid ? 'done' : 'active'}"><div class="job-top"><span class="tag">DRILL · Tutorial</span><span class="pay">${g.profile.tutorialDone ? TUTORIAL_PAY_REPLAY : TUTORIAL_PAY_FIRST}¢</span></div>
      <div class="job-title">Training Sim</div><div class="dim">Follow Vex through the sim, step by step.</div><div class="job-state">${t.paid ? 'PAID' : 'ACTIVE'}</div></div>`
    : '';
  const cards = drill + CONTRACTS.map((c) => {
    if (t) {
      return `<div class="job-card locked"><div class="job-top"><span class="tag">${c.id.toUpperCase()} · ${esc(c.type)}</span><span class="pay">${c.payout}¢</span></div>
      <div class="job-title">${esc(c.title)}</div><div class="dim">Finish training to unlock.</div><div class="job-state">LOCKED</div></div>`;
    }
    const st = g.run.contracts[c.id];
    const fixer = FIXER_BY_ID[c.fixerId];
    return `<div class="job-card ${st}"><div class="job-top"><span class="fixer-icon" title="${esc(fixer.name)}">${esc(fixer.icon)}</span><span class="tag">${c.id.toUpperCase()} · ${esc(c.type)}</span><span class="pay">${c.payout}¢</span></div>
      <div class="job-title">${esc(c.title)}</div>
      <div class="dim">${st === 'locked' ? 'Unlocks after the previous job.' : esc(c.objective(g.world))}</div>
      <div class="job-state">${st.toUpperCase()}</div></div>`;
  }).join('');
  return `<div class="modal-head"><h3>CONTRACT BOARD <span class="dim">${esc(g.world.org)}</span></h3><button class="x" data-close>✕</button></div><div class="jobs-grid ${t ? 'four' : ''}">${cards}</div>`;
}

export function contactsModalHtml(g: Game): string {
  const eff = (id: import('../engine/progression').FixerId) => g.standingNow(id);
  const cards = FIXERS.map((f) => {
    const vis = contactVisibility(f, g.profile, eff);
    if (vis === 'hidden') return '';
    const pulse = vis === 'active' && f.id === 'relay';
    if (vis === 'teaser') {
      return `<div class="contact-card teaser"><span class="fixer-icon dim">${esc(f.icon)}</span><div><b>${esc(f.name)}</b><div class="dim">${esc(f.teaser ?? '')}</div></div></div>`;
    }
    if (vis === 'locked') {
      return `<div class="contact-card locked"><span class="fixer-icon dim">${esc(f.icon)}</span><div><b>${esc(f.name)}</b><div class="dim">${esc(f.tagline)}</div></div></div>`;
    }
    if (f.id === 'vex' && g.profile.vexGraduated) {
      return `<div class="contact-card done"><span class="fixer-icon dim">VX</span><div><b>Vex</b><div class="dim">Training complete</div></div></div>`;
    }
    const lbl = standingLabel(g.profile, g.run, f.id);
    return `<div class="contact-card ${pulse ? 'pulse' : 'active'}"><span class="fixer-icon">${esc(f.icon)}</span>
      <div><b>${esc(f.name)}</b><div class="dim">${esc(f.tagline)}</div>
      <div class="standing-meter"><span title="Run standing · Trust Floor (meta)">${esc(lbl)}</span><button type="button" class="chip" data-panel="jobs">Request work</button></div></div></div>`;
  }).join('');
  return `<div class="modal-head"><h3>CONTACTS <span class="dim">fixer roster</span></h3><button class="x" data-close>✕</button></div>
    <p class="dim modal-sub">Run Standing (this op) gates gigs and fixer shop hooks. Trust Floor (meta, 0–5) is your jack-in baseline and only rises when you finish a broker set.</p>
    <div class="contacts-grid">${cards}</div>`;
}

export function perksModalHtml(g: Game): string {
  const avail = perkPointsAvailable(g.profile.operatorRank, g.profile.perkRanks);
  const cost = respecCreditCost(g.profile.operatorRank);
  const cards = Object.values(PERK_DEFS).map((def) => {
    const rank = g.profile.perkRanks[def.id] ?? 0;
    const locked = g.profile.operatorRank < def.minRank;
    const canBuy = !locked && rank < def.max && avail > 0;
    return `<div class="perk-card ${locked ? 'locked' : ''} branch-${def.branch}">
      <div class="perk-name">${esc(def.name)} <span class="dim">${rank}/${def.max}</span></div>
      <p class="dim">${esc(def.desc)}</p>
      ${locked ? `<p class="gate">Rank ${def.minRank}+</p>` : `<button class="buy" data-perk="${def.id}" ${canBuy ? '' : 'disabled'}>${rank ? 'RANK UP' : 'EQUIP I'}</button>`}
    </div>`;
  }).join('');
  return `<div class="modal-head"><h3>PERKS <span class="dim">${avail} point${avail === 1 ? '' : 's'}</span></h3><button class="x" data-close>✕</button></div>
    <p class="dim modal-sub">${g.profile.freeRespecThisRun ? 'Free respec available this run.' : `Paid respec: ${cost}¢`}</p>
    <button class="ghost-btn" data-perk-respec ${avail === perkPointsAvailable(g.profile.operatorRank, g.profile.perkRanks) && Object.values(g.profile.perkRanks).every((n) => !n) ? 'disabled' : ''}>Respec</button>
    <div class="perks-grid">${cards}</div>`;
}

export function mailModalHtml(g: Game, idx: number): string {
  const mails = g.run.mails;
  const m = mails[idx] ?? mails[mails.length - 1];
  if (m) m.read = true;
  const list = mails
    .map((x, i) => `<button class="mail-item ${i === idx ? 'sel' : ''} ${x.read ? '' : 'unread'}" data-mail="${i}"><b>${esc(x.from)}</b><span>${esc(x.subject)}</span></button>`)
    .join('');
  return `<div class="modal-head"><h3>MAIL <span class="dim">encrypted relay</span></h3><button class="x" data-close>✕</button></div>
    <div class="mail-wrap"><div class="mail-list">${list}</div>
    <div class="mail-body">${m ? `<div class="mail-subj">${esc(m.subject)}</div><div class="dim">from ${esc(m.from)}</div>${m.body.map((l) => `<p>${esc(l)}</p>`).join('')}` : ''}</div></div>`;
}
