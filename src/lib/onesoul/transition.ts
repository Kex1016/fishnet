// The switch between the two realms (David, 23 Nov 2026; the "Transition" board of the haiiro canvas), in the
// browser.
//
// - With the View Transitions API: the new realm grows over the old one in a dithered circle from where the
//   visitor clicked (or from the middle of the link activated by keyboard; the middle of the screen for back
//   and forward). 8px cells, a 4x4 Bayer edge, 12 frames in one second: the circle steps, it never glides.
//   The frames are a mask on `::view-transition-new(root)`, drawn on a canvas one pixel per cell before the
//   transition starts and played by one animation with stepped keyframes, so the browser keeps the time and
//   the transition ends with it. A new navigation during the reveal skips the old one (the browser does
//   that); the reveal never takes pointer input (base.css: `::view-transition { pointer-events: none }`).
// - prefers-reduced-motion: reduce, no View Transitions or no CSS masks: the realm swaps in one frame.
// Same-realm navigations are untouched. The numbers live in src/lib/design/dither.ts (REALM_TRANSITION) and
// the --realm-transition-* tokens; the cells per frame in transition-mask.ts.
import { afterNavigate, onNavigate } from "$app/navigation";
import { onMount } from "svelte";
import { REALM_TRANSITION } from "#lib/design/dither.ts";
import { realmOf, type RealmName } from "./realm.ts";
import { maskFrames, maskGrid, type MaskGrid, type Point } from "./transition-mask.ts";

type StartVT = (cb: () => Promise<void> | void) => { ready: Promise<void>; finished: Promise<void>; skipTransition(): void };

/** A click older than this is not the one that started the navigation (back and forward have none). */
const ORIGIN_MS = 2000;

let origin: { at: number; point: Point } | null = null;

function remember(e: MouseEvent): void {
  // a pointer click has a position; a keyboard activation (detail 0) takes the middle of its link or button
  if (e.detail > 0) {
    origin = { at: performance.now(), point: { x: e.clientX, y: e.clientY } };
    return;
  }
  const el = e.target instanceof Element ? e.target.closest("a, button") : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  origin = { at: performance.now(), point: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
}

function takeOrigin(): Point {
  const o = origin;
  origin = null;
  if (o && performance.now() - o.at < ORIGIN_MS) return o.point;
  return { x: innerWidth / 2, y: innerHeight / 2 };
}

function setRealm(r: RealmName): void {
  const root = document.documentElement;
  if ((root.dataset.realm ?? "") !== r) root.dataset.realm = r;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The frames as images, one pixel per cell: opaque where the new realm shows. Empty without a 2D canvas. */
function frameImages(grid: MaskGrid): string[] {
  const cv = document.createElement("canvas");
  cv.width = grid.cols;
  cv.height = grid.rows;
  const ctx = cv.getContext("2d");
  if (!ctx) return [];
  const img = ctx.createImageData(grid.cols, grid.rows);
  return maskFrames(grid).map((lit) => {
    for (let i = 0; i < lit.length; i++) img.data[i * 4 + 3] = lit[i] ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL("image/png");
  });
}

/** One keyframe per frame, each held until the next (step-end); the cells scale up to 8px without smoothing. */
function keyframes(grid: MaskGrid, images: string[]): Keyframe[] {
  const fixed = {
    maskSize: `${grid.cols * grid.cell}px ${grid.rows * grid.cell}px`,
    maskRepeat: "no-repeat",
    maskPosition: "0 0",
    imageRendering: "pixelated"
  };
  const frames: Keyframe[] = images.map((src, i) => ({ ...fixed, offset: i / images.length, easing: "step-end", maskImage: `url("${src}")` }));
  frames.push({ ...fixed, offset: 1, maskImage: `url("${images[images.length - 1]}")` });
  return frames;
}

/** Call once from the root layout's script (component init). */
export function installRealmTransition(): void {
  onMount(() => {
    document.addEventListener("click", remember, { capture: true });
    return () => document.removeEventListener("click", remember, { capture: true });
  });

  // whatever happened on the way (a cancelled navigation, an error page), the realm ends up where the page is
  afterNavigate(() => setRealm(realmOf(location.pathname)));

  onNavigate((nav) => {
    const to = nav.to ? realmOf(nav.to.url.pathname) : null;
    const from = (document.documentElement.dataset.realm ?? "") as RealmName;
    const at = takeOrigin();
    if (to === null || to === from || nav.willUnload) return;

    const vtApi = (document as { startViewTransition?: StartVT }).startViewTransition;
    const start = typeof vtApi === "function" ? vtApi.bind(document) : null;
    const grid = maskGrid(innerWidth, innerHeight, at);
    const images = start && !reduced() && CSS.supports("mask-image", "url(a.png)") ? frameImages(grid) : [];
    if (!start || images.length === 0) {
      // one frame: the new page and its realm arrive together
      nav.complete.then(() => setRealm(to), () => undefined);
      return;
    }

    const root = document.documentElement;
    root.classList.add("realm-vt");

    return new Promise<void>((resolve) => {
      const vt = start(async () => {
        resolve();
        await nav.complete;
        setRealm(to);
      });
      vt.ready
        .then(() => {
          root.animate(keyframes(grid, images), {
            duration: REALM_TRANSITION.durationMs,
            easing: "linear",
            pseudoElement: "::view-transition-new(root)"
          });
        })
        .catch(() => undefined);
      vt.finished.finally(() => root.classList.remove("realm-vt")).catch(() => undefined);
    });
  });
}
