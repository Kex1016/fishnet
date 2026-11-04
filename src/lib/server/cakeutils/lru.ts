// A size-bounded LRU over a Map (insertion order = recency). Sizes are rough byte counts (JSON text
// length, PNG length) so a few big boards cannot push the process past its budget.

export class Lru<V> {
  private map = new Map<string, { v: V; size: number }>();
  private bytes = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes: number
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  /** Read without touching recency. */
  peek(key: string): V | undefined {
    return this.map.get(key)?.v;
  }

  set(key: string, v: V, size: number): void {
    const old = this.map.get(key);
    if (old) {
      this.bytes -= old.size;
      this.map.delete(key);
    }
    this.map.set(key, { v, size });
    this.bytes += size;
    while (this.map.size > this.maxEntries || (this.bytes > this.maxBytes && this.map.size > 1)) {
      const oldest = this.map.keys().next().value as string;
      this.delete(oldest);
    }
  }

  delete(key: string): void {
    const e = this.map.get(key);
    if (!e) return;
    this.bytes -= e.size;
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  get byteSize(): number {
    return this.bytes;
  }
}
