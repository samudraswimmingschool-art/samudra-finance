/* ============================================================
   TAMBAHAN UNTUK src/lib/api.js

   Salin SELURUH isi file ini, lalu tempelkan di BAGIAN PALING BAWAH
   file api.js kamu (setelah bagian "---- Auth ----").
   Tidak ada baris lama yang perlu diubah atau dihapus.
   ============================================================ */

// ---- Pengembangan Usaha: daftar inisiatif ----
export async function getInitiatives(orgId) {
  const { data, error } = await supabase
    .from("initiatives")
    .select("*, initiative_accounts(id, account_id)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Tambah inisiatif baru
export async function addInitiative(orgId, v) {
  const { data, error } = await supabase
    .from("initiatives")
    .insert({
      org_id: orgId,
      name: v.name,
      category: v.category || "Produk Baru",
      status: v.status || "ide",
      branch: v.branch || null,
      start_date: v.start_date || null,
      description: v.description || null,
      capital_needed: v.capital_needed || 0,
      funding_secured: v.funding_secured || 0,
      funding_source: v.funding_source || "laba",
      proj_revenue_month: v.proj_revenue_month || 0,
      proj_cost_month: v.proj_cost_month || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ubah inisiatif
export async function updateInitiative(id, v) {
  const { error } = await supabase
    .from("initiatives")
    .update({
      name: v.name,
      category: v.category || "Produk Baru",
      status: v.status || "ide",
      branch: v.branch || null,
      start_date: v.start_date || null,
      description: v.description || null,
      capital_needed: v.capital_needed || 0,
      funding_secured: v.funding_secured || 0,
      funding_source: v.funding_source || "laba",
      proj_revenue_month: v.proj_revenue_month || 0,
      proj_cost_month: v.proj_cost_month || 0,
    })
    .eq("id", id);
  if (error) throw error;
}

// Ubah status saja (tombol cepat di daftar)
export async function setInitiativeStatus(id, status) {
  const { error } = await supabase.from("initiatives").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteInitiative(id) {
  const { error } = await supabase.from("initiatives").delete().eq("id", id);
  if (error) throw error;
}

// ---- Penautan akun COA ke inisiatif (sumber realisasi otomatis) ----
export async function setInitiativeAccounts(initiativeId, accountIds) {
  // ganti seluruh tautan: hapus yang lama, pasang yang baru
  const { error: ed } = await supabase
    .from("initiative_accounts")
    .delete()
    .eq("initiative_id", initiativeId);
  if (ed) throw ed;

  const rows = (accountIds || []).map((account_id) => ({
    initiative_id: initiativeId,
    account_id,
  }));
  if (rows.length === 0) return;

  const { error: ei } = await supabase.from("initiative_accounts").insert(rows);
  if (ei) throw ei;
}

// ---- Realisasi dari jurnal ----
export async function rpcInitiativeActuals(orgId, start, end) {
  const { data, error } = await supabase.rpc("initiative_actuals", {
    p_org: orgId, p_start: start, p_end: end,
  });
  if (error) throw error;
  return data || [];
}

export async function rpcInitiativeMonthly(orgId, initiativeId, year) {
  const { data, error } = await supabase.rpc("initiative_monthly", {
    p_org: orgId, p_initiative: initiativeId, p_year: year,
  });
  if (error) throw error;
  return data || [];
}