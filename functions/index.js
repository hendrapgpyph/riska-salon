const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {google} = require("googleapis");
const path = require("path");

setGlobalOptions({maxInstances: 10});

// ── Auth & Sheets client ─────────────────────────
const SPREADSHEET_ID =
    "19w3p-UQj8vQs_Df9ZOA__wQdjuJwRDr70EnKqGJWfII";
const SERVICE_ACCOUNT_PATH =
    path.join(__dirname, "service-account.json");
const fnOpts = {cors: true, invoker: "public"};

/**
 * Buat authenticated Google Sheets client.
 * @return {object} Google Sheets API client.
 */
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return google.sheets({version: "v4", auth});
}

/**
 * Dapatkan sheetId (numeric) dari nama sheet.
 * @param {object} sheets - Sheets API client.
 * @param {string} sheetName - Nama sheet.
 * @return {number} sheetId atau -1.
 */
async function getSheetId(sheets, sheetName) {
  const sp = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const found = sp.data.sheets.find(
      (s) => s.properties.title === sheetName,
  );
  return found ? found.properties.sheetId : -1;
}

/**
 * Sort sheet berdasarkan kolom Tanggal (B) A-Z.
 * @param {object} sheets - Sheets API client.
 * @param {number} sheetId - Numeric sheet ID.
 * @return {Promise} batchUpdate result.
 */
async function sortByTanggal(sheets, sheetId) {
  return sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        sortRange: {
          range: {
            sheetId,
            startRowIndex: 1, // skip header
            startColumnIndex: 0,
            endColumnIndex: 8, // A-H
          },
          sortSpecs: [{
            dimensionIndex: 1, // kolom B = Tanggal
            sortOrder: "ASCENDING",
          }],
        },
      }],
    },
  });
}

/**
 * Hide kolom A (ID) di sheet.
 * @param {object} sheets - Sheets API client.
 * @param {number} sheetId - Numeric sheet ID.
 * @return {Promise} batchUpdate result.
 */
async function hideColumnA(sheets, sheetId) {
  return sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0, // kolom A
            endIndex: 1,
          },
          properties: {hiddenByUser: true},
          fields: "hiddenByUser",
        },
      }],
    },
  });
}

// ── GET TRANSACTIONS ─────────────────────────────
exports.getTransactions = onRequest(
    fnOpts,
    async (req, res) => {
      try {
        if (req.method !== "GET") {
          return res.status(405).json({
            error: "Method not allowed",
          });
        }

        const tahun = req.query.tahun ||
            new Date().getFullYear();
        const sheetName = String(tahun);
        const range = `${sheetName}!A:H`;
        const sheets = getSheetsClient();

        const result =
            await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range,
            });

        const values = result.data.values;
        if (!values || values.length <= 1) {
          return res.json([]);
        }

        // Kolom: 0:ID, 1:Tanggal, 2:Jasa, 3:Harga,
        //   4:Staff1, 5:Staff2, 6:Staff3, 7:Ket
        const rows = values.slice(1).map((row) => ({
          id: row[0] || "",
          tanggal: row[1] || "",
          jasa: row[2] || "",
          harga: row[3] || "",
          staff: [row[4], row[5], row[6]].filter(
              (s) => s && String(s).trim() !== "",
          ),
          keterangan: row[7] || "",
        }));

        return res.json(rows);
      } catch (err) {
        const errMsg = err && err.errors &&
            err.errors[0] && err.errors[0].message;
        if (errMsg &&
            errMsg.includes("Unable to parse range")) {
          return res.json([]);
        }
        console.error("getTransactions error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
    },
);

// ── Helper: cari baris berdasarkan ID (kolom A) ──
/**
 * Cari baris berdasarkan ID (kolom A).
 * @param {object} sheets - Sheets API client.
 * @param {string} sheetName - Nama sheet.
 * @param {string} id - ID transaksi.
 * @return {number} 1-indexed row, -1 jika not found.
 */
async function findRowIndexById(sheets, sheetName, id) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  const values = result.data.values || [];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      return i + 1;
    }
  }
  return -1;
}

