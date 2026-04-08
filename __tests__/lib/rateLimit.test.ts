import { canPerformAction, getRemainingCooldown, resetRateLimits } from '../../lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('should allow actions within limit', () => {
    expect(canPerformAction('test', 3, 60000)).toBe(true);
    expect(canPerformAction('test', 3, 60000)).toBe(true);
    expect(canPerformAction('test', 3, 60000)).toBe(true);
  });

  it('should block actions exceeding limit', () => {
    canPerformAction('test', 2, 60000);
    canPerformAction('test', 2, 60000);
    expect(canPerformAction('test', 2, 60000)).toBe(false);
  });

  it('should track different actions independently', () => {
    canPerformAction('action_a', 1, 60000);
    expect(canPerformAction('action_a', 1, 60000)).toBe(false);
    expect(canPerformAction('action_b', 1, 60000)).toBe(true);
  });

  it('should return remaining cooldown', () => {
    canPerformAction('test', 1, 60000);
    const remaining = getRemainingCooldown('test', 1, 60000);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  it('should return 0 cooldown when under limit', () => {
    expect(getRemainingCooldown('test', 5, 60000)).toBe(0);
  });

  it('should reset all limits', () => {
    canPerformAction('test', 1, 60000);
    expect(canPerformAction('test', 1, 60000)).toBe(false);
    resetRateLimits();
    expect(canPerformAction('test', 1, 60000)).toBe(true);
  });

  it('should expire old timestamps', () => {
    jest.useFakeTimers();
    canPerformAction('test', 1, 1000); // 1 saniye pencere
    expect(canPerformAction('test', 1, 1000)).toBe(false);

    jest.advanceTimersByTime(1100); // 1.1 saniye ileri
    expect(canPerformAction('test', 1, 1000)).toBe(true);
    jest.useRealTimers();
  });
});
