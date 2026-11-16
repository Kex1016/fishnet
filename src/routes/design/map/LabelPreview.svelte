<script lang="ts">
  // The area-title preview (FMK-1, brief §5.3): titles in the Minecraft font on terrain-like grounds, each inside
  // an area drawn the way the map will (fill at 22 %, outline at 90 %), at k 1..4. The canvases are what
  // scripts/mc-label-check.ts reads pixel by pixel. Made-up titles and colours; dev and mock only like the page.
  import type { Uni } from "#lib/onesoul/book/layout.ts";
  import { labelLines, renderLabel, type Scale } from "#lib/map/markers/McLabel.ts";
  import { AREA_FILL_OPACITY, LABEL_CONTRAST, labelTint } from "#lib/map/markers/labelColor.ts";
  import { LABEL_SAMPLES, LABEL_WRAP } from "./label-samples.ts";

  let { uni }: { uni: Uni } = $props();

  // Minecraft's 16 dye colours (cakeutils MAPD-49: the dyes' diffuse colours)
  const DYES: [string, string][] = [
    ["white", "#f9fffe"], ["orange", "#f9801d"], ["magenta", "#c74ebd"], ["light_blue", "#3ab3da"],
    ["yellow", "#fed83d"], ["lime", "#80c71f"], ["pink", "#f38baa"], ["gray", "#474f52"],
    ["light_gray", "#9d9d97"], ["cyan", "#169c9c"], ["purple", "#8932b8"], ["blue", "#3c44aa"],
    ["brown", "#835432"], ["green", "#5e7c16"], ["red", "#b02e26"], ["black", "#1d1d21"]
  ];
  const GROUNDS = ["grass", "sand", "stone", "water", "snow", "nether"] as const;
  const dye = (n: string) => DYES.find((d) => d[0] === n)![1];

  type Sample = { id: string; title: string; wrap?: number; k: Scale; color: string; ground: (typeof GROUNDS)[number] };
  const scales: Sample[] = ([1, 2, 3, 4] as Scale[]).map((k) => ({ id: `k${k}`, title: LABEL_SAMPLES.latin, k, color: dye("red"), ground: "grass" }));
  const grounds: Sample[] = [
    { id: "g-grass", title: "Orchard", k: 2, color: dye("lime"), ground: "grass" },
    { id: "g-sand", title: "Dune Market", k: 2, color: dye("yellow"), ground: "sand" },
    { id: "g-stone", title: "Quarry", k: 2, color: dye("light_blue"), ground: "stone" },
    { id: "g-water", title: "Harbour", k: 2, color: dye("white"), ground: "water" },
    { id: "g-snow", title: "Ice Rink", k: 2, color: dye("black"), ground: "snow" },
    { id: "g-nether", title: "Fortress", k: 2, color: dye("orange"), ground: "nether" }
  ];
  const texts: Sample[] = [
    { id: "t-nonlatin", title: LABEL_SAMPLES.nonLatin, k: 2, color: dye("cyan"), ground: "stone" },
    { id: "t-literal", title: LABEL_SAMPLES.literal, k: 2, color: dye("purple"), ground: "grass" },
    { id: "t-two", title: LABEL_SAMPLES.long, wrap: LABEL_WRAP, k: 2, color: dye("blue"), ground: "sand" },
    { id: "t-nonlatin-4", title: LABEL_SAMPLES.nonLatin, k: 4, color: dye("pink"), ground: "nether" },
    { id: "t-two-3", title: LABEL_SAMPLES.long, wrap: LABEL_WRAP, k: 3, color: dye("green"), ground: "snow" }
  ];
  const dyes: Sample[] = DYES.map(([n, c]) => ({ id: `d-${n}`, title: n.replace("_", " "), k: 2, color: c, ground: "stone" }));

  function label(canvas: HTMLCanvasElement, s: Sample) {
    const tint = labelTint(s.color).color;
    const dpr = window.devicePixelRatio || 1;
    renderLabel(canvas, labelLines(s.title, s.wrap, uni), { k: s.k, dpr, color: tint })
      .then((r) => {
        canvas.dataset.scale = String(r.scale);
        canvas.dataset.tint = tint;
        canvas.dataset.ready = "1";
      })
      .catch(() => (canvas.dataset.ready = "error"));
  }
  const area = (c: string) => `--area:${c};--fill:${AREA_FILL_OPACITY * 100}%`;
