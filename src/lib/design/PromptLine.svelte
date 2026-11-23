<script lang="ts">
  // haiiro's prompt: `@ fishplex » cat network.md`. Love @, foam place, rose », gold command, iris argument.
  // Decoration that reads as a sentence; the words are text.
  let {
    path = "fishplex",
    cmd,
    args,
    tag = "p",
    class: cls
  }: { path?: string; cmd: string; args?: string; tag?: "p" | "span" | "div"; class?: string } = $props();
</script>

<svelte:element this={tag} class={cls}><span class="c2">@</span> <span class="c6">{path}</span> <span class="c4">»</span> <span class="c3">{cmd}</span>{#if args}{" "}<span class="c7">{args}</span>{/if}</svelte:element>
