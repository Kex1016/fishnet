<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
</script>

<PageHead path="admin" cmd="ls" args="servers" title="hidden servers" lede="A hidden server leaves every page, board and feed, and network totals are counted without it. Changes show on the next page view." />

{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.done}<Notice kind="success">{form.done}</Notice>{/if}

<div class="panels">
  <Window path="admin" args="servers --hidden">
    {#if data.hidden.length === 0}
      <EmptyState title="No hidden servers" line="Every server is on the site." />
    {:else}
      <ul class="list">
        {#each data.hidden as id (id)}
          <li class="li">
            <span class="c4">{id}</span>
            <form method="POST" action="?/remove">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="id" value={id} />
              <button class="ink" type="submit">show again</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </Window>

  <Window path="admin" args="servers --on-site">
    {#if data.networkError}
      <Notice kind="warning">cakeutils did not answer ({data.networkError}), so the server list is missing. You can still hide a server by its id.</Notice>
    {:else if data.visible.length === 0}
      <EmptyState title="No servers to show" line="cakeutils lists no other servers." />
    {:else}
      <ul class="list">
        {#each data.visible as s (s.id)}
          <li class="li">
            <span><span>{s.name}</span> <span class="c1">{s.id}</span></span>
            <form method="POST" action="?/add">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="id" value={s.id} />
              <button class="ink" type="submit">hide</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
    <form method="POST" action="?/add" class="byid">
      <input type="hidden" name="csrf" value={csrf} />
      <label for="sid">hide by id</label>
      <div class="line">
        <input id="sid" name="id" required maxlength="64" pattern="[A-Za-z0-9._\-]+" placeholder="lobby" />
        <button class="ink c3" type="submit">hide</button>
      </div>
    </form>
  </Window>
</div>

<style>
  .panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .list .li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: var(--touch); }
  .list .c4 { min-width: 0; overflow-wrap: anywhere; }
  .byid { margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-2); }
  .byid label { color: var(--ink-muted); }
  .line { display: flex; gap: var(--space-2); }
  .line input { flex: 1; min-width: 0; min-height: var(--touch); padding: 0 var(--space-2); border: var(--border-hairline) solid var(--color-text); background: var(--color-base); color: var(--color-text); border-radius: var(--radius-none); }
  @media (max-width: 760px) {
    .panels { grid-template-columns: minmax(0, 1fr); }
  }
</style>
