<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
</script>

<header class="fp-hero">
  <span class="t-kicker">Admin</span>
  <h1 class="t-display">Hidden servers</h1>
  <p class="fp-lede">A hidden server leaves every page, board and feed, and network totals are counted without it. Changes show on the next page view.</p>
</header>

{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.done}<Notice kind="success">{form.done}</Notice>{/if}

<div class="fp-panels">
  <section class="fp-panel">
    <h2 class="t-title-2">Hidden</h2>
    {#if data.hidden.length === 0}
      <EmptyState title="No hidden servers" line="Every server is on the site." />
    {:else}
      <ul class="list">
        {#each data.hidden as id (id)}
          <li>
            <span class="t-num">{id}</span>
            <form method="POST" action="?/remove">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="id" value={id} />
              <button class="fp-btn" type="submit">Show again</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="fp-panel">
    <h2 class="t-title-2">On the site</h2>
    {#if data.networkError}
      <Notice kind="warning">cakeutils did not answer ({data.networkError}), so the server list is missing. You can still hide a server by its id.</Notice>
    {:else if data.visible.length === 0}
      <EmptyState title="No servers to show" line="cakeutils lists no other servers." />
    {:else}
      <ul class="list">
        {#each data.visible as s (s.id)}
          <li>
            <span><span>{s.name}</span> <span class="t-num muted">{s.id}</span></span>
            <form method="POST" action="?/add">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="id" value={s.id} />
              <button class="fp-btn" type="submit">Hide</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
    <form method="POST" action="?/add" class="byid">
      <input type="hidden" name="csrf" value={csrf} />
      <label class="t-kicker" for="sid">Hide by id</label>
      <div class="line">
        <span class="fp-field"><input id="sid" name="id" required maxlength="64" pattern="[A-Za-z0-9._\-]+" placeholder="lobby" /></span>
        <button class="fp-btn fp-btn--primary" type="submit">Hide</button>
      </div>
    </form>
  </section>
</div>

<style>
  .fp-panel > h2 { margin-bottom: var(--space-3); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .list li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 44px; }
  .muted { color: var(--muted); }
  .byid { margin-top: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); }
  .line { display: flex; gap: var(--space-2); }
  .line .fp-field { flex: 1; min-width: 0; }
</style>