// ── ADD TRANSACTION ──────────────────────────────
exports.addTransaction = onRequest(
    fnOpts,
    async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method not allowed",
          });
        }

        const body = typeof req.body === "string" ?
          JSON.parse(req.body) : req.body;
        const {
          id, tanggal, jasa, harga,
          staff, keterangan,
        } = body;

        if (!tanggal || !jasa) {
          return res.status(400).json({
            error: "tanggal dan jasa wajib diisi",
          });
        }

        const year = String(tanggal).substring(0, 4);
        const sheetName = year;
        const sheets = getSheetsClient();
        let sheetId;

        // Pastikan sheet ada, jika belum → buat
        try {
          await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
          });
          sheetId = await getSheetId(
              sheets, sheetName,
          );
        } catch (e) {
          // Sheet belum ada, buat baru
          const addRes =
              await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                  requests: [{
                    addSheet: {
                      properties: {title: sheetName},
                    },
                  }],
                },
              });
          sheetId = addRes.data.replies[0]
              .addSheet.properties.sheetId;

          // Tambah header
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:H1`,
            valueInputOption: "RAW",
            requestBody: {
              values: [[
                "ID", "Tanggal", "Jasa", "Harga",
                "Staff 1", "Staff 2", "Staff 3",
                "Keterangan",
              ]],
            },
          });

          // Hide kolom A (ID) di sheet baru
          await hideColumnA(sheets, sheetId);
        }

        const staffArr = Array.isArray(staff) ?
          staff : [];
        const rowId = id || Date.now().toString();

        const newRow = [
          rowId,
          tanggal,
          jasa,
          harga || 0,
          staffArr[0] || "",
          staffArr[1] || "",
          staffArr[2] || "",
          keterangan || "",
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:H`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: {values: [newRow]},
        });

        // Re-sort by Tanggal (kolom B) A-Z
        await sortByTanggal(sheets, sheetId);

        return res.json({success: true, id: rowId});
      } catch (err) {
        console.error("addTransaction error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
    },
);

// ── EDIT TRANSACTION ─────────────────────────────
exports.editTransaction = onRequest(
    fnOpts,
    async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method not allowed",
          });
        }

        const body = typeof req.body === "string" ?
          JSON.parse(req.body) : req.body;
        const {
          id, tanggal, jasa, harga,
          staff, keterangan,
        } = body;

        if (!id) {
          return res.status(400).json({
            error: "id wajib diisi untuk edit",
          });
        }

        const year = String(tanggal).substring(0, 4);
        const sheetName = year;
        const sheets = getSheetsClient();

        const rowIndex = await findRowIndexById(
            sheets, sheetName, id,
        );
        if (rowIndex === -1) {
          return res.status(404).json({
            error: `ID ${id} tidak ditemukan`,
          });
        }

        const staffArr = Array.isArray(staff) ?
          staff : [];
        const updatedRow = [
          id,
          tanggal,
          jasa,
          harga || 0,
          staffArr[0] || "",
          staffArr[1] || "",
          staffArr[2] || "",
          keterangan || "",
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range:
            `${sheetName}!A${rowIndex}:H${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: {values: [updatedRow]},
        });

        // Re-sort by Tanggal (kolom B) A-Z
        const sheetId = await getSheetId(
            sheets, sheetName,
        );
        await sortByTanggal(sheets, sheetId);

        return res.json({success: true, id});
      } catch (err) {
        console.error("editTransaction error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
    },
);

// ── DELETE TRANSACTION ───────────────────────────
exports.deleteTransaction = onRequest(
    fnOpts,
    async (req, res) => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method not allowed",
          });
        }

        const body = typeof req.body === "string" ?
          JSON.parse(req.body) : req.body;
        const {id, tahun} = body;

        if (!id) {
          return res.status(400).json({
            error: "id wajib diisi untuk delete",
          });
        }

        const year = tahun ||
            new Date().getFullYear();
        const sheetName = String(year);
        const sheets = getSheetsClient();

        const rowIndex = await findRowIndexById(
            sheets, sheetName, id,
        );
        if (rowIndex === -1) {
          return res.status(404).json({
            error: `ID ${id} tidak ditemukan`,
          });
        }

        const sheetId = await getSheetId(
            sheets, sheetName,
        );
        if (sheetId === -1) {
          return res.status(404).json({
            error: `Sheet ${sheetName} not found`,
          });
        }

        // Hapus baris
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            }],
          },
        });

        return res.json({success: true, id});
      } catch (err) {
        console.error("deleteTransaction error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
    },
);
