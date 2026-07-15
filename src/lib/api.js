import { supabase } from "./supabase";

/* ============================================================
   Layer data: semua interaksi ke Supabase terpusat di sini.
   Komponen UI tidak menyentuh supabase langsung — panggil
   fungsi-fungsi ini saja. Memudahkan perawatan & testing.
   ============================================================ */

// ---- helper periode → rentang tanggal ----
export function periodRange(year, period) {
  // period: 'all' atau 0..11 (Jan..Des)
  if (period === "all") return [`${year}-01-01`, `${year}-12-31`];
  const m = String(period + 1).padStart(2, "0");
  const last = new Date(year, period + 1, 0).getDate();
  return [`${year}-${m}-01`, `${year}-${m}-${last}`];
}

// ---- profil & org user yang login ----
export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, org_id, org(name)")
    .eq("id", u.user.id)
    .single();
  if (error) throw error;
  return data;
}

// ---- Chart of Account ----
export async function getAccounts(orgId) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("code");
  if (error) throw error;
  return data;
}

// Tambah akun baru
export async function addAccount(orgId, acc) {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      org_id: orgId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      branch: acc.branch || null,
      normal_side: acc.normal_side,
      statement: acc.statement,
      pay_source: acc.pay_source || null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cek apakah akun sudah dipakai di jurnal (untuk keamanan hapus)
export async function accountUsedCount(accountId) {
  const { count, error } = await supabase
    .from("journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (error) throw error;
  return count || 0;
}

// Hapus akun (hanya jika belum dipakai)
export async function deleteAccount(accountId) {
  const used = await accountUsedCount(accountId);
  if (used > 0) {
    throw new Error(`Akun tidak bisa dihapus karena sudah dipakai di ${used} transaksi. Nonaktifkan saja.`);
  }
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
}

// Aktif / nonaktif akun
export async function setAccountActive(accountId, active) {
  const { error } = await supabase
    .from("accounts")
    .update({ is_active: active })
    .eq("id", accountId);
  if (error) throw error;
}

// ---- Jurnal: ambil daftar (header + baris) ----
export async function getJournal(orgId, start, end) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, entry_date, memo, cash_source, kind, journal_lines(account_id, debit, credit)")
    .eq("org_id", orgId)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return data;
}

// ---- Jurnal: posting (atomik; trigger DB jaga debet=kredit) ----
export async function postJournal(orgId, entry) {
  // entry: { date, memo, cash:'bank'|'kas', kind, lines:[{account_id,debit,credit}] }
  const { data: header, error: e1 } = await supabase
    .from("journal_entries")
    .insert({
      org_id: orgId,
      entry_date: entry.date,
      memo: entry.memo,
      cash_source: entry.cash,
      kind: entry.kind || "general",
    })
    .select()
    .single();
  if (e1) throw e1;

  const rows = entry.lines
    .filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0)
    .map((l) => ({
      entry_id: header.id,
      account_id: l.account_id,
      debit: l.debit || 0,
      credit: l.credit || 0,
    }));

  const { error: e2 } = await supabase.from("journal_lines").insert(rows);
  if (e2) {
    // rollback header agar tidak tertinggal jurnal kosong
    await supabase.from("journal_entries").delete().eq("id", header.id);
    throw e2; // pesan trigger "Jurnal timpang" muncul di sini
  }
  return header;
}

export async function deleteJournal(entryId) {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  if (error) throw error;
}

// ---- Update jurnal (edit): hapus baris lama, ganti header + baris baru ----
export async function updateJournal(entryId, orgId, entry) {
  const { error: eh } = await supabase
    .from("journal_entries")
    .update({
      entry_date: entry.date,
      memo: entry.memo,
      cash_source: entry.cash,
    })
    .eq("id", entryId);
  if (eh) throw eh;

  // ganti seluruh baris
  const { error: ed } = await supabase.from("journal_lines").delete().eq("entry_id", entryId);
  if (ed) throw ed;

  const rows = entry.lines
    .filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0)
    .map((l) => ({
      entry_id: entryId,
      account_id: l.account_id,
      debit: l.debit || 0,
      credit: l.credit || 0,
    }));
  const { error: ei } = await supabase.from("journal_lines").insert(rows);
  if (ei) throw ei; // trigger tetap menolak jika debet≠kredit
  return true;
}

// ---- Jurnal dengan rentang tanggal spesifik (filter tanggal) ----
export async function getJournalRange(orgId, start, end) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, entry_date, memo, cash_source, kind, journal_lines(account_id, debit, credit)")
    .eq("org_id", orgId)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return data;
}

// ---- Tren bulanan (Analisis) ----
export async function rpcMonthlyTrend(orgId, year) {
  const { data, error } = await supabase.rpc("monthly_trend", { p_org: orgId, p_year: year });
  if (error) throw error;
  return data;
}

// ---- Arus Kas detail (per transaksi) ----
export async function rpcCashFlowDetail(orgId, start, end) {
  const { data, error } = await supabase.rpc("cash_flow_detail", {
    p_org: orgId, p_start: start, p_end: end,
  });
  if (error) throw error;
  return data;
}

// ---- Laporan via RPC ----
export async function rpcAccountBalances(orgId, start, end) {
  const { data, error } = await supabase.rpc("account_balances", {
    p_org: orgId, p_start: start, p_end: end,
  });
  if (error) throw error;
  return data;
}

export async function rpcPnl(orgId, start, end) {
  const { data, error } = await supabase.rpc("pnl", {
    p_org: orgId, p_start: start, p_end: end,
  });
  if (error) throw error;
  return data;
}

export async function rpcBalanceSheet(orgId, asOf) {
  const { data, error } = await supabase.rpc("balance_sheet", {
    p_org: orgId, p_as_of: asOf,
  });
  if (error) throw error;
  return data;
}

export async function rpcRetainedProfit(orgId, asOf) {
  const { data, error } = await supabase.rpc("retained_profit", {
    p_org: orgId, p_as_of: asOf,
  });
  if (error) throw error;
  return data;
}

export async function rpcCashFlow(orgId, start, end) {
  const { data, error } = await supabase.rpc("cash_flow", {
    p_org: orgId, p_start: start, p_end: end,
  });
  if (error) throw error;
  return data;
}

// ---- Auth ----
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await supabase.auth.signOut();
}