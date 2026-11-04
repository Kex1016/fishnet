<script lang="ts">
  // W0 stub of the stats explorer on a profile (PLAN §3.4): by type, with icons, search and the scope
  // switch. W5 builds it; the props are frozen here.
  import type { StatList, StatTypes } from "#lib/api/types.ts";
  import type { Result } from "#lib/api/result.ts";
  import type { Scope } from "#lib/api/scope.ts";
  import type { UrlLike } from "#lib/url.ts";
  import EmptyState from "#lib/design/EmptyState.svelte";
  import Slot from "#lib/design/Slot.svelte";
  import { subjectName } from "./names.ts";
  let {
    url,
    scope,
    type,
    q,
    types,
    stats
  }: {
    url: UrlLike;
    scope: Scope;
    /** the selected type key or null for all */
    type: string | null;
    q: string;
    types: Result<StatTypes>;
    stats: Result<StatList>;
  } = $props();
</script>

<div class="fp-section">
  {#if !stats.ok}
    <EmptyState title={stats.kind === "down" ? "cakeutils could not be reached" : "No stats yet"} />
  {:else if stats.empty}
    <EmptyState title="No stats here yet" line="This player has not recorded anything in this scope." />
  {:else}
    <ul class="fp-rows">
      {#each stats.data.stats as s (s.type + s.subject)}
        <li class="fp-row" style="grid-template-columns: 36px minmax(0, 1fr) auto">
          <Slot icon={s.icon} kind={types.ok ? (types.data.types.find((t) => t.key === s.type)?.kind as never) : null} name={subjectName(s.name, s.subject)} />
          <span class="fp-row__name">{subjectName(s.name, s.subject)} <span class="fp-row__sub">{s.type}</span></span>
          <span class="fp-row__value">{s.display}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
