import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { stripAnsi } from '../engine/ansi';
import { type CommandDelayPlan } from '../engine/command-delay';
import { delayMsPerWord, type RevealPacingContext, tokenizeRevealLine, wordsPerSecond } from '../engine/word-reveal';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const WORK_FRAMES = ['▖', '▘', '▝', '▗'];

export interface TermHooks {
  prompt(): string;
  submit(line: string): void | Promise<void>;
  complete(partial: string): string[];
  onKey?(): void;
}

/** Line editor on top of xterm.js: history, cursor movement, tab completion, async output. */
export class GameTerminal {
  term: Terminal;
  private fit = new FitAddon();
  private buf = '';
  private cursor = 0;
  private history: string[] = [];
  private histIdx = -1;
  private typing = false;
  /** Command in flight: lock input and show busy animation (separate from title/traced lock). */
  private running = false;
  private workTimer: ReturnType<typeof setInterval> | null = null;
  private deferred: string[] = [];
  private pagerState: { lines: string[]; top: number; title: string; quitAtEnd: boolean; done: () => void } | null = null;
  locked = false;

  get paging(): boolean {
    return !!this.pagerState;
  }

  get commandBusy(): boolean {
    return this.running;
  }

  constructor(el: HTMLElement, private hooks: TermHooks) {
    this.term = new Terminal({
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 15,
      lineHeight: 1.15,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      scrollback: 2000,
      theme: {
        background: '#00000000',
        foreground: '#d6f7ff',
        cursor: '#ff2bd6',
        cursorAccent: '#05010d',
        selectionBackground: '#ff2bd655',
        black: '#05010d',
        red: '#ff3b6b',
        green: '#39ff9c',
        yellow: '#f9f002',
        blue: '#3d8bff',
        magenta: '#ff2bd6',
        cyan: '#00f0ff',
        white: '#d6f7ff',
        brightBlack: '#5c4d7a',
        brightRed: '#ff5c85',
        brightGreen: '#6dffb6',
        brightYellow: '#fff86b',
        brightBlue: '#7aaeff',
        brightMagenta: '#ff6be3',
        brightCyan: '#7af8ff',
        brightWhite: '#ffffff',
      },
    });
    this.term.loadAddon(this.fit);
    this.term.open(el);
    this.refit();
    const ro = new ResizeObserver(() => this.scheduleRefit());
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', () => this.scheduleRefit());
    this.term.onData((d) => this.onData(d));
  }

  private refitPending = 0;
  private scheduleRefit() {
    if (this.refitPending) return;
    this.refitPending = requestAnimationFrame(() => {
      this.refitPending = 0;
      this.refit();
    });
  }

  refit() {
    try {
      this.fit.fit();
    } catch {
      /* element not visible yet */
    }
  }

  focus() {
    this.term.focus();
  }

  blur() {
    this.term.blur();
  }

  private render() {
    const p = this.hooks.prompt();
    this.term.write('\r\x1b[2K' + p + this.buf);
    const back = this.buf.length - this.cursor;
    if (back > 0) this.term.write(`\x1b[${back}D`);
  }

  showPrompt() {
    this.render();
  }

  /** Prints lines above the current input line without clobbering it. */
  print(lines: string[]) {
    if (!lines.length) return;
    if (this.pagerState) {
      this.deferred.push(...lines);
      return;
    }
    this.term.write('\r\x1b[2K' + lines.join('\r\n') + '\r\n');
    if (!this.locked && !this.running) this.render();
  }

  private stopWorking() {
    if (this.workTimer) clearInterval(this.workTimer);
    this.workTimer = null;
  }

  private workingStatus(frame: string) {
    return (
      '\x1b[2m\x1b[38;5;45m' +
      frame +
      '\x1b[0m\x1b[2m neonsh: working on request' +
      '\x1b[0m\x1b[2m · · ·\x1b[0m'
    );
  }

  private async playWorking(ms: number) {
    if (ms <= 0) return;
    let frame = 0;
    const tick = () => {
      this.term.write('\r\x1b[2K' + this.workingStatus(WORK_FRAMES[frame % WORK_FRAMES.length]));
      frame++;
    };
    tick();
    this.workTimer = setInterval(tick, 95);
    await sleep(ms);
    this.stopWorking();
    this.term.write('\r\x1b[2K');
  }

  private async revealLineWordByWord(line: string, pacing: RevealPacingContext, wordsPrinted: number): Promise<number> {
    if (!stripAnsi(line).trim()) {
      this.term.write(line);
      return wordsPrinted;
    }
    const wps = wordsPerSecond(pacing);
    const delay = delayMsPerWord(wps);
    const tokens = tokenizeRevealLine(line);
    for (const tok of tokens) {
      this.term.write(tok.text);
      if (tok.kind !== 'word') continue;
      wordsPrinted++;
      if (this.hooks.onKey && wordsPrinted % 11 === 0) this.hooks.onKey();
      await sleep(delay);
    }
    return wordsPrinted;
  }

