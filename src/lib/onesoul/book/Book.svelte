<script lang="ts">
  // A journal drawn as the game's book screen (WEBSITE-BRIEF §5): the bundled book texture and bitmap font
  // at a whole-number scale (chosen by container queries, so it works before any script runs), one API page
  // per book page, wrapped with the game's font metrics. The glyphs are real DOM text (transparent over the
  // bitmap), so a page can be selected and copied. Player text is only ever text.
  import { page } from "$app/state";
  import { replaceState } from "$app/navigation";
  import { BOOK, SHEETS, indicator, layoutPage, type Line, type Uni } from "./layout.ts";
  import { withParams } from "#lib/url.ts";

  let { pages, label, uni }: { pages: string[]; label: string; uni?: Uni } = $props();

  const total = $derived(Math.max(1, pages.length));
  const fromUrl = () => {
    const n = Number(page.url.searchParams.get("page"));
    return Number.isInteger(n) && n >= 1 ? n - 1 : 0;
  };
  let index = $state(fromUrl());
  const at = $derived(Math.min(index, total - 1));
  const lines = $derived(layoutPage(pages[at] ?? "", BOOK.text.width, uni));
  const shown = $derived(lines.slice(0, BOOK.text.lines));
  const extra = $derived(lines.slice(BOOK.text.lines));
  let more = $state(false);
  const ind = $derived(indicator(at + 1, total));
  const href = (i: number) => withParams(page.url, { page: i === 0 ? null : String(i + 1) });

  function go(i: number, e?: Event) {
    if (i < 0 || i >= total || i === at) return;
    e?.preventDefault();
    index = i;
    more = false;
    try {
      replaceState(href(i), {});
    } catch {
      /* before the router starts: the link's own navigation is fine */
    }
  }

  function key(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const inBook = !!t?.closest?.(".mcb");
    if (e.key === "ArrowLeft" || (inBook && e.key === "PageUp")) go(at - 1, e);
    else if (e.key === "ArrowRight" || (inBook && e.key === "PageDown")) go(at + 1, e);
  }

  let touch: { x: number; y: number } | null = null;
  const down = (e: PointerEvent) => (touch = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY });
  function up(e: PointerEvent) {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? at + 1 : at - 1);
  }

  /** inline style for one glyph: its advance and, for bitmap glyphs, its cell in the sheet */
  function gs(g: Line["glyphs"][number]): string {
    if (g.u) return `--a:${g.adv};--ux:${g.u.sx};--uy:${g.u.sy};--uw:${g.u.w};--ui:url(/mc/unifont/${g.u.page}.png)`;
    if (!g.g) return `--a:${g.adv}`;
    const s = SHEETS[g.g.sheet];
    return `--a:${g.adv};--sx:${g.g.sx};--sy:${g.g.sy};--t:${g.g.top};--cw:${s.cw};--ch:${s.ch};--bw:${s.w};--bh:${s.h}`;
  }
  const kind = (g: Line["glyphs"][number]) => (g.g ? `g f${g.g.sheet}` : g.u ? "g uf" : g.ch === " " || g.adv === 0 ? "g sp" : "g u");
</script>

<svelte:window onkeydown={key} />

