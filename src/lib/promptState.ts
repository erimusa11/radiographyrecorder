/**
 * Remembers when the phone's own unlock prompt (fingerprint, or the PIN / pattern screen) is open or has just closed.
 *
 * Android and iPhone can report that the app went to the background while that prompt is showing (the PIN screen is a
 * separate window). If the person takes a while to answer, the lock gate would otherwise read it as "the app was away
 * for more than 30 seconds" and lock again the moment they unlock. So the gate asks here first and ignores that time.
 */
let open = false;
let endedAt = 0;

/** How long after the prompt closes the "app is active again" event may still arrive. */
const SETTLE_MS = 2_000;

export function markPromptOpen() {
  open = true;
}

export function markPromptClosed() {
  open = false;
  endedAt = Date.now();
}

/** True while the prompt is open, and for a moment after it closes. */
export function promptRecentlyActive(): boolean {
  return open || Date.now() - endedAt < SETTLE_MS;
}
