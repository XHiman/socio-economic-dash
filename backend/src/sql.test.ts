import { describe, expect, it } from 'vitest';
import { quoteIdent, quoteList } from './sql.js';

describe('quoteIdent', () => {
  it('quotes valid identifiers', () => {
    expect(quoteIdent('dsa_11a')).toBe('`dsa_11a`');
    expect(quoteList(['a', 'b_c'])).toBe('`a`, `b_c`');
  });
  it.each(['', 'a`b', 'a b', 'a;DROP TABLE x', '1abc', 'a-b', 'a\'b', 'x'.repeat(65)])('rejects %j', (bad) => {
    expect(() => quoteIdent(bad)).toThrow();
  });
});
