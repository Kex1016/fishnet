// One Soul: the client (feature detection, the privacy guard), the regular site without One Soul (standalone
// servers hidden, `exclude=` while cakeutils still rolls them up), and the mock's contract rules.
import { describe, expect, test } from "bun:test";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { createClient } from "#lib/server/cakeutils/create.ts";
import { hideServers } from "#lib/server/cakeutils/hide.ts";
import { worldOf, type World } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { createOneSoulClient } from "#lib/server/onesoul/client.ts";
import { withoutPosition, withoutQueue } from "#lib/server/onesoul/privacy.ts";
import { eventLine, realmLabel, stateLabel } from "#lib/onesoul/format.ts";
import { realmOf } from "#lib/onesoul/realm.ts";
import type { Leaderboard, Playtime } from "#lib/api/types.ts";
import type { OsEvent } from "#lib/onesoul/types.ts";

const fetchOf = (w: World) => (input: string | URL | Request, init?: RequestInit) => handleMock(w, new Request(input, init));
const coreOf = (w: World) => createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(w), log: () => undefined });
const busy = () => structuredClone(worldOf("busy"));

/** busy, as an older proxy: no `standalone` flag (network still contains One Soul), no planned routes */
function legacy(): World {
  const w = busy();
  delete w.standalone;
  w.onesoul!.features = { live: false, tracking: false, map: false, rounds_scope: false };
  return w;
}

describe("feature detection", () => {
  test("a proxy with every route", async () => {
    const c = createOneSoulClient(coreOf(busy()));
    expect(await c.enabled("status")).toBe(true);
    expect(await c.enabled("live")).toBe(true);
    expect(await c.enabled("tracking")).toBe(true);
    expect(await c.enabled("map")).toBe(true);
  });
  test("an older proxy: planned routes answer off, built ones work", async () => {
    const c = createOneSoulClient(coreOf(legacy()));
    expect(await c.enabled("live")).toBe(false);
    const live = await c.live();
    expect(live.ok ? "ok" : live.kind).toBe("off");
    const rounds = await c.rounds();
    expect(rounds.ok ? "ok" : rounds.kind).toBe("off");
    const souls = await c.souls({ limit: 5 });
    expect(souls.ok).toBe(true);
    // a planned filter is not silently dropped on an older proxy
    const mine = await c.souls({ uuid: "x" });
    expect(mine.ok ? "ok" : mine.kind).toBe("off");
  });
  test("no One Soul at all", async () => {
    const w = busy();
    delete w.onesoul;
    const c = createOneSoulClient(coreOf(w));
    expect(await c.enabled("status")).toBe(false);
  });
  test("a token without read:onesoul hides the section", async () => {
    const core = createCore({
      baseUrl: "http://mock.invalid",
      token: "cu_mock_mock",
      log: () => undefined,
      fetchImpl: async () => new Response(JSON.stringify({ type: "urn:cakeutils:problem:forbidden", status: 403 }), { status: 403, headers: { "content-type": "application/problem+json" } })
    });
    expect(await createOneSoulClient(core).enabled("status")).toBe(false);
  });
});

