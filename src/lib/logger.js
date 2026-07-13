// src/lib/logger.js

const isProduction = import.meta.env.PROD;

export const logger = {
  info: (message, meta = {}) => {
    if (!isProduction) console.info(`[INFO] ${message}`, meta);
    // TODO: Integrasi Datadog/OpenTelemetry di sini untuk Production
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${message}`, error);
    // TODO: Integrasi Sentry/Crashlytics di sini
  }
};