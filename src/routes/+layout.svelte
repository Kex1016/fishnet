<script lang="ts">
  // The shell (haiiro's SiteShell): the bar (wordmark, where you are, who is on, the clock), the page strip
  // and the menu drawer where there is no room for the rail, the side nav window, and the page on the blob
  // backdrop. A page whose content is a stage (the map) gets the bar and the stage only (components.css).
  import "#lib/design/fonts.css";
  import "#lib/design/tokens.css";
  import "#lib/design/base.css";
  import "#lib/design/components.css";

  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, untrack } from "svelte";
  import { NAV, SITE, here, pageTitle, type Crumb, type NavItem } from "#lib/nav.ts";
  import Blobs from "#lib/design/Blobs.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Peek from "#lib/design/Peek.svelte";
  import { sectionPath } from "#lib/design/shell.ts";
  import { group } from "#lib/format/stat-display.ts";

  let { children, data } = $props();

  // the switch into and out of the One Soul realm (src/lib/onesoul/transition.ts)
  import { installRealmTransition } from "#lib/onesoul/transition.ts";
  installRealmTransition();

  // the owner's stat names (admin.db): the same set the server used, so hydration matches
  import { setLabelOverrides } from "#lib/format/labels.ts";
  untrack(() => setLabelOverrides(data.labelOverrides)); // server render and first client render
  $effect.pre(() => setLabelOverrides(data.labelOverrides)); // after a navigation brings a new set

  // the visitor's time zone (dates.ts): the server's guess (the `tz` cookie, else UTC) for hydration, then the
  // browser's own zone, remembered in the cookie so the next page is rendered in it. Dates re-render when it changes.
  import { browser } from "$app/env";
  import { hm, setZoneSource, validZone, zoneName } from "#lib/format/dates.ts";
  let tz = $state(untrack(() => data.tz));
  if (browser) setZoneSource(() => tz);
  onMount(() => {
    let mine: string | null = null;
    try {
      mine = validZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      /* an old browser: stay on the server's zone */
    }
    if (!mine || mine === tz) return;
    tz = mine;
    document.cookie = `tz=${encodeURIComponent(mine)}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  });

  // the clock in the bar: the server's moment for the first render, the browser's own from then on
  let now = $state(untrack(() => data.now));
  onMount(() => {
    now = Date.now();
    const t = setInterval(() => (now = Date.now()), 5000);
    return () => clearInterval(t);
  });
  const clock = $derived(`${hm(now)} ${zoneName(now)}`);

  // the menu: the side nav as a drawer where the rail has no room (and on a stage). Closes on navigation
  // and on Escape.
  let open = $state(false);
  afterNavigate(() => (open = false));
  function key(e: KeyboardEvent) {
    if (e.key === "Escape" && open) open = false;
  }

  const shows = (n: NavItem) => (!n.needsMilestones || data.milestones) && (!n.needsAdvancements || data.advancements) && (!n.needsOneSoul || data.onesoul) && (!n.needs || data[n.needs]);
  const groups = $derived(NAV.map((g) => ({ ...g, items: g.items.filter(shows) })).filter((g) => g.items.length));
  // the quiet count beside a nav entry: only what the layout already knows from the API
  const meta = (n: NavItem): string => {
    const v = n.href === "/servers" ? data.counts.servers : n.href === "/players" ? data.counts.players : null;
    return v === null ? "" : group(v);
  };
  const crumbs = $derived((page.data.crumbs ?? []) as Crumb[]);
  const title = $derived(pageTitle(page.data.title ?? crumbs.at(-1)?.label));
  // where you are, as the prompt's path: every part is a link to that level
  // An error page shows no path: a hidden server's address must not be echoed back (it answers like one that
  // never existed).
  const where = $derived.by(() => {
    if (page.error) return [];
    const parts = page.url.pathname.split("/").filter(Boolean);
    return parts.map((p, i) => {
      let label = p;
      try {
        label = decodeURIComponent(p);
      } catch {
        /* keep the raw part */
      }
      return { label, href: `/${parts.slice(0, i + 1).join("/")}` };
    });
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="{SITE.name}: {SITE.tagline}. Servers, players, stats, leaderboards, milestones and advancements." />
</svelte:head>

<svelte:window onkeydown={key} />

<div class="fx" class:fx-open={open}>
  <a class="ink c3 fx-skip" href="#main">Skip to the page</a>
  <Blobs />
  <header class="fx-bar">
    <a class="fx-brand" href="/" aria-label="{SITE.name} home">fishnet</a>
    <nav class="fx-where" aria-label="Where you are">
      <span class="c2">@</span> <span class="c6">fishplex</span> <span class="c4">»</span> <span class="c3">cd</span>
      <span class="c7"><a href="/" aria-current={where.length ? undefined : "page"}>~</a>{#each where as w, i (w.href)}/<a href={w.href} aria-current={i === where.length - 1 ? "page" : undefined}>{w.label}</a>{/each}</span>
    </nav>
    <span class="grp">
      {#if data.online !== null}<span class="fx-live num" class:off={data.online === 0}>{group(data.online)} online</span>{/if}
      <time class="clock c1">{clock}</time>
      <button class="ink c5 fx-menu" type="button" aria-expanded={open} aria-controls="site-nav" onclick={() => (open = !open)}>{open ? "close" : "menu"}</button>
    </span>
  </header>
  <nav class="fx-strip" aria-label="Pages">
    {#each groups as g, gi (gi)}{#each g.items as n (n.href)}<a href={n.href} aria-current={here(n.href, page.url.pathname) ? "page" : undefined}>{n.label}</a>{/each}{/each}
  </nav>
  <div class="fx-body">
    <button class="fx-scrim" type="button" tabindex="-1" aria-label="Close the menu" onclick={() => (open = false)}></button>
    <aside class="fx-side" id="site-nav">
      <nav class="window" aria-label="Site">
        <span class="section-header">fish: <b>{page.error ? "~" : sectionPath(page.url.pathname)}</b></span>
        <div class="content">
          {#each groups as g, gi (gi)}
            {#if g.label}<span class="lab">{g.label}</span>{/if}
            <div class="list">
              {#each g.items as n (n.href)}
                <a class="li" href={n.href} aria-current={here(n.href, page.url.pathname) ? "page" : undefined}><span class="mk">»</span><span class="grow">{n.label}</span><span class="meta num">{meta(n)}</span></a>
              {/each}
            </div>
          {/each}
        </div>
        <div class="foot">
          <span>{SITE.host}</span><span>read only</span>
          {#if data.mock}<span class="c3" title="FISHNET_MOCK is set: fixture data, not the network">mock: {data.mock}</span>{/if}
        </div>
      </nav>
    </aside>
    <main class="fx-main" id="main">
      {#if data.exclusionUnsupported}
        <Notice kind="warning">Network totals on this site still include servers that are not listed here, because cakeutils is older than this site. Per-server figures are not affected.</Notice>
      {/if}
      {@render children()}
    </main>
  </div>
  <Peek />
</div>
