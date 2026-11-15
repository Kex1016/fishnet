// FM-8: what the "Show on map" button does for each kind of player.
import { describe, expect, test } from "bun:test";
import { followText, showOnMap, type ShowOnMapInput } from "../src/lib/map/showOnMap.ts";

const U = "11111111-2222-4333-8444-555555555555";
const maps = [
  { server: "survival", display_name: "Survival", live_players: true },
  { server: "creative", display_name: "Creative", live_players: false }
];
const base: ShowOnMapInput = { uuid: U, name: "Gill", online: true, server: "survival", maps };

describe("showOnMap", () => {
  test("online on a server with positions: a link that follows them", () => {
    expect(showOnMap(base)).toEqual({ kind: "link", href: `/map/survival?follow=${U}`, server: "survival" });
  });
  test("offline, between servers, no map, positions off: disabled with a reason each", () => {
    expect(showOnMap({ ...base, online: false })).toEqual({ kind: "disabled", reason: "Gill is offline." });
    expect(showOnMap({ ...base, server: null })).toMatchObject({ kind: "disabled", reason: expect.stringContaining("between servers") });
    expect(showOnMap({ ...base, server: "lobby", serverNames: { lobby: "Lobby" } })).toEqual({ kind: "disabled", reason: "Lobby has no map." });
    expect(showOnMap({ ...base, server: "creative" })).toEqual({ kind: "disabled", reason: "Live positions are off on Creative." });
  });
  test("map unreadable: disabled; map off on this site: no button", () => {
    expect(showOnMap({ ...base, maps: null })?.kind).toBe("disabled");
    expect(showOnMap({ ...base, maps: null, mapOff: true })).toBeNull();
  });
  test("server ids in the link are encoded", () => {
    const r = showOnMap({ ...base, server: "a b", maps: [{ server: "a b", display_name: "A", live_players: true }] });
    expect(r).toMatchObject({ kind: "link", href: `/map/a%20b?follow=${U}` });
  });
});

describe("followText", () => {
  test("each reason reads as plain text", () => {
    expect(followText({ name: "Gill", elsewhere: null, reason: "offline" })).toContain("offline");
    expect(followText({ name: "Gill", elsewhere: { server: "s", name: "Survival", href: "/x" }, reason: "elsewhere" })).toContain("on Survival");
    expect(followText({ name: "Gill", elsewhere: null, reason: "positions_off" })).toContain("positions are off");
    expect(followText({ name: "Gill", elsewhere: null, reason: "not_visible" })).toContain("not on this map");
  });
});
