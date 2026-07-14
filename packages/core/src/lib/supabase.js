import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client

export function getSupabase() {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
    }
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}
