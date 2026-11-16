// The markers on the map (FMK-2, brief §5.1, §5.2, §5.4): pins and areas of one world, the in-area titles, the popup.
// Not a Svelte component: MapCanvas creates it once its Leaflet map exists and hands it new props with `update`.
//
// Panes (z-index in map.css / markers.css): `mc-marks` 550 holds the area shapes (an SVG of its own), `mc-labels` 560 the
// titles (canvases, no pointer events), `mc-pins` 570 the pins, and Leaflet's popup pane 700 the popup. So larger areas
// are below smaller ones (draw order, view.ts `drawOrder`), pins are above every area, titles are above shapes and
// below popups, and a small area on top of a big one is the one that gets the click. The DOM order is the same, which
// is also the tab order (areas, then pins); the Places popout lists them in that order.
//
// Coordinates: a polygon's corners go straight through `toLatLng` (crs.ts), a pin sits at its block's centre.
// Titles: recomputed on zoom end only (fit.ts), drawn by FMK-1's canvas renderer. Everything that came from a player
// (titles, subtitles) is set with `textContent`, attributes or glyph drawing: no `innerHTML`, nothing parsed.
import type * as Leaflet from "leaflet";
import { mount, unmount } from "svelte";
import { centreLatLng, pixelsPerBlock, toLatLng } from "../crs.ts";
import { fitLabels } from "./fit.ts";
import { AREA_FILL_OPACITY, AREA_FILL_OPACITY_HOVER, labelTint } from "./labelColor.ts";
import { fitLines, labelGeometry, measureLabel, renderFit } from "./McLabel.ts";
import MarkerPopup from "./MarkerPopup.svelte";
import { markerName } from "./text.ts";
import type { MarkerLayerProps, MarkerView } from "./types.ts";
import { drawOrder } from "./view.ts";

export type MarkerLayer = {
  /** new props (any subset): other markers, `on`, another `selected`, new metrics */
  update(p: Partial<MarkerLayerProps>): void;
  /** open a marker's popup; `focus` moves the keyboard focus into it (Enter on a pin, the Places popout) */
  open(id: number, o?: { focus?: boolean; at?: Leaflet.LatLng; pan?: boolean }): void;
  /** close the popup; the pin or area it belonged to gets the focus back when `focus` */
  close(o?: { focus?: boolean }): void;
  /** the element a keyboard can reach for a marker (its pin button or area path) */
  element(id: number): Element | null;
  destroy(): void;
};

const NS = "http://www.w3.org/2000/svg";
const HOVER_CLOSE_MS = 160;
const PANES = [
  ["mc-marks", "shapes"],
  ["mc-labels", "titles"],
  ["mc-pins", "pins"]
] as const;

type Entry = { v: MarkerView; layer: Leaflet.Polygon | Leaflet.Marker; el: Element | null; anchor: Leaflet.LatLng };

const finePointer = () => typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;

/** The pin: one button with the same glyph for every point, filled with the marker's colour (never an icon per kind). */
function pinElement(v: MarkerView): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mc-pin";
  b.setAttribute("aria-label", markerName(v));
  b.style.setProperty("--pin", v.color);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const body = document.createElementNS(NS, "path");
  body.setAttribute("d", "M12 23.2C12 23.2 4.2 15.6 4.2 9.6a7.8 7.8 0 0 1 15.6 0c0 6-7.8 13.6-7.8 13.6Z");
  body.setAttribute("class", "mc-pin__body");
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("cx", "12");
  dot.setAttribute("cy", "9.6");
  dot.setAttribute("r", "3");
  dot.setAttribute("class", "mc-pin__dot");
  svg.append(body, dot);
  b.append(svg);
  return b;
}

