<script lang="ts">
  // The Places popout (FMK-2, brief §5.4): the world's markers as a list, the keyboard and screen-reader twin of the
  // drawing. Every marker is a button named like "Spawn town, area, 31 × 18 blocks"; the arrow keys move between them
  // (Home and End jump), Enter centres the map on the marker and opens its popup. The order is the map's tab order
  // (areas, largest first, then pins: view.ts `drawOrder`). `none` renders nothing at all; `down` says so with a
  // Notice; a stale list says "as of <time> <zone>". Without JavaScript a button is a GET form field, so
  // `?marker=<id>` still opens the marker (the page's load finds its world). Titles are player text: text nodes.
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import { asOf as asOfText } from "#lib/format/dates.ts";
  import MapPopout from "../MapPopout.svelte";
  import { markerName } from "./text.ts";
  import type { PlacesPopoutProps } from "./types.ts";

  let { markers, state: load, selected, asOf, stale, worldName, onpick, form, path, open = $bindable(false) }: PlacesPopoutProps & { open?: boolean; /** the place in the window's prompt heading */ path?: string } = $props();

  let list = $state<HTMLElement>();
  let active = $state<number | null>(null);
  const tab = $derived(active !== null && markers.some((m) => m.id === active) ? active : (markers[0]?.id ?? null));

  const noteOf = (m: (typeof markers)[number]) => (m.kind === "point" ? "Point" : `${m.size.w} × ${m.size.d}`);

  function onkey(e: KeyboardEvent) {
    const keys: Record<string, (i: number, n: number) => number> = {
      ArrowDown: (i, n) => Math.min(n - 1, i + 1),
      ArrowUp: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: (_, n) => n - 1
    };
    const move = keys[e.key];
    if (!move || e.altKey || e.ctrlKey || e.metaKey) return;
    const items = [...(list?.querySelectorAll<HTMLButtonElement>("button[data-place]") ?? [])];
    const i = items.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const to = items[move(i, items.length)];
    active = Number(to.dataset.place);
    to.focus();
  }
  function pick(e: MouseEvent, id: number) {
    e.preventDefault(); // the form is for pages without JavaScript
    active = id;
    onpick(id);
    open = false; // the map and the popup are what the visitor asked for
  }
</script>

{#if load !== "none"}
  <MapPopout label="Places" count={load === "ok" ? markers.length : undefined} {path} cmd="places" bind:open>
    {#if load === "down"}
      <Notice kind="warning">Markers could not be read right now.</Notice>
    {:else}
      {#if stale && asOf}
        <Notice kind="warning">The list of places could not be refreshed, {asOfText(asOf)}.</Notice>
      {/if}
      {#if markers.length === 0}
        <EmptyState title="No markers in this world yet" line="Players add places in game." />
      {:else}
        <span class="mc-pop__line">Places in {worldName}. Arrow keys move, Enter shows one on the map.</span>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions: the arrow keys move between the buttons inside -->
        <form method="get" action={form?.action} bind:this={list} onkeydown={onkey} aria-label="Places in {worldName}">
          {#if form?.world}<input type="hidden" name="world" value={form.world} />{/if}
          <div class="mc-pop__list" role="list">
            {#each markers as m (m.id)}
              <div role="listitem">
                <button
                  type="submit"
                  name="marker"
                  value={m.id}
                  class="mc-pop__item"
                  data-place={m.id}
                  aria-label={markerName(m)}
                  aria-current={selected === m.id ? "true" : undefined}
                  tabindex={tab === m.id ? 0 : -1}
                  onclick={(e) => pick(e, m.id)}
                  onfocus={() => (active = m.id)}
                >
                  <span class="pl-shape" data-kind={m.kind === "point" ? "point" : "area"} style:--c={m.color} aria-hidden="true"></span>
                  <span class="mc-pop__grow">{m.title}</span>
                  <span class="mc-pop__note">{noteOf(m)}</span>
                </button>
              </div>
            {/each}
          </div>
        </form>
      {/if}
    {/if}
  </MapPopout>
{/if}

<style>
  /* the entry's own shape beside its name, never colour alone: a pin is a square flag on a stem (the map's pin),
     an area a dashed square (the map's area) */
  .pl-shape { position: relative; flex: none; width: 14px; height: 14px; }
  .pl-shape[data-kind="point"]::before { content: ""; position: absolute; left: 2px; top: 0; width: 10px; height: 8px; background: var(--c); outline: 1px solid var(--color-base); }
  .pl-shape[data-kind="point"]::after { content: ""; position: absolute; left: 6px; top: 8px; width: 2px; height: 6px; background: var(--c); }
  .pl-shape[data-kind="area"] { border: 2px dashed var(--c); background: color-mix(in srgb, var(--c) 20%, transparent); }
</style>
