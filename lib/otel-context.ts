/**
 * Context Propagation Utilities for Frontend
 * Enables distributed tracing across frontend and backend
 */

import { trace } from '@opentelemetry/api';

/**
 * Inject trace context into HTTP headers for cross-service propagation
 * Used when frontend calls backend
 */
export function injectTraceContext(headers: Record<string, string> = {}): Record<string, string> {
  const carrier: Record<string, string> = headers;
  
  try {
    const span = trace.getActiveSpan();
    if (span) {
      const ctx = span.spanContext();
      if (ctx) {
        // W3C Trace Context format: 00-traceId-spanId-traceFlags
        carrier.traceparent = `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
        if (ctx.traceState) {
          carrier.tracestate = ctx.traceState.serialize();
        }
      }
    }
  } catch (e) {
    console.debug('[OTEL] Failed to inject trace context:', e);
  }
  
  return carrier;
}

/**
 * Decorator for Express middleware to propagate trace context
 */
export function createTracePropagationMiddleware() {
  return (req: any, res: any, next: any) => {
    try {
      next();
    } catch (e) {
      console.debug('[OTEL] Error in trace propagation middleware:', e);
      next();
    }
  };
}

/**
 * Wrap fetch requests with automatic trace context injection
 */
export async function tracedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = injectTraceContext(
    (options.headers as Record<string, string>) || {}
  );
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Get current trace ID for logging/debugging
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().traceId;
  }
  return undefined;
}

/**
 * Add custom event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, any>
) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record exception in current span
 */
export function recordException(error: Error) {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
  }
}

/**
 * Set span attribute
 */
export function setSpanAttribute(key: string, value: any) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes({ [key]: value });
  }
}
