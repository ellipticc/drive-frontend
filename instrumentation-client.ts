// This file configures the initialization of Sentry and OpenTelemetry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { initFrontendTelemetry } from "./lib/telemetry";

// Initialize OpenTelemetry FIRST (before Sentry)
initFrontendTelemetry();

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
  // Guard: if Sentry already has an active client, skip initializing again to avoid duplicate transports
  try {
    const currentClient = (Sentry as any).getCurrentHub?.()?.getClient?.();
    if (currentClient) {
      try {
        const opts = typeof currentClient.getOptions === 'function' ? currentClient.getOptions() : undefined;
        console.warn('[sentry] Sentry already initialized on page — skipping duplicate init.', opts);
      } catch (e) {
        console.warn('[sentry] Sentry already initialized on page — skipping duplicate init. (failed to read options)');
      }
    } else {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

        // Prevent default integrations (we only want the console integration)
        defaultIntegrations: [],

        // Disable performance tracing (let OpenTelemetry handle it)
        tracesSampleRate: 0,

        // Disable Session Replay
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,

        // Disable all automatic instrumentation to prevent duplicate events
        integrations: [
          Sentry.captureConsoleIntegration({
            levels: ['error'],
          }),
        ],

        // STRICTLY filter to ONLY console errors - no HTTP requests, no transactions
        beforeSend(event) {
          // Check privacy settings dynamically
          if (typeof window !== 'undefined' && localStorage.getItem('privacy_crash_reports') === 'false') {
            return null;
          }

          // ONLY send error and exception events - filter everything else
          if (event.level !== 'error' && event.type !== 'error') {
            return null;
          }

          // Reject if it's an HTTP request event or transaction
          if (event.request || event.transaction || event.type === 'transaction' || event.type === 'http.client') {
            return null;
          }

          // Reject breadcrumbs-only events (no actual error)
          if (!event.exception && !event.message) {
            return null;
          }

          // User anonymization
          if (event.user) {
            event.user = {
              id: event.user.id ? hashUserId(event.user.id) : undefined,
            };
          }
          return event;
        },

        // Prevent any transaction (navigation/perf) events from being sent
        beforeSendTransaction(transaction) {
          return null;
        },

      });
    }
  } catch (err) {
    // Fallback: if guard check fails, DO NOT initialize (prevents duplicate init)
    console.error('[sentry] Error during initialization check', err);
  }
}

// Sentry handles uninitialized state gracefully (no-ops), so we don't need to manually shim it.
// Attempting to Object.assign(Sentry, ...) fails because module namespaces are immutable.

export const onRouterTransitionStart = () => undefined;