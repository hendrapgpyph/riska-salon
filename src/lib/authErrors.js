/**
 * Pesan login yang lebih jelas untuk debugging umum (Supabase Auth).
 */
export function formatLoginError(error) {
  const code = error?.code
  const raw = String(error?.message ?? '')

  if (code === 'email_not_confirmed') {
    return (
      'Akun ini belum dikonfirmasi. Di Supabase: Authentication → Providers → Email, ' +
      'nonaktifkan "Confirm email", atau konfirmasi lewat email; lalu coba login lagi.'
    )
  }

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) {
    return 'Email atau password salah.'
  }

  if (code === 'user_banned') {
    return 'Akun ini dinonaktifkan. Hubungi admin Supabase.'
  }

  if (code === 'email_provider_disabled' || code === 'provider_disabled') {
    return 'Login email/password dinonaktifkan di proyek Supabase. Aktifkan di Authentication → Providers.'
  }

  if (/fetch|network|failed to fetch/i.test(raw)) {
    return 'Tidak bisa menghubungi Supabase. Periksa URL proyek, koneksi internet, atau blokir CORS/adblock.'
  }

  return raw || 'Login gagal.'
}
