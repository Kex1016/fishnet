<script lang="ts">
  // The blob backdrop behind every page (haiiro's live background). Decoration only: hidden from assistive
  // tech, no pointer events. One still frame under reduced motion. The shell renders it once.
  import { onMount } from "svelte";
  import { startBlobs } from "./blobs.ts";
  let cv = $state<HTMLCanvasElement>();
  onMount(() => (cv ? startBlobs(cv) : undefined));
</script>

<div class="fx-blobs" aria-hidden="true"><canvas bind:this={cv} width="240" height="150"></canvas></div>
