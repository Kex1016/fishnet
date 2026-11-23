<script lang="ts">
  // The One Soul section frame. Every page draws its own head (with the section's tabs in it, OsTabs); this
  // frame only holds them in one column, as the shell does, and says when the server cannot be reached.
  // Over the round map the frame is the stage's column (`.rm-stage` fills what the tabs bar leaves).
  import Notice from "#lib/design/Notice.svelte";
  let { children, data } = $props();
</script>

<div class="os-frame">
  {#if data.osDown}
    <Notice kind="warning">The One Soul server could not be reached. What you see is the last good data, if any.</Notice>
  {/if}
  {@render children()}
</div>

<style>
  /* the frame is the shell's column: the same 48px (36px on a phone) between a head and its windows */
  :global(.fx-main) > .os-frame {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
  /* links in the section carry no underline: a name is a link by its colour (`:where` keeps this as weak as
     a bare `a`, so any class that asks for an underline still gets one) */
  :global(:where(.os-frame) a) {
    text-decoration: none;
  }
  /* an inline link in running text, a table or a feed: foam (a filled `a.c6` is an action) */
  :global(.os-frame) :global(a.lnk) {
    color: var(--color-foam);
    text-underline-offset: 3px;
  }
  :global(.os-frame) :global(a.lnk.i) {
    color: var(--color-iris);
  }
  @media (max-width: 720px) {
    :global(.fx-main) > .os-frame {
      gap: 36px;
    }
  }
  /* a round drawn on its tiles (RoundMap, `rm-stage`) fills what the tabs bar leaves, edge to edge */
  :global(.fx-main) > .os-frame:has(> :global(.rm-stage)) {
    gap: 0;
    min-height: 100%;
  }
</style>
