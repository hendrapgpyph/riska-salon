<script setup>
import { ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { getGoogleScriptRequestUrl } from '@/lib/googleScriptUrl'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  userId: { type: String, default: '' },
  transactionData: { type: Object, default: null }, // Tambahan untuk mode edit
})

const emit = defineEmits(['close', 'saved', 'deleted'])

const services = ref([])
const staffList = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

const serviceNameInput = ref('')
const price = ref('')
const formattedPrice = computed({
  get: () => {
    if (!price.value) return ''
    return Number(price.value).toLocaleString('id-ID')
  },
  set: (val) => {
    // Ambil hanya angka saja
    price.value = val.replace(/\D/g, '')
  }
})
const keterangan = ref('')
const selectedStaffIds = ref([])

const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const transactionDate = ref(todayStr())

const fpConfig = ref({
  locale: Indonesian,
  altInput: true,
  altFormat: 'l, j F Y',
  dateFormat: 'Y-m-d',
  disableMobile: "true",
  altInputClass: "w-full min-h-14 rounded-xl border border-pink-200 bg-white px-4 text-lg text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
})

const isServiceDropdownOpen = ref(false)
const filteredServices = computed(() => {
  if (!serviceNameInput.value) return services.value
  const query = serviceNameInput.value.toLowerCase()
  return services.value.filter(s => s.name.toLowerCase().includes(query))
})

function selectService(name, priceValue) {
  serviceNameInput.value = name
  if (priceValue != null) price.value = String(priceValue)
  isServiceDropdownOpen.value = false
}

const selectedService = computed(() => {
  const inputLower = serviceNameInput.value.trim().toLowerCase()
  return services.value.find((s) => s.name.toLowerCase() === inputLower)
})

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    errorMsg.value = ''
    
    await loadOptions()

    if (props.transactionData) {
      // PRE-FILL MODE EDIT
      const t = props.transactionData
      transactionDate.value = t.transaction_date || todayStr()
      serviceNameInput.value = t.service_name || ''
      price.value = String(t.price || '')
      keterangan.value = t.keterangan || ''
      
      // staff merupakan array nama ['Riska', 'Putu'], kita harus cari ID-nya di staffList
      const sIds = []
      if (Array.isArray(t.staff)) {
        for (const name of t.staff) {
          const match = staffList.value.find(s => String(s.name).toLowerCase() === String(name).toLowerCase())
          if (match) sIds.push(String(match.id))
        }
      }
      selectedStaffIds.value = sIds
    } else {
      // MODE ADD: Reset
      transactionDate.value = todayStr()
      serviceNameInput.value = ''
      price.value = ''
      keterangan.value = ''
      selectedStaffIds.value = []
    }
  }
)

watch(selectedService, (svc) => {
  if (svc && svc.price != null) {
    price.value = String(svc.price)
  }
})

async function loadOptions() {
  loading.value = true
  try {
    const [svcRes, staffRes] = await Promise.all([
      supabase.from('services').select('id,name,price').order('name'),
      supabase.from('staff').select('id,name').order('name'),
    ])
    if (svcRes.error) throw svcRes.error
    if (staffRes.error) throw staffRes.error
    services.value = svcRes.data ?? []
    staffList.value = staffRes.data ?? []
  } catch (e) {
    errorMsg.value = e?.message ?? 'Gagal memuat data jasa & staff.'
  } finally {
    loading.value = false
  }
}

function toggleStaff(id) {
  const sid = String(id)
  const i = selectedStaffIds.value.indexOf(sid)
  if (i === -1) selectedStaffIds.value = [...selectedStaffIds.value, sid]
  else selectedStaffIds.value = selectedStaffIds.value.filter((x) => x !== sid)
}

function close() {
  emit('close')
}

async function save() {
  errorMsg.value = ''
  if (!props.userId) {
    errorMsg.value = 'Sesi tidak valid. Silakan login ulang.'
    return
  }
  const name = serviceNameInput.value.trim()
  if (!name) {
    errorMsg.value = 'Pilih atau ketik jasa terlebih dahulu.'
    return
  }
  
  const priceNum = Number(price.value)
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    errorMsg.value = 'Harga tidak valid.'
    return
  }

  saving.value = true
  try {
    let finalServiceId = selectedService.value?.id

    // Jika jasa baru, simpan ke supabase
    if (!finalServiceId) {
      const { data: newSvc, error: newSvcErr } = await supabase
        .from('services')
        .insert({ name: name, price: priceNum })
        .select('id')
        .single()
      
      if (newSvcErr) throw newSvcErr
      finalServiceId = newSvc.id
      
      // Update local state so it appears next time
      services.value.push({ id: finalServiceId, name: name, price: priceNum })
    }

    const staffNames = staffList.value
      .filter((s) => selectedStaffIds.value.includes(String(s.id)))
      .map((s) => s.name)
      // .join(', ') tidak ada, dikirim sebagai Array

    const sheetUrl = getGoogleScriptRequestUrl()
    if (!sheetUrl) {
      throw new Error('URL Google Script belum diatur di .env')
    }

    const payload = {
      action: props.transactionData ? 'edit' : 'add',
      id: props.transactionData?.id || Date.now().toString(),
      tanggal: transactionDate.value,
      jasa: name,
      harga: priceNum,
      staff: staffNames, // staffNames adalah array: ["Hendra", "Riska"]
      keterangan: keterangan.value?.trim() || ''
    }

    const res = await fetch(sheetUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' }, 
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`Data gagal disimpan ke Spreadsheet (${res.status}).`)
    }

    emit('saved')
    close()
  } catch (e) {
    errorMsg.value = e?.message ?? 'Gagal menyimpan transaksi.'
  } finally {
    saving.value = false
  }
}

