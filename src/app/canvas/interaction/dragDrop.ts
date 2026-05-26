// HTML5 drag and drop — M6 rebuild milestone.
//
// Replaces the pointer-event placement pipeline that was unreliable
// because window-level pointermove / pointerup listeners get hijacked
// by Radix popovers, the < 8 px arm-for-placement short circuit ate
// drops that the user thought were drags, and the React ghost (line
// 4172 in EngineeringCanvas.tsx) drifted away from the actual drop
// position when the canvas was zoomed or panned.
//
// The native HTML5 drag dispatch is a separate event stream from pointer
// events. It survives pointer capture by other components, the browser
// owns the ghost (no coordinate drift), and `dragover` / `drop` fire
// only on the canvas surface — no window-scope race.
//
// Pattern:
//   1. Tray items mount as `<button draggable onDragStart={beginProductDrag(p)} />`
//      The handler stuffs the product id into dataTransfer.
//   2. Canvas SVG mounts `<svg onDragOver={allowDrop} onDrop={completeDrop} />`
//      The handler reads the product id, looks it up in PRODUCTS_BY_ID,
//      computes world coords through the live pan/zoom transform, and
//      dispatches the placement action.
//
// Same dataTransfer MIME is used by every tray site so a single handler
// on the canvas catches all of them.

export const DRAG_MIME = 'application/dv-product';

/** Tray-side: begin an HTML5 drag for a product. Sets dataTransfer to
 *  the product id (a string). Caller passes the id directly so the
 *  helper stays free of any catalog import cycles. */
export function beginProductDrag(productId: string, event: React.DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(DRAG_MIME, productId);
  // 'copy' tells the browser to show a copy-cursor (the product comes
  // from a tray, not a move operation between two canvas positions).
  event.dataTransfer.effectAllowed = 'copy';
}

/** Canvas-side: read a product id back from the drop's dataTransfer.
 *  Returns null when the drop isn't ours (e.g. a stray browser drag of
 *  a file or another app's content). */
export function readProductIdFromDrop(event: React.DragEvent | DragEvent): string | null {
  const dt = event.dataTransfer;
  if (!dt) return null;
  const id = dt.getData(DRAG_MIME);
  return id || null;
}

/** Canvas-side: allow drop. Vital — browsers reject `drop` events on
 *  elements that don't preventDefault their `dragover`.
 *
 *  Iterates dataTransfer.types via for-of because the type of that
 *  property differs across browsers: Chrome ships a string[], spec
 *  says DOMStringList (only `.length` + `.item()` + `.contains()`,
 *  NOT `.includes()`). `Array.from` worked but a for-of with a
 *  string compare is simplest and bullet-proof. The previous version
 *  of this function used `.includes()` directly and silently failed
 *  in Safari + some Firefox builds, which manifested as drops never
 *  firing on the canvas. */
export function allowProductDrop(event: React.DragEvent): void {
  const types = event.dataTransfer?.types;
  if (!types) return;
  let ours = false;
  // for-of works on both string[] (Chrome) and DOMStringList (spec).
  for (const t of Array.from(types as unknown as Iterable<string>)) {
    if (t === DRAG_MIME) { ours = true; break; }
  }
  if (!ours) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

/** Convert client (viewport) coords into canvas world coords using the
 *  same pan + zoom transform the canvas uses internally for every other
 *  pointer-derived coordinate. Used by the drop handler. */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  surfaceRect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return {
    x: (clientX - surfaceRect.left - pan.x) / zoom,
    y: (clientY - surfaceRect.top - pan.y) / zoom,
  };
}
