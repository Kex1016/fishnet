<script lang="ts">
  // A recipe drawn on the game's own screen (the crafting table, the anvil, the smithing table): the screen's
  // texture at a whole-number scale, pixelated (the same precedent as the journal book), the items on its slots,
  // the hover name of a slot as a game-style tooltip. The scale comes from container queries (1, 2, 3), so it is
  // right before any script runs. Names come from the snapshot and are only ever text. A type or a slot the page
  // cannot place is shown as a list, never dropped. The words under the picture say the same for a touch screen
  // and a screen reader.
  import { EDGE, GUI_WIDTH, SCREEN_NAME, layoutFor } from "./gui.ts";
  import { itemName, orderedSlots, recipeInWords, resolve, slotName } from "./text.ts";
  import type { GuideRecipe } from "./types.ts";

  let { recipe, names, icons, values }: { recipe: GuideRecipe; names: Map<string, string>; icons: Record<string, string>; values: Map<string, string> } = $props();

  const layout = $derived(layoutFor(recipe));
  const slots = $derived(orderedSlots(recipe));
  const resultName = $derived(recipe.result.name && recipe.result.name.trim() ? recipe.result.name : itemName(names, recipe.result.item));
  const screen = $derived(SCREEN_NAME[recipe.type] ?? null);
  const words = $derived(recipeInWords(recipe, names));
  const note = $derived(recipe.note ? resolve(recipe.note, values) : null);
  const sheet = $derived(layout ? `/mc/gui/${layout.sheet}.png` : "");
  /** a picture that does not load leaves an empty slot, never a broken-image mark (one capturing listener on the box, not an `onerror` on each img: that renders as an inline handler, which the CSP forbids) */
  function hide(box: HTMLElement) {
    box.addEventListener(
      "error",
      (e) => {
        if (e.target instanceof HTMLImageElement) e.target.style.visibility = "hidden";
      },
      true
    );
  }
  const px = (n: number) => `calc(${n}px * var(--s))`;
  const label = $derived(`${screen ?? "Recipe"}: ${words} gives ${recipe.result.count > 1 ? `${recipe.result.count} × ` : ""}${resultName}`);
</script>

