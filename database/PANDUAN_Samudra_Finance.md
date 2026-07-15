# Panduan Membangun Samudra Finance — dari Prototype ke Aplikasi Nyata

Panduan ini mengubah prototype `SamudraFinance.jsx` menjadi aplikasi keuangan produksi: **web + mobile**, data permanen di **Supabase (PostgreSQL)**, multi-user, dengan Buku Besar / Neraca Saldo / Laba Rugi / Neraca yang semuanya diturunkan otomatis dari jurnal.

Prinsip yang dipertahankan dari prototype:
- Anda **hanya menginput jurnal**. Semua laporan adalah *turunan* — tidak pernah diinput ulang.
- Setiap beban punya penanda sumber kas: **Bank** atau **Kas (petty cash)**.
- Laba Rugi punya dua sudut pandang: **Lengkap** (akuntansi jujur) & **Bank saja** (arus kas bank).

---

## 0. Arsitektur

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (satu basis logika)                        │
│  • Web    → React + Vite                             │
│  • Mobile → React Native (Expo)                      │
│  • Shared → /core: tipe, kalkulasi ledger, format Rp │
└───────────────┬─────────────────────────────────────┘
                │  @supabase/supabase-js
┌───────────────▼─────────────────────────────────────┐
│  SUPABASE                                            │
│  • PostgreSQL  (accounts, journal_entries, lines)    │
│  • Auth        (email/password → owner, admin)       │
│  • RLS         (isolasi data per organisasi)         │
│  • Views/RPC   (trial balance, P&L, neraca)          │
│  • Edge Fn     (opsional: tarik pendapatan dari      │
│                 aplikasi siswa Anda via webhook)     │
└─────────────────────────────────────────────────────┘
```

Kunci desain: **kalkulasi laporan didorong ke database** lewat SQL `VIEW`. Frontend cukup `SELECT`, tidak menghitung ulang. Ini yang membuat web & mobile selalu konsisten.

---

## 1. Setup Supabase

1. Buat project di https://supabase.com (region **Singapore** — terdekat dari Bandung).
2. Simpan `Project URL` dan `anon public key` dari Settings → API.
3. Buka **SQL Editor**, jalankan skema di bagian 2 berikut.

---

## 2. Skema Database

Jalankan berurutan di SQL Editor.

### 2.1 Master & organisasi

```sql
-- Organisasi (mendukung multi-cabang / multi-entitas di masa depan)
create table org (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profil user, dipetakan ke auth.users bawaan Supabase
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid references org(id),
  full_name text,
  role text not null default 'admin' check (role in ('owner','admin','viewer'))
);
```

### 2.2 Chart of Account

```sql
create table accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references org(id),
  code        text not null,                    -- '4-40000'
  name        text not null,
  type        text not null,                    -- Pendapatan | Beban Op | Beban Kas | COGS | Kas & Bank | Ekuitas | ...
  branch      text,                             -- 'Progresif' | 'Saraga' | null
  normal_side text not null check (normal_side in ('Db','Kr')),
  statement   text not null check (statement in ('LR','NRC')), -- Laba Rugi | Neraca
  pay_source  text check (pay_source in ('bank','kas')),        -- untuk akun beban
  is_active   boolean default true,
  unique (org_id, code)
);
```

### 2.3 Jurnal (header + baris) — inti double-entry

```sql
create table journal_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references org(id),
  entry_date  date not null,
  memo        text not null,
  cash_source text check (cash_source in ('bank','kas')),  -- catatan sumber kas transaksi
  kind        text not null default 'general'
              check (kind in ('general','adjust','closing')),
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

create table journal_lines (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  debit      numeric(16,2) not null default 0 check (debit  >= 0),
  credit     numeric(16,2) not null default 0 check (credit >= 0),
  check (debit = 0 or credit = 0)   -- satu baris tak boleh debit sekaligus kredit
);

create index on journal_lines (entry_id);
create index on journal_lines (account_id);
create index on journal_entries (org_id, entry_date);
```

### 2.4 Penjaga keseimbangan: debet HARUS sama dengan kredit

Ini yang membuat aplikasi "seperti Accurate" — mustahil menyimpan jurnal timpang.

```sql
create or replace function assert_entry_balanced()
returns trigger language plpgsql as $$
declare d numeric; c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c from journal_lines
    where entry_id = coalesce(new.entry_id, old.entry_id);
  if d <> c then
    raise exception 'Jurnal timpang: debet % ≠ kredit %', d, c;
  end if;
  return null;
end $$;

