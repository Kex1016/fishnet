// Leaderboards (W6): playtime, the featured boards and the composite ones for one scope, top 10 each.
// A board whose stat answers 404 is hidden until it exists (PLAN §3.4); playtime always shows.
import type { PageServerLoad } from "./$types";
import { api } from "#lib/server/cakeutils/client.ts";
import { COMPOSITES, FEATURED, compositeHref } from "#lib/boards.ts";
import { boardHref as metricHref } from "#lib/api/metric.ts";
import { scopeParam } from "#lib/api/scope.ts";
import { withoutHidden } from "#lib/server/hidden.ts";
import type { Result } from "#lib/api/result.ts";
import type { Leaderboard } from "#lib/api/types.ts";
import { compositeBoard } from "./composite.server.ts";
import { scopeLabel, scopeMinis } from "./board.ts";


type Card = { id: string; label: string; href: string; kind: "featured" | "composite"; result: Result<Leaderboard> };

export const load: PageServerLoad = async ({ url }) => {
  const scope = scopeParam(url);
  const c = api();
  const [network, minis, featured, composites] = await Promise.all([
    c.network(),
    c.miniServers(),
    Promise.all(FEATURED.map((b) => c.leaderboard(b.metric, scope, { limit: 10 }))),
    Promise.all(COMPOSITES.map((b) => compositeBoard(c, b, scope)))
  ]);

  const cards: Card[] = [
    ...FEATURED.map((b, i): Card => ({ id: b.id, label: b.label, href: metricHref(b.metric, scope), kind: "featured", result: featured[i] })),
    ...COMPOSITES.map((b, i): Card => ({ id: b.id, label: b.label, href: compositeHref(b, scope), kind: "composite", result: composites[i] }))
  ]
    // 404 = nobody ever recorded it: hidden until it exists. 400 and "off" cannot be shown either.
    .filter((card) => card.id === "playtime" || card.result.ok || card.result.kind === "down" || card.result.kind === "rate_limited")
    .map((card) => {
      const r = card.result;
      if (r.ok) {
        const data = { ...r.data, entries: withoutHidden(r.data.entries).slice(0, 10) };
        return { ...card, result: { ...r, data } };
      }
      return card;
    });

  const statBoards = cards.filter((card) => card.id !== "playtime");
  const okBoards = cards.filter((card) => card.result.ok);
  const servers = network.ok ? network.data.servers : [];
  const miniList = scopeMinis(scope, minis.ok ? minis.data.mini_servers.map((m) => ({ server: m.server, id: m.id, display_name: m.display_name })) : []);
  return {
    title: "Leaderboards",
    crumbs: [{ label: "Leaderboards", href: "/leaderboards" }],
    scope,
    scopeName: scopeLabel(scope, servers, miniList),
    network,
    minis: miniList,
    cards,
    /** no stat board exists yet (a brand new network) */
    noStatBoards: statBoards.every((card) => !card.result.ok && card.result.kind !== "down" && card.result.kind !== "rate_limited"),
    /** every board failed because cakeutils is unreachable */
    allDown: okBoards.length === 0 && cards.length > 0 && cards.every((card) => !card.result.ok && (card.result.kind === "down" || card.result.kind === "rate_limited"))
  };
};
