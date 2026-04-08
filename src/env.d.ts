/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_SCRIPT_URL: string
  /** Paksa fetch ke /api/google-script (butuh reverse proxy di production) */
  readonly VITE_GOOGLE_SCRIPT_USE_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
