import { getGoogleScriptRequestUrl } from '@/lib/googleScriptUrl'

/**
 * GET data transaksi dari Google Apps Script (deploy sebagai Web App, return JSON).
 */

const DATE_KEYS = [
  'transaction_date',
  'tanggal',
  'tgl',
  'date',
  'tanggal transaksi',
  'tanggal_transaksi',
]
const SERVICE_KEYS = [
  'service_name',
  'nama jasa',
  'jasa',
  'layanan',
  'nama_jasa',
]
const PRICE_KEYS = ['price', 'harga', 'nominal', 'total', 'jumlah', 'rp']
const STAFF_KEYS = [
  'staff',
  'nama staff',
  'petugas',
  'staff_names',
  'nama_staff',
  'staff name',
]
const KET_KEYS = ['keterangan', 'catatan', 'note', 'deskripsi']

function getValueCI(row, candidates) {
  if (!row || typeof row !== 'object') return undefined
  const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ')
  const cand = candidates.map((c) => norm(c))
  const entries = Object.entries(row)
  for (const [k, v] of entries) {
    const kl = norm(k)
    if (cand.includes(kl)) return v
  }
  for (const [k, v] of entries) {
    const kl = norm(k)
    for (const c of cand) {
      if (kl.includes(c) || c.includes(kl)) return v
    }
  }
  return undefined
}

/**
 * Angka IDR dari sheet: angka murni, "Rp 50.000", "50.000", dll.
 */
export function parseMoneyId(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits)
}

/**
 * Ke format YYYY-MM-DD untuk filter & grup.
 */
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
      // Excel serial date to JS date
      const d = new Date((val - 25569) * 86400 * 1000)
      return toLocalYMD(d)
    }
  }
  const s = String(val).trim()
  
  // Jika formatnya murni "YYYY-MM-DD", pulangkan langsung tanpa parsing
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }

  // Jika format mencakup waktu (seperti ISO string dengan 'T' atau spasi)
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    return toLocalYMD(new Date(t))
  }
  
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    return `${m[3]}-${mm}-${dd}`
  }
  return null
}

export function normalizeSheetRow(row, index) {
  const dateRaw = getValueCI(row, DATE_KEYS)
  const serviceRaw = getValueCI(row, SERVICE_KEYS)
  const priceRaw = getValueCI(row, PRICE_KEYS)
  const staffRaw = getValueCI(row, STAFF_KEYS)
  const ketRaw = getValueCI(row, KET_KEYS)

  const transaction_date = parseSheetDate(dateRaw)
  const price = parseMoneyId(priceRaw)
  const service_name =
    serviceRaw != null && String(serviceRaw).trim() !== ''
      ? String(serviceRaw).trim()
      : '—'
  const keterangan = ketRaw != null ? String(ketRaw).trim() : ''

  let staff_display = '—'
  let staff_array = []

  if (staffRaw != null) {
    if (Array.isArray(staffRaw)) {
      staff_array = staffRaw.map((x) => String(x).trim()).filter(Boolean)
    } else {
      // Jika Apps script mengembalikan string koma dari cell spreadsheet
      staff_array = String(staffRaw).split(',').map(s => s.trim()).filter(Boolean)
    }
    if (staff_array.length > 0) {
      staff_display = staff_array.join(', ')
    }
  }

  const id = row?.id ?? row?.ID ?? `sheet-${index}`

  return {
    id: String(id),
    transaction_date,
    service_name,
    price,
    keterangan,
    staff: staff_array, // Array format!
    staff_display,      // String format comma separated
  }
}

/**
 * GET JSON dari Web App. Mendukung: array, atau { rows|data|transactions|records: [...] }.
 */
export async function fetchTransactionsFromSheet() {
  const url = getGoogleScriptRequestUrl()
  if (!url) {
    throw new Error('VITE_GOOGLE_SCRIPT_URL belum diset di environment.')
  }

  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    })
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(
        'Gagal menghubungi Google Script (CORS Error). ' +
        'Penyebab utama: Deploy Google Apps Script belum benar. ' +
        'Pastikan Web App di-deploy dengan pengaturan: "Execute as: Me" dan "Who has access: Anyone" (Bukan "Only myself" atau "Anyone with Google Account").'
      )
    }
    throw e
  }

  if (!res.ok) {
    throw new Error(`Gagal mengambil data (${res.status}).`)
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Respons Google Script bukan JSON valid.')
  }
  const rows = Array.isArray(json)
    ? json
    : json?.rows ?? json?.data ?? json?.transactions ?? json?.records ?? []

  if (!Array.isArray(rows)) {
    throw new Error('Format JSON: harus array atau object dengan array rows/data/transactions.')
  }

  return rows.map((row, i) => normalizeSheetRow(row, i))
}

/** Filter baris yang punya tanggal dalam rentang [start, end] YYYY-MM-DD */
export function filterByMonthYear(rows, start, end) {
  return rows.filter((r) => {
    if (!r.transaction_date) return false
    return r.transaction_date >= start && r.transaction_date <= end
  })
}
