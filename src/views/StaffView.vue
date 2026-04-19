<script setup>
import { ref, onMounted } from 'vue'
import { supabase, createAdminClient } from '@/lib/supabase'
import { Users, ArrowLeft, RefreshCw, UserPlus, Power, Key, Link2, Copy, ExternalLink, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const staffs = ref([])
const loading = ref(false)
const errorMsg = ref('')

const isAdding = ref(false)
const newName = ref('')
const newEmail = ref('')
const newPassword = ref('')
const saving = ref(false)

const isChangingPassword = ref(false)
const changePasswordData = ref({
  show: false,
  staffId: '',
  staffName: '',
  newPassword: ''
})

async function loadStaff() {
  loading.value = true
  errorMsg.value = ''
  try {
    // Tampilkan semua staf yang bukan admin, diurutkan abjad
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('is_admin', false)
      .order('name', { ascending: true })

    if (error) throw error
    staffs.value = data ?? []
  } catch (err) {
    errorMsg.value = err.message ?? 'Gagal memuat staff.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStaff()
})

async function addStaff() {
  const name = newName.value.trim()
  const email = newEmail.value.trim()
  const password = newPassword.value.trim()

  if (!name || !email || !password) {
    alert('Nama, Email, dan Password wajib diisi.')
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const adminAuth = createAdminClient()

    // Daftar user di Auth Supabase
    const { data: authData, error: authError } = await adminAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    })

    if (authError) throw authError
    const user = authData.user
    if (!user) {
      throw new Error('Gagal mendaur user (user tidak dikembalikan).')
    }
    
    // Insert ke public.staff tanpa atribut email & id
    const { error: dbError } = await supabase.from('staff').insert({
      name,
      is_admin: false,
      is_active: true,
      email : email,
      user_id: user.id
    })

    if (dbError) throw dbError

    // Bersihkan formulir & tutup formulir tambah
    newName.value = ''
    newEmail.value = ''
    newPassword.value = ''
    isAdding.value = false
    await loadStaff()

    alert('Staff berhasil ditambahkan! Mereka dapat login menggunakan formulir masuk.')
  } catch (err) {
    errorMsg.value = err?.message ?? 'Gagal menambahkan staff.'
  } finally {
    saving.value = false
  }
}

async function toggleActive(staff) {
  const action = staff.is_active ? 'menonaktifkan' : 'mengaktifkan'
  if (!confirm(`Yakin ingin ${action} staff ${staff.name}?`)) return

  try {
    const { error } = await supabase
      .from('staff')
      .update({ is_active: !staff.is_active })
      .eq('id', staff.id)

    if (error) throw error
    await loadStaff()
  } catch (err) {
    alert(err?.message ?? `Gagal ${action} staff.`)
  }
}

function prepareChangePassword(staff) {
  changePasswordData.value = {
    show: true,
    staffId: staff.user_id,
    staffName: staff.name,
    newPassword: ''
  }
}

