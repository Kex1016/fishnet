// Player dots on the map (FM-3; brief §4.3, §5): a face from /img/face/<uuid>.png and a nose that shows the yaw.
// Everything else about a player is a hover popup (David, 15 Nov 2026): face, name, world and coordinates, shown
// on hover and keyboard focus; only the followed player keeps a name tag. All built with DOM calls (names are
// text, never HTML).
//
// Glide: every update gives a dot a new target; a frame loop moves it there in a straight line over `glideMs`
// (the hub's poll interval), in block space, so panning and zooming never bend the path. Reduced motion, a
// teleport and a first sighting jump. Follow keeps the view centred on one dot, frame by frame.
import type * as Leaflet from "leaflet";
import { centreLatLng, faceSrc, readout, turn } from "./crs.ts";
import type { PlayerDot } from "./types.ts";

/** Further than this between two updates is a teleport: jump, do not glide across the map. */
export const TELEPORT_BLOCKS = 96;

export type Glide = { fx: number; fz: number; tx: number; tz: number; t0: number; ms: number };

/** Where a glide is at `now` (linear: constant speed between two samples). */
export function glideAt(g: Glide, now: number): { x: number; z: number; done: boolean } {
  if (g.ms <= 0 || now >= g.t0 + g.ms) return { x: g.tx, z: g.tz, done: true };
  const p = Math.max(0, (now - g.t0) / g.ms);
  return { x: g.fx + (g.tx - g.fx) * p, z: g.fz + (g.tz - g.fz) * p, done: false };
}

/** The next glide of a dot that is at (x, z) now and was told to be at `to`. */
export function nextGlide(at: { x: number; z: number }, to: { x: number; z: number }, now: number, ms: number): Glide {
  const far = Math.hypot(to.x - at.x, to.z - at.z) > TELEPORT_BLOCKS;
  return { fx: far ? to.x : at.x, fz: far ? to.z : at.z, tx: to.x, tz: to.z, t0: now, ms: far ? 0 : ms };
}

type Dot = { uuid: string; name: string; marker: Leaflet.Marker; el: HTMLElement; nose: HTMLElement; where: HTMLElement; hint: HTMLElement; glide: Glide; x: number; z: number; yaw: number };

export type PlayersOptions = {
  /** zoom.max of the world shown */
  max: number;
  world: string;
  /** the world's name for the popup (plain text) */
  worldName: string;
  glideMs: () => number;
  reduced: () => boolean;
  onpick: (uuid: string) => void;
  /** follow changed from inside: a drag, the player left */
  onfollow: (uuid: string | null) => void;
};

export type MapPlayers = {
  /** every player of the server (dots of other worlds are not drawn) */
  set(players: PlayerDot[]): void;
  follow(uuid: string): void;
  unfollow(): void;
  following(): string | null;
  /** where a player's dot is right now, in blocks (mid-glide), or null when it is not on this world */
  at(uuid: string): { x: number; z: number } | null;
  destroy(): void;
};

