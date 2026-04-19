import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum diset di environment.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

// Klien khusus untuk Admin yang mendaftarkan user baru agar sesi utama tidak terganti
export function createAdminClient() {
  const keyToUse = serviceRoleKey || anonKey || ''
  if (!serviceRoleKey) {
    console.warn('[supabase] VITE_SUPABASE_SERVICE_ROLE_KEY belum diset, beberapa fitur admin mungkin tidak berfungsi.')
  }
  return createClient(url ?? '', keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
