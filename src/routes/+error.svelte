<script lang="ts">
  import { page } from "$app/state";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  const missing = $derived(page.status === 404);
  const title = $derived(missing ? "This page wandered off" : "Something went wrong");
  const line = $derived(missing ? "There is nothing at this address." : (page.error?.message ?? "Try again in a moment."));
</script>

<svelte:head><title>{page.status} · Fishnet</title></svelte:head>

<PageHead cmd="cat" args="{page.status}.md" title={String(page.status)} />
<Window path="~/{page.status}" tone={missing ? "off" : "love"} label={title}>
  <div class="fx-empty" role="status"><b>{title}</b>{line}</div>
  <p style="margin-top: 12px"><a class="ink c3" href="/">back to the network</a></p>
</Window>
