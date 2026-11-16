// Frozen props of the map markers (FMK-0; brief MAP-MARKERS-WEBSITE §2, §5; cakeutils v2/map/MARKERS.md §3, §4).
// Pure types: safe to import anywhere, server or browser. FMK-1 builds the label renderer, FMK-2 the layer, the
// Places popout and the marker popup, FMK-3 the live refresh; a unit that needs a change here asks the markers
// coordinator. Read-only: nothing here edits, creates or deletes a marker.
//
// Coordinates, once and for all (MARKERS §4): x east, z south, whole blocks. A BLOCK (x, z) is the square
// [x, x+1) × [z, z+1); a CORNER is a lattice point. Polygon vertices and boxes are in corners (an area of blocks
// 0..9 runs from corner 0 to corner 10): map them straight through `toLatLng(max, x, z)` (crs.ts). A point is the
// block itself, drawn at its centre `centreLatLng(max, point)`.
//
// Text is text: `title` and `subtitle` come from players and are raw (`<b>`, `&` and `§c` are literal characters).
// Render them as Svelte text nodes, `textContent` or glyph drawing; never `{@html}`, never `innerHTML`, never parsed.
import type { MapMarker, MapMarkerKind } from "#lib/api/types.ts";
import type { Uni } from "#lib/onesoul/book/layout.ts";
import type { Block } from "../types.ts";

export type { MapMarkerKind };

/** A corner of a block: a lattice point of the block grid. */
export type Corner = readonly [x: number, z: number];

/** Where an area's title goes: the point inside the shape farthest from any edge, `r` blocks from the nearest edge. */
export type MarkerLabelAnchor = { x: number; z: number; r: number };

/** A box in corners: `min` inclusive, `max` exclusive as blocks. A point's box is its block (x, z, x + 1, z + 1). */
export type MarkerBox = { minX: number; minZ: number; maxX: number; maxZ: number };

/**
 * What the layer draws: one marker, converted from cakeutils' `MapMarker` (view.ts `markerView`), snake_case gone.
 * Every field is always present; `null` only where marked.
 */
export type MarkerView = {
  /** never reused; the share link is `?marker=<id>` */
  id: number;
  /** `point` = a pin; `area` = a rectangle; `poly` = a block-grid polygon (a diagonal is already a zig-zag) */
  kind: MapMarkerKind;
  /** plain text, 1..64 characters, one line */
  title: string;
  /** plain text, up to 256 characters and 4 lines (`\n`), or null; shown with `white-space: pre-line` */
  subtitle: string | null;
  /** `#rrggbb`, lower case; always present. `colorAuto`: cakeutils made it up because the builder gave none (draw it the same) */
  color: string;
  colorAuto: boolean;
  /** kind `point`: the block (drawn at its centre, x + 0.5, z + 0.5) with its height for the popup ("x 120, y 64, z −40"); else null */
  point: (Block & { y: number }) | null;
  /** kinds `area` and `poly`: block corners, counter-clockwise as drawn (x right, z down), starting at the lowest-z then lowest-x corner; every edge axis-aligned, no holes; else null */
  polygon: Corner[] | null;
  /** kinds `area` and `poly`: where the title goes (MARKERS §4.4); else null */
  label: MarkerLabelAnchor | null;
  /** corners; a point's is its block */
  bbox: MarkerBox;
  /** the box's size in blocks: "31 × 18 blocks" for an area's popup and the Places list; 1 × 1 for a point */
  size: { w: number; d: number };
  /** epoch ms: "Updated 4 Nov 2026" (dates.ts, in the visitor's zone) */
  updatedAt: number;
  /** 1 at creation, +1 per change */
  revision: number;
};

/**
 * The in-area title for the current zoom (brief §5.2): `k` screen pixels per font pixel (a whole number keeps the font
 * crisp) and the lines to draw, one or two. `null` = no label at this zoom (the area's popup and the Places list
 * still name it). Computed by FMK-2's `fit.ts`, drawn by FMK-1's `McLabel`.
 */
