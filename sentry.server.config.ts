// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

    // Disable performance tracing
    tracesSampleRate: 0,

    // Capture ONLY console errors, no warnings on server
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