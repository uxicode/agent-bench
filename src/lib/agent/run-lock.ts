let isRunning = false;

export function tryAcquireRunLock(): boolean {
  if (isRunning) return false;
  isRunning = true;
  return true;
}

export function releaseRunLock(): void {
  isRunning = false;
}

export function isRunLocked(): boolean {
  return isRunning;
}
