# Samudra Finance — Web App

Aplikasi keuangan Samudra Swimming School. React + Vite, tersambung ke Supabase.
Anda hanya menginput **jurnal**; Buku Besar, Neraca Saldo, Laba Rugi, Neraca, Perubahan Modal, dan Arus Kas dihitung otomatis di database.

## Prasyarat (WAJIB sudah dijalankan di Supabase)

Sebelum menjalankan app ini, pastikan di SQL Editor Supabase sudah dijalankan berurutan:
1. Skema tabel — `PANDUAN_Samudra_Finance.md` bagian 2 (org, profiles, accounts, journal_entries, journal_lines, trigger keseimbangan)
2. RLS — bagian 3 (opsional saat dev, **wajib sebelum online**)
3. Seed org + profile (UID user Anda) — bagian 4
4. `seed_chart_of_account.sql` — 40 akun
5. `reports_views_rpc.sql` — semua view & RPC laporan

## Langkah menjalankan

```bash
# 1. Masuk folder
cd samudra-web

# 2. Install dependency
npm install

# 3. Buat file .env.local (salin dari .env.example) dan isi:
#    VITE_SUPABASE_URL       → Settings → API → Project URL
#    VITE_SUPABASE_ANON_KEY  → Settings → API → anon public key
cp .env.example .env.local
#   lalu edit .env.local

# 4. Jalankan
npm run dev
#   buka http://localhost:5173
```

## Login

Gunakan email & password user yang Anda buat di **Authentication → Users** di Supabase
(yang UID-nya sudah dimasukkan ke tabel `profiles`).

## Struktur

```
src/
├─ main.jsx              # entry
├─ App.jsx              # seluruh UI + routing tab + loading data
├─ components/
│  └─ Login.jsx         # layar login
└─ lib/
   ├─ supabase.js       # klien Supabase
   ├─ api.js            # SEMUA query & RPC (satu-satunya tempat sentuh DB)
   └─ ui.js             # warna, format Rp, konstanta
```

Semua interaksi database terpusat di `src/lib/api.js`. Kalau mau ubah cara ambil data,
cukup di sana — komponen UI tidak perlu diubah.

## Alur data

- **Jurnal** → `postJournal()` insert ke `journal_entries` + `journal_lines`.
  Trigger DB menolak jika debet ≠ kredit (muncul sebagai pesan error di UI).
- **Laporan** → memanggil RPC (`pnl`, `balance_sheet`, `cash_flow`, `account_balances`)
  yang menghitung di database. Web & mobile akan selalu konsisten.
- **Filter periode** → tombol bulan menerjemahkan ke rentang tanggal saat memanggil RPC.

## Deploy

Vercel / Netlify: hubungkan repo, set env var `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`,
deploy. Build command `npm run build`, output `dist`.

## Catatan

- Petty cash tetap dihitung sebagai beban. Toggle "Bank saja" di Laba Rugi hanya mengubah tampilan.
- Jangan hapus juruan yang sudah ditutup (closing) di produksi; pakai jurnal pembalik.
- Untuk multi-user aman, pastikan RLS (bagian 3 panduan) sudah aktif sebelum go-live.