create constraint trigger trg_balanced
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function assert_entry_balanced();
```

> `deferrable initially deferred` penting: pengecekan ditunda sampai `COMMIT`, sehingga Anda bisa menyisipkan beberapa baris dalam satu transaksi sebelum saldonya seimbang.

### 2.5 View saldo akun (Buku Besar & Neraca Saldo)

```sql
-- Saldo per akun, bisa difilter periode di query
create or replace view account_balances as
select
  a.id, a.org_id, a.code, a.name, a.type, a.branch,
  a.normal_side, a.statement, a.pay_source,
  je.entry_date,
  jl.debit, jl.credit
from accounts a
join journal_lines jl on jl.account_id = a.id
join journal_entries je on je.id = jl.entry_id;
```

Frontend menghitung saldo bersih: `normal_side='Db' ? debit-credit : credit-debit`. Untuk periode, tambahkan `where entry_date between :start and :end`.

### 2.6 Fungsi Laba Rugi (RPC) — dua versi sekaligus

```sql
create or replace function pnl(p_org uuid, p_start date, p_end date)
returns table (
  code text, name text, type text, branch text, pay_source text,
  amount numeric
) language sql stable as $$
  select a.code, a.name, a.type, a.branch, a.pay_source,
         sum(case when a.normal_side='Kr' then jl.credit-jl.debit
                  else jl.debit-jl.credit end) as amount
  from accounts a
  join journal_lines jl on jl.account_id=a.id
  join journal_entries je on je.id=jl.entry_id
  where a.org_id=p_org
    and a.statement='LR'
    and je.entry_date between p_start and p_end
    and je.kind <> 'closing'
  group by a.code,a.name,a.type,a.branch,a.pay_source
  having sum(jl.debit+jl.credit) <> 0;
$$;
```

Panggil dari frontend: `supabase.rpc('pnl',{p_org, p_start:'2026-06-01', p_end:'2026-06-30'})`.
Toggle **Bank saja** = filter baris hasil di frontend: `pay_source !== 'kas'`. Toggle **Lengkap** = semua baris. (Logika persis seperti di prototype.)

---

## 3. Row Level Security (RLS)

Wajib sebelum go-live. Tanpa ini, siapa pun dengan anon key bisa baca semua data.

```sql
alter table accounts          enable row level security;
alter table journal_entries   enable row level security;
alter table journal_lines     enable row level security;
alter table profiles          enable row level security;

-- Helper: org_id milik user yang login
create or replace function my_org() returns uuid language sql stable as $$
  select org_id from profiles where id = auth.uid();
$$;

-- Akun & jurnal: hanya org sendiri
create policy org_read_accounts on accounts
  for select using (org_id = my_org());
create policy org_write_accounts on accounts
  for all using (org_id = my_org()) with check (org_id = my_org());

create policy org_entries on journal_entries
  for all using (org_id = my_org()) with check (org_id = my_org());

-- Baris jurnal ikut org lewat header-nya
create policy org_lines on journal_lines
  for all using (
    exists (select 1 from journal_entries je
            where je.id = entry_id and je.org_id = my_org())
  ) with check (
    exists (select 1 from journal_entries je
            where je.id = entry_id and je.org_id = my_org())
  );

create policy own_profile on profiles
  for select using (id = auth.uid() or org_id = my_org());
```

Untuk membatasi `viewer` agar read-only, tambahkan cek `role` pada policy `for insert/update/delete`.

---

## 4. Seed data awal

```sql
-- 1) buat org & kaitkan user Anda (ganti <UID> dengan auth.uid Anda)
insert into org (id, name) values ('00000000-0000-0000-0000-000000000001','Samudra Swimming School');
insert into profiles (id, org_id, full_name, role)
  values ('<UID>','00000000-0000-0000-0000-000000000001','Owner','owner');

-- 2) import Chart of Account dari prototype
-- Ekspor array COA di SamudraFinance.jsx ke CSV, lalu pakai Table Editor → Import,
-- atau generate INSERT dari script Node kecil. Pastikan kolom pay_source terisi
-- 'bank' untuk gaji/incharge/THR/TMT/reward, 'kas' untuk iklan/ATK/air minum/COGS.
```

---

## 5. Struktur project frontend

```
samudra-finance/
├─ core/                     # dipakai web & mobile
│  ├─ supabase.ts            # createClient(url, anonKey)
│  ├─ types.ts               # Account, JournalEntry, JournalLine
│  ├─ ledger.ts              # buildLedger(), hitung saldo — port dari prototype
│  ├─ reports.ts             # pnl(), balanceSheet(), cashflow()
│  └─ format.ts              # money(), pct()  — port dari prototype
├─ web/                      # React + Vite
│  └─ src/…                  # komponen di-port dari SamudraFinance.jsx
└─ mobile/                   # Expo
   └─ app/…                  # layar yang sama, komponen native
