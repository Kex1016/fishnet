// FM-5: the One Soul layers of a finished round's map. Pure parts (kinds, worlds, toggles) and the acceptance:
// marks and trails land on the right blocks of the tiles, checked against the mock's archived round tile (its
// 13x13 plaza around the world's spawn, and the darker lines on every block x divisible by 128).
import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { toLatLng } from "#lib/map/crs.ts";
import { dimOfWorld, layerCount, roundLayers, webName } from "#lib/map/layers/onesoul.ts";
import { roundWorldView } from "#lib/map/view.ts";
import { byDimension, toShape } from "#lib/onesoul/map.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { worldOf } from "#lib/server/cakeutils/mock/index.ts";
import type { Feature } from "#lib/onesoul/types.ts";

const OW = "minecraft:overworld";
const NE = "minecraft:the_nether";
const point = (kind: string, x: number, z: number, dim = OW, props: Record<string, unknown> = {}): Feature => ({ type: "Feature", id: `${kind}-${dim}-${x}-${z}`, geometry: { type: "Point", coordinates: [x, z, 64] }, properties: { kind, dim, ...props } });
const trail = (pts: [number, number][], dim = OW): Feature => ({ type: "Feature", id: `t-${dim}`, geometry: { type: "LineString", coordinates: pts.map(([x, z]) => [x, z, 64]) }, properties: { kind: "trail", dim, name: "Ann", turn: 1, outcome: "died", started_at: 0, ended_at: 1000 } });
const maps = (fs: Feature[]) => byDimension(fs.map((f) => toShape(f, 1)!));

describe("round layers", () => {
  test("one layer per kind with its own shape; kinds nothing is marked for are left out", () => {
    const [ow] = maps([point("death", 1, 2), point("grave", 3, 4), trail([[0, 0], [10, 10]]), point("waystone", 5, 6, NE)]);
    const ls = roundLayers(ow);
    expect(ls.map((l) => [l.id, l.shape])).toEqual([["trails", "line"], ["deaths", "cross"], ["graves", "square"]]);
    expect(ls.map(layerCount)).toEqual([1, 1, 1]);
  });
  test("only the world shown: a dimension's layers hold nothing of the others", () => {
    const [ow, ne] = maps([point("death", 1, 2), point("waystone", 5, 6, NE), trail([[0, 0], [9, 9]], NE)]);
    expect(roundLayers(ow).flatMap((l) => l.data.marks.map((m) => m.dim))).toEqual([OW]);
    expect(roundLayers(ne).flatMap((l) => [...l.data.marks.map((m) => m.dim), ...l.data.paths.map((p) => p.dim)])).toEqual([NE, NE]);
    expect(roundLayers(undefined)).toEqual([]);
  });
  test("toggles start on and follow the state; unknown kinds keep a layer of their own", () => {
    const [ow] = maps([point("beacon", 1, 2), point("death", 3, 4)]);
    const ls = roundLayers(ow, { deaths: false });
    expect(ls.map((l) => [l.id, l.on])).toEqual([["deaths", false], ["other", true]]);
  });
  test("world ids are the dimension with the colon replaced, found among the round's own dimensions", () => {
    expect(webName(NE)).toBe("minecraft_the_nether");
    expect(dimOfWorld("minecraft_the_nether", [OW, NE])).toBe(NE);
    expect(dimOfWorld("mod_a_b", ["mod:a_b", "mod_a:b"])).toBe("mod:a_b");
    expect(dimOfWorld("minecraft_the_end", [OW, NE])).toBeNull();
  });
});

