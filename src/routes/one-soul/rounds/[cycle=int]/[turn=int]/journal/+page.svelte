<script lang="ts">
  // A soul's journal: the game's book by default, or every page as plain text (?view=text). Every page is
  // raw player text and is rendered as text only.
  import { page } from "$app/state";
  import AsOf from "#lib/design/AsOf.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import Book from "#lib/onesoul/book/Book.svelte";
  import OsTabs from "#lib/onesoul/OsTabs.svelte";
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

<PageHead path="~/one-soul" cmd="cat" args="rounds/{data.cycle}/{data.turn}/journal" title="journal" note="round {data.cycle}, turn {data.turn}">
  <OsTabs />
  {#if j}
    <div class="fx-filters">
      <Segmented
        label="View"
        options={[
          { href: withParams(page.url, { view: null }), label: "book", current: !plain },
          { href: withParams(page.url, { view: "text", page: null }), label: "plain text", current: plain }
        ]}
      />
      <button type="button" class="ink c6" onclick={copy}>{copied === "yes" ? "copied" : "copy journal as text"}</button>
      <span class="visually-hidden" role="status">{copied === "yes" ? "Journal copied" : copied === "failed" ? "Copying is not allowed here; use the plain text view" : ""}</span>
    </div>
  {/if}
</PageHead>

{#if !j}
  <Notice kind="warning">This journal could not be loaded right now.</Notice>
{:else}
  <Window path="~/one-soul/rounds/{data.cycle}/{data.turn}" args="--journal">
    <WindowHead title={caption}>
      by <a class="lnk" href={osHref.soul(data.cycle, data.turn)}>{j.soul.name}</a> · published {dateTime(j.published_at)} · {j.pages.length} page{j.pages.length === 1 ? "" : "s"}{#if data.asOf}{" · "}<AsOf at={data.asOf} stale={data.stale} />{/if}
    </WindowHead>
    {#if copied === "failed"}<p class="c3">Copying is not allowed here; use the plain text view.</p>{/if}
    {#if j.pages.length === 0}
      <EmptyState title="The pages are blank" />
    {:else if plain}
      <ol class="os-pages">
        {#each j.pages as text, i (i)}
          <li>
            <span class="cap">Page {i + 1} of {j.pages.length}</span>
            <p class="os-page__text">{text}</p>
          </li>
        {/each}
      </ol>
    {:else}
      <div class="os-book">
        <Book pages={j.pages} label={caption} uni={data.uni} />
        <p class="c1 os-hint">Turn pages with the arrows, the arrow keys or a swipe. Text can be selected and copied.</p>
      </div>
    {/if}
  </Window>
{/if}

<style>
  .os-book {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .os-hint {
    text-align: center;
    font-size: 14px;
  }
  .os-pages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 24px 32px;
  }
  .os-pages li {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--ink-hairline);
    min-width: 0;
  }
  .os-page__text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