  /** Word-by-word reveal for game `print` events (narrative); empty lines are instant. */
  async revealGamePrint(lines: string[], pacing: Omit<RevealPacingContext, 'line'>) {
    if (!lines.length) return;
    if (this.pagerState) {
      this.deferred.push(...lines);
      return;
    }
    if (lines.every((l) => !stripAnsi(l).trim())) {
      this.print(lines);
      return;
    }
    this.running = true;
    try {
      let wordsPrinted = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.term.write('\r\n');
        wordsPrinted = await this.revealLineWordByWord(lines[i], { ...pacing, line: lines[i] }, wordsPrinted);
      }
      this.term.write('\r\n');
    } finally {
      this.running = false;
      if (!this.locked) this.render();
    }
  }

  /** Busy animation, then word-by-word command output. Does not touch game events. */
  async revealCommandOutput(lines: string[], plan: CommandDelayPlan, pacing: Omit<RevealPacingContext, 'line'>) {
    this.running = true;
    try {
      if (plan.instant) {
        if (lines.length) this.print(lines);
        return;
      }
      await this.playWorking(plan.delayMs);
      if (!lines.length) return;
      let wordsPrinted = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.term.write('\r\n');
        wordsPrinted = await this.revealLineWordByWord(lines[i], { ...pacing, line: lines[i] }, wordsPrinted);
      }
      this.term.write('\r\n');
    } finally {
      this.running = false;
      if (!this.locked) this.render();
    }
  }

  /**
   * less/more: draws on xterm's alternate screen (like the real pager) so quitting restores the
   * scrollback untouched. Resolves when the player quits.
   */
  page(lines: string[], title: string, quitAtEnd: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.pagerState = { lines, top: 0, title, quitAtEnd, done: resolve };
      this.term.write('\x1b[?1049h');
      this.drawPage();
    });
  }

  private pageHeight(): number {
    return Math.max(3, this.term.rows - 1);
  }

  private drawPage() {
    const p = this.pagerState;
    if (!p) return;
    const h = this.pageHeight();
    const cols = Math.max(10, this.term.cols);
    const view = p.lines.slice(p.top, p.top + h).map((l) => stripAnsi(l).slice(0, cols));
    while (view.length < h) view.push('\x1b[2m~\x1b[0m');
    const end = p.top + h >= p.lines.length;
    const pct = p.lines.length ? Math.min(100, Math.round(((p.top + h) / p.lines.length) * 100)) : 100;
    const status = end
      ? `(END) ${p.title}  ·  q quit  b back`
      : `${p.title}  lines ${p.top + 1}-${Math.min(p.lines.length, p.top + h)}/${p.lines.length} ${pct}%  ·  Space next  b back  Enter line  q quit`;
    this.term.write('\x1b[H\x1b[2J' + view.join('\r\n') + '\r\n\x1b[7m' + status.slice(0, cols) + '\x1b[0m');
  }

  private pagerKey(data: string) {
    const p = this.pagerState!;
    const h = this.pageHeight();
    const maxTop = Math.max(0, p.lines.length - h);
    const atEnd = p.top >= maxTop;
    switch (data) {
      case 'q':
      case 'Q':
      case '\x1b':
      case '\x03':
        return this.closePager();
      case ' ':
      case 'f':
      case '\x1b[6~':
        if (atEnd && p.quitAtEnd) return this.closePager();
        p.top = Math.min(maxTop, p.top + h);
        break;
      case 'b':
      case '\x1b[5~':
        p.top = Math.max(0, p.top - h);
        break;
      case '\r':
      case 'j':
      case '\x1b[B':
        if (atEnd && p.quitAtEnd) return this.closePager();
        p.top = Math.min(maxTop, p.top + 1);
        break;
      case 'k':
      case '\x1b[A':
        p.top = Math.max(0, p.top - 1);
        break;
      case 'g':
        p.top = 0;
        break;
      case 'G':
        p.top = maxTop;
        break;
      default:
        return;
    }
    this.drawPage();
  }

  private closePager() {
    const p = this.pagerState;
    if (!p) return;
    this.pagerState = null;
    this.term.write('\x1b[?1049l');
    const queued = this.deferred;
    this.deferred = [];
    if (queued.length) this.print(queued);
    p.done();
  }

  writeRaw(s: string) {
    this.term.write(s);
  }

  clear() {
    this.term.write('\x1b[2J\x1b[3J\x1b[H');
    this.term.clear();
  }

  setInput(text: string) {
    this.buf = text;
    this.cursor = text.length;
    this.render();
    this.focus();
  }

  /** Animated typing for guide chips and the demo. */
  async typeAndRun(cmd: string, cps = 28) {
    if (this.typing) return;
    this.buf = '';
    this.cursor = 0;
    this.render();
    await this.typeText(cmd, cps);
    await this.enter();
  }

  async typeText(text: string, cps = 28) {
    this.typing = true;
    for (const ch of text) {
      this.buf = this.buf.slice(0, this.cursor) + ch + this.buf.slice(this.cursor);
      this.cursor++;
      this.render();
      this.hooks.onKey?.();
      await new Promise((r) => setTimeout(r, 1000 / cps));
    }
    this.typing = false;
  }

  pressTab() {
    this.tab();
  }

  pressUp() {
    this.onData('\x1b[A');
  }

  pressEnter() {
    this.enter();
  }

  private async enter(): Promise<void> {
    const line = this.buf;
    this.term.write('\r\n');
    this.buf = '';
    this.cursor = 0;
    this.histIdx = -1;
    if (line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
    try {
      await this.hooks.submit(line);
    } finally {
      if (!this.locked && !this.running) this.render();
    }
  }

  private onData(data: string) {
    if (this.pagerState) return this.pagerKey(data);
    if (this.locked || this.typing || this.running) return;
    switch (data) {
      case '\r':
        void this.enter();
        return;
      case '\x7f':
      case '\b':
        if (this.cursor > 0) {
          this.buf = this.buf.slice(0, this.cursor - 1) + this.buf.slice(this.cursor);
          this.cursor--;
          this.render();
        }
        return;
      case '\x1b[3~':
        this.buf = this.buf.slice(0, this.cursor) + this.buf.slice(this.cursor + 1);
        this.render();
        return;
      case '\x1b[A':
        if (!this.history.length) return;
        this.histIdx = this.histIdx < 0 ? this.history.length - 1 : Math.max(0, this.histIdx - 1);
        this.setInput(this.history[this.histIdx]);
        return;
      case '\x1b[B':
        if (this.histIdx < 0) return;
        this.histIdx++;
        if (this.histIdx >= this.history.length) {
          this.histIdx = -1;
          this.setInput('');
        } else this.setInput(this.history[this.histIdx]);
        return;
      case '\x1b[D':
        if (this.cursor > 0) {
          this.cursor--;
          this.term.write(data);
        }
        return;
      case '\x1b[C':
        if (this.cursor < this.buf.length) {
          this.cursor++;
          this.term.write(data);
        }
        return;
      case '\x1b[H':
      case '\x01':
        this.cursor = 0;
        this.render();
        return;
      case '\x1b[F':
      case '\x05':
        this.cursor = this.buf.length;
        this.render();
        return;
      case '\x03':
        this.term.write('^C\r\n');
        this.buf = '';
        this.cursor = 0;
        this.render();
        return;
      case '\x0c':
        this.clear();
        this.render();
        return;
      case '\x15':
        this.buf = '';
        this.cursor = 0;
        this.render();
        return;
      case '\t':
        this.tab();
        return;
    }
    if (data.startsWith('\x1b')) return;
    const clean = data.replace(/[\r\n]+/g, ' ').replace(/[\x00-\x1f]/g, '');
    if (!clean) return;
    this.buf = this.buf.slice(0, this.cursor) + clean + this.buf.slice(this.cursor);
    this.cursor += clean.length;
    this.hooks.onKey?.();
    this.render();
  }

  private tab() {
    const before = this.buf.slice(0, this.cursor);
    const opts = this.hooks.complete(before);
    if (!opts.length) return;
    const words = before.split(/\s+/);
    const last = words[words.length - 1];
    if (opts.length === 1) {
      const add = opts[0].slice(last.length) + (opts[0].endsWith('/') ? '' : ' ');
      this.buf = before + add + this.buf.slice(this.cursor);
      this.cursor += add.length;
      this.render();
      return;
    }
    let prefix = opts[0];
    for (const o of opts) while (!o.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (prefix.length > last.length) {
      const add = prefix.slice(last.length);
      this.buf = before + add + this.buf.slice(this.cursor);
      this.cursor += add.length;
      this.render();
      return;
    }
    const width = Math.max(...opts.map((o) => stripAnsi(o).length)) + 2;
    const cols = Math.max(1, Math.floor(this.term.cols / width));
    const rows: string[] = [];
    for (let i = 0; i < opts.length; i += cols) rows.push(opts.slice(i, i + cols).map((o) => o.padEnd(width)).join(''));
    this.print(rows);
  }
}
