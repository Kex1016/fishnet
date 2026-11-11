<script lang="ts">
  // The One Soul section frame: a title and the section's tabs. Tabs for pages the proxy cannot serve yet
  // are left out (feature detection, WEBSITE-BRIEF §3.5).
  import { page } from "$app/state";
  import Notice from "#lib/design/Notice.svelte";
  import { stateLabel } from "#lib/onesoul/format.ts";
  let { children, data } = $props();

  type Tab = { href: string; label: string; needs?: "tracking" | "map" };
  const TABS: Tab[] = [
    { href: "/one-soul", label: "Overview" },
    { href: "/one-soul/chronicle", label: "Chronicle" },
    { href: "/one-soul/rounds", label: "Rounds" },
    { href: "/one-soul/graveyard", label: "Graveyard" },
    { href: "/one-soul/timeline", label: "Timeline" },
    { href: "/one-soul/sign-ups", label: "Sign-ups" },
    { href: "/one-soul/records", label: "Records" }
  ];
  const tabs = $derived(TABS.filter((t) => !t.needs || data.osFeatures[t.needs]));
  const at = (href: string) => (href === "/one-soul" ? page.url.pathname === href : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`));
</script>

<div class="os-frame">
  <div class="fp-page os-head">
    <div class="os-head__title">
      <span class="t-kicker">One Soul at a Time</span>
      {#if data.os}<span class="fp-tag os-state" data-state={data.os.state}>Round {data.os.cycle} · {stateLabel(data.os.state)}</span>{/if}
    </div>
    {#if tabs.length > 1}
      <nav class="os-tabs" aria-label="One Soul">
        {#each tabs as t (t.href)}
          <a class="os-tab" href={t.href} aria-current={at(t.href) ? "page" : undefined}>{t.label}</a>
        {/each}
      </nav>
    {/if}
    {#if data.osDown}
      <Notice kind="warning">The One Soul server could not be reached. What you see is the last good data, if any.</Notice>
    {/if}
  </div>
  {@render children()}
</div>

<style>
  .os-head {
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .os-head__title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .os-tabs {
    display: flex;
    gap: var(--space-1);
    overflow-x: auto;
    border-bottom: 1px solid var(--line-soft);
    scrollbar-width: none;
  }
  .os-tab {
    flex: none;
    padding: var(--space-2) var(--space-3);
    color: var(--muted);
    font: 500 14px/20px var(--font-text);
    border-bottom: 2px solid transparent;
    text-decoration: none;
  }
  .os-tab:hover {
    color: var(--text);
    text-decoration: none;
  }
  .os-tab[aria-current="page"] {
    color: var(--text);
    border-bottom-color: var(--acc-ink);
  }
</style>