<figure class="rg">
  {#if layout}
    <div class="rg-box" use:hide role="group" aria-label={label} style="--sheet:url({sheet});--top:{layout.top};--edge-y:{EDGE.y};--edge-h:{EDGE.h};--gw:{GUI_WIDTH}">
      <div class="rg-top" aria-hidden="true"></div>
      <div class="rg-edge" aria-hidden="true"></div>
      {#each layout.overlays ?? [] as o (o.file)}
        <div class="rg-over" aria-hidden="true" style="background-image:url(/mc/gui/{o.file}.png);left:{px(o.x)};top:{px(o.y)};width:{px(o.w)};height:{px(o.h)}"></div>
      {/each}
      {#each slots as s (s.slot)}
        {@const at = layout.slots[s.slot]}
        {@const name = slotName(names, s)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus shows the slot's name, like hover) -->
        <span class="rg-slot" role="img" aria-label={s.count > 1 ? `${s.count} × ${name}` : name} tabindex="0" style="left:{px(at.x)};top:{px(at.y)}">
          {#if icons[s.item]}<img src={icons[s.item]} alt="" draggable="false" />{:else}<span class="rg-blank" aria-hidden="true"></span>{/if}
          {#if s.count > 1}<span class="rg-count" aria-hidden="true">{s.count}</span>{/if}
          <span class="rg-tip" aria-hidden="true">{name}</span>
        </span>
      {/each}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus shows the slot's name, like hover) -->
      <span class="rg-slot" role="img" aria-label={recipe.result.count > 1 ? `${recipe.result.count} × ${resultName}` : resultName} tabindex="0" style="left:{px(layout.result.x)};top:{px(layout.result.y)}">
        {#if icons[recipe.result.item]}<img src={icons[recipe.result.item]} alt="" draggable="false" />{:else}<span class="rg-blank" aria-hidden="true"></span>{/if}
        {#if recipe.result.count > 1}<span class="rg-count" aria-hidden="true">{recipe.result.count}</span>{/if}
        <span class="rg-tip" aria-hidden="true">{resultName}</span>
      </span>
    </div>
  {:else}
    <ul class="rg-list" aria-label="Recipe">
      {#each slots as s (s.slot)}<li>{s.count > 1 ? `${s.count} × ` : ""}{slotName(names, s)}</li>{/each}
      <li class="rg-gives">gives {recipe.result.count > 1 ? `${recipe.result.count} × ` : ""}{resultName}</li>
    </ul>
  {/if}
  <figcaption class="rg-cap">
    {#if layout}
      {#if screen}<span class="c1">{screen}{recipe.shapeless ? ", shapeless" : ""}.</span>{/if}
      {words} gives {recipe.result.count > 1 ? `${recipe.result.count} × ` : ""}{resultName}.
    {/if}
    {#if note}<span class="c1">{note}</span>{/if}
  </figcaption>
</figure>

<style>
  .rg {
    margin: 0;
    container-type: inline-size;
    width: 100%;
  }
  .rg-box {
    --s: 1;
    position: relative;
    width: calc(var(--gw) * 1px * var(--s));
    height: calc((var(--top) + var(--edge-h)) * 1px * var(--s));
    max-width: 100%;
    image-rendering: pixelated;
  }
  @container (min-width: 352px) {
    .rg-box {
      --s: 2;
    }
  }
  @container (min-width: 528px) {
    .rg-box {
      --s: 3;
    }
  }
  .rg-top,
  .rg-edge {
    position: absolute;
    left: 0;
    width: 100%;
    background-image: var(--sheet);
    background-repeat: no-repeat;
    background-size: calc(256px * var(--s)) calc(256px * var(--s));
    image-rendering: pixelated;
  }
  .rg-top {
    top: 0;
    height: calc(var(--top) * 1px * var(--s));
    background-position: 0 0;
  }
  .rg-edge {
    top: calc(var(--top) * 1px * var(--s));
    height: calc(var(--edge-h) * 1px * var(--s));
    background-position: 0 calc(var(--edge-y) * -1px * var(--s));
  }
  .rg-over {
    position: absolute;
    background-size: 100% 100%;
    image-rendering: pixelated;
  }
  .rg-slot {
    position: absolute;
    width: calc(16px * var(--s));
    height: calc(16px * var(--s));
    outline: none;
  }
  .rg-slot img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  .rg-blank {
    display: block;
    width: 100%;
    height: 100%;
  }
  /* the game's slot highlight: a pale square over the item */
  .rg-slot:hover,
  .rg-slot:focus-visible {
    background: rgba(255, 255, 255, 0.5);
    z-index: 2;
  }
  .rg-count {
    position: absolute;
    right: 0;
    bottom: 0;
    font-size: max(10px, calc(var(--s) * 8px));
    line-height: 1;
    color: #fff;
    text-shadow: 1px 1px 0 #3f3f3f;
  }
  /* the game's tooltip: near-black with a violet frame, above the slot */
  .rg-tip {
    display: none;
    position: absolute;
    left: 50%;
    bottom: calc(100% + 4px);
    transform: translateX(-50%);
    padding: 2px 6px;
    white-space: nowrap;
    font-size: 14px;
    line-height: 1.2;
    color: #fff;
    background: #100010f0;
    border: 2px solid #2a0a5e;
    pointer-events: none;
  }
  .rg-slot:hover .rg-tip,
  .rg-slot:focus-visible .rg-tip {
    display: block;
    z-index: 3;
  }
  .rg-cap {
    margin-top: 8px;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .rg-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rg-gives {
    color: var(--color-subtle);
  }
</style>
