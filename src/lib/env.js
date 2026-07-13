// src/lib/env.js

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  appName: import.meta.env.VITE_APP_NAME || 'ManagJeh',
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
};

export const validateEnv = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new ConfigurationError('VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY hilang.');
  }

  // Validasi URL: Harus mengarah ke domain supabase
  try {
    const url = new URL(env.supabaseUrl);
    if (!url.hostname.endsWith('.supabase.co')) {
      console.warn('[Warning] Supabase URL tidak menggunakan domain .supabase.co. Pastikan ini disengaja.');
    }
  } catch {
    throw new ConfigurationError(`VITE_SUPABASE_URL tidak valid: ${env.supabaseUrl}`);
  }

  // Validasi JWT (Struktur 3 bagian)
  const parts = env.supabaseAnonKey.split('.');
  if (parts.length !== 3) {
    throw new ConfigurationError('VITE_SUPABASE_ANON_KEY bukan JWT yang valid.');
  }
};