// The words around a marker (FMK-2), pure so the popup, the Places list, the pins' and areas' accessible names and the
// tests all say the same thing. Titles and subtitles themselves are never touched here: they are player text, passed
// through as typed (`<b>`, `&` and `§c` are literal characters) and only ever rendered as text.
import { coord } from "../crs.ts";
import type { MarkerView } from "./types.ts";

/** "31 × 18 blocks" */
export function sizeText(v: Pick<MarkerView, "size">): string {
  return `${v.size.w} × ${v.size.d} blocks`;
}

/** The accessible name of a marker: "Spawn, point" / "Spawn town, area, 31 × 18 blocks". */
export function markerName(v: Pick<MarkerView, "title" | "kind" | "size">): string {
  return v.kind === "point" ? `${v.title}, point` : `${v.title}, area, ${sizeText(v)}`;
}

/** The popup's kind line: "Point" / "Area, 31 × 18 blocks". */
export function kindText(v: Pick<MarkerView, "kind" | "size">): string {
  return v.kind === "point" ? "Point" : `Area, ${sizeText(v)}`;
}

/** Where it is, with real minus signs: a point's block "x 120, y 64, z −40", an area's extent "x 20 to 50, z −60 to −43". */
export function whereText(v: Pick<MarkerView, "point" | "bbox">): string {
  if (v.point) return `x ${coord(v.point.x)}, y ${coord(v.point.y)}, z ${coord(v.point.z)}`;
  const b = v.bbox;
  return `x ${coord(b.minX)} to ${coord(b.maxX - 1)}, z ${coord(b.minZ)} to ${coord(b.maxZ - 1)}`;
}
