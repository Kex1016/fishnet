<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
</script>

<PageHead path="admin" cmd="ls" args="players" title="hidden players" lede="Players who asked not to be shown. Their profile is a 404 and they leave every list and board. Changes show on the next page view." />

{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.done}<Notice kind="success">{form.done}</Notice>{/if}

<div class="panels">
  <Window path="admin" args="players --hidden">
    {#if data.hidden.length === 0}
      <EmptyState title="No hidden players" line="Everyone is on the site." />
    {:else}
      <ul class="list">
        {#each data.hidden as e (e)}
          <li class="li">
            <span class="c4">{e}</span>
            <form method="POST" action="?/remove">
              <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="entry" value={e} />
              <button class="ink" type="submit">show again</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </Window>

  <Window path="admin" args="players --hide">
    <form method="POST" action="?/add" class="byid">
      <input type="hidden" name="csrf" value={csrf} />
      <label for="pentry">name or uuid</label>
      <div class="line">
        <input id="pentry" name="entry" required maxlength="36" placeholder="Steve" />
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
  .byid { display: flex; flex-direction: column; gap: var(--space-2); }
  .byid label { color: var(--ink-muted); }
  .line { display: flex; gap: var(--space-2); }
  .line input { flex: 1; min-width: 0; min-height: var(--touch); padding: 0 var(--space-2); border: var(--border-hairline) solid var(--color-text); background: var(--color-base); color: var(--color-text); border-radius: var(--radius-none); }
  @media (max-width: 760px) {
    .panels { grid-template-columns: minmax(0, 1fr); }
  }
</style>
