// TH-30: the One Soul guide. The snapshot's placeholders and defensive reading, grouping, the recipe layouts, the
// mock's guide (every placeholder has a value, every recipe and item is there), the client (feature detection,
// "as of" while cakeutils is down), the item pictures, and the new threshold events: their sentences, the mock's
// rule that a running round gives no portal position, and the client's own copy of it.
import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { createCore } from "#lib/server/cakeutils/core.ts";
import { worldOf, type World } from "#lib/server/cakeutils/mock/index.ts";
import { handleMock } from "#lib/server/cakeutils/mock/handler.ts";
import { createOneSoulClient } from "#lib/server/onesoul/client.ts";
import { buildGuide, DEFAULTS, recipes, valueText } from "#lib/server/onesoul/mock/guide.ts";
import { guideIcons } from "#lib/server/onesoul/guide.ts";
import { hasPortalPlace, withoutRunningPortalPlaces } from "#lib/server/onesoul/privacy.ts";
import { layoutFor, LAYOUTS } from "#lib/onesoul/guide/gui.ts";
import { ownIcon } from "#lib/onesoul/guide/icons.ts";
import { groupBySection, itemIds, itemNames, missingKeys, normalizeGuide, orderedSlots, recipeInWords, resolve, slotName, titleOfId, valueTexts } from "#lib/onesoul/guide/text.ts";
import { eventHasActor, eventLine } from "#lib/onesoul/format.ts";
import type { Guide } from "#lib/onesoul/guide/types.ts";
import type { EventList, OsEvent } from "#lib/onesoul/types.ts";

const T0 = Date.UTC(2026, 10, 28, 12, 0, 0);
const busy = () => structuredClone(worldOf("busy"));
const fetchOf = (w: World) => (input: string | URL | Request, init?: RequestInit) => handleMock(w, new Request(input, init));
const coreOf = (w: World) => createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: fetchOf(w), log: () => undefined });
const mockGuide = (): Guide => buildGuide("onesoul", T0);

describe("placeholders", () => {
  const values = new Map([
    ["a.b", "3 in-game days"],
    ["c", "<b>bold</b> {a.b}"]
  ]);
  test("a known key is replaced, an unknown one stays as it is", () => {
    expect(resolve("Stable after {a.b}, then {no.such}.", values)).toBe("Stable after 3 in-game days, then {no.such}.");
  });
  test("a value is text: markup stays markup, and a placeholder inside a value is not replaced again", () => {
    expect(resolve("x {c} y", values)).toBe("x <b>bold</b> {a.b} y");
  });
  test("braces that are not a key are left alone", () => {
    expect(resolve("{ } {A B} {{a.b}}", values)).toBe("{ } {A B} {3 in-game days}");
  });
  test("missingKeys names what a text asks for and the snapshot lacks", () => {
    expect(missingKeys("{a.b} {x.y} {x.y}", values)).toEqual(["x.y", "x.y"]);
  });
});

describe("reading the snapshot defensively", () => {
  test("optional fields get their defaults, junk is dropped, unknown fields are ignored", () => {
    const g = normalizeGuide({
      server: "onesoul",
      surprise: 1,
      sections: [{ id: "run", title: "The run" }, { id: 4 }, null],
      entries: [
        { id: "one", section: "run", title: "One", body: ["p", 7], extra: true },
        { id: "broken", section: "run" },
        "nope"
      ],
      items: [{ id: "minecraft:obsidian", name: "Obsidian" }, { id: "x" }],
      recipes: [{ id: "r", type: "crafting", slots: [{ slot: 0, item: "a:b" }, { slot: "z", item: "a:c" }], result: { item: "a:d" } }, { id: "no-result", type: "anvil" }],
      values: [{ key: "k", text: "v" }, { key: "bad" }]
    })!;
    expect(g.sections).toEqual([{ id: "run", title: "The run" }]);
    expect(g.entries).toEqual([{ id: "one", section: "run", title: "One", body: ["p"], facts: [], item: null, recipes: [] }]);
    expect(g.items).toHaveLength(1);
    expect(g.recipes).toEqual([{ id: "r", type: "crafting", shapeless: false, slots: [{ slot: 0, item: "a:b", count: 1, name: null }], result: { item: "a:d", count: 1, name: null }, note: null }]);
    expect(g.values).toEqual([{ key: "k", text: "v", raw: null }]);
  });
  test("a body that is not a guide is null", () => {
    expect(normalizeGuide(null)).toBeNull();
    expect(normalizeGuide([])).toBeNull();
    expect(normalizeGuide("x")).toBeNull();
  });
});

