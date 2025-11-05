// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Simple helper for user anonymization
function hashUserId(id: string | number | undefined): string | undefined {
  return id ? btoa(String(id)).substring(0, 12) : undefined;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable performance tracing to reduce noise
  tracesSampleRate: 0,

  // Disable sending user PII (Personally Identifiable Information)
  sendDefaultPii: false,

  // Only capture critical events (errors and exceptions)
  beforeSend(event) {
    // Drop non-error events
    if (!event.exception && event.level !== 'error') {
      return null;
    }

    // Strip sensitive data
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.query_string;
    }

    if (event.user) {
      // Keep only anonymized user ID
      event.user = {
        id: event.user.id ? hashUserId(event.user.id) : undefined,
      };
    }

    return event;
  },

  // Only capture error-level breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.level !== 'error') return null;
    return breadcrumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;