<div class="mcb-wrap">
  <div
    class="mcb"
    role="group"
    aria-roledescription="book"
    aria-label="{label}, page {at + 1} of {total}"
    tabindex="-1"
    onpointerdown={down}
    onpointerup={up}
    style="--f0:url({SHEETS[0]?.file});--f1:url({SHEETS[1]?.file});--f2:url({SHEETS[2]?.file})"
  >
    <div class="mcb-ind" aria-hidden="true" style="--x:{BOOK.indicator.right - BOOK.crop.x - ind.width};--y:{BOOK.indicator.y - BOOK.crop.y}">{#each ind.glyphs as g, i (i)}<span class={kind(g)} style={gs(g)}>{g.ch}</span>{/each}</div>
    <p class="visually-hidden">{pages[at] ?? ""}</p>
    <div class="mcb-text" aria-hidden="true">
      {#each shown as l, li (li)}
        <div class="mcb-line" style="--y:{BOOK.text.y - BOOK.crop.y + li * BOOK.text.line}">{#each l.glyphs as g, i (i)}<span class={kind(g)} style={gs(g)}>{g.ch}</span>{/each}{li < shown.length - 1 ? "\n" : ""}</div>
      {/each}
    </div>
    {#if at > 0}
      <a class="mcb-arrow mcb-arrow--back" href={href(at - 1)} onclick={(e) => go(at - 1, e)} aria-label="Previous page" style="--x:{BOOK.back.x - BOOK.crop.x};--y:{BOOK.back.y - BOOK.crop.y}"></a>
    {/if}
    {#if at < total - 1}
      <a class="mcb-arrow mcb-arrow--fwd" href={href(at + 1)} onclick={(e) => go(at + 1, e)} aria-label="Next page" style="--x:{BOOK.forward.x - BOOK.crop.x};--y:{BOOK.forward.y - BOOK.crop.y}"></a>
    {/if}
  </div>
  {#if extra.length}
    <div class="mcb-more">
      <button type="button" class="fp-btn" aria-expanded={more} onclick={() => (more = !more)}>
        {more ? "Hide" : "Show"} {extra.length} more line{extra.length === 1 ? "" : "s"} on this page
      </button>
      {#if more}
        <p class="mcb-more__text t-small">{extra.map((l) => l.glyphs.map((g) => g.ch).join("")).join("\n")}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mcb-wrap {
    container-type: inline-size;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  /* the largest whole-number scale that fits the column; the book is 146 x 180 units */
  .mcb {
    --s: 1px;
    position: relative;
    width: calc(146 * var(--s));
    height: calc(180 * var(--s));
    background: url("/mc/book.png") calc(-20 * var(--s)) calc(-1 * var(--s)) / calc(256 * var(--s)) calc(256 * var(--s)) no-repeat;
    image-rendering: pixelated;
    touch-action: pan-y;
    outline: none;
    user-select: text;
  }
  @container (min-width: 292px) {
    .mcb {
      --s: 2px;
    }
  }
  /* and that fits the window's height too (180 units plus some room) */
  @container (min-width: 438px) {
    @media (min-height: 620px) {
      .mcb {
        --s: 3px;
      }
    }
  }
  @container (min-width: 584px) {
    @media (min-height: 800px) {
      .mcb {
        --s: 4px;
      }
    }
  }
  .mcb:focus-visible {
    box-shadow: var(--focus-ring);
  }
  .mcb-ind,
  .mcb-line {
    position: absolute;
    top: calc(var(--y) * var(--s));
    height: calc(9 * var(--s));
    display: block;
    white-space: pre;
    font-size: 0;
    line-height: 0;
  }
  .mcb-ind {
    left: calc(var(--x) * var(--s));
  }
  .mcb-line {
    left: calc(16 * var(--s));
  }
  .g {
    position: relative;
    display: inline-block;
    vertical-align: top;
    width: calc(var(--a) * var(--s));
    height: calc(9 * var(--s));
    font: 400 calc(8 * var(--s)) / calc(9 * var(--s)) var(--font-text);
    color: transparent;
    overflow: visible;
  }
  .g::selection {
    background: rgba(48, 96, 200, 0.35);
    color: transparent;
  }
  .g:not(.sp):not(.u):not(.uf)::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc(var(--t) * var(--s));
    width: calc(var(--cw) * var(--s));
    height: calc(var(--ch) * var(--s));
    background-size: calc(var(--bw) * var(--s)) calc(var(--bh) * var(--s));
    background-position: calc(var(--sx) * -1 * var(--s)) calc(var(--sy) * -1 * var(--s));
    background-repeat: no-repeat;
    image-rendering: pixelated;
    pointer-events: none;
  }
  .f0::before {
    background-image: var(--f0);
  }
  .f1::before {
    background-image: var(--f1);
  }
  .f2::before {
    background-image: var(--f2);
  }
  /* a character the bitmap fonts lack, from its Unifont page: 16 px cells drawn at half size, from the ink's left */
  .uf::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: calc(var(--uw) * var(--s) / 2);
    height: calc(8 * var(--s));
    background: var(--ui) no-repeat calc(var(--ux) * var(--s) / -2) calc(var(--uy) * var(--s) / -2) / calc(128 * var(--s)) calc(128 * var(--s));
    image-rendering: pixelated;
    pointer-events: none;
  }
  /* a character no font here has (Unifont metrics missing): a system font stands in */
  .u {
    color: #000;
    font-family: var(--font-text), system-ui, sans-serif;
    font-size: calc(8 * var(--s));
    white-space: pre;
  }
  .mcb-arrow {
    position: absolute;
    left: calc(var(--x) * var(--s));
    top: calc(var(--y) * var(--s));
    width: calc(23 * var(--s));
    height: calc(13 * var(--s));
    background: no-repeat 0 0 / 100% 100%;
    image-rendering: pixelated;
  }
  .mcb-arrow--back {
    background-image: url("/mc/page_backward.png");
  }
  .mcb-arrow--back:hover,
  .mcb-arrow--back:focus-visible {
    background-image: url("/mc/page_backward_highlighted.png");
  }
  .mcb-arrow--fwd {
    background-image: url("/mc/page_forward.png");
  }
  .mcb-arrow--fwd:hover,
  .mcb-arrow--fwd:focus-visible {
    background-image: url("/mc/page_forward_highlighted.png");
  }
  .mcb-arrow:focus-visible {
    outline: 2px solid var(--acc-ink);
    outline-offset: 2px;
  }
  .mcb-more {
    max-width: 60ch;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .mcb-more__text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
