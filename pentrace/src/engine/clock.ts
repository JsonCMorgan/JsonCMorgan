/** Longest gap one frame may cover. Anything longer (sleep, a suspended window) is treated as a pause. */
export const MAX_FRAME_GAP = 2;
/** Simulation step size, so a slow frame plays out the same as several fast ones. */
export const SIM_STEP = 0.25;

/**
 * Advances the simulation by real elapsed time, independent of frame rate. A machine that only
 * renders a few frames per second still runs processes and the trace at real speed.
 * Returns the simulated seconds.
 */
export function advanceClock(elapsedSec: number, tick: (dt: number) => void): number {
  let left = Math.min(MAX_FRAME_GAP, Math.max(0, elapsedSec));
  const total = left;
  while (left > 1e-9) {
    const dt = Math.min(SIM_STEP, left);
    tick(dt);
    left -= dt;
  }
  return total;
}
