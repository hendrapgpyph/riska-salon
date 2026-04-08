/**
 * URL untuk fetch ke Google Apps Script.
 * Jika script diset 'Who has access: Anyone', CORS akan berjalan normal.
 */
export function getGoogleScriptRequestUrl() {
  return import.meta.env.VITE_GOOGLE_SCRIPT_URL?.trim() || ''
}
