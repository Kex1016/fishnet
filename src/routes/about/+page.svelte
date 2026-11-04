<script lang="ts">
  import { SITE } from "#lib/nav.ts";
  import { day } from "#lib/format/dates.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import Notice from "#lib/design/Notice.svelte";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">{SITE.host}</span>
    <h1 class="t-display">About</h1>
    <p class="fp-lede">
      {SITE.name} is a read-only window on the network. It shows the numbers the network's own server records, and it
      cannot change anything in the game.
    </p>
  </header>

  {#if !data.reachable}
    <Notice kind="warning">
      <b>cakeutils could not be reached.</b> Pages show the last good data this site has, with the time it was taken.
    </Notice>
  {/if}

  <div class="fp-tiles">
    <div class="fp-tile">
      <span class="fp-tile__label">cakeutils</span>
      <span class="fp-tile__value" style="font-size: 20px">{data.reachable ? "reachable" : "unreachable"}</span>
      {#if data.checkedAt !== null}<AsOf at={data.checkedAt} stale={!data.reachable} />{/if}
    </div>
    <div class="fp-tile">
      <span class="fp-tile__label">Milestones</span>
      <span class="fp-tile__value" style="font-size: 20px">{data.milestones ? "on" : "off"}</span>
      <span class="fp-tile__note">{data.milestones ? "Shown on the milestones page and in server pages." : "Switched off on the server, so their sections are hidden."}</span>
    </div>
    <div class="fp-tile">
      <span class="fp-tile__label">Recording since</span>
      <span class="fp-tile__value" style="font-size: 20px">{data.since ? day(data.since) : "not yet"}</span>
      <span class="fp-tile__note">{data.since ? "Charts over time start on this date. Earlier history is not on this site." : "Charts over time appear once the recorder has taken its first snapshots."}</span>
    </div>
  </div>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Where the numbers come from</h2></div>
    <p>
      Every number on this site comes from the cakeutils API on the network's proxy, or from this site's own recording
      of that API, taken every minute or so and kept in its own database. Nothing is estimated and nothing is made up.
    </p>
    <p>
      The game servers send their stats about every 15 seconds, and the proxy saves them a few seconds later. A page is
      therefore never more than about half a minute behind the game, and it can be a little older while the site is
      caching a result.
    </p>
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Reading the pages</h2></div>
    <p><b>Nobody has done this yet</b> means no one has the stat, so no table is shown.</p>
    <p><b>Nobody is online right now</b> and similar empty lines mean the scope has no data yet. A zero is a real zero.</p>
    <p>
      Each server is counted on its own. The network total is not the sum of servers, and a server's numbers include the
      mini-servers inside it. Breakdowns are not added together, so do not add them up yourself.
    </p>
    <p>
      Milestones that were already reached before recording began are marked "Reached before tracking began", since the
      time they happened is not known.
    </p>
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Players and privacy</h2></div>
    <p>
      Player names, prefixes and suffixes are shown as plain text. Skins are fetched by this site, so your browser does
      not contact Mojang directly.
    </p>
    <p>
      A player who does not want to appear here can ask a server admin to be left off. Their name and numbers are then
      dropped from every page and from the recording.
    </p>
  </section>

  <section class="fp-section">
    <div class="fp-section__head"><h2 class="t-title-2">Built on</h2></div>
    <p>
      This site reads the cakeutils v2 API, the network's stats service. It holds the API token on the server, so the
      token never reaches your browser.
    </p>
  </section>
</div>