export type LabelFit = { k: 1 | 2 | 3 | 4; lines: string[] };

/**
 * What the page and `markers.json` know about one world's markers. `state`:
 * - `ok`: `markers` is cakeutils' answer (empty = "No markers in this world yet"), `stale` when cakeutils is down and
 *   this is the last good answer, as of `asOf`;
 * - `none`: no markers can exist here (no map, a private mini-server, a standalone server, a hidden server, a bad id):
 *   draw nothing, show no error;
 * - `down`: cakeutils is unreachable and nothing good is kept: draw nothing, say so in the Places popout.
 */
export type MarkersLoad = {
  /** the map world id these markers belong to; null when the page has no world to show */
  world: string | null;
  state: "ok" | "none" | "down";
  /** the world's change counter (the ETag is `"m<rev>"`); 0 unless `ok` */
  rev: number;
  /** cakeutils' `MapMarker` rows as sent, ordered by id; empty unless `ok` */
  markers: MapMarker[];
  /** epoch ms of the answer; null unless `ok` */
  asOf: number | null;
  stale: boolean;
};

/**
 * Props of src/lib/map/markers/layer.ts (FMK-2): draws the markers of one world on MapCanvas' `mc-marks` pane. The
 * layer is not a Svelte component; MapCanvas creates it once its Leaflet map exists.
 */
export type MarkerLayerProps = {
  /** the world's `zoom.max`, for crs.ts (`toLatLng`, `pixelsPerBlock`) */
  max: number;
  /** the world's markers in the order cakeutils sent them (by id); the layer sorts for drawing */
  markers: MarkerView[];
  /** the "Markers" toggle in the layers popout; off removes everything from the map but keeps `markers` */
  on: boolean;
  /** the marker whose popup is open (`?marker=<id>`, a click, or a Places entry); null = none */
  selected: number | null;
  /** a pin or area was opened or the popup closed (null); the page keeps `?marker=` in step */
  onselect?: (id: number | null) => void;
  /** Unifont metrics for the titles outside the bitmap sheets (server `unifontFor`, FMK-2); missing = cell widths */
  uni?: Uni;
  /** the share link of a marker, for "Copy link" (`?marker=<id>`, links.ts `mapHref`) */
  href?: (id: number) => string;
};

/**
 * Props of src/lib/map/markers/PlacesPopout.svelte (FMK-2): the world's markers as a list, the accessible twin of the
 * drawing. Each entry is a button named like "Spawn town, area, 31 × 18 blocks"; arrow keys move, Enter centres the
 * map on the marker and opens its popup.
 */
export type PlacesPopoutProps = {
  markers: MarkerView[];
  /** `none` and `down` come from `MarkersLoad.state`; `ok` with no markers shows "No markers in this world yet" */
  state: MarkersLoad["state"];
  selected: number | null;
  /** epoch ms, shown as "as of <time> <zone>" with a Notice while `stale` */
  asOf: number | null;
  stale: boolean;
  /** plain text, for the popout's name ("Places in Overworld") */
  worldName: string;
  /** an entry was chosen: centre the map on it and open its popup */
  onpick: (id: number) => void;
  /** pages without JavaScript: the entries are the buttons of a GET form to `action` (the map page), so `?marker=<id>` opens one */
  form?: { action: string; world: string };
};

/** Props of src/lib/map/markers/MarkerPopup.svelte (FMK-2): title, subtitle, coordinates or size, "Updated", "Copy link". */
export type MarkerPopupProps = {
  marker: MarkerView;
  /** `?marker=<id>` on the current page (links.ts, `withParams`), for "Copy link" */
  href: string;
  /** Escape or the close button: focus returns to the pin or area */
  onclose: () => void;
};

/** What MapCanvas takes beside the frozen props (FMK-2): the markers to draw and the one whose popup is open. */
export type MapCanvasMarkers = Omit<MarkerLayerProps, "max"> & {
  /** a marker to centre on (its box) when the layer is first made: the deep link `?marker=<id>` without x and z */
  reveal?: number | null;
};
