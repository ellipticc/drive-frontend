// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Simple helper for user anonymization
function hashUserId(id: string | number | undefined): string | undefined {
  return id ? btoa(String(id)).substring(0, 12) : undefined;
}

// Only initialize Sentry in production to avoid blocking issues in development
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Enable 100% performance tracing
    tracesSampleRate: 1.0,

    // Enable Session Replay for error debugging
    replaysSessionSampleRate: 0.1, // Sample 10% of all sessions
    replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors

    // Capture all console errors and warnings
    integrations: [
      Sentry.replayIntegration(),
      Sentry.captureConsoleIntegration({
        levels: ['error', 'warn'],
      }),
    ],

    // Capture all events without filtering
    beforeSend(event) {
      // Scrub sensitive headers but keep Session IDs (Cookies)
      if (event.request && event.request.headers) {
        delete event.request.headers['Authorization'];
      }

      // User anonymization
      if (event.user) {
        event.user = {
          id: event.user.id ? hashUserId(event.user.id) : undefined,
        };
      }
      return event;
    },
  });
} else {
  // In development or when DSN is not set, provide a no-op Sentry object
  // to prevent errors when Sentry methods are called
  const noop = () => { };
  const noopSentry = {
    captureException: noop,
    captureMessage: noop,
    captureEvent: noop,
    addBreadcrumb: noop,
    setUser: noop,
    setTag: noop,
    setContext: noop,
    withScope: (fn: (...args: unknown[]) => unknown) => fn(),
    startTransaction: () => ({ finish: noop }),
    configureScope: (fn: (...args: unknown[]) => unknown) => fn(),
  };

  // Replace Sentry with no-op in development
  Object.assign(Sentry, noopSentry);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;