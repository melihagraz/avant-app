// Client-side rate limiter — in-memory timestamp tracking

const actionTimestamps: Map<string, number[]> = new Map();

/**
 * Belirli bir aksiyon için rate limit kontrolü.
 * @param action - Aksiyon adı (ör. 'otp_send', 'message_send')
 * @param maxCount - Pencere içinde izin verilen maksimum sayı
 * @param windowMs - Zaman penceresi (ms)
 * @returns true = aksiyon yapılabilir, false = rate limit aşıldı
 */
export function canPerformAction(action: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = actionTimestamps.get(action) || [];

  // Pencere dışındaki eski timestamp'leri temizle
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= maxCount) {
    actionTimestamps.set(action, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  actionTimestamps.set(action, validTimestamps);
  return true;
}

/**
 * Rate limit'e kaç saniye kaldığını döndürür.
 * @returns Kalan süre (saniye), 0 ise limit yok
 */
export function getRemainingCooldown(action: string, maxCount: number, windowMs: number): number {
  const now = Date.now();
  const timestamps = actionTimestamps.get(action) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length < maxCount) return 0;

  const oldest = Math.min(...validTimestamps);
  const remainingMs = windowMs - (now - oldest);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Test veya logout için tüm rate limit verilerini sıfırla.
 */
export function resetRateLimits(): void {
  actionTimestamps.clear();
}
