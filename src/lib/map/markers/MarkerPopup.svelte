<script lang="ts">
  // One marker's popup (FMK-2, brief §5.1, §5.2): title, subtitle, where it is (a point's block, an area's size and
  // extent), "Updated 4 Nov 2026" and a "Copy link" button for `?marker=<id>`. Site fonts, not the Minecraft font.
  // Title and subtitle are player text: Svelte text nodes only (escaped), the subtitle with `white-space: pre-line`,
  // never parsed, never HTML. Escape is handled by the layer (the pin or area gets the focus back).
  import { Check, Copy, X } from "@lucide/svelte";
  import { day } from "#lib/format/dates.ts";
  import { kindText, markerName, whereText } from "./text.ts";
  import type { MarkerPopupProps } from "./types.ts";

  let { marker, href, onclose }: MarkerPopupProps = $props();
  let copied = $state(false);

  const where = $derived(whereText(marker));
  const kind = $derived(kindText(marker));

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, location.href).href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* no clipboard (an insecure origin, a refusal): the address bar already holds the link while the popup is open */
    }
  }
</script>

<div class="mk-pop" role="dialog" aria-label={markerName(marker)} tabindex="-1" data-marker={marker.id}>
  <div class="mk-pop__head">
    <span class="mk-pop__swatch" style:background={marker.color} aria-hidden="true"></span>
    <h3 class="mk-pop__title">{marker.title}</h3>
    <button type="button" class="fp-ibtn mk-pop__close" aria-label="Close" title="Close" onclick={onclose}><X class="fp-ico" aria-hidden="true" /></button>
  </div>
  {#if marker.subtitle}<p class="mk-pop__sub">{marker.subtitle}</p>{/if}
  <p class="mk-pop__kind">{kind}</p>
  <p class="mk-pop__where">{where}</p>
  <div class="mk-pop__foot">
    {#if marker.updatedAt > 0}<span class="mk-pop__upd">Updated {day(marker.updatedAt)}</span>{/if}
    <button type="button" class="fp-btn mk-pop__copy" onclick={copy}>
      {#if copied}<Check class="fp-ico fp-ico--sm" aria-hidden="true" /> Copied{:else}<Copy class="fp-ico fp-ico--sm" aria-hidden="true" /> Copy link{/if}
    </button>
  </div>
</div>

<style>
  .mk-pop { display: flex; flex-direction: column; gap: var(--space-1); width: 260px; max-width: 100%; padding: var(--space-3); text-align: left; outline: 0; color: var(--text); }
  .mk-pop__head { display: flex; align-items: flex-start; gap: var(--space-2); }
  .mk-pop__swatch { flex: none; width: 12px; height: 12px; margin-top: 5px; border-radius: 3px; box-shadow: 0 0 0 1px var(--line); }
  .mk-pop__title { flex: 1 1 auto; min-width: 0; margin: 0; font: 700 15px/22px var(--font-head); overflow-wrap: anywhere; }
  .mk-pop__close { flex: none; margin: -4px -6px 0 0; }
  .mk-pop__sub { margin: 0; font: 400 13px/20px var(--font-text); color: var(--text); white-space: pre-line; overflow-wrap: anywhere; }
  .mk-pop__kind { margin: 0; font: 500 12px/16px var(--font-text); color: var(--muted); }
  .mk-pop__where { margin: 0; font: 500 12px/16px var(--font-mono); font-variant-numeric: tabular-nums; color: var(--text); }
  .mk-pop__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-2); }
  .mk-pop__upd { font: 400 12px/16px var(--font-text); color: var(--muted); }
  .mk-pop__copy { margin-left: auto; }
</style>
