<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import EmptyState from "#lib/design/EmptyState.svelte";
  let { data, form } = $props();
  const csrf = $derived(data.admin?.csrf ?? "");
  const statKeys = $derived(Object.keys(data.overrides.stats).sort());
</script>

<header class="fp-hero">
  <span class="t-kicker">Admin</span>
  <h1 class="t-display">Names</h1>
  <p class="fp-lede">
    Change what the site calls a stat. Leave a box empty to use the site's own name. In titles and milestone phrases,
    <code>{"{subject}"}</code> is the block, item or mob, <code>{"{n}"}</code> is the number and <code>{"{times}"}</code> is
    “time” or “times”. The grey words are what the site says now.
  </p>
</header>

{#if !data.storeOk}<Notice kind="error">The admin database could not be opened, so names cannot be saved. The server log says why.</Notice>{/if}
{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
{#if form?.saved}<Notice kind="success">Saved {form.saved}. Pages use it from the next view.</Notice>{/if}

<section class="fp-section">
  <div class="fp-section__head"><h2 class="t-title-2">Stat types</h2></div>
  {#if data.typesError}
    <Notice kind="warning">cakeutils did not answer ({data.typesError}), so the list of stat types is missing. Single stats below still work.</Notice>
  {:else if data.types.length === 0}
    <EmptyState title="No stat types yet" line="The network has not recorded any stats." />
  {/if}
  <div class="rows">
    {#each data.types as t (t.key)}
      {@const o = data.overrides.types[t.key] ?? {}}
      {@const d = data.own[t.key]}
      <form method="POST" action="?/type" class="fp-panel row">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="key" value={t.key} />
        <div class="head">
          <span class="t-num">{t.key}</span>
          {#if t.name}<span class="muted">cakeutils calls it “{t.name}”</span>{/if}
        </div>
        <label><span class="t-kicker">Label</span><span class="fp-field"><input name="label" value={o.label ?? ""} maxlength="80" placeholder={d?.label} /></span></label>
        <label><span class="t-kicker">Title</span><span class="fp-field"><input name="title" value={o.title ?? ""} maxlength="80" placeholder={d?.title} /></span></label>
        <label><span class="t-kicker">Milestone phrase</span><span class="fp-field"><input name="phrase" value={o.phrase ?? ""} maxlength="80" placeholder={d?.phrase} /></span></label>
        <div class="act"><button class="fp-btn" type="submit">Save</button></div>
      </form>
    {/each}
  </div>
</section>

<section class="fp-section">
  <div class="fp-section__head"><h2 class="t-title-2">Single stats</h2></div>
  <p class="muted">For one stat, like <code>killed:minecraft:pufferfish</code>, or a type's total, like <code>killed:*</code>. These win over the type's names.</p>
  <div class="rows">
    {#each statKeys as k (k)}
      {@const o = data.overrides.stats[k]}
      <form method="POST" action="?/stat" class="fp-panel row">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="key" value={k} />
        <div class="head"><span class="t-num">{k}</span></div>
        <label><span class="t-kicker">Title</span><span class="fp-field"><input name="title" value={o.title ?? ""} maxlength="80" /></span></label>
        <label><span class="t-kicker">Milestone phrase</span><span class="fp-field"><input name="phrase" value={o.phrase ?? ""} maxlength="80" /></span></label>
        <div class="act"><button class="fp-btn" type="submit">Save</button></div>
      </form>
    {/each}
    <form method="POST" action="?/stat" class="fp-panel row">
      <input type="hidden" name="csrf" value={csrf} />
      <label class="head"><span class="t-kicker">New stat</span><span class="fp-field"><input name="key" required maxlength="200" placeholder="killed:minecraft:pufferfish" /></span></label>
      <label><span class="t-kicker">Title</span><span class="fp-field"><input name="title" maxlength="80" placeholder="Pufferfish killed" /></span></label>
      <label><span class="t-kicker">Milestone phrase</span><span class="fp-field"><input name="phrase" maxlength="80" placeholder={"Killed {n} pufferfish"} /></span></label>
      <div class="act"><button class="fp-btn fp-btn--primary" type="submit">Add</button></div>
    </form>
  </div>
</section>

<style>
  .rows { display: flex; flex-direction: column; gap: var(--space-3); }
  .row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: var(--space-3); align-items: end; }
  .row .head { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: baseline; }
  label.head { flex-direction: column; align-items: stretch; }
  label { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .fp-field { width: 100%; }
  .muted { color: var(--muted); }
  @media (max-width: 760px) {
    .row { grid-template-columns: minmax(0, 1fr); }
  }
</style>
