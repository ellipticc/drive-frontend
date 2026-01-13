// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Simple helper for user anonymization
function hashUserId(id: string | number | undefined): string | undefined {
  return id ? btoa(String(id)).substring(0, 12) : undefined;
}

// Check privacy settings from localStorage (default to true/enabled)
const crashReportsEnabled = typeof window !== 'undefined'
  ? localStorage.getItem('privacy_crash_reports') !== 'false'
  : true;

// Only initialize Sentry in production to avoid blocking issues in development AND if enabled by user
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN && crashReportsEnabled) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Disable performance tracing
    tracesSampleRate: 0,

    // Disable Session Replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Capture ONLY console errors, no warnings
    integrations: [
      Sentry.captureConsoleIntegration({
        levels: ['error'],
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
}

// Sentry handles uninitialized state gracefully (no-ops), so we don't need to manually shim it.
// Attempting to Object.assign(Sentry, ...) fails because module namespaces are immutable.

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;