<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
</script>

<header class="fp-hero">
  <span class="t-kicker">Admin</span>
  <h1 class="t-display">Hidden players</h1>
  <p class="fp-lede">Players who asked not to be shown. Their profile is a 404 and they leave every list and board. Changes show on the next page view.</p>
</header>

{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.done}<Notice kind="success">{form.done}</Notice>{/if}

<div class="fp-panels">
  <section class="fp-panel">
    <h2 class="t-title-2">Hidden</h2>
    {#if data.hidden.length === 0}
      <EmptyState title="No hidden players" line="Everyone is on the site." />
    {:else}
      <ul class="list">
        {#each data.hidden as e (e)}
          <li>
            <span class="t-num">{e}</span>
            <form method="POST" action="?/remove">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="entry" value={e} />
              <button class="fp-btn" type="submit">Show again</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
  <section class="fp-panel">
    <h2 class="t-title-2">Hide a player</h2>
    <form method="POST" action="?/add" class="byid">
      <input type="hidden" name="csrf" value={csrf} />
      <label class="t-kicker" for="pentry">Name or UUID</label>
      <div class="line">
        <span class="fp-field"><input id="pentry" name="entry" required maxlength="36" placeholder="Steve" /></span>
        <button class="fp-btn fp-btn--primary" type="submit">Hide</button>
      </div>
    </form>
  </section>
</div>

<style>
  .fp-panel > h2 { margin-bottom: var(--space-3); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .list li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 44px; }
  .list .t-num { min-width: 0; overflow-wrap: anywhere; }
  .byid { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
  .line { display: flex; gap: var(--space-2); }
  .line .fp-field { flex: 1; min-width: 0; }
</style>