describe("privacy (WEBSITE-BRIEF §3.2, API-EXPANSION §7)", () => {
  test("queue-like keys never survive, at any depth", () => {
    const leaked = { waiting: 3, queue: ["a", "b"], round: { next_up: { name: "Bea" }, players: [{ name: "A", queue_position: 1 }] } };
    const clean = withoutQueue(leaked);
    expect(JSON.stringify(clean)).not.toMatch(/queue|next_up/);
    expect(clean.waiting).toBe(3);
  });
  test("the living soul carries no position", () => {
    const s = withoutPosition({ uuid: "u", name: "A", x: 1, y: 2, z: 3, dim: "minecraft:the_nether", realm: "nether" } as Record<string, unknown>);
    expect(Object.keys(s).sort()).toEqual(["name", "realm", "uuid"]);
  });
  test("a living soul's journal and trail are refused", async () => {
    const w = busy();
    const c = createOneSoulClient(coreOf(w));
    const playing = w.onesoul!.souls.find((s) => s.outcome === "playing")!;
    const j = await c.journal(playing.turn, { cycle: playing.cycle });
    expect(j.ok).toBe(false);
    const t = await c.trail(playing.turn, { cycle: playing.cycle });
    expect(t.ok).toBe(false);
    // the guard holds even if the proxy served it by mistake: the status still names that soul as playing
    const souls = w.onesoul!.souls;
    const journal = playing.journal;
    const served = { ...w, onesoul: { ...w.onesoul!, souls: souls.map((s) => (s === playing ? { ...s, outcome: "died" } : s)) } };
    // the status route reads the playing soul from `outcome`, so keep it "playing" there by serving status from the original world
    const mixed = async (input: string | URL | Request, init?: RequestInit) => {
      const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return handleMock(u.pathname === "/v2/onesoul" || u.pathname === "/v2/onesoul/souls" ? w : (served as World), new Request(input, init));
    };
    expect(journal).not.toBeNull();
    const guarded = createOneSoulClient(createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: mixed, log: () => undefined }));
    const leak = await guarded.journal(playing.turn, { cycle: playing.cycle });
    expect(leak.ok).toBe(false);
  });
  test("a dead soul's journal is served", async () => {
    const w = busy();
    const c = createOneSoulClient(coreOf(w));
    const dead = w.onesoul!.souls.find((s) => s.outcome === "died" && s.journal)!;
    const j = await c.journal(dead.turn, { cycle: dead.cycle });
    expect(j.ok).toBe(true);
  });
  test("no answer of the busy mock carries a queue order", async () => {
    const c = createOneSoulClient(coreOf(busy()));
    const all = await Promise.all([c.status(), c.live(), c.registrations(), c.rounds(), c.souls({ limit: 100 }), c.events({ limit: 100 })]);
    for (const r of all) {
      expect(r.ok).toBe(true);
      if (r.ok) expect(JSON.stringify(r.data)).not.toMatch(/"(queue|next_up|queue_position)"/);
    }
  });
  test("the live soul has a realm, never coordinates", async () => {
    const r = await createOneSoulClient(coreOf(busy())).live();
    if (!r.ok) throw new Error("live failed");
    expect(r.data.soul?.realm).toBe("nether");
    expect(r.data.soul && "x" in r.data.soul).toBe(false);
  });
  test("pranks only for a finished round", async () => {
    const c = createOneSoulClient(coreOf(busy()));
    expect((await c.pranks({ cycle: 1 })).ok).toBe(true);
    expect((await c.pranks({ cycle: 2 })).ok).toBe(false);
  });
  test("the seed only once a round is over", async () => {
    const r = await createOneSoulClient(coreOf(busy())).rounds();
    if (!r.ok) throw new Error("rounds failed");
    expect(r.data.rounds.find((x) => x.cycle === 2)!.seed).toBeNull();
    expect(r.data.rounds.find((x) => x.cycle === 1)!.seed).not.toBeNull();
  });
  test("a non-final death of the living soul has no position on the timeline", async () => {
    const r = await createOneSoulClient(coreOf(busy())).events({ limit: 100 });
    if (!r.ok) throw new Error("events failed");
    const nonFinal = r.data.events.filter((e) => e.kind === "death" && e.data.final === false && e.cycle === 2);
    expect(nonFinal.length).toBeGreaterThan(0);
    for (const e of nonFinal) expect("x" in e.data).toBe(false);
  });
});

