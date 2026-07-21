import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * Crash + error reporting. Mirrors analytics.ts: no-ops safely when unconfigured,
 * never throws, never blocks UI.
 *
 * Deliberately conservative about what leaves the device. This app knows a user's
 * email and which markets they research — a plausible-but-sensitive combination —
 * so PII is off and the payload is scrubbed rather than trusted.
 */

const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;

/**
 * Expo Go cannot load Sentry's native module. Initialising it there logs alarming
 * errors and reports nothing useful, and Expo Go is still the main test loop until
 * the EAS dev build exists — so run JS-only there.
 */
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let enabled = false;

/**
 * Strips values that identify a person from anything on its way out.
 * Exported so the privacy guarantee is tested rather than assumed.
 */
export function scrubEvent<T extends object>(event: T): T {
  const e = event as unknown as {
    user?: { email?: string; ip_address?: string; username?: string };
    request?: { headers?: Record<string, string>; cookies?: unknown };
  };
  if (e.user) {
    delete e.user.email;
    delete e.user.username;
    e.user.ip_address = undefined;
  }
  if (e.request) {
    delete e.request.cookies;
    delete e.request.headers;
  }
  return event;
}

export function initMonitoring(): void {
  // No DSN is a legitimate state (local dev, and any build before Sentry is
  // provisioned). Silence beats a console full of SDK warnings.
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      enableNative: !isExpoGo,
      // Errors only. Performance tracing on every screen would cost quota and
      // battery for signal nobody is reading yet.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      environment: __DEV__ ? 'development' : 'production',
      beforeSend: (event) => (__DEV__ ? null : scrubEvent(event)),
      beforeBreadcrumb: (crumb) => {
        // Console breadcrumbs routinely capture logged objects, which here can
        // include auth payloads. The stack trace is what's diagnostic anyway.
        if (crumb.category === 'console') return null;
        return crumb;
      },
    });
    enabled = true;
  } catch {
    // Monitoring must never be the thing that breaks the app.
    enabled = false;
  }
}

/** Associates errors with an account WITHOUT sending the email. */
export function setMonitoringUser(userId: string | null): void {
  if (!enabled) return;
  try {
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {
    /* ignore */
  }
}

/** Reports a handled error. Use where a catch would otherwise swallow it. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) {
    if (__DEV__) console.warn('[monitoring]', error, context);
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* ignore */
  }
}

/**
 * Wraps the ROOT component so render crashes are reported instead of showing a
 * blank screen with nothing to diagnose. Typed for a props-less root, which is
 * all expo-router's layout is — a generic version fights Sentry.wrap's signature
 * for no benefit.
 */
export function withMonitoring(component: React.ComponentType): React.ComponentType {
  return dsn ? (Sentry.wrap(component) as React.ComponentType) : component;
}