```

Logika `buildLedger`, `money`, `pct`, dan aturan Bank/Kas di prototype **dipindah apa adanya** ke `core/` sebagai TypeScript murni (tanpa React), lalu dipakai web & mobile.

### 5.1 Klien Supabase

```ts
// core/supabase.ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### 5.2 Simpan jurnal (satu transaksi, atomik)

```ts
// core/reports.ts
export async function postJournal(e: {
  date: string; memo: string; cash: 'bank'|'kas';
  lines: { account_id: string; debit: number; credit: number }[];
}) {
  const { data: header, error: e1 } = await supabase
    .from('journal_entries')
    .insert({ entry_date: e.date, memo: e.memo, cash_source: e.cash })
    .select().single();
  if (e1) throw e1;

  const rows = e.lines.map(l => ({ ...l, entry_id: header.id }));
  const { error: e2 } = await supabase.from('journal_lines').insert(rows);
  if (e2) throw e2;   // trigger DB menolak jika debet≠kredit
  return header;
}
```

### 5.3 Ambil Laba Rugi

```ts
export async function getPnl(org: string, start: string, end: string, bankOnly=false) {
  const { data, error } = await supabase.rpc('pnl',
    { p_org: org, p_start: start, p_end: end });
  if (error) throw error;
  return bankOnly ? data.filter(r => r.pay_source !== 'kas') : data;
}
```

---

## 6. Web (Vite)

```bash
npm create vite@latest web -- --template react-ts
cd web && npm i @supabase/supabase-js recharts lucide-react
# .env.local
echo "VITE_SUPABASE_URL=..." >> .env.local
echo "VITE_SUPABASE_ANON_KEY=..." >> .env.local
npm run dev
```

Port komponen dari `SamudraFinance.jsx`, ganti sumber data dari `useState` lokal menjadi `useEffect` + query Supabase. State `period` tetap, tinggal diterjemahkan jadi rentang tanggal `p_start`/`p_end` saat memanggil RPC.

Deploy: **Vercel** atau **Netlify** (hubungkan repo → set env var → auto-deploy).

---

## 7. Mobile (Expo)

```bash
npx create-expo-app mobile -t
cd mobile && npx expo install @supabase/supabase-js \
  @react-native-async-storage/async-storage react-native-url-polyfill
```

```ts
// mobile: klien dengan penyimpanan sesi
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
export const supabase = createClient(URL, ANON, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true }
});
```

Chart: ganti `recharts` (web-only) dengan `react-native-gifted-charts` atau `victory-native`. Sisa logika dari `core/` dipakai apa adanya. Build APK/IPA lewat **EAS Build** (`eas build -p android`).

---

## 8. Integrasi otomatis dari aplikasi siswa (opsional, sangat direkomendasikan)

Karena pendapatan sudah dikelola aplikasi siswa Anda, jangan input jurnal pendapatan manual. Buat **Edge Function** yang menerima webhook dari aplikasi siswa dan otomatis membuat jurnal:

```
Aplikasi Siswa  ──(webhook: pembayaran iuran)──►  Supabase Edge Function
                                                    │
                                                    ▼
                            insert journal_entries + journal_lines
                            (Debit Bank / Kredit Pendapatan sesuai program)
```

Pemetaan: program `Private 1` → akun `4-40000`, `Kelas` → `4-40100`, dst. Dengan ini, Laba Rugi terisi sendiri setiap ada pembayaran.

---

## 9. Urutan pengerjaan yang saya sarankan

1. **Supabase**: skema (bagian 2) + RLS (bagian 3) + seed COA (bagian 4).
2. **core/**: port `ledger.ts`, `format.ts`, `reports.ts` dari prototype ke TypeScript.
3. **Web**: Auth → Jurnal (postJournal) → Laba Rugi (RPC) → sisanya.
4. Uji integritas: coba simpan jurnal timpang → harus ditolak DB.
5. **Mobile** setelah web stabil.
6. **Edge Function** integrasi aplikasi siswa.
7. **Neraca & Perubahan Modal**: tambahkan RPC serupa `pnl` (bagian 2.6) untuk `statement='NRC'`.

---

## Catatan penting akuntansi

- **Jangan pernah menghapus jurnal yang sudah diposting** di produksi. Gunakan *reversing entry* (jurnal pembalik) agar jejak audit terjaga — sama seperti Accurate/Mekari.
- **Jurnal Penutup** (`kind='closing'`) dijalankan akhir tahun: pindahkan saldo semua akun `LR` ke `3-30003 Laba Bersih`. Filter `je.kind <> 'closing'` di RPC `pnl` mencegah double-counting.
- **Petty cash tetap beban.** Toggle "Bank saja" hanya mengubah *tampilan*, bukan angka tersimpan. Laba resmi (untuk wakaf, dividen, pajak) selalu pakai versi **Lengkap**.
