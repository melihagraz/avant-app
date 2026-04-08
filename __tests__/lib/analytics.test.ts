import { setAnalyticsUser, trackEvent, trackScreen } from '../../lib/analytics';

// Mock supabase
const mockInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should set analytics user', () => {
    // Should not throw
    expect(() => setAnalyticsUser('user-123')).not.toThrow();
    expect(() => setAnalyticsUser(null)).not.toThrow();
  });

  it('should queue events and flush after timeout', () => {
    setAnalyticsUser('user-123');
    trackEvent('test_event', { key: 'value' });

    // Event should be queued, not sent yet
    expect(mockInsert).not.toHaveBeenCalled();

    // Fast-forward 5 seconds (flush interval)
    jest.advanceTimersByTime(5000);

    // Now it should have been flushed
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_name: 'test_event',
          properties: { key: 'value' },
          user_id: 'user-123',
        }),
      ])
    );
  });

  it('should track screen views', () => {
    trackScreen('HomeScreen');

    jest.advanceTimersByTime(5000);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_name: 'screen_view',
          screen: 'HomeScreen',
        }),
      ])
    );
  });
});
