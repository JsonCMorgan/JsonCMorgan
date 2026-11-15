import { describe, expect, it } from 'vitest';
import { bindHotkeys, bindPressEnter } from '../src/ui/prompt';

function key(k: string, repeat = false) {
  const e = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperties(e, { key: { value: k }, repeat: { value: repeat } });
  return e;
}

/** A window with a child (standing in for xterm's textarea) that swallows keys the way xterm does. */
function fakeDom() {
  const win = new EventTarget();
  const textarea = new EventTarget();
  let terminalSawEnter = 0;
  textarea.addEventListener('keydown', (e) => {
    terminalSawEnter++;
    e.stopPropagation();
  });
  const press = (e: Event) => {
    // capture at the window, then the target, then bubble back (which xterm blocks)
    win.dispatchEvent(Object.assign(e, {}));
    if (!(e as Event & { cancelBubble: boolean }).cancelBubble) textarea.dispatchEvent(e);
  };
  return { win, press, terminalSawEnter: () => terminalSawEnter };
}

describe('press ENTER prompts', () => {
  it('fires on Enter even when the terminal would swallow the key, and the terminal never sees it', () => {
    const { win, press, terminalSawEnter } = fakeDom();
    let fired = 0;
    bindPressEnter(win, () => fired++);
    const e = key('Enter');
    press(e);
    expect(fired).toBe(1);
    expect(e.defaultPrevented).toBe(true);
    expect(terminalSawEnter()).toBe(0);
  });

  it('registers in the capture phase so it runs before focused elements', () => {
    const calls: [string, unknown][] = [];
    const win = { addEventListener: (t: string, _f: unknown, o: unknown) => calls.push([t, o]), removeEventListener() {} };
    bindPressEnter(win as unknown as EventTarget, () => {});
    expect(calls).toEqual([['keydown', { capture: true }]]);
  });

  it('a click on the button works too, and the action runs only once', () => {
    const win = new EventTarget();
    const btn = new EventTarget();
    let fired = 0;
    bindPressEnter(win, () => fired++, { clickTargets: [btn, null] });
    btn.dispatchEvent(new Event('click', { cancelable: true }));
    win.dispatchEvent(key('Enter'));
    btn.dispatchEvent(new Event('click', { cancelable: true }));
    expect(fired).toBe(1);
  });

  it('ignores other keys, key repeat, NumpadEnter counts, and ignore() lets Enter through', () => {
    const win = new EventTarget();
    let fired = 0;
    let otherButtonFocused = true;
    bindPressEnter(win, () => fired++, { ignore: () => otherButtonFocused });
    win.dispatchEvent(key('Enter'));
    expect(fired).toBe(0);
    otherButtonFocused = false;
    win.dispatchEvent(key('a'));
    win.dispatchEvent(key('Enter', true));
    expect(fired).toBe(0);
    win.dispatchEvent(key('NumpadEnter'));
    expect(fired).toBe(1);
  });

  it('a stray click on the overlay, or on the press ENTER hint, never fires the action', () => {
    const win = new EventTarget();
    const btn = new EventTarget();
    const overlay = new EventTarget();
    const hint = new EventTarget();
    let fired = 0;
    bindPressEnter(win, () => fired++, { clickTargets: [btn] });
    overlay.dispatchEvent(new Event('click'));
    hint.dispatchEvent(new Event('click'));
    win.dispatchEvent(new Event('click'));
    expect(fired).toBe(0);
    btn.dispatchEvent(new Event('click', { cancelable: true }));
    expect(fired).toBe(1);
  });

  it('dispose removes the listeners', () => {
    const win = new EventTarget();
    let fired = 0;
    const dispose = bindPressEnter(win, () => fired++);
    dispose();
    win.dispatchEvent(key('Enter'));
    expect(fired).toBe(0);
  });
});

describe('global hotkeys', () => {
  it('Escape closes a modal even while the terminal would swallow the key, and is left alone otherwise', () => {
    const win = new EventTarget();
    let modalOpen = true;
    let closed = 0;
    bindHotkeys(win, { Escape: () => (modalOpen ? (closed++, (modalOpen = false), true) : false) });
    const first = key('Escape');
    win.dispatchEvent(first);
    expect(closed).toBe(1);
    expect(first.defaultPrevented).toBe(true);
    const second = key('Escape');
    win.dispatchEvent(second);
    expect(closed).toBe(1);
    expect(second.defaultPrevented).toBe(false);
  });
});
