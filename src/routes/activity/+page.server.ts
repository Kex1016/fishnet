// Activity on the network (cakeutils B5, B9): players online over time and the peak, play time per day,
// the busiest hours of the week (UTC), and who was first to 1 h, 10 h, 100 h and 1000 h. Aggregates only.
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { api, extras } from "#lib/server/cakeutils/client.ts";
import { scopeParam } from "#lib/api/scope.ts";

const DAY = 86_400_000;

export const load: PageServerLoad = async ({ url }) => {
  const x = extras();
  if (!(await x.enabled("activity"))) error(404, "Not found");
  const scope = scopeParam(url);
  const mini = scope.startsWith("mini:");
  const range = url.searchParams.get("range") === "2d" ? "2d" : "30d";
  const until = Math.floor(Date.now() / 60_000) * 60_000; // one minute steps keep the cache warm
  const since = until - (range === "2d" ? 2 * DAY : 30 * DAY);
  const none = Promise.resolve(null);
  const [network, online, playtime, heat, firsts] = await Promise.all([
    api().network(),
    mini ? none : x.activityOnline({ scope, since, until, bucket: range === "2d" ? "hour" : "day" }),
    mini ? none : x.activityPlaytime({ scope, since: until - 30 * DAY, until, bucket: "day" }),
    mini ? none : x.activityHeatmap({ scope, since: until - 90 * DAY, until }),
    mini ? none : x.playtimeMilestones({ scope, limit: 100 })
  ]);
  if (online && !online.ok && online.kind === "not_found") error(404, "Not found");
  // first to each threshold: the earliest dated row per threshold (backfilled rows are undated)
  const first = new Map<number, { threshold_ms: number; display: string; uuid: string; name: string; reached_at: number | null; backfilled?: boolean }>();
  if (firsts?.ok)
    for (const m of firsts.data.milestones) {
      const f = first.get(m.threshold_ms);
      if (!f || (m.reached_at !== null && (f.reached_at === null || m.reached_at < f.reached_at))) first.set(m.threshold_ms, m);
    }
  const serverNames: Record<string, string> = {};
  if (network.ok) for (const s of network.data.servers) serverNames[s.id] = s.display_name;
  return {
    title: "Activity",
    crumbs: [{ label: "Activity", href: "/activity" }],
    network,
    serverNames,
    scope,
    mini,
    range,
    online,
    playtime,
    heat,
    milestones: firsts,
    firstTo: [...first.values()].sort((a, b) => a.threshold_ms - b.threshold_ms)
  };
};
