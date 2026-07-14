// src/lib/logger.js

const isProduction = import.meta.env.PROD;
// Feature Flag untuk fleksibilitas tingkat log (default: warn di prod, debug di dev)
const currentLogLevel = import.meta.env.VITE_LOG_LEVEL || (isProduction ? 'warn' : 'debug');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const levelValue = LOG_LEVELS[currentLogLevel] ?? 1;

/**
 * PII & Business Metrics Sanitizer
 */
const sanitize = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  // Kredensial absolut: Selalu disensor di semua environment
  const absoluteSensitive = [
    'password', 'token', 'pin', 'jwt', 'authorization', 
    'apikey', 'secret', 'access_token', 'refresh_token'
  ];
  
  // Metrik bisnis: Disensor HANYA di Production agar tidak bocor ke klien
  const businessSensitive = ['balance', 'amount', 'net_worth'];

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const lowerKey = key.toLowerCase();
      
      if (absoluteSensitive.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (isProduction && businessSensitive.includes(lowerKey)) {
        sanitized[key] = '[REDACTED_PROD]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitize(sanitized[key]);
      }
    }
  }
  return sanitized;
};

/**
 * Format Log Terstruktur
 */
const formatLog = (level, namespace, code, message, payload) => {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    namespace: `[${namespace}]`,
    code: code || 'SYS000',
    message,
    ...payload
  };
};

/**
 * Factory Function untuk Namespaced Logger
 * @param {string} namespace - Modul asal (contoh: 'Transaction', 'Auth', 'Sync')
 */
export const createLogger = (namespace = 'App') => {
  return {
    debug: (message, meta = {}) => {
      if (levelValue > LOG_LEVELS.debug) return;
      if (!isProduction) {
        console.debug(formatLog('debug', namespace, null, message, sanitize(meta)));
      }
    },
    info: (code, message, meta = {}) => {
      if (levelValue > LOG_LEVELS.info) return;
      const logData = formatLog('info', namespace, code, message, sanitize(meta));
      
      if (!isProduction) console.info(logData.namespace, logData.message, logData);
      // TODO (Production): Kirim logData ke Datadog/OpenTelemetry
    },
    warn: (code, message, meta = {}) => {
      if (levelValue > LOG_LEVELS.warn) return;
      const logData = formatLog('warn', namespace, code, message, sanitize(meta));
      
      if (!isProduction) console.warn(logData.namespace, logData.message, logData);
      // Di production, console.warn ditekan (suppressed), dialihkan ke monitoring service
    },
    error: (code, message, error = null, meta = {}) => {
      if (levelValue > LOG_LEVELS.error) return;
      
      // Keamanan Stack Trace: Sembunyikan stack di Production
      const safeError = error instanceof Error 
        ? { message: error.message, name: error.name, stack: isProduction ? undefined : error.stack } 
        : sanitize(error);

      const payload = { error: safeError, ...sanitize(meta) };
      const logData = formatLog('error', namespace, code, message, payload);

      if (!isProduction) {
        console.error(logData.namespace, logData.message, logData);
      } else {
        // TODO (Production): Transmisi aman ke Sentry/Crashlytics
        // Sentry.captureException(error, { tags: { code, namespace }, extra: payload });
      }
    }
  };
};

// Default Logger (Untuk backward compatibility jika ada yang memanggil logger langsung)
export const logger = createLogger('Global');