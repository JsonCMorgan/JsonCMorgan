import { INDEX_BY_ID } from '../engine/content/index-entries';
import type { Sound } from '../engine/events';
import { missionStages, type McStage, type MissionReport } from '../engine/mission-complete';
import { totalXpForRank, xpProgress } from '../engine/progression';
import { esc } from './panels';

export interface PerkOption {
  id: string;
  name: string;
  desc: string;
  rank: number;
  max: number;
}

export interface MissionCompleteHooks {
  sound(s: Sound): void;
  reducedMotion(): boolean;
  toggleMotion(): void;
  /** Perks the player can spend a point on right now. */
  perkOptions(): PerkOption[];
  perkPointsLeft(): number;
  pickPerk(id: string): void;
  onClose(): void;
}

const COUNT_MS = 1100;
const BAR_MS = 1400;

function rankAt(xp: number, from: number): number {
  let r = from;
  while (r < 40 && xp >= totalXpForRank(r + 1)) r++;
  return r;
}

/**
 * JRPG-style Mission Complete overlay. Nothing advances on a timer: Enter or a click moves to the
 * next stage, and pressing Enter during a count-up or bar fill snaps it to the final value first.
 */
export class MissionCompleteView {
  private report: MissionReport | null = null;
  private stages: McStage[] = [];
  private idx = 0;
  /** 0..1 progress of the current stage's animation; 1 = settled. */
  private anim = 1;
  private raf = 0;
  private animStart = 0;
  private lastTickAt = 0;
  private perkPromptOpen = false;
  private picked: string[] = [];
  private flipped = new Set<string>();
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private root: HTMLElement, private hooks: MissionCompleteHooks) {
    root.addEventListener('click', (e) => this.onClick(e));
  }

  get isOpen(): boolean {
    return !!this.report;
  }

  open(report: MissionReport) {
    this.report = report;
    this.stages = missionStages(report);
    this.idx = 0;
    this.picked = [];
    this.flipped.clear();
    this.perkPromptOpen = false;
    this.root.hidden = false;
    this.root.dataset.kind = report.kind;
    this.root.classList.toggle('flagged', !!report.flagged);
    window.addEventListener('keydown', this.keyHandler, { capture: true });
    this.enterStage();
  }

  close() {
    if (!this.report) return;
    cancelAnimationFrame(this.raf);
    this.report = null;
    this.root.hidden = true;
    this.root.innerHTML = '';
    window.removeEventListener('keydown', this.keyHandler, { capture: true });
    this.hooks.onClose();
  }

  private get stage(): McStage {
    return this.stages[this.idx];
  }

  private enterStage() {
    const r = this.report!;
    const s = this.stage;
    if (s === 'splash') this.hooks.sound(r.flagged ? 'error' : 'fanfare');
    if (s === 'loot' && r.newCards.length) this.hooks.sound('unlock');
    const animated = (s === 'tally' && (r.credits || r.xp)) || (s === 'growth' && r.xpAfter > r.xpBefore);
    if (animated && !this.hooks.reducedMotion()) {
      this.anim = 0;
      this.animStart = performance.now();
      this.lastTickAt = 0;
      this.raf = requestAnimationFrame((t) => this.step(t));
    } else this.settle();
    this.render();
  }

  private step(now: number) {
    const dur = this.stage === 'growth' ? BAR_MS : COUNT_MS;
    const prevRank = this.stage === 'growth' ? this.barRank() : 0;
    this.anim = Math.min(1, (now - this.animStart) / dur);
    if (now - this.lastTickAt > 70) {
      this.lastTickAt = now;
      this.hooks.sound('tick');
    }
    if (this.stage === 'growth' && this.barRank() > prevRank) this.hooks.sound('rankup');
    this.updateDynamic();
    if (this.anim < 1) this.raf = requestAnimationFrame((t) => this.step(t));
    else this.settle();
  }

  /** Snap the current stage to its final state (Enter during a count). */
  private settle() {
    cancelAnimationFrame(this.raf);
    this.anim = 1;
    const r = this.report!;
    if (this.stage === 'growth' && r.rankAfter > r.rankBefore && r.perkPoints > 0 && !this.perkPromptOpen) {
      this.perkPromptOpen = true;
      this.hooks.sound('granted');
    }
    this.render();
  }

  private advance() {
    if (!this.report) return;
    if (this.anim < 1) return this.settle();
    if (this.idx >= this.stages.length - 1) return this.close();
    this.idx++;
    this.hooks.sound('blip');
    this.enterStage();
  }

  private onKey(e: KeyboardEvent) {
    if (!this.report) return;
    e.stopImmediatePropagation();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.advance();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (this.stage === 'debrief') this.close();
      else {
        this.idx = this.stages.length - 1;
        this.enterStage();
      }
    } else if (/^[1-9]$/.test(e.key) && this.stage === 'debrief') {
      const id = this.report.cards[Number(e.key) - 1];
      if (id) this.flip(id);
    }
  }

  private onClick(e: MouseEvent) {
    if (!this.report) return;
    const t = e.target as HTMLElement;
    const card = t.closest<HTMLElement>('[data-flip]');
    if (card) return this.flip(card.dataset.flip!);
    const perk = t.closest<HTMLElement>('[data-mc-perk]');
    if (perk) {
      this.hooks.pickPerk(perk.dataset.mcPerk!);
      this.picked.push(perk.dataset.mcPerk!);
      this.render();
      return;
    }
    if (t.closest('[data-mc-motion]')) {
      this.hooks.toggleMotion();
      if (this.hooks.reducedMotion()) this.settle();
      this.render();
      return;
    }
    if (t.closest('[data-mc-close]')) return this.close();
    if (t.closest('[data-mc-next]') || (t.closest('.mc-stage') && this.stage !== 'debrief')) this.advance();
  }

  private flip(id: string) {
    if (this.flipped.has(id)) this.flipped.delete(id);
    else this.flipped.add(id);
    this.hooks.sound('blip');
    this.render();
  }

  private ease(): number {
    return 1 - Math.pow(1 - this.anim, 3);
  }

  private barXp(): number {
    const r = this.report!;
    return r.xpBefore + (r.xpAfter - r.xpBefore) * (this.stage === 'growth' ? this.ease() : 1);
  }

  private barRank(): number {
    return rankAt(this.barXp(), this.report!.rankBefore);
  }

  /** Patches only the counting numbers and the bar, so slam-in animations do not restart every frame. */
  private updateDynamic() {
    const r = this.report!;
    const set = (key: string, fn: (el: HTMLElement) => void) => {
      const el = this.root.querySelector<HTMLElement>(`[data-dyn="${key}"]`);
      if (el) fn(el);
    };
    const k = this.ease();
    if (this.stage === 'tally') {
      set('credits', (el) => r.credits && (el.textContent = `+${Math.round(r.credits * k)}¢`));
      set('xp', (el) => (el.textContent = `+${Math.round(r.xp * k)}`));
    }
    if (this.stage === 'growth') {
      const rank = this.barRank();
      const prog = xpProgress(rank, this.barXp());
      set('bar', (el) => (el.style.width = `${prog.pct}%`));
      set('rank', (el) => {
        el.textContent = `R${rank}`;
        el.parentElement?.classList.toggle('up', rank > r.rankBefore);
      });
      set('need', (el) => (el.textContent = `${Math.round(prog.into)}/${prog.need} XP to Rank ${rank + 1}`));
    }
  }

  private render() {
    const r = this.report;
    if (!r) return;
    const motion = this.hooks.reducedMotion() ? 'reduced' : 'full';
    this.root.className = `mc-overlay kind-${r.kind}${r.flagged ? ' flagged' : ''} motion-${motion}`;
    const dots = this.stages.map((s, i) => `<i class="${i === this.idx ? 'on' : i < this.idx ? 'done' : ''}" title="${s}"></i>`).join('');
    const last = this.idx >= this.stages.length - 1;
    this.root.innerHTML = `
      <div class="mc-frame">
        <div class="mc-top"><span class="mc-sub">${esc(r.subtitle)}</span><span class="mc-dots">${dots}</span>
          <button class="mc-motion" data-mc-motion title="Reduced motion makes counts instant and removes slam-ins">MOTION: ${motion.toUpperCase()}</button></div>
        <div class="mc-stage stage-${this.stage}" data-stage-key="${this.idx}">${this.stageHtml(r)}</div>
        <div class="mc-foot">
          <span class="dim">${this.anim < 1 ? 'Enter to skip the count' : last ? 'Game paused. Take your time.' : 'Enter or click to continue · Esc jumps to the debrief'}</span>
          ${last ? '<button class="big-btn mc-continue" data-mc-close>CONTINUE ▸</button>' : '<button class="ghost-btn mc-next" data-mc-next>NEXT ▸</button>'}
        </div>
      </div>`;
    if (last) this.root.querySelector<HTMLElement>('.mc-continue')?.focus({ preventScroll: true });
  }

  private stageHtml(r: MissionReport): string {
    switch (this.stage) {
      case 'splash':
        return `<div class="mc-splash"><div class="glitch-title mc-title" data-text="${esc(r.splash)}">${esc(r.splash)}</div>
          <div class="mc-mission">${esc(r.title)}</div><div class="dim mc-press">press ENTER</div></div>`;
      case 'tally': {
        const k = this.ease();
        return `<div class="mc-panel mc-tally"><h3>TALLY</h3>
          <div class="mc-row"><span>CREDITS</span><b class="mc-num credits" data-dyn="credits">${r.credits ? `+${Math.round(r.credits * k)}¢` : '<span class="dim">training shift: no pay</span>'}</b></div>
          <div class="mc-row"><span>OPERATOR XP</span><b class="mc-num xp" data-dyn="xp">+${Math.round(r.xp * k)}</b></div>
          ${r.fixerLine && this.anim >= 1 ? `<div class="mc-fixer">${esc(r.fixerLine)}</div>` : ''}</div>`;
      }
      case 'growth':
        return this.growthHtml(r);
      case 'loot':
        return `<div class="mc-panel mc-loot"><h3>LOOT</h3>${r.loot
          .map((l) => {
            const rarity = l.kind !== 'card' ? 'common' : (l.tier ?? 0) >= 5 ? 'rare' : (l.tier ?? 0) >= 4 ? 'uncommon' : 'common';
            const icon = l.kind === 'card' ? '◆' : l.kind === 'ioc' ? '⌖' : '▤';
            return `<div class="mc-loot-item ${l.kind} ${rarity}"><span class="mc-icon">${icon}</span><span>${esc(l.label)}</span>${l.kind === 'card' ? '<span class="new">NEW INDEX</span>' : ''}</div>`;
          })
          .join('')}</div>`;
      case 'debrief':
        return this.debriefHtml(r);
    }
  }

  private growthHtml(r: MissionReport): string {
    const xp = this.barXp();
    const rank = this.barRank();
    const prog = xpProgress(rank, xp);
    const rankedUp = rank > r.rankBefore;
    const options = this.perkPromptOpen ? this.hooks.perkOptions() : [];
    const left = this.hooks.perkPointsLeft();
    const prompt = this.perkPromptOpen
      ? `<div class="mc-perk-prompt">
          <div class="mc-stamp">PERK POINT EARNED</div>
          <p>Operator Rank ${r.rankAfter}. You have <b>${left}</b> perk point${left === 1 ? '' : 's'} to spend. Pick one now, or decide later in PERKS.</p>
          <div class="mc-perks">${
            left > 0 && options.length
              ? options
                  .map((o) => `<button class="mc-perk" data-mc-perk="${esc(o.id)}"><b>${esc(o.name)}</b> <span class="dim">${o.rank}/${o.max}</span><span class="dim">${esc(o.desc)}</span></button>`)
                  .join('')
              : `<span class="dim">${this.picked.length ? 'Equipped. ' : ''}${left > 0 ? 'Nothing to spend on at this rank yet: your point is banked.' : 'All points spent.'}</span>`
          }</div>
          <div class="dim">Enter: decide later</div></div>`
      : '';
    return `<div class="mc-panel mc-growth"><h3>OPERATOR RANK</h3>
      <div class="mc-rank ${rankedUp ? 'up' : ''}"><span data-dyn="rank">R${rank}</span><span class="mc-rankup">RANK UP</span></div>
      <div class="mc-bar"><div class="fill" data-dyn="bar" style="width:${prog.pct}%"></div></div>
      <div class="dim" data-dyn="need">${Math.round(prog.into)}/${prog.need} XP to Rank ${rank + 1}</div>
      ${prompt}</div>`;
  }

  private debriefHtml(r: MissionReport): string {
    const lessons = r.lessons.map((l, i) => `<li><span class="mc-n">${i + 1}</span>${esc(l)}</li>`).join('');
    const cards = r.cards
      .map((id, i) => {
        const e = INDEX_BY_ID[id];
        if (!e) return '';
        const isNew = r.newCards.includes(id);
        return `<button class="mc-card ${this.flipped.has(id) ? 'flipped' : ''}" data-flip="${esc(id)}" title="Click or press ${i + 1} to flip">
          <div class="mc-card-inner">
            <div class="mc-card-front"><span class="mc-key">${i + 1}</span><span class="idx-cat">${esc(e.category)}</span><b>${esc(e.title)}</b>${isNew ? '<span class="new">NEW</span>' : ''}<span class="dim">flip ▸</span></div>
            <div class="mc-card-back">
              <h5>REAL WORLD</h5><p>${esc(e.realWorld[0])}</p>
              <h5>DEFENSE</h5><p>${esc(e.defense[0])}</p>
              <h5>INTERVIEW</h5>${e.interview.map((l) => `<p class="mc-say">"${esc(l)}"</p>`).join('')}
            </div>
          </div></button>`;
      })
      .join('');
    return `<div class="mc-panel mc-debrief"><h3>DEBRIEF // ${esc(r.title)}</h3>
      <h4>LESSONS LEARNED</h4><ol class="mc-lessons">${lessons}</ol>
      ${cards ? `<h4>CARDS FROM THIS MISSION</h4><div class="mc-cards">${cards}</div>` : ''}
      <div class="dim">Review later: study reopens this debrief, interview prints every interview line you have unlocked.</div></div>`;
  }
}
