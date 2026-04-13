const actionTimestamps: Map<string, number[]> = new Map();

export function canPerformAction(action: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = actionTimestamps.get(action) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= maxCount) {
    actionTimestamps.set(action, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  actionTimestamps.set(action, validTimestamps);
  return true;
}

export function getRemainingCooldown(action: string, maxCount: number, windowMs: number): number {
  const now = Date.now();
  const timestamps = actionTimestamps.get(action) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length < maxCount) return 0;

  const oldest = Math.min(...validTimestamps);
  const remainingMs = windowMs - (now - oldest);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function resetRateLimits(): void {
  actionTimestamps.clear();
}
