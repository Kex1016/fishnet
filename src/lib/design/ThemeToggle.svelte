<script lang="ts">
  // Dark → light → system, remembered in a cookie so the server renders the right theme next time.
  // Without JavaScript the site follows the system (no attribute on <html>).
  import { onMount } from "svelte";
  import { Monitor, Moon, Sun } from "@lucide/svelte";
  let { theme = "system" }: { theme?: "dark" | "light" | "system" } = $props();
  // svelte-ignore state_referenced_locally
  let current = $state(theme);
  const next = { dark: "light", light: "system", system: "dark" } as const;
  const labels = { dark: "Theme: dark. Switch to light", light: "Theme: light. Switch to system", system: "Theme: system. Switch to dark" };
  onMount(() => {
    const t = document.documentElement.dataset.theme;
    current = t === "dark" || t === "light" ? t : "system";
  });
  function cycle() {
    current = next[current];
    const root = document.documentElement;
    if (current === "system") delete root.dataset.theme;
    else root.dataset.theme = current;
    document.cookie = `theme=${current}; path=/; max-age=31536000; samesite=lax`;
  }
</script>

<button type="button" class="fp-ibtn" aria-label={labels[current]} title={labels[current]} onclick={cycle}>
  {#if current === "dark"}<Moon class="fp-ico" strokeWidth={1.4} />{:else if current === "light"}<Sun class="fp-ico" strokeWidth={1.4} />{:else}<Monitor class="fp-ico" strokeWidth={1.4} />{/if}
</button>
