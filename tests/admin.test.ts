import { describe, expect, test } from "bun:test";
import { csrfMatches, GLOBAL, LoginLimiter, MIN_TOKEN_LENGTH, PER_ADDRESS, SESSION_MS, Sessions, tokenMatches, WINDOW_MS } from "../src/lib/server/admin/auth.ts";
import { AdminStore, cleanStatKey, cleanText, cleanTypeKey } from "../src/lib/server/admin/overrides.ts";
import { addEntry, entries, removeEntry } from "../src/lib/server/admin/list-file.ts";

const TOKEN = "a".repeat(MIN_TOKEN_LENGTH) + "-secret";

describe("admin token", () => {
  test("matches only the exact token", () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches(TOKEN, TOKEN + "x")).toBe(false);
    expect(tokenMatches(TOKEN, TOKEN.slice(0, -1))).toBe(false);
    expect(tokenMatches(TOKEN, "")).toBe(false);
  });
  test("a short or empty configured token never matches", () => {
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches("short", "short")).toBe(false);
  });
});

describe("sessions", () => {
  test("expire after 12 hours", () => {
    let t = 1_000;
    const s = new Sessions(() => t);
    const a = s.create();
    expect(s.get(a.id)?.csrf).toBe(a.csrf);
    t += SESSION_MS - 1;
    expect(s.get(a.id)).not.toBeNull();
    t += 1;
    expect(s.get(a.id)).toBeNull();
  });
  test("ids are random and unknown ids are null", () => {
    const s = new Sessions();
    const a = s.create();
    const b = s.create();
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(43);
    expect(s.get("nope")).toBeNull();
    expect(s.get(undefined)).toBeNull();
    s.delete(a.id);
    expect(s.get(a.id)).toBeNull();
  });
  test("csrf must be the session's own", () => {
    const s = new Sessions();
    const a = s.create();
    const b = s.create();
    expect(csrfMatches(a, a.csrf)).toBe(true);
    expect(csrfMatches(a, b.csrf)).toBe(false);
    expect(csrfMatches(a, null)).toBe(false);
    expect(csrfMatches(a, "")).toBe(false);
  });
});

describe("login limiter", () => {
  test("blocks an address after five failures for ten minutes", () => {
    let t = 0;
    const l = new LoginLimiter(() => t);
    for (let i = 0; i < PER_ADDRESS; i++) {
      expect(l.blockedFor("1.2.3.4")).toBe(0);
      l.fail("1.2.3.4");
    }
    expect(l.blockedFor("1.2.3.4")).toBeGreaterThan(0);
    expect(l.blockedFor("5.6.7.8")).toBe(0);
    t += WINDOW_MS;
    expect(l.blockedFor("1.2.3.4")).toBe(0);
  });
  test("blocks everyone after twenty failures from anywhere", () => {
    const l = new LoginLimiter(() => 0);
    for (let i = 0; i < GLOBAL; i++) l.fail(`10.0.0.${i}`);
    expect(l.blockedFor("192.168.0.1")).toBeGreaterThan(0);
  });
  test("a success clears the address", () => {
    const l = new LoginLimiter(() => 0);
    for (let i = 0; i < PER_ADDRESS - 1; i++) l.fail("a");
    l.succeed("a");
    l.fail("a");
    expect(l.blockedFor("a")).toBe(0);
  });
});

describe("label overrides", () => {
  test("store, replace and clear", () => {
    const s = new AdminStore(":memory:");
    expect(s.overrides()).toEqual({ types: {}, stats: {} });
    s.set("type", "minecraft:killed", { label: "Killed", title: "{subject} killed", phrase: "" });
    s.set("stat", "killed:minecraft:pufferfish", { title: "Pufferfish killed", phrase: "Killed {n} pufferfish" });
    expect(s.overrides()).toEqual({
      types: { "minecraft:killed": { label: "Killed", title: "{subject} killed" } },
      stats: { "killed:minecraft:pufferfish": { title: "Pufferfish killed", phrase: "Killed {n} pufferfish" } }
    });
    s.set("stat", "killed:minecraft:pufferfish", { title: "", phrase: "" });
    expect(s.overrides().stats).toEqual({});
    s.audit("x");
    expect(s.recentAudit()[0].what).toBe("x");
    s.close();
  });
  test("keys are checked and normalised", () => {
    expect(cleanTypeKey("killed")).toBe("minecraft:killed");
    expect(cleanTypeKey("create:pressed")).toBe("create:pressed");
    expect(cleanTypeKey("bad key")).toBeNull();
    expect(cleanStatKey("killed:minecraft:pufferfish")).toBe("killed:minecraft:pufferfish");
    expect(cleanStatKey("minecraft:killed:minecraft:pufferfish")).toBe("killed:minecraft:pufferfish");
    expect(cleanStatKey("killed:*")).toBe("killed:*");
    expect(cleanStatKey("playtime")).toBeNull();
    expect(cleanStatKey("killed:<b>:x")).toBeNull();
  });
  test("text is one line, short, no control characters", () => {
    expect(cleanText("  Fish   caught ")).toEqual({ ok: true, value: "Fish caught" });
    expect(cleanText("a".repeat(81)).ok).toBe(false);
    expect(cleanText("a\u0007b").ok).toBe(false);
    expect(cleanText(undefined)).toEqual({ ok: true, value: "" });
  });
});

describe("list files", () => {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  test("adding keeps comments and skips duplicates", () => {
    const text = "# opted out\nSteve # asked 3 Nov\n";
    expect(addEntry(text, "Alex", same)).toBe("# opted out\nSteve # asked 3 Nov\nAlex\n");
    expect(addEntry(text, "steve", same)).toBe(text);
    expect(addEntry("Steve", "Alex", same)).toBe("Steve\nAlex\n");
    expect(addEntry("", "Alex", same)).toBe("Alex\n");
  });
  test("removing drops every matching line and keeps the rest", () => {
    const text = "# opted out\nSteve # asked\nAlex\nsteve\n";
    expect(removeEntry(text, "STEVE", same)).toBe("# opted out\nAlex\n");
    expect(entries(removeEntry(text, "nobody", same))).toEqual(["Steve", "Alex", "steve"]);
  });
});
