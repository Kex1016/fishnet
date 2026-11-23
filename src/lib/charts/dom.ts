// The one bit of DOM the charts share: which child of a plot is nearest to the pointer. Client only.
/** Index of the child of `el` whose centre is nearest to `clientX` (-1 when it has none). */
export function nearestChild(el: Element | undefined, clientX: number): number {
  if (!el) return -1;
  let best = -1;
  let d = Infinity;
  const kids = el.children;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    const dd = Math.abs(r.left + r.width / 2 - clientX);
    if (dd < d) {
      d = dd;
      best = i;
    }
  }
  return best;
}
