<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Scissors } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { formatLoginError } from '@/lib/authErrors'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const isResetMode = ref(false)

async function onSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  
  try {
    if (isResetMode.value) {
      // PROSES RESET PASSWORD
      const { error } = await auth.resetPassword(email.value)
      if (error) throw error
      successMsg.value = 'Tautan reset sandi telah dikirim. Silakan periksa inbox atau spam email Anda.'
      isResetMode.value = false // kembali ke tampilan login agar bisa menunggu
    } else {
      // PROSES MASUK (LOGIN)
      await auth.signIn(email.value, password.value)
      const redirect = route.query.redirect
      router.replace(typeof redirect === 'string' ? redirect : { name: 'dashboard' })
    }
  } catch (e) {
    if (isResetMode.value) {
      errorMsg.value = e?.message ?? 'Gagal mengirimkan tautan reset.'
    } else {
      errorMsg.value = formatLoginError(e)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-dvh bg-gradient-to-b from-pink-50 via-white to-rose-50/80 px-4 py-10 flex flex-col items-center justify-center"
  >
    <div class="w-full max-w-md">
      <div class="flex flex-col items-center gap-2 mb-8">
        <div class="h-24 w-24 rounded-full overflow-hidden shadow-xl shadow-pink-600/20 border-[3px] border-white">
          <img src="@/assets/logo.jpg" alt="Logo Riska Salon" class="h-full w-full object-cover" />
        </div>
        <h1 class="text-2xl font-bold text-pink-950 tracking-tight">Riska Salon</h1>
        <p class="text-pink-800/80 text-center text-sm">
          Masuk dengan <span class="font-medium text-pink-900">email</span> dan password akun Anda.
        </p>
      </div>

      <form
        class="rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-xl shadow-pink-900/5 p-6 space-y-5"
        @submit.prevent="onSubmit"
      >
        <div>
          <label for="email" class="block text-sm font-medium text-pink-900 mb-2">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            required
            class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-4 text-lg text-pink-950 placeholder:text-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400"
            placeholder="nama@email.com"
          />
        </div>

        <div v-if="!isResetMode">
          <label for="password" class="block text-sm font-medium text-pink-900 mb-2">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
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

        <div v-if="!isResetMode" class="flex justify-end">
          <button type="button" class="text-sm font-medium text-pink-700 hover:text-pink-900 focus:outline-none" @click="isResetMode = true; errorMsg = ''; successMsg = '';">
            Lupa Password?
          </button>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full min-h-14 rounded-xl bg-pink-600 text-white text-lg font-semibold shadow-md shadow-pink-600/30 active:scale-[0.99] transition disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
        >
          {{ loading ? 'Memproses…' : (isResetMode ? 'Kirim Tautan Reset' : 'Masuk') }}
        </button>

        <div v-if="isResetMode" class="text-center mt-4">
          <button type="button" class="text-sm font-medium text-pink-700 hover:text-pink-900 focus:outline-none" @click="isResetMode = false; errorMsg = ''; successMsg = '';">
            Kembali ke Login
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
