// TH-31 (design §8.1 [David]): the living soul's live dot on the One Soul maps, and the round pages' rules. Adversarial:
// only the soul the status names, in the running cycle, never in prep or after the round, never anybody else.
import { describe, expect, test } from "bun:test";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { createMapClient } from "#lib/server/cakeutils/map.ts";
import { worldOf, type World } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { ServerList } from "#lib/server/hidden-servers-list.ts";
import { HiddenList } from "#lib/server/hidden-list.ts";
import { createOneSoulClient } from "#lib/server/onesoul/client.ts";
import { liveSoul } from "#lib/map/layers/round-live.server.ts";
import type { StatusServer } from "#lib/onesoul/types.ts";
import { inPlay } from "#lib/map/layers/onesoul.ts";

const busy = () => structuredClone(worldOf("busy"));
type Hook = (u: URL, r: Response) => Promise<Response> | Response;

function deps(w: World, hook?: Hook, hidden: string[] = []) {
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const res = await handleMock(w, req);
    return hook ? hook(new URL(req.url), res) : res;
  };
  const core = () => createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl, log: () => undefined });
  const map = createMapClient({ core: core(), hiddenLive: () => new ServerList(), hiddenServers: () => new ServerList(hidden), hiddenPlayers: () => new HiddenList() });
  return { os: createOneSoulClient(core()), map, visible: (s: StatusServer[]) => s.filter((x) => !hidden.includes(x.server)) };
}

describe("the living soul's live dot (round-live.server.ts)", () => {
  test("busy: the soul who plays, in the running cycle, whole blocks", async () => {
    const w = busy();
    const playing = w.onesoul!.souls.find((s) => s.outcome === "playing")!;
    const r = await liveSoul(1, deps(w));
    expect(r?.cycle).toBe(w.onesoul!.cycle);
    expect(r?.players.map((p) => p.uuid)).toEqual([playing.uuid]);
    expect(Object.keys(r!.players[0]).sort()).toEqual(["name", "uuid", "world", "x", "yaw", "z"]);
  });

  test("offline, prep, round over: nobody", async () => {
    const off = busy();
    off.onesoul!.current!.online = false;
    expect((await liveSoul(1, deps(off)))?.players).toEqual([]);
    const fresh = structuredClone(worldOf("fresh"));
    expect((await liveSoul(1, deps(fresh)))?.players ?? []).toEqual([]);
  });

  test("a proxy bug that sends someone else, or the soul of another cycle, draws nobody", async () => {
    const w = busy();
    const swap: Hook = async (u, res) => {
      if (!u.pathname.endsWith("/map/players")) return res;
      const b = (await res.json()) as { players: { uuid: string }[]; cycle: number };
      return new Response(JSON.stringify({ ...b, players: b.players.map((p) => ({ ...p, uuid: "99999999-9999-9999-9999-999999999999", name: "Ghost" })) }), { headers: { "content-type": "application/json" } });
    };
    expect((await liveSoul(1, deps(w, swap)))?.players).toEqual([]);
    const ghost: Hook = async (u, res) => {
      if (!u.pathname.endsWith("/map/players")) return res;
      const b = (await res.json()) as { players: object[] };
      return new Response(JSON.stringify({ ...b, players: [...b.players, { uuid: "99999999-9999-9999-9999-999999999999", name: "Ghost", world: "minecraft_overworld", x: 0, z: 0, yaw: 0 }] }), { headers: { "content-type": "application/json" } });
    };
    // two entries: the client takes neither (only "one soul or nobody" is well formed)
    expect((await liveSoul(1, deps(w, ghost)))?.players).toEqual([]);
    const other: Hook = async (u, res) => {
      if (!u.pathname.endsWith("/map/players")) return res;
      const b = (await res.json()) as object;
      return new Response(JSON.stringify({ ...b, cycle: 1 }), { headers: { "content-type": "application/json" } });
    };
    expect((await liveSoul(1, deps(w, other)))?.players).toEqual([]);
  });

  test("cakeutils down or the live map off: nobody, and no crash", async () => {
    const w = busy();
    const down: Hook = (u, res) => (u.pathname.endsWith("/map/players") ? new Response(null, { status: 503, headers: { "retry-after": "5" } }) : res);
    expect((await liveSoul(1, deps(w, down)))?.players).toEqual([]);
    const off: Hook = (u, res) => (u.pathname.endsWith("/map/players") ? new Response(JSON.stringify({ type: "urn:cakeutils:problem:not_found" }), { status: 404 }) : res);
    expect((await liveSoul(1, deps(w, off)))?.players).toEqual([]);
    const status: Hook = (u, res) => (u.pathname === "/v2/onesoul" ? new Response(null, { status: 503 }) : res);
    expect((await liveSoul(1, deps(w, status)))?.players ?? []).toEqual([]);
  });

  test("a hidden One Soul server: no map at all", async () => {
    const w = busy();
    expect(await liveSoul(1, deps(w, undefined, [w.onesoul!.server]))).toBeNull();
  });

  test("which round is in play", () => {
    expect(inPlay({ cycle: 2, state: "running" }, 2)).toBe(true);
    expect(inPlay({ cycle: 2, state: "grace" }, 2)).toBe(true);
    expect(inPlay({ cycle: 2, state: "running" }, 1)).toBe(false);
    expect(inPlay({ cycle: 2, state: "prep" }, 2)).toBe(false);
    expect(inPlay({ cycle: 2, state: "ended" }, 2)).toBe(false);
  });
});
