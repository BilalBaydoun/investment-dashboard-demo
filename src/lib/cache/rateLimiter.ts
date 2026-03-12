// Server-side rate limiter shared across all API routes
// Ensures we stay under 75 Alpha Vantage calls per minute

const callTimestamps: number[] = [];
const MAX_CALLS = 70; // Stay under 75 with buffer
const WINDOW_MS = 60_000;

export function canMakeCall(): boolean {
  const now = Date.now();
  // Remove timestamps outside the window
  while (callTimestamps.length > 0 && now - callTimestamps[0] > WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length < MAX_CALLS;
}

export function recordCall(): void {
  callTimestamps.push(Date.now());
}

export function getCallsRemaining(): number {
  const now = Date.now();
  while (callTimestamps.length > 0 && now - callTimestamps[0] > WINDOW_MS) {
    callTimestamps.shift();
  }
  return MAX_CALLS - callTimestamps.length;
}

export async function waitForSlot(): Promise<void> {
  while (!canMakeCall()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  recordCall();
}
