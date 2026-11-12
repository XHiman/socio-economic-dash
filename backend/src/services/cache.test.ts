import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from './cache.js';

describe('TtlCache', () => {
  it('shares one in-flight load between concurrent callers', async () => {
    const cache = new TtlCache<number>(1000, 10);
    const load = vi.fn(async () => 42);
    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect([a, b]).toEqual([42, 42]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache<number>(1000, 10);
    await expect(cache.get('k', async () => { throw new Error('db down'); })).rejects.toThrow('db down');
    await new Promise((r) => setTimeout(r, 0));
    await expect(cache.get('k', async () => 7)).resolves.toBe(7);
  });

  it('expires entries and bounds its size', async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<number>(100, 2);
    const load = vi.fn(async () => 1);
    await cache.get('a', load);
    vi.advanceTimersByTime(150);
    await cache.get('a', load);
    expect(load).toHaveBeenCalledTimes(2);
    await cache.get('b', load); await cache.get('c', load); await cache.get('d', load);
    await cache.get('b', load); // evicted by the size bound, so it loads again
    expect(load.mock.calls.length).toBeGreaterThan(4);
    vi.useRealTimers();
  });
});
