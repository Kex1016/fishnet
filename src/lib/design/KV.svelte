<script lang="ts">
  // One line of a KeyValueSheet whose value needs markup (a link, a Face, a time).
  import type { Snippet } from "svelte";
  let { label, num = false, children }: { label: string; num?: boolean; children: Snippet } = $props();
</script>

<span class="kv_label">{label}</span><span class={num ? "num" : undefined}>{@render children()}</span>
