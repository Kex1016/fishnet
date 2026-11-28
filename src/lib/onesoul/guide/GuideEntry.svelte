<script lang="ts">
  // One entry of the guide: a feature or an item. Text is plain text (Svelte escapes it); `{key}` placeholders are
  // replaced from the snapshot's values and nothing else is ever parsed. Facts are label and value lines, recipes
  // are drawn on the game's own screens (RecipeGui).
  import KeyValueSheet from "#lib/design/KeyValueSheet.svelte";
  import RecipeGui from "./RecipeGui.svelte";
  import { itemName, resolve } from "./text.ts";
  import type { GuideEntry, GuideRecipe } from "./types.ts";

  let {
    entry: e,
    names,
    icons,
    values,
    recipes
  }: { entry: GuideEntry; names: Map<string, string>; icons: Record<string, string>; values: Map<string, string>; recipes: Map<string, GuideRecipe> } = $props();
</script>

<article class="gd-entry" id={e.id}>
  <h3>
    {#if e.item && icons[e.item]}<img class="gd-icon" src={icons[e.item]} alt="" width="32" height="32" />{/if}
    <a href="#{e.id}">{e.title}</a>
    {#if e.item}<span class="gd-item c1">{itemName(names, e.item)}</span>{/if}
  </h3>
  <div class="fx-prose">
    {#each e.body as p, i (i)}<p>{resolve(p, values)}</p>{/each}
  </div>
  {#if e.facts.length}
    <KeyValueSheet rows={e.facts.map((f) => ({ label: resolve(f.label, values), value: resolve(f.text, values), num: true }))} />
  {/if}
  {#each e.recipes as id (id)}
    {@const r = recipes.get(id)}
    {#if r}<RecipeGui recipe={r} {names} {icons} {values} />{/if}
  {/each}
</article>

<style>
  .gd-entry {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 24px;
    scroll-margin-top: calc(var(--bar-height) + 8px);
  }
  /* the next entry in the section page: a sibling component, so the selector is global */
  :global(.gd-entry + .gd-entry) {
    border-top: var(--border-hairline) solid var(--ink-hairline);
    margin-top: 24px;
  }
  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0;
    font-size: 20px;
  }
  h3 a {
    color: inherit;
  }
  .gd-icon {
    image-rendering: pixelated;
    width: 32px;
    height: 32px;
  }
  .gd-item {
    font-size: 14px;
    font-weight: normal;
  }
</style>
