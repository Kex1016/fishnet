<script lang="ts">
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Notice from "#lib/design/Notice.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { subjectName } from "#lib/players/names.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  <header class="fp-hero">
    <h1 class="t-display">Stats</h1>
    <p class="fp-lede">Every stat the network knows. New ones appear when someone first records them.</p>
    <Stub unit="W6" what="this page" />
  </header>
  <section class="fp-section">
    <h2 class="t-title-2">Types</h2>
    {#if !data.types.ok}<Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>
    {:else if data.types.empty}<EmptyState title="Nothing recorded yet" line="Stat types show up once a server sends its first stats." />
    {:else}
      <div class="fp-chips">{#each data.types.data.types as t (t.key)}<a class="fp-chip" href="/stats/{encodeURIComponent(t.key)}">{t.name ?? subjectName(null, t.key)}</a>{/each}</div>
    {/if}
  </section>
  <section class="fp-section">
    <h2 class="t-title-2">Subjects</h2>
    {#if data.subjects.ok && !data.subjects.empty}
      <ul class="fp-rows" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--space-1)">
        {#each data.subjects.data.subjects as s (s.key + s.kind)}
          <li><a class="fp-row" style="grid-template-columns: 36px minmax(0, 1fr)" href="/stats/subject/{encodeURIComponent(s.key)}"><Slot icon={s.icon} kind={s.kind as never} name={subjectName(s.name, s.key)} /><span class="fp-row__name">{subjectName(s.name, s.key)} <span class="fp-row__sub">{s.kind ?? "?"}</span></span></a></li>
        {/each}
      </ul>
    {:else if data.subjects.ok}
      <EmptyState title="Nothing recorded yet" />
    {/if}
  </section>
</div>