</script>

{#snippet tile(s: Sample, caption: string)}
  <figure class="mk-tile">
    <div class="mk-ground" data-ground={s.ground}>
      <div class="mk-area" style={area(s.color)} style:--k={s.k}>
        <canvas class="mk-label" data-sample={s.id} data-k={s.k} use:label={s}></canvas>
      </div>
    </div>
    <figcaption class="t-caption">{caption}</figcaption>
  </figure>
{/snippet}

<section class="mk-preview" aria-labelledby="mk-preview-h">
  <h2 id="mk-preview-h" class="t-heading">Area titles</h2>
  <p class="t-small mk-note">
    Minecraft font, tinted from the area colour: lighter than the area until {LABEL_CONTRAST} : 1 against it as drawn (the colour at {AREA_FILL_OPACITY * 100} % over grey), darker only where no lighter tint gets there;
    solid black shadow one font pixel right and down. Made-up titles, preview only.
  </p>
  <h3 class="t-kicker">Scales k 1 to 4</h3>
  <div class="mk-row">{#each scales as s (s.id)}{@render tile(s, `k ${s.k}`)}{/each}</div>
  <h3 class="t-kicker">Grounds</h3>
  <div class="mk-row">{#each grounds as s (s.id)}{@render tile(s, s.ground)}{/each}</div>
  <h3 class="t-kicker">Text</h3>
  <div class="mk-row">{#each texts as s (s.id)}{@render tile(s, `k ${s.k}${s.wrap ? ", two lines" : ""}`)}{/each}</div>
  <h3 class="t-kicker">Dye colours</h3>
  <div class="mk-row">{#each dyes as s (s.id)}{@render tile(s, `${s.color} → ${labelTint(s.color).color}`)}{/each}</div>
</section>

<style>
  .mk-preview { padding: var(--space-6) var(--space-4) var(--space-8); display: flex; flex-direction: column; gap: var(--space-3); max-width: 1200px; }
  .mk-note { margin: 0; color: var(--muted); max-width: 70ch; }
  .mk-preview h3 { margin: var(--space-3) 0 0; color: var(--muted); }
  .mk-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-start; }
  .mk-tile { margin: 0; display: flex; flex-direction: column; gap: var(--space-1); max-width: 100%; }
  .mk-tile figcaption { color: var(--faint); font-size: 11px; }
  /* terrain-like grounds: two close shades in 8 px blocks, like a map tile at close zoom */
  .mk-ground { --a: #5f9f35; --b: #6aa83d; padding: var(--space-4); background: repeating-conic-gradient(var(--a) 0 25%, var(--b) 0 50%) 0 0 / 16px 16px; border-radius: var(--radius-sm); overflow: hidden; max-width: 100%; }
  .mk-ground[data-ground="sand"] { --a: #dbcfa3; --b: #d2c592; }
  .mk-ground[data-ground="stone"] { --a: #7d7d7d; --b: #727272; }
  .mk-ground[data-ground="water"] { --a: #3f5fd0; --b: #3858c2; }
  .mk-ground[data-ground="snow"] { --a: #f5fbfb; --b: #e6eeee; }
  .mk-ground[data-ground="nether"] { --a: #6b2b2b; --b: #5c2424; }
  .mk-area { display: flex; align-items: center; justify-content: center; padding: calc(var(--k) * 4px); background: color-mix(in srgb, var(--area) var(--fill), transparent); border: 2px solid color-mix(in srgb, var(--area) 90%, transparent); }
  .mk-label { display: block; image-rendering: pixelated; }
</style>
