// Floor plan import — public entry. After the M5 rebuild this file is a
// thin shim that delegates to src/app/canvas/plan/importPlan.ts, which
// runs decode/downscale/encode inside a Web Worker and stores the binary
// in IndexedDB. The legacy synchronous toDataURL path that froze the
// main thread on every upload is gone; the API shape callers see
// (importFloorplanFile → ImportResult) is unchanged.
//
// Two callers exist today:
//   - src/app/screens/BlueprintCalibration.tsx (static import)
//   - src/app/screens/EngineeringCanvas.tsx    (dynamic import)
// Both keep working without code changes via this shim.

export type { ImportResult } from '../canvas/plan/importPlan';
export { importPlan as importFloorplanFile } from '../canvas/plan/importPlan';
export type ImportableType = 'image/png' | 'image/jpeg' | 'application/pdf';
