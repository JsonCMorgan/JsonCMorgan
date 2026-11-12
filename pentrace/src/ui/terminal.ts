import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { stripAnsi } from '../engine/ansi';

export interface TermHooks {
  prompt(): string;
  submit(line: string): void;
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
  locked = false;

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
    this.term.write('\r\x1b[2K' + lines.join('\r\n') + '\r\n');
    if (!this.locked) this.render();
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
    this.enter();
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

  private enter() {
    const line = this.buf;
    this.term.write('\r\n');
    this.buf = '';
    this.cursor = 0;
    this.histIdx = -1;
    if (line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
    this.hooks.submit(line);
    if (!this.locked) this.render();
  }

  private onData(data: string) {
    if (this.locked || this.typing) return;
    switch (data) {
      case '\r':
        this.enter();
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
