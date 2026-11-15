// The map's tile layer in the browser (FM-3; brief §4.2). Tiles come from the site's own route only.
//
// Three kinds of world:
//   - with a change log (`epoch` set): every URL carries `?v=<epoch>.<seq>` and is immutable in the browser; a
//     `tiles` event names the tiles that changed, the layer loads each new picture off screen and swaps it in;
//   - without one (every squaremap up to 1.4.3): no `?v=`; once a minute the layer revalidates the tiles in view
//     (a conditional request, 304 when nothing changed) and swaps the ones whose ETag moved;
//   - frozen (a finished One Soul round): loaded once, never asked again.
// A tile that is not rendered (404) stays empty and is asked again five minutes later at the earliest.
import type * as Leaflet from "leaflet";
import { tileVersion } from "./links.ts";
import type { MapWorldView, TileSource, TilesEvent } from "./types.ts";

export const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

/** Which version of each tile to ask for. Pure: the layer and the tests share it. */
export class TileBook {
  private template: string;
  private epoch: string | null;
  /** key → the `v` of that tile (`<epoch>.<seq>`); a tile not listed is `<epoch>.0` */
  private vers = new Map<string, string>();
  /** key → a cache-busting token for a world without a log (the changed ETag's hash) */
  private bust = new Map<string, string>();
  readonly frozen: boolean;

  constructor(src: TileSource) {
    this.template = src.template;
    this.epoch = src.epoch;
    this.frozen = src.frozen;
    if (src.epoch !== null) for (const [k, seq] of Object.entries(src.versions)) this.vers.set(k, tileVersion(src.epoch, seq));
  }

  get versioned(): boolean {
    return this.epoch !== null;
  }

  /** The tile's URL without any query: what a revalidation asks for. */
  plain(z: number, x: number, y: number): string {
    return this.template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  }

  url(z: number, x: number, y: number): string {
    const p = this.plain(z, x, y);
    const k = tileKey(z, x, y);
    if (this.epoch !== null) return `${p}?v=${encodeURIComponent(this.vers.get(k) ?? tileVersion(this.epoch, 0))}`;
    const r = this.bust.get(k);
    return r ? `${p}?r=${r}` : p;
  }

  /**
   * A `tiles` event: the keys whose URL changed, or "reset" when every tile must be asked again (a new epoch, or
   * the event says so). Events of a world without a log, and rows that are not four fields, are ignored.
   */
  apply(ev: Pick<TilesEvent, "epoch" | "tiles" | "reset">): string[] | "reset" {
    if (this.frozen) return [];
    const fresh = ev.epoch !== this.epoch;
    if (fresh || ev.reset) {
      this.epoch = ev.epoch;
      this.vers.clear();
      this.bust.clear();
    }
    const changed: string[] = [];
    for (const row of ev.tiles ?? []) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const [ver, z, x, y] = row;
      if (typeof ver !== "string" || ![z, x, y].every(Number.isInteger)) continue;
      const k = tileKey(z, x, y);
      if (this.vers.get(k) === ver) continue;
      this.vers.set(k, ver);
      changed.push(k);
    }
    return fresh || ev.reset ? "reset" : changed;
  }

  /** A world without a log: the tile's content changed (its ETag moved); later URLs carry the token. */
  setBust(key: string, etag: string): void {
    this.bust.set(key, token(etag));
  }
}

/** A short URL-safe token of an ETag (FNV-1a). */
export function token(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

type Fetch = (url: string, init: { cache: RequestCache }) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; body?: { cancel(): Promise<void> } | null }>;

/**
 * Revalidation for a world without a change log. `seen` remembers the ETag a tile was drawn with (read from the
 * browser's cache, no request); `check` asks the site again with a conditional request and says whether the tile
 * is now different, gone or new. Without an ETag from the site nothing is ever swapped.
 */
export class Revalidator {
  private etags = new Map<string, string>();
  constructor(private fetchFn: Fetch) {}

  async seen(key: string, url: string): Promise<void> {
    if (this.etags.has(key)) return;
    const tag = await this.ask(url, "force-cache");
    if (tag.etag && !this.etags.has(key)) this.etags.set(key, tag.etag);
  }

  /** The new ETag when the tile changed since it was drawn, else null. */
  async check(key: string, url: string): Promise<string | null> {
    const tag = await this.ask(url, "no-cache");
    if (!tag.etag) return null;
    const before = this.etags.get(key);
    this.etags.set(key, tag.etag);
    return before !== undefined && before !== tag.etag ? tag.etag : null;
  }

  /** A tile that was missing: true when the site has it now. */
  async appeared(key: string, url: string): Promise<boolean> {
    const tag = await this.ask(url, "no-cache");
    if (tag.etag) this.etags.set(key, tag.etag);
    return tag.ok;
  }

  forget(): void {
    this.etags.clear();
  }

  private async ask(url: string, cache: RequestCache): Promise<{ ok: boolean; etag: string | null }> {
    try {
      const res = await this.fetchFn(url, { cache });
      void res.body?.cancel().catch(() => {});
      return { ok: res.ok, etag: res.ok ? res.headers.get("etag") : null };
    } catch {
      return { ok: false, etag: null };
    }
  }
}

