import { describe, expect, it } from 'vitest';
import { CONTRACTS } from '../src/engine/content/contracts';
import { defaultRegistry } from '../src/engine/tools';
import { Game } from '../src/engine/game';
import type { World } from '../src/engine/network';
import { effectiveHintLevel } from '../src/engine/storage';

/** Launchers in the tool registry (fwrules/fwbypass are always-on shell commands). */
const REGISTRY_TOOLS = ['nmap', 'sshbrute', 'webscan', 'getroot', 'ftploot'];

const stubWorld = {
  org: 'NorthPeak',
  gatewayIp: '10.20.0.1',
  financeIp: '10.20.0.5',
  socIp: '10.20.0.9',
  attackerIp: '203.0.113.50',
} as World;

describe('contract accessibility gates', () => {
  it('chains Relay set 0 in order c1 → c2 → c3', () => {
    expect(CONTRACTS.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(CONTRACTS.every((c) => c.fixerId === 'relay' && c.setId === 0)).toBe(true);
  });

  it('starter registry covers verbs named in contract mail', () => {
    const reg = defaultRegistry();
    for (const def of CONTRACTS) {
      const body = def.mail(stubWorld).body.join(' ');
      for (const verb of REGISTRY_TOOLS) {
        if (body.includes(verb)) {
          expect(reg.get(verb), `${def.id} mentions ${verb}`).toBeDefined();
        }
      }
    }
  });

  it('does not require shop-only ftploot on the first Relay set', () => {
    for (const def of CONTRACTS) {
      const body = def.mail(stubWorld).body.join(' ').toLowerCase();
      expect(body.includes('ftploot'), def.id).toBe(false);
    }
  });

  it('reload with tutorialDone false forces training instead of live scope', () => {
    const g = new Game(null, 42);
    expect(g.inTutorial).toBe(true);
    const save = g.serialize();
    save.profile.tutorialDone = false;
    delete save.run.tutorial;
    const g2 = new Game(save, 42);
    expect(g2.inTutorial).toBe(true);
    expect(g2.routeFromTitle()).toBe('training');
  });

  it('default hint policy nudges beginners until Operator Rank 5', () => {
    expect(effectiveHintLevel('auto', 1)).toBe('nudge');
    expect(effectiveHintLevel('auto', 4)).toBe('nudge');
    expect(effectiveHintLevel('auto', 5)).toBe('off');
  });
});
