<script lang="ts">
  // Network stat milestones (cakeutils D-109) cannot leave a hidden server out: who crossed a network
  // threshold first is recorded when it happens, and no per-server history exists to redo it. So when
  // servers are hidden (src/lib/server/hidden-servers.ts) a network milestone view says what it counts
  // instead of passing it off as the listed servers only. Per-server views need no note.
  import { page } from "$app/state";
  import Notice from "#lib/design/Notice.svelte";
  let { scope = "network" }: { scope?: string } = $props();
</script>

{#if page.data.serversHidden && scope === "network"}
  <Notice kind="info">Network milestones count play on every server, including servers this site does not list.</Notice>
{/if}
