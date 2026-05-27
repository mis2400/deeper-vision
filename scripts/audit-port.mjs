// Shared port utility for the audit harness scripts.
//
// audit-runtime.mjs and audit-exercise.mjs both spawn `vite preview`
// on port 4173. If a previous run crashed or was killed without
// cleanup, the port stays bound, the new run hits an error like
// "vite preview exited with code 1", and `npm run verify` aborts.
// This helper finds any process listening on the requested port and
// terminates it before the harness tries to bind it. Safe to call when
// nothing is listening — it just returns immediately.

import { spawnSync } from 'node:child_process';

/**
 * Free the given TCP port by killing any process bound to it.
 * Quiet success path: returns null. Surface the killed PID for
 * logging.
 *
 * Behaviour:
 *   1. `lsof -ti tcp:<port>` lists PIDs holding the port.
 *   2. SIGTERM each. Wait ~600 ms. If the port is still bound, SIGKILL.
 *   3. Return after the port is free, or throw if we cannot free it
 *      inside the timeout (~2 s total).
 *
 * Throws only when the kill itself fails — not when the port is
 * already free.
 */
export async function freePort(port) {
  const pids = listPids(port);
  if (pids.length === 0) return null;
  // Try graceful shutdown first.
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  if (await waitForFree(port, 600)) return { pids, signal: 'SIGTERM' };
  // Still bound — escalate.
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  if (await waitForFree(port, 1200)) return { pids, signal: 'SIGKILL' };
  throw new Error(`Could not free port ${port}; pids still bound: ${listPids(port).join(',')}`);
}

function listPids(port) {
  // lsof returns one PID per line on stdout; non zero exit when there
  // are no matches, which is fine.
  const r = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
  if (!r.stdout) return [];
  return r.stdout
    .split('\n')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function waitForFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (listPids(port).length === 0) return true;
    await new Promise((res) => setTimeout(res, 100));
  }
  return false;
}
