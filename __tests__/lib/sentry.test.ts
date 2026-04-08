import * as SentryModule from '@sentry/react-native';
import { initSentry, setSentryUser, captureError, addBreadcrumb } from '../../lib/sentry';

describe('sentry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not crash when DSN is empty', () => {
    expect(() => initSentry()).not.toThrow();
  });

  it('should set user context', () => {
    setSentryUser('user-123');
    expect(SentryModule.setUser).toHaveBeenCalledWith({ id: 'user-123' });
  });

  it('should clear user context with null', () => {
    setSentryUser(null);
    expect(SentryModule.setUser).toHaveBeenCalledWith(null);
  });

  it('should capture error without context', () => {
    const error = new Error('test');
    captureError(error);
    expect(SentryModule.captureException).toHaveBeenCalledWith(error);
  });

  it('should capture error with context', () => {
    const error = new Error('test');
    captureError(error, { screen: 'home' });
    expect(SentryModule.withScope).toHaveBeenCalled();
  });

  it('should add breadcrumb', () => {
    addBreadcrumb('user tapped', 'ui', { button: 'send' });
    expect(SentryModule.addBreadcrumb).toHaveBeenCalledWith({
      message: 'user tapped',
      category: 'ui',
      data: { button: 'send' },
      level: 'info',
    });
  });
});
