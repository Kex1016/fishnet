<script lang="ts">
  // A soul's journal: the game's book by default, or every page as plain text (?view=text). Every page is
  // raw player text and is rendered as text only.
  import { page } from "$app/state";
  import { BookOpen, Copy, Check, AlignLeft } from "@lucide/svelte";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Book from "#lib/onesoul/book/Book.svelte";
  import { osHref } from "#lib/onesoul/links.ts";
  import { dateTime } from "#lib/format/dates.ts";
  import { withParams } from "#lib/url.ts";
  let { data } = $props();
  const j = $derived(data.journal);
  const plain = $derived(page.url.searchParams.get("view") === "text");
  const caption = $derived(j ? (j.title ?? `Journal of ${j.soul.name}`) : "");

  let copied = $state<"no" | "yes" | "failed">("no");
  async function copy() {
    if (!j) return;
    const text = [caption, `by ${j.soul.name}, round ${data.cycle}, turn ${data.turn}`, "", ...j.pages.flatMap((p, i) => [`Page ${i + 1} of ${j.pages.length}`, p, ""])].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copied = "yes";
    } catch {
      copied = "failed";
    }
    setTimeout(() => (copied = "no"), 2500);
  }
</script>

<div class="fp-page">
  {#if !j}
    <Notice kind="warning">This journal could not be loaded right now.</Notice>
  {:else}
    <section class="fp-section">
      <div class="fp-section__head">
        <div>
          <span class="t-kicker">Journal · round {data.cycle}, turn {data.turn}</span>
          <h1 class="t-display os-title">{caption}</h1>
          <div class="t-small t-muted">by <a href={osHref.soul(data.cycle, data.turn)}>{j.soul.name}</a> · published {dateTime(j.published_at)} · {j.pages.length} page{j.pages.length === 1 ? "" : "s"}</div>
        </div>
        {#if data.asOf}<AsOf at={data.asOf} stale={data.stale} />{/if}
      </div>
      <div class="os-actions">
        <nav class="fp-seg" aria-label="View">
          <a href={withParams(page.url, { view: null })} aria-current={plain ? undefined : "page"}><BookOpen class="fp-ico fp-ico--sm" strokeWidth={1.4} />Book</a>
          <a href={withParams(page.url, { view: "text", page: null })} aria-current={plain ? "page" : undefined}><AlignLeft class="fp-ico fp-ico--sm" strokeWidth={1.4} />Plain text</a>
        </nav>
        <button type="button" class="fp-btn" onclick={copy}>
          {#if copied === "yes"}<Check class="fp-ico fp-ico--sm" strokeWidth={1.4} />Copied{:else}<Copy class="fp-ico fp-ico--sm" strokeWidth={1.4} />Copy journal as text{/if}
        </button>
        <span class="visually-hidden" role="status">{copied === "yes" ? "Journal copied" : copied === "failed" ? "Copying is not allowed here; use the plain text view" : ""}</span>
      </div>
    </section>
    {#if j.pages.length === 0}
      <EmptyState icon={BookOpen} title="The pages are blank" />
    {:else if plain}
      <ol class="os-pages">
        {#each j.pages as text, i (i)}
          <li class="fp-card os-page">
            <span class="t-caption os-page__no">Page {i + 1} of {j.pages.length}</span>
            <p class="os-page__text">{text}</p>
          </li>
        {/each}
      </ol>
    {:else}
      <section class="fp-section os-book">
        <Book pages={j.pages} label={caption} />
        <p class="t-small t-muted os-hint">Turn pages with the arrows, the arrow keys or a swipe. Text can be selected and copied.</p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .os-title {
    margin: var(--space-1) 0;
    overflow-wrap: anywhere;
  }
  .os-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
  }
  .os-book {
    align-items: center;
  }
  .os-hint {
    text-align: center;
  }
  .os-pages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }
  .os-page {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .os-page__no {
    color: var(--faint);
  }
  .os-page__text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 400 15px/24px var(--font-text);
  }
</style>
