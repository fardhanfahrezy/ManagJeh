import { createClient } from '@supabase/supabase-js'

// Mengambil URL dan Key secara aman dari environment variables Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL atau Anon Key tidak ditemukan di file .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)