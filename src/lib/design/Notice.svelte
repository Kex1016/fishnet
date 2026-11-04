<script lang="ts">
  // A notice with its own icon and words (colour never carries the meaning alone).
  import type { Snippet } from "svelte";
  import { CircleAlert, CircleCheck, Info, TriangleAlert } from "@lucide/svelte";
  let { kind = "info", children }: { kind?: "info" | "success" | "warning" | "error"; children: Snippet } = $props();
  const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };
  const Icon = $derived(icons[kind]);
</script>

<div class="fp-notice fp-notice--{kind}" role={kind === "error" || kind === "warning" ? "alert" : "status"}>
  <Icon class="fp-ico" strokeWidth={1.4} />
  <div>{@render children()}</div>
</div>
