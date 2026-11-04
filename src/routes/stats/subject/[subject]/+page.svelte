<script lang="ts">
  import { page } from "$app/state";
  import Notice from "#lib/design/Notice.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import Stub from "#lib/design/Stub.svelte";
  import { MilestoneLadder } from "#lib/milestones/index.ts";
  import { boardHref } from "#lib/api/metric.ts";
  import { subjectName } from "#lib/players/names.ts";
  let { data } = $props();
</script>

<div class="fp-page">
  {#if !data.subject.ok}
    <Notice kind="warning"><b>cakeutils could not be reached.</b></Notice>
  {:else}
    {@const s = data.subject.data}
    <header class="fp-hero" style="flex-direction: row; align-items: center; gap: var(--space-4)">
      <Slot icon={s.names[0]?.icon} kind={s.names[0]?.kind as never} size="lg" />
      <div>
        <span class="t-kicker">{page.params.subject}</span>
        <h1 class="t-display">{subjectName(s.names[0]?.name, s.key)}</h1>
        {#if s.names.length > 1}<p class="t-small t-muted">{s.names.map((n) => `${n.name ?? "?"} (${n.kind})`).join(" · ")}</p>{/if}
      </div>
    </header>
    <Stub unit="W6" what="this page" />
    <section class="fp-section">
      <h2 class="t-title-3">Boards</h2>
      <div class="fp-chips">{#each s.types as t (t)}<a class="fp-chip" href={boardHref({ kind: "stat", type: t, subject: s.key })}>{t}</a>{/each}</div>
    </section>
    {#if data.ladder}
      <section class="fp-section">
        <h2 class="t-title-3">Milestones · {data.firstType}</h2>
        <MilestoneLadder result={data.ladder} statName={s.names[0]?.name} />
      </section>
    {/if}
  {/if}
</div>