async function changePassword() {
  const newPass = changePasswordData.value.newPassword.trim()
  if (!newPass) {
    alert('Password baru wajib diisi.')
    return
  }

  isChangingPassword.value = true
  
  try {
    const adminAuth = createAdminClient()
    const { data, error } = await adminAuth.auth.admin.updateUserById(
      changePasswordData.value.staffId,
      { password: newPass }
    )

    if (error) throw error

    alert('Password berhasil diubah!')
    changePasswordData.value.show = false
  } catch (err) {
    alert(err?.message ?? 'Gagal mengubah password. Pastikan VITE_SUPABASE_SERVICE_ROLE_KEY tersedia di .env')
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <div class="h-dvh bg-gradient-to-b from-pink-50 via-white to-rose-50/60 flex flex-col overflow-hidden">
    <header class="border-b border-pink-200/60 bg-gradient-to-r from-pink-100/90 via-white/95 to-pink-50/90 backdrop-blur shadow-sm shadow-pink-100/50 shrink-0">
      <div class="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="min-h-12 min-w-12 inline-flex items-center justify-center rounded-xl border border-pink-200 text-pink-800 bg-white shadow-sm active:bg-pink-50"
            @click="router.push({ name: 'dashboard' })"
          >
            <ArrowLeft class="h-6 w-6" />
          </button>
          <div>
            <h1 class="text-xl font-bold text-pink-950 leading-tight">Manajemen Staff</h1>
            <p class="text-xs font-medium uppercase tracking-wide text-pink-700/80">Mode Administrator</p>
          </div>
        </div>
      </div>
      <!-- Indeterminate Loading Bar -->
      <div v-show="loading || saving || isChangingPassword" class="absolute bottom-0 left-0 right-0 h-[2.5px] bg-pink-100 overflow-hidden">
        <div class="h-full bg-pink-500 w-full origin-left animate-indeterminate"></div>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-6 space-y-6 pb-20">
      
      <!-- Error Message -->
      <div v-if="errorMsg" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
        {{ errorMsg }}
      </div>

      <!-- Add Component -->
      <div v-if="!isAdding" class="flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-600/30 active:scale-[0.99] transition hover:bg-pink-700"
          @click="isAdding = true"
        >
          <UserPlus class="h-4 w-4" />
          Tambah Staff
        </button>
      </div>

      <div v-else class="rounded-3xl border border-pink-100 bg-white shadow-lg p-5">
        <h2 class="text-lg font-bold text-pink-950 mb-4">Pendaftaran Staff Baru</h2>
        <form @submit.prevent="addStaff" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-pink-900 mb-1">Nama Staff</label>
            <input
              v-model="newName"
              type="text"
              required
              placeholder="Contoh: Riska"
              class="w-full min-h-12 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-900 mb-1">Email</label>
            <input
              v-model="newEmail"
              type="email"
              required
              placeholder="nama@email.com"
              class="w-full min-h-12 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-pink-900 mb-1">Password Baru</label>
            <input
              v-model="newPassword"
              type="text"
              required
              placeholder="••••••••"
              class="w-full min-h-12 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            />
            <p class="text-[11px] text-pink-700 mt-1">Gunakan password yang mudah diingat oleh staf.</p>
          </div>
          
          <div class="flex gap-3 pt-3">
            <button
              type="button"
              class="w-1/3 min-h-12 rounded-xl border border-pink-200 bg-white text-pink-700 font-semibold active:bg-pink-50 transition"
              @click="isAdding = false"
              :disabled="saving"
            >
              Batal
            </button>
            <button
              type="submit"
              class="w-2/3 min-h-12 rounded-xl bg-pink-600 text-white font-semibold shadow-md shadow-pink-600/30 active:scale-[0.99] transition disabled:opacity-60"
              :disabled="saving"
            >
              Simpan Staff
            </button>
          </div>
        </form>
      </div>

      <!-- Staff List -->
      <div v-if="!staffs.length && !loading" class="text-center py-14 px-4">
        <div class="mx-auto mb-3 h-12 w-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center">
          <Users class="h-6 w-6" />
        </div>
        <p class="text-pink-900 font-medium">Belum ada data staff terdaftar.</p>
      </div>

      <ul v-else class="space-y-4">
        <li
          v-for="staff in staffs"
          :key="staff.id"
          class="rounded-3xl border border-pink-100 bg-white shadow-sm flex flex-col gap-2 p-5"
          :class="!staff.is_active ? 'opacity-80 bg-gray-50' : ''"
        >
          <div class="flex justify-between items-start">
            <div>
              <p class="text-base font-bold text-pink-950">{{ staff.name }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                  :class="staff.is_active ? 'bg-pink-100/60 text-pink-700' : 'bg-rose-100/60 text-rose-700'">
                  {{ staff.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
                <span v-if="staff.email" class="text-xs text-pink-800">{{ staff.email }}</span>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="min-h-10 min-w-10 flex items-center justify-center rounded-xl border border-pink-200 text-pink-600 hover:bg-pink-50 transition"
                title="Ubah Password"
                @click="prepareChangePassword(staff)"
                :disabled="!staff.is_active || isChangingPassword"
              >
                <Key class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="min-h-10 min-w-10 flex items-center justify-center rounded-xl border transition"
                :class="staff.is_active ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-pink-200 text-pink-600 hover:bg-pink-50'"
                title="Aktif/Nonaktifkan"
                @click="toggleActive(staff)"
              >
                <Power class="h-4 w-4" />
              </button>
            </div>
          </div>
        </li>
      </ul>

      <!-- Change Password Modal -->
      <div v-if="changePasswordData.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pink-950/40 backdrop-blur-sm">
        <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-pink-100">
          <div class="p-5 flex items-center justify-between border-b border-pink-100/60 bg-pink-50/50">
            <h3 class="font-bold text-pink-950 inline-flex items-center gap-2">
              <Key class="h-5 w-5 text-pink-600" />
              Ubah Password
            </h3>
            <button @click="changePasswordData.show = false" class="p-2 -mr-2 text-pink-400 hover:text-pink-600 rounded-full hover:bg-pink-100/50 transition">
              <X class="h-5 w-5" />
            </button>
          </div>
          <form @submit.prevent="changePassword" class="p-5 space-y-4">
            <p class="text-sm text-pink-800 leading-relaxed">
              Masukkan password baru untuk staff <span class="font-bold text-pink-950">{{ changePasswordData.staffName }}</span>:
            </p>
            <div>
              <input
                v-model="changePasswordData.newPassword"
                type="text"
                required
                placeholder="••••••••"
                class="w-full min-h-12 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              />
            </div>
            <div class="flex gap-3 pt-2">
              <button
                type="button"
                @click="changePasswordData.show = false"
                class="w-1/3 min-h-11 rounded-xl border border-pink-200 bg-white text-pink-700 font-semibold active:bg-pink-50 transition text-sm disabled:opacity-60"
                :disabled="isChangingPassword"
              >
                Batal
              </button>
              <button
                type="submit"
                class="w-2/3 min-h-11 rounded-xl bg-pink-600 text-white font-semibold shadow-md shadow-pink-600/30 active:scale-[0.99] transition text-sm disabled:opacity-60"
                :disabled="isChangingPassword"
              >
                {{ isChangingPassword ? 'Menyimpan...' : 'Simpan Password' }}
              </button>
            </div>
          </form>
        </div>
      </div>

    </main>
  </div>
</template>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%) scaleX(0.2); }
  50% { transform: translateX(0%) scaleX(0.4); }
  100% { transform: translateX(100%) scaleX(0.2); }
}
.animate-indeterminate {
  animation: indeterminate 1.5s infinite ease-in-out;
}
</style>