describe("marks and trails land on the right blocks", () => {
  const mock = worldOf("busy");
  const get = (path: string) => handleMock(mock, new Request(`http://mock.invalid${path}`, { headers: { authorization: "Bearer cu_mock_mock" } }));

  test("against the archived tile of round 1", async () => {
    const wr = await get("/v2/onesoul/rounds/1/map/worlds/minecraft_overworld?server=onesoul");
    expect(wr.status).toBe(200);
    const view = roundWorldView(await wr.json(), { name: "Overworld", dimension: OW, order: 0 });
    expect(view.tiles.frozen).toBe(true);
    const { spawn } = view;
    const max = view.zoom.max;

    // the tile and the pixel a layer's block is drawn on (L.CRS.Simple, 512 px tiles, the frame of crs.ts)
    const at = (x: number, z: number) => {
      const [lat, lng] = toLatLng(max, x, z);
      const px = lng * 2 ** max;
      const py = -lat * 2 ** max;
      return { tx: Math.floor(px / 512) || 0, ty: Math.floor(py / 512) || 0, i: Math.round(px - (Math.floor(px / 512) || 0) * 512), j: Math.round(py - (Math.floor(py / 512) || 0) * 512) };
    };
    const tiles = new Map<string, { data: Buffer; width: number }>();
    const colour = async (x: number, z: number): Promise<[number, number, number, number]> => {
      const p = at(x, z);
      const key = `${p.tx}_${p.ty}`;
      if (!tiles.has(key)) {
        const r = await get(`/v2/onesoul/rounds/1/map/tiles/minecraft_overworld/${max}/${key}.png?server=onesoul`);
        expect(r.status).toBe(200);
        const { data, info } = await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        tiles.set(key, { data, width: info.width });
      }
      const t = tiles.get(key)!;
      const o = (p.j * t.width + p.i) * 4;
      return [t.data[o], t.data[o + 1], t.data[o + 2], t.data[o + 3]];
    };
    // the plaza is the patch around the spawn block: its colour is read next to the spawn, in whatever the
    // mock's 64-colour tiles made of #b8b0a0 (a block is in it when it has that colour)
    const ref = await colour(spawn.x + 1, spawn.z);
    const plaza = async (x: number, z: number) => {
      const c = await colour(x, z);
      return c[3] === 255 && [0, 1, 2].every((k) => Math.abs(c[k] - ref[k]) <= 4);
    };

    // the world's spawn mark sits in the middle of the plaza (the block itself is drawn red, the mock's landmark), one block outside it is not
    const [ow] = maps([point("spawn", spawn.x, spawn.z)]);
    const mark = roundLayers(ow)[0].data.marks[0];
    expect(await plaza(mark.x, mark.z)).toBe(false);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [6, 0], [-6, 0], [0, 6], [0, -6], [6, 6], [-6, -6]]) expect(await plaza(mark.x + dx, mark.z + dz)).toBe(true);
    for (const [dx, dz] of [[7, 0], [-7, 0], [0, 7], [0, -7], [7, 7], [-7, -7]]) expect(await plaza(mark.x + dx, mark.z + dz)).toBe(false);

    // a trail that runs along the plaza's edge keeps to it, vertex by vertex; shifted by a block it leaves
    const edge: [number, number][] = [[spawn.x - 6, spawn.z - 6], [spawn.x + 6, spawn.z - 6], [spawn.x + 6, spawn.z + 6], [spawn.x - 6, spawn.z + 6]];
    const [t] = maps([trail(edge)]);
    const path = roundLayers(t)[0].data.paths[0];
    for (const [x, z] of path.points) expect(await plaza(x, z)).toBe(true);
    for (const [x, z] of path.points) expect(await plaza(x + (x > spawn.x ? 1 : -1), z + (z > spawn.z ? 1 : -1))).toBe(false);

    // a block x divisible by 128 is the darker line: a mark at x = 256 is on it, x = 257 is not
    const dark = async (x: number, z: number) => (await colour(x, z)).slice(0, 3).reduce((a, b) => a + b, 0);
    const [grid] = maps([point("death", 256, 200), point("death", 257, 200)]);
    const [on, off] = roundLayers(grid).find((l) => l.id === "deaths")!.data.marks;
    expect(await dark(on.x, on.z)).toBeLessThan((await dark(off.x, off.z)) * 0.92);

    // negative blocks fall in the tile west or north of the origin, the same as the mock's rows
    const neg = at(-1, -1);
    expect([neg.tx, neg.ty, neg.i, neg.j]).toEqual([-1, -1, 511, 511]);
  });
});
