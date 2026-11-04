<script lang="ts">
  // W0 stub: "what this player was first to". W7 fills it.
  import type { PlayerFirstsProps } from "./types.ts";
  import MilestoneFeed from "./MilestoneFeed.svelte";
  let { result, playerName, limit = 10 }: PlayerFirstsProps = $props();
</script>

<MilestoneFeed {result} title="First to" showPlayer={false} {limit} />
