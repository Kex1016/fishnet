<script lang="ts">
  // A player's head from /img/face/<uuid>.png (W8; the W0 stub serves a default head). Pixelated, never smoothed.
  let { uuid, name, size = "md" }: { uuid: string; name?: string; size?: "sm" | "md" | "lg" } = $props();
  const px = $derived({ sm: 24, md: 32, lg: 64 }[size]);
</script>

<img class="fp-face fp-face--{size}" src="/img/face/{uuid}.png" alt={name ? `${name}'s head` : ""} width={px} height={px} loading="lazy" decoding="async" />
