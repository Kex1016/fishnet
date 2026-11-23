<script lang="ts">
  // The section's tabs and the round's state, in the head of every One Soul page (or, over the round map,
  // in a bar of their own: `bar`). Tabs for pages the proxy cannot serve yet are left out (feature
  // detection, WEBSITE-BRIEF §3.5). The data comes from the section layout.
  import { page } from "$app/state";
  import Segmented from "#lib/design/Segmented.svelte";
  import { stateLabel } from "./format.ts";
  import type { OsState } from "./types.ts";

  let { bar = false }: { bar?: boolean } = $props();

  type Tab = { href: string; label: string; needs?: "tracking" | "map" };
  const TABS: Tab[] = [
    { href: "/one-soul", label: "overview" },
    { href: "/one-soul/chronicle", label: "chronicle" },
    { href: "/one-soul/rounds", label: "rounds" },
    { href: "/one-soul/graveyard", label: "graveyard" },
    { href: "/one-soul/map", label: "map", needs: "map" },
    { href: "/one-soul/charts", label: "charts" },
    { href: "/one-soul/timeline", label: "timeline" },
    { href: "/one-soul/sign-ups", label: "sign-ups" },
    { href: "/one-soul/records", label: "records" }
  ];
  const d = $derived(page.data as unknown as { os?: { cycle: number; state: OsState } | null; osFeatures?: { tracking: boolean; map: boolean } });
  const at = (href: string) => (href === "/one-soul" ? page.url.pathname === href : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`));
  const options = $derived(TABS.filter((t) => !t.needs || d.osFeatures?.[t.needs]).map((t) => ({ href: t.href, label: t.label, current: at(t.href) })));
</script>

<div class="os-tabs" class:os-bar={bar}>
  {#if options.length > 1}<Segmented label="One Soul" {options} />{/if}
  {#if d.os}<span class="badge">round {d.os.cycle} · {stateLabel(d.os.state)}</span>{/if}
</div>

<style>
  .os-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 4px;
    align-self: flex-start;
    max-width: 100%;
    background: var(--color-base);
  }
  /* over the round map: a full-width bar above the stage */
  .os-bar {
    align-self: stretch;
    flex: none;
    padding: 4px 16px;
    border-bottom: var(--border-hairline) solid var(--ink-hairline);
  }
  .badge {
    margin-left: 8px;
    color: var(--color-gold);
    border-color: var(--color-gold);
  }
</style>
