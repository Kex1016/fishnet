<script lang="ts">
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { boardHref } from "#lib/api/metric.ts";
  import { subjectName } from "#lib/players/names.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <span class="t-kicker">Stat type · {data.key}</span>
    <h1 class="t-display">{data.type?.name ?? subjectName(null, data.key)}</h1>
    {#if data.type?.kind !== "custom"}<p><a class="fp-chip" href={boardHref({ kind: "stat", type: data.key, subject: "*" })}>Type total board</a></p>{/if}
    <Stub unit="W6" what="this page" />
  </header>
  {#if data.subjects.ok && !data.subjects.empty}
    <ul class="fp-rows" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--space-1)">
      {#each data.subjects.data.subjects as s (s.key)}
        <li><a class="fp-row" style="grid-template-columns: 36px minmax(0, 1fr)" href={boardHref({ kind: "stat", type: data.key, subject: s.key })}><Slot icon={s.icon} kind={s.kind as never} name={subjectName(s.name, s.key)} /><span class="fp-row__name">{subjectName(s.name, s.key)}</span></a></li>
      {/each}
    </ul>
  {:else}
    <EmptyState title="Nothing recorded under this type yet" />
  {/if}
</div>
