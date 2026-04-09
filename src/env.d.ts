/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FB_GET_TRANSACTIONS: string
  readonly VITE_FB_ADD_TRANSACTION: string
  readonly VITE_FB_EDIT_TRANSACTION: string
  readonly VITE_FB_DELETE_TRANSACTION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
