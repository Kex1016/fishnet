import { afterEach, expect, test } from "bun:test";
import { cleanName, cleanTypeName, milestonePhrase, nthOf, ordinal, setLabelOverrides, statTitle, subjectLabel, typeLabel } from "#lib/format/labels.ts";

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

test("milestones are sentences about the first player", () => {
  const p = milestonePhrase({ type: "minecraft:picked_up", subject: "minecraft:pufferfish", subjectName: "Pufferfish" }, "10", 10, "Username");
  expect(p.text).toBe("Username picked up Pufferfish for the 10th time!");
  expect(p.hasPlayer).toBe(true);
  expect(p.parts.map((x) => x.kind)).toEqual(["player", "text", "subject", "text", "number", "text"]);
  const swum = { type: "minecraft:custom", subject: "minecraft:swim_one_cm", subjectName: "Distance Swum", unit: "distance_cm" };
  expect(milestonePhrase(swum, "1.00 km", 100_000, "Username").text).toBe("1st km swum by Username!");
  expect(milestonePhrase(swum, "500.0 m", 50_000, null).text).toBe("500th m swum by Someone!");
  expect(milestonePhrase({ type: "minecraft:killed_by", subject: "minecraft:zombie", subjectName: "Zombie" }, "1", 1, "Roach").text).toBe("Roach was killed by Zombie for the 1st time!");
  expect(milestonePhrase({ type: "minecraft:mined", subject: "*" }, "10000", 10_000, "Roach").text).toBe("Roach mined their 10 000th block!");
  expect(milestonePhrase({ type: "minecraft:custom", subject: "minecraft:jump", subjectName: "Jumps" }, "1000", 1000, "Roach").text).toBe("Roach jumped for the 1 000th time!");
  expect(milestonePhrase({ type: "minecraft:custom", subject: "minecraft:boat_one_cm", subjectName: "Distance by Boat", unit: "distance_cm" }, "10.00 km", 1_000_000, "Roach").text).toBe("10th km travelled by boat by Roach!");
  expect(milestonePhrase({ type: "create:pressed", subject: "minecraft:iron_ingot", typeName: "Times Pressed", subjectName: "Iron Ingot" }, "112", 112, "Roach").text).toBe("Roach pressed Iron Ingot for the 112th time!");
});

test("ordinals", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 1000].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th", "1 000th"]);
  expect(nthOf(250, "distance_cm", "2.5 m")).toBe("2.5 m");
  expect(nthOf(50, "damage_tenths", "5.0 ♥")).toBe("5.0 ♥");
});

test("overrides win, by type and by stat", () => {
  setLabelOverrides({ types: { "minecraft:killed": { label: "Slain", phrase: "Slew {n} {subject}" } }, stats: { "killed:minecraft:pufferfish": { title: "Puffers popped", phrase: "{player} popped their {nth} puffer." } } });
  expect(typeLabel("minecraft:killed", "You killed %s %s")).toBe("Slain");
  // an older phrase without {player}: still a sentence, the page shows the player beside it
  const old = milestonePhrase({ type: "minecraft:killed", subject: "minecraft:cod", subjectName: "Cod" }, "5", 5, "Roach");
  expect(old.text).toBe("Slew 5 Cod!");
  expect(old.hasPlayer).toBe(false);
  expect(milestonePhrase({ type: "minecraft:killed", subject: "minecraft:pufferfish" }, "10", 10, "Roach").text).toBe("Roach popped their 10th puffer.");
  expect(statTitle({ type: "minecraft:killed", subject: "minecraft:pufferfish" })).toBe("Puffers popped");
  setLabelOverrides({ types: { "create:pressed": { label: "Squashed" } } });
  expect(statTitle({ type: "create:pressed", subject: "minecraft:iron_ingot", subjectName: "Iron Ingot" })).toBe("Iron Ingot squashed");
  expect(milestonePhrase({ type: "minecraft:picked_up", subject: "minecraft:cod", subjectName: "{n} Cod" }, "5", 5, "{player}").text).toBe("{player} picked up {n} Cod for the 5th time!");
});
