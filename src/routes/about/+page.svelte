<script lang="ts">
  import Stub from "#lib/design/Stub.svelte";
  import { SITE } from "#lib/nav.ts";
  import { day } from "#lib/format/dates.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">About</h1>
    <p class="fp-lede">{SITE.name} is a read-only window on the network: every number comes from the server's own stats, or from this site's recordings of them.</p>
    <Stub unit="W9b" what="this page" />
  </header>
  <div class="fp-tiles">
    <div class="fp-tile"><span class="fp-tile__label">cakeutils</span><span class="fp-tile__value" style="font-size: 20px">{data.reachable ? "reachable" : "unreachable"}</span></div>
    <div class="fp-tile"><span class="fp-tile__label">Milestones</span><span class="fp-tile__value" style="font-size: 20px">{data.milestones ? "on" : "off"}</span></div>
    <div class="fp-tile"><span class="fp-tile__label">Recording since</span><span class="fp-tile__value" style="font-size: 20px">{data.since ? day(data.since) : "not yet"}</span></div>
  </div>
</div>
