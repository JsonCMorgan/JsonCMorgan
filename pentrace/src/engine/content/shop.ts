import type { FixerId } from '../progression';

export interface ShopItem {
  id: string;
  name: string;
  kind: 'tool' | 'rig' | 'intel' | 'mod';
  price: number;
  blurb: string;
  effect: string;
  /** Minimum Operator Rank (optional). */
  minRank?: number;
  /** Standing gate: fixer + level (optional; OR with minRank in buy()). */
  standingGate?: { fixer: FixerId; level: number };
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'ftploot',
    name: 'ftploot',
    kind: 'tool',
    price: 300,
    blurb: 'Anonymous FTP login and cleartext sniffing. Opens port 21.',
    effect: 'New breach tool: quiet, cheap on RAM (120 MB).',
    standingGate: { fixer: 'relay', level: 2 },
    minRank: 4,
  },
  {
    id: 'ram-512',
    name: 'RAM Upgrade +512 MB',
    kind: 'rig',
    price: 400,
    blurb: 'Black-market DIMMs. Run more crackers at once.',
    effect: 'Rig RAM 512 MB → 1024 MB.',
    minRank: 2,
  },
  {
    id: 'wordlist-plus',
    name: 'rockyou-plus.txt',
    kind: 'intel',
    price: 250,
    blurb: 'A curated wordlist built from fresh leaks.',
    effect: 'sshbrute runs 2x faster (used by default once owned).',
  },
  {
    id: 'mod-quiet',
    name: 'sshbrute // QUIET mod',
    kind: 'mod',
    price: 350,
    blurb: 'Jittered timing and spread source ports to slip under thresholds.',
    effect: 'sshbrute generates 50% less heat.',
    minRank: 3,
  },
];

export const SHOP_BY_ID = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));