export const REVALIDATE_MS = 60_000;
export const MISSING_RETRY_MS = 300_000;

type Tile = { el: HTMLImageElement; coords: { x: number; y: number; z: number }; current: boolean };
type Inner = Leaflet.TileLayer & { _tiles: Record<string, Tile> };

export type MapTiles = {
  layer: Leaflet.TileLayer;
  /** a `tiles` event from the live stream */
  apply(ev: TilesEvent): void;
  /** revalidate the tiles in view now (a world without a log); the timer calls it once a minute */
  revalidate(): Promise<void>;
  /** tiles in view that hold a picture, and tiles in view at all */
  coverage(): { drawn: number; total: number };
  destroy(): void;
};

/** The tile layer of one world. `onchange` runs whenever a tile's picture arrives, fails or is swapped. */
export function createTiles(L: typeof Leaflet, world: MapWorldView, onchange: () => void): MapTiles {
  const book = new TileBook(world.tiles);
  const reval = new Revalidator((url, init) => fetch(url, { ...init, credentials: "same-origin" }));
  const missing = new Map<string, number>(); // key → when it was last asked
  let dead = false;

  const Layer = L.TileLayer.extend({
    getTileUrl(c: { x: number; y: number; z: number }) {
      return book.url(c.z, c.x, c.y);
    }
  }) as unknown as new (url: string, opts: Leaflet.TileLayerOptions) => Inner;

  const layer = new Layer(world.tiles.template, {
    tileSize: 512,
    minZoom: world.zoom.min,
    maxZoom: world.zoom.max + Math.max(0, world.zoom.extra),
    minNativeZoom: world.zoom.min,
    maxNativeZoom: world.zoom.max,
    noWrap: true,
    keepBuffer: 1,
    updateWhenZooming: false,
    className: "mc-tiles"
  });

  const keyOf = (c: { x: number; y: number; z: number }) => tileKey(c.z, c.x, c.y);
  const tiles = (): Tile[] => Object.values(layer._tiles ?? {}).filter((t) => t.current);

  layer.on("tileload", (e: Leaflet.TileEvent) => {
    const k = keyOf(e.coords);
    missing.delete(k);
    e.tile.classList.remove("mc-tile--missing");
    if (!book.versioned && !book.frozen) void reval.seen(k, book.plain(e.coords.z, e.coords.x, e.coords.y));
    onchange();
  });
  layer.on("tileerror", (e: Leaflet.TileErrorEvent) => {
    if (!missing.has(keyOf(e.coords))) missing.set(keyOf(e.coords), Date.now());
    e.tile.classList.add("mc-tile--missing");
    onchange();
  });
  layer.on("load", onchange);

  /** Load the tile's current URL off screen, then swap it in: no blank frame. */
  function swap(t: Tile): void {
    const url = book.url(t.coords.z, t.coords.x, t.coords.y);
    if (t.el.getAttribute("src") === url) return;
    const pre = new Image();
    pre.onload = () => {
      if (dead || !t.el.isConnected) return;
      t.el.src = url;
    };
    pre.onerror = () => {};
    pre.src = url;
  }

  function apply(ev: TilesEvent): void {
    if (dead || ev.world !== world.id) return;
    const changed = book.apply(ev);
    if (changed === "reset") {
      reval.forget();
      for (const t of tiles()) swap(t);
      return;
    }
    if (!changed.length) return;
    const set = new Set(changed);
    for (const t of tiles()) if (set.has(keyOf(t.coords))) swap(t);
  }

  let running = false;
  async function revalidate(): Promise<void> {
    if (dead || running || book.versioned || book.frozen) return;
    running = true;
    try {
      const now = Date.now();
      await Promise.all(
        tiles().map(async (t) => {
          const k = keyOf(t.coords);
          const plain = book.plain(t.coords.z, t.coords.x, t.coords.y);
          const since = missing.get(k);
          if (since !== undefined) {
            if (now - since < MISSING_RETRY_MS) return;
            missing.set(k, now);
            if (await reval.appeared(k, plain)) {
              book.setBust(k, String(now));
              swap(t);
            }
            return;
          }
          const etag = await reval.check(k, plain);
          if (etag && !dead) {
            book.setBust(k, etag);
            swap(t);
          }
        })
      );
    } finally {
      running = false;
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let last = Date.now();
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    last = Date.now();
    void revalidate();
  };
  const onVisible = () => {
    if (!document.hidden && Date.now() - last >= REVALIDATE_MS) tick();
  };
  if (!book.versioned && !book.frozen) {
    timer = setInterval(tick, REVALIDATE_MS);
    document.addEventListener("visibilitychange", onVisible);
  }

  function coverage(): { drawn: number; total: number } {
    const all = tiles();
    return { drawn: all.filter((t) => t.el.complete && t.el.naturalWidth > 0).length, total: all.length };
  }

  return {
    layer,
    apply,
    revalidate,
    coverage,
    destroy() {
      dead = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      layer.off();
      layer.remove();
    }
  };
}
