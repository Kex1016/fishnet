<script lang="ts">
  // One dimension drawn on its own: raw block coordinates, x to the east (right) and z to the south (down),
  // no projection. Marks have their own shapes (states never rely on colour alone) and a readout that
  // follows hover and focus. Rendered on the server as SVG; the page's table view lists the same points.
  import { gridStep, type DimMap, type LayerId, type Mark, type Path } from "./map.ts";

  let { map, show = { trails: true, deaths: true, graves: true, waystones: true, spawn: true } }: { map: DimMap; show?: Record<LayerId, boolean> } = $props();

  const b = $derived(map.box);
  const span = $derived(Math.max(b.w, b.h));
  const r = $derived(span * 0.013);
  const step = $derived(gridStep(span));
  const xs = $derived.by(() => {
    const out: number[] = [];
    for (let v = Math.ceil(b.x / step) * step; v <= b.x + b.w; v += step) out.push(v);
    return out;
  });
  const zs = $derived.by(() => {
    const out: number[] = [];
    for (let v = Math.ceil(b.z / step) * step; v <= b.z + b.h; v += step) out.push(v);
    return out;
  });
  const font = $derived(span * 0.032);
  const layerOf: Record<Mark["kind"], LayerId | null> = { spawn: "spawn", death: "deaths", grave: "graves", waystone: "waystones", other: null };
  const marks = $derived(map.marks.filter((m) => (layerOf[m.kind] ? show[layerOf[m.kind]!] : true)));
  const paths = $derived(show.trails ? map.paths : []);

  let hot = $state<Mark | Path | null>(null);
  const line = (p: Path) => p.points.map(([x, z], i) => `${i ? "L" : "M"}${x} ${z}`).join("");
  const coords = (m: Mark) => `x ${Math.round(m.x)}${m.y !== null ? `, y ${Math.round(m.y)}` : ""}, z ${Math.round(m.z)}`;
  const kindWord: Record<Mark["kind"], string> = { spawn: "Spawn", death: "Death", grave: "Grave", waystone: "Waystone", other: "Point" };
</script>

