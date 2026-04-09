import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

/** Satu in-flight init agar listener auth tidak terdaftar ganda. */
let initPromise = null

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const user = ref(null)
  const ready = ref(false)
  const initialized = ref(false)
  const profile = ref(null)

  const isLoggedIn = computed(() => !!session.value)
  const isAdmin = computed(() => !!profile.value?.is_admin)

  async function applySession(next) {
    session.value = next
    user.value = next?.user ?? null

    if (user.value?.id) {
      // Ambil profil public berdasarkan nama (case-insensitive)
      try {
        // Tambahkan timeout 10 detik agar tidak "hang" selamanya jika koneksi tidak stabil
        const profilePromise = supabase
          .from('staff')
          .select('*')
          .eq('user_id', user.value?.id)
          .single()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_PROFILE_FETCH')), 10000)
        )

        const { data, error } = await Promise.race([profilePromise, timeoutPromise])

        if (!error && data) {
          if (data.is_active === false) {
            // Akun dinonaktifkan
            throw new Error('Akun Anda telah dinonaktifkan oleh Admin.')
          }
          profile.value = data
        } else {
          profile.value = null
        }
      } catch (err) {
        console.error('[Auth] Failed or blocked loading profile:', err)
        // Force signOut jika inaktif atau timeout berulang (opsional)
        if (err.message.includes('dinonaktifkan')) {
          await supabase.auth.signOut()
          session.value = null
          user.value = null
          profile.value = null
          throw err
        }
      }
    } else {
      profile.value = null
    }
  }

  async function ensureSession() {
    if (!ready.value) {
      await initialize()
    }
  }

  async function initialize() {
    if (initialized.value) return
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const { data } = await supabase.auth.getSession()
          await applySession(data.session)
        } catch (e) {
          console.error('[Auth] Init Session Error:', e)
        } finally {
          ready.value = true
        }

        supabase.auth.onAuthStateChange(async (event, nextSession) => {
          console.log('[Auth] Event Change:', event)
          await applySession(nextSession)
          if (event === 'PASSWORD_RECOVERY') {
            window.location.href = '/reset-password'
          }
        })

        // FIXED: Menangani PWA "hang" saat bangun dari background
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
              console.log('[Auth] App Visible - Resyncing session...')
              try {
                const { data } = await supabase.auth.getSession()
                if (data?.session) {
                  await applySession(data.session)
                }
              } catch (err) {
                console.error('[Auth] Wakeup Sync Error:', err)
              }
            }
          })
        }

        initialized.value = true
      })()
    }
    await initPromise
  }

  async function signIn(email, password) {
    const e = String(email).trim().toLowerCase()
    if (!e) {
      throw new Error('Email wajib diisi.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    })
    if (error) throw error
    await applySession(data.session)
    return data
  }

  async function resetPassword(email) {
    const e = String(email).trim().toLowerCase()
    if (!e) throw new Error('Email wajib diisi.')

    // Alamat tujuan redirect ketika pengguna mengeklik link di email mereka
    const redirectUrl = `${window.location.origin}/reset-password`
    return await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: redirectUrl,
    })
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    applySession(null)
  }

  return {
    session,
    user,
    ready,
    isLoggedIn,
    isAdmin, // Exported!
    initialize,
    ensureSession,
    signIn,
    resetPassword,
    signOut,
  }
})
