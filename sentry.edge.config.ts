// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
}