export function createMarkerLayer(L: typeof Leaflet, map: Leaflet.Map, initial: MarkerLayerProps): MarkerLayer {
  let props: MarkerLayerProps = { ...initial };
  const entries = new Map<number, Entry>();
  const shapes = L.layerGroup();
  const titles = L.layerGroup();
  const pins = L.layerGroup();
  for (const [name] of PANES) if (!map.getPane(name)) map.createPane(name);

  let gen = 0; // a newer set of titles replaces an older one that is still loading its glyph sheets
  let attached = false;
  let open: { id: number; hover: boolean } | null = null;
  let app: ReturnType<typeof mount> | null = null;
  let closing: ReturnType<typeof setTimeout> | null = null;
  let internal = false; // a popup we close ourselves must not read as the visitor's close
  const popup = L.popup({ pane: "popupPane", className: "mc-mpop", closeButton: false, autoPan: false, autoClose: false, closeOnClick: false, closeOnEscapeKey: false, maxWidth: 280, minWidth: 200, offset: [0, -4] });

  const href = (id: number) => props.href?.(id) ?? `?marker=${id}`;
  const select = (id: number | null) => props.onselect?.(id);

  // ---- the popup
  function unmountPopup(): void {
    if (app) void unmount(app);
    app = null;
  }
  function cancelClose(): void {
    if (closing) clearTimeout(closing);
    closing = null;
  }
  function dropPopup(): void {
    cancelClose();
    const was = open;
    internal = true;
    popup.close();
    internal = false;
    unmountPopup();
    open = null;
    if (was) restyle(entries.get(was.id), false);
  }
  /** Room the popup must keep clear of: the popouts' row along the top (it wraps on a phone) and the footer. */
  function clearTop(): number {
    const c = map.getContainer();
    const row = c.closest(".mc-stage")?.querySelector(".mc-over__row");
    return Math.max(16, row ? Math.ceil(row.getBoundingClientRect().bottom - c.getBoundingClientRect().top) + 8 : 16);
  }
  function openPopup(id: number, o: { hover?: boolean; focus?: boolean; at?: Leaflet.LatLng; pan?: boolean } = {}): void {
    const e = entries.get(id);
    if (!e || !attached) return;
    cancelClose();
    const was = open;
    if (was && was.id !== id) restyle(entries.get(was.id), false);
    unmountPopup();
    const holder = document.createElement("div");
    app = mount(MarkerPopup, { target: holder, props: { marker: e.v, href: href(id), onclose: () => closeFromUi(true) } });
    // options first: replacing a hover popup (already on the map) pans as soon as its content and place change
    popup.options.offset = L.point(0, e.v.kind === "point" ? -26 : -4);
    // a popup the visitor asked for slides into view clear of the popouts; a hover one never moves the map
    popup.options.autoPan = !o.hover && o.pan !== false;
    popup.options.autoPanPaddingTopLeft = L.point(16, clearTop());
    popup.options.autoPanPaddingBottomRight = L.point(16, 48);
    popup.setContent(holder);
    popup.setLatLng(o.at ?? e.anchor);
    internal = true;
    popup.openOn(map);
    internal = false;
    open = { id, hover: !!o.hover };
    restyle(e, true);
    const root = popup.getElement();
    if (root && !(root as HTMLElement).dataset.bound) {
      (root as HTMLElement).dataset.bound = "1";
      root.addEventListener("mouseenter", cancelClose);
      root.addEventListener("mouseleave", () => open?.hover && scheduleClose());
    }
    if (o.focus) holder.querySelector<HTMLElement>(".mk-pop")?.focus({ preventScroll: true });
  }
  function scheduleClose(): void {
    cancelClose();
    closing = setTimeout(() => {
      if (open?.hover) dropPopup();
    }, HOVER_CLOSE_MS);
  }
  /** The visitor closed the popup (button, Escape, a click on the bare map): the page hears it, focus goes back. */
  function closeFromUi(focus: boolean): void {
    const was = open;
    if (!was) return;
    dropPopup();
    if (!was.hover) select(null);
    if (focus) (entries.get(was.id)?.el as HTMLElement | SVGElement | null | undefined)?.focus?.({ preventScroll: true });
  }
  popup.on("remove", () => {
    if (!internal && open) {
      const was = open;
      dropPopup();
      if (!was.hover) select(null);
    }
  });

  /** An area's fill and a pin's class follow hover, focus and selection (the title's colour never changes). */
  function restyle(e: Entry | undefined, lit: boolean): void {
    if (!e) return;
    const on = lit || open?.id === e.v.id;
    if (e.v.kind === "point") (e.el as HTMLElement | null)?.classList.toggle("mc-pin--on", on);
    else (e.layer as Leaflet.Polygon).setStyle({ fillOpacity: on ? AREA_FILL_OPACITY_HOVER : AREA_FILL_OPACITY, weight: on ? 3 : 2 });
  }

  // ---- the shapes
  function addArea(v: MarkerView): void {
    if (!v.polygon) return;
    const latlngs = v.polygon.map(([x, z]) => toLatLng(props.max, x, z));
    const poly = L.polygon(latlngs, {
      pane: "mc-marks",
      className: "mc-area",
      color: v.color,
      weight: 2,
      opacity: 0.9,
      lineJoin: "miter",
      lineCap: "butt",
      fillColor: v.color,
      fillOpacity: AREA_FILL_OPACITY,
      smoothFactor: 0, // every corner stays on its block corner at every zoom
      interactive: true,
      bubblingMouseEvents: false
    });
    const at = v.label ? L.latLng(toLatLng(props.max, v.label.x, v.label.z)) : L.latLngBounds(latlngs).getCenter();
    const entry: Entry = { v, layer: poly, el: null, anchor: at };
    entries.set(v.id, entry);
    poly.on("add", () => {
      const el = poly.getElement();
      if (!el || entry.el === el) return;
      entry.el = el;
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", markerName(v));
      el.addEventListener("focus", () => restyle(entry, true));
      el.addEventListener("blur", () => restyle(entry, false));
      el.addEventListener("keydown", (ev) => {
        const k = (ev as KeyboardEvent).key;
        if (k !== "Enter" && k !== " ") return;
        ev.preventDefault();
        ev.stopPropagation();
        openPopup(v.id, { focus: true });
        select(v.id);
      });
    });
    poly.on("mouseover", (ev: Leaflet.LeafletMouseEvent) => {
      restyle(entry, true);
      if (open && !open.hover) return; // a popup the visitor opened stays
      if (finePointer()) openPopup(v.id, { hover: true, at: ev.latlng });
    });
    poly.on("mouseout", () => {
      restyle(entry, false);
      if (open?.hover) scheduleClose();
    });
    poly.on("click", (ev: Leaflet.LeafletMouseEvent) => {
      openPopup(v.id, { at: ev.latlng });
      select(v.id);
    });
    poly.addTo(shapes);
  }

  function addPin(v: MarkerView): void {
    if (!v.point) return;
    const btn = pinElement(v);
    const at = L.latLng(centreLatLng(props.max, v.point));
    const marker = L.marker(at, {
      pane: "mc-pins",
      icon: L.divIcon({ html: btn, className: "mc-pin-icon", iconSize: [24, 24], iconAnchor: [12, 24] }),
      keyboard: false,
      interactive: true,
      bubblingMouseEvents: false,
      riseOnHover: false
    });
    const entry: Entry = { v, layer: marker, el: btn, anchor: at };
    entries.set(v.id, entry);
    btn.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      ev.stopPropagation();
      openPopup(v.id, { focus: true });
      select(v.id);
    });
    marker.on("mouseover", () => {
      if (!(open && !open.hover) && finePointer()) openPopup(v.id, { hover: true });
    });
    marker.on("mouseout", () => open?.hover && scheduleClose());
    marker.on("click", () => {
      openPopup(v.id);
      select(v.id);
    });
    marker.addTo(pins);
  }

  function build(): void {
    const keep = open?.hover === false ? open.id : null;
    dropPopup();
    shapes.clearLayers();
    pins.clearLayers();
    titles.clearLayers();
    entries.clear();
    for (const v of drawOrder(props.markers)) (v.kind === "point" ? addPin : addArea)(v);
    // the open popup follows the marker through a refetch, or goes with it
    if (keep !== null && attached) {
      if (entries.has(keep)) openPopup(keep, { pan: false });
      else select(null);
    }
    void retitle();
  }

  // ---- the titles inside areas (brief §5.2): on zoom end only
  async function retitle(): Promise<void> {
    const mine = ++gen;
    if (!attached) return;
    const ppb = pixelsPerBlock(props.max, map.getZoom());
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    const jobs: Promise<{ v: MarkerView; canvas: HTMLCanvasElement; width: number; height: number; anchor: [number, number] }>[] = [];
    // the entries are in draw order: every title keeps clear of the areas drawn above its own and of the titles placed before it
    const areas = [...entries.values()].map((e) => e.v).filter((v) => v.polygon);
    const fits = fitLabels(areas.map((v) => ({ polygon: v.polygon!, label: v.label, title: v.title })), ppb, props.uni);
    for (const [i, v] of areas.entries()) {
      const fit = fits[i];
      if (!fit) continue;
      const geo = labelGeometry(measureLabel(fitLines(fit, props.uni)), fit.k);
      const canvas = document.createElement("canvas");
      canvas.className = "mc-label";
      canvas.dataset.marker = String(v.id);
      jobs.push(renderFit(canvas, fit, labelTint(v.color).color, { dpr, uni: props.uni }).then(() => ({ v, canvas, width: geo.width, height: geo.height, anchor: geo.anchor })));
    }
    const done = await Promise.allSettled(jobs);
    if (mine !== gen || !attached) return;
    titles.clearLayers();
    for (const r of done) {
      if (r.status !== "fulfilled") continue; // a sheet that did not load leaves that title out
      const { v, canvas, width, height, anchor } = r.value;
      L.marker(toLatLng(props.max, v.label!.x, v.label!.z), {
        pane: "mc-labels",
        icon: L.divIcon({ html: canvas, className: "mc-label-icon", iconSize: [width, height], iconAnchor: [Math.round(anchor[0]), Math.round(anchor[1])] }),
        interactive: false,
        keyboard: false
      }).addTo(titles);
    }
    const pane = map.getPane("mc-labels");
    if (pane) pane.style.visibility = "";
  }
  const onZoomStart = () => {
    // a title drawn for the old zoom must not drift across the map while the tiles scale
    const pane = map.getPane("mc-labels");
    if (pane) pane.style.visibility = "hidden";
  };
  const onZoomEnd = () => void retitle();
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && open) {
      ev.stopPropagation();
      closeFromUi(true);
    }
  };
  const onMapClick = () => {
    if (open && !open.hover) closeFromUi(false); // the bare map was clicked
  };

  function attach(on: boolean): void {
    if (on === attached) return;
    attached = on;
    if (on) {
      shapes.addTo(map);
      titles.addTo(map);
      pins.addTo(map);
      map.on("zoomstart", onZoomStart);
      map.on("zoomend", onZoomEnd);
      map.on("click", onMapClick);
      map.getContainer().addEventListener("keydown", onKey);
      build();
    } else {
      dropPopup();
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
      map.off("click", onMapClick);
      map.getContainer().removeEventListener("keydown", onKey);
      shapes.remove();
      titles.remove();
      pins.remove();
      gen++;
    }
  }

  attach(props.on);
  if (props.selected !== null && attached) openPopup(props.selected, { pan: false });

  return {
    update(p) {
      const before = props;
      props = { ...props, ...p };
      if (p.on !== undefined && p.on !== before.on) attach(props.on);
      else if (attached && (p.markers !== undefined && p.markers !== before.markers || p.max !== undefined && p.max !== before.max || p.uni !== undefined && p.uni !== before.uni)) build();
      if (!attached) return;
      if (p.selected !== undefined && p.selected !== before.selected) {
        if (props.selected === null) {
          if (open && !open.hover) dropPopup();
        } else if (open?.id !== props.selected || open.hover) openPopup(props.selected, { pan: false }); // a link or the page said so: the view stays
      }
    },
    open(id, o = {}) {
      openPopup(id, o);
    },
    close(o = {}) {
      if (open) closeFromUi(!!o.focus);
    },
    element(id) {
      return entries.get(id)?.el ?? null;
    },
    destroy() {
      attach(false);
      entries.clear();
    }
  };
}
