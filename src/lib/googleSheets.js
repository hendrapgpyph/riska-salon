import { getGoogleScriptRequestUrl } from '@/lib/googleScriptUrl'

// Ambil config dari env
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

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
 * GET DATA (CEPAT) - Menggunakan API v4
 */
export async function fetchTransactionsFromSheet(tahun) {
  const sheetName = String(tahun || new Date().getFullYear())
  // Range A:H sesuai struktur: ID, Tanggal, Jasa, Harga, Staff 1, Staff 2, Staff 3, Keterangan
  const range = `${sheetName}!A:H`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`

  try {
    const res = await fetch(url)

    if (!res.ok) {
      // Cek apakah sheet belum ada (INVALID_ARGUMENT)
      const errJson = await res.json().catch(() => null)
      if (errJson?.error?.status === 'INVALID_ARGUMENT') {
        // Sheet untuk tahun ini belum dibuat, kembalikan kosong
        return []
      }
      throw new Error(`Sheets API Error: ${res.status}`)
    }

    const json = await res.json()
    const values = json.values

    if (!values || values.length <= 1) return []

    // Index kolom berdasarkan strukturmu:
    // 0:ID, 1:Tanggal, 2:Jasa, 3:Harga, 4:Staff 1, 5:Staff 2, 6:Staff 3, 7:Keterangan
    return values.slice(1).map((row, i) => {
      const rowObj = {
        id: row[0],
        tanggal: row[1],
        jasa: row[2],
        harga: row[3],
        // Ambil kolom 4, 5, 6 dan bersihkan jika kosong
        staff: [row[4], row[5], row[6]].filter(s => s && String(s).trim() !== ""),
        keterangan: row[7]
      }

      return normalizeSheetRow(rowObj, i)
    })
  } catch (e) {
    console.error('Gagal ambil data cepat:', e)
    throw e
  }
}

/**
 * POST/EDIT/DELETE - Tetap gunakan Apps Script
 */
export async function sendToGoogleScript(payload) {
  const url = getGoogleScriptRequestUrl()
  if (!url) throw new Error('VITE_GOOGLE_SCRIPT_URL belum diset.')

  return fetch(url, {
    method: 'POST',
    // Gunakan mode cors jika Apps Script sudah diset Anyone
    mode: 'cors',
    body: JSON.stringify(payload)
  })
}

export function filterByMonthYear(rows, start, end) {
  return rows.filter((r) => {
    if (!r.transaction_date) return false
    return r.transaction_date >= start && r.transaction_date <= end
  })
}