describe("sections, names and recipes in words", () => {
  test("entries are grouped in the snapshot's order; an entry of an unknown section is kept", () => {
    const g = normalizeGuide({
      sections: [{ id: "a", title: "A" }, { id: "empty", title: "Empty" }, { id: "b", title: "B" }],
      entries: [
        { id: "1", section: "b", title: "1" },
        { id: "2", section: "a", title: "2" },
        { id: "3", section: "future", title: "3" }
      ]
    })!;
    const groups = groupBySection(g);
    expect(groups.map((x) => x.section.id)).toEqual(["a", "b", "more"]);
    expect(groups[2].entries.map((e) => e.id)).toEqual(["3"]);
  });
  test("an item the snapshot does not name reads as its id", () => {
    expect(titleOfId("minecraft:ender_eye")).toBe("Ender eye");
    expect(titleOfId("nova_structures:items/void_thing")).toBe("Void thing");
    const names = new Map([["a:b", "Bee"]]);
    expect(slotName(names, { item: "a:b", name: null })).toBe("Bee");
    expect(slotName(names, { item: "a:b", name: "Any bee" })).toBe("Any bee");
    expect(slotName(names, { item: "a:b", name: "  " })).toBe("Bee");
    expect(slotName(names, { item: "x:y_z", name: null })).toBe("Y z");
  });
  test("the Void Anchor recipe in words", () => {
    const g = mockGuide();
    const r = g.recipes.find((x) => x.id === "void-anchor")!;
    expect(recipeInWords(r, itemNames(g))).toBe("4 × Void Shard, 4 × Obsidian, Eye of Ender");
  });
  test("slots come in slot order, one per slot", () => {
    const r = { id: "r", type: "crafting", shapeless: false, slots: [{ slot: 2, item: "a:c", count: 1, name: null }, { slot: 0, item: "a:a", count: 1, name: null }, { slot: 0, item: "a:dup", count: 1, name: null }], result: { item: "a:r", count: 1, name: null }, note: null };
    expect(orderedSlots(r).map((s) => s.item)).toEqual(["a:a", "a:c"]);
  });
});

describe("recipe layouts", () => {
  test("a known type whose slots fit is drawn; an unknown type or a slot that does not fit is listed instead", () => {
    const slot = (n: number) => ({ slot: n, item: "a:b", count: 1, name: null });
    expect(layoutFor({ type: "crafting", slots: [slot(0), slot(8)] })).toBe(LAYOUTS.crafting);
    expect(layoutFor({ type: "crafting", slots: [slot(9)] })).toBeNull();
    expect(layoutFor({ type: "anvil", slots: [slot(0), slot(1)] })).toBe(LAYOUTS.anvil);
    expect(layoutFor({ type: "anvil", slots: [slot(2)] })).toBeNull();
    expect(layoutFor({ type: "smithing", slots: [slot(0), slot(1), slot(2)] })).toBe(LAYOUTS.smithing);
    expect(layoutFor({ type: "stonecutting", slots: [slot(0)] })).toBeNull();
    expect(layoutFor({ type: "crafting", slots: [slot(-1)] })).toBeNull();
  });
  test("the screens' sheets are bundled", () => {
    for (const l of Object.values(LAYOUTS)) expect(existsSync(`static/mc/gui/${l.sheet}.png`)).toBe(true);
  });
  test("every slot of every screen lies inside the part of the sheet that is drawn", () => {
    for (const l of Object.values(LAYOUTS))
      for (const p of [...l.slots, l.result]) {
        expect(p.x + 16).toBeLessThanOrEqual(176);
        expect(p.y + 16).toBeLessThanOrEqual(l.top);
      }
  });
});

