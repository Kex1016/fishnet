// The switch between the two realms (David, 23 Nov 2026; the "Transition" board of the haiiro canvas), in the
// browser.
//
// - With the View Transitions API: the new realm grows over the old one in a dithered circle from where the
//   visitor clicked (or from the middle of the link activated by keyboard; the middle of the screen for back
//   and forward). 8px cells, a 4x4 Bayer edge, 12 frames in one second: the circle steps, it never glides.
//   The frames are a mask on `::view-transition-new(root)`: one sprite sheet, drawn on a canvas one pixel per
//   cell and decoded before the transition starts, and one animation that steps its position, so the browser
//   keeps the time and the transition ends with it. The image never changes during the reveal. A new navigation during the reveal skips the old one (the browser does
//   that); the reveal never takes pointer input (base.css: `::view-transition { pointer-events: none }`).
// - prefers-reduced-motion: reduce, no View Transitions or no CSS masks: the realm swaps in one frame.
// Same-realm navigations are untouched. The numbers live in src/lib/design/dither.ts (REALM_TRANSITION) and
// the --realm-transition-* tokens; the cells per frame in transition-mask.ts.
import { afterNavigate, onNavigate } from "$app/navigation";
import { onMount } from "svelte";
import { REALM_TRANSITION, REALM_TRANSITION_FRAMES } from "#lib/design/dither.ts";
import { realmOf, type RealmName } from "./realm.ts";
import { SHEET_COLUMNS, maskFrames, maskGrid, sheetCell, type MaskGrid, type Point } from "./transition-mask.ts";

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

/** Every frame on one sprite sheet, one pixel per cell: opaque where the new realm shows. Null without a 2D
    canvas. One image for the whole transition: swapping a mask image per frame lets a browser paint a frame
    before the next image has loaded, and the screen then flickers between the realms (seen in Firefox). */
function frameSheet(grid: MaskGrid): string | null {
  const frames = maskFrames(grid);
  const cv = document.createElement("canvas");
  cv.width = grid.cols * SHEET_COLUMNS;
  cv.height = grid.rows * Math.ceil(frames.length / SHEET_COLUMNS);
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(grid.cols, grid.rows);
  frames.forEach((lit, i) => {
    for (let c = 0; c < lit.length; c++) img.data[c * 4 + 3] = lit[c] ? 255 : 0;
    const at = sheetCell(i);
    ctx.putImageData(img, at.col * grid.cols, at.row * grid.rows);
  });
  return cv.toDataURL("image/png");
}

/** One keyframe per frame, each held until the next (step-end): the sheet stays, its position steps. The cells
    scale up to 8px without smoothing. */
function keyframes(grid: MaskGrid, sheet: string, frames: number): Keyframe[] {
  const w = grid.cols * grid.cell;
  const h = grid.rows * grid.cell;
  const fixed = {
    maskImage: `url("${sheet}")`,
    maskSize: `${w * SHEET_COLUMNS}px ${h * Math.ceil(frames / SHEET_COLUMNS)}px`,
    maskRepeat: "no-repeat",
    imageRendering: "pixelated"
  };
  const at = (i: number) => {
    const c = sheetCell(i);
    return `${-c.col * w}px ${-c.row * h}px`;
  };
  const out: Keyframe[] = Array.from({ length: frames }, (_, i) => ({ ...fixed, offset: i / frames, easing: "step-end", maskPosition: at(i) }));
  out.push({ ...fixed, offset: 1, maskPosition: at(frames - 1) });
  return out;
}

/** The sheet, decoded, before the transition starts: its first frame never waits on the image. */
async function loaded(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
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
    const sheet = start && !reduced() && CSS.supports("mask-image", "url(a.png)") ? frameSheet(grid) : null;
    if (!start || !sheet) {
      // one frame: the new page and its realm arrive together
      nav.complete.then(() => setRealm(to), () => undefined);
      return;
    }

    const root = document.documentElement;
    const target: RealmName = to;
    const begin: StartVT = start;
    const src: string = sheet;
    root.classList.add("realm-vt");

    return new Promise<void>((resolve) => {
      void run();
      async function run(): Promise<void> {
        const img = await loaded(src);
        if (!img) {
          root.classList.remove("realm-vt");
          resolve();
          nav.complete.then(() => setRealm(target), () => undefined);
          return;
        }
        const vt = begin(async () => {
          resolve();
          await nav.complete;
          setRealm(target);
        });
        vt.ready
          .then(() => {
            root.animate(keyframes(grid, src, REALM_TRANSITION_FRAMES), {
              duration: REALM_TRANSITION.durationMs,
              easing: "linear",
              pseudoElement: "::view-transition-new(root)"
            });
          })
          .catch(() => undefined);
        vt.finished
          .finally(() => {
            root.classList.remove("realm-vt");
            img.src = ""; // the decoded sheet stays referenced (and cached) until the end
          })
          .catch(() => undefined);
      }
    });
  });
}
