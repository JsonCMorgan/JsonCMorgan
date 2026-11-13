export interface PressEnterOptions {
  /** Elements that also trigger the action when clicked. */
  clickTargets?: (EventTarget | null | undefined)[];
  /** Return true to let Enter through untouched, e.g. when another button has keyboard focus. */
  ignore?: (e: Event) => boolean;
}

/**
 * Binds a one-shot "press ENTER" prompt. The key listener runs in the capture phase on the window,
 * because xterm stops propagation of keys it handles, so a bubbling listener never sees Enter while
 * the terminal's hidden textarea has focus. Enter is swallowed so it cannot also reach the terminal.
 * Returns a dispose function. The action runs at most once, whichever input arrives first.
 */
export function bindPressEnter(win: EventTarget, action: () => void, opts: PressEnterOptions = {}): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    dispose();
    action();
  };
  const onKey = (e: Event) => {
    const key = (e as KeyboardEvent).key;
    if (key !== 'Enter' && key !== 'NumpadEnter') return;
    if ((e as KeyboardEvent).repeat || opts.ignore?.(e)) return;
    e.preventDefault();
    e.stopPropagation();
    fire();
  };
  const onClick = (e: Event) => {
    e.preventDefault();
    fire();
  };
  const targets = (opts.clickTargets ?? []).filter((t): t is EventTarget => !!t);
  win.addEventListener('keydown', onKey, { capture: true });
  for (const t of targets) t.addEventListener('click', onClick);
  function dispose() {
    win.removeEventListener('keydown', onKey, { capture: true });
    for (const t of targets) t.removeEventListener('click', onClick);
  }
  return dispose;
}

/**
 * Global hotkeys, also in the capture phase so they work while the terminal has focus.
 * A handler returns true when it used the key; the key is then kept away from the terminal.
 */
export function bindHotkeys(win: EventTarget, handlers: Record<string, (e: KeyboardEvent) => boolean>): () => void {
  const onKey = (e: Event) => {
    const ke = e as KeyboardEvent;
    const h = handlers[ke.key];
    if (h && h(ke)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  win.addEventListener('keydown', onKey, { capture: true });
  return () => win.removeEventListener('keydown', onKey, { capture: true });
}
