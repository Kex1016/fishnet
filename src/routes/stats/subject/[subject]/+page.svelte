<script lang="ts">
  import { page } from "$app/state";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import PlayerName from "#lib/design/PlayerName.svelte";
  import ScopeSwitch from "#lib/design/ScopeSwitch.svelte";
  import Segmented from "#lib/design/Segmented.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Window from "#lib/design/Window.svelte";
  import WindowHead from "#lib/design/WindowHead.svelte";
  import { MilestoneLadder } from "#lib/milestones/index.ts";
  import HiddenServersNote from "#lib/milestones/HiddenServersNote.svelte";
  import { boardHref } from "#lib/api/metric.ts";
  import { group } from "#lib/format/stat-display.ts";
  import { withParams } from "#lib/url.ts";
  import { playerRowLabel } from "#lib/players/names.ts";
  let { data } = $props();
  const showLadder = $derived(data.ladder !== null && !(!data.ladder.ok && data.ladder.kind === "off"));
  const typeOptions = $derived(data.boards.map((b) => ({ href: withParams(page.url, { type: b.type }), label: b.typeName, current: b.type === data.firstType })));
</script>

{#if !data.subject.ok}
  <PageHead path="~/stats" cmd="cat" args={data.key} title={data.label} />
  <Notice kind="warning"><b>cakeutils could not be reached.</b> This subject will be back when it is.</Notice>
{:else}
  {@const s = data.subject.data}
  <PageHead
    path="~/stats"
    cmd="cat"
    args={data.key}
    title={data.label}
    note={s.names.length > 1 ? `Also known as ${s.names.map((n) => `${n.name ?? "?"} (${n.kind ?? "other"})`).join(", ")}` : undefined}
  >
    <div class="fx-filters">
      <Slot icon={s.names[0]?.icon} size="lg" name={data.label} />
      <a class="ink c5" href="/stats">all stats</a>
    </div>
  </PageHead>

  {#if s.types.length === 0}
    <EmptyState title="Nobody has done this yet" line="{data.label} is in the catalogue, but no one has recorded it." />
  {:else}
    <Window path="~/stats/{data.key}" args="--boards" label="Boards">
      <WindowHead title="Boards" asof={data.scopeName} />
      <div class="fx-filters" style="margin-bottom: 16px">
        {#if data.network.ok}<ScopeSwitch url={page.url} scope={data.scope} servers={data.network.data.servers} minis={data.minis} />{/if}
      </div>
      <div class="fx-scroll">
        <table class="fx-table">
          <caption class="visually-hidden">Boards for {data.label} in {data.scopeName}</caption>
          <thead><tr><th scope="col">Type</th><th scope="col">In the lead</th><th class="r" scope="col">Value</th><th class="r" scope="col">Players</th></tr></thead>
          <tbody>
            {#each data.boards as b (b.type)}
              <tr>
                <td><a href={boardHref({ kind: "stat", type: b.type, subject: data.key }, data.scope)}>{b.typeName}</a></td>
                {#if b.result.ok && b.result.leader}
                  <td><PlayerName uuid={b.result.leader.uuid} name={playerRowLabel(b.result.leader)} /></td>
                  <td class="r">{b.result.leader.display}</td>
                  <td class="r">{group(b.result.total)}</td>
                {:else if b.result.ok}
                  <td colspan="3" class="c1">No one in {data.scopeName} has recorded this yet</td>
                {:else}
                  <td colspan="3" class="c1">Could not be loaded right now</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Window>

    {#if showLadder}
      <Window path="~/milestones" args="--stat {data.key}" label="Milestones">
        <WindowHead title="Milestones" asof={data.firstTypeName ? `${data.firstTypeName} · ${data.scopeName}` : undefined} />
        {#if s.types.length > 1}
          <div class="fx-filters" style="margin-bottom: 16px"><Segmented label="Milestones for which type" options={typeOptions} /></div>
        {/if}
        {#if data.ladder}<MilestoneLadder result={data.ladder} statName={data.ladderName} /><HiddenServersNote scope={data.scope} />{/if}
      </Window>
    {:else if data.miniScope}
      <p class="c1">Milestones are kept per server and for the whole network, not per mini-server.</p>
    {/if}
  {/if}
{/if}
