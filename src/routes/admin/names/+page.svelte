<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
  const statKeys = $derived(Object.keys(data.overrides.stats).sort());
</script>

<PageHead path="admin" cmd="ls" args="names" title="names">
  <p class="c1">
    Change what the site calls a stat. Leave a box empty to use the site's own name. In titles and milestone phrases,
    <code>{"{subject}"}</code> is the block, item or mob, <code>{"{player}"}</code> the first player, <code>{"{nth}"}</code>
    the number as “10th” (“1st km” for distances), <code>{"{n}"}</code> the number as cakeutils writes it and
    <code>{"{times}"}</code> “time” or “times”. A milestone ending in a letter or number gets “!”. The grey words are what
    the site says now.
  </p>
</PageHead>

{#if !data.storeOk}<Notice kind="error">The admin database could not be opened, so names cannot be saved. The server log says why.</Notice>{/if}
{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.saved}<Notice kind="success">Saved {form.saved}. Pages use it from the next view.</Notice>{/if}

<Window path="admin" args="names --types">
  {#if data.typesError}
    <Notice kind="warning">cakeutils did not answer ({data.typesError}), so the list of stat types is missing. Single stats below still work.</Notice>
  {:else if data.types.length === 0}
    <EmptyState title="No stat types yet" line="The network has not recorded any stats." />
  {/if}
  <div class="rows">
    {#each data.types as t (t.key)}
      {@const o = data.overrides.types[t.key] ?? {}}
      {@const d = data.own[t.key]}
      <form method="POST" action="?/type" class="row">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="key" value={t.key} />
        <div class="head">
          <span class="c4">{t.key}</span>
          {#if t.name}<span class="c1">cakeutils calls it “{t.name}”</span>{/if}
        </div>
        <label><span>label</span><input name="label" value={o.label ?? ""} maxlength="80" placeholder={d?.label} /></label>
        <label><span>title</span><input name="title" value={o.title ?? ""} maxlength="80" placeholder={d?.title} /></label>
        <label><span>milestone phrase</span><input name="phrase" value={o.phrase ?? ""} maxlength="80" placeholder={d?.phrase} /></label>
        <div class="act"><button class="ink" type="submit">save</button></div>
      </form>
    {/each}
  </div>
</Window>

<Window path="admin" args="names --stats">
  <p class="c1">For one stat, like <code>killed:minecraft:pufferfish</code>, or a type's total, like <code>killed:*</code>. These win over the type's names.</p>
  <div class="rows">
    {#each statKeys as k (k)}
      {@const o = data.overrides.stats[k]}
      <form method="POST" action="?/stat" class="row">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="key" value={k} />
        <div class="head"><span class="c4">{k}</span></div>
        <label><span>title</span><input name="title" value={o.title ?? ""} maxlength="80" /></label>
        <label><span>milestone phrase</span><input name="phrase" value={o.phrase ?? ""} maxlength="80" /></label>
        <div class="act"><button class="ink" type="submit">save</button></div>
      </form>
    {/each}
    <form method="POST" action="?/stat" class="row">
      <input type="hidden" name="csrf" value={csrf} />
      <label class="head"><span>new stat</span><input name="key" required maxlength="200" placeholder="killed:minecraft:pufferfish" /></label>
      <label><span>title</span><input name="title" maxlength="80" placeholder="Pufferfish killed" /></label>
      <label><span>milestone phrase</span><input name="phrase" maxlength="80" placeholder={"{player} killed their {nth} pufferfish"} /></label>
      <div class="act"><button class="ink c3" type="submit">add</button></div>
    </form>
  </div>
</Window>

<style>
  .rows { display: flex; flex-direction: column; gap: var(--space-3); }
  .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: var(--space-3); align-items: end; border: var(--border-hairline) solid var(--ink-hairline); padding: var(--space-3); }
  .row .head { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: baseline; }
  label { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  label.head { flex-direction: column; align-items: stretch; }
  input { width: 100%; min-width: 0; min-height: var(--touch); padding: 0 var(--space-2); border: var(--border-hairline) solid var(--color-text); background: var(--color-base); color: var(--color-text); border-radius: var(--radius-none); }
  label > span { color: var(--ink-muted); }
  @media (max-width: 760px) {
    .row { grid-template-columns: minmax(0, 1fr); }
  }
</style>
