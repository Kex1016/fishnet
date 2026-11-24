// Pictures for milestone, advancement and firsts rows: which catalogue key pictures a row, in what order,
// and how the rows come back. The catalogue is a fake here (pictures.ts takes its reader as an argument).
import { describe, expect, test } from "bun:test";
import { fail, ok, type Result } from "#lib/api/result.ts";
import type { AdvancementRow, MilestoneFeedRow, SubjectDetail } from "#lib/api/types.ts";
import type { First, FirstsFeed } from "#lib/network/types.ts";
import { ADVANCEMENT_ICONS } from "#lib/milestones/advancement-icons.ts";
import { advancementIcon, advancementIconItem, firstSubjects, subjectPictures, withAdvancementIcons, withFirstPictures, withIcons } from "#lib/milestones/pictures.ts";

type Name = { kind: string; icon: string | null };
function catalogue(entries: Record<string, Name[]>) {
  const asked: string[] = [];
  const subject = async (key: string): Promise<Result<SubjectDetail>> => {
    asked.push(key);
    const names = entries[key];
    if (!names) return fail("not_found", { status: 404 });
    return ok({ key, names: names.map((n) => ({ key, kind: n.kind, name: key, unit: null, icon: n.icon })), types: [] } as unknown as SubjectDetail);
  };
  return { subject, asked };
}

const first = (kind: string, detail: Record<string, unknown> | null, extra: Partial<First> = {}): First => ({ uuid: "u", name: "Ann", kind, at: 1, server: null, title: "t", detail, ...extra });
const feed = (firsts: First[]): Result<FirstsFeed> => ok({ scope: "network", total: firsts.length, firsts });

describe("the advancement icon table", () => {
  test("vanilla advancements name an item; anything else has none", () => {
    expect(advancementIconItem("minecraft:story/mine_diamond")).toBe("minecraft:diamond");
    expect(advancementIconItem("story/mine_diamond")).toBe("minecraft:diamond"); // the API's short form
    expect(advancementIconItem("somemod:tech/first_machine")).toBeNull();
    for (const [id, item] of Object.entries(ADVANCEMENT_ICONS)) {
      expect(id).toMatch(/^minecraft:[a-z_]+\/[a-z0-9_/]+$/);
      expect(item).toMatch(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/);
    }
  });
});

describe("catalogue lookups", () => {
  test("one read per distinct key, capped; free-form names are never asked for", async () => {
    const c = catalogue({ "minecraft:stone": [{ kind: "block", icon: "aa" }] });
    const found = await subjectPictures(c, ["minecraft:stone", "minecraft:stone", "has_compass", "minecraft:dirt", "minecraft:sand"], { max: 2 });
    expect(c.asked.sort()).toEqual(["minecraft:dirt", "minecraft:stone"]);
    expect([...found]).toEqual([["minecraft:stone", { icon: "aa", kind: "block" }]]);
  });

  test("a key that is an item and a mob: the item for things, the first icon otherwise", async () => {
    const cod = { "minecraft:cod": [{ kind: "entity", icon: "egg" }, { kind: "item", icon: "fish" }] };
    expect((await subjectPictures(catalogue(cod), ["minecraft:cod"], { things: true })).get("minecraft:cod")).toEqual({ icon: "fish", kind: "item" });
    expect((await subjectPictures(catalogue(cod), ["minecraft:cod"])).get("minecraft:cod")).toEqual({ icon: "egg", kind: "entity" });
  });
});

describe("milestone and advancement rows", () => {
  test("a milestone row takes its subject's icon; a type total and an unknown subject keep none", async () => {
    const c = catalogue({ "minecraft:stone": [{ kind: "block", icon: "aa" }] });
    const rows = [{ subject: "minecraft:stone" }, { subject: "*" }, { subject: "minecraft:new_thing" }] as MilestoneFeedRow[];
    const r = await withIcons(c, ok({ milestones: rows, total: 3 }));
    expect(r.ok && r.data.milestones.map((m) => (m as { icon?: string }).icon ?? null)).toEqual(["aa", null, null]);
    expect(c.asked).not.toContain("*");
    const down = fail("down");
    expect(await withIcons(c, down)).toBe(down);
  });

  test("an advancement row takes the icon of the item the game shows for it", async () => {
    const c = catalogue({ "minecraft:diamond": [{ kind: "item", icon: "dd" }] });
    const rows = [{ advancement: "minecraft:story/mine_diamond" }, { advancement: "somemod:tech/first_machine" }] as AdvancementRow[];
    const r = await withAdvancementIcons(c, ok({ milestones: rows, total: 2 }));
    expect(r.ok && r.data.milestones.map((m) => m.icon)).toEqual(["dd", null]);
    expect(c.asked).toEqual(["minecraft:diamond"]);
    expect(await advancementIcon(c, "minecraft:story/mine_diamond")).toBe("dd");
    expect(await advancementIcon(c, "somemod:tech/first_machine")).toBeNull();
  });
});

