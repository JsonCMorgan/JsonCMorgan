export type ToastKind = 'info' | 'index' | 'money' | 'warn' | 'danger' | 'success';
export type Fx = 'glitch' | 'shake' | 'granted' | 'paid' | 'portopen' | 'firewall';
export type Sound = 'blip' | 'success' | 'alarm' | 'cash' | 'error' | 'unlock' | 'granted';

export type GameEvent =
  | { type: 'toast'; kind: ToastKind; title: string; body?: string }
  | { type: 'fx'; fx: Fx }
  | { type: 'sound'; sound: Sound }
  | { type: 'open'; panel: 'index' | 'shop' | 'jobs' | 'mail'; arg?: string }
  | { type: 'print'; lines: string[] }
  | { type: 'clear' }
  | { type: 'traced' }
  | { type: 'newRun' };
