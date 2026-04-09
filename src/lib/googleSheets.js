// Firebase Cloud Function URLs (v2 = individual Cloud Run URLs)
const FB_GET_TRANSACTIONS = import.meta.env.VITE_FB_GET_TRANSACTIONS
const FB_ADD_TRANSACTION = import.meta.env.VITE_FB_ADD_TRANSACTION
const FB_EDIT_TRANSACTION = import.meta.env.VITE_FB_EDIT_TRANSACTION
const FB_DELETE_TRANSACTION = import.meta.env.VITE_FB_DELETE_TRANSACTION

const DATE_KEYS = ['transaction_date', 'tanggal', 'tgl', 'date']
const SERVICE_KEYS = ['service_name', 'jasa', 'layanan']
const PRICE_KEYS = ['price', 'harga', 'nominal']
const KET_KEYS = ['keterangan', 'catatan', 'note']

// Fungsi helper tetap sama untuk fleksibilitas
function getValueCI(row, candidates) {
  if (!row || typeof row !== 'object') return undefined
  const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ')
  const cand = candidates.map((c) => norm(c))
  const entries = Object.entries(row)
  for (const [k, v] of entries) {
    const kl = norm(k)
    if (cand.includes(kl)) return v
  }
  return undefined
}

export function parseMoneyId(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function toLocalYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseSheetDate(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (val > 1e12) return toLocalYMD(new Date(val))
    if (val > 30000 && val < 80000) {
      const d = new Date((val - 25569) * 86400 * 1000)
      return toLocalYMD(d)
    }
  }
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return toLocalYMD(new Date(t))
  return null
}

/**
 * Normalisasi baris data
 */
export function normalizeSheetRow(row, index) {
  const dateRaw = getValueCI(row, DATE_KEYS)
  const serviceRaw = getValueCI(row, SERVICE_KEYS)
  const priceRaw = getValueCI(row, PRICE_KEYS)
  const ketRaw = getValueCI(row, KET_KEYS)

  const transaction_date = parseSheetDate(dateRaw)
  const price = parseMoneyId(priceRaw)
  const service_name = serviceRaw != null && String(serviceRaw).trim() !== '' ? String(serviceRaw).trim() : '—'
  const keterangan = ketRaw != null ? String(ketRaw).trim() : ''

  // Staff sudah kita bersihkan di level fetch
  const staff_array = Array.isArray(row.staff) ? row.staff : []

  return {
    id: String(row.id || `sheet-${index}`),
    transaction_date,
    service_name,
    price,
    keterangan,
    staff: staff_array,
    staff_display: staff_array.length > 0 ? staff_array.join(', ') : '—',
  }
}

/**
 * GET DATA — via Firebase Cloud Function
 */
export async function fetchTransactionsFromSheet(tahun) {
  const year = String(tahun || new Date().getFullYear())
  const url = `${FB_GET_TRANSACTIONS}?tahun=${year}`

  try {
    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Firebase Function Error: ${res.status}`)
    }

    const rows = await res.json()

    if (!rows || rows.length === 0) return []

    return rows.map((row, i) => normalizeSheetRow(row, i))
  } catch (e) {
    console.error('Gagal ambil data dari Firebase:', e)
    throw e
  }
}

/**
 * ADD TRANSACTION — via Firebase Cloud Function
 */
export async function addTransaction(payload) {
  const res = await fetch(FB_ADD_TRANSACTION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gagal menambah transaksi (${res.status})`)
  }
  return res.json()
}

/**
 * EDIT TRANSACTION — via Firebase Cloud Function
 */
export async function editTransaction(payload) {
  const res = await fetch(FB_EDIT_TRANSACTION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gagal mengedit transaksi (${res.status})`)
  }
  return res.json()
}

/**
 * DELETE TRANSACTION — via Firebase Cloud Function
 */
export async function deleteTransaction(payload) {
  const res = await fetch(FB_DELETE_TRANSACTION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gagal menghapus transaksi (${res.status})`)
  }
  return res.json()
}

export function filterByMonthYear(rows, start, end) {
  return rows.filter((r) => {
    if (!r.transaction_date) return false
    return r.transaction_date >= start && r.transaction_date <= end
  })
}