describe("the mock's guide", () => {
  test("every placeholder of every text has a value, and a derived one is named", () => {
    const g = mockGuide();
    const v = valueTexts(g);
    const texts = [...g.entries.flatMap((e) => [...e.body, ...e.facts.flatMap((f) => [f.label, f.text])]), ...g.recipes.flatMap((r) => (r.note ? [r.note] : []))];
    expect(texts.length).toBeGreaterThan(80);
    for (const t of texts) expect(missingKeys(t, v)).toEqual([]);
    expect(v.get("onesoul.offerings.void-shard")).toBe("60 minutes");
  });
  test("every recipe an entry names exists, every item is named, every entry's section exists", () => {
    const g = mockGuide();
    const ids = new Set(g.recipes.map((r) => r.id));
    const sections = new Set(g.sections.map((s) => s.id));
    for (const e of g.entries) {
      expect(sections.has(e.section)).toBe(true);
      for (const r of e.recipes) expect(ids.has(r)).toBe(true);
    }
    const names = itemNames(g);
    for (const id of itemIds(g)) expect(names.has(id)).toBe(true);
    expect(g.entries.length).toBeGreaterThanOrEqual(40);
  });
  test("a number is the config's text: units, percentages, durations with in-game days", () => {
    const v = valueTexts(mockGuide());
    expect(v.get("thresholds.nether.rift.stable-after")).toBe("1 hour (3 in-game days)");
    expect(v.get("thresholds.nether.rift.throw-radius")).toBe("300 blocks");
    expect(v.get("thresholds.end.stronghold.distance")).toBe("128 chunks");
    expect(v.get("thresholds.end.void-weighted.share")).toBe("25 %");
    expect(v.get("thresholds.nether.heat.damage")).toBe("0.5 hearts");
    expect(v.get("thresholds.end.shockwave.interval-max")).toBe("1 minute 30 seconds");
    expect(v.get("prep.duration")).toBe("3 days");
    expect(valueText("thresholds.end.arrival.min-distance", 1)).toBe("1 block");
  });
  test("the guide's numbers all come from the one defaults table", () => {
    const g = mockGuide();
    for (const val of g.values) if (!val.key.startsWith("onesoul.")) expect(val.key in DEFAULTS).toBe(true);
  });
  test("the void-weighted recipe's shard count is the configured number", () => {
    expect(recipes(5).find((r) => r.id === "void-weighted")!.slots[1].count).toBe(5);
    expect(mockGuide().recipes.find((r) => r.id === "void-weighted")!.slots[1].count).toBe(DEFAULTS["thresholds.end.void-weighted.shards"] as number);
  });
});

