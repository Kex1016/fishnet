<script lang="ts">
  // A player's head from /img/face/<uuid>.png in haiiro's square frame: nearest neighbour, never smoothed.
  // The frame's dither shows while the picture loads. sm 20px (rows), md 32px, lg 128px in a double frame
  // (96px on a phone); `frame` colours the lg frame: gold for the living soul, love for the dead.
  let {
    uuid,
    name,
    size = "md",
    tint,
    frame
  }: {
    uuid: string;
    name?: string;
    size?: "sm" | "md" | "lg";
    /** the dither behind the head: foam by default */
    tint?: "pine" | "iris" | "rose";
    frame?: "gold" | "love";
  } = $props();
  const px = $derived({ sm: 20, md: 32, lg: 128 }[size]);
  const cls = $derived(["fx-face", size === "md" ? "" : size, tint ? tint[0] : "", frame ?? ""].filter(Boolean).join(" "));
</script>

<span class={cls}><img src="/img/face/{uuid}.png" alt={name ? `${name}'s head` : ""} width={px} height={px} loading="lazy" decoding="async" /></span>
