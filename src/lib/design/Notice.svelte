<script lang="ts">
  // A notice: a dashed frame with a word that says what kind it is (colour never carries the meaning alone)
  // and the message. warning = gold, error = love, success and info = foam.
  import type { Snippet } from "svelte";
  let { kind = "info", word, children }: { kind?: "info" | "success" | "warning" | "error"; /** the leading word; each kind has its own */ word?: string; children: Snippet } = $props();
  const words = { info: "note", success: "done", warning: "heads up", error: "error" };
  const tones = { info: "foam", success: "foam", warning: "", error: "love" };
</script>

<div class="fx-notice {tones[kind]}" role={kind === "error" || kind === "warning" ? "alert" : "status"}>
  <b>{word ?? words[kind]}</b>
  <span>{@render children()}</span>
</div>
