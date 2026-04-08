import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || '';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN tanımlı değil, crash reporting devre dışı');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__, // Sadece production'da aktif
    tracesSampleRate: 0.2, // %20 performance sampling
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function setSentryUser(userId: string | null) {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'app',
    data,
    level: 'info',
  });
}

export { Sentry };