<figure class="os-map">
  <figcaption class="os-map__head">
    <span class="t-title-4">{map.label}</span>
    <span class="t-caption os-map__readout" aria-live="polite">
      {#if hot}
        {#if "points" in hot}{hot.title}{#if hot.detail} · {hot.detail}{/if}{:else}{kindWord[hot.kind]}: {hot.title}{#if hot.detail} · {hot.detail}{/if} · {coords(hot)}{/if}
      {:else}
        {map.marks.length} point{map.marks.length === 1 ? "" : "s"}{#if map.paths.length}, {map.paths.length} trail{map.paths.length === 1 ? "" : "s"}{/if}
      {/if}
    </span>
  </figcaption>
  <svg viewBox="{b.x} {b.z} {b.w} {b.h}" role="img" aria-label="Map of {map.label}: x to the east, z to the south, in blocks" preserveAspectRatio="xMidYMid meet" style="width: min(100%, calc(70vh * {b.w / b.h}))">
    <rect x={b.x} y={b.z} width={b.w} height={b.h} class="bg" />
    {#each xs as v (v)}
      <line x1={v} x2={v} y1={b.z} y2={b.z + b.h} class="grid" class:axis={v === 0} vector-effect="non-scaling-stroke" />
      <text x={v + font * 0.3} y={b.z + b.h - font * 0.4} font-size={font} class="tick">{v}</text>
    {/each}
    {#each zs as v (v)}
      <line y1={v} y2={v} x1={b.x} x2={b.x + b.w} class="grid" class:axis={v === 0} vector-effect="non-scaling-stroke" />
      <text x={b.x + font * 0.3} y={v - font * 0.3} font-size={font} class="tick">{v}</text>
    {/each}
    {#each paths as p (p.id)}
      <path d={line(p)} class="trail" class:hot={hot === p} vector-effect="non-scaling-stroke" role="presentation" onpointerenter={() => (hot = p)} onpointerleave={() => (hot = null)}><title>{p.title}{p.detail ? `, ${p.detail}` : ""}</title></path>
    {/each}
    {#each marks as m (m.id)}
      {@const label = `${kindWord[m.kind]}: ${m.title}${m.detail ? `, ${m.detail}` : ""}, ${coords(m)}`}
      <svelte:element
        this={m.href ? "a" : "g"}
        href={m.href ?? undefined}
        tabindex={m.href ? undefined : 0}
        role={m.href ? undefined : "img"}
        aria-label={label}
        class="mark mark--{m.kind}"
        class:muted={m.muted}
        onpointerenter={() => (hot = m)}
        onpointerleave={() => (hot = null)}
        onfocus={() => (hot = m)}
        onblur={() => (hot = null)}
      >
        <title>{label}</title>
        {#if m.kind === "death"}
          <path d="M{m.x - r} {m.z - r}L{m.x + r} {m.z + r}M{m.x + r} {m.z - r}L{m.x - r} {m.z + r}" class="shape cross" vector-effect="non-scaling-stroke" />
        {:else if m.kind === "grave"}
          <rect x={m.x - r * 0.8} y={m.z - r} width={r * 1.6} height={r * 2} class="shape" vector-effect="non-scaling-stroke" />
        {:else if m.kind === "waystone"}
          <path d="M{m.x} {m.z - r * 1.2}L{m.x + r} {m.z}L{m.x} {m.z + r * 1.2}L{m.x - r} {m.z}Z" class="shape" vector-effect="non-scaling-stroke" />
        {:else if m.kind === "spawn"}
          <circle cx={m.x} cy={m.z} r={r * 1.3} class="shape ring" vector-effect="non-scaling-stroke" />
          <circle cx={m.x} cy={m.z} r={r * 0.45} class="shape" />
        {:else}
          <circle cx={m.x} cy={m.z} r={r * 0.7} class="shape" vector-effect="non-scaling-stroke" />
        {/if}
        <circle cx={m.x} cy={m.z} r={r * 2.2} class="hit" />
      </svelte:element>
    {/each}
  </svg>
</figure>

<style>
  .os-map {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .os-map__head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    align-items: baseline;
  }
  .os-map__readout {
    color: var(--muted);
    overflow-wrap: anywhere;
    min-height: 16px;
  }
  svg {
    height: auto;
    display: block;
    margin: 0 auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--sunk);
  }
  .bg {
    fill: var(--sunk);
  }
  .grid {
    stroke: var(--line-soft);
    stroke-width: 1;
  }
  .grid.axis {
    stroke: var(--line);
  }
  .tick {
    fill: var(--faint);
    font-family: var(--font-mono);
  }
  .trail {
    fill: none;
    stroke: var(--acc-viz);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: 0.75;
  }
  .trail.hot {
    opacity: 1;
    stroke-width: 3;
  }
  .shape {
    stroke-width: 1.5;
  }
  .mark--death .shape {
    stroke: var(--error-ink);
    stroke-width: 2.5;
  }
  .mark--grave .shape {
    fill: var(--text);
    stroke: var(--sunk);
  }
  .mark--grave.muted .shape {
    fill: none;
    stroke: var(--muted);
  }
  .mark--waystone .shape {
    fill: var(--soul);
    stroke: var(--sunk);
  }
  .mark--waystone.muted .shape {
    fill: none;
    stroke: var(--soul);
  }
  .mark--spawn .shape {
    fill: var(--acc);
    stroke: var(--acc);
  }
  .mark--spawn .ring {
    fill: none;
    stroke-width: 2;
  }
  .mark--other .shape {
    fill: var(--muted);
  }
  .hit {
    fill: transparent;
  }
  .mark {
    cursor: pointer;
    outline: none;
  }
  .mark:focus-visible .hit {
    stroke: var(--acc-ink);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
</style>
