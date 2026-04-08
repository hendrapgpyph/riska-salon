<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { LockKeyhole } from 'lucide-vue-next'

const router = useRouter()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function onSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Password baru dan konfirmasi password tidak sama.'
    return
  }

  if (newPassword.value.length < 6) {
    errorMsg.value = 'Password harus lebih dari 6 karakter.'
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (error) throw error

    successMsg.value = 'Password berhasil diganti! Anda akan dialihkan...'
    setTimeout(() => {
      router.replace({ name: 'dashboard' })
    }, 2000)
  } catch (err) {
    errorMsg.value = err?.message ?? 'Gagal mengganti password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-pink-50 via-white to-rose-50/80 px-4 py-10 flex flex-col items-center justify-center">
    <div class="w-full max-w-md">
      <div class="flex flex-col items-center gap-2 mb-8">
        <div class="h-24 w-24 rounded-full overflow-hidden shadow-xl shadow-pink-600/20 border-[3px] border-white mb-2 relative">
          <img src="@/assets/logo.jpg" alt="Logo Riska Salon" class="h-full w-full object-cover scale-[1.02]" />
        </div>
        <h1 class="text-2xl font-bold text-pink-950 tracking-tight">Atur Sandi Baru</h1>
        <p class="text-pink-800/80 text-center text-sm">
          Sesi pendaftaran ulang diizinkan. Silakan atur <span class="font-medium text-pink-900">password baru</span> untuk akun Anda.
        </p>
      </div>

      <form class="rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-xl shadow-pink-900/5 p-6 space-y-5" @submit.prevent="onSubmit">
        
        <div>
          <label class="block text-sm font-medium text-pink-900 mb-2">Password Baru</label>
          <input
            v-model="newPassword"
            type="password"
            required
            class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-4 text-lg text-pink-950 placeholder:text-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-pink-900 mb-2">Ulangi Password Baru</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-4 text-lg text-pink-950 placeholder:text-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400"
            placeholder="••••••••"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          {{ errorMsg }}
        </p>
        <p v-if="successMsg" class="text-sm text-pink-700 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
          {{ successMsg }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full min-h-14 rounded-xl bg-pink-600 text-white text-lg font-semibold shadow-md shadow-pink-600/30 active:scale-[0.99] transition disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
        >
          {{ loading ? 'Menyimpan...' : 'Simpan Sandi Baru' }}
        </button>
      </form>
    </div>
  </div>
</template>