describe("the regular site without One Soul", () => {
  const regular = (w: World, exclude: string[]) =>
    hideServers(
      createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(w), exclude: () => exclude }),
      () => new ServerList(["onesoul"])
    );

  test("the One Soul server leaves the network list and its scopes", async () => {
    const c = regular(busy(), []);
    const n = await c.network();
    if (!n.ok) throw new Error("network failed");
    expect(n.data.servers.map((s) => s.id)).not.toContain("onesoul");
    const b = await c.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" }, "server:onesoul");
    expect(b.ok ? "ok" : b.kind).toBe("not_found");
  });

  test("with the flag, network figures never contain One Soul play", async () => {
    const w = busy();
    const raw = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(w) });
    const os = await raw.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" }, "server:onesoul", { limit: 100 });
    const net = await raw.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" }, "network", { limit: 100 });
    const sv = await raw.leaderboard({ kind: "stat", type: "minecraft:mined", subject: "minecraft:stone" }, "server:survival", { limit: 100 });
    if (!os.ok || !net.ok || !sv.ok) throw new Error("boards failed");
    expect(os.data.total).toBeGreaterThan(0);
    // network = every non-standalone server (this world has stone only on survival and its minis)
    const top = net.data.entries[0];
    const survivalTop = (sv.data.entries as Leaderboard["entries"]).find((e) => e.uuid === top.uuid);
    expect(survivalTop).toBeDefined();
  });

  test("without the flag, network reads exclude One Soul and equal the flagged numbers", async () => {
    const flagged = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(busy()) });
    const old = regular(legacy(), ["onesoul"]);
    const metric = { kind: "stat" as const, type: "minecraft:mined", subject: "minecraft:stone" };
    const a = await flagged.leaderboard(metric, "network", { limit: 100 });
    const b = await old.leaderboard(metric, "network", { limit: 100 });
    if (!a.ok || !b.ok) throw new Error("boards failed");
    expect(b.data.entries.map((e) => [e.uuid, e.value])).toEqual(a.data.entries.map((e) => [e.uuid, e.value]));
    // and playtime: network minus One Soul
    const soul = busy().onesoul!.souls[0];
    const pa = await flagged.playtime(soul.uuid);
    const pb = await old.playtime(soul.uuid);
    if (!pa.ok || !pb.ok) throw new Error("playtime failed");
    expect((pb.data as Playtime).total_ms).toBe((pa.data as Playtime).total_ms);
  });

  test("round scopes: a breakdown of the server, 400 on an older proxy", async () => {
    const raw = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(busy()) });
    const metric = { kind: "stat" as const, type: "minecraft:mined", subject: "minecraft:stone" };
    const r1 = await raw.leaderboard(metric, "round:onesoul/1" as never, { limit: 100 });
    const all = await raw.leaderboard(metric, "server:onesoul", { limit: 100 });
    if (!r1.ok || !all.ok) throw new Error("boards failed");
    for (const e of r1.data.entries) expect(all.data.entries.find((x) => x.uuid === e.uuid)!.value).toBeGreaterThanOrEqual(e.value);
    const old = createClient({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(legacy()) });
    const no = await old.leaderboard(metric, "round:onesoul/1" as never);
    expect(no.ok ? "ok" : no.kind).toBe("bad_request");
  });
});

describe("words", () => {
  test("realms and states, known and unknown", () => {
    expect(realmOf("/one-soul")).toBe("onesoul");
    expect(realmOf("/one-soul/rounds/2")).toBe("onesoul");
    expect(realmOf("/one-souls")).toBe("");
    expect(realmLabel("nether")).toBe("the Nether");
    expect(realmLabel("deep_dark_dimension")).toBe("Deep dark dimension");
    expect(stateLabel("prep")).toBe("Sign-ups open");
    expect(stateLabel("frozen_solid")).toBe("Frozen solid");
  });
  test("an unknown event kind reads as its id, player text stays apart", () => {
    const e: OsEvent = { at: 0, kind: "fish_caught", uuid: null, name: null, data: {} };
    expect(eventLine(e).text).toBe("Fish caught");
    const d: OsEvent = { at: 0, kind: "death", uuid: "u", name: "<b>A</b>", data: { cause: "<script>x</script>", final: true, duration_ms: 3_600_000 } };
    const l = eventLine(d);
    expect(l.text).toBe("died after 1h 0m");
    expect(l.quote).toBe("<script>x</script>");
  });
});
