// Draws the `layers` prop on the map (FM-3 gives the room; FM-5 owns the layers' data in src/lib/map/layers/).
// Marks and paths are raw block coordinates (One Soul's GeoJSON, #lib/onesoul/map.ts) and are drawn where they
// are (a layer hands over the ones of the world shown, types.ts); a layer's shape, never colour alone, tells its marks apart. Titles are player text: text nodes only.
import type * as Leaflet from "leaflet";
import { toLatLng } from "./crs.ts";
import type { MapLayer } from "./types.ts";

/** A same-site path, or null: a mark never links anywhere else. */
function localHref(href: string | null): string | null {
  return href && href.startsWith("/") && !href.startsWith("//") ? href : null;
}

export function drawLayers(L: typeof Leaflet, map: Leaflet.Map, group: Leaflet.LayerGroup, layers: MapLayer[], world: { max: number }): void {
  group.clearLayers();
  if (!map.getPane("mc-marks")) map.createPane("mc-marks");
  for (const layer of layers) {
    if (!layer.on) continue;
    for (const p of layer.data.paths) {
      const pts = p.points.filter(([x, z]) => Number.isFinite(x) && Number.isFinite(z)).map(([x, z]) => toLatLng(world.max, x, z));
      if (pts.length < 2) continue;
      L.polyline(pts, { className: "mc-path", weight: 2, interactive: false, smoothFactor: 0.5 }).addTo(group);
    }
    for (const m of layer.data.marks) {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.z)) continue;
      const href = localHref(m.href);
      const el = document.createElement(href ? "a" : "span");
      el.className = "mc-mark";
      el.dataset.shape = layer.shape;
      el.dataset.layer = layer.id;
      if (m.muted) el.dataset.muted = "";
      if (href) (el as HTMLAnchorElement).href = href;
      else el.tabIndex = 0;
      const glyph = document.createElement("span");
      glyph.className = "mc-mark__glyph";
      glyph.setAttribute("aria-hidden", "true");
      const tip = document.createElement("span");
      tip.className = "mc-mark__tip";
      const title = document.createElement("b");
      title.textContent = m.title;
      tip.append(title);
      if (m.detail) {
        const detail = document.createElement("span");
        detail.textContent = m.detail;
        tip.append(detail);
      }
      el.append(glyph, tip);
      L.marker(toLatLng(world.max, m.x, m.z), {
        icon: L.divIcon({ html: el, className: "mc-mark-icon", iconSize: [0, 0], iconAnchor: [0, 0] }),
        pane: "mc-marks",
        keyboard: false,
        interactive: false
      }).addTo(group);
    }
  }
}
