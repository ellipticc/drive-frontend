import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Only initialize Sentry in production to avoid blocking issues in development
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }

    if (typeof window !== 'undefined') {
      await import('./instrumentation-client');
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
