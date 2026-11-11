// Who signed up for a round (GET /v2/onesoul/registrations). Listed by name, never numbered: sign-up
// time is not the order of turns, and the page must not look like a queue (WEBSITE-BRIEF §3.2).
import type { PageServerLoad } from "./$types";
import { oneSoul } from "#lib/server/onesoul/index.ts";
import { roundParam } from "#lib/onesoul/links.ts";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { os } = await parent();
  const crumbs = [{ label: "One Soul", href: "/one-soul" }, { label: "Sign-ups", href: "/one-soul/sign-ups" }];
  if (!os) return { title: "Sign-ups", crumbs, reg: null, rounds: [], players: [] };
  const round = roundParam(url) ?? undefined;
  const c = oneSoul();
  const first = await c.registrations({ round, limit: 100 });
  const players = first.ok ? [...first.data.players] : [];
  if (first.ok) for (let o = 100; o < Math.min(first.data.total, 500); o += 100) {
    const more = await c.registrations({ round: first.data.round, limit: 100, offset: o });
    if (more.ok) players.push(...more.data.players);
  }
  players.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const top = Math.max(os.cycle, first.ok ? first.data.round : 0);
  return { title: "Sign-ups", crumbs, reg: first, players, rounds: Array.from({ length: top }, (_, i) => top - i) };
};
