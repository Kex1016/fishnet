// The animated switch between the two realms (WEBSITE-BRIEF §4), for the browser.
//
// - With the View Transitions API: the new realm is revealed by a circle that grows from where the visitor
//   clicked (or from the link that was activated by keyboard), 450 ms. Both directions. A new navigation
//   during the reveal skips the old transition (the browser does that); the reveal never takes pointer
//   input (realm.css sets `::view-transition { pointer-events: none }`).
// - Without it: the registered colour tokens interpolate (realm.css `@property` + transition), 400 ms.
// - prefers-reduced-motion: reduce: no growth and no movement: a 150 ms cross-fade with the API, an instant
//   swap without it.
// Same-realm navigations are untouched.
import { onNavigate } from "$app/navigation";
import { onMount } from "svelte";
import { realmOf, type RealmName } from "./realm.ts";

type StartVT = (cb: () => Promise<void> | void) => { ready: Promise<void>; finished: Promise<void>; skipTransition(): void };

let origin: { x: number; y: number } | null = null;

function remember(e: Event): void {
  if (e instanceof PointerEvent || e instanceof MouseEvent) {
    if (e.clientX || e.clientY) {
      origin = { x: e.clientX, y: e.clientY };
      return;
    }
  }
  // keyboard activation: the middle of the element
  const el = e.target instanceof Element ? e.target.closest("a, button") : null;
  if (el) {
    const r = el.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}

function setRealm(r: RealmName): void {
  document.documentElement.dataset.realm = r;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Call once from the root layout's script (component init). */
export function installRealmTransition(): void {
  onMount(() => {
    document.addEventListener("click", remember, { capture: true });
    return () => document.removeEventListener("click", remember, { capture: true });
  });

  onNavigate((nav) => {
    const to = nav.to ? realmOf(nav.to.url.pathname) : null;
    const from = (document.documentElement.dataset.realm ?? "") as RealmName;
    if (to === null || to === from) return;

    const start = (document as Document & { startViewTransition?: StartVT }).startViewTransition?.bind(document);
    if (!start) {
      // the tokens interpolate on their own (realm.css); reduced motion makes that instant
      nav.complete.then(() => setRealm(to), () => undefined);
      return;
    }

    const root = document.documentElement;
    const calm = reduced();
    const at = origin ?? { x: innerWidth / 2, y: 0 };
    origin = null;
    root.classList.add(calm ? "realm-vt-fade" : "realm-vt");

    return new Promise<void>((resolve) => {
      const vt = start(async () => {
        resolve();
        try {
          await nav.complete;
        } finally {
          setRealm(to);
        }
      });
      if (!calm) {
        vt.ready
          .then(() => {
            const r = Math.hypot(Math.max(at.x, innerWidth - at.x), Math.max(at.y, innerHeight - at.y));
            root.animate(
              { clipPath: [`circle(0px at ${at.x}px ${at.y}px)`, `circle(${r}px at ${at.x}px ${at.y}px)`] },
              { duration: 450, easing: "cubic-bezier(0.3, 0.7, 0.1, 1)", pseudoElement: "::view-transition-new(root)" }
            );
          })
          .catch(() => undefined);
      }
      vt.finished.finally(() => root.classList.remove("realm-vt", "realm-vt-fade")).catch(() => undefined);
    });
  });
}
