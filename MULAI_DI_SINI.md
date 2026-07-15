# MULAI DI SINI — Samudra Finance

Halo! File ini panduan cepat. Ikuti berurutan.

## Langkah 1 — Extract & buka di VS Code
1. Extract (unzip) folder ini ke lokasi yang mudah, misalnya Downloads.
2. Buka VS Code → File → Open Folder → pilih folder `samudra-web`.
3. Struktur sudah benar, tidak perlu memindah file apa pun.

## Langkah 2 — Install dependency
Buka Terminal di VS Code (menu Terminal → New Terminal), ketik:

```
npm install
```

Tunggu sampai selesai (muncul "added XXX packages").

## Langkah 3 — Isi kredensial Supabase
1. Di Explorer VS Code, cari file `.env.example`.
2. Buat salinannya bernama `.env.local`. Cara cepat lewat terminal:
   ```
   copy .env.example .env.local
   ```
3. Klik file `.env.local`, isi dua baris ini dengan data dari Supabase
   (dashboard → Settings → API):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci....
   ```
   Pakai **anon public key**, BUKAN service_role. Simpan (Ctrl+S).

## Langkah 4 — Siapkan database (kalau belum)
Di Supabase → SQL Editor, pastikan sudah dijalankan (urutan):
1. Skema tabel — lihat `database/PANDUAN_Samudra_Finance.md` bagian 2 & 3
2. Seed org + profile (bagian 4 panduan)
3. `database/seed_chart_of_account.sql`  ← Run
4. `database/reports_views_rpc.sql`      ← Run

## Langkah 5 — Jalankan
```
npm run dev
```
Buka alamat yang muncul (http://localhost:5173) di browser.
Login pakai email & password user yang Anda buat di Supabase (Authentication → Users).

---

Kalau ada error di langkah mana pun, salin pesannya dan tanyakan.
Folder `database/` berisi semua file SQL & panduan lengkap.
```
samudra-web/
├─ MULAI_DI_SINI.md      ← file ini
├─ index.html
├─ package.json
├─ vite.config.js
├─ .env.example
├─ database/             ← semua SQL & panduan
└─ src/
   ├─ App.jsx
   ├─ main.jsx
   ├─ lib/  (api.js, ui.js, supabase.js)
   └─ components/  (Login.jsx)
```
