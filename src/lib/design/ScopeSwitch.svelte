<script lang="ts">
  // The scope switch (network | each server | a public mini): links that set ?scope= and keep the rest.
  // Pages pass the servers from /v2/network (and minis from /v2/mini-servers when they want them).
  import type { Scope } from "#lib/api/scope.ts";
  import { withParams, type UrlLike } from "#lib/url.ts";
  import Segmented from "./Segmented.svelte";
  let {
    url,
    scope,
    servers,
    minis = []
  }: {
    url: UrlLike;
    scope: Scope;
    servers: { id: string; display_name: string }[];
    minis?: { server: string; id: string; display_name: string }[];
  } = $props();
  const at = (s: string) => withParams(url, { scope: s === "network" ? null : s });
  const options = $derived(
    [
      { scope: "network", label: "Network" },
      ...servers.map((s) => ({ scope: `server:${s.id}`, label: s.display_name })),
      ...minis.map((m) => ({ scope: `mini:${m.server}/${m.id}`, label: m.display_name }))
    ].map((o) => ({ href: at(o.scope), label: o.label, current: o.scope === scope }))
  );
</script>

<Segmented label="Scope" {options} />