async function hapus() {
  const t = props.transactionData
  if (!t || !t.id) return
  if (!confirm('Yakin ingin menghapus transaksi ini?')) return

  saving.value = true
  errorMsg.value = ''
  try {
    const sheetUrl = getGoogleScriptRequestUrl()
    if (!sheetUrl) throw new Error('URL Google Script belum diatur di .env')

    const payload = {
      action: 'delete',
      id: String(t.id)
    }

    const res = await fetch(sheetUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`Gagal menghapus di Spreadsheet (${res.status}).`)
    }

    emit('deleted')
    close()
  } catch (e) {
    errorMsg.value = e?.message ?? 'Gagal menghapus transaksi.'
  } finally {
    saving.value = false
  }
}

defineExpose({ save, hapus })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        class="absolute inset-0 bg-pink-950/40 backdrop-blur-[2px]"
        aria-label="Tutup"
        @click="close"
      />
      <div
        class="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-pink-100 max-h-[90dvh] overflow-y-auto"
      >
        <div class="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-pink-100 bg-white/95 backdrop-blur rounded-t-3xl z-10">
          <h2 class="text-lg font-bold text-pink-950">
            {{ props.transactionData ? 'Edit Transaksi' : 'Transaksi Baru' }}
          </h2>
          <button
            type="button"
            class="min-h-12 min-w-12 inline-flex items-center justify-center rounded-xl border border-pink-200 text-pink-800 active:bg-pink-50"
            @click="close"
          >
            <X class="h-6 w-6" />
          </button>
        </div>

        <div class="p-5 space-y-5 pb-28 sm:pb-6">
          <p v-if="loading" class="text-sm text-pink-700">Memuat data…</p>

          <div>
            <label class="block text-sm font-medium text-pink-900 mb-2">Tanggal</label>
            <flat-pickr
              v-model="transactionDate"
              :config="fpConfig"
            />
          </div>

          <div class="relative">
            <label class="block text-sm font-medium text-pink-900 mb-2">Jasa</label>
            <input
              v-model="serviceNameInput"
              type="text"
              autocomplete="off"
              class="w-full min-h-14 rounded-xl border border-pink-200 bg-white px-4 text-lg text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              placeholder="Ketik jasa atau pilih..."
              @focus="isServiceDropdownOpen = true"
              @blur="isServiceDropdownOpen = false"
            />
            <div
              v-if="isServiceDropdownOpen && filteredServices.length > 0"
              class="absolute z-[110] mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-pink-100 bg-white p-1 shadow-xl shadow-pink-900/5 origin-top"
            >
              <button
                v-for="s in filteredServices"
                :key="s.id"
                type="button"
                class="w-full text-left px-4 py-3 rounded-lg text-pink-950 hover:bg-pink-50 active:bg-pink-100 transition"
                @mousedown.prevent="selectService(s.name, s.price)"
              >
                <span class="block font-medium">{{ s.name }}</span>
                <span class="block text-sm opacity-70">Rp {{ Number(s.price).toLocaleString('id-ID') }}</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-pink-900 mb-2">Harga</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-pink-400 font-medium">Rp</span>
              <input
                v-model="formattedPrice"
                type="text"
                inputmode="numeric"
                class="w-full min-h-14 rounded-xl border border-pink-200 pl-12 pr-4 text-lg text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <span class="block text-sm font-medium text-pink-900 mb-2">Staff</span>
            <div class="rounded-xl border border-pink-200 divide-y divide-pink-100 overflow-hidden">
              <label
                v-for="s in staffList"
                :key="s.id"
                class="flex items-center gap-3 min-h-14 px-4 bg-white active:bg-pink-50/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="h-5 w-5 rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                  :checked="selectedStaffIds.includes(String(s.id))"
                  @change="toggleStaff(s.id)"
                />
                <span class="text-base text-pink-950">{{ s.name }}</span>
              </label>
              <p v-if="!staffList.length && !loading" class="px-4 py-3 text-sm text-pink-700">
                Belum ada data staff di tabel <code class="text-xs">staff</code>.
              </p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-pink-900 mb-2">Keterangan</label>
            <textarea
              v-model="keterangan"
              rows="3"
              class="w-full rounded-xl border border-pink-200 px-4 py-3 text-base text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-500/40 resize-none"
              placeholder="Opsional"
            />
          </div>

          <p
            v-if="errorMsg"
            class="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2"
          >
            {{ errorMsg }}
          </p>
        </div>

        <div
          class="sticky bottom-0 p-4 border-t border-pink-100 bg-white/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:px-5 sm:pb-5 flex gap-3"
        >
          <button
            v-if="props.transactionData"
            type="button"
            class="w-1/3 min-h-14 rounded-xl bg-rose-50 text-rose-700 text-lg font-semibold border border-rose-200 active:scale-[0.99] transition disabled:opacity-60"
            :disabled="saving || loading"
            @click="hapus"
          >
            Hapus
          </button>
          <button
            type="button"
            class="flex-1 min-h-14 rounded-xl bg-pink-600 text-white text-lg font-semibold shadow-md shadow-pink-600/30 active:scale-[0.99] transition disabled:opacity-60"
            :disabled="saving || loading"
            @click="save"
          >
            {{ saving ? 'Menyimpan…' : (props.transactionData ? 'Simpan Edit' : 'Simpan') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
