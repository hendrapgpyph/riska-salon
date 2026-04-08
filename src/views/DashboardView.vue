<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  LogOut,
  Plus,
  CalendarDays,
  Sparkles,
  RefreshCw,
  Users,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import TransactionModal from '@/components/TransactionModal.vue'
import {
  fetchTransactionsFromSheet,
  filterByMonthYear,
} from '@/lib/googleSheets'

const auth = useAuthStore()
const router = useRouter()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

/** Semua baris normalisasi dari Google Sheets (GET terakhir) */
const allRows = ref([])
const loading = ref(false)
const loadError = ref('')
const modalOpen = ref(false)
const selectedTransaction = ref(null)

function openModalNew() {
  selectedTransaction.value = null
  modalOpen.value = true
}

function openModalEdit(t) {
  selectedTransaction.value = t
  modalOpen.value = true
}

const scrollEl = ref(null)
const pullStartY = ref(0)
const pullDistance = ref(0)
const pullActive = ref(false)
const PULL_THRESHOLD = 72

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' }),
}))

const yearOptions = computed(() => {
  const y = now.getFullYear()
  return Array.from({ length: 7 }, (_, i) => y - 3 + i)
})

const range = computed(() => {
  const m = month.value
  const y = year.value
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
})

const transactions = computed(() =>
  filterByMonthYear(allRows.value, range.value.start, range.value.end)
)

const totalPendapatan = computed(() =>
  transactions.value.reduce((sum, t) => sum + Number(t.price) || 0, 0)
)

const groupedByDate = computed(() => {
  const map = new Map()
  for (const t of transactions.value) {
    const d = t.transaction_date
    if (!d) continue
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(t)
  }
  return [...map.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([date, items]) => {
      const sortedItems = [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)))
      const dailyTotal = sortedItems.reduce((acc, t) => acc + (Number(t.price) || 0), 0)
      return {
        date,
        items: sortedItems,
        dailyTotal,
      }
    })
})

function formatRupiah(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(x)
}