describe("firsts", () => {
  test("what pictures each kind, best first", () => {
    expect(firstSubjects(first("stat", { subject: "minecraft:zombie" }))).toEqual([{ key: "minecraft:zombie", thing: false }]);
    expect(firstSubjects(first("stat", { subject: "*" }))).toEqual([]);
    expect(firstSubjects(first("item", { item: "minecraft:elytra", via: "picked_up" }))).toEqual([{ key: "minecraft:elytra", thing: true }]);
    expect(firstSubjects(first("advancement", { advancement: "minecraft:story/mine_diamond" }))).toEqual([{ key: "minecraft:diamond", thing: true }]);
    // a criterion: the thing it names (vanilla writes some without the namespace), then its advancement's item
    expect(firstSubjects(first("criterion", { advancement: "minecraft:husbandry/balanced_diet", criterion: "apple" }))).toEqual([
      { key: "minecraft:apple", thing: false },
      { key: advancementIconItem("minecraft:husbandry/balanced_diet")!, thing: true }
    ]);
    expect(firstSubjects(first("criterion", { advancement: "somemod:a/b", criterion: "Has Compass" }))).toEqual([]);
    expect(firstSubjects(first("dimension", { dimension: "minecraft:the_nether" }))).toEqual([{ key: "minecraft:netherrack", thing: true }]);
    expect(firstSubjects(first("dimension", { dimension: "somemod:moon" }))).toEqual([]);
    expect(firstSubjects(first("playtime", { threshold_ms: 1 }))).toEqual([{ key: "minecraft:clock", thing: true }]);
    expect(firstSubjects(first("biome", { biome: "minecraft:plains" }))).toEqual([]);
    expect(firstSubjects(first("something_new", null))).toEqual([]);
  });

  test("rows get the first choice that has an icon, else the site's own picture", async () => {
    const c = catalogue({
      "minecraft:zombie": [{ kind: "entity", icon: "zz" }],
      "minecraft:clock": [{ kind: "item", icon: "cc" }],
      [advancementIconItem("minecraft:adventure/adventuring_time")!]: [{ kind: "item", icon: "boots" }]
    });
    const rows = [
      first("stat", { subject: "minecraft:zombie" }),
      first("playtime", { threshold_ms: 1 }),
      // minecraft:plains is a biome: the catalogue has no icon for it, the advancement's item is the picture
      first("criterion", { advancement: "minecraft:adventure/adventuring_time", criterion: "minecraft:plains" }),
      first("biome", { biome: "minecraft:plains" })
    ];
    const r = await withFirstPictures(c, feed(rows));
    expect(r.ok && r.data.firsts.map((f) => [f.icon ?? null, f.iconKind ?? null])).toEqual([["zz", "entity"], ["cc", "item"], ["boots", "item"], ["/mc/icons/grass_block.png", null]]);
    expect(r.ok && r.data.total).toBe(4);
  });

  test("first choices are read before second choices when the page is over the cap", async () => {
    const c = catalogue({});
    const rows = [
      first("criterion", { advancement: "minecraft:husbandry/balanced_diet", criterion: "apple" }),
      first("item", { item: "minecraft:elytra" })
    ];
    const r = await withFirstPictures(c, feed(rows), 2);
    expect(c.asked.sort()).toEqual(["minecraft:apple", "minecraft:elytra"]);
    // nothing in the catalogue: the site's own pictures of the apple and the elytra
    expect(r.ok && r.data.firsts.map((f) => f.icon)).toEqual(["/mc/icons/apple.png", "/mc/icons/elytra.png"]);
    const none = [first("criterion", { advancement: "somemod:a/b", criterion: "Has Compass" })];
    expect((await withFirstPictures(c, feed(none))).ok && (await withFirstPictures(c, feed(none)))).toMatchObject({ data: { firsts: none } });
  });
});
