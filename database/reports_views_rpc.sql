-- ============================================================
-- SAMUDRA FINANCE — Views & RPC untuk semua laporan
-- Jalankan SEKALI di SQL Editor. Aman diulang (create or replace).
-- Frontend hanya SELECT / rpc() — tidak menghitung ulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Buku Besar mentah: tiap baris jurnal + info akun
--    Frontend menghitung saldo bersih sesuai normal_side.
-- ------------------------------------------------------------
create or replace view ledger_lines as
select
  a.org_id,
  a.id          as account_id,
  a.code,
  a.name,
  a.type,
  a.branch,
  a.normal_side,
  a.statement,
  a.pay_source,
  je.id         as entry_id,
  je.entry_date,
  je.memo,
  je.cash_source,
  je.kind,
  jl.debit,
  jl.credit
from accounts a
join journal_lines jl   on jl.account_id = a.id
join journal_entries je on je.id = jl.entry_id;

-- ------------------------------------------------------------
-- 2) Saldo akun per periode (Buku Besar & Neraca Saldo)
--    kind='closing' dikecualikan agar tidak double-count.
-- ------------------------------------------------------------
create or replace function account_balances(
  p_org uuid, p_start date, p_end date
)
returns table (
  account_id uuid, code text, name text, type text, branch text,
  normal_side text, statement text, pay_source text,
  debit numeric, credit numeric, balance numeric
) language sql stable as $$
  select
    a.id, a.code, a.name, a.type, a.branch,
    a.normal_side, a.statement, a.pay_source,
    coalesce(sum(jl.debit),0)  as debit,
    coalesce(sum(jl.credit),0) as credit,
    case when a.normal_side='Db'
         then coalesce(sum(jl.debit),0)  - coalesce(sum(jl.credit),0)
         else coalesce(sum(jl.credit),0) - coalesce(sum(jl.debit),0)
    end as balance
  from accounts a
  left join journal_lines jl   on jl.account_id = a.id
  left join journal_entries je on je.id = jl.entry_id
       and je.entry_date between p_start and p_end
       and je.kind <> 'closing'
  where a.org_id = p_org
  group by a.id, a.code, a.name, a.type, a.branch,
           a.normal_side, a.statement, a.pay_source
  order by a.code;
$$;

-- ------------------------------------------------------------
-- 3) Laba Rugi (periode) — dipakai toggle Lengkap/Bank saja
--    Frontend memfilter pay_source<>'kas' untuk mode "Bank saja".
-- ------------------------------------------------------------
create or replace function pnl(
  p_org uuid, p_start date, p_end date
)
returns table (
  code text, name text, type text, branch text, pay_source text,
  amount numeric
) language sql stable as $$
  select a.code, a.name, a.type, a.branch, a.pay_source,
         sum(case when a.normal_side='Kr' then jl.credit - jl.debit
                  else jl.debit - jl.credit end) as amount
  from accounts a
  join journal_lines jl   on jl.account_id = a.id
  join journal_entries je on je.id = jl.entry_id
  where a.org_id = p_org
    and a.statement = 'LR'
    and je.entry_date between p_start and p_end
    and je.kind <> 'closing'
  group by a.code, a.name, a.type, a.branch, a.pay_source
  having sum(jl.debit + jl.credit) <> 0
  order by a.code;
$$;

-- ------------------------------------------------------------
-- 4) Neraca (posisi kumulatif s/d tanggal)
--    Aset/Hutang/Modal + laba berjalan (LR bersih s/d tanggal).
-- ------------------------------------------------------------
create or replace function balance_sheet(
  p_org uuid, p_as_of date
)
returns table (
  code text, name text, type text, normal_side text, balance numeric
) language sql stable as $$
  select a.code, a.name, a.type, a.normal_side,
         case when a.normal_side='Db'
              then coalesce(sum(jl.debit),0)  - coalesce(sum(jl.credit),0)
              else coalesce(sum(jl.credit),0) - coalesce(sum(jl.debit),0)
         end as balance
  from accounts a
  left join journal_lines jl   on jl.account_id = a.id
  left join journal_entries je on je.id = jl.entry_id
       and je.entry_date <= p_as_of
  where a.org_id = p_org
    and a.statement = 'NRC'
  group by a.code, a.name, a.type, a.normal_side
  order by a.code;
$$;

-- Laba berjalan s/d tanggal (untuk ditambahkan ke ekuitas di Neraca)
create or replace function retained_profit(
  p_org uuid, p_as_of date
)
returns numeric language sql stable as $$
  select coalesce(sum(
    case when a.normal_side='Kr' then jl.credit - jl.debit
         else jl.debit - jl.credit end
  ),0) * -1  -- pendapatan(+) - beban = laba; dibalik agar konsisten sisi kredit ekuitas
  from accounts a
  join journal_lines jl   on jl.account_id = a.id
  join journal_entries je on je.id = jl.entry_id
  where a.org_id = p_org
    and a.statement = 'LR'
    and je.entry_date <= p_as_of
    and je.kind <> 'closing';
$$;

-- ------------------------------------------------------------
-- 5) Arus Kas (mutasi Bank & Kas per periode)
--    Menampilkan pergerakan akun Kas & Bank saja.
-- ------------------------------------------------------------
create or replace function cash_flow(
  p_org uuid, p_start date, p_end date
)
returns table (
  code text, name text, cash_source text,
  masuk numeric, keluar numeric, net numeric
) language sql stable as $$
  select a.code, a.name, je.cash_source,
         coalesce(sum(jl.debit),0)  as masuk,
         coalesce(sum(jl.credit),0) as keluar,
         coalesce(sum(jl.debit),0) - coalesce(sum(jl.credit),0) as net
  from accounts a
  join journal_lines jl   on jl.account_id = a.id
  join journal_entries je on je.id = jl.entry_id
  where a.org_id = p_org
    and a.type = 'Kas & Bank'
    and je.entry_date between p_start and p_end
  group by a.code, a.name, je.cash_source
  order by a.code;
$$;

-- ============================================================
-- CONTOH PEMANGGILAN (uji manual):
-- select * from account_balances('<ORG_ID>', '2026-01-01', '2026-12-31');
-- select * from pnl('<ORG_ID>', '2026-06-01', '2026-06-30');
-- select * from balance_sheet('<ORG_ID>', '2026-06-30');
-- select * from cash_flow('<ORG_ID>', '2026-06-01', '2026-06-30');
--
-- Cari ORG_ID: select id from org where name='Samudra Swimming School';
-- ============================================================
