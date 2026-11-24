<script lang="ts">
  // The picture peek (peek.ts): one layer for the whole site, in the shell. A small picture in the page (a
  // head, an item or advancement icon, 48px or less) is shown large beside itself while the mouse is on it,
  // or while keyboard focus is on the link around it. A head shows the player's full skin. It opens as a
  // dithered circle stepping at 12 fps, like the realm transition; under reduced motion, or without CSS
  // masks, it is there in one frame. Decorative: the small picture keeps its own text.
  import { afterNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import { PEEK, peekFrames, placePeek, skinFor, type Corner } from "./peek.ts";

  type Shown = { src: string; fallback: string | null; w: number; h: number; left: number; top: number };
  let shown = $state<Shown | null>(null);
  let box = $state<HTMLDivElement>();

  const FRAME = 9; // the double border and the padding, each side
  const masks = new Map<string, string[]>();
  function frameMasks(w: number, h: number, corner: Corner): string[] {
    const key = `${w}x${h}${corner}`;
    const hit = masks.get(key);
    if (hit) return hit;
    const cols = Math.ceil(w / PEEK.cell);
    const rows = Math.ceil(h / PEEK.cell);
    const c = document.createElement("canvas");
    c.width = cols * PEEK.cell;
    c.height = rows * PEEK.cell;
    const g = c.getContext("2d");
    if (!g) return [];
    const out = peekFrames(cols, rows, corner)
      .slice(0, -1)
      .map((lit) => {
        g.clearRect(0, 0, c.width, c.height);
        g.fillStyle = "#fff";
        lit.forEach((on, i) => on && g.fillRect((i % cols) * PEEK.cell, Math.floor(i / cols) * PEEK.cell, PEEK.cell, PEEK.cell));
        return `url("${c.toDataURL()}")`;
      });
    masks.set(key, out);
    return out;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let current: HTMLImageElement | null = null;

  function stop() {
    clearTimeout(timer);
    clearInterval(ticker);
    timer = ticker = undefined;
  }
  function hide() {
    stop();
    current = null;
    shown = null;
  }

  /** A small picture in the page that gets a peek, or null. The map's stage keeps its own pictures. */
  function candidate(el: EventTarget | null): HTMLImageElement | null {
    if (!(el instanceof Element)) return null;
    const img = el instanceof HTMLImageElement ? el : el.matches(".fx-face, .pic, a, button") ? el.querySelector("img") : null;
    if (!img || !img.closest(".fx-main") || img.closest(".mc-stage, .fx-stage, .rm-stage")) return null;
    const src = img.getAttribute("src");
    if (!src || !img.complete || !img.naturalWidth) return null;
    const r = img.getBoundingClientRect();
    if (!r.width || r.width > PEEK.maxSource || r.height > PEEK.maxSource) return null;
    return img;
  }

  async function show(img: HTMLImageElement) {
    stop();
    current = img;
    const src = img.getAttribute("src")!;
    const skin = skinFor(src);
    const w = 128;
    const h = skin ? 256 : 128;
    const W = w + 2 * FRAME;
    const H = h + 2 * FRAME;
    const p = placePeek(img.getBoundingClientRect(), W, H, innerWidth, innerHeight);
    shown = { src: skin ?? src, fallback: skin ? src : null, w, h, left: p.left, top: p.top };
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || !CSS.supports("mask-image", "url(a.png)");
    const frames = still ? [] : frameMasks(W, H, p.corner);
    await Promise.resolve();
    if (!box || current !== img) return;
    let i = 0;
    const step = () => {
      if (!box) return;
      const m = frames[i++];
      box.style.maskImage = m ?? "";
      box.style.webkitMaskImage = m ?? "";
      if (!m) clearInterval(ticker);
    };
    step();
    if (frames.length) ticker = setInterval(step, 1000 / PEEK.fps);
  }

  afterNavigate(() => hide());

  onMount(() => {
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const img = candidate(e.target);
      if (!img || img === current) return;
      clearTimeout(timer);
      timer = setTimeout(() => show(img), 120);
    };
    const out = (e: PointerEvent) => {
      if (!(e.target instanceof Element)) return;
      const to = e.relatedTarget instanceof Element ? candidate(e.relatedTarget) : null;
      if (to && to === (current ?? candidate(e.target))) return;
      if (current || timer) hide();
    };
    const focus = (e: FocusEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.matches(":focus-visible")) return;
      const img = candidate(t);
      if (img) show(img);
      else if (current) hide();
    };
    const blur = () => current && hide();
    const key = (e: KeyboardEvent) => e.key === "Escape" && current && hide();
    const gone = () => (current || timer) && hide();
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("keydown", key);
    addEventListener("scroll", gone, { capture: true, passive: true });
    addEventListener("resize", gone);
    return () => {
      hide();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("keydown", key);
      removeEventListener("scroll", gone, { capture: true });
      removeEventListener("resize", gone);
    };
  });
</script>

{#if shown}
  <div class="fx-peek" bind:this={box} aria-hidden="true" style:left="{shown.left}px" style:top="{shown.top}px">
    <img
      src={shown.src}
      alt=""
      width={shown.w}
      height={shown.h}
      onerror={() => {
        if (shown?.fallback) shown = { ...shown, src: shown.fallback, fallback: null, h: 128 };
      }}
    />
  </div>
{/if}
