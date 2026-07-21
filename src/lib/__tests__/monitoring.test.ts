import * as Sentry from '@sentry/react-native';
import { scrubEvent, initMonitoring, captureError, setMonitoringUser } from '../monitoring';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((c) => c),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));

/**
 * Monitoring is the one subsystem allowed to run during a crash, so its contract is
 * that it never makes things worse: it must not throw, and it must not exfiltrate
 * personal data. This app knows a user's email and which markets they research —
 * a combination worth keeping off a third-party service.
 */

afterEach(() => jest.clearAllMocks());

describe('scrubEvent', () => {
  it('removes the identifying fields from a report', () => {
    const out = scrubEvent({
      user: { id: 'user-1', email: 'a@b.com', username: 'grant', ip_address: '1.2.3.4' },
      message: 'boom',
    });
    expect(out.user.email).toBeUndefined();
    expect(out.user.username).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
  });

  it('keeps the user id, which is what makes a report actionable', () => {
    const out = scrubEvent({ user: { id: 'user-1', email: 'a@b.com' } });
    expect(out.user.id).toBe('user-1');
  });

  it('drops request cookies and headers, which carry auth tokens', () => {
    const out = scrubEvent({
      request: { cookies: 'session=abc', headers: { Authorization: 'Bearer secret' } },
    });
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.headers).toBeUndefined();
  });

  it('passes through an event with nothing sensitive in it', () => {
    const out = scrubEvent({ message: 'boom', level: 'error' });
    expect(out).toEqual({ message: 'boom', level: 'error' });
  });
});

describe('without a DSN configured', () => {
  it('does not initialise Sentry', () => {
    initMonitoring();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('swallows a captured error instead of throwing during a crash', () => {
    expect(() => captureError(new Error('boom'))).not.toThrow();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('ignores user identity changes', () => {
    expect(() => setMonitoringUser('user-1')).not.toThrow();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });
});
