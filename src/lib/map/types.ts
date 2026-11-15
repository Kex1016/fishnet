// Frozen props of the live map's parts (FM-0; brief §5, §5.1, §6). Pure types: safe to import anywhere.
// FM-3 builds MapCanvas, FM-5 the layers, FM-8 ShowOnMap, FM-2 the live events; a unit that needs a
// change here asks the map coordinator. Coordinates are whole blocks: x east, z south, as in the game.
//
// Leaflet's frame (brief §2, MAP §5.2): L.CRS.Simple, block (x, z) at L.latLng(-z·s, x·s) with
// s = 1 / 2^zoom.max; tile (z, x, y) covers blocks [x·S, (x+1)·S) × [y·S, (y+1)·S), S = 512 · 2^(zoom.max − z);
// tileSize 512, maxNativeZoom zoom.max, maxZoom zoom.max + zoom.extra.
import type { Mark, Path } from "#lib/onesoul/map.ts";
import type { MapLink, MapView } from "./links.ts";

export type { MapLink, MapView };

export type Block = { x: number; z: number };

/** Zoom levels of a world, as cakeutils gives them (squaremap's defaults: max 3, default 3, extra 2). */
export type Zoom = { min: number; max: number; default: number; extra: number };

/** Where a world's tiles come from (the site's own routes, never cakeutils). */
export type TileSource = {
  /** `/map/t/<server>/<world>/{z}/{x}_{y}.png` (links.ts tileTemplate / roundTileTemplate) */
  template: string;
  /**
   * The change log's epoch when the world has one: tile URLs then carry `?v=<epoch>.<seq>` (links.ts
   * tileVersion) and are immutable in the browser. null = no log: no `?v=`, the browser revalidates.
   */
  epoch: string | null;
  /** seq of each tile the log names at load, keyed "z/x/y"; a tile not listed is seq 0 */
  versions: Record<string, number>;
  /** a finished round's tiles: never reloaded, no live events */
  frozen: boolean;
};

/** One world, ready to draw. Built on the server from MapIndex + MapWorld (or a round's RoundMapWorld). */
export type MapWorldView = {
  server: string;
  /** squaremap's web name, minecraft_overworld */
  id: string;
  /** plain text: render escaped */
  name: string;
  /** minecraft:the_nether, null when unknown */
  dimension: string | null;
  order: number;
  /** null for a live world; the cycle for a finished One Soul round */
  cycle: number | null;
  tileSize: 512;
  zoom: Zoom;
  spawn: Block;
  tiles: TileSource;
  /** epoch ms the world's settings were written (MapWorld.updated_at) */
  updatedAt: number;
};

/** A player dot: what the live hub sends (positions rounded to whole blocks, hidden players already gone). */
export type PlayerDot = {
  /** dashed lower case */
  uuid: string;
  /** plain text */
  name: string;
  world: string;
  x: number;
  z: number;
  /** degrees as Minecraft gives them: 0 = south (+z), 90 = west */
  yaw: number;
};

/** The shapes a layer draws with (never colour alone, brief §5). */
export type LayerShape = "line" | "circle" | "square" | "diamond" | "triangle" | "cross";

/**
 * A data layer's content for one world (brief §6): marks and paths in block coordinates, reusing the One Soul
 * map's shapes (`dim` there is the dimension id; a layer only hands MapCanvas the ones of the world shown).
 */
export type LayerData = { marks: Mark[]; paths: Path[] };

/** A layer as the side panel and MapCanvas see it. */
export type MapLayer = {
  id: string;
  /** sentence case: "Trails", "Graves" */
  label: string;
  shape: LayerShape;
  /** shown now (the toggle's state) */
  on: boolean;
  data: LayerData;
};

/** Props of src/lib/map/MapCanvas.svelte (FM-3). Leaflet mounts on the client; the server renders a still frame. */
export type MapCanvasProps = {
  world: MapWorldView;
  /** dots on this world (others are ignored); empty when nobody is online or positions are off */
  players: PlayerDot[];
  /** glide duration of a dot between two updates, ms (the hub's poll interval); reduced motion jumps */
  glideMs: number;
  /** the view to open at; missing parts default to the world's spawn and zoom.default */
  view?: Partial<Omit<MapView, "world">>;
  /** follow this uuid: the view stays centred on them until the visitor drags or presses the toggle */
  follow?: string | null;
  layers?: MapLayer[];
  /** accessible name of the map region, e.g. "Map of Survival, Overworld" */
  label: string;
  /** after every move or zoom (share links: links.ts mapHref) */
  onview?: (view: MapView) => void;
  /** follow mode turned on or off (null) by the visitor or because the player left */
  onfollow?: (uuid: string | null) => void;
  /** a dot was picked (the side panel opens the player's entry) */
  onpick?: (uuid: string) => void;
};

/** Why "Show on map" is disabled (brief §5.1), each shown as the button's visible hint. */
export type ShowOnMapReason = "offline" | "no_map" | "positions_off";

/** Props of src/lib/map/ShowOnMap.svelte (FM-8). Not rendered at all for a hidden player. */
export type ShowOnMapProps = {
  uuid: string;
  /** plain text, for the accessible name */
  name: string;
  /** `/map/<server>?follow=<uuid>` when enabled (links.ts mapHref), else null */
  href: string | null;
  /** null when enabled */
  reason: ShowOnMapReason | null;
  /** with JS, re-check this server's players.json when the button scrolls into view (links.ts playersJsonHref) */
  server: string | null;
};

export const SHOW_ON_MAP_HINTS: Record<ShowOnMapReason, string> = {
  offline: "Offline",
  no_map: "This server has no map",
  positions_off: "Live positions are off"
};

// ---- live events (brief §4.3): the SSE stream's `data:` JSON per event name, and players.json

/** `event: players`: a full snapshot on connect, then only what changed. */
export type PlayersEvent = { at: number; players: PlayerDot[]; gone: string[] };
/** `event: tiles`: [ver, z, x, y] rows; `reset` = reload every visible tile (new epoch or the log dropped past us). */
export type TilesEvent = { world: string; epoch: string; tiles: [string, number, number, number][]; reset: boolean };
/** `event: status` */
export type LiveState = "live" | "stale" | "offline";
export type StatusEvent = { state: LiveState; as_of: number | null };
/** GET /map/<server>/players.json: the hub's last snapshot. */
export type PlayersSnapshot = { server: string; at: number; state: LiveState; players: PlayerDot[] };
