<script lang="ts">
  import { page } from "$app/state";
  import { Fish } from "@lucide/svelte";
  const title = $derived(page.status === 404 ? "This page wandered off" : "Something went wrong");
  const line = $derived(page.status === 404 ? "There is nothing at this address." : (page.error?.message ?? "Try again in a moment."));
</script>

<svelte:head><title>{page.status} · Fishnet</title></svelte:head>

<div class="fp-page">
  <div class="fp-empty" style="min-height: 240px">
    <Fish class="fp-ico" strokeWidth={1.4} />
    <div class="t-caption">{page.status}</div>
    <div class="fp-empty__title">{title}</div>
    <div class="fp-empty__line">{line}</div>
    <a class="fp-btn" href="/">Back to the network</a>
  </div>
</div>
