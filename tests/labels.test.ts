import { afterEach, expect, test } from "bun:test";
import { cleanName, cleanTypeName, milestonePhrase, setLabelOverrides, statTitle, subjectLabel, typeLabel } from "#lib/format/labels.ts";

afterEach(() => setLabelOverrides({}));

test("vanilla type names never show their templates", () => {
  expect(typeLabel("minecraft:killed", "You killed %s %s")).toBe("Killed");
  expect(typeLabel("minecraft:killed_by", "%s killed you %s time(s)")).toBe("Killed by");
  expect(typeLabel("minecraft:mined", "Times Mined")).toBe("Mined");
  expect(typeLabel("minecraft:picked_up", "Picked Up")).toBe("Picked up");
  expect(typeLabel("minecraft:custom", "Custom")).toBe("General");
});

test("modded type names are cleaned, or fall back to the key", () => {
  expect(cleanTypeName("Times Pressed")).toBe("Pressed");
  expect(cleanTypeName("You smelted %1$s %2$s time(s)")).toBe("Smelted");
  expect(typeLabel("create:pressed", "Times Pressed")).toBe("Pressed");
  expect(typeLabel("create:pressed", null)).toBe("Pressed");
  expect(typeLabel("mymod:fed_to", "%s %s")).toBe("Fed to");
});

test("subject names lose placeholders", () => {
  expect(cleanName("Kills on %s")).toBe("Kills on");
  expect(subjectLabel("%s", "minecraft:cod")).toBe("Cod");
  expect(subjectLabel(null, "minecraft:diamond_ore")).toBe("Diamond Ore");
});

test("titles say what happened", () => {
  expect(statTitle({ type: "minecraft:killed", subject: "minecraft:pufferfish", subjectName: "Pufferfish" })).toBe("Pufferfish killed");
  expect(statTitle({ type: "minecraft:killed_by", subject: "minecraft:zombie", subjectName: "Zombie" })).toBe("Killed by Zombie");
  expect(statTitle({ type: "minecraft:mined", subject: "*" })).toBe("Blocks mined");
  expect(statTitle({ type: "minecraft:killed_by", subject: "*" })).toBe("Killed by mobs");
  expect(statTitle({ type: "minecraft:custom", subject: "minecraft:jump", subjectName: "Jumps" })).toBe("Jumps");
  expect(statTitle({ type: "create:pressed", subject: "minecraft:iron_ingot", typeName: "Times Pressed", subjectName: "Iron Ingot" })).toBe("Iron Ingot pressed");
  expect(statTitle({ type: "create:pressed", subject: "*", kind: "item" })).toBe("Items pressed");
});

test("milestones put the number inside the sentence", () => {
  const p = milestonePhrase({ type: "minecraft:killed", subject: "minecraft:pufferfish", subjectName: "Pufferfish" }, "1000", 1000);
  expect(p).toEqual({ before: "Killed ", value: "1000", after: " Pufferfish", text: "Killed 1000 Pufferfish" });
  expect(milestonePhrase({ type: "minecraft:killed_by", subject: "minecraft:zombie", subjectName: "Zombie" }, "50", 50).text).toBe("Killed by Zombie 50 times");
  expect(milestonePhrase({ type: "minecraft:used", subject: "minecraft:bow", subjectName: "Bow" }, "1", 1).text).toBe("Used Bow 1 time");
  expect(milestonePhrase({ type: "minecraft:custom", subject: "minecraft:walk_one_cm", subjectName: "Distance Walked" }, "10.00 km").text).toBe("Distance Walked: 10.00 km");
  expect(milestonePhrase({ type: "minecraft:mined", subject: "*" }, "10000").text).toBe("Mined 10000 blocks");
});

test("overrides win, by type and by stat", () => {
  setLabelOverrides({ types: { "minecraft:killed": { label: "Slain", phrase: "Slew {n} {subject}" } }, stats: { "killed:minecraft:pufferfish": { title: "Puffers popped" } } });
  expect(typeLabel("minecraft:killed", "You killed %s %s")).toBe("Slain");
  expect(milestonePhrase({ type: "minecraft:killed", subject: "minecraft:cod", subjectName: "Cod" }, "5", 5).text).toBe("Slew 5 Cod");
  expect(statTitle({ type: "minecraft:killed", subject: "minecraft:pufferfish" })).toBe("Puffers popped");
  setLabelOverrides({ types: { "create:pressed": { label: "Squashed" } } });
  expect(statTitle({ type: "create:pressed", subject: "minecraft:iron_ingot", subjectName: "Iron Ingot" })).toBe("Iron Ingot squashed");
  expect(milestonePhrase({ type: "minecraft:killed", subject: "minecraft:cod", subjectName: "{n} Cod" }, "5", 5).text).toBe("Killed 5 {n} Cod");
});