export function createPlayers(L: typeof Leaflet, map: Leaflet.Map, opts: PlayersOptions): MapPlayers {
  const dots = new Map<string, Dot>();
  const pane = map.getPane("mc-players") ?? map.createPane("mc-players");
  let followed: string | null = null;
  /** follow does not recentre before this time (the opening pan is still running) */
  let settleAt = 0;
  let frame = 0;
  let dead = false;
  const now = () => performance.now();
  const zooming = () => (map as unknown as { _animatingZoom?: boolean })._animatingZoom === true;

  function build(p: PlayerDot): { el: HTMLElement; nose: HTMLElement; where: HTMLElement; hint: HTMLElement } {
    const el = document.createElement("div");
    el.className = "mc-dot";
    const nose = document.createElement("span");
    nose.className = "mc-dot__nose";
    nose.setAttribute("aria-hidden", "true");
    const src = faceSrc(p.uuid);
    const face = document.createElement(src ? "img" : "span");
    face.className = "mc-dot__face";
    if (src) {
      const img = face as HTMLImageElement;
      img.src = src;
      img.alt = "";
      img.width = 24;
      img.height = 24;
      img.decoding = "async";
      img.draggable = false;
    }
    const name = document.createElement("span");
    name.className = "mc-dot__name";
    name.textContent = p.name;
    // the hover popup: a small card above the dot
    const tip = document.createElement("span");
    tip.className = "mc-dot__tip";
    const span = (cls: string, text: string) => {
      const e = document.createElement("span");
      e.className = cls;
      e.textContent = text;
      return e;
    };
    if (src) {
      const big = document.createElement("img");
      big.className = "mc-dot__tip-face";
      big.src = src;
      big.alt = "";
      big.width = 32;
      big.height = 32;
      big.loading = "lazy";
      tip.append(big);
    }
    const lines = span("mc-dot__tip-lines", "");
    const who = span("mc-dot__tip-name", p.name);
    const world = span("mc-dot__tip-world", opts.worldName);
    const where = span("mc-dot__tip-where", readout(p));
    const hint = span("mc-dot__tip-hint", "Click to follow");
    lines.append(who, world, where, hint);
    tip.append(lines);
    el.append(nose, face, name, tip);
    return { el, nose, where, hint };
  }

  function label(d: Dot): void {
    const on = followed === d.uuid;
    const icon = d.marker.getElement();
    if (!icon) return;
    icon.setAttribute("aria-label", on ? `Stop following ${d.name}` : `Follow ${d.name}`);
    icon.setAttribute("aria-pressed", on ? "true" : "false");
    icon.classList.toggle("mc-dot--followed", on);
    d.hint.textContent = on ? "Click to stop following" : "Click to follow";
    d.marker.setZIndexOffset(on ? 1000 : 0);
  }

  function add(p: PlayerDot): Dot {
    const { el, nose, where, hint } = build(p);
    const marker = L.marker(centreLatLng(opts.max, p), {
      icon: L.divIcon({ html: el, className: "mc-dot-icon", iconSize: [28, 28], iconAnchor: [14, 14] }),
      pane: "mc-players",
      keyboard: true,
      riseOnHover: true,
      bubblingMouseEvents: false
    });
    const d: Dot = { uuid: p.uuid, name: p.name, marker, el, nose, where, hint, glide: { fx: p.x, fz: p.z, tx: p.x, tz: p.z, t0: 0, ms: 0 }, x: p.x, z: p.z, yaw: p.yaw };
    const pick = () => {
      opts.onpick(d.uuid);
      if (followed === d.uuid) stop(true);
      else start(d.uuid, true);
    };
    marker.on("click", pick);
    marker.addTo(map);
    // Leaflet gives the icon role="button" and a tab stop, but no key: Enter and Space press it
    marker.getElement()?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      pick();
    });
    nose.style.transform = `rotate(${d.yaw}deg)`;
    dots.set(p.uuid, d);
    label(d);
    return d;
  }

  function set(players: PlayerDot[]): void {
    if (dead) return;
    const t = now();
    const ms = opts.reduced() ? 0 : Math.max(0, opts.glideMs());
    const here = new Set<string>();
    const all = new Set<string>();
    for (const p of players) {
      all.add(p.uuid);
      if (p.world !== opts.world || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
      here.add(p.uuid);
      const d = dots.get(p.uuid);
      if (!d) {
        add(p);
        continue;
      }
      if (d.name !== p.name) {
        d.name = p.name;
        (d.el.querySelector(".mc-dot__name") as HTMLElement).textContent = p.name;
        (d.el.querySelector(".mc-dot__tip-name") as HTMLElement).textContent = p.name;
        label(d);
      }
      if (Number.isFinite(p.yaw) && p.yaw !== d.yaw) {
        // the shortest way round, so 170° → −170° turns 20°, not 340°
        d.yaw += turn(d.yaw, p.yaw);
        d.nose.style.transform = `rotate(${d.yaw}deg)`;
      }
      if (p.x !== d.glide.tx || p.z !== d.glide.tz) {
        d.glide = nextGlide({ x: d.x, z: d.z }, p, t, ms);
        d.where.textContent = readout(p);
      }
    }
    for (const [uuid, d] of dots) {
      if (here.has(uuid)) continue;
      d.marker.remove();
      dots.delete(uuid);
    }
    // the followed player left the server: follow ends. On another world of this server it stays on, and the
    // page is expected to switch worlds (FM-4, FM-8).
    if (followed && !all.has(followed)) stop(true);
    run();
  }

  function centre(d: Dot, animate: boolean): void {
    const ll = centreLatLng(opts.max, { x: d.x, z: d.z });
    if (animate) {
      settleAt = now() + 400;
      map.panTo(ll, { animate: true, duration: 0.35 });
      return;
    }
    const off = map.latLngToContainerPoint(ll).subtract(map.getSize().divideBy(2)).round();
    if (off.x || off.y) map.panBy(off, { animate: false });
  }

  function step(): void {
    frame = 0;
    if (dead) return;
    const t = now();
    let moving = false;
    const hold = zooming(); // Leaflet is scaling the panes: positions set now would be wrong for a few frames
    for (const d of dots.values()) {
      const at = glideAt(d.glide, t);
      if (!at.done) moving = true;
      if (at.x === d.x && at.z === d.z) continue;
      d.x = at.x;
      d.z = at.z;
      if (!hold) d.marker.setLatLng(centreLatLng(opts.max, at));
      else moving = true;
    }
    const f = followed ? dots.get(followed) : undefined;
    if (f && !hold && t >= settleAt) centre(f, false);
    if (moving || (f && t < settleAt)) run();
  }

  function run(): void {
    if (!frame && !dead) frame = requestAnimationFrame(step);
  }

  function start(uuid: string, fromInside: boolean): void {
    const before = followed;
    followed = uuid;
    if (before && before !== uuid) {
      const b = dots.get(before);
      if (b) label(b);
    }
    const d = dots.get(uuid);
    if (d) {
      label(d);
      centre(d, !opts.reduced());
    }
    map.options.scrollWheelZoom = "center";
    map.options.touchZoom = "center";
    map.options.doubleClickZoom = "center";
    if (fromInside && before !== uuid) opts.onfollow(uuid);
    run();
  }

  function stop(fromInside: boolean): void {
    if (!followed) return;
    const d = dots.get(followed);
    followed = null;
    if (d) label(d);
    map.options.scrollWheelZoom = true;
    map.options.touchZoom = true;
    map.options.doubleClickZoom = true;
    if (fromInside) opts.onfollow(null);
  }

  // a drag or an arrow key takes the view back from follow
  const onDrag = () => stop(true);
  const onKey = (e: Leaflet.LeafletKeyboardEvent) => {
    if (e.originalEvent.key.startsWith("Arrow") && e.originalEvent.target === map.getContainer()) stop(true);
  };
  // after a zoom the dots mid-glide are put where they belong
  const onZoomEnd = () => {
    for (const d of dots.values()) d.marker.setLatLng(centreLatLng(opts.max, { x: d.x, z: d.z }));
    run();
  };
  map.on("dragstart", onDrag);
  map.on("keydown", onKey);
  map.on("zoomend", onZoomEnd);

  return {
    set,
    follow: (uuid) => start(uuid, false),
    unfollow: () => stop(false),
    following: () => followed,
    at: (uuid) => {
      const d = dots.get(uuid);
      return d ? { x: d.x, z: d.z } : null;
    },
    destroy() {
      dead = true;
      if (frame) cancelAnimationFrame(frame);
      map.off("dragstart", onDrag);
      map.off("keydown", onKey);
      map.off("zoomend", onZoomEnd);
      for (const d of dots.values()) d.marker.remove();
      dots.clear();
      pane.remove();
    }
  };
}
