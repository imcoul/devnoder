// Observability.ts — lightweight custom OpenTelemetry-style tracing and metrics.
//
// Sprint 7.1: zero-telemetry-by-default, local-only storage in Dexie.
// All data stays in the browser unless the user explicitly enables export.

import Dexie, { Table } from 'dexie';

export type SpanKind = 'internal' | 'client' | 'server';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: SpanStatus;
  attributes?: Record<string, unknown>;
  errorMessage?: string;
}

export interface MetricPoint {
  id?: number;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  labels?: Record<string, string>;
}

class ObservabilityDB extends Dexie {
  spans!: Table<Span>;
  metrics!: Table<MetricPoint>;
  constructor() {
    super('devnoder-observability');
    this.version(1).stores({
      spans: 'id, traceId, name, startTime, status',
      metrics: '++id, name, timestamp, unit',
    });
  }
}

const db = new ObservabilityDB();

export class Tracer {
  private traceId = crypto.randomUUID();

  startSpan(name: string, kind: SpanKind = 'internal', attributes?: Record<string, unknown>): { end: (status?: SpanStatus, error?: Error) => void } {
    const id = crypto.randomUUID();
    const startTime = Date.now();
    return {
      end: (status: SpanStatus = 'ok', error?: Error) => {
        const endTime = Date.now();
        const span: Span = {
          id,
          traceId: this.traceId,
          name,
          kind,
          startTime,
          endTime,
          durationMs: endTime - startTime,
          status,
          attributes,
          errorMessage: error?.message,
        };
        db.spans.add(span).catch(() => {});
      },
    };
  }

  async getSpans(traceId?: string): Promise<Span[]> {
    if (traceId) return db.spans.where('traceId').equals(traceId).toArray();
    return db.spans.orderBy('startTime').reverse().limit(200).toArray();
  }

  async clearSpans(): Promise<void> {
    await db.spans.clear();
  }
}

export class Meter {
  async record(name: string, value: number, unit = '1', labels?: Record<string, string>): Promise<void> {
    await db.metrics.add({ name, value, unit, timestamp: Date.now(), labels });
  }

  async getMetrics(name?: string): Promise<MetricPoint[]> {
    if (name) return db.metrics.where('name').equals(name).toArray();
    return db.metrics.orderBy('timestamp').reverse().limit(200).toArray();
  }

  async clearMetrics(): Promise<void> {
    await db.metrics.clear();
  }
}

export const tracer = new Tracer();
export const meter = new Meter();