describe("the client", () => {
  test("both scenarios carry a guide", async () => {
    for (const s of ["fresh", "busy"] as const) {
      const c = createOneSoulClient(coreOf(structuredClone(worldOf(s))));
      expect(await c.enabled("guide")).toBe(true);
      const r = await c.guide("onesoul");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.entries.length).toBeGreaterThan(30);
    }
  });
  test("a proxy without the route answers off, and the group is off", async () => {
    const w = busy();
    w.onesoul!.features.guide = false;
    const c = createOneSoulClient(coreOf(w));
    expect(await c.enabled("guide")).toBe(false);
    const r = await c.guide();
    expect(r.ok ? "ok" : r.kind).toBe("off");
  });
  test("cakeutils down: the last good guide is served stale, with its own time", async () => {
    let t = T0;
    let up = true;
    const w = busy();
    const core = createCore({
      baseUrl: "http://mock.invalid",
      token: "cu_mock_mock",
      log: () => undefined,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
      fetchImpl: async (input, init) => {
        if (!up) throw new TypeError("fetch failed");
        return handleMock(w, new Request(input, init));
      }
    });
    const c = createOneSoulClient(core, () => "page", () => t);
    const a = await c.guide("onesoul");
    expect(a.ok && !a.stale).toBe(true);
    up = false;
    t += 10 * 60_000;
    const b = await c.guide("onesoul");
    expect(b.ok && b.stale).toBe(true);
    expect(b.ok && b.asOf).toBe(T0);
    expect(b.ok && b.data.entries.length).toBe(a.ok ? a.data.entries.length : -1);
  });
  test("a body that is not a guide is down, never a throw", async () => {
    const core = createCore({
      baseUrl: "http://mock.invalid",
      token: "cu_mock_mock",
      log: () => undefined,
      fetchImpl: async () => new Response("[1,2]", { status: 200, headers: { "content-type": "application/json", "cache-control": "max-age=5" } })
    });
    const r = await createOneSoulClient(core).guide();
    expect(r.ok ? "ok" : r.kind).toBe("down");
  });
});

