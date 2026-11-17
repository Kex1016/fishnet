<script lang="ts">
  // The stat type filter of the milestone pages: a select inside the page's GET form (it submits on change;
  // the form's button covers browsers without scripts).
  import { ChevronDown } from "@lucide/svelte";
  let { options, value }: { options: { key: string; label: string }[]; value: string } = $props();
</script>

{#if options.length}
  <label class="fp-select">
    <span class="visually-hidden">Stat type</span>
    <select name="type" onchange={(e) => e.currentTarget.form?.submit()}>
      <option value="" selected={!value}>All stat types</option>
      {#each options as t (t.key)}<option value={t.key} selected={t.key === value}>{t.label}</option>{/each}
    </select>
    <ChevronDown class="fp-ico fp-ico--sm" strokeWidth={1.4} />
  </label>
{/if}
