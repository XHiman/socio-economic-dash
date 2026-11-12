/**
 * Small in-memory TTL cache with request coalescing. The API is public and read-only, and the state-level card
 * aggregates cost dozens of queries each, so identical requests share one computation instead of each one hitting
 * the database. Failures are never cached. Keys must come from a bounded set (validated ids/slugs), never raw input.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { at: number; value: Promise<V> }>();

  constructor(private readonly ttlMs: number, private readonly maxEntries: number) {}

  get(key: string, load: () => Promise<V>): Promise<V> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && now - hit.at < this.ttlMs) return hit.value;

    const value = load();
    this.entries.set(key, { at: now, value });
    value.catch(() => { if (this.entries.get(key)?.value === value) this.entries.delete(key); });
    this.evict(now);
    return value;
  }

  private evict(now: number): void {
    if (this.entries.size <= this.maxEntries) return;
    for (const [k, e] of this.entries) if (now - e.at >= this.ttlMs) this.entries.delete(k);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string); // oldest first
  }
}