function formatTanggalLabel(isoDate) {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

async function loadTransactions() {
  loadError.value = ''
  loading.value = true
  try {
    const rows = await fetchTransactionsFromSheet()
    allRows.value = rows
  } catch (e) {
    loadError.value = e?.message ?? 'Gagal memuat data dari Google Sheets.'
    allRows.value = []
  } finally {
    loading.value = false
  }
}

function onTouchStart(e) {
  const el = scrollEl.value
  if (!el || el.scrollTop > 0) return
  pullActive.value = true
  pullStartY.value = e.touches[0].clientY
  pullDistance.value = 0
}

function onTouchMove(e) {
  if (!pullActive.value || !scrollEl.value) return
  if (scrollEl.value.scrollTop > 0) {
    pullDistance.value = 0
    return
  }
  const dy = e.touches[0].clientY - pullStartY.value
  if (dy > 0) pullDistance.value = Math.min(dy, 120)
}

function onTouchEnd() {
  if (!pullActive.value) return
  pullActive.value = false
  if (scrollEl.value?.scrollTop === 0 && pullDistance.value >= PULL_THRESHOLD) {
    loadTransactions()
  }
  pullDistance.value = 0
}

onMounted(() => {
  loadTransactions()
})

onUnmounted(() => {
  pullActive.value = false
})

async function logout() {
  try {
    await auth.signOut()
  } finally {
    router.replace({ name: 'login' })
  }
}

function onModalSaved() {
  loadTransactions()
}

const userId = computed(() => auth.user?.id ?? '')

const pullHintOpacity = computed(() =>
  Math.min(1, pullDistance.value / PULL_THRESHOLD)
)
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-pink-50 via-white to-rose-50/60 flex flex-col">
    <header class="sticky top-0 z-40 border-b border-pink-200/60 bg-gradient-to-r from-pink-100/90 via-white/95 to-pink-50/90 backdrop-blur shrink-0 shadow-sm shadow-pink-100/50">
      <div class="max-w-lg mx-auto px-4 pt-4 pb-3">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-full overflow-hidden shadow-sm shadow-pink-600/10 border-[1.5px] border-white shrink-0">
              <img src="@/assets/logo.jpg" alt="Logo" class="h-full w-full object-cover scale-[1.02]" />
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-pink-700/80">Riska Salon</p>
              <h1 class="text-xl font-bold text-pink-950 leading-tight">Transaksi</h1>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="min-h-12 min-w-12 inline-flex items-center justify-center rounded-xl border border-pink-200 text-pink-800 bg-white shadow-sm active:bg-pink-50 disabled:opacity-50"
              title="Muat ulang dari Google Sheets"
              :disabled="loading"
              aria-label="Refresh data"
              @click="loadTransactions"
            >
              <RefreshCw class="h-5 w-5" :class="{ 'animate-spin': loading }" />
            </button>
            <button
              v-if="auth.isAdmin"
              type="button"
              class="min-h-12 min-w-12 inline-flex items-center justify-center rounded-xl border border-pink-200 text-pink-800 bg-white shadow-sm active:bg-pink-50"
              title="Manajemen Staff"
              @click="router.push({ name: 'staff' })"
            >
              <Users class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="min-h-12 min-w-12 inline-flex items-center justify-center rounded-xl border border-pink-200 text-rose-700 bg-white shadow-sm active:bg-rose-50"
              title="Keluar"
              @click="logout"
            >
              <LogOut class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 text-pink-800 mb-2">
          <CalendarDays class="h-4 w-4 shrink-0" />
          <span class="text-sm font-medium">Filter periode</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="sr-only" for="bulan">Bulan</label>
            <select
              id="bulan"
              v-model.number="month"
              class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            >
              <option v-for="opt in monthOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="sr-only" for="tahun">Tahun</label>
            <select
              id="tahun"
              v-model.number="year"
              class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-3 text-base font-medium text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
            >
              <option v-for="y in yearOptions" :key="y" :value="y">
                {{ y }}
              </option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Indeterminate Loading Bar -->
      <div v-show="loading" class="absolute bottom-0 left-0 right-0 h-[2.5px] bg-pink-100 overflow-hidden">
        <div class="h-full bg-pink-500 w-full origin-left animate-indeterminate"></div>
      </div>
    </header>

    <div
      ref="scrollEl"
      class="flex-1 max-w-lg mx-auto w-full min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 pb-40 touch-pan-y"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div
        v-if="pullDistance > 8"
        class="flex flex-col items-center justify-center gap-1 transition-opacity duration-150 pointer-events-none mb-2"
        :style="{ opacity: pullHintOpacity }"
        aria-hidden="true"
      >
        <RefreshCw class="h-5 w-5 text-pink-600" />
        <span class="text-xs text-pink-700">Lepaskan untuk memuat ulang</span>
      </div>

      <p v-if="loading && !allRows.length" class="text-sm text-pink-700 py-6 text-center">Memuat dari Google Sheets…</p>
      <p
        v-else-if="loadError"
        class="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2"
      >
        {{ loadError }}
      </p>

      <div v-else-if="!groupedByDate.length" class="text-center py-14 px-4">
        <div
          class="mx-auto mb-3 h-12 w-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center"
        >
          <Sparkles class="h-6 w-6" />
        </div>
        <p class="text-pink-900 font-medium">Belum ada transaksi di periode ini</p>
        <p class="text-sm text-pink-700/80 mt-1">
          Data dari Google Sheets — ubah bulan/tahun atau tap refresh. Tombol + untuk input baru.
        </p>
      </div>

      <section v-else class="space-y-6">
        <article v-for="group in groupedByDate" :key="group.date" class="space-y-3">
          <h2 class="text-sm font-semibold text-pink-800 sticky top-0 z-10 -mx-1 px-1 py-1 bg-pink-50/95 backdrop-blur rounded-lg border border-pink-100/80 flex items-center justify-between">
            <span>{{ formatTanggalLabel(group.date) }}</span>
            <span class="text-xs font-bold text-pink-700 bg-white/60 px-2 py-0.5 rounded-md border border-pink-200/50 tabular-nums">
              {{ formatRupiah(group.dailyTotal) }}
            </span>
          </h2>
          <ul class="space-y-3">
            <li
              v-for="t in group.items"
              :key="t.id"
              class="rounded-2xl border border-pink-100 bg-white shadow-sm shadow-pink-900/5 p-4 cursor-pointer active:scale-[0.98] active:bg-pink-50/50 transition duration-200"
              @click="openModalEdit(t)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-pink-950 leading-snug">{{ t.service_name }}</p>
                  <p class="text-sm text-pink-800/90 mt-1">
                    <span class="font-medium">Staff:</span> {{ t.staff_display }}
                  </p>
                  <p v-if="t.keterangan" class="text-sm text-pink-700/90 mt-2">
                    {{ t.keterangan }}
                  </p>
                </div>
                <p class="shrink-0 text-base font-bold text-pink-700 tabular-nums">
                  {{ formatRupiah(t.price) }}
                </p>
              </div>
            </li>
          </ul>
        </article>
      </section>
    </div>

    <footer class="sticky bottom-0 z-30 border-t border-pink-200 bg-white/95 backdrop-blur shrink-0">
      <div class="max-w-lg mx-auto px-4 py-4">
        <p class="text-xs font-medium text-pink-700/90 uppercase tracking-wide">Total pendapatan</p>
        <p class="text-3xl sm:text-4xl font-extrabold text-pink-900 tabular-nums tracking-tight">
          {{ formatRupiah(totalPendapatan) }}
        </p>
        <p class="text-xs text-pink-700/70 mt-1">
          {{ monthOptions.find((m) => m.value === month)?.label }} {{ year }} · dari Google Sheets
        </p>
      </div>
    </footer>

    <button
      type="button"
      class="fixed bottom-24 right-4 z-50 min-h-16 min-w-16 rounded-2xl bg-pink-600 text-white shadow-xl shadow-pink-700/30 flex items-center justify-center active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
      title="Transaksi baru"
      aria-label="Tambah transaksi"
      @click="openModalNew"
    >
      <Plus class="h-8 w-8" stroke-width="2.5" />
    </button>

    <TransactionModal
      :open="modalOpen"
      :user-id="userId"
      :transaction-data="selectedTransaction"
      @close="modalOpen = false"
      @saved="onModalSaved"
      @deleted="onModalSaved"
    />
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
