<script lang="ts">
  import { SITE } from "#lib/nav.ts";
  import { day } from "#lib/format/dates.ts";
  import AsOf from "#lib/design/AsOf.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  let { data } = $props();
</script>

<PageHead path="fishnet" cmd="cat" args="about.txt" title="about" lede={`${SITE.name} is a read-only window on the Fishplex network. It shows the numbers the network's own server records, and it cannot change anything in the game.`}>
  <span class="c1">{SITE.host}</span>
</PageHead>

{#if !data.reachable}
  <Notice kind="warning">
    <b>cakeutils could not be reached.</b> Pages show the last good data this site has, with the time it was taken.
  </Notice>
{/if}

<Window path="~/about" args="--status">
  <div class="stat-panel fx-tiles">
    <div>
      <div class="kv_label">cakeutils</div>
      <div class="kv_value"><small>{data.reachable ? "reachable" : "unreachable"}</small></div>
      {#if data.checkedAt !== null}<AsOf at={data.checkedAt} stale={!data.reachable} />{/if}
    </div>
    <div>
      <div class="kv_label">Milestones</div>
      <div class="kv_value"><small>{data.milestones ? "on" : "off"}</small></div>
      <div class="note">{data.milestones ? "Shown on the milestones page and in server pages." : "Switched off on the server, so their sections are hidden."}</div>
    </div>
    <div>
      <div class="kv_label">Advancements</div>
      <div class="kv_value"><small>{data.advancements ? "on" : "off"}</small></div>
      <div class="note">{data.advancements ? "Who completed each advancement first, on the advancements page, server pages and profiles." : "Not tracked by this proxy, so their sections are hidden."}</div>
    </div>
    <div>
      <div class="kv_label">Recording since</div>
      <div class="kv_value"><small>{data.since ? day(data.since) : "not yet"}</small></div>
      <div class="note">{data.since ? "Charts over time start on this date. Earlier history is not on this site." : "Charts over time appear once the recorder has taken its first snapshots."}</div>
    </div>
  </div>
</Window>

<Window path="~/about/numbers" args="--from cakeutils">
  <WindowHead title="Where the numbers come from" level={2} />
  <div class="fx-prose">
    <p>
      Every number on this site comes from the cakeutils API on the network's proxy, or from this site's own recording
      of that API, taken every minute or so and kept in its own database. Nothing is estimated and nothing is made up.
    </p>
    <p>
      The game servers send their stats about every 15 seconds, and the proxy saves them a few seconds later. A page is
      therefore never more than about half a minute behind the game, and it can be a little older while the site is
      caching a result.
    </p>
  </div>
</Window>

<Window path="~/about/reading" args="--help">
  <WindowHead title="Reading the pages" level={2} />
  <div class="fx-prose">
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
    <p>
      Advancements marked "Imported" were completed before the proxy tracked them live; their time comes from the
      server's own world files, which the operator imported once. Advancements are kept per server and for the whole
      network, never per mini-server.
    </p>
  </div>
</Window>

<Window path="~/about/privacy" args="--players">
  <WindowHead title="Players and privacy" level={2} />
  <div class="fx-prose">
    <p>
      Player names, prefixes and suffixes are shown as plain text. Skins are fetched by this site, so your browser does
      not contact Mojang directly.
    </p>
    <p>
      A player who does not want to appear here can ask a server admin to be left off. Their name and numbers are then
      dropped from every page and from the recording.
    </p>
  </div>
</Window>

<Window path="~/about/built-on" args="--credits">
  <WindowHead title="Built on" level={2} />
  <div class="fx-prose">
    <p>
      This site reads the cakeutils v2 API, the network's stats service. It holds the API token on the server, so the
      token never reaches your browser.
    </p>
    <p>
      Tiles by <a href="https://github.com/jpenilla/squaremap">squaremap</a>. Places on the map are added by players in game.
    </p>
  </div>
</Window>
