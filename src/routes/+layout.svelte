<script lang="ts">
  import "@fontsource/zen-maru-gothic/latin-700.css";
  import "@fontsource/zen-maru-gothic/japanese-700.css";
  import "@fontsource/zen-kaku-gothic-new/latin-400.css";
  import "@fontsource/zen-kaku-gothic-new/latin-500.css";
  import "@fontsource/zen-kaku-gothic-new/latin-700.css";
  import "@fontsource/zen-kaku-gothic-new/japanese-400.css";
  import "@fontsource/jetbrains-mono/latin-400.css";
  import "@fontsource/jetbrains-mono/latin-600.css";
  import "#lib/design/tokens.css";
  import "#lib/design/base.css";
  import "#lib/design/components.css";
  import "@fontsource/cormorant-garamond/latin-700.css";
  import "#lib/onesoul/realm.css";
  import "../app.css";

  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, untrack } from "svelte";
  import { PanelLeft, Search } from "@lucide/svelte";
  import { NAV, SITE, here, pageTitle, type Crumb, type NavItem } from "#lib/nav.ts";
  import Mark from "#lib/design/Mark.svelte";
  import ThemeToggle from "#lib/design/ThemeToggle.svelte";
  import Notice from "#lib/design/Notice.svelte";

  let { children, data } = $props();

  // the animated switch into and out of the One Soul section (WEBSITE-BRIEF §4)
  import { installRealmTransition } from "#lib/onesoul/transition.ts";
  installRealmTransition();

  // the owner's stat names (admin.db): the same set the server used, so hydration matches
  import { setLabelOverrides } from "#lib/format/labels.ts";
  untrack(() => setLabelOverrides(data.labelOverrides)); // server render and first client render
  $effect.pre(() => setLabelOverrides(data.labelOverrides)); // after a navigation brings a new set

  // Sidebar: full, icons only (rail) or hidden, cycled by the TopBar's toggle and remembered per
  // device. "auto" until mounted: CSS shows the rail on phones, full otherwise. On phones the full
  // sidebar opens over the page on a scrim and closes on navigation.
  type SideState = "full" | "rail" | "hidden";
  const next: Record<SideState, SideState> = { full: "rail", rail: "hidden", hidden: "full" };
  const toggleLabel: Record<SideState, string> = { full: "Collapse sidebar to icons", rail: "Hide sidebar", hidden: "Show sidebar" };
  const phone = () => matchMedia("(max-width: 640px)").matches;
  let side = $state<SideState | "auto">("auto");
  const shown = $derived<SideState>(side === "auto" ? "full" : side);
  onMount(() => {
    let saved: SideState | null = null;
    try {
      const s = localStorage.getItem("sidebar");
      if (s === "full" || s === "rail" || s === "hidden") saved = s;
    } catch {
      /* private mode */
    }
    side = phone() ? "rail" : (saved ?? "full");
  });
  afterNavigate(() => {
    if (side === "full" && phone()) side = "rail";
  });
  function toggle() {
    side = next[side === "auto" ? (phone() ? "rail" : "full") : side];
    if (!phone()) {
      try {
        localStorage.setItem("sidebar", side);
      } catch {
        /* ignore */
      }
    }
  }

  const shows = (n: NavItem) => (!n.needsMilestones || data.milestones) && (!n.needsAdvancements || data.advancements) && (!n.needsOneSoul || data.onesoul) && (!n.needs || data[n.needs]);
  const crumbs = $derived((page.data.crumbs ?? []) as Crumb[]);
  const title = $derived(pageTitle(page.data.title ?? crumbs.at(-1)?.label));
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="{SITE.name}: {SITE.tagline}. Servers, players, stats, leaderboards, milestones and advancements." />
</svelte:head>

<div class="fp-shell">
  <aside class="fp-side" data-state={side}>
    <div class="fp-side__in">
      <a class="fp-brand" href="/" aria-label="{SITE.name} home"><Mark class="fp-brand__mark" /><span class="fp-brand__name">{SITE.name}</span></a>
      {#each NAV.map((g) => ({ ...g, items: g.items.filter(shows) })).filter((g) => g.items.length) as group, gi (gi)}
        <nav class="fp-nav-group" aria-label={group.label ?? "Main"}>
          {#if group.label}<span class="fp-nav-group__label">{group.label}</span>{/if}
          {#each group.items as n (n.href)}
            <a class="fp-nav" href={n.href} aria-current={here(n.href, page.url.pathname) ? "page" : undefined} title={n.label}>
              <n.icon class="fp-ico" strokeWidth={1.4} /><span class="fp-nav__label">{n.label}</span>
            </a>
          {/each}
        </nav>
      {/each}
      <div class="fp-side__foot">
        <span class="t-caption t-faint">{SITE.host}</span>
        {#if data.mock}<span class="fp-tag fp-tag--warning" title="FISHNET_MOCK is set: fixture data, not the network">mock: {data.mock}</span>{/if}
      </div>
    </div>
  </aside>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="fp-shell__scrim" onclick={() => (side = "rail")}></div>
  <div class="fp-shell__col">
    <header class="fp-top">
      <button type="button" class="fp-ibtn" aria-label={toggleLabel[shown]} onclick={toggle}>
        <PanelLeft class="fp-ico" strokeWidth={1.4} />
      </button>
      <nav class="fp-crumbs" aria-label="Breadcrumb">
        {#if crumbs.length}<a href="/">{SITE.name}</a>{:else}<span aria-current="page">{SITE.name}</span>{/if}
        {#each crumbs as c, i (i)}
          <span aria-hidden="true">/</span>
          {#if c.href && i < crumbs.length - 1}<a href={c.href}>{c.label}</a>{:else}<span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>{/if}
        {/each}
      </nav>
      <div class="fp-top__end">
        <form class="fp-field fp-search" action="/players" method="get" role="search">
          <Search class="fp-ico fp-ico--sm" strokeWidth={1.4} />
          <input type="search" name="q" placeholder="Find a player" aria-label="Find a player" autocomplete="off" maxlength="64" />
        </form>
        <ThemeToggle theme={data.theme} />
      </div>
    </header>
    <div class="fp-shell__scroll">
      {#if data.exclusionUnsupported}
        <div class="fp-page fp-page--notice">
          <Notice kind="warning">Network totals on this site still include servers that are not listed here, because cakeutils is older than this site. Per-server figures are not affected.</Notice>
        </div>
      {/if}
      {@render children()}
    </div>
  </div>
</div>

<style>
  .fp-page--notice {
    padding-bottom: 0;
  }
</style>
