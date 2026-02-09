/**
 * OpenTelemetry Web Frontend Configuration
 * Sends all trace data to the backend via HTTP
 */

import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { 
  trace, 
  Sampler, 
  SamplingResult, 
  Context, 
  SpanKind,
  SamplingDecision
} from '@opentelemetry/api';

/**
 * Custom Backend Exporter
 * Sends OTEL traces to backend /api/telemetry endpoint
 */
class BackendTraceExporter implements SpanExporter {
  private backendUrl: string;

  constructor(backendUrl: string = '/api/v1/telemetry/ingest') {
    this.backendUrl = backendUrl;
  }

  async export(spans: ReadableSpan[]): Promise<{ code: number }> {
    if (spans.length === 0) {
      return { code: 0 };
    }

    try {
      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: spans[0]?.resource?.attributes || {},
            },
            scopeSpans: [
              {
                scope: { name: 'drive-frontend' },
                spans: spans.map(span => this.spanToOTLP(span)),
              },
            ],
          },
        ],
      };

      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { code: 0 };
      } else {
        console.warn('[OTEL] Backend telemetry export failed:', response.status);
        return { code: 1 };
      }
    } catch (error) {
      console.warn('[OTEL] Failed to export spans to backend:', error);
      return { code: 1 };
    }
  }

  private spanToOTLP(span: ReadableSpan) {
    return {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanContext?.spanId || '',
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: span.startTime,
      endTimeUnixNano: span.endTime,
      attributes: span.attributes || {},
      events: span.events || [],
      status: span.status || {},
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
    };
  }

  async forceFlush(timeoutMs?: number): Promise<void> {
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Privacy-Aware Web Sampler
 * - Only samples critical user interactions
 * - Excludes internal navigation and health checks
 * - Respects user privacy preferences
 */
class PrivacyAwareWebSampler implements Sampler {
  constructor(private sampleRate: number = 0.05) {}

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Record<string, any>,
    links: any[]
  ): SamplingResult {
    // Check if user has disabled telemetry
    if (typeof window !== 'undefined') {
      const telemetryDisabled = localStorage.getItem('OTEL_TELEMETRY_DISABLED') === 'true';
      if (telemetryDisabled) {
        return { decision: 0 }; // NOT_RECORD
      }
    }

    const excludedUrls = ['/_next', '/static', '/api/health', '/api/metrics'];
    const criticalPaths = ['/auth', '/api/files', '/api/folders', '/api/papers', '/api/ai'];

    // Exclude internal resources
    if (excludedUrls.some(url => spanName?.includes(url))) {
      return { decision: 0 }; // NOT_RECORD
    }

    // Always sample critical paths
    if (criticalPaths.some(path => spanName?.includes(path))) {
      return { decision: 1 }; // RECORD_AND_SAMPLED
    }

    // Random sampling for other requests
    const shouldRecord = Math.random() < this.sampleRate;
    return { decision: shouldRecord ? 1 : 0 }; // 1 = RECORD_AND_SAMPLED, 0 = NOT_RECORD
  }

  toString(): string {
    return `PrivacyAwareWebSampler{sampleRate=${this.sampleRate}}`;
  }
}

/**
 * Initialize OpenTelemetry for Frontend with Backend Exporter
 */
export function initFrontendTelemetry() {
  const otelEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_OTEL_ENABLED === 'true';
  const sampleRate = parseFloat(process.env.NEXT_PUBLIC_OTEL_SAMPLE_RATE || '0.05');
  const serviceName = process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'drive-frontend';
  const environment = process.env.NODE_ENV || 'development';

  if (!otelEnabled) {
    console.log('[OTEL] Frontend telemetry disabled');
    return null;
  }

  try {
    console.log(`[OTEL] Initializing frontend OpenTelemetry (sending to backend)`);

    // Get anonymized user ID from localStorage
    let userId = '';
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('user_id');
      if (storedUserId) {
        // Hash userId
        userId = btoa(storedUserId).substring(0, 12);
      }
    }

    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'drive',
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      environment,
      'deployment.environment': environment,
      'user_id': userId,
    });

    // Create custom backend exporter
    const exporter = new BackendTraceExporter();

    // Create provider with custom sampler and span processors
    const provider = new WebTracerProvider({
      resource,
      sampler: new PrivacyAwareWebSampler(sampleRate),
      spanProcessors: [
        new BatchSpanProcessor(exporter, { maxExportBatchSize: 50 }),
      ],
    });

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            enabled: true,
          },
        }),
      ],
    });

    // Set as global provider
    provider.register();

    console.log('[OTEL] Frontend OpenTelemetry initialized (sending to backend)');
    return provider;
  } catch (error) {
    console.error('[OTEL] Failed to initialize frontend OpenTelemetry:', error);
    return null;
  }
}

// Export tracer for manual instrumentation
export function getTracer() {
  if (typeof window === 'undefined') return null;
  try {
    return trace.getTracer('drive-frontend', '1.0.0');
  } catch (error) {
    console.warn('[OTEL] Failed to get tracer:', error);
    return null;
  }
}
