import { describe, expect, it } from 'vitest';
import { parseLine, parseOpts, ParseError } from '../src/engine/parser';

describe('parseLine', () => {
  it('splits a simple command', () => {
    expect(parseLine('nmap -sV 10.0.0.1')).toEqual([{ name: 'nmap', args: ['-sV', '10.0.0.1'] }]);
  });

  it('returns an empty pipeline for blank input', () => {
    expect(parseLine('   ')).toEqual([]);
  });

  it('handles quotes and escapes', () => {
    expect(parseLine(`grep "Failed password" 'auth log' a\\ b`)).toEqual([
      { name: 'grep', args: ['Failed password', 'auth log', 'a b'] },
    ]);
  });

  it('keeps empty quoted strings as arguments', () => {
    expect(parseLine('echo ""')).toEqual([{ name: 'echo', args: [''] }]);
  });

  it('splits pipes, including without spaces', () => {
    expect(parseLine('cat auth.log|grep Failed | wc -l')).toEqual([
      { name: 'cat', args: ['auth.log'] },
      { name: 'grep', args: ['Failed'] },
      { name: 'wc', args: ['-l'] },
    ]);
  });

  it('does not split pipes inside quotes', () => {
    expect(parseLine('grep "a|b" f')).toEqual([{ name: 'grep', args: ['a|b', 'f'] }]);
  });

  it('rejects unterminated quotes and dangling pipes', () => {
    expect(() => parseLine('echo "oops')).toThrow(ParseError);
    expect(() => parseLine('ls |')).toThrow(ParseError);
    expect(() => parseLine('| grep x')).toThrow(ParseError);
  });
});

describe('parseOpts', () => {
  it('keeps nmap-style multi-letter flags intact', () => {
    const o = parseOpts(['-sV', '-T4', '10.0.0.5']);
    expect([...o.flags]).toEqual(['-sV', '-T4']);
    expect(o.positional).toEqual(['10.0.0.5']);
  });

  it('reads value flags in both forms', () => {
    expect(parseOpts(['-w', 'rockyou.txt', 'host'], { withValue: ['-w'] }).values['-w']).toBe('rockyou.txt');
    expect(parseOpts(['-wrockyou.txt', 'host'], { withValue: ['-w'] }).values['-w']).toBe('rockyou.txt');
    expect(parseOpts(['host', '--src', '10.0.0.2'], { withValue: ['--src'] }).values['--src']).toBe('10.0.0.2');
  });

  it('errors when a value flag has no value', () => {
    expect(() => parseOpts(['-w'], { withValue: ['-w'] })).toThrow(ParseError);
  });

  it('treats everything after -- as positional', () => {
    expect(parseOpts(['--', '-v']).positional).toEqual(['-v']);
  });
});
