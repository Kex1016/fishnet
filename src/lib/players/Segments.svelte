<script lang="ts">
  // LuckPerms prefix/suffix as styled spans (PLAN §2.3, §5): text is text, colours come from an
  // allow-list of the 16 chat colours (named or their hex) and anything else renders in `text`.
  // Never parsed as MiniMessage. Final: W5 owns it from here.
  import type { Segment } from "#lib/api/types.ts";
  let { segments }: { segments: Segment[] } = $props();
  const NAMED = new Set(["black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white"]);
  const HEX: Record<string, string> = {
    "#000000": "black", "#0000aa": "dark_blue", "#00aa00": "dark_green", "#00aaaa": "dark_aqua", "#aa0000": "dark_red", "#aa00aa": "dark_purple",
    "#ffaa00": "gold", "#aaaaaa": "gray", "#555555": "dark_gray", "#5555ff": "blue", "#55ff55": "green", "#55ffff": "aqua", "#ff5555": "red",
    "#ff55ff": "light_purple", "#ffff55": "yellow", "#ffffff": "white"
  };
  function colorVar(c: string | undefined): string | undefined {
    if (!c) return undefined;
    const k = c.toLowerCase();
    const name = NAMED.has(k) ? k : HEX[k];
    return name ? `var(--mc-${name})` : undefined;
  }
</script>

{#each segments as s, i (i)}<span
    class="fp-seg-text"
    style:color={colorVar(s.color)}
    data-bold={s.bold || undefined}
    data-italic={s.italic || undefined}
    data-underlined={s.underlined || undefined}
    data-strikethrough={s.strikethrough || undefined}
    data-obfuscated={s.obfuscated || undefined}>{s.text}</span
  >{/each}
