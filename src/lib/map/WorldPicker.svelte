<script lang="ts">
  // The worlds list of a server's map popout: the server's own worlds first, then each public mini-server's worlds
  // in a group named by the mini's display name, with a link to that mini's stats. Names are plain text.
  import { mapHref } from "#lib/map/links.ts";

  type W = { id: string; name: string; dimension: string | null; mini: string | null; miniName: string | null };
  let { server, worlds, current }: { server: string; worlds: W[]; current: string } = $props();

  const own = $derived(worlds.filter((w) => !w.mini));
  const groups = $derived.by(() => {
    const m = new Map<string, { mini: string; name: string; worlds: W[] }>();
    for (const w of worlds) {
      if (!w.mini) continue;
      const g = m.get(w.mini) ?? { mini: w.mini, name: w.miniName ?? w.mini, worlds: [] };
      g.worlds.push(w);
      m.set(w.mini, g);
    }
    return [...m.values()];
  });
  /** the world's name inside its group: the part after "<mini> · " */
  const short = (g: { name: string }, w: W) => (w.name.startsWith(`${g.name} · `) ? w.name.slice(g.name.length + 3) : w.name);
  const dim = (w: W) => w.dimension?.replace(/^minecraft:/, "").replace(/_/g, " ") ?? "";
</script>

<div class="mc-pop__list">
  {#each own as w (w.id)}
    <a class="mc-pop__item" href={mapHref(server, { world: w.id })} aria-current={w.id === current ? "page" : undefined}>
      <span class="mc-pop__grow">{w.name}</span>
      <span class="mc-pop__note">{dim(w)}</span>
    </a>
  {/each}
</div>
{#each groups as g (g.mini)}
  <span class="mc-pop__title">{g.name}</span>
  <div class="mc-pop__list">
    {#each g.worlds as w (w.id)}
      <a class="mc-pop__item" href={mapHref(server, { world: w.id })} aria-current={w.id === current ? "page" : undefined}>
        <span class="mc-pop__grow">{short(g, w)}</span>
      </a>
    {/each}
    <a class="mc-pop__item mc-pop__more" href="/leaderboards?scope={encodeURIComponent(`mini:${server}/${g.mini}`)}"><span class="mc-pop__grow">{g.name} stats</span></a>
  </div>
{/each}
