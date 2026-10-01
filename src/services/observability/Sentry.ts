// Sentry.ts — optional Sentry error reporting (Sprint 7.2).
//
// Off by default. Enable by setting VITE_SENTRY_DSN in the environment.
// When disabled, all exports are no-ops so the rest of the app pays zero cost.

import * as Sentry from '@sentry/react';

let enabled = false;

export function initSentry(dsn?: string) {
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE ?? 'development',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [Sentry.replayIntegration()],
    });
    enabled = true;
  } catch {
    // Sentry init should never crash the app
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!enabled) return;
  Sentry.captureMessage(message, level);
}

export function setUser(user: { id?: string; email?: string } | null) {
  if (!enabled) return;
  Sentry.setUser(user);
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.addBreadcrumb({ message, data, level: 'info' });
}