describe("item pictures", () => {
  test("One Soul's own items are the bundled textures, and the files exist", () => {
    for (const id of ["onesoul:void_anchor", "onesoul:void_shard", "onesoul:gravestone"]) {
      const src = ownIcon(id)!;
      expect(src).toMatch(/^\/mc\/onesoul\/[a-z_]+\.png$/);
      expect(existsSync(`static${src}`)).toBe(true);
    }
    expect(ownIcon("onesoul:../../etc")).toBeNull();
    expect(ownIcon("minecraft:void_anchor")).toBeNull();
  });
  test("other items are looked up in the catalogue; an item with no picture has none, an unknown One Soul item is not asked for", async () => {
    const asked: string[] = [];
    const reader = {
      subject: async (key: string) => {
        asked.push(key);
        return key === "minecraft:obsidian"
          ? { ok: true as const, asOf: 0, stale: false, empty: false, data: { names: [{ key, kind: "block", name: "Obsidian", unit: "count", icon: `/v2/icons/${"b".repeat(64)}.png` }] } }
          : { ok: false as const, kind: "not_found" as const };
      }
    };
    const icons = await guideIcons(mockGuide(), reader as never);
    expect(icons["onesoul:void_anchor"]).toBe("/mc/onesoul/void_anchor.png");
    expect(icons["minecraft:obsidian"]).toBe(`/img/icon/${"b".repeat(64)}.png`);
    expect(asked.some((k) => k.startsWith("onesoul:"))).toBe(false);
    for (const v of Object.values(icons)) expect(v).toMatch(/^\/(img|mc)\//);
  });
});

describe("the Nether and End events", () => {
  const ev = (kind: string, data: Record<string, unknown> = {}, name: string | null = "Tara"): OsEvent => ({ at: T0, kind, uuid: name ? "u" : null, name, data, cycle: 1, server: "onesoul" });
  test("a sentence for each, and no place in any of them", () => {
    const rows = [ev("rift_stable", { first: true, dim: "minecraft:overworld", x: 12, y: 64, z: -9 }), ev("rift_stable", {}, null), ev("nether_entered"), ev("end_opened", { first: true, x: 5, y: 5, z: 5 }), ev("end_opened"), ev("end_entered"), ev("torch_passed")];
    const lines = rows.map((e) => eventLine(e).text);
    expect(lines).toEqual([
      "steadied the round's first Nether portal",
      "A Nether portal became stable",
      "was the first into the Nether this round",
      "opened the round's first End portal",
      "opened an End portal",
      "was the first into the End this round",
      "passed the torch"
    ]);
    for (const l of lines) expect(l).not.toMatch(/-?\d{2,}|x:|minecraft:/);
    expect(eventHasActor(rows[0])).toBe(true);
    expect(eventHasActor(rows[1])).toBe(false);
  });
  test("Borrowed Time's new fields: the choice and a burn from the grave", () => {
    expect(eventLine(ev("second_chance", { choice: "borrowed" })).text).toBe("chose borrowed time");
    expect(eventLine(ev("second_chance", {})).text).toBe("is on borrowed time");
    expect(eventLine(ev("offering", { item: "minecraft:diamond", source: "grave", items: 3, added_ms: 600_000 })).text).toBe("burned 3 × Diamond from their grave for 10m");
    expect(eventLine(ev("offering", { item: "minecraft:diamond" })).text).toBe("burned Diamond");
  });
  test("hostile text stays text: a player's name never goes into a sentence", () => {
    const l = eventLine(ev("torch_passed", {}, "<img src=x onerror=alert(1)>"));
    expect(l.text).toBe("passed the torch");
    expect(l.quote).toBeNull();
  });
  test("the mock gives a running round no portal position, and a finished round its own", async () => {
    const c = createOneSoulClient(coreOf(busy()));
    const r1 = await c.events({ server: "onesoul", cycle: 1, kind: "rift_stable,end_opened", limit: 50 });
    const r2 = await c.events({ server: "onesoul", cycle: 2, kind: "rift_stable,end_opened", limit: 50 });
    if (!r1.ok || !r2.ok) throw new Error("events failed");
    expect(r1.data.events.length).toBe(3);
    expect(r1.data.events.every((e) => "x" in e.data && "dim" in e.data)).toBe(true);
    expect(r2.data.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(r2.data)).not.toMatch(/"(x|y|z|dim)"/);
    // `first` is only ever true, and only the round's first portal carries it
    for (const e of r2.data.events) expect(e.data.first === undefined || e.data.first === true).toBe(true);
  });
  test("a proxy that leaks a running round's portal position is corrected by the client", async () => {
    const w = busy();
    const leaky = async (input: string | URL | Request, init?: RequestInit) => {
      const res = await handleMock(w, new Request(input, init));
      const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (u.pathname !== "/v2/onesoul/events") return res;
      const body = (await res.json()) as EventList;
      for (const e of body.events) if (e.kind === "rift_stable" || e.kind === "end_opened") e.data = { ...e.data, dim: "minecraft:overworld", x: 96, y: 70, z: -60 };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "cache-control": "max-age=5" } });
    };
    const c = createOneSoulClient(createCore({ baseUrl: "http://mock.invalid", token: "cu_mock_mock", fetchImpl: leaky, log: () => undefined }));
    const running = await c.events({ server: "onesoul", cycle: 2, kind: "rift_stable", limit: 50 });
    const over = await c.events({ server: "onesoul", cycle: 1, kind: "rift_stable", limit: 50 });
    if (!running.ok || !over.ok) throw new Error("events failed");
    expect(running.data.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(running.data)).not.toMatch(/"(x|y|z|dim)"/);
    expect(over.data.events.every((e) => "x" in e.data)).toBe(true);
  });
  test("withoutRunningPortalPlaces leaves every other kind and every other field alone", () => {
    const l: EventList = {
      total: 2,
      events: [ev("rift_stable", { first: true, x: 1, y: 2, z: 3, dim: "d", turn: 4 }), ev("death", { x: 1, y: 2, z: 3, dim: "d", final: true })]
    };
    expect(hasPortalPlace(l)).toBe(true);
    const out = withoutRunningPortalPlaces(l, () => false);
    expect(out.events[0].data).toEqual({ first: true, turn: 4 });
    expect(out.events[1].data).toEqual({ x: 1, y: 2, z: 3, dim: "d", final: true });
    expect(withoutRunningPortalPlaces(l, () => true)).toEqual(l);
  });
});
