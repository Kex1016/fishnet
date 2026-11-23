<script lang="ts">
  // The stat type filter of the milestone pages: a select inside the page's GET form (it submits on change;
  // the form's button covers browsers without scripts).
  let { options, value }: { options: { key: string; label: string }[]; value: string } = $props();
</script>

{#if options.length}
  <label class="fx-type">
    <span class="visually-hidden">Stat type</span>
    <select name="type" onchange={(e) => e.currentTarget.form?.submit()}>
      <option value="" selected={!value}>All stat types</option>
      {#each options as t (t.key)}<option value={t.key} selected={t.key === value}>{t.label}</option>{/each}
    </select>
  </label>
{/if}

<style>
  .fx-type { display: inline-flex; }
  select { min-height: 32px; max-width: 100%; padding: 4px 8px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-base); color: var(--color-text); font: inherit; }
  select:focus-visible { border-color: var(--color-foam); outline: none; }
</style>
