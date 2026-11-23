<script lang="ts">
  // One marker's popup (FMK-2, brief §5.1, §5.2): title, subtitle, where it is (a point's block, an area's size and
  // extent), "Updated 4 Nov 2026" and a "Copy link" button for `?marker=<id>`. Site fonts, not the Minecraft font.
  // Title and subtitle are player text: Svelte text nodes only (escaped), the subtitle with `white-space: pre-line`,
  // never parsed, never HTML. Escape is handled by the layer (the pin or area gets the focus back).
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
  <span class="mk-pop__hd" aria-hidden="true">marker: <span class="mk-pop__hdk">{marker.kind === "point" ? "place" : "area"}</span></span>
  <button type="button" class="mk-pop__close" aria-label="Close" title="Close" onclick={onclose}><span aria-hidden="true">×</span></button>
  <div class="mk-pop__head">
    <span class="mk-pop__swatch" style:background={marker.color} aria-hidden="true"></span>
    <h3 class="mk-pop__title">{marker.title}</h3>
  </div>
  {#if marker.subtitle}<p class="mk-pop__sub">{marker.subtitle}</p>{/if}
  <div class="mk-pop__sheet">
    <span class="mk-pop__k">kind</span><span class="mk-pop__kind">{kind}</span>
    <span class="mk-pop__k">at</span><span class="mk-pop__where">{where}</span>
  </div>
  <div class="mk-pop__foot">
    {#if marker.updatedAt > 0}<span class="mk-pop__upd">Updated {day(marker.updatedAt)}</span>{/if}
    <button type="button" class="ink c3 mk-pop__copy" onclick={copy}>{copied ? "copied" : "copy link"}</button>
  </div>
</div>

<style>
  .mk-pop { display: flex; flex-direction: column; gap: 8px; width: 280px; max-width: 100%; padding: 14px 10px 10px; text-align: left; outline: 0; color: var(--color-text); font-size: 14px; }
  /* the window's label, notched into the popup's gold frame (the wrapper is the window: markers.css) */
  .mk-pop__hd { position: absolute; top: 0; left: 15px; max-width: calc(100% - 60px); padding: 0 1ch; transform: translateY(-50%); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--color-surface); font-size: 16px; }
  .mk-pop__hdk { color: var(--color-foam); }
  .mk-pop__close { position: absolute; top: 0; right: 12px; transform: translateY(-50%); min-width: 24px; height: 20px; padding: 0 4px; border: 0; background: var(--color-surface); color: var(--color-subtle); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
  .mk-pop__close:hover { color: var(--color-text); background: var(--color-overlay); }
  .mk-pop__close:focus-visible, .mk-pop__copy:focus-visible { outline: 2px solid var(--color-foam); outline-offset: 2px; }
  .mk-pop__head { display: flex; align-items: flex-start; gap: 8px; }
  .mk-pop__swatch { flex: none; width: 10px; height: 10px; margin-top: 4px; outline: 1px solid var(--color-base); }
  .mk-pop__title { flex: 1 1 auto; min-width: 0; margin: 0; font: inherit; font-size: 16px; line-height: 18px; color: var(--color-foam); overflow-wrap: anywhere; }
  .mk-pop__sub { margin: 0; color: var(--color-rose); white-space: pre-line; overflow-wrap: anywhere; }
  .mk-pop__sheet { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 12px; line-height: 16px; }
  .mk-pop__k { color: var(--ink-muted); }
  .mk-pop__where { font-variant-numeric: tabular-nums; }
  .mk-pop__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px -10px -10px; padding: 6px 10px 4px; border-top: 1px solid var(--ink-hairline); font-size: 12px; color: var(--ink-muted); }
  .mk-pop__copy { margin-left: auto; min-height: 20px; font-size: 12px; }
  @media (pointer: coarse) {
    .mk-pop__close { min-width: var(--touch); height: 32px; }
    .mk-pop__copy { min-height: var(--touch); }
  }
</style>
