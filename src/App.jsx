import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, BookOpen, Layers, Scale, ScrollText, Landmark,
  TrendingUp, ArrowLeftRight, Building2, Plus, Trash2, Check, AlertCircle,
  Search, LogOut, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle,
  PiggyBank, ShoppingCart, ChevronLeft, Pencil, BarChart3, X,
  TrendingDown, Lightbulb, Printer, ChevronDown, ChevronUp, Banknote,
  Target as TargetIcon, FileText, Package, Flag, Clock, UserPlus, Menu, Copy,
  Rocket, Link2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import { C, money, moneyShort, pct, MONTHS, lbl, inp } from "./lib/ui";
import {
  getMyProfile, getAccounts, getJournal, postJournal, deleteJournal,
  updateJournal, getJournalRange, rpcMonthlyTrend, rpcCashFlowDetail,
  addAccount, deleteAccount, setAccountActive, updateAccount, accountUsedCount,
  getTarget, saveTarget, getAchievement, getMonthlyAchievement, getRegistrationGrowth,
  getFixedAssets, addFixedAsset, updateFixedAsset, deleteFixedAsset,
  rpcAssetDepreciation, postDepreciation, getDepreciationSchedule,
  postDepreciationMonth, postAllOutstanding,
  hasOpeningBalance, saveOpeningBalance,
  getDeferredSummary, addDeferredRevenue, deleteDeferredRevenue,
  getDeferredSchedule, recognizeDeferredMonth, recognizeAllDue,
  rpcPnl, rpcBalanceSheet, rpcRetainedProfit, rpcCashFlow, rpcAccountBalances,
  getInitiatives, addInitiative, updateInitiative, setInitiativeStatus,
  deleteInitiative, setInitiativeAccounts, rpcInitiativeActuals, rpcInitiativeMonthly,
  addProduct, updateProduct, deleteProduct,
  addChannel, updateChannel, deleteChannel,
  addMarketing, updateMarketing, deleteMarketing,
  addBudget, updateBudget, deleteBudget,
  addSwot, updateSwot, deleteSwot, tabelRincianHilang,
  addDiscount, updateDiscount, deleteDiscount,
  updateInitiativeFunding, updateInitiativeRevenue, syncInitiativeNumbers,
  periodRange, signOut,
} from "./lib/api";

/* ============================================================
   TAHUN BUKU DINAMIS
   YEAR adalah variabel modul yang dibaca oleh semua komponen di
   file ini. setBookYear() mengubahnya sekaligus memicu re-render
   lewat state `yearTick` di dalam App().
   ============================================================ */
let YEAR = 2026;
let _setYearState = null;
export function setBookYear(y) {
  YEAR = y;
  if (_setYearState) _setYearState(y);
}
const TAHUN_TERSEDIA = [2024, 2025, 2026, 2027];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined=loading
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState("all");
  const [yearTick, setYearTick] = useState(YEAR); // memicu re-render saat tahun ganti
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);  // sidebar di layar kecil

  // hubungkan setter global ke state (sekali saja)
  useEffect(() => {
    _setYearState = setYearTick;
    return () => { _setYearState = null; };
  }, []);

  // laporan aktif (di-load sesuai tab & period)
  const [journal, setJournal] = useState([]);
  const [balances, setBalances] = useState([]);
  const [pnl, setPnl] = useState([]);
  const [sheet, setSheet] = useState([]);
  const [retained, setRetained] = useState(0);
  const [flow, setFlow] = useState([]);
  const [flowDetail, setFlowDetail] = useState([]);
  const [trend, setTrend] = useState([]);
  // data tahun sebelumnya (untuk perbandingan tahun / YoY)
  const [pnlPrev, setPnlPrev] = useState([]);
  const [trendPrev, setTrendPrev] = useState([]);

  // --- auth session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- profil & COA saat login ---
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      const p = await getMyProfile();
      setProfile(p);
      if (p) setAccounts(await getAccounts(p.org_id));
    })();
  }, [session]);

  const orgId = profile?.org_id;
  const reloadAccounts = useCallback(async () => {
    if (orgId) setAccounts(await getAccounts(orgId));
  }, [orgId]);
  const acctById = useMemo(() => {
    const m = {}; accounts.forEach((a) => (m[a.id] = a)); return m;
  }, [accounts]);
  const acctByCode = useMemo(() => {
    const m = {}; accounts.forEach((a) => (m[a.code] = a)); return m;
  }, [accounts]);

  // --- muat data sesuai tab, period & tahun ---
  const load = useCallback(async () => {
    if (!orgId) return;
    const [start, end] = periodRange(YEAR, period);
    const asOf = end;
    setLoading(true);
    try {
      if (tab === "journal" || tab === "transaksi") setJournal(await getJournal(orgId, start, end));
      else if (tab === "ledger" || tab === "trial")
        setBalances(await rpcAccountBalances(orgId, start, end));
      else if (tab === "pnl") {
        setPnl(await rpcPnl(orgId, start, end));
        const [pS, pE] = periodRange(YEAR-1, period);
        setPnlPrev(await rpcPnl(orgId, pS, pE));
      }
      else if (tab === "balance") {
        setSheet(await rpcBalanceSheet(orgId, asOf));
        setRetained(await rpcRetainedProfit(orgId, asOf));
        // saldo seluruh akun — dipakai pemeriksa selisih bila neraca timpang
        setBalances(await rpcAccountBalances(orgId, start, end));
      } else if (tab === "cashflow") {
        setFlow(await rpcCashFlow(orgId, start, end));
        setFlowDetail(await rpcCashFlowDetail(orgId, start, end));
      } else if (tab === "analisis" || tab === "dashboard") {
        const [pS, pE] = periodRange(YEAR-1, period);
        setPnl(await rpcPnl(orgId, start, end));
        setBalances(await rpcAccountBalances(orgId, start, end));
        setTrend(await rpcMonthlyTrend(orgId, YEAR));
        setPnlPrev(await rpcPnl(orgId, pS, pE));
        setTrendPrev(await rpcMonthlyTrend(orgId, YEAR-1));
      }
    } catch (e) { alert("Gagal memuat: " + e.message); }
    finally { setLoading(false); }
  }, [orgId, tab, period, yearTick]);

  useEffect(() => { load(); }, [load]);

  // --- gate ---
  if (session === undefined)
    return <Center>Memuat…</Center>;
  if (!session) return <Login />;
  if (!profile) return <Center>Menyiapkan akun… (pastikan profile & org sudah di-seed)</Center>;

  const orgName = profile.org?.name || "Samudra";

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:C.paper, minHeight:"100vh", color:C.ink }}>
      <style>{styleSheet}</style>
      <div style={{ display:"flex", minHeight:"100vh" }}>
        {/* Topbar khusus layar kecil */}
        <div className="mobile-topbar no-print">
          <button className="btn" onClick={()=>setNavOpen(true)} aria-label="Buka menu"
            style={{ background:"transparent", color:"#fff", display:"grid", placeItems:"center",
              width:38, height:38, borderRadius:9 }}>
            <Menu size={22} />
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:7,
              background:`linear-gradient(135deg,${C.teal},${C.brass})`, display:"grid",
              placeItems:"center", fontWeight:800, color:"#fff", fontSize:13 }}>S</div>
            <span style={{ fontWeight:700, fontSize:14.5, color:"#fff" }}>Samudra Finance</span>
          </div>
          <span style={{ marginLeft:"auto", fontSize:12.5, fontWeight:700, color:C.brass }}>{yearTick}</span>
        </div>

        {/* Layar gelap di belakang sidebar saat terbuka di HP */}
        {navOpen && <div className="nav-overlay no-print" onClick={()=>setNavOpen(false)} />}

        {/* Sidebar */}
        <aside className={"sidebar" + (navOpen ? " open" : "")}
          style={{ width:236, background:C.deep, color:"#DDECEC", padding:"22px 14px",
          position:"sticky", top:0, height:"100vh", flexShrink:0, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 8px 16px" }}>
            <div style={{ width:34, height:34, borderRadius:9,
              background:`linear-gradient(135deg,${C.teal},${C.brass})`, display:"grid",
              placeItems:"center", fontWeight:800, color:"#fff" }}>S</div>
            <div><div style={{ fontWeight:700, fontSize:15, lineHeight:1 }}>Samudra</div>
              <div style={{ fontSize:11, color:C.brass, letterSpacing:".08em", marginTop:3 }}>FINANCE</div></div>
            <button className="btn nav-close no-print" onClick={()=>setNavOpen(false)} aria-label="Tutup menu"
              style={{ marginLeft:"auto", background:"transparent", color:"#AEC7C7" }}>
              <X size={20} />
            </button>
          </div>

          {/* Pilihan tahun buku */}
          <div className="no-print" style={{ padding:"0 8px 12px" }}>
            <label style={{ fontSize:10, letterSpacing:".08em", color:"#5F8080",
              fontWeight:700, display:"block", marginBottom:5 }}>TAHUN BUKU</label>
            <select value={yearTick} onChange={e=>setBookYear(+e.target.value)}
              style={{ width:"100%", background:C.teal, color:"#fff", border:"none", borderRadius:8,
                padding:"8px 10px", fontSize:13.5, fontWeight:700, fontFamily:"inherit", cursor:"pointer" }}>
              {TAHUN_TERSEDIA.map(y=>(
                <option key={y} value={y} style={{ color:C.ink }}>{y}</option>
              ))}
            </select>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {NAV.map((n, i) => n.sec ? (
              <div key={"s"+i} style={{ fontSize:10, letterSpacing:".12em", color:"#5F8080",
                fontWeight:700, padding:"14px 12px 6px" }}>{n.sec}</div>
            ) : (
              <div key={n.id} className="nav-item" onClick={() => { setTab(n.id); setNavOpen(false); }}
                style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 12px",
                  borderRadius:9, marginBottom:2, cursor:"pointer",
                  background: tab===n.id ? C.teal : "transparent",
                  color: tab===n.id ? "#fff" : "#AEC7C7",
                  fontWeight: tab===n.id ? 600 : 500, fontSize:13.5 }}>
                <n.icon size={17} strokeWidth={tab===n.id?2.4:2} />{n.label}
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid rgba(255,255,255,.08)`, paddingTop:12, marginTop:8 }}>
            <div style={{ fontSize:11.5, color:"#8FB0B0", marginBottom:8 }}>
              {profile.full_name} · {profile.role}</div>
            <button onClick={signOut} className="btn"
              style={{ display:"flex", alignItems:"center", gap:8, background:"transparent",
                color:"#AEC7C7", fontSize:12.5, padding:"6px 4px" }}>
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex:1, padding:"26px 34px", maxWidth:1180 }}>
          {/* period selector */}
          {SHOW_PERIOD.includes(tab) && (
            <div className="no-print" style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:18, alignItems:"center" }}>
              <span style={{ fontSize:12.5, fontWeight:700, color:C.deep, marginRight:4 }}>{yearTick}</span>
              <button className="btn" onClick={()=>setPeriod("all")}
                style={periodBtn(period==="all")}>Semua</button>
              {MONTHS.map((m,i)=>(
                <button key={m} className="btn" onClick={()=>setPeriod(i)}
                  style={periodBtn(period===i, true)}>{m.slice(0,3)}</button>
              ))}
              <button className="btn" onClick={()=>window.print()} title="Simpan / cetak PDF"
                style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6,
                  background:C.deep, color:"#fff", padding:"7px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
                <Printer size={14} /> Simpan PDF
              </button>
              <button className="btn" onClick={load} title="Muat ulang"
                style={{ display:"flex", alignItems:"center", gap:6,
                  background:C.surf, color:C.sub, padding:"7px 12px", borderRadius:8, fontSize:12.5 }}>
                <RefreshCw size={14} className={loading?"spin":""} /> {loading?"Memuat":"Refresh"}
              </button>
            </div>
          )}

          <div id="print-area">
          {tab==="dashboard" && <Dashboard pnl={pnl} balances={balances} trend={trend}
                                          pnlPrev={pnlPrev} trendPrev={trendPrev} accounts={accounts} />}
          {tab==="transaksi" && <Transaksi key={yearTick} accounts={accounts} acctByCode={acctByCode}
                                          journal={journal} acctById={acctById} orgId={orgId} onChange={load} />}
          {tab==="journal"   && <Journal key={yearTick} accounts={accounts} acctById={acctById} acctByCode={acctByCode}
                                          journal={journal} orgId={orgId} onChange={load} />}
          {tab==="analisis"  && <Analisis pnl={pnl} balances={balances} trend={trend} period={period}
                                          pnlPrev={pnlPrev} trendPrev={trendPrev} accounts={accounts} />}
          {tab==="siswa"     && <PertumbuhanSiswa key={yearTick} orgId={orgId} accounts={accounts} />}
          {tab==="owner"     && <OwnerReport key={yearTick} orgId={orgId} orgName={orgName} accounts={accounts} />}
          {tab==="target"    && <TargetView key={yearTick} orgId={orgId} accounts={accounts} />}
          {tab==="kembang"   && <Pengembangan key={yearTick} orgId={orgId} accounts={accounts} />}
          {tab==="ledger"    && <Ledger balances={balances} />}
          {tab==="trial"     && <Trial balances={balances} />}
          {tab==="pnl"       && <PnL pnl={pnl} pnlPrev={pnlPrev} period={period} accounts={accounts} />}
          {tab==="balance"   && <Balance sheet={sheet} retained={retained} period={period}
                                        accounts={accounts} balances={balances} />}
          {tab==="equity"    && <Equity key={yearTick} orgId={orgId} period={period} />}
          {tab==="cashflow"  && <CashFlow flow={flow} detail={flowDetail} accounts={accounts} />}
          {tab==="coa"       && <COAView accounts={accounts} orgId={orgId} onChange={reloadAccounts} />}
          {tab==="aset"      && <AsetTetap key={yearTick} orgId={orgId} acctByCode={acctByCode} accounts={accounts} />}
          {tab==="saldoawal" && <SaldoAwal key={yearTick} orgId={orgId} accounts={accounts} acctByCode={acctByCode} onChange={load} />}
          {tab==="deferred"  && <Deferred key={yearTick} orgId={orgId} acctByCode={acctByCode} accounts={accounts} onChange={load} />}
          </div>
        </main>
      </div>
    </div>
  );
}

const NAV = [
  { sec:"UTAMA" },
  { id:"dashboard", label:"Beranda", icon:LayoutDashboard },
  { id:"transaksi", label:"Transaksi", icon:Wallet },
  { id:"journal", label:"Jurnal Umum", icon:BookOpen },
  { sec:"LAPORAN" },
  { id:"owner", label:"Laporan Owner", icon:FileText },
  { id:"target", label:"Target", icon:TargetIcon },
  { id:"kembang", label:"Pengembangan Usaha", icon:Rocket },
  { id:"analisis", label:"Analisis Keuangan", icon:BarChart3 },
  { id:"siswa", label:"Pertumbuhan Siswa", icon:UserPlus },
  { id:"ledger", label:"Buku Besar", icon:Layers },
  { id:"trial", label:"Neraca Saldo", icon:Scale },
  { id:"pnl", label:"Laba Rugi", icon:ScrollText },
  { id:"balance", label:"Neraca", icon:Landmark },
  { id:"equity", label:"Perubahan Modal", icon:TrendingUp },
  { id:"cashflow", label:"Arus Kas", icon:ArrowLeftRight },
  { sec:"DATA" },
  { id:"saldoawal", label:"Saldo Awal", icon:Flag },
  { id:"deferred", label:"Pendapatan Dimuka", icon:Clock },
  { id:"aset", label:"Aset Tetap", icon:Package },
  { id:"coa", label:"Chart of Account", icon:Building2 },
];
const SHOW_PERIOD = ["dashboard","transaksi","journal","analisis","ledger","trial","pnl","balance","equity","cashflow"];
function periodBtn(active, small) {
  return { padding: small?"6px 10px":"6px 14px", borderRadius:8, fontSize:12.5, fontWeight:600,
    background: active ? (small?C.teal:C.deep) : "#fff",
    color: active ? "#fff" : C.sub,
    border:`1px solid ${active ? (small?C.teal:C.deep) : C.line}` };
}

const Center = ({ children }) => (
  <div style={{ minHeight:"100vh", display:"grid", placeItems:"center",
    fontFamily:"'Inter',system-ui,sans-serif", color:C.sub }}>{children}</div>
);

function PageHead({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontSize:12, letterSpacing:".12em", color:C.brass, fontWeight:600, textTransform:"uppercase" }}>{eyebrow}</div>
      <h1 style={{ margin:"5px 0 3px", fontSize:25, fontWeight:700 }}>{title}</h1>
      {sub && <div style={{ color:C.sub, fontSize:13.5 }}>{sub}</div>}
    </div>
  );
}

/* ---- helpers untuk agregasi hasil RPC ---- */
const sumBy = (rows, pred) => rows.filter(pred).reduce((s,r)=>s+Number(r.amount||r.balance||0),0);

/* ============================================================
   CABANG — dikelola dinamis supaya cabang baru otomatis terhitung
   di seluruh laporan tanpa mengubah kode lagi.
   ============================================================ */
const CABANG_DIKENAL = ["Progresif", "Saraga", "The Trans Luxury", "The Trans"];
const PALET_CABANG = [C.teal, C.brass, C.kas, C.pos, C.neg, C.deep];

// warna konsisten per cabang (berdasarkan urutan daftar)
function warnaCabang(nama, daftar) {
  const i = daftar.indexOf(nama);
  return PALET_CABANG[(i < 0 ? 0 : i) % PALET_CABANG.length];
}

// kumpulkan nama cabang dari hasil rpcPnl / accounts (field `branch`)
function daftarCabang(...sumber) {
  const set = new Set();
  sumber.forEach(rows => (rows||[]).forEach(r => { if (r && r.branch) set.add(r.branch); }));
  const ada = [...set];
  // urutkan: cabang yang sudah dikenal dulu (urutan tetap), sisanya alfabetis
  const dikenal = CABANG_DIKENAL.filter(c => ada.includes(c));
  const lainnya = ada.filter(c => !CABANG_DIKENAL.includes(c)).sort();
  return [...dikenal, ...lainnya];
}

// ringkasan pendapatan / beban operasional / kontribusi laba per cabang.
// `accounts` (Chart of Account) dipakai agar cabang yang belum punya transaksi
// tetap muncul di laporan dengan nilai nol.
function perCabang(pnlRows, accounts) {
  const nama = daftarCabang(pnlRows, accounts);
  const S = (type, branch) => (pnlRows||[])
    .filter(r=>r.type===type && r.branch===branch)
    .reduce((s,r)=>s+Number(r.amount),0);
  return nama.map(n=>{
    const rev = S("Pendapatan", n);
    const op  = S("Beban Op", n);
    return { nama:n, rev, op, kontrib: rev-op, warna: warnaCabang(n, nama) };
  });
}

/* ---- ringkasan Laba Rugi dari hasil rpcPnl (dipakai untuk YoY) ---- */
function ringkasPnl(rows) {
  const S = (type,branch) => (rows||[]).filter(r=>r.type===type&&(!branch||r.branch===branch))
    .reduce((s,r)=>s+Number(r.amount),0);
  const rev=S("Pendapatan");
  const cogs=S("COGS"), opBank=S("Beban Op");
  const kasBeban=S("Beban Kas"), oi=S("Other Income"), oe=S("Other Expense");
  const totalBeban=cogs+opBank+kasBeban+oe;
  const laba=rev-totalBeban+oi;
  return { rev, cogs, opBank, kasBeban, oi, oe, totalBeban, laba,
    npm: rev ? laba/rev : 0 };
}

/* ---- selisih relatif yang aman terhadap pembagi nol ---- */
function deltaPct(now, before) {
  if (!before) return null;           // tidak ada pembanding → jangan tampilkan %
  return (now - before) / Math.abs(before);
}

/* ---- badge naik/turun untuk perbandingan ---- */
const YoYBadge = ({ g, terbalik }) => {
  // terbalik=true untuk metrik yang "naik = buruk" (mis. beban)
  if (g === null || g === undefined) return <span style={{ fontSize:11, color:C.sub }}>—</span>;
  const naik = g >= 0;
  const bagus = terbalik ? !naik : naik;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11.5, fontWeight:700,
      color: bagus ? C.pos : C.neg }}>
      {naik ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}{naik?"+":""}{pct(g)}
    </span>
  );
};

/* ============================================================
   PERBANDINGAN TAHUN (YoY) — dipakai di Analisis & Laba Rugi
   ============================================================ */
function PerbandinganTahun({ pnl, pnlPrev, trend, trendPrev, period, ringkas }) {
  const kini = ringkasPnl(pnl);
  const lalu = ringkasPnl(pnlPrev);
  const adaPembanding = lalu.rev > 0 || lalu.totalBeban > 0;
  const labelPeriode = period==="all" ? "Setahun penuh" : `Bulan ${MONTHS[period]}`;

  const baris = [
    { l:"Pendapatan",    a:kini.rev,        b:lalu.rev,        terbalik:false },
    { l:"Total Beban",   a:kini.totalBeban, b:lalu.totalBeban, terbalik:true  },
    { l:"Laba Bersih",   a:kini.laba,       b:lalu.laba,       terbalik:false },
  ];

  // gabung tren dua tahun untuk grafik & tabel per bulan
  const peta = (arr) => {
    const m = {};
    (arr||[]).forEach(t=>{ m[Number(t.bulan)] = t; });
    return m;
  };
  const mKini = peta(trend), mLalu = peta(trendPrev);
  const perBulan = MONTHS.map((nama,i)=>{
    const b = i+1;
    const k = mKini[b], l = mLalu[b];
    return {
      m: nama.slice(0,3), bln: b,
      revKini: k?Number(k.pendapatan):0, revLalu: l?Number(l.pendapatan):0,
      labaKini: k?Number(k.laba):0,      labaLalu: l?Number(l.laba):0,
    };
  });
  const adaDataBulanan = perBulan.some(r=>r.revKini||r.revLalu);
  const bulanTampil = perBulan.filter(r=>r.revKini||r.revLalu);

  const chartData = perBulan.map(r=>({
    m: r.m, [`${YEAR-1}`]: r.revLalu, [`${YEAR}`]: r.revKini,
  }));

  if (!adaPembanding && !adaDataBulanan) {
    return (
      <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <ArrowLeftRight size={18} color={C.brass} />
          <span style={{ fontWeight:700, fontSize:15 }}>Perbandingan Tahun</span>
        </div>
        <div style={{ fontSize:13, color:C.sub, lineHeight:1.6 }}>
          Belum ada data tahun {YEAR-1} untuk dibandingkan. Setelah transaksi tahun sebelumnya
          dimasukkan, bagian ini otomatis menampilkan pertumbuhan tahun-ke-tahun.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <ArrowLeftRight size={18} color={C.brass} />
        <span style={{ fontWeight:700, fontSize:15 }}>Perbandingan Tahun — {YEAR} vs {YEAR-1}</span>
      </div>
      <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
        {labelPeriode} · membandingkan periode yang sama di kedua tahun
      </div>

      {/* Ringkasan tiga metrik utama */}
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        {baris.map(r=>{
          const g = deltaPct(r.a, r.b);
          return (
            <div key={r.l} style={{ border:`1px solid ${C.line}`, borderRadius:12, padding:"13px 15px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:12.5, color:C.sub, fontWeight:500 }}>{r.l}</span>
                <YoYBadge g={g} terbalik={r.terbalik} />
              </div>
              <div className="mono" style={{ fontSize:17, fontWeight:700 }}>{money(r.a)}</div>
              <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>
                {YEAR-1}: <span className="mono">{money(r.b)}</span></div>
              <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>
                Selisih: <span className="mono" style={{ fontWeight:600,
                  color:(r.a-r.b)>=0 ? (r.terbalik?C.neg:C.pos) : (r.terbalik?C.pos:C.neg) }}>
                  {(r.a-r.b)>=0?"+":""}{money(r.a-r.b)}</span></div>
            </div>
          );
        })}
      </div>

      {/* Margin laba dua tahun */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", padding:"11px 14px", borderRadius:10,
        background:C.surf, fontSize:12.5, marginBottom:ringkas?0:16 }}>
        <span style={{ color:C.sub }}>Margin laba bersih:</span>
        <span><b>{YEAR}</b> <span className="mono" style={{ fontWeight:700,
          color:kini.npm>=0.15?C.pos:C.neg }}>{pct(kini.npm)}</span></span>
        <span><b>{YEAR-1}</b> <span className="mono" style={{ fontWeight:700,
          color:lalu.npm>=0.15?C.pos:C.neg }}>{pct(lalu.npm)}</span></span>
        <span style={{ marginLeft:"auto", color:C.sub }}>
          {kini.npm>=lalu.npm ? "Margin membaik dibanding tahun lalu." : "Margin menurun dibanding tahun lalu."}
        </span>
      </div>

      {!ringkas && adaDataBulanan && <>
        {/* Grafik pendapatan dua tahun */}
        <div style={{ fontWeight:600, fontSize:13.5, marginBottom:2 }}>Pendapatan per Bulan — {YEAR} vs {YEAR-1}</div>
        <div style={{ fontSize:11.5, color:C.sub, marginBottom:6 }}>Batang berdampingan agar mudah dibandingkan</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ left:-18, right:6, top:10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
            <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
            <Legend wrapperStyle={{ fontSize:11.5 }} />
            <Bar dataKey={`${YEAR-1}`} fill={C.line} radius={[4,4,0,0]} />
            <Bar dataKey={`${YEAR}`} fill={C.teal} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Tabel per bulan */}
        <div style={{ marginTop:16, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 90px 1fr 1fr 90px",
            padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
            <span>BULAN</span>
            <span style={{ textAlign:"right" }}>PENDAPATAN {YEAR-1}</span>
            <span style={{ textAlign:"right" }}>PENDAPATAN {YEAR}</span>
            <span style={{ textAlign:"center" }}>±</span>
            <span style={{ textAlign:"right" }}>LABA {YEAR-1}</span>
            <span style={{ textAlign:"right" }}>LABA {YEAR}</span>
            <span style={{ textAlign:"center" }}>±</span>
          </div>
          {bulanTampil.map(r=>{
            const gRev = deltaPct(r.revKini, r.revLalu);
            const gLaba = deltaPct(r.labaKini, r.labaLalu);
            return (
              <div key={r.bln} style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 90px 1fr 1fr 90px",
                padding:"8px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                <span style={{ fontWeight:600, color:C.deep }}>{r.m}</span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{r.revLalu?money(r.revLalu):"–"}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{r.revKini?money(r.revKini):"–"}</span>
                <span style={{ textAlign:"center" }}><YoYBadge g={gRev} /></span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{r.labaLalu?money(r.labaLalu):"–"}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:600,
                  color:r.labaKini<0?C.neg:C.ink }}>{r.labaKini?money(r.labaKini):"–"}</span>
                <span style={{ textAlign:"center" }}><YoYBadge g={gLaba} /></span>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize:11, color:C.sub, marginTop:10, lineHeight:1.5 }}>
          Tanda "–" berarti belum ada transaksi pada bulan itu. Persentase tidak muncul kalau
          bulan pembanding masih nol (tidak bisa dihitung pertumbuhannya).
        </div>
      </>}
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ pnl, balances, trend, pnlPrev, trendPrev, accounts }) {
  const rev = sumBy(pnl, r=>r.type==="Pendapatan");
  const cabang = perCabang(pnl, accounts);
  const totalRevCabang = cabang.reduce((s,b)=>s+b.rev,0);
  const opBank = sumBy(pnl, r=>r.type==="Beban Op");
  const kasBeban = sumBy(pnl, r=>r.type==="Beban Kas");
  const cogs = sumBy(pnl, r=>r.type==="COGS");
  const oi = sumBy(pnl, r=>r.type==="Other Income");
  const oe = sumBy(pnl, r=>r.type==="Other Expense");
  const profit = rev - cogs - opBank - kasBeban + oi - oe;
  const npm = rev ? profit/rev : 0;
  const bankBal = balances.filter(b=>b.code==="1-10002").reduce((s,b)=>s+Number(b.balance),0);
  const kasBal = balances.filter(b=>b.code==="1-10007").reduce((s,b)=>s+Number(b.balance),0);

  // data tren + indikator pertumbuhan vs bulan sebelumnya
  const trendData = (trend||[]).map(t=>({
    m: MONTHS[Number(t.bulan)-1]?.slice(0,3) || t.bulan,
    rev: Number(t.pendapatan), exp: Number(t.beban), profit: Number(t.laba),
  }));
  const aktif = trendData.filter(t=>t.rev>0 || t.exp>0);
  const growth = (key) => {
    if (aktif.length<2) return null;
    const a=aktif[aktif.length-2][key], b=aktif[aktif.length-1][key];
    if (!a) return null;
    return (b-a)/Math.abs(a);
  };
  const gRev=growth("rev"), gProfit=growth("profit");

  // komposisi beban
  const komposisi = [
    { name:"Gaji & Operasional (Bank)", value:opBank, color:C.teal },
    { name:"Beban Kas (iklan, ATK, dll)", value:kasBeban, color:C.kas },
    { name:"COGS (pembelian)", value:cogs, color:C.brass },
    { name:"Beban lain", value:oe, color:C.neg },
  ].filter(k=>k.value>0);

  const Delta = ({ g }) => {
    if (g===null || g===undefined) return null;
    const up = g>=0;
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11.5, fontWeight:600,
        color: up?C.pos:C.neg }}>
        {up?<TrendingUp size={13}/>:<TrendingDown size={13}/>}{up?"+":""}{pct(g)}
      </span>
    );
  };

  // ringkasan tahun lalu untuk pembanding di KPI
  const lalu = ringkasPnl(pnlPrev);
  const yoyRev = deltaPct(rev, lalu.rev);
  const yoyBeban = deltaPct(opBank+kasBeban+cogs, lalu.totalBeban);
  const yoyProfit = deltaPct(profit, lalu.laba);

  const kpis = [
    { label:"Pendapatan", val:rev, tone:C.teal,
      sub: cabang.length ? cabang.map(b=>b.nama).join(" + ") : "Semua cabang", g:gRev,
      yoy:yoyRev, yoyVal:lalu.rev },
    { label:"Total Beban", val:opBank+kasBeban+cogs, tone:C.neg, sub:"Bank + Kas", g:null,
      yoy:yoyBeban, yoyVal:lalu.totalBeban, terbalik:true },
    { label:"Laba Bersih", val:profit, tone:C.pos, sub:"Margin "+pct(npm), g:gProfit,
      yoy:yoyProfit, yoyVal:lalu.laba },
    { label:"Saldo Bank BCA", val:bankBal, tone:C.teal, sub:"Kas: "+moneyShort(kasBal), g:null },
  ];

  return (
    <div className="pop">
      <PageHead eyebrow="Beranda Keuangan" title="Ringkasan Performa" sub={`Data langsung dari database · tahun buku ${YEAR}`} />

      {/* KPI dengan indikator pertumbuhan */}
      <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:16 }}>
        {kpis.map(k=>(
          <div key={k.label} className="card" style={{ padding:"16px 17px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12.5, color:C.sub, fontWeight:500 }}>{k.label}</span>
              <Delta g={k.g} />
            </div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:10 }}>{money(k.val)}</div>
            <div style={{ fontSize:11.5, color:C.sub, marginTop:3 }}>{k.sub}</div>
            {k.yoy !== undefined && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7,
                paddingTop:7, borderTop:`1px solid ${C.line}` }}>
                <span style={{ fontSize:10.5, color:C.sub }}>vs {YEAR-1}</span>
                <YoYBadge g={k.yoy} terbalik={k.terbalik} />
                <span className="mono" style={{ fontSize:10.5, color:C.sub, marginLeft:"auto" }}>
                  {moneyShort(k.yoyVal)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Perbandingan tahun (ringkas) */}
      <PerbandinganTahun pnl={pnl} pnlPrev={pnlPrev} trend={trend} trendPrev={trendPrev}
        period="all" ringkas />

      {/* Tren + Komposisi beban */}
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14, marginBottom:16 }}>
        <div className="card" style={{ padding:"18px 18px 8px" }}>
          <div style={{ fontWeight:600, fontSize:14.5 }}>Tren Pendapatan & Laba</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:8 }}>Sepanjang {YEAR}</div>
          <ResponsiveContainer width="100%" height={215}>
            <AreaChart data={trendData} margin={{ left:-18, right:6, top:10 }}>
              <defs>
                <linearGradient id="dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.35}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
                <linearGradient id="dp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pos} stopOpacity={.25}/><stop offset="100%" stopColor={C.pos} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
              <Area type="monotone" dataKey="rev" stroke={C.teal} strokeWidth={2.4} fill="url(#dr)" name="Pendapatan" />
              <Area type="monotone" dataKey="profit" stroke={C.pos} strokeWidth={2.4} fill="url(#dp)" name="Laba" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:"18px 18px 10px" }}>
          <div style={{ fontWeight:600, fontSize:14.5 }}>Komposisi Beban</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:4 }}>Ke mana uang keluar</div>
          {komposisi.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={komposisi} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {komposisi.map((k,i)=><Cell key={i} fill={k.color} />)}
                </Pie>
                <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
                <Legend wrapperStyle={{ fontSize:10.5 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ padding:"40px 0", textAlign:"center", color:C.sub, fontSize:12.5 }}>Belum ada beban periode ini</div>}
        </div>
      </div>

      {/* Perbandingan cabang + laba per bulan */}
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <div className="card" style={{ padding:"18px 18px 8px" }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:2 }}>Laba per Bulan</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:6 }}>Net profit {YEAR}</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={trendData} margin={{ left:-18, right:6, top:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
              <Bar dataKey="profit" radius={[5,5,0,0]}>{trendData.map((d,i)=><Cell key={i} fill={d.profit>=0?C.pos:C.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:12 }}>Perbandingan Cabang</div>
          {cabang.length===0 && <div style={{ fontSize:12.5, color:C.sub, padding:"10px 0" }}>
            Belum ada pendapatan per cabang pada periode ini.</div>}
          {cabang.map(b=>(
            <div key={b.nama} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:99, background:b.warna }} />
                <span style={{ fontWeight:600, fontSize:13 }}>Cabang {b.nama}</span>
                <span className="mono" style={{ marginLeft:"auto", fontWeight:700, fontSize:13,
                  color:b.kontrib>=0?C.pos:C.neg }}>{money(b.kontrib)}</span>
              </div>
              <div style={{ height:8, borderRadius:99, background:C.surf, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, background:b.warna,
                  width: `${Math.min(100, totalRevCabang ? (b.rev/totalRevCabang)*100 : 0)}%` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.sub, marginTop:4 }}>
                <span>Pendapatan {moneyShort(b.rev)}</span>
                <span>Operasional {moneyShort(b.op)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saldo & rasio cepat */}
      <div className="card" style={{ padding:"18px 20px" }}>
        <div style={{ fontWeight:600, fontSize:14.5, marginBottom:14 }}>Saldo & Rasio Cepat</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:16 }}>
          <QuickStat icon={Banknote} label="Saldo Bank BCA" val={money(bankBal)} tone={C.teal} />
          <QuickStat icon={Wallet} label="Saldo Kas" val={money(kasBal)} tone={C.kas} />
          <QuickStat icon={TrendingUp} label="Margin Laba" val={pct(npm)} tone={npm>=0.15?C.pos:C.neg} />
          <QuickStat icon={BarChart3} label="Rasio Beban" val={rev?pct((opBank+kasBeban+cogs+oe)/rev):"–"} tone={C.brass} />
        </div>
      </div>
    </div>
  );
}
const QuickStat = ({ icon:Icon, label, val, tone }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
    <div style={{ width:38, height:38, borderRadius:10, background:tone+"18", display:"grid", placeItems:"center", flexShrink:0 }}>
      <Icon size={19} color={tone} /></div>
    <div>
      <div style={{ fontSize:11.5, color:C.sub }}>{label}</div>
      <div className="mono" style={{ fontSize:16, fontWeight:700 }}>{val}</div>
    </div>
  </div>
);
const Line = ({ l, v, c, bold }) => (
  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"5px 0" }}>
    <span style={{ color:bold?C.ink:C.sub, fontWeight:bold?600:400 }}>{l}</span>
    <span className="mono" style={{ fontWeight:bold?700:600, color:c||C.ink }}>{money(v)}</span>
  </div>
);

// ============================================================
// TRANSAKSI — input ramah-pengguna, otomatis jadi jurnal (SAK)
// ============================================================
const KATEGORI = {
  pendapatan: {
    label: "Terima Pendapatan", icon: ArrowDownCircle, tone: C.pos,
    desc: "Uang masuk dari les, private, kelas, grup, pendaftaran, trial.",
    arah: "masuk",                         // Kas/Bank di Debet
    filter: (a) => a.type === "Pendapatan",
    lawanLabel: "Jenis pendapatan",
  },
  penerimaanLain: {
    label: "Penerimaan Lain", icon: PiggyBank, tone: C.teal,
    desc: "Setoran modal, bunga bank, penjualan aset.",
    arah: "masuk",
    filter: (a) => a.type === "Other Income" || a.type === "Ekuitas",
    lawanLabel: "Sumber penerimaan",
  },
  beban: {
    label: "Bayar Beban", icon: ArrowUpCircle, tone: C.neg,
    desc: "Gaji, incharge, THR, iklan, ATK, air minum, komunikasi, event.",
    arah: "keluar",                        // Kas/Bank di Kredit
    filter: (a) => a.type === "Beban Op" || a.type === "Beban Kas",
    lawanLabel: "Jenis beban",
  },
  pembelian: {
    label: "Pembelian", icon: ShoppingCart, tone: C.kas,
    desc: "Alat latihan, perlengkapan pelatih/kantor, peralatan.",
    arah: "keluar",
    filter: (a) => a.type === "COGS" || a.type === "Aktiva Tetap",
    lawanLabel: "Jenis pembelian",
  },
};

function Transaksi({ accounts, acctByCode, acctById, journal, orgId, onChange }) {
  const [kat, setKat] = useState(null);          // key kategori aktif
  const [rows, setRows] = useState([]);          // banyak baris transaksi sekaligus
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const bankId = acctByCode["1-10002"]?.id;
  const kasId  = acctByCode["1-10007"]?.id;
  const hutangAccounts = accounts.filter(a=>a.type==="Kewajiban" && a.is_active!==false);
  const defaultHutang = acctByCode["2-20001"]?.id || hutangAccounts[0]?.id;

  const barisKosong = (contoh, opsi) => ({
    date: contoh?.date || `${YEAR}-01-01`,
    jumlah: "",
    cash: contoh?.cash || "bank",
    lawan_id: contoh?.lawan_id || opsi?.[0]?.id || "",
    memo: "",
    hutang_id: contoh?.hutang_id || defaultHutang,
  });

  const pilihKategori = (key) => {
    setKat(key);
    const opsi = accounts.filter(a=>a.is_active!==false).filter(KATEGORI[key].filter);
    setRows([barisKosong(null, opsi)]);
    setFlash("");
  };

  const setRow = (i, f, v) => setRows(rows.map((r,x)=> x===i ? { ...r, [f]:v } : r));
  const tambahBaris = () => {
    const opsi = accounts.filter(a=>a.is_active!==false).filter(KATEGORI[kat].filter);
    // baris baru mewarisi tanggal & sumber dana dari baris terakhir agar input cepat
    setRows([...rows, barisKosong(rows[rows.length-1], opsi)]);
  };
  const duplikatBaris = (i) => {
    const salin = { ...rows[i] };
    setRows([...rows.slice(0,i+1), salin, ...rows.slice(i+1)]);
  };
  const hapusBaris = (i) => setRows(rows.filter((_,x)=>x!==i));

  // baris yang siap disimpan
  const rowValid = (r) => (+r.jumlah || 0) > 0 && r.lawan_id
    && !(r.cash === "hutang" && !r.hutang_id);
  const siap = rows.filter(rowValid);
  const totalSemua = siap.reduce((s,r)=>s+(+r.jumlah||0), 0);

  const simpan = async () => {
    const K = KATEGORI[kat];
    if (siap.length === 0) { setFlash("✗ Belum ada baris yang lengkap"); return; }
    setBusy(true); setFlash("");
    let sukses = 0;
    const gagal = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!rowValid(r)) continue;
      const nominal = +r.jumlah || 0;
      const pakaiHutang = r.cash === "hutang";
      const sumberId = pakaiHutang ? r.hutang_id : (r.cash === "bank" ? bankId : kasId);
      const lines = K.arah === "masuk"
        ? [ { account_id: sumberId, debit: nominal, credit: 0 },
            { account_id: r.lawan_id, debit: 0, credit: nominal } ]
        : [ { account_id: r.lawan_id, debit: nominal, credit: 0 },
            { account_id: sumberId, debit: 0, credit: nominal } ];
      const namaLawan = acctById[r.lawan_id]?.name || "";
      try {
        await postJournal(orgId, {
          date: r.date,
          memo: r.memo || `${K.label} — ${namaLawan}${pakaiHutang?" (hutang)":""}`,
          cash: pakaiHutang ? "hutang" : r.cash,
          lines,
        });
        sukses++;
      } catch (e) {
        gagal.push(`baris ${i+1}: ${e.message}`);
      }
    }
    setBusy(false);
    if (gagal.length === 0) {
      setFlash(`✓ ${sukses} transaksi tersimpan & jurnal otomatis dibuat`);
      setKat(null); setRows([]);
    } else {
      // biarkan form terbuka; sisakan hanya baris yang gagal agar bisa diperbaiki
      setFlash(`✗ ${sukses} tersimpan, ${gagal.length} gagal — ${gagal.join("; ")}`);
      setRows(rows.filter((r,i)=> !rowValid(r) || gagal.some(g=>g.startsWith(`baris ${i+1}:`))));
    }
    onChange();
  };

  // ---- Tampilan pilih kategori ----
  if (!kat) {
    return (
      <div className="pop">
        <PageHead eyebrow="Catat Transaksi" title="Transaksi"
          sub={`Pilih jenis transaksi — jurnal debet-kredit dibuat otomatis (sesuai SAK). Tahun buku ${YEAR}.`} />
        <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
          {Object.entries(KATEGORI).map(([key, K]) => (
            <button key={key} className="btn" onClick={() => pilihKategori(key)}
              style={{ textAlign:"left", background:"#fff", border:`1px solid ${C.line}`,
                borderRadius:14, padding:"18px 20px", display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ width:44, height:44, borderRadius:11, flexShrink:0,
                background:K.tone+"18", display:"grid", placeItems:"center" }}>
                <K.icon size={24} color={K.tone} />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{K.label}</div>
                <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.45 }}>{K.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {flash && <div className="pop" style={{ textAlign:"center", color:flash.startsWith("✓")?C.pos:C.neg,
          fontSize:13, fontWeight:600, marginBottom:16 }}>{flash}</div>}

        {/* riwayat singkat */}
        <div className="card scroll-x" style={{ overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", fontWeight:600, fontSize:14.5, borderBottom:`1px solid ${C.line}` }}>
            Transaksi Terakhir <span style={{ color:C.sub, fontWeight:400 }}>· {journal.length} entri</span></div>
          {journal.length===0 && <div style={{ padding:"18px", color:C.sub, fontSize:13 }}>Belum ada transaksi periode ini.</div>}
          {journal.slice(0,8).map(e=>{
            const t = e.journal_lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
            const src = e.cash_source;
            const badgeTone = src==="kas"?C.kas:src==="hutang"?C.neg:C.teal;
            const badgeText = src==="kas"?"KAS":src==="hutang"?"HUTANG":"BANK";
            return (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"12px 18px", borderBottom:`1px solid ${C.line}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:13.5 }}>{e.memo}</span>
                  {src && <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 7px",
                    borderRadius:20, background:badgeTone+"18", color:badgeTone }}>
                    {badgeText}</span>}
                </div>
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:C.sub }}>{e.entry_date}</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:700, color:C.teal }}>{money(t)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Tampilan form kategori terpilih ----
  const K = KATEGORI[kat];
  const opsi = accounts.filter(a=>a.is_active!==false).filter(K.filter);
  return (
    <div className="pop">
      <button className="btn" onClick={()=>{setKat(null);setRows([]);}}
        style={{ display:"inline-flex", alignItems:"center", gap:6, background:"transparent",
          color:C.sub, fontSize:13, marginBottom:14, padding:"4px 0" }}>
        <ChevronLeft size={16} /> Kembali ke pilihan
      </button>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ width:44, height:44, borderRadius:11, background:K.tone+"18", display:"grid", placeItems:"center" }}>
          <K.icon size={24} color={K.tone} /></div>
        <div>
          <h1 style={{ margin:0, fontSize:21, fontWeight:700 }}>{K.label}</h1>
          <div style={{ fontSize:13, color:C.sub }}>
            {K.arah==="masuk"?"Uang masuk":"Uang keluar"} · bisa isi banyak transaksi sekaligus</div>
        </div>
      </div>

      <div style={{ fontSize:12.5, color:C.sub, marginBottom:14, lineHeight:1.6,
        background:C.surf, padding:"11px 14px", borderRadius:9 }}>
        Isi satu baris per transaksi, lalu tekan <b>Simpan Semua</b>. Tiap baris jadi satu jurnal
        tersendiri, jadi tanggal dan sumber dananya boleh berbeda-beda. Baris baru otomatis
        mengikuti tanggal & sumber dana baris terakhir supaya input massal lebih cepat.
      </div>

      {/* Daftar baris transaksi */}
      {rows.map((r,i)=>{
        const nominal = +r.jumlah || 0;
        const valid = rowValid(r);
        return (
          <div key={i} className="card" style={{ padding:"14px 16px", marginBottom:10,
            borderLeft:`4px solid ${valid ? K.tone : C.line}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:".04em" }}>
                BARIS {i+1}</span>
              {valid && <span className="mono" style={{ fontSize:12, fontWeight:700, color:K.tone }}>
                {money(nominal)}</span>}
              <span style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                <button className="btn" onClick={()=>duplikatBaris(i)} title="Duplikat baris"
                  style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:4 }}>
                  <Copy size={15} /></button>
                <button className="btn" onClick={()=>hapusBaris(i)} disabled={rows.length<=1}
                  title="Hapus baris"
                  style={{ background:"transparent", color:rows.length<=1?C.line:C.neg,
                    display:"grid", placeItems:"center", padding:4 }}>
                  <Trash2 size={15} /></button>
              </span>
            </div>

            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"150px 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Tanggal</label>
                <input type="date" value={r.date}
                  onChange={e=>setRow(i,"date",e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Jumlah (Rp)</label>
                <input className="mono" inputMode="numeric" placeholder="0" value={r.jumlah}
                  onChange={e=>setRow(i,"jumlah",e.target.value.replace(/\D/g,""))}
                  style={{ ...inp, fontSize:15, fontWeight:700 }} /></div>
            </div>

            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>{K.lawanLabel}</label>
                <select value={r.lawan_id} onChange={e=>setRow(i,"lawan_id",e.target.value)} style={inp}>
                  {opsi.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select></div>
              <div><label style={lbl}>{K.arah==="masuk"?"Uang masuk ke":"Dibayar via"}</label>
                <select value={r.cash} onChange={e=>setRow(i,"cash",e.target.value)}
                  style={{ ...inp, fontWeight:600,
                    color:r.cash==="bank"?C.teal:r.cash==="kas"?C.kas:C.neg }}>
                  <option value="bank">Bank BCA</option>
                  <option value="kas">Kas (Petty Cash)</option>
                  {K.arah==="keluar" && hutangAccounts.length>0 &&
                    <option value="hutang">Hutang (belum dibayar)</option>}
                </select></div>
            </div>

            {r.cash==="hutang" && (
              <div className="pop" style={{ marginBottom:10 }}>
                <label style={lbl}>Catat sebagai hutang ke akun</label>
                <select value={r.hutang_id||""} onChange={e=>setRow(i,"hutang_id",e.target.value)}
                  style={{ ...inp, fontWeight:600, color:C.neg }}>
                  {hutangAccounts.map(h=><option key={h.id} value={h.id}>{h.code} · {h.name}</option>)}
                </select>
              </div>
            )}

            <label style={lbl}>Keterangan (opsional)</label>
            <input placeholder={`mis. ${K.label} — ${acctById[r.lawan_id]?.name || ""}`} value={r.memo}
              onChange={e=>setRow(i,"memo",e.target.value)} style={inp} />

            {nominal>0 && r.lawan_id && (
              <div style={{ background:C.surf, borderRadius:9, padding:"10px 12px", marginTop:10, fontSize:12 }}>
                <div style={{ color:C.sub, fontWeight:600, marginBottom:5, fontSize:10.5, letterSpacing:".05em" }}>JURNAL OTOMATIS:</div>
                {(() => {
                  const sumberNama = r.cash==="hutang"
                    ? (acctById[r.hutang_id]?.name || "Hutang")
                    : (r.cash==="bank" ? "Bank BCA" : "Kas");
                  return K.arah==="masuk" ? <>
                    <Auto d={sumberNama} v={nominal} side="Debet" />
                    <Auto d={acctById[r.lawan_id]?.name} v={nominal} side="Kredit" />
                  </> : <>
                    <Auto d={acctById[r.lawan_id]?.name} v={nominal} side="Debet" />
                    <Auto d={sumberNama} v={nominal} side="Kredit" />
                  </>;
                })()}
              </div>
            )}
          </div>
        );
      })}

      <button className="btn" onClick={tambahBaris}
        style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.surf, color:C.teal,
          padding:"10px 14px", borderRadius:9, fontSize:13.5, fontWeight:600, marginBottom:14 }}>
        <Plus size={16} /> Tambah transaksi lagi
      </button>

      {/* Ringkasan & tombol simpan */}
      <div className="card" style={{ padding:"14px 16px", position:"sticky", bottom:12,
        boxShadow:"0 6px 24px rgba(0,0,0,.10)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:C.sub }}>
            <b style={{ color:C.ink }}>{siap.length}</b> dari {rows.length} baris siap disimpan
          </span>
          <span className="mono" style={{ marginLeft:"auto", fontSize:15, fontWeight:700, color:K.tone }}>
            Total {money(totalSemua)}
          </span>
        </div>
        <button className="btn" onClick={simpan} disabled={siap.length===0||busy}
          style={{ width:"100%", padding:"13px", borderRadius:10,
            background: siap.length&&!busy?K.tone:C.line, color:"#fff", fontWeight:700, fontSize:15 }}>
          {busy ? `Menyimpan ${siap.length} transaksi…` : `Simpan Semua (${siap.length})`}
        </button>
        {flash && <div className="pop" style={{ marginTop:10, textAlign:"center",
          color:flash.startsWith("✓")?C.pos:C.neg, fontSize:12.5, fontWeight:600, lineHeight:1.5 }}>{flash}</div>}
      </div>
    </div>
  );
}
const Auto = ({ d, v, side }) => (
  <div style={{ display:"grid", gridTemplateColumns:"60px 1fr 120px", padding:"3px 0", alignItems:"center" }}>
    <span style={{ fontSize:11, fontWeight:700, color:side==="Debet"?C.teal:C.brass }}>{side}</span>
    <span style={{ color:C.ink, paddingLeft:side==="Kredit"?16:0 }}>{d}</span>
    <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(v)}</span>
  </div>
);

// ============================================================
// JOURNAL
// ============================================================
function Journal({ accounts, acctById, acctByCode, journal, orgId, onChange }) {
  const first = acctByCode["4-40000"]?.id || accounts[0]?.id;
  const bank = acctByCode["1-10002"]?.id;
  const blank = () => ({ date:`${YEAR}-01-01`, memo:"", cash:"bank",
    lines:[{ account_id:first, debit:"", credit:"" }, { account_id:bank, debit:"", credit:"" }] });
  const [draft, setDraft] = useState(blank());
  const [editId, setEditId] = useState(null);      // id jurnal yang sedang diedit
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  // filter tanggal
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");

  useEffect(()=>{ if(!editId) setDraft(blank()); /* eslint-disable-next-line */ }, [accounts.length]);

  const dTot = draft.lines.reduce((s,l)=>s+(+l.debit||0),0);
  const cTot = draft.lines.reduce((s,l)=>s+(+l.credit||0),0);
  const balanced = dTot===cTot && dTot>0;

  const setLine=(i,f,v)=>setDraft({...draft,lines:draft.lines.map((l,x)=>x===i?{...l,[f]:v}:l)});
  const addLine=()=>setDraft({...draft,lines:[...draft.lines,{account_id:accounts[0]?.id,debit:"",credit:""}]});
  const rmLine=(i)=>setDraft({...draft,lines:draft.lines.filter((_,x)=>x!==i)});

  const startEdit = (e) => {
    setEditId(e.id);
    setDraft({
      date: e.entry_date, memo: e.memo, cash: e.cash_source || "bank",
      lines: e.journal_lines.map(l=>({
        account_id: l.account_id,
        debit: Number(l.debit) || "",
        credit: Number(l.credit) || "",
      })),
    });
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  const cancelEdit = () => { setEditId(null); setDraft(blank()); setFlash(""); };

  const post = async () => {
    if (!balanced || !draft.memo) return;
    setBusy(true); setFlash("");
    try {
      const payload = {
        date: draft.date, memo: draft.memo, cash: draft.cash,
        lines: draft.lines.map(l=>({ account_id:l.account_id, debit:+l.debit||0, credit:+l.credit||0 })),
      };
      if (editId) {
        await updateJournal(editId, orgId, payload);
        setFlash("✓ Jurnal berhasil diperbarui");
      } else {
        await postJournal(orgId, payload);
        setFlash("✓ Jurnal diposting & tersimpan permanen");
      }
      setEditId(null); setDraft(blank());
      onChange();
    } catch (e) { setFlash("✗ " + e.message); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!confirm("Hapus jurnal ini?")) return;
    await deleteJournal(id);
    if (editId===id) cancelEdit();
    onChange();
  };

  // terapkan filter tanggal ke daftar (client-side)
  const shown = journal.filter(e=>{
    if (fStart && e.entry_date < fStart) return false;
    if (fEnd && e.entry_date > fEnd) return false;
    return true;
  });

  return (
    <div className="pop">
      <PageHead eyebrow="Inti Akuntansi" title="Jurnal Umum"
        sub={`Input sekali — Buku Besar, Neraca Saldo & Laba Rugi terisi otomatis. Tahun buku ${YEAR}.`} />
      <div style={{ display:"flex", gap:10, marginBottom:14, fontSize:12.5 }}>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:10, background:C.teal+"12",
          border:`1px solid ${C.teal}30`, color:C.deep }}>
          <b>Bank BCA</b> — gaji, incharge, THR, TMT, reward, & seluruh pendapatan.</div>
        <div style={{ flex:1, padding:"10px 14px", borderRadius:10, background:C.kas+"12",
          border:`1px solid ${C.kas}30`, color:C.kas }}>
          <b>Kas (Petty Cash)</b> — iklan, ATK, air minum, komunikasi, event, pembelian.</div>
      </div>

      <div className="card" style={{ padding:20, marginBottom:20,
        border: editId?`2px solid ${C.brass}`:`1px solid ${C.line}` }}>
        {editId && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14,
            padding:"8px 12px", borderRadius:8, background:C.brass+"15", color:C.brass, fontWeight:600, fontSize:13 }}>
            <span><Pencil size={14} style={{ verticalAlign:"-2px", marginRight:6 }} />Mode Edit — mengubah jurnal</span>
            <button className="btn" onClick={cancelEdit}
              style={{ background:"transparent", color:C.brass, display:"flex", alignItems:"center", gap:4, fontSize:12.5 }}>
              <X size={14} /> Batal</button>
          </div>
        )}
        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <div style={{ flex:"0 0 145px" }}><label style={lbl}>Tanggal</label>
            <input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})} style={inp} /></div>
          <div style={{ flex:1 }}><label style={lbl}>Keterangan</label>
            <input placeholder="mis. Gaji Pelatih Private — Januari" value={draft.memo}
              onChange={e=>setDraft({...draft,memo:e.target.value})} style={inp} /></div>
          <div style={{ flex:"0 0 160px" }}><label style={lbl}>Sumber / Penanda</label>
            <select value={draft.cash} onChange={e=>setDraft({...draft,cash:e.target.value})}
              style={{ ...inp, fontWeight:600, color:draft.cash==="bank"?C.teal:draft.cash==="kas"?C.kas:C.neg }}>
              <option value="bank">Bank BCA</option>
              <option value="kas">Kas (Petty Cash)</option>
              <option value="hutang">Hutang</option></select></div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 34px", gap:8,
          fontSize:11.5, color:C.sub, fontWeight:600, padding:"0 2px 6px" }}>
          <span>AKUN</span><span style={{ textAlign:"right" }}>DEBET</span>
          <span style={{ textAlign:"right" }}>KREDIT</span><span /></div>
        {draft.lines.map((l,i)=>(
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 34px", gap:8, marginBottom:7, alignItems:"center" }}>
            <select value={l.account_id} onChange={e=>setLine(i,"account_id",e.target.value)} style={inp}>
              {accounts.filter(a=>a.is_active!==false).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
            <input className="mono" inputMode="numeric" placeholder="0" value={l.debit}
              onChange={e=>setLine(i,"debit",e.target.value.replace(/\D/g,""))} style={{ ...inp, textAlign:"right" }} />
            <input className="mono" inputMode="numeric" placeholder="0" value={l.credit}
              onChange={e=>setLine(i,"credit",e.target.value.replace(/\D/g,""))} style={{ ...inp, textAlign:"right" }} />
            <button className="btn" onClick={()=>rmLine(i)} disabled={draft.lines.length<=2}
              style={{ background:"transparent", color:draft.lines.length<=2?C.line:C.neg,
                display:"grid", placeItems:"center", height:38, borderRadius:8 }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="btn" onClick={addLine}
          style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.surf, color:C.teal,
            padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:600, marginTop:4 }}>
          <Plus size={15} /> Tambah baris</button>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16,
          padding:"12px 14px", borderRadius:10,
          background: balanced?C.pos+"12":(dTot||cTot)?C.neg+"10":C.surf }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:600,
            color: balanced?C.pos:(dTot||cTot)?C.neg:C.sub }}>
            {balanced?<Check size={16}/>:<AlertCircle size={16}/>}
            {balanced?"Debet = Kredit — siap simpan":(dTot||cTot)?"Debet dan Kredit belum seimbang":"Masukkan nominal"}</div>
          <div className="mono" style={{ fontSize:13, color:C.sub }}>D {money(dTot)} · K {money(cTot)}</div>
        </div>
        <button className="btn" onClick={post} disabled={!balanced||!draft.memo||busy}
          style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:10,
            background: balanced&&draft.memo&&!busy?(editId?C.brass:C.teal):C.line, color:"#fff", fontWeight:700, fontSize:14.5 }}>
          {busy?"Menyimpan…":(editId?"Simpan Perubahan":"Posting ke Buku Besar")}</button>
        {flash && <div className="pop" style={{ marginTop:10, textAlign:"center",
          color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}
      </div>

      {/* filter tanggal */}
      <div className="card" style={{ padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:12.5, color:C.sub, fontWeight:600 }}>Filter tanggal:</span>
        <input type="date" value={fStart} onChange={e=>setFStart(e.target.value)} style={{ ...inp, width:160 }} />
        <span style={{ color:C.sub }}>s/d</span>
        <input type="date" value={fEnd} onChange={e=>setFEnd(e.target.value)} style={{ ...inp, width:160 }} />
        {(fStart||fEnd) && <button className="btn" onClick={()=>{setFStart("");setFEnd("");}}
          style={{ background:C.surf, color:C.sub, padding:"7px 12px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          Reset</button>}
      </div>

      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", fontWeight:600, fontSize:14.5, borderBottom:`1px solid ${C.line}` }}>
          Riwayat Jurnal <span style={{ color:C.sub, fontWeight:400 }}>· {shown.length} entri
          {(fStart||fEnd)?" (terfilter)":" (periode ini)"}</span></div>
        {shown.length===0 && <div style={{ padding:"20px 18px", color:C.sub, fontSize:13 }}>Tidak ada jurnal pada rentang ini.</div>}
        {shown.map(e=>{
          const t = e.journal_lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
          const src = e.cash_source; // "bank" | "kas" | "hutang" | null
          const badgeTone = src==="kas"?C.kas:src==="hutang"?C.neg:C.teal;
          const badgeText = src==="kas"?"KAS":src==="hutang"?"HUTANG":"BANK";
          return (
            <div key={e.id} style={{ padding:"13px 18px", borderBottom:`1px solid ${C.line}`,
              background: editId===e.id ? C.brass+"08" : "transparent" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:13.5 }}>{e.memo}</span>
                  {src && <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 7px",
                    borderRadius:20, background:badgeTone+"18", color:badgeTone }}>
                    {badgeText}</span>}
                  {e.kind!=="general" && <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 7px",
                    borderRadius:20, background:C.brass+"20", color:C.brass }}>{e.kind.toUpperCase()}</span>}
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:C.sub }}>{e.entry_date}</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:700, color:C.teal }}>{money(t)}</span>
                  <button className="btn" onClick={()=>startEdit(e)} title="Edit"
                    style={{ background:"transparent", color:C.sub }}
                    onMouseEnter={ev=>ev.currentTarget.style.color=C.teal}
                    onMouseLeave={ev=>ev.currentTarget.style.color=C.sub}><Pencil size={14} /></button>
                  <button className="btn" onClick={()=>del(e.id)} title="Hapus"
                    style={{ background:"transparent", color:C.sub }}
                    onMouseEnter={ev=>ev.currentTarget.style.color=C.neg}
                    onMouseLeave={ev=>ev.currentTarget.style.color=C.sub}><Trash2 size={14} /></button>
                </div>
              </div>
              {e.journal_lines.map((l,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 130px 130px",
                  fontSize:12.5, color:C.sub, padding:"2px 0" }}>
                  <span style={{ paddingLeft:Number(l.credit)?20:0 }}>
                    {acctById[l.account_id]?.code} · {acctById[l.account_id]?.name}</span>
                  <span className="mono" style={{ textAlign:"right" }}>{Number(l.debit)?money(l.debit):""}</span>
                  <span className="mono" style={{ textAlign:"right" }}>{Number(l.credit)?money(l.credit):""}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// LEDGER
// ============================================================
function Ledger({ balances }) {
  const [q, setQ] = useState("");
  const [fCabang, setFCabang] = useState("");   // "" = semua cabang
  const groups = ["Kas & Bank","Akun Piutang","Aktiva Tetap","Ekuitas","Pendapatan","COGS","Beban Op","Beban Kas","Other Income","Other Expense"];

  // cabang yang tersedia di data saldo (kalau RPC mengembalikan kolom branch)
  const cabangAda = daftarCabang(balances);
  const adaKolomCabang = cabangAda.length > 0;

  const shown = balances.filter(a=>(Number(a.debit)||Number(a.credit))&&
    (a.name.toLowerCase().includes(q.toLowerCase())||a.code.includes(q)) &&
    (!fCabang || a.branch===fCabang));

  const totalTampil = shown.reduce((s,a)=>s+Number(a.balance||0),0);

  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Buku Besar" sub={`Saldo tiap akun dari jurnal · ${YEAR}`} />
      <div className="card" style={{ padding:"10px 14px", marginBottom:16, display:"flex",
        alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:180 }}>
          <Search size={16} color={C.sub} />
          <input placeholder="Cari akun atau kode…" value={q} onChange={e=>setQ(e.target.value)}
            style={{ border:"none", outline:"none", fontSize:13.5, flex:1, background:"transparent" }} />
        </div>
        {adaKolomCabang && (
          <select value={fCabang} onChange={e=>setFCabang(e.target.value)}
            style={{ ...inp, width:"auto", minWidth:160, fontWeight:600,
              color: fCabang ? C.teal : C.sub }}>
            <option value="">Semua cabang</option>
            {cabangAda.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {fCabang && (
        <div style={{ padding:"10px 14px", borderRadius:9, background:C.teal+"0D",
          border:`1px solid ${C.teal}25`, fontSize:12.5, color:C.deep, marginBottom:14 }}>
          Menampilkan akun cabang <b>{fCabang}</b> saja · {shown.length} akun ·
          total saldo <span className="mono"><b>{money(totalTampil)}</b></span>
        </div>
      )}
      {groups.map(g=>{ const rows=shown.filter(a=>a.type===g); if(!rows.length) return null;
        return (
          <div key={g} className="card" style={{ marginBottom:14, overflow:"hidden" }}>
            <div style={{ padding:"11px 18px", background:C.surf, fontWeight:600, fontSize:13, color:C.deep }}>{g}</div>
            {rows.map(a=>(
              <div key={a.code} style={{ display:"grid", gridTemplateColumns:"1fr 130px 130px 140px",
                padding:"11px 18px", borderTop:`1px solid ${C.line}`, fontSize:13, alignItems:"center" }}>
                <span><b style={{ color:C.deep }}>{a.code}</b> <span style={{ color:C.sub }}>{a.name}</span>
                  {a.branch && <span style={{ fontSize:9.5, fontWeight:700, marginLeft:6, padding:"1px 7px",
                    borderRadius:20, background:warnaCabang(a.branch, cabangAda)+"18",
                    color:warnaCabang(a.branch, cabangAda) }}>{a.branch}</span>}</span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(a.debit)}</span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(a.credit)}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:700 }}>{money(a.balance)}</span>
              </div>
            ))}
          </div>
        );
      })}
      {!adaKolomCabang && (
        <div style={{ fontSize:11.5, color:C.sub, marginTop:4, lineHeight:1.5 }}>
          Label cabang belum bisa ditampilkan karena fungsi <b>account_balances</b> di database belum
          mengembalikan kolom <b>branch</b>. Saldo dan totalnya tetap benar — semua akun cabang sudah ikut terhitung.
        </div>
      )}
    </div>
  );
}

// ============================================================
// TRIAL BALANCE
// ============================================================
function Trial({ balances }) {
  const rows = balances.filter(a=>Number(a.debit)||Number(a.credit));
  const cabangAda = daftarCabang(balances);
  const dSum = rows.reduce((s,a)=>s+Number(a.debit),0);
  const cSum = rows.reduce((s,a)=>s+Number(a.credit),0);
  const bal = Math.round(dSum)===Math.round(cSum);
  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Neraca Saldo" sub={`Total debet harus sama dengan total kredit · ${YEAR}`} />
      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 160px 160px", padding:"12px 20px",
          background:C.deep, color:"#DDECEC", fontSize:12, fontWeight:600 }}>
          <span>AKUN</span><span style={{ textAlign:"right" }}>DEBET</span><span style={{ textAlign:"right" }}>KREDIT</span></div>
        {rows.map(a=>(
          <div key={a.code} style={{ display:"grid", gridTemplateColumns:"1fr 160px 160px",
            padding:"10px 20px", borderBottom:`1px solid ${C.line}`, fontSize:13 }}>
            <span><b style={{ color:C.deep }}>{a.code}</b> <span style={{ color:C.sub }}>{a.name}</span>
              {a.branch && <span style={{ fontSize:9.5, fontWeight:700, marginLeft:6, padding:"1px 7px",
                borderRadius:20, background:warnaCabang(a.branch, cabangAda)+"18",
                color:warnaCabang(a.branch, cabangAda) }}>{a.branch}</span>}</span>
            <span className="mono" style={{ textAlign:"right" }}>{money(a.debit)}</span>
            <span className="mono" style={{ textAlign:"right" }}>{money(a.credit)}</span></div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 160px 160px", padding:"14px 20px",
          background:bal?C.pos+"12":C.neg+"12", fontWeight:700, fontSize:14 }}>
          <span style={{ color:bal?C.pos:C.neg }}>{bal?"✓ SEIMBANG":"✗ TIMPANG"}</span>
          <span className="mono" style={{ textAlign:"right" }}>{money(dSum)}</span>
          <span className="mono" style={{ textAlign:"right" }}>{money(cSum)}</span></div>
      </div>
    </div>
  );
}

// ============================================================
// P&L — toggle Lengkap / Bank saja
// ============================================================
function PnL({ pnl, pnlPrev, period, accounts }) {
  const [view, setView] = useState("full");
  const bankOnly = view==="bank";
  const g = (type,branch) => pnl.filter(r=>r.type===type&&(!branch||r.branch===branch));
  const S = (type,branch) => g(type,branch).reduce((s,r)=>s+Number(r.amount),0);

  const rev=S("Pendapatan");
  const cabang = perCabang(pnl, accounts);
  const cogs=S("COGS"), opBank=S("Beban Op");
  const kasBeban=S("Beban Kas"), oi=S("Other Income"), oe=S("Other Expense");
  const grossProfit=rev-cogs, afterOp=grossProfit-opBank-kasBeban, profitFull=afterOp+oi-oe;
  const profitBank=rev-opBank+oi-oe;
  const shown=bankOnly?profitBank:profitFull;
  const pettyTotal=cogs+kasBeban;
  const labelPeriode = period==="all" ? `Tahun ${YEAR}` : `${MONTHS[period]} ${YEAR}`;

  const Row=({r,ind})=>(
    <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 170px", padding:"8px 20px",
      borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
      <span className="mono" style={{ color:C.deep, fontWeight:600 }}>{r.code}</span>
      <span style={{ color:C.sub, paddingLeft:ind?12:0 }}>{r.name}</span>
      <span className="mono" style={{ textAlign:"right" }}>{money(Number(r.amount))}</span></div>);
  const Section=({t,tone})=>(<div style={{ padding:"10px 20px", background:(tone||C.teal)+"15",
    fontWeight:700, color:C.deep, fontSize:12.5 }}>{t}</div>);
  const Sub=({l,v,strong,tone})=>(<div style={{ display:"grid", gridTemplateColumns:"1fr 170px",
    padding:strong?"12px 20px":"9px 20px", background:strong?C.deep:C.surf, color:strong?"#fff":C.ink,
    fontWeight:strong?700:600, fontSize:strong?13.5:12.5 }}>
    <span>{l}</span><span className="mono" style={{ textAlign:"right", color:strong?"#fff":(tone||C.ink) }}>{money(v)}</span></div>);

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Turunan Otomatis" title="Laporan Laba / Rugi"
          sub={`${labelPeriode} · ${bankOnly?"Hanya beban yang keluar dari Bank BCA":"Seluruh beban (akuntansi lengkap)"}`} />
        <div style={{ display:"inline-flex", background:C.surf, borderRadius:10, padding:3, gap:2, marginTop:4 }}>
          {[{k:"full",l:"Lengkap"},{k:"bank",l:"Bank saja"}].map(o=>(
            <button key={o.k} className="btn" onClick={()=>setView(o.k)}
              style={{ padding:"7px 16px", borderRadius:8, fontSize:12.5, fontWeight:600,
                background:view===o.k?"#fff":"transparent", color:view===o.k?C.deep:C.sub,
                boxShadow:view===o.k?"0 1px 3px rgba(0,0,0,.08)":"none" }}>{o.l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:"11px 15px", borderRadius:10, marginBottom:16, fontSize:12.5, lineHeight:1.5,
        background:bankOnly?C.kas+"10":C.teal+"0D", border:`1px solid ${bankOnly?C.kas+"30":C.teal+"25"}`, color:C.deep }}>
        {bankOnly
          ? <>Laba versi <b>arus kas Bank</b> — beban petty cash tidak dihitung, hanya jadi catatan di bawah.</>
          : <>Laba <b>sesungguhnya</b> — semua beban dihitung. Pakai angka ini untuk keputusan, wakaf, dividen.</>}
      </div>

      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        {cabang.map(b=>(
          <React.Fragment key={"rev-"+b.nama}>
            <Section t={`PENDAPATAN CABANG ${b.nama.toUpperCase()}`} />
            {g("Pendapatan",b.nama).length
              ? g("Pendapatan",b.nama).map(r=><Row key={r.code} r={r} ind/>)
              : <Empty/>}
            <Sub l={`Total Pendapatan ${b.nama}`} v={b.rev} />
          </React.Fragment>
        ))}
        {g("Pendapatan","").length>0 && <>
          <Section t="PENDAPATAN UMUM (tanpa cabang)" />
          {pnl.filter(r=>r.type==="Pendapatan" && !r.branch).map(r=><Row key={r.code} r={r} ind/>)}
        </>}
        <Sub l="TOTAL PENDAPATAN KOTOR SAMUDRA" v={rev} tone={C.pos} />

        {!bankOnly && <>
          <Section t="COST OF GOODS SALES (dari Kas)" tone={C.kas} />
          {g("COGS").length?g("COGS").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
          <Sub l="Total COGS" v={cogs} tone={C.neg} />
          <Sub l="LABA KOTOR" v={grossProfit} strong />
        </>}

        {cabang.map(b=>(
          <React.Fragment key={"op-"+b.nama}>
            <Section t={`BIAYA OPERASIONAL ${b.nama.toUpperCase()} (dari Bank)`} />
            {g("Beban Op",b.nama).length
              ? g("Beban Op",b.nama).map(r=><Row key={r.code} r={r} ind/>)
              : <Empty/>}
            <Sub l={`Total Operasional ${b.nama}`} v={b.op} tone={C.neg} />
          </React.Fragment>
        ))}
        {pnl.filter(r=>r.type==="Beban Op" && !r.branch).length>0 && <>
          <Section t="BIAYA OPERASIONAL UMUM (tanpa cabang)" />
          {pnl.filter(r=>r.type==="Beban Op" && !r.branch).map(r=><Row key={r.code} r={r} ind/>)}
          <Sub l="Total Operasional Umum"
            v={pnl.filter(r=>r.type==="Beban Op" && !r.branch)
                  .reduce((s,r)=>s+Number(r.amount),0)} tone={C.neg} />
        </>}
        <Sub l="TOTAL BIAYA OPERASIONAL (semua cabang + umum)" v={opBank} strong />

        {!bankOnly && <>
          <Section t="BEBAN UMUM & ADMIN (dari Kas)" tone={C.kas} />
          {g("Beban Kas").length?g("Beban Kas").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
          <Sub l="Total Beban Kas" v={kasBeban} tone={C.neg} />
          <Sub l="LABA SETELAH BIAYA OPERASIONAL" v={afterOp} strong />
        </>}

        {(g("Other Income").length||(!bankOnly&&g("Other Expense").length))?<>
          <Section t="OTHER INCOME / EXPENSE" tone={C.brass} />
          {g("Other Income").map(r=><Row key={r.code} r={r} ind/>)}
          {!bankOnly && g("Other Expense").map(r=><Row key={r.code} r={r} ind/>)}
        </>:null}
      </div>

      {bankOnly && pettyTotal>0 && (
        <div className="card" style={{ marginTop:14, overflow:"hidden", borderColor:C.kas+"40" }}>
          <div style={{ padding:"11px 20px", background:C.kas+"12", fontWeight:700, color:C.kas, fontSize:12.5 }}>
            CATATAN — BEBAN DITANGGUNG PETTY CASH (tidak masuk laba versi ini)</div>
          {[...g("COGS"),...g("Beban Kas")].map(r=>(
            <div key={r.code} style={{ display:"grid", gridTemplateColumns:"120px 1fr 170px",
              padding:"8px 20px", borderTop:`1px solid ${C.line}`, fontSize:12.5 }}>
              <span className="mono" style={{ color:C.kas, fontWeight:600 }}>{r.code}</span>
              <span style={{ color:C.sub }}>{r.name}</span>
              <span className="mono" style={{ textAlign:"right" }}>{money(Number(r.amount))}</span></div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"10px 20px",
            background:C.kas+"0D", fontWeight:700, fontSize:12.5 }}>
            <span>Total Beban Petty Cash</span>
            <span className="mono" style={{ textAlign:"right", color:C.kas }}>{money(pettyTotal)}</span></div>
        </div>
      )}

      <div className="card" style={{ padding:"18px 20px", marginTop:16, display:"flex",
        justifyContent:"space-between", alignItems:"center",
        background:shown>=0?C.pos+"10":C.neg+"10", border:`1px solid ${shown>=0?C.pos+"40":C.neg+"40"}` }}>
        <div><div style={{ fontSize:12.5, color:C.sub, fontWeight:600 }}>
          {bankOnly?"LABA VERSI BANK (arus kas rekening)":"PROFIT (LOSS) — LABA BERSIH"}</div>
          <div style={{ fontSize:11.5, color:C.sub, marginTop:2 }}>
            Margin {rev?pct(shown/rev):"–"}{bankOnly?" · petty cash "+money(pettyTotal)+" belum dipotong":" · sebelum Wakaf & Deviden"}</div></div>
        <div className="mono" style={{ fontSize:28, fontWeight:800, color:shown>=0?C.pos:C.neg }}>{money(shown)}</div>
      </div>

      {/* Perbandingan dengan tahun sebelumnya */}
      {(()=>{
        const lalu = ringkasPnl(pnlPrev);
        if (!(lalu.rev > 0 || lalu.totalBeban > 0)) return null;
        const rows = [
          { l:"Total Pendapatan",           a:rev,            b:lalu.rev,      terbalik:false },
          { l:"COGS (pembelian)",           a:cogs,           b:lalu.cogs,     terbalik:true  },
          { l:"Biaya Operasional (Bank)",   a:opBank,         b:lalu.opBank,   terbalik:true  },
          { l:"Beban Umum & Admin (Kas)",   a:kasBeban,       b:lalu.kasBeban, terbalik:true  },
          { l:"Total Beban",                a:cogs+opBank+kasBeban+oe, b:lalu.totalBeban, terbalik:true },
          { l:"Laba Bersih",                a:profitFull,     b:lalu.laba,     terbalik:false, tebal:true },
        ];
        return (
          <div className="card" style={{ marginTop:16, overflow:"hidden" }}>
            <div style={{ padding:"12px 20px", background:C.brass+"18", fontWeight:700, color:C.deep, fontSize:13 }}>
              PERBANDINGAN DENGAN {YEAR-1} — {period==="all"?"setahun penuh":MONTHS[period]}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 150px 90px",
              padding:"9px 20px", background:C.surf, fontSize:11, fontWeight:600, color:C.sub }}>
              <span>POS</span>
              <span style={{ textAlign:"right" }}>{YEAR-1}</span>
              <span style={{ textAlign:"right" }}>{YEAR}</span>
              <span style={{ textAlign:"right" }}>SELISIH</span>
              <span style={{ textAlign:"center" }}>±</span>
            </div>
            {rows.map(r=>{
              const g = deltaPct(r.a, r.b);
              const selisih = r.a - r.b;
              const bagus = r.terbalik ? selisih<=0 : selisih>=0;
              return (
                <div key={r.l} style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 150px 90px",
                  padding: r.tebal?"12px 20px":"9px 20px", borderBottom:`1px solid ${C.line}`,
                  fontSize:12.5, alignItems:"center",
                  background: r.tebal?C.surf:"transparent", fontWeight: r.tebal?700:400 }}>
                  <span style={{ color:r.tebal?C.ink:C.sub }}>{r.l}</span>
                  <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(r.b)}</span>
                  <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(r.a)}</span>
                  <span className="mono" style={{ textAlign:"right", fontWeight:600,
                    color: bagus?C.pos:C.neg }}>{selisih>=0?"+":""}{money(selisih)}</span>
                  <span style={{ textAlign:"center" }}><YoYBadge g={g} terbalik={r.terbalik} /></span>
                </div>
              );
            })}
            <div style={{ padding:"11px 20px", fontSize:11.5, color:C.sub, lineHeight:1.5 }}>
              Warna hijau berarti perubahan yang menguntungkan: pendapatan & laba naik, atau beban turun.
              Persentase tidak ditampilkan bila pos tahun {YEAR-1} masih nol.
            </div>
          </div>
        );
      })()}
    </div>
  );
}
const Empty=()=><div style={{ padding:"9px 20px", fontSize:12, color:C.sub, fontStyle:"italic",
  borderBottom:`1px solid ${C.line}` }}>Belum ada transaksi pada periode ini</div>;

// ============================================================
// BALANCE SHEET
// ============================================================
/* ============================================================
   PEMERIKSA SELISIH NERACA
   Neraca timpang hampir selalu berasal dari akun yang kolom
   `statement`-nya tidak cocok dengan `type`-nya: akun beban yang
   ditandai NRC ikut tampil di neraca tapi dilewati saat menghitung
   laba, atau sebaliknya. Fungsi ini mencari akun seperti itu dan
   mencocokkan saldonya dengan besar selisih.
   ============================================================ */
const TIPE_NERACA = ["Kas & Bank","Akun Piutang","Aktiva Tetap","Kewajiban","Ekuitas"];
const TIPE_LABARUGI = ["Pendapatan","Other Income","COGS","Beban Op","Beban Kas","Other Expense"];

function periksaNeraca(accounts, balances, selisih) {
  const saldo = {};
  (balances||[]).forEach(b=>{ saldo[b.code] = Number(b.balance)||0; });

  const salahStatement = [], tipeAsing = [];
  (accounts||[]).forEach(a=>{
    const s = saldo[a.code] || 0;
    const seharusnya = TIPE_NERACA.includes(a.type) ? "NRC"
                     : TIPE_LABARUGI.includes(a.type) ? "LR" : null;
    if (seharusnya === null) {
      if (s !== 0) tipeAsing.push({ ...a, saldo:s });
    } else if (a.statement !== seharusnya) {
      salahStatement.push({ ...a, saldo:s, seharusnya });
    }
  });

  // rekonsiliasi per kelompok, dari saldo seluruh akun
  const jml = (tipe, balik) => (balances||[])
    .filter(b=>tipe.includes(b.type))
    .reduce((t,b)=>t + (balik ? -Number(b.balance||0) : Number(b.balance||0)), 0);
  const aktiva     = jml(["Kas & Bank","Akun Piutang","Aktiva Tetap"]);
  const kewajiban  = jml(["Kewajiban"]);
  const ekuitas    = jml(["Ekuitas"]);
  const pendapatan = jml(["Pendapatan","Other Income"]);
  const beban      = jml(["COGS","Beban Op","Beban Kas","Other Expense"]);
  const selisihJurnal = aktiva - (kewajiban + ekuitas + pendapatan - beban);

  const tersangka = [...salahStatement, ...tipeAsing];
  const totalTersangka = tersangka.reduce((t,x)=>t+Math.abs(x.saldo), 0);
  const cocok = tersangka.length > 0 &&
    Math.abs(totalTersangka - Math.abs(selisih)) < 1;

  return { salahStatement, tipeAsing, tersangka, totalTersangka, cocok,
           aktiva, kewajiban, ekuitas, pendapatan, beban, selisihJurnal,
           adaData: (balances||[]).length > 0 };
}

function Balance({ sheet, retained, period, accounts, balances }) {
  const aset = sheet.filter(a=>["Kas & Bank","Akun Piutang","Aktiva Tetap"].includes(a.type));
  const hutang = sheet.filter(a=>a.type==="Kewajiban");
  const modal = sheet.filter(a=>a.type==="Ekuitas");
  const totalAset = aset.reduce((s,a)=>s+Number(a.balance),0);
  const totalHutang = hutang.reduce((s,a)=>s+Number(a.balance),0);
  const totalModalInput = modal.reduce((s,a)=>s+Number(a.balance),0);
  const totalModal = totalModalInput + Number(retained);
  const totalPasiva = totalHutang + totalModal;
  const bal = Math.round(totalAset)===Math.round(totalPasiva);
  const label = period==="all"?"Posisi akhir "+YEAR:`Posisi s/d ${MONTHS[period]} ${YEAR}`;

  const Row=({a})=>{
    const isKontra = Number(a.balance) < 0;   // kontra-aset (mis. Akumulasi Penyusutan)
    return (<div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"9px 20px",
      borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
      <span style={{ color:C.sub, paddingLeft:isKontra?14:0 }}>
        <b style={{ color:C.deep }}>{a.code}</b> {a.name}</span>
      <span className="mono" style={{ textAlign:"right", color:isKontra?C.neg:C.ink }}>
        {money(Number(a.balance))}</span></div>);
  };

  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Neraca" sub={label} />
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div className="card" style={{ overflow:"hidden", alignSelf:"flex-start" }}>
          <div style={{ padding:"11px 20px", background:C.teal+"15", fontWeight:700, color:C.deep, fontSize:13 }}>AKTIVA</div>
          {aset.map(a=><Row key={a.code} a={a} />)}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"12px 20px",
            background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>
            <span>TOTAL AKTIVA</span><span className="mono" style={{ textAlign:"right" }}>{money(totalAset)}</span></div>
        </div>
        <div className="card" style={{ overflow:"hidden", alignSelf:"flex-start" }}>
          {/* Kewajiban */}
          <div style={{ padding:"11px 20px", background:C.neg+"12", fontWeight:700, color:C.deep, fontSize:13 }}>KEWAJIBAN (HUTANG)</div>
          {hutang.length ? hutang.map(a=><Row key={a.code} a={a} />)
            : <div style={{ padding:"9px 20px", fontSize:12, color:C.sub, fontStyle:"italic", borderBottom:`1px solid ${C.line}` }}>Tidak ada hutang</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"9px 20px",
            background:C.surf, fontWeight:600, fontSize:12.5, borderBottom:`1px solid ${C.line}` }}>
            <span>Total Kewajiban</span><span className="mono" style={{ textAlign:"right", color:C.neg }}>{money(totalHutang)}</span></div>
          {/* Modal */}
          <div style={{ padding:"11px 20px", background:C.brass+"18", fontWeight:700, color:C.deep, fontSize:13 }}>MODAL (EKUITAS)</div>
          {modal.map(a=><Row key={a.code} a={a} />)}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"9px 20px",
            borderBottom:`1px solid ${C.line}`, fontSize:12.5, background:C.surf }}>
            <span style={{ color:C.sub }}>Laba berjalan periode</span>
            <span className="mono" style={{ textAlign:"right", color:C.pos }}>{money(Number(retained))}</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"12px 20px",
            background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>
            <span>TOTAL PASIVA</span><span className="mono" style={{ textAlign:"right" }}>{money(totalPasiva)}</span></div>
        </div>
      </div>
      <div className="card" style={{ marginTop:14, padding:"14px 20px", textAlign:"center",
        background:bal?C.pos+"10":C.neg+"10", border:`1px solid ${bal?C.pos+"40":C.neg+"40"}`,
        color:bal?C.pos:C.neg, fontWeight:700, fontSize:14 }}>
        {bal?"✓ SEIMBANG — Total Aktiva = Kewajiban + Modal":`✗ SELISIH ${money(Math.abs(totalAset-totalPasiva))}`}
      </div>

      {/* ---- Pemeriksa selisih ---- */}
      {!bal && (()=>{
        const selisih = totalAset - totalPasiva;
        const d = periksaNeraca(accounts, balances, selisih);
        if (!d.adaData) return (
          <div className="card" style={{ marginTop:12, padding:"14px 18px", fontSize:12.5,
            color:C.sub, lineHeight:1.6 }}>
            Memuat data akun untuk menelusuri selisih… tekan <b>Refresh</b> bila tidak muncul.
          </div>
        );
        return (
          <div className="card" style={{ marginTop:12, overflow:"hidden" }}>
            <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.line}` }}>
              <div style={{ fontWeight:700, fontSize:14 }}>Penelusuran Selisih</div>
              <div style={{ fontSize:12, color:C.sub, marginTop:3, lineHeight:1.55 }}>
                {selisih < 0
                  ? "Pasiva lebih besar dari Aktiva — biasanya karena ada beban yang tidak ikut terhitung saat menghitung laba, sehingga labanya kelebihan."
                  : "Aktiva lebih besar dari Pasiva — biasanya karena ada pendapatan atau kewajiban yang tidak terbaca di laporan."}
              </div>
            </div>

            {/* rekonsiliasi kelompok */}
            <div className="scroll-x" style={{ borderBottom:`1px solid ${C.line}` }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 170px",
                padding:"9px 18px", background:C.surf, fontSize:11, fontWeight:600, color:C.sub }}>
                <span>REKONSILIASI DARI SELURUH AKUN</span>
                <span style={{ textAlign:"right" }}>SALDO</span>
              </div>
              {[
                { l:"Aktiva", v:d.aktiva },
                { l:"Kewajiban", v:d.kewajiban },
                { l:"Ekuitas (modal disetor)", v:d.ekuitas },
                { l:"Pendapatan", v:d.pendapatan },
                { l:"Beban", v:-d.beban },
              ].map(x=>(
                <div key={x.l} style={{ display:"grid", gridTemplateColumns:"1fr 170px",
                  padding:"7px 18px", fontSize:12.5, borderBottom:`1px solid ${C.line}` }}>
                  <span style={{ color:C.sub }}>{x.l}</span>
                  <span className="mono" style={{ textAlign:"right" }}>{money(x.v)}</span>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 170px",
                padding:"10px 18px", fontSize:12.5, fontWeight:700,
                background: Math.abs(d.selisihJurnal)<1 ? C.pos+"0D" : C.neg+"0D" }}>
                <span>Aktiva − (Kewajiban + Ekuitas + Pendapatan − Beban)</span>
                <span className="mono" style={{ textAlign:"right",
                  color: Math.abs(d.selisihJurnal)<1 ? C.pos : C.neg }}>{money(d.selisihJurnal)}</span>
              </div>
            </div>

            <div style={{ padding:"12px 18px", fontSize:12.5, color:C.ink, lineHeight:1.65,
              borderBottom:`1px solid ${C.line}` }}>
              {Math.abs(d.selisihJurnal) < 1
                ? <><b style={{ color:C.pos }}>Jurnalnya sendiri seimbang.</b> Jadi angkanya benar —
                    yang keliru adalah penggolongan akun, sehingga sebagian saldo tidak terbaca
                    laporan. Lihat daftar di bawah.</>
                : <><b style={{ color:C.neg }}>Penjumlahan seluruh akun juga tidak nol
                    ({money(Math.abs(d.selisihJurnal))}).</b> Ini mengarah ke entri jurnal yang debet
                    dan kreditnya tidak sama. Jalankan query di bagian bawah untuk memastikan yang mana.</>}
            </div>

            {/* akun bermasalah */}
            {d.tersangka.length > 0 ? (
              <>
                <div style={{ padding:"11px 18px", background:C.brass+"12",
                  fontWeight:700, fontSize:12.5, color:C.deep }}>
                  AKUN YANG PENGGOLONGANNYA KELIRU ({d.tersangka.length})
                </div>
                <div className="scroll-x">
                  <div style={{ display:"grid", gridTemplateColumns:"105px 1.4fr 120px 150px 130px",
                    padding:"9px 18px", background:C.deep, color:"#DDECEC", fontSize:10, fontWeight:600 }}>
                    <span>KODE</span><span>NAMA AKUN</span><span>TIPE</span>
                    <span style={{ textAlign:"center" }}>MASALAH</span>
                    <span style={{ textAlign:"right" }}>SALDO</span>
                  </div>
                  {d.salahStatement.map(a=>(
                    <div key={a.id} style={{ display:"grid",
                      gridTemplateColumns:"105px 1.4fr 120px 150px 130px",
                      padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                      <span className="mono" style={{ fontWeight:600, color:C.deep }}>{a.code}</span>
                      <span>{a.name}</span>
                      <span style={{ color:C.sub, fontSize:11 }}>{a.type}</span>
                      <span style={{ textAlign:"center", fontSize:11, color:C.neg, fontWeight:600 }}>
                        statement {a.statement} → {a.seharusnya}</span>
                      <span className="mono" style={{ textAlign:"right", fontWeight:700,
                        color:a.saldo?C.neg:C.sub }}>{money(a.saldo)}</span>
                    </div>
                  ))}
                  {d.tipeAsing.map(a=>(
                    <div key={a.id} style={{ display:"grid",
                      gridTemplateColumns:"105px 1.4fr 120px 150px 130px",
                      padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                      <span className="mono" style={{ fontWeight:600, color:C.deep }}>{a.code}</span>
                      <span>{a.name}</span>
                      <span style={{ color:C.neg, fontSize:11 }}>{a.type}</span>
                      <span style={{ textAlign:"center", fontSize:11, color:C.neg, fontWeight:600 }}>
                        tipe tidak dikenali</span>
                      <span className="mono" style={{ textAlign:"right", fontWeight:700, color:C.neg }}>
                        {money(a.saldo)}</span>
                    </div>
                  ))}
                  <div style={{ display:"grid", gridTemplateColumns:"105px 1.4fr 120px 150px 130px",
                    padding:"10px 18px", background:C.surf, fontSize:12.5, fontWeight:700 }}>
                    <span></span><span>TOTAL SALDO AKUN BERMASALAH</span><span></span><span></span>
                    <span className="mono" style={{ textAlign:"right" }}>{money(d.totalTersangka)}</span>
                  </div>
                </div>

                <div style={{ padding:"13px 18px", fontSize:12.5, color:C.ink, lineHeight:1.7 }}>
                  {d.cocok ? (
                    <><b style={{ color:C.pos }}>Ketemu.</b> Total saldo akun bermasalah
                      ({money(d.totalTersangka)}) sama persis dengan selisih neraca
                      ({money(Math.abs(selisih))}) — jadi inilah penyebabnya.
                      <div style={{ marginTop:9 }}>
                        <b>Cara memperbaiki:</b> buka menu <b>Chart of Account</b>, cari akun di atas,
                        klik ikon pensil, lalu tetapkan tipenya dengan benar. Kalau akun itu memang
                        beban, pilih tipe <b>Beban Kas</b> atau <b>Beban Op</b> — kolom "Masuk Laporan"
                        akan ikut berubah jadi Laba Rugi dengan sendirinya. Kalau sebenarnya aset,
                        pilih <b>Aktiva Tetap</b>.
                      </div>
                      <div style={{ marginTop:7, fontSize:11.5, color:C.sub }}>
                        Catatan: untuk akun yang sudah dipakai di jurnal, tipe terkunci demi keamanan
                        laporan. Perbaikannya lewat SQL di bawah.
                      </div></>
                  ) : (
                    <><b style={{ color:C.brass }}>Belum pas.</b> Total saldo akun bermasalah
                      ({money(d.totalTersangka)}) berbeda dari selisih neraca ({money(Math.abs(selisih))}).
                      Perbaiki dulu akun di atas, lalu buka ulang halaman ini — kalau masih bersisa,
                      berarti ada juga jurnal yang debet-kreditnya timpang.</>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding:"14px 18px", fontSize:12.5, color:C.ink, lineHeight:1.7 }}>
                <b>Tidak ada akun yang salah golong.</b> Berarti selisihnya datang dari entri jurnal
                yang debet dan kreditnya tidak sama, atau dari akun yang saldonya tidak terbaca
                fungsi laporan. Jalankan query di bawah di Supabase untuk menemukannya.
              </div>
            )}

            {/* query cadangan */}
            <details className="no-print" style={{ borderTop:`1px solid ${C.line}` }}>
              <summary style={{ padding:"11px 18px", cursor:"pointer", fontSize:12.5,
                fontWeight:600, color:C.deep }}>
                Query SQL untuk menelusuri lebih dalam
              </summary>
              <div style={{ padding:"0 18px 14px" }}>
                <div style={{ fontSize:11.5, color:C.sub, marginBottom:6, lineHeight:1.5 }}>
                  Jalankan di Supabase → SQL Editor. Query ini mencari entri jurnal yang debet ≠ kredit:
                </div>
                <pre className="mono" style={{ background:C.deep, color:"#DDECEC", padding:"12px 14px",
                  borderRadius:9, fontSize:11, lineHeight:1.6, overflowX:"auto", margin:0 }}>
{`select e.id, e.entry_date, e.memo,
       sum(l.debit)  as total_debet,
       sum(l.credit) as total_kredit,
       sum(l.debit) - sum(l.credit) as selisih
from journal_entries e
join journal_lines l on l.entry_id = e.id
group by e.id, e.entry_date, e.memo
having abs(sum(l.debit) - sum(l.credit)) > 0.005
order by e.entry_date;`}
                </pre>
                <div style={{ fontSize:11.5, color:C.sub, margin:"10px 0 6px", lineHeight:1.5 }}>
                  Dan ini untuk memperbaiki penggolongan akun yang terkunci:
                </div>
                <pre className="mono" style={{ background:C.deep, color:"#DDECEC", padding:"12px 14px",
                  borderRadius:9, fontSize:11, lineHeight:1.6, overflowX:"auto", margin:0 }}>
{`update accounts
set type = 'Beban Kas', statement = 'LR', normal_side = 'Db'
where code = 'GANTI-KODE-AKUN';`}
                </pre>
              </div>
            </details>
          </div>
        );
      })()}

      <div style={{ fontSize:11.5, color:C.sub, marginTop:12, lineHeight:1.6 }}>
        Neraca menyajikan posisi keuangan <b>satu entitas utuh</b>, mencakup seluruh cabang. Aset
        seperti rekening bank, kas, dan peralatan dimiliki bersama sehingga tidak dipecah per cabang.
        Kontribusi masing-masing cabang terhadap laba bisa dilihat di <b>Laba Rugi</b>,
        <b> Analisis Keuangan</b>, dan <b>Laporan Owner</b>.
      </div>
    </div>
  );
}

// ============================================================
// EQUITY (Perubahan Modal)
// ============================================================
function Equity({ orgId, period }) {
  const [rows, setRows] = useState(null);
  useEffect(()=>{ (async()=>{
    const [, end] = periodRange(YEAR, period);
    const prof = await rpcRetainedProfit(orgId, end);
    const sheet = await rpcBalanceSheet(orgId, end);
    setRows({ prof, sheet });
  })(); }, [orgId, period]);
  if (!rows) return <Center>Memuat…</Center>;
  const modalAwal = rows.sheet.filter(a=>a.code==="3-30001").reduce((s,a)=>s+Number(a.balance),0);
  const laba = Number(rows.prof);
  const modalAkhir = modalAwal + laba;
  const R=({l,v,strong,tone})=>(<div style={{ display:"grid", gridTemplateColumns:"1fr 200px",
    padding:strong?"13px 20px":"11px 20px", borderBottom:`1px solid ${C.line}`,
    background:strong?C.deep:"#fff", color:strong?"#fff":C.ink, fontWeight:strong?700:500, fontSize:strong?14:13 }}>
    <span>{l}</span><span className="mono" style={{ textAlign:"right", color:strong?"#fff":(tone||C.ink) }}>{money(v)}</span></div>);
  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Laporan Perubahan Modal" sub={`Alur ekuitas periode berjalan · ${YEAR}`} />
      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <R l="Modal Awal (3-30001)" v={modalAwal} />
        <R l="+ Laba Bersih periode" v={laba} tone={C.pos} />
        <R l="Modal Akhir" v={modalAkhir} strong />
      </div>
      <div style={{ fontSize:12, color:C.sub, marginTop:12, lineHeight:1.6 }}>
        Wakaf & dividen dapat ditambahkan sebagai pengurang setelah laba bersih (jurnal tersendiri di ekuitas).
        Modal dicatat di tingkat <b>entitas</b> — mencakup seluruh cabang, termasuk cabang yang baru dibuka,
        karena modal owner tidak dipisah per lokasi.
      </div>
    </div>
  );
}

// ============================================================
// PERTUMBUHAN SISWA — analisis pendaftaran (dari akun pendaftaran)
// ============================================================
function PertumbuhanSiswa({ orgId, accounts }) {
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);   // data tahun sebelumnya
  const [biaya, setBiaya] = useState("");    // biaya pendaftaran per siswa
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{
    setLoading(true);
    try { setRows(await getRegistrationGrowth(orgId, YEAR)); } catch(e){ /* RPC belum ada */ }
    try { setRowsPrev(await getRegistrationGrowth(orgId, YEAR-1)); } catch(e){ setRowsPrev([]); }
    setLoading(false);
  })(); /* eslint-disable-next-line */ }, [orgId]);

  const biayaNum = +biaya || 0;

  // daftar cabang: dari data pendaftaran dua tahun + dari Chart of Account,
  // supaya cabang baru tetap muncul walau belum ada pendaftaran
  const namaCabang = (() => {
    const set = new Set();
    [...(rows||[]), ...(rowsPrev||[])].forEach(r=>{ if (r.cabang) set.add(r.cabang); });
    (accounts||[]).forEach(a=>{ if (a.branch) set.add(a.branch); });
    const ada = [...set];
    const dikenal = CABANG_DIKENAL.filter(c=>ada.includes(c));
    return [...dikenal, ...ada.filter(c=>!CABANG_DIKENAL.includes(c)).sort()];
  })();

  // agregasi per bulan (gabung cabang) — dipakai untuk tahun manapun
  const agregasi = (src) => MONTHS.map((nama,i)=>{
    const bln = i+1;
    const data = (src||[]).filter(r=>Number(r.bulan)===bln);
    const pendapatan = data.reduce((s,r)=>s+Number(r.pendapatan),0);
    const transaksi = data.reduce((s,r)=>s+Number(r.jml_transaksi),0);
    // rincian per cabang, apa pun nama cabangnya
    const perCab = {};
    namaCabang.forEach(c=>{
      perCab[c] = data.filter(r=>r.cabang===c).reduce((s,r)=>s+Number(r.pendapatan),0);
    });
    const siswa = biayaNum ? Math.round(pendapatan/biayaNum) : null;
    return { nama:nama.slice(0,3), bln, pendapatan, transaksi, perCab, siswa };
  });

  const perBulan = agregasi(rows);
  const perBulanPrev = agregasi(rowsPrev);
  const aktif = perBulan.filter(m=>m.pendapatan>0 || m.transaksi>0);

  const totalPendapatan = perBulan.reduce((s,m)=>s+m.pendapatan,0);
  const totalTransaksi = perBulan.reduce((s,m)=>s+m.transaksi,0);
  const totalSiswa = biayaNum ? Math.round(totalPendapatan/biayaNum) : null;

  // total tahun sebelumnya + pertumbuhan tahunan
  const totalPendapatanPrev = perBulanPrev.reduce((s,m)=>s+m.pendapatan,0);
  const totalTransaksiPrev = perBulanPrev.reduce((s,m)=>s+m.transaksi,0);
  const totalSiswaPrev = biayaNum ? Math.round(totalPendapatanPrev/biayaNum) : null;
  const adaTahunLalu = totalPendapatanPrev>0 || totalTransaksiPrev>0;
  const yoyPendapatan = deltaPct(totalPendapatan, totalPendapatanPrev);
  const yoyTransaksi = deltaPct(totalTransaksi, totalTransaksiPrev);
  const yoySiswa = (totalSiswa!==null && totalSiswaPrev!==null)
    ? deltaPct(totalSiswa, totalSiswaPrev) : null;

  // pertumbuhan: bandingkan 2 bulan aktif terakhir
  let growth = null;
  if (aktif.length>=2) {
    const a=aktif[aktif.length-2], b=aktif[aktif.length-1];
    if (a.pendapatan>0) growth = (b.pendapatan-a.pendapatan)/a.pendapatan;
  }

  const chartData = perBulan.map(m=>({
    m:m.nama, Pendapatan:m.pendapatan,
    Siswa: biayaNum ? m.siswa : null,
  }));

  // data grafik perbandingan dua tahun
  const chartYoY = perBulan.map((m,i)=>{
    const p = perBulanPrev[i];
    return biayaNum
      ? { m:m.nama, [`${YEAR-1}`]: p.siswa||0, [`${YEAR}`]: m.siswa||0 }
      : { m:m.nama, [`${YEAR-1}`]: p.pendapatan, [`${YEAR}`]: m.pendapatan };
  });
  const bulanGabung = perBulan
    .map((m,i)=>({ ...m, prevPendapatan:perBulanPrev[i].pendapatan,
      prevTransaksi:perBulanPrev[i].transaksi, prevSiswa:perBulanPrev[i].siswa }))
    .filter(m=>m.pendapatan>0 || m.transaksi>0 || m.prevPendapatan>0 || m.prevTransaksi>0);

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Turunan Otomatis" title="Pertumbuhan Siswa Baru"
          sub={`Analisis pendaftaran dari akun Pendapatan Pendaftaran Siswa Baru · ${YEAR}`} />
        <button className="btn no-print" onClick={()=>window.print()}
          style={{ display:"flex", alignItems:"center", gap:6, background:C.deep, color:"#fff",
            padding:"9px 14px", borderRadius:9, fontSize:12.5, fontWeight:600, marginTop:4 }}>
          <Printer size={14} /> Simpan PDF
        </button>
      </div>

      {/* input biaya per siswa */}
      <div className="card no-print" style={{ padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
        <div>
          <label style={{ ...lbl, marginBottom:4 }}>Biaya pendaftaran per siswa (Rp)</label>
          <input className="mono" inputMode="numeric" placeholder="mis. 200000" value={biaya}
            onChange={e=>setBiaya(e.target.value.replace(/\D/g,""))}
            style={{ ...inp, width:200 }} />
        </div>
        <div style={{ fontSize:12, color:C.sub, flex:1, lineHeight:1.5, alignSelf:"flex-end", paddingBottom:8 }}>
          Isi biaya pendaftaran per siswa, lalu sistem memperkirakan <b>jumlah siswa baru</b> = total pendapatan pendaftaran ÷ biaya per siswa.
          {!biayaNum && " (kosong = hanya tampilkan pendapatan & transaksi)"}
        </div>
      </div>

      {loading && <div className="card" style={{ padding:20, color:C.sub, fontSize:13 }}>Memuat data…</div>}

      {!loading && aktif.length===0 && (
        <div className="card" style={{ padding:30, textAlign:"center" }}>
          <UserPlus size={38} color={C.brass} style={{ marginBottom:12 }} />
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Belum ada data pendaftaran {YEAR}</div>
          <div style={{ fontSize:13, color:C.sub }}>Catat transaksi ke akun "Pendapatan Pendaftaran Siswa Baru" (Transaksi → Terima Pendapatan) untuk melihat analisisnya.</div>
        </div>
      )}

      {!loading && aktif.length>0 && <>
        {/* KPI ringkas */}
        <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:16 }}>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Total Pendapatan Pendaftaran</div>
            <div className="mono" style={{ fontSize:18, fontWeight:700, marginTop:6, color:C.teal }}>{money(totalPendapatan)}</div>
            {adaTahunLalu && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7, paddingTop:7,
                borderTop:`1px solid ${C.line}` }}>
                <span style={{ fontSize:10.5, color:C.sub }}>vs {YEAR-1}</span>
                <YoYBadge g={yoyPendapatan} />
                <span className="mono" style={{ fontSize:10.5, color:C.sub, marginLeft:"auto" }}>
                  {moneyShort(totalPendapatanPrev)}</span>
              </div>
            )}
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Total Transaksi Pendaftaran</div>
            <div className="mono" style={{ fontSize:18, fontWeight:700, marginTop:6 }}>{totalTransaksi}</div>
            {adaTahunLalu && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7, paddingTop:7,
                borderTop:`1px solid ${C.line}` }}>
                <span style={{ fontSize:10.5, color:C.sub }}>vs {YEAR-1}</span>
                <YoYBadge g={yoyTransaksi} />
                <span className="mono" style={{ fontSize:10.5, color:C.sub, marginLeft:"auto" }}>
                  {totalTransaksiPrev}</span>
              </div>
            )}
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Estimasi Siswa Baru</div>
            <div className="mono" style={{ fontSize:18, fontWeight:700, marginTop:6, color:C.brass }}>
              {totalSiswa!==null ? `${totalSiswa} siswa` : "—"}</div>
            {adaTahunLalu && totalSiswaPrev!==null && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7, paddingTop:7,
                borderTop:`1px solid ${C.line}` }}>
                <span style={{ fontSize:10.5, color:C.sub }}>vs {YEAR-1}</span>
                <YoYBadge g={yoySiswa} />
                <span className="mono" style={{ fontSize:10.5, color:C.sub, marginLeft:"auto" }}>
                  {totalSiswaPrev} siswa</span>
              </div>
            )}
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12.5, color:C.sub }}>Pertumbuhan Bln Terakhir</span></div>
            <div className="mono" style={{ fontSize:18, fontWeight:700, marginTop:6,
              color: growth===null?C.sub : growth>=0?C.pos:C.neg }}>
              {growth===null ? "—" : (growth>=0?"+":"")+pct(growth)}</div>
            <div style={{ fontSize:10.5, color:C.sub, marginTop:7, paddingTop:7,
              borderTop:`1px solid ${C.line}` }}>Bulan aktif terakhir vs sebelumnya</div>
          </div>
        </div>

        {/* Perbandingan tahun */}
        {adaTahunLalu ? (
          <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <ArrowLeftRight size={18} color={C.brass} />
              <span style={{ fontWeight:700, fontSize:15 }}>Perbandingan Tahun — {YEAR} vs {YEAR-1}</span>
            </div>
            <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
              {biayaNum ? "Estimasi siswa baru" : "Pendapatan pendaftaran"} per bulan di kedua tahun
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartYoY} margin={{ left:-18, right:6, top:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={biayaNum?undefined:moneyShort}
                  axisLine={false} tickLine={false} width={biayaNum?36:54} />
                <Tooltip formatter={(v)=> biayaNum ? `${v} siswa` : money(v)}
                  contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
                <Legend wrapperStyle={{ fontSize:11.5 }} />
                <Bar dataKey={`${YEAR-1}`} fill={C.line} radius={[4,4,0,0]} />
                <Bar dataKey={`${YEAR}`} fill={C.teal} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Tabel per bulan dua tahun */}
            <div style={{ marginTop:16, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 90px 100px 100px 80px",
                padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
                <span>BULAN</span>
                <span style={{ textAlign:"right" }}>PENDAFTARAN {YEAR-1}</span>
                <span style={{ textAlign:"right" }}>PENDAFTARAN {YEAR}</span>
                <span style={{ textAlign:"center" }}>±</span>
                <span style={{ textAlign:"center" }}>EST. SISWA {YEAR-1}</span>
                <span style={{ textAlign:"center" }}>EST. SISWA {YEAR}</span>
                <span style={{ textAlign:"center" }}>±</span>
              </div>
              {bulanGabung.map(m=>{
                const g = deltaPct(m.pendapatan, m.prevPendapatan);
                const gSiswa = (m.siswa!==null && m.prevSiswa!==null)
                  ? deltaPct(m.siswa, m.prevSiswa) : null;
                return (
                  <div key={m.bln} style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 90px 100px 100px 80px",
                    padding:"8px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                    <span style={{ fontWeight:600, color:C.deep }}>{m.nama}</span>
                    <span className="mono" style={{ textAlign:"right", color:C.sub }}>
                      {m.prevPendapatan?money(m.prevPendapatan):"–"}</span>
                    <span className="mono" style={{ textAlign:"right", fontWeight:600, color:C.teal }}>
                      {m.pendapatan?money(m.pendapatan):"–"}</span>
                    <span style={{ textAlign:"center" }}><YoYBadge g={g} /></span>
                    <span className="mono" style={{ textAlign:"center", color:C.sub }}>
                      {biayaNum ? (m.prevSiswa||"–") : "—"}</span>
                    <span className="mono" style={{ textAlign:"center", fontWeight:700, color:C.brass }}>
                      {biayaNum ? (m.siswa||"–") : "—"}</span>
                    <span style={{ textAlign:"center" }}>
                      {biayaNum ? <YoYBadge g={gSiswa} /> : <span style={{ fontSize:11, color:C.sub }}>—</span>}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:11, color:C.sub, marginTop:10, lineHeight:1.5 }}>
              {biayaNum
                ? <>Estimasi siswa dihitung dari pendapatan pendaftaran ÷ biaya per siswa yang Anda isi
                    ({money(biayaNum)}). Kalau tarif pendaftaran {YEAR-1} berbeda dari {YEAR}, angka
                    perbandingan siswanya akan meleset — sesuaikan tarif dulu bila perlu.</>
                : <>Kolom estimasi siswa masih kosong. Isi <b>biaya pendaftaran per siswa</b> di atas untuk
                    membandingkan jumlah siswa, bukan hanya rupiah.</>}
              {" "}Persentase tidak muncul bila bulan pembanding di {YEAR-1} masih nol.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding:"16px 20px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <ArrowLeftRight size={18} color={C.brass} />
              <span style={{ fontWeight:700, fontSize:14.5 }}>Perbandingan Tahun</span>
            </div>
            <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.6 }}>
              Belum ada data pendaftaran tahun {YEAR-1}. Setelah transaksi pendaftaran tahun sebelumnya
              dimasukkan, bagian ini otomatis menampilkan perbandingan pertumbuhan siswa antar tahun.
            </div>
          </div>
        )}

        {/* Grafik */}
        <div className="card" style={{ padding:"18px 18px 8px", marginBottom:16 }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:2 }}>
            {biayaNum ? "Tren Siswa Baru per Bulan" : "Tren Pendapatan Pendaftaran per Bulan"}</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:8 }}>Sepanjang {YEAR}</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} margin={{ left:-18, right:6, top:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={biayaNum?undefined:moneyShort} axisLine={false} tickLine={false} width={biayaNum?36:54} />
              <Tooltip formatter={(v)=> biayaNum ? `${v} siswa` : money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
              <Bar dataKey={biayaNum?"Siswa":"Pendapatan"} radius={[5,5,0,0]} fill={C.teal}>
                {chartData.map((d,i)=><Cell key={i} fill={C.teal} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabel per bulan */}
        {(() => {
          const kolom = `58px ${namaCabang.map(()=>"1fr").join(" ")} 110px 110px${biayaNum?" 100px":""}`;
          return (
            <div className="card scroll-x" style={{ overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:kolom,
                padding:"10px 18px", background:C.deep, color:"#DDECEC", fontSize:11, fontWeight:600 }}>
                <span>BULAN</span>
                {namaCabang.map(c=>(
                  <span key={c} style={{ textAlign:"right" }}>{c.toUpperCase()}</span>
                ))}
                <span style={{ textAlign:"right" }}>TOTAL</span>
                <span style={{ textAlign:"center" }}>TRANSAKSI</span>
                {biayaNum ? <span style={{ textAlign:"center" }}>EST. SISWA</span> : null}
              </div>
              {aktif.map(m=>(
                <div key={m.bln} style={{ display:"grid", gridTemplateColumns:kolom,
                  padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center" }}>
                  <span style={{ fontWeight:600, color:C.deep }}>{m.nama}</span>
                  {namaCabang.map(c=>(
                    <span key={c} className="mono" style={{ textAlign:"right", color:C.sub }}>
                      {m.perCab[c] ? money(m.perCab[c]) : "–"}</span>
                  ))}
                  <span className="mono" style={{ textAlign:"right", fontWeight:700, color:C.teal }}>{money(m.pendapatan)}</span>
                  <span className="mono" style={{ textAlign:"center" }}>{m.transaksi}</span>
                  {biayaNum ? <span className="mono" style={{ textAlign:"center", fontWeight:700, color:C.brass }}>{m.siswa}</span> : null}
                </div>
              ))}
            </div>
          );
        })()}
        <div style={{ fontSize:11.5, color:C.sub, marginTop:12, lineHeight:1.6 }}>
          <b>Catatan:</b> analisis ini berbasis transaksi ke akun <b>Pendapatan Pendaftaran Siswa Baru</b> di seluruh
          cabang{namaCabang.length ? ` (${namaCabang.join(", ")})` : ""}. "Estimasi Siswa" dihitung dari total pendapatan pendaftaran ÷ biaya per siswa yang Anda isi,
          jadi akurat kalau biaya pendaftaran seragam. Untuk data siswa per individu (nama, tanggal daftar), gunakan aplikasi
          manajemen siswa Anda yang terpisah.
        </div>
      </>}
    </div>
  );
}

// ============================================================
// ANALISIS KEUANGAN — rasio, tren, per cabang, insight otomatis
// ============================================================
function Analisis({ pnl, balances, trend, period, pnlPrev, trendPrev, accounts }) {
  const S = (type,branch) => pnl.filter(r=>r.type===type&&(!branch||r.branch===branch))
    .reduce((s,r)=>s+Number(r.amount),0);
  const rev=S("Pendapatan");
  const cabang = perCabang(pnl, accounts);
  const opCabang = cabang.reduce((s,b)=>s+b.op,0);   // total gaji pelatih/operasional semua cabang
  const totalKontrib = cabang.reduce((s,b)=>s+b.kontrib,0);
  const cogs=S("COGS"), opBank=S("Beban Op");
  const kasBeban=S("Beban Kas"), oi=S("Other Income"), oe=S("Other Expense");
  const totalBeban=cogs+opBank+kasBeban+oe;
  const laba=rev-totalBeban+oi;
  const labaKotor=rev-cogs;

  // rasio
  const npm = rev ? laba/rev : 0;                        // net profit margin
  const gpm = rev ? labaKotor/rev : 0;                   // gross profit margin
  const coachRatio = rev ? opCabang/rev : 0;            // biaya pelatih semua cabang thd pendapatan
  const bebanRatio = rev ? totalBeban/rev : 0;           // efisiensi beban
  const modal = balances.filter(b=>b.type==="Ekuitas").reduce((s,b)=>s+Number(b.balance),0);
  const roi = modal ? laba/modal : 0;

  // efisiensi per cabang (laba per rupiah pendapatan) — hanya cabang yang sudah ada pendapatan
  const cabangAktif = cabang.filter(b=>b.rev>0)
    .map(b=>({ ...b, eff: b.kontrib/Math.max(b.rev,1) }))
    .sort((a,b)=>b.eff-a.eff);
  const cabangBelumAda = cabang.filter(b=>b.rev===0);

  // insight otomatis
  const insights = [];
  if (rev===0) insights.push({ t:"info", m:"Belum ada pendapatan pada periode ini. Input transaksi untuk melihat analisis." });
  else {
    if (npm < 0) insights.push({ t:"bad", m:`Bisnis rugi ${money(Math.abs(laba))} periode ini. Beban (${money(totalBeban)}) melebihi pendapatan. Tinjau pos beban terbesar.` });
    else if (npm < 0.15) insights.push({ t:"warn", m:`Margin laba bersih ${pct(npm)} di bawah target sehat (15%). Pertimbangkan efisiensi beban atau naikkan pendapatan.` });
    else insights.push({ t:"good", m:`Margin laba bersih ${pct(npm)} sehat (target ≥15%). Profitabilitas baik.` });

    if (coachRatio > 0.5) insights.push({ t:"warn", m:`Biaya pelatih ${pct(coachRatio)} dari pendapatan — cukup tinggi (>50%). Cek rasio pelatih terhadap jumlah siswa.` });
    else if (coachRatio > 0) insights.push({ t:"good", m:`Biaya pelatih ${pct(coachRatio)} dari pendapatan, masih dalam batas wajar.` });

    if (cabangAktif.length >= 2) {
      const juara = cabangAktif[0], buncit = cabangAktif[cabangAktif.length-1];
      insights.push({ t:"info", m:`Cabang ${juara.nama} memberi kontribusi laba paling efisien per rupiah pendapatan (${pct(juara.eff)}), terendah ${buncit.nama} (${pct(buncit.eff)}). Fokuskan pertumbuhan di cabang yang efisiensinya tinggi.` });
    }
    if (cabangBelumAda.length > 0 && cabangAktif.length > 0)
      insights.push({ t:"info", m:`Cabang ${cabangBelumAda.map(b=>b.nama).join(", ")} belum ada pendapatan periode ini. Bandingkan setelah semuanya aktif.` });

    // tren: bandingkan bulan yang dipilih vs bulan sebelumnya (urut numerik, aman)
    const byMonth = [...(trend||[])]
      .map(t=>({ ...t, bln:Number(t.bulan) }))
      .sort((a,b)=>a.bln-b.bln);
    // "bulan ini" = bulan yang dipilih di tab; kalau "Semua", pakai bulan aktif terakhir
    const bulanIni = period==="all"
      ? byMonth.filter(t=>Number(t.pendapatan)>0 || Number(t.beban)>0).slice(-1)[0]?.bln
      : period+1;
    if (bulanIni) {
      const cur = byMonth.find(t=>t.bln===bulanIni);
      // bulan pembanding: bulan aktif terakhir SEBELUM bulanIni
      const prev = byMonth.filter(t=>t.bln<bulanIni &&
        (Number(t.pendapatan)>0 || Number(t.beban)>0)).slice(-1)[0];
      if (cur && prev) {
        const delta = Number(cur.laba) - Number(prev.laba);
        const namaCur = MONTHS[bulanIni-1], namaPrev = MONTHS[prev.bln-1];
        if (delta < 0) insights.push({ t:"warn", m:`Laba ${namaCur} turun ${money(Math.abs(delta))} dibanding ${namaPrev}. Cek kenaikan beban atau penurunan pendapatan.` });
        else insights.push({ t:"good", m:`Laba ${namaCur} naik ${money(delta)} dibanding ${namaPrev}. Tren positif.` });
      }
    }

    // perbandingan tahun-ke-tahun (YoY)
    const thnLalu = ringkasPnl(pnlPrev);
    if (thnLalu.rev > 0) {
      const gRevY = deltaPct(rev, thnLalu.rev);
      const gLabaY = deltaPct(laba, thnLalu.laba);
      if (gRevY !== null) {
        if (gRevY >= 0) insights.push({ t:"good", m:`Pendapatan ${YEAR} tumbuh ${pct(gRevY)} dibanding ${YEAR-1} (${money(thnLalu.rev)} → ${money(rev)}).` });
        else insights.push({ t:"warn", m:`Pendapatan ${YEAR} turun ${pct(Math.abs(gRevY))} dibanding ${YEAR-1} (${money(thnLalu.rev)} → ${money(rev)}). Tinjau penyebabnya per cabang.` });
      }
      if (gLabaY !== null && thnLalu.laba > 0) {
        if (gLabaY >= 0) insights.push({ t:"good", m:`Laba bersih ${YEAR} naik ${pct(gLabaY)} dibanding ${YEAR-1}. Efisiensi terjaga seiring pertumbuhan.` });
        else insights.push({ t:"warn", m:`Laba bersih ${YEAR} turun ${pct(Math.abs(gLabaY))} dibanding ${YEAR-1} meski periode berjalan. Bandingkan pos beban terbesar antar tahun.` });
      }
      if (thnLalu.npm > 0 && npm < thnLalu.npm - 0.03)
        insights.push({ t:"warn", m:`Margin laba turun dari ${pct(thnLalu.npm)} (${YEAR-1}) ke ${pct(npm)} (${YEAR}). Pendapatan boleh naik, tapi beban naik lebih cepat.` });
    }
  }

  const trendData = (trend||[]).map(t=>({
    m: MONTHS[Number(t.bulan)-1]?.slice(0,3) || t.bulan,
    rev: Number(t.pendapatan), exp: Number(t.beban), profit: Number(t.laba),
  }));

  const ratios = [
    { name:"Margin Laba Bersih", val:npm, fmt:"pct", target:"≥15%", ok:npm>=0.15, hint:"Laba bersih ÷ pendapatan" },
    { name:"Margin Laba Kotor", val:gpm, fmt:"pct", target:"≥40%", ok:gpm>=0.4, hint:"(Pendapatan − COGS) ÷ pendapatan" },
    { name:"Rasio Biaya Pelatih", val:coachRatio, fmt:"pct", target:"≤50%", ok:coachRatio<=0.5&&coachRatio>0, hint:"Gaji pelatih ÷ pendapatan" },
    { name:"Rasio Beban", val:bebanRatio, fmt:"pct", target:"≤85%", ok:bebanRatio<=0.85&&bebanRatio>0, hint:"Total beban ÷ pendapatan" },
    { name:"ROI (Return on Investment)", val:roi, fmt:"pct", target:"≥20%", ok:roi>=0.2, hint:"Laba ÷ modal" },
  ];

  // ===== REKOMENDASI TINDAKAN (rule-based, diprioritaskan) =====
  // prioritas: 1=mendesak (merah), 2=perhatian (kuning), 3=peluang/positif (hijau)
  const bankBal = balances.filter(b=>b.code==="1-10002").reduce((s,b)=>s+Number(b.balance),0);
  const kasBal = balances.filter(b=>b.code==="1-10007").reduce((s,b)=>s+Number(b.balance),0);
  const hutang = balances.filter(b=>b.type==="Kewajiban").reduce((s,b)=>s+Number(b.balance),0);

  const byMonthRev = [...(trend||[])].map(t=>({ ...t, bln:Number(t.bulan) })).sort((a,b)=>a.bln-b.bln);
  const bulanIniRev = period==="all"
    ? byMonthRev.filter(t=>Number(t.pendapatan)>0).slice(-1)[0]?.bln
    : period+1;
  let revGrowth = null;
  let namaBulanRev = "", namaBulanRevPrev = "";
  if (bulanIniRev) {
    const cur = byMonthRev.find(t=>t.bln===bulanIniRev);
    const prev = byMonthRev.filter(t=>t.bln<bulanIniRev && Number(t.pendapatan)>0).slice(-1)[0];
    if (cur && prev && Number(prev.pendapatan)>0) {
      revGrowth = (Number(cur.pendapatan)-Number(prev.pendapatan))/Number(prev.pendapatan);
      namaBulanRev = MONTHS[bulanIniRev-1];
      namaBulanRevPrev = MONTHS[prev.bln-1];
    }
  }

  const recs = [];
  const add = (prio, kategori, judul, aksi) => recs.push({ prio, kategori, judul, aksi });

  if (rev > 0) {
    // --- KEUANGAN: kas ---
    if (kasBal < 0)
      add(1, "Keuangan", "Saldo kas negatif — perlu segera dibereskan",
        "Kas tercatat minus, artinya ada pengeluaran kas melebihi pemasukannya. Periksa: (1) apakah ada pengeluaran yang seharusnya dari Bank tapi tercatat dari Kas, (2) apakah ada pengisian kas dari Bank yang belum dicatat. Rapikan agar arus kas akurat.");
    else if (kasBal >= 0 && kasBal < (totalBeban*0.05))
      add(2, "Keuangan", "Saldo kas tipis",
        "Petty cash mendekati habis. Pertimbangkan mengisi ulang kas dari Bank agar operasional harian (ATK, air minum, dll) tidak tersendat.");

    // --- KEUANGAN: efisiensi biaya ---
    if (bebanRatio > 0.85)
      add(1, "Keuangan", "Beban terlalu besar terhadap pendapatan",
        `Total beban ${pct(bebanRatio)} dari pendapatan (sehat ≤85%). Tinjau pos beban terbesar. Untuk usaha les, biasanya gaji pelatih pos terbesar — evaluasi rasio pelatih terhadap jumlah siswa agar tiap pelatih mengajar mendekati kapasitas optimal.`);
    if (coachRatio > 0.5)
      add(2, "Keuangan", "Biaya pelatih tinggi",
        `Gaji pelatih ${pct(coachRatio)} dari pendapatan. Pertimbangkan: gabungkan kelas kecil, atur ulang jadwal agar satu sesi pelatih diisi lebih banyak siswa, atau tinjau tarif per jam vs pendapatan per kelas.`);

    // --- KEUANGAN: alokasi laba (kalau sehat) ---
    if (npm >= 0.15 && laba > 0)
      add(3, "Keuangan", "Profitabilitas sehat — alokasikan laba dengan bijak",
        `Margin ${pct(npm)} tergolong sehat. Pertimbangkan mengalokasikan laba ke: (1) dana darurat 3–6 bulan biaya operasional, (2) investasi peralatan untuk menambah kapasitas siswa, (3) cadangan ekspansi. Hindari menahan semua laba menganggur di rekening.`);

    // --- KEUANGAN: hutang ---
    if (hutang > 0 && laba > 0 && hutang > laba*2)
      add(2, "Keuangan", "Hutang cukup besar",
        `Total kewajiban ${money(hutang)} relatif besar dibanding laba periode. Prioritaskan pelunasan hutang berbunga (mis. pinjaman bank) untuk mengurangi beban bunga ke depan.`);

    // --- PERTUMBUHAN: cabang ---
    if (cabangAktif.length >= 2) {
      const menang = cabangAktif[0], kalah = cabangAktif[cabangAktif.length-1];
      add(3, "Pertumbuhan", `Cabang ${menang.nama} lebih efisien — jadikan model`,
        `Cabang ${menang.nama} menghasilkan ${pct(menang.eff)} laba per rupiah pendapatan, sementara ${kalah.nama} ${pct(kalah.eff)}. Pelajari apa yang membuat ${menang.nama} unggul (lokasi, pelatih, jadwal, marketing) dan terapkan pola itu di cabang lain. Fokuskan anggaran marketing ke cabang dengan potensi tertinggi.`);

      // cabang yang kontribusinya negatif = merugi
      const merugi = cabangAktif.filter(b=>b.kontrib < 0);
      if (merugi.length > 0)
        add(1, "Keuangan", `Cabang ${merugi.map(b=>b.nama).join(", ")} merugi`,
          `Biaya operasional cabang ini melebihi pendapatannya (${merugi.map(b=>`${b.nama}: ${money(b.kontrib)}`).join("; ")}). Untuk cabang baru hal ini wajar di masa rintisan, tapi tetapkan target kapan harus impas. Periksa jumlah siswa aktif, tarif, dan beban tetap seperti sewa kolam.`);
    }
    if (cabangBelumAda.length > 0 && cabangAktif.length > 0)
      add(2, "Pertumbuhan", `Cabang ${cabangBelumAda.map(b=>b.nama).join(", ")} belum menghasilkan`,
        `Belum ada pendapatan tercatat periode ini untuk cabang tersebut. Evaluasi: apakah butuh dorongan marketing, perbaikan jadwal, atau ada kendala operasional. Kalau cabang baru saja dibuka, pastikan transaksinya sudah dicatat ke akun pendapatan cabang yang benar.`);

    // --- PERTUMBUHAN: tren pendapatan ---
    if (revGrowth !== null && revGrowth < 0)
      add(1, "Pertumbuhan", "Pendapatan menurun — perlu dorongan akuisisi siswa",
        `Pendapatan ${namaBulanRev} turun ${pct(Math.abs(revGrowth))} dibanding ${namaBulanRevPrev}. Pertimbangkan: promo pendaftaran, program referral (siswa ajak teman), konten media sosial rutin, atau kelas trial gratis untuk menarik siswa baru.`);
    else if (revGrowth !== null && revGrowth > 0.1)
      add(3, "Pertumbuhan", "Pendapatan tumbuh baik — jaga momentum",
        `Pendapatan ${namaBulanRev} naik ${pct(revGrowth)} dibanding ${namaBulanRevPrev}. Momentum bagus — pertahankan yang sedang berhasil, dan pastikan kapasitas (pelatih, jadwal, kolam) siap menampung pertumbuhan siswa agar kualitas tetap terjaga.`);

    // --- PERTUMBUHAN / KEUANGAN: berbasis perbandingan tahun ---
    const thnLalu2 = ringkasPnl(pnlPrev);
    if (thnLalu2.rev > 0) {
      const gRevY = deltaPct(rev, thnLalu2.rev);
      const gBebanY = deltaPct(totalBeban, thnLalu2.totalBeban);
      if (gRevY !== null && gBebanY !== null && gBebanY > gRevY + 0.05)
        add(2, "Keuangan", "Beban tumbuh lebih cepat daripada pendapatan",
          `Dibanding ${YEAR-1}, pendapatan ${gRevY>=0?"naik":"turun"} ${pct(Math.abs(gRevY))} sementara beban ${gBebanY>=0?"naik":"turun"} ${pct(Math.abs(gBebanY))}. Bandingkan pos beban terbesar antar tahun (gaji pelatih, sewa kolam, marketing) dan cari mana yang melonjak tanpa menambah pendapatan.`);
      if (gRevY !== null && gRevY < -0.1)
        add(1, "Pertumbuhan", `Pendapatan menyusut dibanding ${YEAR-1}`,
          `Omzet turun ${pct(Math.abs(gRevY))} dari tahun sebelumnya. Ini penurunan tahunan, bukan fluktuasi bulanan — periksa apakah jumlah siswa aktif berkurang, ada kompetitor baru, atau kelas yang dihentikan. Prioritaskan retensi siswa lama sebelum menambah anggaran akuisisi.`);
      if (gRevY !== null && gRevY > 0.2)
        add(3, "Pertumbuhan", `Pertumbuhan tahunan kuat (+${pct(gRevY)})`,
          `Pendapatan ${YEAR} jauh di atas ${YEAR-1}. Pastikan kapasitas menyusul: rasio pelatih terhadap siswa, ketersediaan slot kolam, dan sistem administrasi. Pertumbuhan cepat tanpa kapasitas memadai biasanya menurunkan kualitas dan retensi.`);
    }

    // --- PERTUMBUHAN: marketing umum (kalau margin sehat) ---
    if (npm >= 0.15)
      add(3, "Pertumbuhan", "Ada ruang untuk investasi marketing",
        "Dengan margin sehat, mengalokasikan sebagian laba untuk marketing (iklan lokal, media sosial, kerjasama sekolah/komunitas) berpotensi menambah siswa baru tanpa mengganggu arus kas.");
  }

  // urutkan berdasarkan prioritas (mendesak dulu)
  recs.sort((a,b)=>a.prio-b.prio);
  const prioInfo = {
    1: { label:"MENDESAK", color:C.neg },
    2: { label:"PERHATIAN", color:C.brass },
    3: { label:"PELUANG", color:C.pos },
  };

  const labelPeriode = period==="all" ? `Tahun ${YEAR}` : `${MONTHS[period]} ${YEAR}`;

  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Analisis Keuangan"
        sub={`${labelPeriode} · Rasio, tren, perbandingan cabang, & rekomendasi otomatis`} />

      {/* Insight otomatis */}
      <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <Lightbulb size={18} color={C.brass} />
          <span style={{ fontWeight:700, fontSize:15 }}>Kesimpulan & Rekomendasi</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {insights.map((ins,i)=>{
            const c = ins.t==="good"?C.pos:ins.t==="bad"?C.neg:ins.t==="warn"?C.brass:C.teal;
            return (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
                padding:"10px 14px", borderRadius:9, background:c+"0D", borderLeft:`3px solid ${c}` }}>
                <span style={{ fontSize:13, color:C.ink, lineHeight:1.5 }}>{ins.m}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rekomendasi Tindakan */}
      {recs.length>0 && (
        <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <TargetIcon size={18} color={C.teal} />
            <span style={{ fontWeight:700, fontSize:15 }}>Rekomendasi Tindakan untuk Owner</span>
          </div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
            Saran konkret berdasarkan kondisi keuangan Anda — diurutkan dari yang paling mendesak.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {recs.map((r,i)=>{
              const info = prioInfo[r.prio];
              return (
                <div key={i} style={{ borderRadius:10, border:`1px solid ${C.line}`, borderLeft:`4px solid ${info.color}`, padding:"12px 15px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                    <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:".05em", padding:"2px 8px",
                      borderRadius:20, background:info.color+"18", color:info.color }}>{info.label}</span>
                    <span style={{ fontSize:10.5, fontWeight:600, color:C.sub, textTransform:"uppercase", letterSpacing:".04em" }}>{r.kategori}</span>
                    <span style={{ fontSize:13.5, fontWeight:700, color:C.deep }}>{r.judul}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:C.ink, lineHeight:1.6 }}>{r.aksi}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:C.sub, marginTop:14, lineHeight:1.5, fontStyle:"italic" }}>
            Rekomendasi ini dibuat otomatis dari pola angka keuangan Anda sebagai bahan pertimbangan, bukan nasihat finansial profesional.
            Untuk keputusan besar (ekspansi, pinjaman, investasi), pertimbangkan juga masukan akuntan atau penasihat bisnis.
          </div>
        </div>
      )}

      {/* Perbandingan tahun (lengkap: KPI + grafik + tabel per bulan) */}
      <PerbandinganTahun pnl={pnl} pnlPrev={pnlPrev} trend={trend} trendPrev={trendPrev}
        period={period} />

      {/* Rasio */}
      <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14.5, marginBottom:14 }}>Rasio Keuangan</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:16 }}>
          {ratios.map(r=>(
            <div key={r.name} style={{ borderLeft:`3px solid ${r.ok?C.pos:C.neg}`, paddingLeft:12 }}>
              <div style={{ fontSize:12.5, color:C.sub, marginBottom:4 }}>{r.name}</div>
              <div className="mono" style={{ fontSize:22, fontWeight:700, color:r.ok?C.pos:C.neg }}>{pct(r.val)}</div>
              <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>Target {r.target}</div>
              <div style={{ fontSize:10.5, color:C.sub, marginTop:3, fontStyle:"italic" }}>{r.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tren bulanan */}
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16, marginBottom:16 }}>
        <div className="card" style={{ padding:"18px 18px 8px" }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:2 }}>Tren Pendapatan vs Beban</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:8 }}>Sepanjang {YEAR}</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ left:-18, right:6, top:10 }}>
              <defs>
                <linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.35}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
                <linearGradient id="ae" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.brass} stopOpacity={.28}/><stop offset="100%" stopColor={C.brass} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
              <Area type="monotone" dataKey="rev" stroke={C.teal} strokeWidth={2.4} fill="url(#ar)" name="Pendapatan" />
              <Area type="monotone" dataKey="exp" stroke={C.brass} strokeWidth={2.4} fill="url(#ae)" name="Beban" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:"18px 18px 8px" }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:2 }}>Laba per Bulan</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:8 }}>Net profit {YEAR}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ left:-18, right:6, top:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
              <Bar dataKey="profit" radius={[5,5,0,0]}>{trendData.map((d,i)=><Cell key={i} fill={d.profit>=0?C.pos:C.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Perbandingan cabang */}
      <div className="card" style={{ padding:"18px 20px" }}>
        <div style={{ fontWeight:600, fontSize:14.5, marginBottom:4 }}>Perbandingan Cabang — mana lebih untung?</div>
        <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
          {cabang.length} cabang terdaftar · kontribusi laba = pendapatan − biaya operasional cabang
        </div>
        {cabang.length===0 && <div style={{ fontSize:13, color:C.sub }}>
          Belum ada akun pendapatan atau beban yang diberi cabang pada periode ini.</div>}
        <div className="grid-auto" style={{ display:"grid",
          gridTemplateColumns:`repeat(${Math.min(cabang.length||1,3)},1fr)`, gap:16 }}>
          {cabang.map(b=>{
            const eff = b.rev ? b.kontrib/b.rev : 0;
            return (
              <div key={b.nama} style={{ border:`1px solid ${C.line}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <div style={{ width:9, height:9, borderRadius:99, background:b.warna }} />
                  <span style={{ fontWeight:700, fontSize:14.5 }}>Cabang {b.nama}</span>
                </div>
                <RowLine l="Pendapatan" v={b.rev} c={C.pos} />
                <RowLine l="Biaya operasional" v={b.op} c={C.neg} />
                <div style={{ borderTop:`1px solid ${C.line}`, marginTop:6, paddingTop:8 }}>
                  <RowLine l="Kontribusi laba" v={b.kontrib} bold />
                </div>
                <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, background:b.warna+"10", fontSize:12 }}>
                  {b.rev > 0 ? <>
                    Efisiensi: <b>{pct(eff)}</b> laba per rupiah pendapatan
                    {totalKontrib>0 && <> · porsi <b>{pct(b.kontrib/totalKontrib)}</b> dari total</>}
                  </> : <span style={{ color:C.sub }}>Belum ada pendapatan periode ini</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
const RowLine = ({ l, v, c, bold }) => (
  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"5px 0" }}>
    <span style={{ color:bold?C.ink:C.sub, fontWeight:bold?600:400 }}>{l}</span>
    <span className="mono" style={{ fontWeight:bold?700:600, color:c||C.ink }}>{money(v)}</span>
  </div>
);

// ============================================================
// CASH FLOW
// ============================================================
function CashFlow({ flow, detail, accounts }) {
  const cabangEntitas = daftarCabang(accounts);
  const bankSum = flow.filter(f=>f.code==="1-10002"||f.code==="1-10001");
  const kasSum = flow.filter(f=>f.code==="1-10007");
  const bankDetail = detail.filter(d=>d.code==="1-10002"||d.code==="1-10001");
  const kasDetail = detail.filter(d=>d.code==="1-10007");

  const Block=({title,sumRows,rows,tone})=>{
    const [open, setOpen] = useState(false);   // default minimize
    const totIn = sumRows.reduce((s,f)=>s+Number(f.masuk),0);
    const totOut = sumRows.reduce((s,f)=>s+Number(f.keluar),0);
    return (
      <div className="card" style={{ overflow:"hidden", marginBottom:16 }}>
        <button className="btn" onClick={()=>setOpen(!open)}
          style={{ width:"100%", padding:"13px 20px", background:tone+"15", fontWeight:700, color:C.deep, fontSize:13,
            display:"flex", justifyContent:"space-between", alignItems:"center", textAlign:"left" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {title}
            <span style={{ fontSize:11, fontWeight:500, color:C.sub }}>· {rows.length} transaksi</span>
          </span>
          <span style={{ display:"flex", gap:18, alignItems:"center" }}>
            <span className="mono" style={{ fontSize:12, color:C.pos }}>↑ {money(totIn)}</span>
            <span className="mono" style={{ fontSize:12, color:C.neg }}>↓ {money(totOut)}</span>
            <span className="mono" style={{ fontWeight:700 }}>Net {money(totIn-totOut)}</span>
          </span>
        </button>
        {open && <>
          <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 130px 130px", padding:"9px 20px",
            fontSize:11.5, color:C.sub, fontWeight:600, borderBottom:`1px solid ${C.line}` }}>
            <span>TANGGAL</span><span>KETERANGAN</span>
            <span style={{ textAlign:"right" }}>MASUK</span><span style={{ textAlign:"right" }}>KELUAR</span></div>
          {rows.length ? rows.map((d,i)=>(
            <div key={d.entry_id+i} style={{ display:"grid", gridTemplateColumns:"90px 1fr 130px 130px",
              padding:"9px 20px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center" }}>
              <span style={{ color:C.sub }}>{d.entry_date}</span>
              <span>{d.memo}
                {d.cash_source && <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 6px", marginLeft:6,
                  borderRadius:20, background:d.cash_source==="kas"?C.kas+"18":C.teal+"15",
                  color:d.cash_source==="kas"?C.kas:C.teal }}>{d.cash_source==="kas"?"KAS":"BANK"}</span>}</span>
              <span className="mono" style={{ textAlign:"right", color:Number(d.masuk)?C.pos:C.line }}>
                {Number(d.masuk)?money(d.masuk):"–"}</span>
              <span className="mono" style={{ textAlign:"right", color:Number(d.keluar)?C.neg:C.line }}>
                {Number(d.keluar)?money(d.keluar):"–"}</span>
            </div>
          )) : <div style={{ padding:"14px 20px", fontSize:12.5, color:C.sub, fontStyle:"italic" }}>Tidak ada mutasi periode ini.</div>}
          {rows.length>0 && (
            <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 130px 130px", padding:"11px 20px",
              background:C.surf, fontWeight:700, fontSize:12.5 }}>
              <span></span><span>TOTAL</span>
              <span className="mono" style={{ textAlign:"right", color:C.pos }}>{money(totIn)}</span>
              <span className="mono" style={{ textAlign:"right", color:C.neg }}>{money(totOut)}</span>
            </div>
          )}
        </>}
      </div>
    );
  };
  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Laporan Arus Kas"
        sub={`Klik judul untuk buka/tutup rincian tiap mutasi Bank & Kas · ${YEAR}`} />
      <div style={{ padding:"11px 15px", borderRadius:10, marginBottom:16, fontSize:12.5, lineHeight:1.55,
        background:C.teal+"0D", border:`1px solid ${C.teal}25`, color:C.deep }}>
        Arus kas dilaporkan di tingkat <b>entitas</b>, bukan per cabang — seluruh cabang
        {cabangEntitas.length>0 && <> ({cabangEntitas.join(", ")})</>} memakai rekening Bank dan
        Kas yang sama, jadi mutasinya menyatu di sini. Untuk melihat kontribusi tiap cabang, buka
        <b> Laba Rugi</b>, <b>Analisis Keuangan</b>, atau <b>Laporan Owner</b>.
      </div>
      <Block title="BANK" sumRows={bankSum} rows={bankDetail} tone={C.teal} />
      <Block title="KAS (PETTY CASH)" sumRows={kasSum} rows={kasDetail} tone={C.kas} />
    </div>
  );
}

// ============================================================
// TARGET — set tahunan, auto-bagi bulanan/mingguan, analisis pencapaian
// ============================================================
function TargetView({ orgId, accounts }) {
  const [target, setTarget] = useState(null);
  const [ach, setAch] = useState({ pendapatan:0, laba:0, transaksi:0 });
  const [form, setForm] = useState({ pendapatan:"", laba:"", transaksi:"" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [edit, setEdit] = useState(false);
  const [monthly, setMonthly] = useState([]);
  const [pnlTahun, setPnlTahun] = useState([]);   // untuk rincian per cabang

  const reload = async () => {
    const t = await getTarget(orgId, YEAR);
    setTarget(t);
    setForm({
      pendapatan: t? String(Math.round(t.target_pendapatan)) : "",
      laba: t? String(Math.round(t.target_laba)) : "",
      transaksi: t? String(t.target_transaksi) : "",
    });
    setAch(await getAchievement(orgId, YEAR));
    try { setMonthly(await getMonthlyAchievement(orgId, YEAR)); } catch(e){ /* RPC belum ada */ }
    try {
      const [s,e] = periodRange(YEAR, "all");
      setPnlTahun(await rpcPnl(orgId, s, e));
    } catch(e){ setPnlTahun([]); }
  };
  useEffect(()=>{ if(orgId) reload(); /* eslint-disable-next-line */ }, [orgId]);

  const simpan = async () => {
    setBusy(true); setFlash("");
    try {
      await saveTarget(orgId, YEAR, {
        pendapatan:+form.pendapatan||0, laba:+form.laba||0, transaksi:+form.transaksi||0,
      });
      setFlash("✓ Target tersimpan"); setEdit(false); await reload();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  if (target===null && !edit) {
    return (
      <div className="pop">
        <PageHead eyebrow="Perencanaan" title="Target" sub={`Belum ada target ${YEAR}`} />
        <div className="card" style={{ padding:30, textAlign:"center" }}>
          <TargetIcon size={40} color={C.brass} style={{ marginBottom:12 }} />
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Belum ada target tahun {YEAR}</div>
          <div style={{ fontSize:13, color:C.sub, marginBottom:18 }}>Set target tahunan, sistem otomatis membaginya ke bulanan & mingguan.</div>
          <button className="btn" onClick={()=>setEdit(true)}
            style={{ background:C.teal, color:"#fff", padding:"11px 22px", borderRadius:9, fontWeight:700, fontSize:14 }}>
            Set Target {YEAR}</button>
        </div>
      </div>
    );
  }

  const tP=target?Number(target.target_pendapatan):0, tL=target?Number(target.target_laba):0, tT=target?Number(target.target_transaksi):0;
  const now = new Date();
  // kalau tahun buku sudah lewat, anggap 12 bulan penuh; kalau tahun depan, anggap 0 (belum jalan)
  const bulanBerjalan = now.getFullYear()===YEAR ? now.getMonth()+1
    : (now.getFullYear()>YEAR ? 12 : 0);

  const Metric = ({ label, tahunan, aktual, isMoney, icon:Icon, tone }) => {
    const prog = tahunan ? aktual/tahunan : 0;
    const bulanan = tahunan/12, mingguan = tahunan/52;
    const fmt = (v)=> isMoney ? money(v) : Math.round(v).toLocaleString("id-ID");
    // proyeksi & kekurangan
    const targetSampaiKini = bulanan*bulanBerjalan;
    const selisih = aktual - targetSampaiKini;
    const onTrack = selisih >= 0;
    const sisa = Math.max(0, tahunan - aktual);
    const bulanSisa = Math.max(1, 12 - bulanBerjalan);
    const butuhPerBulan = sisa / bulanSisa;
    return (
      <div className="card" style={{ padding:"18px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:tone+"18", display:"grid", placeItems:"center" }}>
            <Icon size={19} color={tone} /></div>
          <div style={{ fontWeight:700, fontSize:15 }}>{label}</div>
          <span style={{ marginLeft:"auto", fontWeight:700, fontSize:15, color:prog>=1?C.pos:tone }}>{pct(prog)}</span>
        </div>
        <div style={{ height:10, borderRadius:99, background:C.surf, overflow:"hidden", marginBottom:12 }}>
          <div style={{ height:"100%", borderRadius:99, background:prog>=1?C.pos:tone,
            width:`${Math.min(100, prog*100)}%`, transition:"width .5s" }} /></div>
        <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12.5 }}>
          <Cell2 l="Aktual" v={fmt(aktual)} bold />
          <Cell2 l="Target tahunan" v={fmt(tahunan)} />
          <Cell2 l="Target / bulan" v={fmt(bulanan)} />
          <Cell2 l="Target / minggu" v={fmt(mingguan)} />
        </div>
        {bulanBerjalan > 0 && (
          <div style={{ marginTop:12, padding:"10px 12px", borderRadius:8,
            background:onTrack?C.pos+"10":C.neg+"0D", fontSize:12, lineHeight:1.5, color:C.ink }}>
            {onTrack
              ? <>✓ <b>On track</b> — unggul {fmt(Math.abs(selisih))} dari target sampai bulan ke-{bulanBerjalan}.</>
              : <>⚠ <b>Di bawah target</b> — kurang {fmt(Math.abs(selisih))}. Butuh <b>{fmt(butuhPerBulan)}/bulan</b> untuk kejar target.</>}
          </div>
        )}
      </div>
    );
  };

  // minimal transaksi untuk capai target pendapatan
  const rataPerTx = ach.transaksi ? ach.pendapatan/ach.transaksi : 0;
  const sisaPendapatan = Math.max(0, tP - Number(ach.pendapatan));
  const minTxLagi = rataPerTx ? Math.ceil(sisaPendapatan/rataPerTx) : null;

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Perencanaan" title={`Target ${YEAR}`}
          sub="Pencapaian aktual vs target — dibagi otomatis ke bulanan & mingguan" />
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button className="btn no-print" onClick={()=>window.print()}
            style={{ display:"flex", alignItems:"center", gap:6, background:C.deep, color:"#fff",
              padding:"9px 14px", borderRadius:9, fontSize:12.5, fontWeight:600 }}>
            <Printer size={14} /> PDF</button>
          <button className="btn no-print" onClick={()=>setEdit(!edit)}
            style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.brass,
              color:edit?C.sub:"#fff", padding:"9px 16px", borderRadius:9, fontSize:13, fontWeight:600 }}>
            {edit? <><X size={15}/> Tutup</> : <><Pencil size={15}/> Ubah Target</>}</button>
        </div>
      </div>

      {edit && (
        <div className="card pop no-print" style={{ padding:20, marginBottom:16, border:`2px solid ${C.brass}` }}>
          <div style={{ fontSize:12.5, color:C.sub, marginBottom:12 }}>
            Target ini berlaku untuk tahun buku <b>{YEAR}</b>. Ganti tahun di sidebar untuk mengatur target tahun lain.
          </div>
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label style={lbl}>Target Pendapatan / tahun</label>
              <input className="mono" inputMode="numeric" placeholder="mis. 1500000000" value={form.pendapatan}
                onChange={e=>setForm({...form,pendapatan:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Target Laba Bersih / tahun</label>
              <input className="mono" inputMode="numeric" placeholder="mis. 300000000" value={form.laba}
                onChange={e=>setForm({...form,laba:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Target Jumlah Transaksi / tahun</label>
              <input className="mono" inputMode="numeric" placeholder="mis. 1200" value={form.transaksi}
                onChange={e=>setForm({...form,transaksi:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
          </div>
          <button className="btn" onClick={simpan} disabled={busy}
            style={{ width:"100%", padding:"11px", borderRadius:9, background:C.brass, color:"#fff", fontWeight:700, fontSize:14 }}>
            {busy?"Menyimpan…":"Simpan Target"}</button>
        </div>
      )}
      {flash && <div className="pop" style={{ textAlign:"center", marginBottom:14,
        color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14, marginBottom:16 }}>
        <Metric label="Pendapatan (Omzet)" tahunan={tP} aktual={Number(ach.pendapatan)} isMoney icon={ArrowUpCircle} tone={C.teal} />
        <Metric label="Laba Bersih" tahunan={tL} aktual={Number(ach.laba)} isMoney icon={TrendingUp} tone={C.pos} />
        <Metric label="Jumlah Transaksi" tahunan={tT} aktual={Number(ach.transaksi)} icon={Wallet} tone={C.brass} />
      </div>

      {/* Analisis minimal transaksi */}
      <div className="card" style={{ padding:"18px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <Lightbulb size={18} color={C.brass} />
          <span style={{ fontWeight:700, fontSize:15 }}>Analisis Pencapaian Target</span>
        </div>
        <div style={{ fontSize:13, color:C.ink, lineHeight:1.7 }}>
          {ach.transaksi>0 ? <>
            Rata-rata nilai per transaksi Anda saat ini <b>{money(rataPerTx)}</b>.
            {minTxLagi!==null && sisaPendapatan>0 ? <>
              {" "}Untuk mencapai target pendapatan {money(tP)}, Anda perlu sekitar <b>{minTxLagi.toLocaleString("id-ID")} transaksi lagi</b>
              {" "}(kekurangan {money(sisaPendapatan)}).
            </> : sisaPendapatan<=0 && tP>0 ? <> {" "}🎉 Target pendapatan sudah tercapai!</> : <> {" "}Set target pendapatan untuk melihat kebutuhan transaksi.</>}
          </> : `Belum ada transaksi tahun ${YEAR} untuk dianalisis. Input transaksi dulu.`}
        </div>
      </div>

      {/* Kontribusi tiap cabang terhadap target */}
      {(()=>{
        const cabang = perCabang(pnlTahun, accounts);
        if (cabang.length===0) return null;
        const totalRevCabang = cabang.reduce((s,b)=>s+b.rev,0);
        // target dibagi rata sebagai acuan awal; cabang baru wajar belum mencapainya
        const acuan = tP ? tP/cabang.length : 0;
        return (
          <div className="card" style={{ padding:"18px 20px", marginTop:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <TargetIcon size={18} color={C.teal} />
              <span style={{ fontWeight:700, fontSize:15 }}>Kontribusi Cabang terhadap Target</span>
            </div>
            <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
              Target {YEAR} ditetapkan untuk seluruh entitas. Tabel ini memperlihatkan berapa besar
              tiap cabang menyumbang omzet, dengan acuan pembagian rata {money(acuan)} per cabang.
            </div>
            <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 90px 1fr 100px",
                padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
                <span>CABANG</span>
                <span style={{ textAlign:"right" }}>OMZET {YEAR}</span>
                <span style={{ textAlign:"center" }}>PORSI</span>
                <span style={{ textAlign:"right" }}>ACUAN RATA</span>
                <span style={{ textAlign:"center" }}>CAPAIAN</span>
              </div>
              {cabang.map(b=>{
                const porsi = totalRevCabang>0 ? b.rev/totalRevCabang : 0;
                const capai = acuan>0 ? b.rev/acuan : 0;
                return (
                  <div key={b.nama} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 90px 1fr 100px",
                    padding:"9px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:7, fontWeight:600, color:C.deep }}>
                      <span style={{ width:8, height:8, borderRadius:99, background:b.warna }} />{b.nama}</span>
                    <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(b.rev)}</span>
                    <span className="mono" style={{ textAlign:"center", color:C.sub }}>{pct(porsi)}</span>
                    <span className="mono" style={{ textAlign:"right", color:C.sub }}>
                      {acuan>0?money(acuan):"–"}</span>
                    <span className="mono" style={{ textAlign:"center", fontWeight:700,
                      color: acuan===0 ? C.sub : capai>=1?C.pos : capai>=0.8?C.brass : C.neg }}>
                      {acuan>0?pct(capai):"–"}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:11, color:C.sub, marginTop:10, lineHeight:1.5 }}>
              Acuan rata hanya alat bantu baca, bukan target resmi per cabang — cabang lama dan cabang
              yang baru buka wajar punya kapasitas berbeda. Untuk target resmi per cabang, struktur
              tabel target di database perlu ditambah kolom cabang.
            </div>
          </div>
        );
      })()}

      {/* ===== Detail ketercapaian per bulan ===== */}
      {monthly.length>0 && (()=>{
        const tgtBulanan = { p: tP/12, l: tL/12, t: tT/12 };
        const data = monthly.map(m=>({
          bulan: Number(m.bulan),
          nama: MONTHS[Number(m.bulan)-1]?.slice(0,3) || m.bulan,
          pend: Number(m.pendapatan), laba: Number(m.laba), tx: Number(m.transaksi),
        }));
        // hitung kumulatif berjalan
        let kp=0, kl=0, kt=0;
        const rows = data.map(d=>{
          kp+=d.pend; kl+=d.laba; kt+=d.tx;
          return { ...d, kumP:kp, kumL:kl, kumT:kt,
            tgtKumP: tgtBulanan.p*d.bulan, tgtKumL: tgtBulanan.l*d.bulan, tgtKumT: tgtBulanan.t*d.bulan };
        });
        const adaData = rows.some(r=>r.pend>0||r.tx>0);
        const chartData = rows.map(r=>({ m:r.nama, Target:Math.round(tgtBulanan.p), Aktual:r.pend }));

        const Status = ({ aktual, target }) => {
          if (!target) return <span style={{ color:C.line }}>–</span>;
          const p = aktual/target;
          const ok = p>=1;
          return (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontWeight:700, fontSize:11,
              color: ok?C.pos : p>=0.8?C.brass : C.neg }}>
              {ok?"✓":"✗"} {pct(p)}
            </span>
          );
        };

        return (
          <div style={{ marginTop:16 }}>
            {/* Grafik target vs aktual */}
            <div className="card" style={{ padding:"18px 18px 8px", marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:14.5 }}>Target vs Aktual Pendapatan per Bulan</div>
              <div style={{ fontSize:12, color:C.sub, marginBottom:8 }}>
                Garis target bulanan: {money(tgtBulanan.p)}</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartData} margin={{ left:-18, right:6, top:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
                  <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
                  <Legend wrapperStyle={{ fontSize:11.5 }} />
                  <Bar dataKey="Target" fill={C.line} radius={[4,4,0,0]} />
                  <Bar dataKey="Aktual" radius={[4,4,0,0]}>
                    {chartData.map((d,i)=><Cell key={i} fill={d.Aktual>=d.Target?C.pos:d.Aktual>0?C.brass:C.line} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabel detail per bulan */}
            <div className="card scroll-x" style={{ overflow:"hidden" }}>
              <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.line}` }}>
                <div style={{ fontWeight:600, fontSize:14.5 }}>Ketercapaian Target per Bulan</div>
                <div style={{ fontSize:11.5, color:C.sub, marginTop:2 }}>
                  Target/bulan — Pendapatan {money(tgtBulanan.p)} · Laba {money(tgtBulanan.l)} · Transaksi {Math.round(tgtBulanan.t)}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"58px repeat(3,1fr) repeat(3,1fr)",
                padding:"9px 18px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
                <span>BULAN</span>
                <span style={{ textAlign:"right" }}>PENDAPATAN</span>
                <span style={{ textAlign:"right" }}>LABA</span>
                <span style={{ textAlign:"center" }}>TRANSAKSI</span>
                <span style={{ textAlign:"center" }}>≥ TGT PEND</span>
                <span style={{ textAlign:"center" }}>≥ TGT LABA</span>
                <span style={{ textAlign:"center" }}>≥ TGT TRX</span>
              </div>
              {!adaData && <div style={{ padding:"18px", fontSize:13, color:C.sub }}>Belum ada data transaksi tahun {YEAR}.</div>}
              {adaData && rows.map(r=>{
                const kosong = r.pend===0 && r.tx===0;
                return (
                  <div key={r.bulan} style={{ display:"grid", gridTemplateColumns:"58px repeat(3,1fr) repeat(3,1fr)",
                    padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center",
                    opacity: kosong?0.45:1 }}>
                    <span style={{ fontWeight:600, color:C.deep }}>{r.nama}</span>
                    <span className="mono" style={{ textAlign:"right" }}>{r.pend?money(r.pend):"–"}</span>
                    <span className="mono" style={{ textAlign:"right", color:r.laba<0?C.neg:C.ink }}>{r.laba?money(r.laba):"–"}</span>
                    <span className="mono" style={{ textAlign:"center" }}>{r.tx||"–"}</span>
                    <span style={{ textAlign:"center" }}><Status aktual={r.pend} target={tgtBulanan.p} /></span>
                    <span style={{ textAlign:"center" }}><Status aktual={r.laba} target={tgtBulanan.l} /></span>
                    <span style={{ textAlign:"center" }}><Status aktual={r.tx} target={tgtBulanan.t} /></span>
                  </div>
                );
              })}
            </div>

            {/* Tabel kumulatif */}
            {adaData && (
              <div className="card" style={{ overflow:"hidden", marginTop:16 }}>
                <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.line}` }}>
                  <div style={{ fontWeight:600, fontSize:14.5 }}>Kumulatif (s/d Bulan Tersebut)</div>
                  <div style={{ fontSize:11.5, color:C.sub, marginTop:2 }}>
                    Membandingkan total berjalan dengan target kumulatif — melihat apakah Anda on-track sepanjang tahun</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 1fr 1fr",
                  padding:"9px 18px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
                  <span>BULAN</span>
                  <span style={{ textAlign:"right" }}>PENDAPATAN KUM.</span>
                  <span style={{ textAlign:"right" }}>TARGET KUM.</span>
                  <span style={{ textAlign:"center" }}>CAPAIAN</span>
                  <span style={{ textAlign:"center" }}>STATUS</span>
                </div>
                {rows.filter(r=>r.kumP>0).map(r=>{
                  const p = r.tgtKumP ? r.kumP/r.tgtKumP : 0;
                  const ok = p>=1;
                  return (
                    <div key={r.bulan} style={{ display:"grid", gridTemplateColumns:"58px 1fr 1fr 1fr 1fr",
                      padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                      <span style={{ fontWeight:600, color:C.deep }}>{r.nama}</span>
                      <span className="mono" style={{ textAlign:"right" }}>{money(r.kumP)}</span>
                      <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(r.tgtKumP)}</span>
                      <span className="mono" style={{ textAlign:"center", fontWeight:700, color:ok?C.pos:C.brass }}>{pct(p)}</span>
                      <span style={{ textAlign:"center", fontSize:11, fontWeight:700, color:ok?C.pos:C.neg }}>
                        {ok?"✓ On-track":"✗ Tertinggal"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
const Cell2 = ({ l, v, bold }) => (
  <div>
    <div style={{ fontSize:10.5, color:C.sub }}>{l}</div>
    <div className="mono" style={{ fontSize:13.5, fontWeight:bold?700:600, color:bold?C.ink:C.sub }}>{v}</div>
  </div>
);

// ============================================================
// PENGEMBANGAN USAHA — disusun sebagai perencanaan bisnis bertahap:
// 1 Strategi · 2 Produk · 3 Penjualan · 4 Pemasaran · 5 Anggaran · 6 Kelayakan
// Modal dan proyeksi TIDAK diisi manual di awal — keduanya hasil
// penjumlahan dari tahap 2 sampai 5.
// ============================================================
const KATEGORI_INISIATIF = ["Produk Baru","Cabang Baru","Peralatan","Layanan","Lainnya"];
const STATUS_INISIATIF = {
  ide:     { label:"Ide",     tone:C.sub,   urut:1, jelas:"Baru gagasan, belum dikaji" },
  kajian:  { label:"Kajian",  tone:C.brass, urut:2, jelas:"Sedang dihitung kelayakannya" },
  jalan:   { label:"Berjalan",tone:C.teal,  urut:3, jelas:"Sudah dieksekusi" },
  selesai: { label:"Selesai", tone:C.pos,   urut:4, jelas:"Tuntas / sudah balik modal" },
  batal:   { label:"Batal",   tone:C.neg,   urut:5, jelas:"Dihentikan" },
};
const SUMBER_DANA = {
  laba:     "Laba ditahan",
  owner:    "Setoran modal owner",
  pinjaman: "Pinjaman bank / pihak ketiga",
  investor: "Investor",
  campuran: "Gabungan beberapa sumber",
};
const JENIS_KANAL = {
  marketplace: { label:"Marketplace", tone:C.teal,  contoh:"Shopee, Tokopedia, TikTok Shop" },
  sosial:      { label:"Media Sosial",tone:C.brass, contoh:"Instagram, WhatsApp, TikTok" },
  offline:     { label:"Offline",     tone:C.kas,   contoh:"Dijual langsung saat kelas / event" },
  reseller:    { label:"Reseller",    tone:C.pos,   contoh:"Pelatih, mitra, toko lain" },
};
const JENIS_PEMASARAN = {
  sosmed:     { label:"Konten Sosmed", tone:C.teal },
  iklan:      { label:"Iklan Berbayar",tone:C.brass },
  promo:      { label:"Promo & Diskon",tone:C.kas },
  kolaborasi: { label:"Kolaborasi",    tone:C.pos },
  lainnya:    { label:"Lainnya",       tone:C.sub },
};
const SARAN_FEE = { "Shopee":8, "Tokopedia":7, "TikTok Shop":8, "Lazada":7, "Instagram":0, "WhatsApp":0 };
const KATEGORI_MODAL = ["Peralatan","Desain & Branding","Foto & Konten","Perizinan",
  "Sewa & Deposit","Renovasi","Pelatihan","Lainnya"];
const KATEGORI_BULANAN = ["Sewa","Gaji & Honor","Utilitas","Langganan Aplikasi",
  "Transport & Kirim","Operasional","Lainnya"];
const SWOT = {
  strength:    { label:"Kekuatan",  singkat:"S", tone:C.pos,   sisi:"internal",
                 ket:"Yang sudah dimiliki dan menguntungkan",
                 contoh:"mis. 600+ siswa aktif jadi pasar siap, merek sudah dikenal di Bandung" },
  weakness:    { label:"Kelemahan", singkat:"W", tone:C.brass, sisi:"internal",
                 ket:"Kekurangan di dalam yang menghambat",
                 contoh:"mis. belum punya tim desain, belum pernah kelola stok barang" },
  opportunity: { label:"Peluang",   singkat:"O", tone:C.teal,  sisi:"eksternal",
                 ket:"Keadaan luar yang bisa dimanfaatkan",
                 contoh:"mis. tren olahraga anak naik, marketplace gratis ongkir" },
  threat:      { label:"Ancaman",   singkat:"T", tone:C.neg,   sisi:"eksternal",
                 ket:"Keadaan luar yang bisa merugikan",
                 contoh:"mis. merchandise serupa dijual lebih murah, harga bahan naik" },
};
const BOBOT = { 1:"Kecil", 2:"Sedang", 3:"Besar" };

/* ============================================================
   UJI SKENARIO & ARUS KAS
   Biaya dipisah jadi variabel (ikut volume) dan tetap (jalan terus
   berapa pun yang terjual) — pemisahan ini yang membuat skenario
   dan titik impas jadi benar, bukan sekadar mengalikan semuanya.
   ============================================================ */
function modelBiaya(n) {
  // kalau rincian tahap 2–5 ada, biaya bisa dipilah; kalau cuma angka
  // tersimpan dari rencana lama, anggap seluruhnya tetap (lebih hati-hati)
  const bisaPilah = n.biayaHitung > 0;
  const variabel  = bisaPilah ? (n.hppBln + n.feeBln) : 0;
  const tetap     = bisaPilah ? (n.markBln + n.opsBln) : n.biayaBln;
  const kontribusi = n.omzetBln - variabel;              // margin kontribusi per bulan
  const rasioKontrib = n.omzetBln > 0 ? kontribusi/n.omzetBln : null;
  // titik impas: berapa bagian dari target bulanan yang harus tercapai
  const impasFaktor = kontribusi > 0 ? tetap/kontribusi : null;
  return { bisaPilah, variabel, tetap, kontribusi, rasioKontrib, impasFaktor };
}

// hitung ulang seluruh angka pada satu tingkat pencapaian target
function skenario(n, faktor) {
  const m = modelBiaya(n);
  const omzet = n.omzetBln * faktor;
  const biaya = m.variabel * faktor + m.tetap;
  const laba  = omzet - biaya;
  return {
    faktor, omzet, biaya, laba,
    margin: omzet > 0 ? laba/omzet : null,
    bep:    laba > 0 && n.modal > 0 ? n.modal/laba : null,
    roi:    n.modal > 0 ? (laba*12)/n.modal : null,
  };
}

// proyeksi kas 13 titik: bulan 0 (modal keluar) + 12 bulan berjalan
function arusKas(n, faktor, rampBulan) {
  const m = modelBiaya(n);
  const baris = [];
  let saldo = n.siap - n.modal;
  baris.push({ bulan:0, masuk:0, keluar:n.modal, bersih:-n.modal, saldo });
  for (let b = 1; b <= 12; b++) {
    const ramp = rampBulan > 1 ? Math.min(1, b/rampBulan) : 1;
    const f = faktor * ramp;
    const masuk  = n.omzetBln * f;
    const keluar = m.variabel * f + m.tetap;
    const bersih = masuk - keluar;
    saldo += bersih;
    baris.push({ bulan:b, masuk, keluar, bersih, saldo, ramp });
  }
  const titikTerendah = baris.reduce((a,b)=> b.saldo < a.saldo ? b : a, baris[0]);
  const pulih = baris.find(b=>b.bulan>0 && b.saldo >= 0);
  return { baris, titikTerendah, pulih };
}

/* ============================================================
   SKEMA DISKON
   Diskon memotong harga jual, tapi HPP tidak ikut turun — dan
   potongan platform dihitung dari harga SETELAH diskon. Karena itu
   batas amannya bukan "sisa margin", melainkan rumus di bawah.
   ============================================================ */
const JENIS_DISKON = {
  persen:   { label:"Potongan persen",   satuan:"%",  ket:"mis. diskon 15% dari harga jual" },
  nominal:  { label:"Potongan rupiah",   satuan:"Rp", ket:"mis. potong Rp 20.000 per unit" },
  bundling: { label:"Beli N gratis M",   satuan:"",   ket:"mis. beli 2 gratis 1 — yang gratis tetap keluar ongkos produksi" },
  paket:    { label:"Harga paket",       satuan:"Rp", ket:"mis. 2 pcs Rp 130.000 (normal Rp 150.000)" },
  cashback: { label:"Cashback penjual",  satuan:"Rp", ket:"mis. cashback Rp 10.000 yang ditanggung sendiri, bukan platform" },
  ongkir:   { label:"Ongkir ditanggung", satuan:"Rp", ket:"mis. subsidi ongkir Rp 15.000 per paket" },
};

// promo siap pakai untuk disimulasikan terhadap produk yang ada
const PROMO_UMUM = [
  { nama:"Beli 1 Gratis 1 (BOGO)", kind:"bundling", min_qty:1, free_qty:1 },
  { nama:"Beli 2 Gratis 1",        kind:"bundling", min_qty:2, free_qty:1 },
  { nama:"Beli 3 Gratis 1",        kind:"bundling", min_qty:3, free_qty:1 },
  { nama:"Beli 4 Gratis 1",        kind:"bundling", min_qty:4, free_qty:1 },
  { nama:"Diskon 10%",             kind:"persen",   value:10 },
  { nama:"Diskon 15%",             kind:"persen",   value:15 },
  { nama:"Diskon 20%",             kind:"persen",   value:20 },
  { nama:"Diskon 25%",             kind:"persen",   value:25 },
  { nama:"Diskon 30%",             kind:"persen",   value:30 },
  { nama:"Diskon 50%",             kind:"persen",   value:50 },
  { nama:"Gratis ongkir Rp 15.000",kind:"ongkir",   value:15000 },
  { nama:"Gratis ongkir Rp 25.000",kind:"ongkir",   value:25000 },
];

// bagian harga yang hilang karena satu skema diskon (0–1)
function potonganEfektif(d, hargaJual) {
  const v = Number(d.value)||0;
  if (d.kind === "persen")   return Math.min(1, v/100);
  if (d.kind === "nominal")  return hargaJual > 0 ? Math.min(1, v/hargaJual) : 0;
  if (d.kind === "ongkir")   return hargaJual > 0 ? Math.min(1, v/hargaJual) : 0;
  if (d.kind === "cashback") return hargaJual > 0 ? Math.min(1, v/hargaJual) : 0;
  if (d.kind === "bundling") {
    const n = Number(d.min_qty)||1, m = Number(d.free_qty)||0;
    return n+m > 0 ? m/(n+m) : 0;   // gratis M dari total N+M unit yang diserahkan
  }
  if (d.kind === "paket") {
    const n = Number(d.min_qty)||1;
    const normal = hargaJual * n;    // harga wajar bila dibeli satuan
    return normal > 0 ? Math.max(0, Math.min(1, 1 - v/normal)) : 0;
  }
  return 0;
}

// batas diskon maksimum satu produk pada kanal dengan potongan f
//   impas : harga(1-d)(1-f) = HPP
//   target: laba per unit >= marginTarget x harga setelah diskon
function batasDiskon(hargaJual, hpp, f, marginTarget) {
  const P = Number(hargaJual)||0, C = Number(hpp)||0;
  if (P <= 0) return { impas:null, aman:null, marginNormal:null };
  const marginNormal = (P*(1-f) - C) / P;
  const impas = 1 - C / (P*(1-f));
  const sisa  = 1 - f - (marginTarget||0);
  const aman  = sisa > 0 ? 1 - C/(P*sisa) : null;
  return {
    impas: impas > 0 ? impas : 0,
    aman:  aman !== null && aman > 0 ? aman : 0,
    marginNormal,
  };
}

// terapkan satu diskon ke satu produk, hasilkan angka setelah diskon
function hasilDiskon(produk, d, f) {
  const P = Number(produk.price_unit)||0, C = Number(produk.cost_unit)||0;
  const pot = potonganEfektif(d, P);
  const hargaBaru = P * (1 - pot);
  const bersih    = hargaBaru * (1 - f);       // setelah potongan platform
  const laba      = bersih - C;
  const margin    = hargaBaru > 0 ? laba/hargaBaru : null;
  const lamaLaba  = P*(1-f) - C;
  return { pot, hargaBaru, bersih, laba, margin, selisihLaba: laba - lamaLaba };
}

/* ---- posisi strategis dari hasil SWOT (kuadran baku) ---- */
function posisiSwot(swot) {
  const skor = (k) => (swot||[]).filter(s=>s.kind===k)
    .reduce((t,s)=>t+(Number(s.impact)||2), 0);
  const S = skor("strength"), W = skor("weakness");
  const O = skor("opportunity"), T = skor("threat");
  const internal = S - W, eksternal = O - T;
  const cukup = (swot||[]).length >= 2;
  if (!cukup) return { cukup:false, S, W, O, T, internal, eksternal };
  let nama, tone, saran;
  if (internal >= 0 && eksternal >= 0) {
    nama = "Agresif"; tone = C.pos;
    saran = "Kekuatan dan peluang sama-sama dominan. Ini posisi paling baik untuk maju — perbesar skala, percepat peluncuran, dan pakai kekuatan yang ada untuk merebut peluang sebelum pesaing.";
  } else if (internal >= 0 && eksternal < 0) {
    nama = "Diversifikasi"; tone = C.brass;
    saran = "Kekuatan memadai tapi keadaan luar menekan. Pakai kekuatan yang dimiliki untuk membuka jalur lain — variasi produk, segmen baru, atau kanal yang belum ramai pesaing.";
  } else if (internal < 0 && eksternal >= 0) {
    nama = "Perbaikan"; tone = C.teal;
    saran = "Peluangnya ada, tapi kelemahan internal menghalangi. Benahi dulu yang lemah — kemampuan tim, proses, atau modal — sebelum menambah skala, supaya peluangnya tidak terbuang.";
  } else {
    nama = "Bertahan"; tone = C.neg;
    saran = "Kelemahan dan ancaman sama-sama dominan. Pertimbangkan menunda, memperkecil skala awal, atau menjalankan uji coba kecil dulu sebelum mengeluarkan modal besar.";
  }
  return { cukup:true, S, W, O, T, internal, eksternal, nama, tone, saran };
}

/* ---- hitungan gabungan seluruh tahap ---- */
function ringkasRencana(r) {
  const produk = r.initiative_products  || [];
  const kanal  = r.initiative_channels  || [];
  const mark   = r.initiative_marketing || [];
  const bud    = r.initiative_budget    || [];
  const swot   = r.initiative_swot      || [];
  const diskon = r.initiative_discounts || [];
  const budAwal  = bud.filter(b=>b.kind!=="bulanan");
  const budBulan = bud.filter(b=>b.kind==="bulanan");
  const posisi   = posisiSwot(swot);

  // --- modal awal ---
  const stokAwal      = produk.reduce((s,p)=>s+(Number(p.cost_unit)||0)*(Number(p.qty_initial)||0), 0);
  const biayaAwalLain = budAwal.reduce((s,b)=>s+(Number(b.amount)||0), 0);
  const modalHitung   = stokAwal + biayaAwalLain;

  // --- pendapatan bulanan ---
  const omzetProduk = produk.reduce((s,p)=>s+(Number(p.price_unit)||0)*(Number(p.qty_month)||0), 0);
  const omzetLain   = Number(r.proj_revenue_month)||0;
  const omzetBln    = omzetProduk + omzetLain;

  // --- biaya bulanan ---
  const hppBln       = produk.reduce((s,p)=>s+(Number(p.cost_unit)||0)*(Number(p.qty_month)||0), 0);
  const feePctEfektif= kanal.reduce((s,c)=>
    s + ((Number(c.share_pct)||0)/100) * ((Number(c.fee_pct)||0)/100), 0);
  const feeBln       = omzetBln * feePctEfektif;
  const markBln      = mark.reduce((s,m)=>s+(Number(m.budget_month)||0), 0);
  const opsBln       = budBulan.reduce((s,b)=>s+(Number(b.amount)||0), 0);
  const biayaHitung  = hppBln + feeBln + markBln + opsBln;

  // angka tersimpan dipakai hanya sebagai cadangan untuk rencana lama
  const modal    = modalHitung  > 0 ? modalHitung  : (Number(r.capital_needed)||0);
  const biayaBln = biayaHitung  > 0 ? biayaHitung  : (Number(r.proj_cost_month)||0);

  const labaBln   = omzetBln - biayaBln;
  const marginBln = omzetBln > 0 ? labaBln/omzetBln : null;
  const siap      = Number(r.funding_secured)||0;
  const kurang    = Math.max(0, modal - siap);
  const bep       = labaBln > 0 && modal > 0 ? modal/labaBln : null;
  const roi       = modal > 0 ? (labaBln*12)/modal : null;
  const totalShare= kanal.reduce((s,c)=>s+(Number(c.share_pct)||0), 0);

  // kelengkapan tiap tahap, untuk penanda di tab
  const isi = {
    strategi: !!(r.description && r.description.trim()) || swot.length > 0,
    produk:   produk.length > 0,
    jual:     kanal.length  > 0,
    pasar:    mark.length   > 0,
    anggaran: bud.length > 0 || omzetLain > 0,
  };
  const lengkap = Object.values(isi).filter(Boolean).length;

  return { produk, kanal, mark, bud, budAwal, budBulan, swot, posisi, diskon,
           stokAwal, biayaAwalLain, modalHitung, modal,
           omzetProduk, omzetLain, omzetBln,
           hppBln, feePctEfektif, feeBln, markBln, opsBln, biayaHitung, biayaBln,
           labaBln, marginBln, siap, kurang, bep, roi, totalShare,
           isi, lengkap, adaRincian: modalHitung>0 || omzetBln>0 };
}

function Pengembangan({ orgId, accounts }) {
  const [rows, setRows] = useState([]);
  const [actuals, setActuals] = useState({});
  const [kas, setKas] = useState({ bank:0, kas:0, laba:0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [editId, setEditId] = useState(null);     // "baru" | id | null
  const [buka, setBuka] = useState(null);
  const [tab, setTab] = useState("strategi");
  const [tautFor, setTautFor] = useState(null);
  const [tautPilih, setTautPilih] = useState([]);
  const [tabelHilang, setTabelHilang] = useState([]);

  // form rencana: hanya identitas & strategi — angka datang dari tahap berikutnya
  const kosong = () => ({
    name:"", category:"Produk Baru", status:"ide", branch:"",
    start_date:`${YEAR}-01-01`, description:"",
  });
  const [form, setForm] = useState(kosong());

  const reload = async () => {
    setLoading(true);
    try {
      const [s,e] = periodRange(YEAR, "all");
      const list = await getInitiatives(orgId);
      setTabelHilang(tabelRincianHilang());
      setRows(list);
      const act = await rpcInitiativeActuals(orgId, s, e);
      const peta = {};
      act.forEach(a=>{ peta[a.initiative_id] = a; });
      setActuals(peta);
      const bal = await rpcAccountBalances(orgId, s, e);
      const laba = await rpcRetainedProfit(orgId, e);
      setKas({
        bank: bal.filter(b=>b.code==="1-10002").reduce((x,b)=>x+Number(b.balance),0),
        kas:  bal.filter(b=>b.code==="1-10007").reduce((x,b)=>x+Number(b.balance),0),
        laba: Number(laba)||0,
      });
      // selaraskan kolom tersimpan dengan hasil hitungan (diam-diam, tidak menghambat UI)
      list.forEach(r=>{
        const n = ringkasRencana(r);
        if (!n.adaRincian) return;
        const bedaModal = Math.abs((Number(r.capital_needed)||0) - n.modal) > 1;
        const bedaBiaya = Math.abs((Number(r.proj_cost_month)||0) - n.biayaBln) > 1;
        if (bedaModal || bedaBiaya) syncInitiativeNumbers(r.id, n).catch(()=>{});
      });
    } catch(err){ setFlash("✗ "+err.message); }
    setLoading(false);
  };
  useEffect(()=>{ if(orgId) reload(); /* eslint-disable-next-line */ }, [orgId]);

  const danaTersedia = kas.bank + kas.kas;

  const realisasi = (r) => {
    const a = actuals[r.id] || {};
    const aRev   = Number(a.pendapatan)||0;
    const aBeban = Number(a.beban)||0;
    const aAset  = Number(a.aset)||0;
    const aTrx   = Number(a.jml_transaksi)||0;
    return { aRev, aBeban, aAset, aLaba:aRev-aBeban, aTrx,
             ada: aTrx>0 || aRev!==0 || aBeban!==0 || aAset!==0 };
  };

  const simpan = async () => {
    if (!form.name.trim()) { setFlash("✗ Nama rencana wajib diisi"); return; }
    setBusy(true); setFlash("");
    const payload = { ...form, start_date: form.start_date || null };
    try {
      if (editId && editId!=="baru") {
        await updateInitiative(editId, payload);
        setFlash("✓ Rencana diperbarui");
      } else {
        const baru = await addInitiative(orgId, payload);
        if (baru?.id) { setBuka(baru.id); setTab("produk"); }
        setFlash("✓ Rencana tersimpan — lanjutkan ke tahap 2: rincian produk");
      }
      setEditId(null); setForm(kosong());
      await reload();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const mulaiEdit = (r) => {
    setEditId(r.id);
    setForm({ name:r.name, category:r.category||"Produk Baru", status:r.status||"ide",
      branch:r.branch||"", start_date:r.start_date||`${YEAR}-01-01`,
      description:r.description||"" });
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const hapus = async (r) => {
    if (!confirm(`Hapus rencana "${r.name}" beserta seluruh rincian produk, kanal, pemasaran, dan anggarannya? Jurnal yang sudah tercatat tidak ikut terhapus.`)) return;
    try { await deleteInitiative(r.id); reload(); } catch(err){ alert(err.message); }
  };

  const ubahStatus = async (r, status) => {
    try { await setInitiativeStatus(r.id, status); reload(); } catch(err){ alert(err.message); }
  };

  const bukaTaut = (r) => {
    setTautFor(r);
    setTautPilih((r.initiative_accounts||[]).map(x=>x.account_id));
  };
  const simpanTaut = async () => {
    setBusy(true);
    try {
      await setInitiativeAccounts(tautFor.id, tautPilih);
      setFlash(`✓ ${tautPilih.length} akun ditautkan ke "${tautFor.name}"`);
      setTautFor(null); await reload();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const akunBisaTaut = accounts.filter(a=>
    ["Pendapatan","Other Income","COGS","Beban Op","Beban Kas","Other Expense","Aktiva Tetap"].includes(a.type)
    && a.is_active!==false);

  // ---- ringkasan portofolio ----
  const hitungSemua = rows.map(r=>({ r, n: ringkasRencana(r) }));
  const aktif = rows.filter(r=>["kajian","jalan"].includes(r.status));
  const hidup = hitungSemua.filter(x=>x.r.status!=="batal");
  const totalModal  = hidup.reduce((s,x)=>s+x.n.modal, 0);
  const totalSiap   = hidup.reduce((s,x)=>s+x.n.siap, 0);
  const totalKurang = Math.max(0, totalModal - totalSiap);
  const proyeksiLabaBln = hitungSemua
    .filter(x=>["kajian","jalan"].includes(x.r.status))
    .reduce((s,x)=>s+x.n.labaBln, 0);

  const urut = [...hitungSemua].sort((a,b)=>
    (STATUS_INISIATIF[a.r.status]?.urut||9) - (STATUS_INISIATIF[b.r.status]?.urut||9));

  const TAHAP = [
    { k:"strategi", n:1, l:"Strategi" },
    { k:"produk",   n:2, l:"Produk" },
    { k:"jual",     n:3, l:"Penjualan" },
    { k:"pasar",    n:4, l:"Pemasaran" },
    { k:"anggaran", n:5, l:"Anggaran" },
    { k:"layak",    n:6, l:"Kelayakan" },
  ];

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <PageHead eyebrow="Perencanaan" title="Pengembangan Usaha"
          sub={`Disusun bertahap: strategi → produk → penjualan → pemasaran → anggaran → kelayakan · ${YEAR}`} />
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <button className="btn no-print" onClick={()=>window.print()}
            style={{ display:"flex", alignItems:"center", gap:6, background:C.deep, color:"#fff",
              padding:"9px 14px", borderRadius:9, fontSize:12.5, fontWeight:600 }}>
            <Printer size={14} /> PDF</button>
          <button className="btn no-print" onClick={()=>{
              if (editId) { setEditId(null); setForm(kosong()); }
              else { setEditId("baru"); setForm(kosong()); }
              setFlash("");
            }}
            style={{ display:"flex", alignItems:"center", gap:6, background:editId?C.surf:C.teal,
              color:editId?C.sub:"#fff", padding:"9px 16px", borderRadius:9, fontSize:13, fontWeight:600 }}>
            {editId ? <><X size={15}/> Tutup</> : <><Plus size={15}/> Rencana Baru</>}</button>
        </div>
      </div>

      {/* ---- Tahap 1: identitas & strategi ---- */}
      {editId && (
        <div className="card pop no-print" style={{ padding:20, marginBottom:16,
          border:`2px solid ${editId==="baru"?C.teal:C.brass}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
            <span style={{ width:24, height:24, borderRadius:99, background:C.teal, color:"#fff",
              display:"grid", placeItems:"center", fontSize:12, fontWeight:700 }}>1</span>
            <span style={{ fontWeight:700, fontSize:14.5 }}>
              {editId==="baru" ? "Identitas & Strategi" : "Ubah Identitas & Strategi"}</span>
          </div>
          <div style={{ fontSize:12.5, color:C.sub, marginBottom:14, lineHeight:1.55 }}>
            Isi dulu apa rencananya dan kenapa dijalankan. Modal, biaya, dan proyeksi laba
            <b> tidak diisi di sini</b> — semuanya terhitung sendiri setelah tahap 2 sampai 5 diisi.
          </div>

          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Nama Rencana</label>
              <input placeholder="mis. Lini Merchandise Samudra" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Kategori</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
                {KATEGORI_INISIATIF.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
            <div><label style={lbl}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                style={{ ...inp, fontWeight:600, color:STATUS_INISIATIF[form.status]?.tone }}>
                {Object.entries(STATUS_INISIATIF).map(([k,v])=>
                  <option key={k} value={k}>{v.label} — {v.jelas}</option>)}</select></div>
          </div>

          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Target Mulai</label>
              <input type="date" value={form.start_date||""}
                onChange={e=>setForm({...form,start_date:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Cabang terkait (opsional)</label>
              <select value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})} style={inp}>
                <option value="">— (lintas cabang / belum ditentukan)</option>
                {daftarCabang(accounts).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>

          <label style={lbl}>Latar belakang, target pasar & strategi</label>
          <textarea rows={5} value={form.description}
            onChange={e=>setForm({...form,description:e.target.value})}
            placeholder={"Kenapa rencana ini dijalankan, siapa targetnya, apa yang membedakan, dan apa risikonya.\n\nmis. Menjual kaos, kacamata, dan pelampung bermerek Samudra ke siswa aktif dan orang tuanya. Pembeda: desain khusus tiap angkatan, dijual saat kelas berlangsung. Risiko: stok tidak laku — ditekan dengan produksi awal jumlah kecil dan pre-order."}
            style={{ ...inp, height:"auto", lineHeight:1.6, resize:"vertical", marginBottom:16 }} />

          <button className="btn" onClick={simpan} disabled={busy||!form.name.trim()}
            style={{ width:"100%", padding:"12px", borderRadius:10,
              background:(form.name.trim()&&!busy)?(editId==="baru"?C.teal:C.brass):C.line,
              color:"#fff", fontWeight:700, fontSize:14.5 }}>
            {busy?"Menyimpan…":(editId==="baru"?"Simpan & Lanjut ke Tahap 2":"Simpan Perubahan")}</button>
        </div>
      )}
      {flash && <div className="pop" style={{ textAlign:"center", marginBottom:14,
        color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}

      {/* sebagian tabel rincian belum dibuat di Supabase */}
      {tabelHilang.length>0 && (
        <div className="card" style={{ padding:"14px 18px", marginBottom:16,
          background:C.brass+"10", border:`1px solid ${C.brass}40`,
          fontSize:12.5, color:C.ink, lineHeight:1.65 }}>
          <b style={{ color:C.brass }}>Sebagian tahap belum aktif.</b> Tabel berikut belum dibuat di
          Supabase: <b>{tabelHilang.join(", ")}</b>. Rencana dan tahap lain tetap berjalan normal —
          data lama tidak hilang. Jalankan file SQL yang sesuai, lalu buka ulang menu ini:
          <span style={{ display:"block", marginTop:6, color:C.sub }}>
            {tabelHilang.includes("initiative_products") && <>initiative_products / channels / marketing → <b>pengembangan_rincian.sql</b> · </>}
            {tabelHilang.includes("initiative_budget") && <>initiative_budget → <b>pengembangan_anggaran.sql</b> · </>}
            {tabelHilang.includes("initiative_swot") && <>initiative_swot → <b>pengembangan_swot.sql</b></>}
          </span>
        </div>
      )}

      {loading && <div className="card" style={{ padding:20, color:C.sub, fontSize:13 }}>Memuat…</div>}

      {!loading && rows.length===0 && !editId && (
        <div className="card" style={{ padding:32, textAlign:"center" }}>
          <Rocket size={40} color={C.brass} style={{ marginBottom:12 }} />
          <div style={{ fontSize:15.5, fontWeight:600, marginBottom:6 }}>Belum ada rencana pengembangan</div>
          <div style={{ fontSize:13, color:C.sub, lineHeight:1.6, maxWidth:560, margin:"0 auto 18px" }}>
            Setiap rencana disusun dalam enam tahap seperti rencana bisnis: strategi, rincian produk
            beserta bahan dan vendornya, kanal penjualan, pemasaran, anggaran modal dan biaya bulanan,
            lalu kelayakan. Modal dan proyeksi laba dihitung sendiri dari anggaran yang kamu isi.
          </div>
          <button className="btn" onClick={()=>{ setEditId("baru"); setForm(kosong()); }}
            style={{ background:C.teal, color:"#fff", padding:"11px 22px", borderRadius:9, fontWeight:700, fontSize:14 }}>
            Mulai Rencana Pertama</button>
        </div>
      )}

      {!loading && rows.length>0 && <>
        <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:16 }}>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Rencana Aktif</div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6, color:C.teal }}>{aktif.length}</div>
            <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>dari {rows.length} rencana tercatat</div>
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Total Modal Dibutuhkan</div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6 }}>{money(totalModal)}</div>
            <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>
              hasil hitungan anggaran · tersedia {moneyShort(totalSiap)}</div>
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Kekurangan Dana</div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6,
              color: totalKurang===0?C.pos : totalKurang<=danaTersedia?C.brass:C.neg }}>
              {totalKurang===0?"Tercukupi":money(totalKurang)}</div>
            <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>
              kas & bank saat ini {moneyShort(danaTersedia)}</div>
          </div>
          <div className="card" style={{ padding:"16px 17px" }}>
            <div style={{ fontSize:12.5, color:C.sub }}>Proyeksi Tambahan Laba</div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6,
              color:proyeksiLabaBln>=0?C.pos:C.neg }}>{money(proyeksiLabaBln)}</div>
            <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>per bulan, bila semua berjalan</div>
          </div>
        </div>

        {totalKurang > 0 && (
          <div className="card" style={{ padding:"14px 18px", marginBottom:16,
            background: totalKurang<=danaTersedia ? C.teal+"0D" : C.brass+"10",
            border:`1px solid ${totalKurang<=danaTersedia ? C.teal+"30" : C.brass+"40"}`,
            fontSize:12.5, color:C.ink, lineHeight:1.6 }}>
            {totalKurang<=danaTersedia
              ? <>Kekurangan dana <b>{money(totalKurang)}</b> masih bisa ditutup dari kas & bank yang
                  ada sekarang (<b>{money(danaTersedia)}</b>). Sisakan dana darurat untuk operasional
                  rutin sebelum seluruh saldo dipakai untuk ekspansi.</>
              : <>Kekurangan dana <b>{money(totalKurang)}</b> melebihi kas & bank yang tersedia
                  (<b>{money(danaTersedia)}</b>). Pertimbangkan menjalankan rencana secara bertahap,
                  menunda yang ROI-nya paling rendah, atau mencari pendanaan luar.</>}
          </div>
        )}

        {/* ---- Daftar rencana ---- */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {urut.map(({ r, n })=>{
            const st = STATUS_INISIATIF[r.status] || STATUS_INISIATIF.ide;
            const rel = realisasi(r);
            const tertaut = (r.initiative_accounts||[]).length;
            const terbuka = buka===r.id;
            return (
              <div key={r.id} className="card" style={{ overflow:"hidden", borderLeft:`4px solid ${st.tone}` }}>
                <div style={{ padding:"14px 18px", display:"flex", alignItems:"flex-start",
                  gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>{r.name}</span>
                      <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 8px", borderRadius:20,
                        background:st.tone+"18", color:st.tone, letterSpacing:".04em" }}>
                        {st.label.toUpperCase()}</span>
                      <span style={{ fontSize:11, color:C.sub }}>{r.category}</span>
                      {r.branch && <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 7px",
                        borderRadius:20, background:C.teal+"15", color:C.teal }}>{r.branch}</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap",
                      fontSize:11.5, color:C.sub }}>
                      <span>{r.start_date ? `Mulai ${r.start_date}` : "Belum ada target mulai"}</span>
                      <span style={{ display:"flex", gap:3, alignItems:"center" }}>
                        {TAHAP.slice(0,5).map(t=>(
                          <span key={t.k} title={`Tahap ${t.n} ${t.l}`}
                            style={{ width:7, height:7, borderRadius:99,
                              background: n.isi[t.k] ? C.pos : C.line }} />
                        ))}
                        <span style={{ marginLeft:2 }}>{n.lengkap}/5 tahap terisi</span>
                      </span>
                      {tertaut>0 && <span style={{ color:C.pos, fontWeight:600 }}>· {tertaut} akun tertaut</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10.5, color:C.sub }}>Modal (hasil anggaran)</div>
                    <div className="mono" style={{ fontSize:15, fontWeight:700 }}>
                      {n.modal>0?money(n.modal):"belum dianggarkan"}</div>
                    {n.modal>0 && <div style={{ fontSize:10.5, color:n.kurang>0?C.brass:C.pos,
                      fontWeight:600, marginTop:2 }}>
                      {n.kurang>0 ? `kurang ${moneyShort(n.kurang)}` : "dana siap"}</div>}
                  </div>
                  <div className="no-print" style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <button className="btn"
                      onClick={()=>{ setBuka(terbuka?null:r.id); if(!terbuka) setTab(n.isi.produk?"layak":"produk"); }}
                      title={terbuka?"Tutup":"Buka enam tahap perencanaan"}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px",
                        borderRadius:8, fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                        background: terbuka ? C.surf : C.teal, color: terbuka ? C.sub : "#fff" }}>
                      {terbuka?<><ChevronUp size={14}/> Tutup</>:<><ChevronDown size={14}/> Rincian</>}</button>
                    <button className="btn" onClick={()=>bukaTaut(r)} title="Tautkan akun COA"
                      style={{ background:"transparent", color:tertaut>0?C.pos:C.brass,
                        display:"grid", placeItems:"center", padding:4 }}><Link2 size={15} /></button>
                    <button className="btn" onClick={()=>mulaiEdit(r)} title="Ubah identitas & strategi"
                      style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:4 }}>
                      <Pencil size={15} /></button>
                    <button className="btn" onClick={()=>hapus(r)} title="Hapus"
                      style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:4 }}>
                      <Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
                  gap:1, background:C.line, borderTop:`1px solid ${C.line}` }}>
                  <KpiMini l="Omzet / bulan (proyeksi)" v={n.omzetBln>0?money(n.omzetBln):"—"} />
                  <KpiMini l="Laba / bulan (proyeksi)"
                    v={n.omzetBln>0||n.biayaBln>0?money(n.labaBln):"—"}
                    c={n.labaBln>=0?C.pos:C.neg} />
                  <KpiMini l="Balik modal" v={n.bep===null?"—":`${n.bep.toFixed(1)} bln`} />
                  <KpiMini l="Laba aktual (tahun ini)"
                    v={rel.ada?money(rel.aLaba):"belum ada"}
                    c={rel.ada?(rel.aLaba>=0?C.pos:C.neg):C.sub} />
                </div>

                {terbuka && (
                  <div className="pop" style={{ borderTop:`1px solid ${C.line}` }}>
                    <div className="no-print scroll-x" style={{ display:"flex", gap:2, padding:"10px 14px 0",
                      borderBottom:`1px solid ${C.line}` }}>
                      {TAHAP.map(t=>{
                        const aktifTab = tab===t.k;
                        const terisi = t.k==="layak" ? n.adaRincian : n.isi[t.k];
                        return (
                          <button key={t.k} className="btn" onClick={()=>setTab(t.k)}
                            style={{ display:"flex", alignItems:"center", gap:6,
                              padding:"8px 13px", borderRadius:"8px 8px 0 0", fontSize:12.5,
                              fontWeight:aktifTab?700:500, whiteSpace:"nowrap",
                              background:aktifTab?C.surf:"transparent",
                              color:aktifTab?C.deep:C.sub,
                              borderBottom:aktifTab?`2px solid ${C.teal}`:"2px solid transparent" }}>
                            <span style={{ width:17, height:17, borderRadius:99, fontSize:9.5,
                              fontWeight:700, display:"grid", placeItems:"center",
                              background: terisi ? C.pos : (aktifTab?C.teal:C.line),
                              color:"#fff" }}>{terisi ? "✓" : t.n}</span>
                            {t.l}</button>
                        );
                      })}
                    </div>

                    <div style={{ padding:"16px 18px" }}>
                      {tab==="strategi" && <TabStrategi r={r} n={n} mulaiEdit={mulaiEdit}
                                             onChange={reload} busy={busy} setBusy={setBusy}
                                             setFlash={setFlash} />}
                      {tab==="produk"   && <TabProduk r={r} n={n} onChange={reload} busy={busy}
                                             setBusy={setBusy} setFlash={setFlash} />}
                      {tab==="jual"     && <TabKanal r={r} n={n} onChange={reload} busy={busy}
                                             setBusy={setBusy} setFlash={setFlash} />}
                      {tab==="pasar"    && <TabPemasaran r={r} n={n} onChange={reload} busy={busy}
                                             setBusy={setBusy} setFlash={setFlash} />}
                      {tab==="anggaran" && <TabAnggaran r={r} n={n} onChange={reload} busy={busy}
                                             setBusy={setBusy} setFlash={setFlash} />}
                      {tab==="layak"    && <TabKelayakan r={r} n={n} rel={rel} danaTersedia={danaTersedia}
                                             tertaut={tertaut} ubahStatus={ubahStatus} onChange={reload}
                                             busy={busy} setBusy={setBusy} setFlash={setFlash} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize:11.5, color:C.sub, marginTop:14, lineHeight:1.65 }}>
          <b>Urutan pengisian:</b> tahap 1 menetapkan apa dan kenapa; tahap 2–4 merinci produk,
          tempat jualan, dan cara memasarkan; tahap 5 menjumlahkan semuanya jadi anggaran modal
          awal dan biaya bulanan; tahap 6 menunjukkan apakah rencananya layak dan dananya cukup.
          <b> Modal dan proyeksi laba tidak pernah diketik manual</b> — semuanya hasil penjumlahan,
          jadi begitu satu angka diubah, seluruh kesimpulannya ikut menyesuaikan.
        </div>
      </>}

      {tautFor && (
        <div className="no-print" onClick={()=>setTautFor(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,42,42,.45)", display:"grid",
            placeItems:"center", zIndex:50, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} className="pop"
            style={{ background:"#fff", borderRadius:14, width:"min(620px,100%)", maxHeight:"82vh",
              overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, position:"sticky",
              top:0, background:"#fff", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>Tautkan Akun</div>
                <div style={{ fontSize:12.5, color:C.sub }}>{tautFor.name}</div>
              </div>
              <button className="btn" onClick={()=>setTautFor(null)}
                style={{ background:"transparent", color:C.sub }}><X size={18} /></button>
            </div>
            <div style={{ padding:"14px 20px", fontSize:12.5, color:C.sub, lineHeight:1.6,
              background:C.surf, borderBottom:`1px solid ${C.line}` }}>
              Pilih akun pendapatan, biaya, dan aset yang memang milik rencana ini. Realisasinya
              akan dihitung dari transaksi ke akun-akun tersebut. Kalau akunnya belum ada, buat dulu
              di menu <b>Chart of Account</b>.
            </div>
            <div style={{ padding:"8px 0" }}>
              {akunBisaTaut.length===0 && (
                <div style={{ padding:"18px 20px", fontSize:13, color:C.sub }}>
                  Tidak ada akun yang bisa ditautkan.</div>
              )}
              {akunBisaTaut.map(a=>{
                const pilih = tautPilih.includes(a.id);
                return (
                  <button key={a.id} className="btn"
                    onClick={()=>setTautPilih(pilih
                      ? tautPilih.filter(x=>x!==a.id)
                      : [...tautPilih, a.id])}
                    style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center",
                      gap:10, padding:"9px 20px", borderBottom:`1px solid ${C.line}`,
                      background: pilih ? C.teal+"0D" : "transparent" }}>
                    <span style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                      border:`2px solid ${pilih?C.teal:C.line}`, background:pilih?C.teal:"transparent",
                      display:"grid", placeItems:"center" }}>
                      {pilih && <Check size={12} color="#fff" strokeWidth={3} />}</span>
                    <span className="mono" style={{ fontSize:12, fontWeight:600, color:C.deep, width:78 }}>{a.code}</span>
                    <span style={{ fontSize:13, flex:1 }}>{a.name}</span>
                    <span style={{ fontSize:10.5, color:C.sub }}>{a.type}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.line}`, position:"sticky",
              bottom:0, background:"#fff" }}>
              <button className="btn" onClick={simpanTaut} disabled={busy}
                style={{ width:"100%", padding:"11px", borderRadius:9, background:C.teal,
                  color:"#fff", fontWeight:700, fontSize:14 }}>
                {busy?"Menyimpan…":`Simpan ${tautPilih.length} Akun Tertaut`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Tahap 1: Strategi + SWOT ================= */
function TabStrategi({ r, n, mulaiEdit, onChange, busy, setBusy, setFlash }) {
  const kosong = (kind) => ({ kind:kind||"strength", text:"", impact:"2", action:"" });
  const [form, setForm] = useState(kosong());
  const [edit, setEdit] = useState(null);

  const isi = (s) => {
    setEdit(s.id);
    setForm({ kind:s.kind||"strength", text:s.text||"",
      impact:String(Number(s.impact)||2), action:s.action||"" });
  };

  const simpan = async () => {
    if (!form.text.trim()) { setFlash("✗ Isi butir SWOT dulu"); return; }
    setBusy(true); setFlash("");
    try {
      const v = { ...form, impact:+form.impact||2 };
      if (edit && edit!=="baru") await updateSwot(edit, v);
      else await addSwot(r.id, v);
      setFlash("✓ Butir SWOT tersimpan"); setEdit(null); setForm(kosong(form.kind)); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (s) => {
    if (!confirm("Hapus butir SWOT ini?")) return;
    try { await deleteSwot(s.id); onChange(); } catch(err){ alert(err.message); }
  };

  const butir = (kind) => n.swot.filter(s=>s.kind===kind);
  const pos = n.posisi;

  const Kuadran = ({ kind }) => {
    const d = SWOT[kind];
    const daftar = butir(kind);
    return (
      <div style={{ border:`1px solid ${C.line}`, borderTop:`3px solid ${d.tone}`,
        borderRadius:11, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"11px 14px", background:d.tone+"0D" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:21, height:21, borderRadius:6, background:d.tone, color:"#fff",
              display:"grid", placeItems:"center", fontSize:11, fontWeight:800 }}>{d.singkat}</span>
            <span style={{ fontWeight:700, fontSize:13.5 }}>{d.label}</span>
            <span style={{ fontSize:10, color:C.sub, textTransform:"uppercase",
              letterSpacing:".04em" }}>{d.sisi}</span>
            <span className="mono" style={{ marginLeft:"auto", fontSize:11.5, color:C.sub }}>
              {daftar.length}</span>
          </div>
          <div style={{ fontSize:11, color:C.sub, marginTop:4 }}>{d.ket}</div>
        </div>
        <div style={{ flex:1 }}>
          {daftar.length===0 && (
            <div style={{ padding:"14px", fontSize:11.5, color:C.sub, fontStyle:"italic",
              lineHeight:1.5 }}>{d.contoh}</div>
          )}
          {daftar.map(s=>(
            <div key={s.id} style={{ padding:"10px 14px", borderTop:`1px solid ${C.line}` }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                <span style={{ fontSize:12.5, color:C.ink, lineHeight:1.55, flex:1 }}>{s.text}</span>
                <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 7px", borderRadius:20,
                  background:d.tone+"18", color:d.tone, whiteSpace:"nowrap" }}>
                  {BOBOT[Number(s.impact)||2]}</span>
                <span className="no-print" style={{ display:"flex", gap:2 }}>
                  <button className="btn" onClick={()=>isi(s)} title="Ubah"
                    style={{ background:"transparent", color:C.sub, padding:1 }}><Pencil size={12} /></button>
                  <button className="btn" onClick={()=>hapus(s)} title="Hapus"
                    style={{ background:"transparent", color:C.sub, padding:1 }}><Trash2 size={12} /></button>
                </span>
              </div>
              {s.action && (
                <div style={{ fontSize:11.5, color:C.sub, marginTop:5, paddingLeft:10,
                  borderLeft:`2px solid ${d.tone}40`, lineHeight:1.5 }}>
                  <b style={{ color:d.tone }}>Tindak lanjut:</b> {s.action}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <TahapHead no={1} judul="Strategi & Analisis SWOT"
        ket="Dasar pengambilan keputusan — apa yang dibangun, untuk siapa, dan apa risikonya." />

      {r.description ? (
        <div style={{ fontSize:13, lineHeight:1.75, color:C.ink, whiteSpace:"pre-wrap",
          border:`1px solid ${C.line}`, borderRadius:11, padding:"14px 16px" }}>
          {r.description}</div>
      ) : (
        <Kosong teks="Latar belakang dan strategi belum diisi. Tanpa ini, angka di tahap berikutnya kehilangan konteks — kenapa harganya segitu, kenapa jualnya di sana." />
      )}

      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
        gap:12, marginTop:14 }}>
        <Cell2 l="Kategori" v={r.category||"—"} bold />
        <Cell2 l="Cabang terkait" v={r.branch||"Lintas cabang"} bold />
        <Cell2 l="Target mulai" v={r.start_date||"Belum ditentukan"} bold />
      </div>
      <button className="btn no-print" onClick={()=>mulaiEdit(r)}
        style={{ display:"flex", alignItems:"center", gap:6, marginTop:14, background:C.surf,
          color:C.deep, padding:"9px 15px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
        <Pencil size={14} /> Ubah strategi</button>

      {/* ---------- SWOT ---------- */}
      <div style={{ marginTop:22, paddingTop:18, borderTop:`1px solid ${C.line}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          gap:10, flexWrap:"wrap", marginBottom:14 }}>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>Analisis SWOT</div>
            <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.55, marginTop:3 }}>
              Dua baris atas melihat ke dalam usaha, dua baris bawah melihat keadaan di luar.
              Beri bobot tiap butir — bobot itu yang menentukan posisi strategisnya.
            </div>
          </div>
          <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong()); }}
            style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.teal,
              color:edit?C.sub:"#fff", padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
            {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Butir</>}</button>
        </div>

        {edit && (
          <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
            borderRadius:11, padding:16, marginBottom:14 }}>
            <label style={lbl}>Masuk kategori mana</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7, marginBottom:12 }}>
              {Object.entries(SWOT).map(([k,d])=>{
                const pilih = form.kind===k;
                return (
                  <button key={k} className="btn" onClick={()=>setForm({...form,kind:k})}
                    style={{ padding:"9px 6px", borderRadius:8, fontSize:11.5, fontWeight:700,
                      background: pilih ? d.tone : C.surf, color: pilih ? "#fff" : C.sub,
                      display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <span style={{ fontSize:13, fontWeight:800 }}>{d.singkat}</span>
                    {d.label}</button>
                );
              })}
            </div>

            <label style={lbl}>Butir {SWOT[form.kind].label.toLowerCase()}</label>
            <input placeholder={SWOT[form.kind].contoh.replace("mis. ","")} value={form.text}
              onChange={e=>setForm({...form,text:e.target.value})} style={{ ...inp, marginBottom:10 }} />

            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:10, marginBottom:12 }}>
              <div><label style={lbl}>Bobot pengaruh</label>
                <select value={form.impact} onChange={e=>setForm({...form,impact:e.target.value})}
                  style={{ ...inp, fontWeight:600 }}>
                  <option value="1">Kecil</option>
                  <option value="2">Sedang</option>
                  <option value="3">Besar</option></select></div>
              <div><label style={lbl}>Tindak lanjut (disarankan diisi)</label>
                <input placeholder={form.kind==="strength" ? "mis. pakai basis siswa untuk pre-order batch pertama"
                  : form.kind==="weakness" ? "mis. pakai jasa desainer lepas untuk 5 desain awal"
                  : form.kind==="opportunity" ? "mis. buka toko Shopee sebelum musim liburan"
                  : "mis. tekankan desain eksklusif per angkatan, bukan adu harga"}
                  value={form.action} onChange={e=>setForm({...form,action:e.target.value})} style={inp} /></div>
            </div>

            <button className="btn" onClick={simpan} disabled={busy||!form.text.trim()}
              style={{ width:"100%", padding:"10px", borderRadius:9,
                background:(form.text.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
                color:"#fff", fontWeight:700, fontSize:13.5 }}>
              {busy?"Menyimpan…":(edit==="baru"?"Simpan Butir":"Simpan Perubahan")}</button>
          </div>
        )}

        <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Kuadran kind="strength" />
          <Kuadran kind="weakness" />
          <Kuadran kind="opportunity" />
          <Kuadran kind="threat" />
        </div>

        {/* posisi strategis */}
        {pos.cukup ? (
          <div style={{ marginTop:14, border:`1px solid ${pos.tone}40`, borderLeft:`4px solid ${pos.tone}`,
            borderRadius:11, background:pos.tone+"08", padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap", marginBottom:8 }}>
              <span style={{ fontSize:12.5, color:C.sub }}>Posisi strategis:</span>
              <span style={{ fontWeight:800, fontSize:15, color:pos.tone }}>{pos.nama}</span>
              <span className="mono" style={{ marginLeft:"auto", fontSize:11.5, color:C.sub }}>
                internal {pos.internal>=0?"+":""}{pos.internal} · eksternal {pos.eksternal>=0?"+":""}{pos.eksternal}
              </span>
            </div>
            <div style={{ fontSize:12.5, color:C.ink, lineHeight:1.65, marginBottom:10 }}>{pos.saran}</div>
            <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {Object.entries(SWOT).map(([k,d])=>{
                const skor = k==="strength"?pos.S : k==="weakness"?pos.W
                  : k==="opportunity"?pos.O : pos.T;
                return (
                  <div key={k} style={{ fontSize:11 }}>
                    <div style={{ color:C.sub }}>{d.label}</div>
                    <div className="mono" style={{ fontSize:14, fontWeight:700, color:d.tone }}>{skor}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:10.5, color:C.sub, marginTop:10, lineHeight:1.5, fontStyle:"italic" }}>
              Skor = jumlah bobot tiap butir (kecil 1, sedang 2, besar 3). Internal = kekuatan − kelemahan,
              eksternal = peluang − ancaman. Posisi ini bahan pertimbangan, bukan vonis — yang menentukan
              tetap penilaianmu atas lapangan.
            </div>
          </div>
        ) : n.swot.length > 0 ? (
          <div style={{ marginTop:14, padding:"11px 14px", borderRadius:9, background:C.surf,
            fontSize:12.5, color:C.sub, lineHeight:1.55 }}>
            Tambahkan minimal dua butir supaya posisi strategisnya bisa dibaca. Idealnya setiap kuadran
            punya isi, supaya gambarannya tidak berat sebelah.
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ================= Tahap 2: Produk ================= */
function TabProduk({ r, n, onChange, busy, setBusy, setFlash }) {
  const kosong = () => ({ name:"", variant:"", unit:"pcs", material:"", vendor:"",
    vendor_contact:"", cost_unit:"", price_unit:"", qty_initial:"", qty_month:"", notes:"" });
  const [form, setForm] = useState(kosong());
  const [edit, setEdit] = useState(null);

  const isi = (p) => {
    setEdit(p.id);
    setForm({ name:p.name||"", variant:p.variant||"", unit:p.unit||"pcs",
      material:p.material||"", vendor:p.vendor||"", vendor_contact:p.vendor_contact||"",
      cost_unit:String(Math.round(Number(p.cost_unit)||0)||""),
      price_unit:String(Math.round(Number(p.price_unit)||0)||""),
      qty_initial:String(Number(p.qty_initial)||""),
      qty_month:String(Number(p.qty_month)||""), notes:p.notes||"" });
  };

  const simpan = async () => {
    if (!form.name.trim()) { setFlash("✗ Nama produk wajib diisi"); return; }
    setBusy(true); setFlash("");
    const v = { ...form, cost_unit:+form.cost_unit||0, price_unit:+form.price_unit||0,
      qty_initial:+form.qty_initial||0, qty_month:+form.qty_month||0 };
    try {
      if (edit && edit!=="baru") await updateProduct(edit, v);
      else await addProduct(r.id, v);
      setFlash("✓ Produk tersimpan"); setEdit(null); setForm(kosong()); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (p) => {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    try { await deleteProduct(p.id); onChange(); } catch(err){ alert(err.message); }
  };

  const cu = +form.cost_unit||0, pu = +form.price_unit||0;
  const marginUnit = pu - cu;
  const marginPct = pu > 0 ? marginUnit/pu : null;

  return (
    <>
      <TahapHead no={2} judul="Produk & Harga Pokok"
        ket="Rinci tiap produk: bahan, vendor, harga produksi, rencana harga jual, dan targetnya." />

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong()); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.teal,
            color:edit?C.sub:"#fff", padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Produk</>}</button>
      </div>

      {edit && (
        <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
          borderRadius:11, padding:16, marginBottom:14 }}>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Nama Produk</label>
              <input placeholder="mis. Kaos Latihan Samudra" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Varian</label>
              <input placeholder="mis. S / M / L — Navy" value={form.variant}
                onChange={e=>setForm({...form,variant:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Satuan</label>
              <input placeholder="pcs" value={form.unit}
                onChange={e=>setForm({...form,unit:e.target.value})} style={inp} /></div>
          </div>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Bahan / Spesifikasi</label>
              <input placeholder="mis. Cotton combed 30s, sablon DTF" value={form.material}
                onChange={e=>setForm({...form,material:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Vendor / Konveksi</label>
              <input placeholder="mis. Konveksi Jaya Bandung" value={form.vendor}
                onChange={e=>setForm({...form,vendor:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Kontak Vendor</label>
              <input placeholder="mis. 0812xxxx / @ig" value={form.vendor_contact}
                onChange={e=>setForm({...form,vendor_contact:e.target.value})} style={inp} /></div>
          </div>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Harga Produksi / unit</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.cost_unit}
                onChange={e=>setForm({...form,cost_unit:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Harga Jual / unit</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.price_unit}
                onChange={e=>setForm({...form,price_unit:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Produksi Awal (qty)</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.qty_initial}
                onChange={e=>setForm({...form,qty_initial:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Target Jual / bulan (qty)</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.qty_month}
                onChange={e=>setForm({...form,qty_month:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
          </div>
          <label style={lbl}>Catatan</label>
          <input placeholder="mis. minimum order 50 pcs, waktu produksi 10 hari" value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})} style={{ ...inp, marginBottom:12 }} />

          {pu>0 && (
            <div style={{ background:C.surf, borderRadius:9, padding:"10px 13px", marginBottom:12, fontSize:12.5 }}>
              <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                <Cell2 l="Margin / unit" v={money(marginUnit)} bold />
                <Cell2 l="Margin %" v={marginPct===null?"—":pct(marginPct)} bold />
                <Cell2 l="Modal stok awal" v={money(cu*(+form.qty_initial||0))} bold />
                <Cell2 l="Omzet / bulan" v={money(pu*(+form.qty_month||0))} bold />
              </div>
              {marginUnit<=0 && (
                <div style={{ marginTop:8, color:C.neg, fontSize:12 }}>
                  Harga jual belum menutup harga produksi — produk ini rugi per unitnya.</div>
              )}
              {marginPct!==null && marginPct>0 && marginPct<0.25 && (
                <div style={{ marginTop:8, color:C.brass, fontSize:12 }}>
                  Margin {pct(marginPct)} tergolong tipis untuk produk fisik. Potongan marketplace
                  dan ongkos kirim bisa menggerusnya lagi.</div>
              )}
            </div>
          )}

          <button className="btn" onClick={simpan} disabled={busy||!form.name.trim()}
            style={{ width:"100%", padding:"10px", borderRadius:9,
              background:(form.name.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
              color:"#fff", fontWeight:700, fontSize:13.5 }}>
            {busy?"Menyimpan…":(edit==="baru"?"Simpan Produk":"Simpan Perubahan")}</button>
        </div>
      )}

      {n.produk.length===0 && !edit && (
        <Kosong teks="Belum ada produk. Untuk rencana non-produk seperti cabang baru, tahap ini boleh dilewati — langsung ke tahap 5 Anggaran." />
      )}

      {n.produk.length>0 && <>
        <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 100px 100px 80px 70px 100px 70px",
            padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10, fontWeight:600 }}>
            <span>PRODUK</span><span>BAHAN / VENDOR</span>
            <span style={{ textAlign:"right" }}>PRODUKSI</span>
            <span style={{ textAlign:"right" }}>JUAL</span>
            <span style={{ textAlign:"center" }}>MARGIN</span>
            <span style={{ textAlign:"center" }}>STOK</span>
            <span style={{ textAlign:"right" }}>OMZET/BLN</span>
            <span style={{ textAlign:"center" }}>AKSI</span>
          </div>
          {n.produk.map(p=>{
            const c = Number(p.cost_unit)||0, pr = Number(p.price_unit)||0;
            const m = pr - c, mp = pr>0 ? m/pr : null;
            return (
              <div key={p.id} style={{ display:"grid",
                gridTemplateColumns:"1.6fr 1.2fr 100px 100px 80px 70px 100px 70px",
                padding:"10px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                <span>
                  <b style={{ color:C.deep }}>{p.name}</b>
                  {p.variant && <span style={{ color:C.sub }}> · {p.variant}</span>}
                  {p.notes && <div style={{ fontSize:10.5, color:C.sub, marginTop:2 }}>{p.notes}</div>}
                </span>
                <span style={{ fontSize:11, color:C.sub, lineHeight:1.4 }}>
                  {p.material || "—"}
                  {p.vendor && <div style={{ marginTop:2 }}>{p.vendor}
                    {p.vendor_contact && <span style={{ color:C.line }}> · {p.vendor_contact}</span>}</div>}
                </span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(c)}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(pr)}</span>
                <span className="mono" style={{ textAlign:"center", fontWeight:700,
                  color:m>0?C.pos:C.neg }}>{mp===null?"—":pct(mp)}</span>
                <span className="mono" style={{ textAlign:"center", color:C.sub }}>
                  {Number(p.qty_initial)||0}</span>
                <span className="mono" style={{ textAlign:"right", color:C.teal, fontWeight:600 }}>
                  {money(pr*(Number(p.qty_month)||0))}</span>
                <span className="no-print" style={{ display:"flex", gap:3, justifyContent:"center" }}>
                  <button className="btn" onClick={()=>isi(p)} title="Ubah"
                    style={{ background:"transparent", color:C.sub, padding:2 }}><Pencil size={13} /></button>
                  <button className="btn" onClick={()=>hapus(p)} title="Hapus"
                    style={{ background:"transparent", color:C.sub, padding:2 }}><Trash2 size={13} /></button>
                </span>
              </div>
            );
          })}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 100px 100px 80px 70px 100px 70px",
            padding:"11px 14px", background:C.surf, fontSize:12, fontWeight:700 }}>
            <span>TOTAL</span><span></span><span></span><span></span><span></span>
            <span className="mono" style={{ textAlign:"center" }}>{money(n.stokAwal)}</span>
            <span className="mono" style={{ textAlign:"right", color:C.teal }}>{money(n.omzetProduk)}</span>
            <span></span>
          </div>
        </div>
        <div style={{ fontSize:11.5, color:C.sub, marginTop:10, lineHeight:1.55 }}>
          Kolom <b>STOK</b> menampilkan modal stok awal ({money(n.stokAwal)}) — angka ini masuk ke
          anggaran modal di tahap 5. Omzet bulanan {money(n.omzetProduk)} menjadi dasar proyeksi
          pendapatan.
        </div>
      </>}
    </>
  );
}

/* ================= Tahap 3: Kanal penjualan ================= */
function TabKanal({ r, n, onChange, busy, setBusy, setFlash }) {
  const kosong = () => ({ name:"", kind:"marketplace", fee_pct:"", share_pct:"",
    status:"rencana", notes:"" });
  const [form, setForm] = useState(kosong());
  const [edit, setEdit] = useState(null);

  const isi = (c) => {
    setEdit(c.id);
    setForm({ name:c.name||"", kind:c.kind||"marketplace",
      fee_pct:String(Number(c.fee_pct)||""), share_pct:String(Number(c.share_pct)||""),
      status:c.status||"rencana", notes:c.notes||"" });
  };

  const simpan = async () => {
    if (!form.name.trim()) { setFlash("✗ Nama kanal wajib diisi"); return; }
    setBusy(true); setFlash("");
    const v = { ...form, fee_pct:+form.fee_pct||0, share_pct:+form.share_pct||0 };
    try {
      if (edit && edit!=="baru") await updateChannel(edit, v);
      else await addChannel(r.id, v);
      setFlash("✓ Kanal tersimpan"); setEdit(null); setForm(kosong()); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (c) => {
    if (!confirm(`Hapus kanal "${c.name}"?`)) return;
    try { await deleteChannel(c.id); onChange(); } catch(err){ alert(err.message); }
  };

  const pilihNama = (nama) => {
    const saran = SARAN_FEE[nama];
    setForm(f=>({ ...f, name:nama, fee_pct: saran!==undefined ? String(saran) : f.fee_pct }));
  };

  const shareOk = n.totalShare === 0 || Math.abs(n.totalShare - 100) < 0.5;

  return (
    <>
      <TahapHead no={3} judul="Kanal Penjualan"
        ket="Di mana produk dijual dan berapa potongan tiap platform — potongan ini ikut jadi biaya." />

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong()); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.teal,
            color:edit?C.sub:"#fff", padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Kanal</>}</button>
      </div>

      {edit && (
        <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
          borderRadius:11, padding:16, marginBottom:14 }}>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Nama Kanal</label>
              <input placeholder="mis. Shopee" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} />
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:6 }}>
                {Object.keys(SARAN_FEE).map(nm=>(
                  <button key={nm} className="btn" onClick={()=>pilihNama(nm)}
                    style={{ padding:"4px 9px", borderRadius:20, fontSize:10.5, fontWeight:600,
                      background:C.surf, color:C.sub }}>{nm}</button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Jenis</label>
              <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})} style={inp}>
                {Object.entries(JENIS_KANAL).map(([k,v])=>
                  <option key={k} value={k}>{v.label} — {v.contoh}</option>)}</select></div>
          </div>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Potongan platform (%)</label>
              <input className="mono" inputMode="decimal" placeholder="0" value={form.fee_pct}
                onChange={e=>setForm({...form,fee_pct:e.target.value.replace(/[^\d.]/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Perkiraan porsi penjualan (%)</label>
              <input className="mono" inputMode="decimal" placeholder="0" value={form.share_pct}
                onChange={e=>setForm({...form,share_pct:e.target.value.replace(/[^\d.]/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={inp}>
                <option value="rencana">Rencana</option>
                <option value="aktif">Aktif</option>
                <option value="ditutup">Ditutup</option></select></div>
          </div>
          <label style={lbl}>Catatan / strategi kanal</label>
          <input placeholder="mis. gratis ongkir minimal 2 pcs, ikut kampanye tanggal kembar" value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})} style={{ ...inp, marginBottom:12 }} />
          <button className="btn" onClick={simpan} disabled={busy||!form.name.trim()}
            style={{ width:"100%", padding:"10px", borderRadius:9,
              background:(form.name.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
              color:"#fff", fontWeight:700, fontSize:13.5 }}>
            {busy?"Menyimpan…":(edit==="baru"?"Simpan Kanal":"Simpan Perubahan")}</button>
        </div>
      )}

      {n.kanal.length===0 && !edit && (
        <Kosong teks="Belum ada kanal penjualan. Tambahkan Shopee, TikTok Shop, Instagram, atau penjualan langsung saat kelas." />
      )}

      {n.kanal.length>0 && <>
        <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr 90px 90px 110px 70px",
            padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10, fontWeight:600 }}>
            <span>KANAL</span><span>JENIS</span>
            <span style={{ textAlign:"center" }}>POTONGAN</span>
            <span style={{ textAlign:"center" }}>PORSI</span>
            <span style={{ textAlign:"right" }}>OMZET/BLN</span>
            <span style={{ textAlign:"center" }}>AKSI</span>
          </div>
          {n.kanal.map(c=>{
            const jk = JENIS_KANAL[c.kind] || JENIS_KANAL.marketplace;
            const share = Number(c.share_pct)||0;
            return (
              <div key={c.id} style={{ display:"grid",
                gridTemplateColumns:"1.3fr 1fr 90px 90px 110px 70px",
                padding:"10px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                <span>
                  <b style={{ color:C.deep }}>{c.name}</b>
                  {c.status!=="rencana" && <span style={{ fontSize:9.5, fontWeight:700, marginLeft:6,
                    padding:"1px 6px", borderRadius:20,
                    background:(c.status==="aktif"?C.pos:C.neg)+"18",
                    color:c.status==="aktif"?C.pos:C.neg }}>{c.status.toUpperCase()}</span>}
                  {c.notes && <div style={{ fontSize:10.5, color:C.sub, marginTop:2 }}>{c.notes}</div>}
                </span>
                <span style={{ fontSize:11, color:jk.tone, fontWeight:600 }}>{jk.label}</span>
                <span className="mono" style={{ textAlign:"center",
                  color:Number(c.fee_pct)>0?C.neg:C.sub }}>{Number(c.fee_pct)||0}%</span>
                <span className="mono" style={{ textAlign:"center" }}>{share}%</span>
                <span className="mono" style={{ textAlign:"right", color:C.teal, fontWeight:600 }}>
                  {n.omzetBln>0?money(n.omzetBln*share/100):"—"}</span>
                <span className="no-print" style={{ display:"flex", gap:3, justifyContent:"center" }}>
                  <button className="btn" onClick={()=>isi(c)} title="Ubah"
                    style={{ background:"transparent", color:C.sub, padding:2 }}><Pencil size={13} /></button>
                  <button className="btn" onClick={()=>hapus(c)} title="Hapus"
                    style={{ background:"transparent", color:C.sub, padding:2 }}><Trash2 size={13} /></button>
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:12, padding:"11px 14px", borderRadius:9, fontSize:12.5,
          lineHeight:1.6, color:C.ink,
          background: shareOk ? C.surf : C.brass+"10",
          border: shareOk ? "none" : `1px solid ${C.brass}40` }}>
          {!shareOk && <>Porsi penjualan semua kanal berjumlah <b>{n.totalShare}%</b>, bukan 100%.
            Sesuaikan agar perhitungan potongan platform akurat. </>}
          {n.omzetBln>0 && <>Potongan platform efektif <b>{pct(n.feePctEfektif)}</b> dari omzet,
            atau sekitar <b>{money(n.feeBln)}</b> per bulan — ikut masuk ke biaya bulanan di tahap 5.</>}
          {n.omzetBln===0 && <>Isi target jual per bulan di tahap 2 untuk melihat perkiraan omzet per kanal.</>}
        </div>
      </>}

      <BagianDiskon r={r} n={n} onChange={onChange} busy={busy}
        setBusy={setBusy} setFlash={setFlash} />
    </>
  );
}

/* ---- Skema diskon, bagian kedua di tahap 3 ---- */
function BagianDiskon({ r, n, onChange, busy, setBusy, setFlash }) {
  const kosong = () => ({ name:"", kind:"persen", value:"", min_qty:"2", free_qty:"1",
    product_id:"", channel_id:"", share_pct:"", period:"", note:"", active:true });
  const [form, setForm] = useState(kosong());
  const [edit, setEdit] = useState(null);
  const [marginTarget, setMarginTarget] = useState(10);   // margin minimum yang ingin dijaga (%)

  const isi = (d) => {
    setEdit(d.id);
    setForm({ name:d.name||"", kind:d.kind||"persen",
      value:String(Math.round(Number(d.value)||0)||""),
      min_qty:String(Number(d.min_qty)||2), free_qty:String(Number(d.free_qty)||1),
      product_id:d.product_id||"", channel_id:d.channel_id||"",
      share_pct:String(Number(d.share_pct)||""), period:d.period||"",
      note:d.note||"", active:d.active!==false });
  };

  const simpan = async () => {
    if (!form.name.trim()) { setFlash("✗ Nama promo wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      const v = { ...form, value:+form.value||0, min_qty:+form.min_qty||1,
        free_qty:+form.free_qty||0, share_pct:+form.share_pct||0,
        product_id:form.product_id||null, channel_id:form.channel_id||null };
      if (edit && edit!=="baru") await updateDiscount(edit, v);
      else await addDiscount(r.id, v);
      setFlash("✓ Skema diskon tersimpan"); setEdit(null); setForm(kosong()); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (d) => {
    if (!confirm(`Hapus skema "${d.name}"?`)) return;
    try { await deleteDiscount(d.id); onChange(); } catch(err){ alert(err.message); }
  };

  // potongan platform yang berlaku untuk satu skema
  const feeUntuk = (d) => {
    if (d.channel_id) {
      const c = n.kanal.find(x=>x.id===d.channel_id);
      if (c) return (Number(c.fee_pct)||0)/100;
    }
    return n.feePctEfektif;
  };
  const produkUntuk = (d) => d.product_id
    ? n.produk.filter(p=>p.id===d.product_id)
    : n.produk;

  const mt = (+marginTarget||0)/100;
  const adaProduk = n.produk.length > 0;

  // ringkasan dampak seluruh promo aktif terhadap omzet & laba bulanan
  const dampak = n.diskon.filter(d=>d.active!==false).reduce((acc,d)=>{
    const f = feeUntuk(d), share = (Number(d.share_pct)||0)/100;
    if (share <= 0) return acc;
    produkUntuk(d).forEach(p=>{
      const qty = (Number(p.qty_month)||0) * share;
      if (qty <= 0) return;
      const h = hasilDiskon(p, d, f);
      acc.omzetTurun += ((Number(p.price_unit)||0) - h.hargaBaru) * qty;
      acc.labaTurun  += -h.selisihLaba * qty;
      acc.adaIsi = true;
    });
    return acc;
  }, { omzetTurun:0, labaTurun:0, adaIsi:false });

  return (
    <div style={{ marginTop:22, paddingTop:18, borderTop:`1px solid ${C.line}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
        gap:10, flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>Skema Diskon</div>
          <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.55, marginTop:3 }}>
            Diskon memotong harga jual, tapi harga produksi tidak ikut turun — dan potongan
            marketplace dihitung dari harga <i>setelah</i> diskon. Bagian ini menghitung sampai
            berapa persen diskon masih aman.
          </div>
        </div>
        <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong()); }}
          disabled={!adaProduk}
          style={{ display:"flex", alignItems:"center", gap:6,
            background:!adaProduk?C.line:(edit?C.surf:C.teal),
            color:!adaProduk?"#fff":(edit?C.sub:"#fff"),
            padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Skema</>}</button>
      </div>

      {!adaProduk && (
        <Kosong teks="Isi tahap 2 Produk dulu — batas diskon dihitung dari harga jual dan harga produksi tiap produk." />
      )}

      {adaProduk && <>
        {/* ---- Batas aman diskon per produk ---- */}
        <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:11,
          overflow:"hidden", marginBottom:14 }}>
          <div style={{ padding:"11px 14px", background:C.pos+"0D",
            borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center",
            gap:10, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontWeight:700, fontSize:12.5 }}>Batas Aman Diskon per Produk</div>
              <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>
                Sudah memperhitungkan potongan platform {pct(n.feePctEfektif)}
              </div>
            </div>
            <div className="no-print" style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontSize:11, color:C.sub }}>Margin minimum yang dijaga</span>
              <select value={marginTarget} onChange={e=>setMarginTarget(+e.target.value)}
                style={{ ...inp, width:"auto", padding:"5px 8px", fontSize:12, fontWeight:600 }}>
                {[0,5,10,15,20,25,30].map(v=><option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 95px 90px 90px 110px 80px 110px",
            padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10, fontWeight:600 }}>
            <span>PRODUK</span>
            <span style={{ textAlign:"right" }}>HARGA JUAL</span>
            <span style={{ textAlign:"right" }}>PRODUKSI</span>
            <span style={{ textAlign:"center" }}>DISKON AMAN</span>
            <span style={{ textAlign:"right" }}>HARGA SETELAHNYA</span>
            <span style={{ textAlign:"center" }}>IMPAS</span>
            <span style={{ textAlign:"right" }}>HARGA LANTAI</span>
          </div>
          {n.produk.map(p=>{
            const P = Number(p.price_unit)||0, Cc = Number(p.cost_unit)||0;
            const b = batasDiskon(P, Cc, n.feePctEfektif, mt);
            const lantai = (1-n.feePctEfektif) > 0 ? Cc/(1-n.feePctEfektif) : 0;
            const hargaAman = b.aman>0 ? P*(1-b.aman) : null;
            return (
              <div key={p.id} style={{ display:"grid",
                gridTemplateColumns:"1.4fr 95px 90px 90px 110px 80px 110px",
                padding:"10px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                <span><b style={{ color:C.deep }}>{p.name}</b>
                  {p.variant && <span style={{ color:C.sub }}> · {p.variant}</span>}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(P)}</span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(Cc)}</span>
                <span className="mono" style={{ textAlign:"center", fontWeight:700,
                  color: b.aman>0 ? C.pos : C.neg }}>
                  {b.aman===null||b.aman<=0 ? "—" : pct(b.aman)}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:700,
                  color: hargaAman ? C.pos : C.neg }}>
                  {hargaAman ? money(hargaAman) : "tak ada ruang"}</span>
                <span className="mono" style={{ textAlign:"center", fontWeight:600,
                  color: b.impas>0 ? C.brass : C.neg }}>
                  {b.impas===null||b.impas<=0 ? "—" : pct(b.impas)}</span>
                <span className="mono" style={{ textAlign:"right", color:C.brass, fontWeight:600 }}>
                  {money(lantai)}</span>
              </div>
            );
          })}
          <div style={{ padding:"11px 14px", fontSize:11.5, color:C.sub, lineHeight:1.6 }}>
            <b>Harga setelahnya</b> = harga jual terendah yang masih menyisakan margin {marginTarget}% —
            pakai angka ini sebagai patokan promo rutin. <b>Harga lantai</b> = harga saat impas, tidak
            untung tidak rugi; hanya untuk cuci gudang, dan itu pun belum menutup sewa serta biaya
            pemasaran bulanan.
          </div>
        </div>

        {/* ---- Simulasi promo siap pakai ---- */}
        {(()=>{
          const sim = PROMO_UMUM.map(pr=>{
            const hasil = n.produk.map(p=>({ p, h:hasilDiskon(p, pr, n.feePctEfektif) }));
            const rugi  = hasil.filter(x=>x.h.laba < 0);
            const tipis = hasil.filter(x=>x.h.laba >= 0 && x.h.margin < mt);
            const status = rugi.length ? { l:"RUGI", t:C.neg }
              : tipis.length ? { l:"TIPIS", t:C.brass } : { l:"AMAN", t:C.pos };
            const pot = potonganEfektif(pr, n.produk[0] ? Number(n.produk[0].price_unit)||0 : 0);
            const labaTerendah = hasil.length
              ? hasil.reduce((a,x)=> x.h.laba < a.h.laba ? x : a, hasil[0]) : null;
            return { pr, pot, status, rugi, tipis, labaTerendah, hasil };
          });
          const aman = sim.filter(s=>s.status.l==="AMAN");
          const palingAgresif = aman.length
            ? aman.reduce((a,s)=> s.pot > a.pot ? s : a, aman[0]) : null;
          const bogo = sim.find(s=>s.pr.nama.includes("BOGO"));

          return (
            <div style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"11px 14px", background:C.teal+"0D", borderBottom:`1px solid ${C.line}` }}>
                <div style={{ fontWeight:700, fontSize:12.5 }}>Simulasi Promo Siap Pakai</div>
                <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>
                  Promo yang biasa dipakai, diuji ke seluruh produkmu dengan margin minimum {marginTarget}%
                </div>
              </div>

              {palingAgresif ? (
                <div style={{ padding:"12px 14px", background:C.pos+"0D",
                  borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink, lineHeight:1.6 }}>
                  Promo paling menarik yang masih aman untuk semua produkmu:
                  <b style={{ color:C.pos }}> {palingAgresif.pr.nama}</b> — setara potongan {pct(palingAgresif.pot)}.
                  Lebih dari itu, margin {marginTarget}% tidak tercapai.
                </div>
              ) : (()=>{
                const tidakRugi = sim.filter(s=>s.status.l!=="RUGI");
                const terbaik = tidakRugi.length
                  ? tidakRugi.reduce((a,s)=> s.pot > a.pot ? s : a, tidakRugi[0]) : null;
                const marginNormal = n.produk.length
                  ? Math.min(...n.produk.map(p=>{
                      const P=Number(p.price_unit)||0, Cc=Number(p.cost_unit)||0;
                      return P>0 ? (P*(1-n.feePctEfektif)-Cc)/P : 0; })) : 0;
                return (
                  <div style={{ padding:"12px 14px", background:C.brass+"0D",
                    borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink, lineHeight:1.65 }}>
                    <b style={{ color:C.brass }}>Tidak ada promo standar yang menyisakan margin {marginTarget}%.</b>
                    {" "}Penyebabnya bukan promonya, tapi margin normalmu sendiri yang baru
                    <b> {pct(marginNormal)}</b> — begitu dipotong sedikit saja, sisanya langsung di bawah target.
                    {terbaik && <> Yang masih tidak rugi dan paling menarik: <b>{terbaik.pr.nama}</b> (setara
                      {" "}{pct(terbaik.pot)}), meski marginnya tipis.</>}
                    <div style={{ marginTop:8, paddingLeft:2 }}>
                      Tiga pilihan: turunkan margin minimum di atas supaya sesuai kenyataan; nego harga
                      produksi ke vendor dengan pesanan lebih besar; atau naikkan harga jual lebih dulu
                      sebelum memasang promo. Memaksakan promo dengan margin setipis ini membuat kerja
                      bertambah tanpa tambahan laba.
                    </div>
                  </div>
                );
              })()}

              <div className="scroll-x">
                <div style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 1fr 110px 80px",
                  padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10, fontWeight:600 }}>
                  <span>PROMO</span>
                  <span style={{ textAlign:"center" }}>SETARA</span>
                  <span style={{ textAlign:"right" }}>HARGA TERENDAH</span>
                  <span style={{ textAlign:"right" }}>LABA/UNIT TERENDAH</span>
                  <span style={{ textAlign:"center" }}>STATUS</span>
                </div>
                {sim.map((s,i)=>(
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 1fr 110px 80px",
                    padding:"8px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center",
                    background: s.status.l==="RUGI" ? C.neg+"06" : "transparent" }}>
                    <span style={{ color:C.ink }}>{s.pr.nama}</span>
                    <span className="mono" style={{ textAlign:"center", color:C.sub }}>{pct(s.pot)}</span>
                    <span className="mono" style={{ textAlign:"right" }}>
                      {s.labaTerendah ? money(s.labaTerendah.h.hargaBaru) : "—"}</span>
                    <span className="mono" style={{ textAlign:"right", fontWeight:600,
                      color: s.labaTerendah && s.labaTerendah.h.laba>=0 ? C.pos : C.neg }}>
                      {s.labaTerendah ? money(s.labaTerendah.h.laba) : "—"}</span>
                    <span style={{ textAlign:"center", fontSize:10, fontWeight:700,
                      color:s.status.t }}>{s.status.l}</span>
                  </div>
                ))}
              </div>

              {/* penjelasan strategi bundling */}
              {bogo && (
                <div style={{ padding:"13px 14px", fontSize:12.5, color:C.ink, lineHeight:1.7,
                  borderTop:`1px solid ${C.line}` }}>
                  <b>Cara membaca promo bundling.</b> Beli 1 gratis 1 berarti kamu menyerahkan 2 unit
                  tapi dibayar 1 — setara potongan 50%, dan ongkos produksi unit gratisnya tetap keluar.
                  Beli 2 gratis 1 setara 33%, beli 3 gratis 1 setara 25%, beli 4 gratis 1 setara 20%.
                  Makin banyak syarat belinya, makin ringan potongannya.
                  {bogo.status.l === "RUGI" ? (
                    <div style={{ marginTop:9, padding:"10px 12px", borderRadius:8,
                      background:C.neg+"0D", borderLeft:`3px solid ${C.neg}` }}>
                      <b style={{ color:C.neg }}>BOGO rugi untuk produkmu.</b> Marginmu belum cukup lebar
                      menanggung potongan 50%. Empat jalan keluar, berurutan dari yang paling masuk akal:
                      <div style={{ marginTop:7, paddingLeft:2 }}>
                        <div style={{ marginBottom:5 }}><b>1. Naikkan syarat belinya.</b> Ganti jadi
                          beli 3 gratis 1 atau beli 4 gratis 1 — pembeli tetap merasa dapat gratisan,
                          tapi potongannya tinggal 25% atau 20%.</div>
                        <div style={{ marginBottom:5 }}><b>2. Gratiskan barang yang murah, bukan yang sama.</b>
                          Beli kaos gratis topi, bukan beli kaos gratis kaos. Yang diberikan cukup item
                          bermodal kecil, sehingga potongan efektifnya jauh lebih ringan.</div>
                        <div style={{ marginBottom:5 }}><b>3. Perbaiki struktur harganya dulu.</b> Dengan
                          produksi {money(Number(n.produk[0]?.cost_unit)||0)} dan jual {money(Number(n.produk[0]?.price_unit)||0)},
                          marginmu memang tipis. Nego harga vendor di jumlah lebih besar, atau naikkan
                          harga jual sebelum memasang promo agresif.</div>
                        <div><b>4. Jangan pakai harga coret palsu.</b> Menaikkan harga normal hanya supaya
                          diskonnya terlihat besar akan ketahuan pembeli yang pernah beli sebelumnya, dan
                          di marketplace tercatat riwayat harganya.</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop:9, padding:"10px 12px", borderRadius:8,
                      background:C.pos+"0D", borderLeft:`3px solid ${C.pos}` }}>
                      <b style={{ color:C.pos }}>BOGO masih sanggup kamu jalankan</b> — laba per unit
                      terendah {money(bogo.labaTerendah?.h.laba||0)}. Tetap batasi periodenya, karena
                      promo sebesar ini melatih pembeli menunggu diskon berikutnya.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ---- Form skema ---- */}
        {edit && (
          <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
            borderRadius:11, padding:16, marginBottom:14 }}>
            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Nama Promo</label>
                <input placeholder="mis. Promo Peluncuran, Beli 2 Gratis 1" value={form.name}
                  onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
              <div><label style={lbl}>Jenis</label>
                <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})} style={inp}>
                  {Object.entries(JENIS_DISKON).map(([k,v])=>
                    <option key={k} value={k}>{v.label}</option>)}</select>
                <div style={{ fontSize:10.5, color:C.sub, marginTop:4 }}>
                  {JENIS_DISKON[form.kind].ket}</div></div>
            </div>

            {form.kind==="bundling" ? (
              <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Beli berapa unit</label>
                  <input className="mono" inputMode="numeric" placeholder="2" value={form.min_qty}
                    onChange={e=>setForm({...form,min_qty:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
                <div><label style={lbl}>Gratis berapa unit</label>
                  <input className="mono" inputMode="numeric" placeholder="1" value={form.free_qty}
                    onChange={e=>setForm({...form,free_qty:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
                <div><label style={lbl}>Setara diskon</label>
                  <div style={{ ...inp, display:"flex", alignItems:"center", fontWeight:700,
                    color:C.brass, background:C.surf }}>
                    {pct(potonganEfektif({ kind:"bundling", min_qty:+form.min_qty||1,
                      free_qty:+form.free_qty||0 }, 1))}</div></div>
              </div>
            ) : form.kind==="paket" ? (
              <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Isi paket (unit)</label>
                  <input className="mono" inputMode="numeric" placeholder="2" value={form.min_qty}
                    onChange={e=>setForm({...form,min_qty:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
                <div><label style={lbl}>Harga paket (Rp)</label>
                  <input className="mono" inputMode="numeric" placeholder="130000" value={form.value}
                    onChange={e=>setForm({...form,value:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
                <div><label style={lbl}>Setara diskon</label>
                  <div style={{ ...inp, display:"flex", alignItems:"center", fontWeight:700,
                    color:C.brass, background:C.surf }}>
                    {(()=>{
                      const p0 = n.produk.find(p=>p.id===form.product_id) || n.produk[0];
                      const P = Number(p0?.price_unit)||0;
                      return P>0 ? pct(potonganEfektif({ kind:"paket", value:+form.value||0,
                        min_qty:+form.min_qty||1 }, P)) : "—";
                    })()}</div></div>
              </div>
            ) : (
              <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Besaran ({JENIS_DISKON[form.kind].satuan})</label>
                  <input className="mono" inputMode="numeric"
                    placeholder={form.kind==="persen"?"15":"20000"} value={form.value}
                    onChange={e=>setForm({...form,value:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
                <div><label style={lbl}>Perkiraan porsi penjualan yang kena promo (%)</label>
                  <input className="mono" inputMode="numeric" placeholder="0" value={form.share_pct}
                    onChange={e=>setForm({...form,share_pct:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
              </div>
            )}

            {(form.kind==="bundling" || form.kind==="paket") && (
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Perkiraan porsi penjualan yang kena promo (%)</label>
                <input className="mono" inputMode="numeric" placeholder="0" value={form.share_pct}
                  onChange={e=>setForm({...form,share_pct:e.target.value.replace(/\D/g,"")})}
                  style={{ ...inp, maxWidth:220 }} /></div>
            )}

            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Berlaku untuk produk</label>
                <select value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} style={inp}>
                  <option value="">Semua produk</option>
                  {n.produk.map(p=><option key={p.id} value={p.id}>{p.name}{p.variant?` · ${p.variant}`:""}</option>)}
                </select></div>
              <div><label style={lbl}>Berlaku di kanal</label>
                <select value={form.channel_id} onChange={e=>setForm({...form,channel_id:e.target.value})} style={inp}>
                  <option value="">Semua kanal (potongan rata-rata)</option>
                  {n.kanal.map(c=><option key={c.id} value={c.id}>{c.name} · {Number(c.fee_pct)||0}%</option>)}
                </select></div>
              <div><label style={lbl}>Periode</label>
                <input placeholder="mis. Jan–Feb 2026" value={form.period}
                  onChange={e=>setForm({...form,period:e.target.value})} style={inp} /></div>
            </div>

            <label style={lbl}>Catatan / syarat</label>
            <input placeholder="mis. hanya untuk siswa aktif, maksimal 2 per orang" value={form.note}
              onChange={e=>setForm({...form,note:e.target.value})} style={{ ...inp, marginBottom:12 }} />

            {/* pratinjau dampak per produk */}
            {(()=>{
              const dSim = { kind:form.kind, value:+form.value||0,
                min_qty:+form.min_qty||1, free_qty:+form.free_qty||0 };
              const f = form.channel_id
                ? ((Number(n.kanal.find(c=>c.id===form.channel_id)?.fee_pct)||0)/100)
                : n.feePctEfektif;
              const sasaran = form.product_id ? n.produk.filter(p=>p.id===form.product_id) : n.produk;
              const rugi = sasaran.filter(p=>hasilDiskon(p, dSim, f).laba < 0);
              if (sasaran.length===0) return null;
              return (
                <div style={{ background: rugi.length?C.neg+"0D":C.surf, borderRadius:9,
                  padding:"11px 13px", marginBottom:12,
                  border: rugi.length?`1px solid ${C.neg}40`:"none" }}>
                  <div style={{ fontSize:10.5, color:C.sub, fontWeight:600, letterSpacing:".05em",
                    marginBottom:7 }}>DAMPAK KE TIAP PRODUK:</div>
                  {sasaran.map(p=>{
                    const h = hasilDiskon(p, dSim, f);
                    return (
                      <div key={p.id} style={{ display:"grid",
                        gridTemplateColumns:"1.3fr 100px 100px 90px", gap:8, fontSize:12,
                        padding:"4px 0", alignItems:"center" }}>
                        <span style={{ color:C.ink }}>{p.name}</span>
                        <span className="mono" style={{ textAlign:"right", color:C.sub }}>
                          {money(h.hargaBaru)}</span>
                        <span className="mono" style={{ textAlign:"right", fontWeight:600,
                          color:h.laba>=0?C.pos:C.neg }}>{money(h.laba)}/unit</span>
                        <span style={{ textAlign:"center", fontSize:10, fontWeight:700,
                          color: h.laba<0 ? C.neg : (h.margin<mt ? C.brass : C.pos) }}>
                          {h.laba<0 ? "RUGI" : (h.margin<mt ? "TIPIS" : "AMAN")}</span>
                      </div>
                    );
                  })}
                  {rugi.length>0 && (
                    <div style={{ marginTop:8, fontSize:12, color:C.neg, lineHeight:1.55 }}>
                      Diskon sebesar ini membuat {rugi.length} produk rugi per unitnya
                      ({rugi.map(p=>p.name).join(", ")}). Turunkan besarannya, atau batasi promo
                      hanya untuk produk yang marginnya lebar.
                    </div>
                  )}
                </div>
              );
            })()}

            <button className="btn" onClick={simpan} disabled={busy||!form.name.trim()}
              style={{ width:"100%", padding:"10px", borderRadius:9,
                background:(form.name.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
                color:"#fff", fontWeight:700, fontSize:13.5 }}>
              {busy?"Menyimpan…":(edit==="baru"?"Simpan Skema":"Simpan Perubahan")}</button>
          </div>
        )}

        {/* ---- Daftar skema ---- */}
        {n.diskon.length===0 && !edit && (
          <Kosong teks="Belum ada skema diskon. Tambahkan promo peluncuran, bundling, atau subsidi ongkir — supaya potongannya terhitung, bukan sekadar catatan." />
        )}

        {n.diskon.length>0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {n.diskon.map(d=>{
              const f = feeUntuk(d);
              const sasaran = produkUntuk(d);
              const hasil = sasaran.map(p=>({ p, h:hasilDiskon(p, d, f) }));
              const rugi = hasil.filter(x=>x.h.laba < 0);
              const tipis = hasil.filter(x=>x.h.laba >= 0 && x.h.margin < mt);
              const status = rugi.length ? { l:"RUGI", t:C.neg }
                : tipis.length ? { l:"TIPIS", t:C.brass } : { l:"AMAN", t:C.pos };
              const jd = JENIS_DISKON[d.kind] || JENIS_DISKON.persen;
              const nonaktif = d.active === false;
              const kanalNama = d.channel_id
                ? (n.kanal.find(c=>c.id===d.channel_id)?.name || "kanal terhapus")
                : "semua kanal";
              return (
                <div key={d.id} style={{ border:`1px solid ${C.line}`,
                  borderLeft:`3px solid ${nonaktif?C.line:status.t}`, borderRadius:10,
                  padding:"12px 14px", opacity:nonaktif?0.55:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:13.5 }}>{d.name}</span>
                    <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 8px", borderRadius:20,
                      background:status.t+"18", color:status.t }}>{status.l}</span>
                    <span style={{ fontSize:11, color:C.sub }}>
                      {jd.label}
                      {d.kind==="bundling"
                        ? ` beli ${Number(d.min_qty)||1} gratis ${Number(d.free_qty)||0} · setara ${pct(potonganEfektif(d,1))}`
                        : d.kind==="paket"
                        ? ` ${Number(d.min_qty)||1} unit ${money(Number(d.value)||0)}`
                        : d.kind==="persen" ? ` ${Number(d.value)||0}%`
                        : ` ${money(Number(d.value)||0)}`}
                    </span>
                    {Number(d.share_pct)>0 && <span style={{ fontSize:11, color:C.sub }}>
                      · {Number(d.share_pct)}% penjualan</span>}
                    <span className="no-print" style={{ marginLeft:"auto", display:"flex", gap:3 }}>
                      <button className="btn" onClick={()=>isi(d)} title="Ubah"
                        style={{ background:"transparent", color:C.sub, padding:2 }}><Pencil size={13} /></button>
                      <button className="btn" onClick={()=>hapus(d)} title="Hapus"
                        style={{ background:"transparent", color:C.sub, padding:2 }}><Trash2 size={13} /></button>
                    </span>
                  </div>
                  <div style={{ fontSize:11.5, color:C.sub, marginBottom:hasil.length?8:0 }}>
                    {d.product_id
                      ? (n.produk.find(p=>p.id===d.product_id)?.name || "produk terhapus")
                      : "semua produk"} · {kanalNama}
                    {d.period && <> · {d.period}</>}
                    {d.note && <> · {d.note}</>}
                  </div>
                  {hasil.length>0 && (
                    <div className="scroll-x">
                      <div style={{ display:"grid", gridTemplateColumns:"1.3fr 95px 95px 95px 70px",
                        fontSize:10, color:C.sub, fontWeight:600, paddingBottom:4 }}>
                        <span></span>
                        <span style={{ textAlign:"right" }}>HARGA PROMO</span>
                        <span style={{ textAlign:"right" }}>DITERIMA</span>
                        <span style={{ textAlign:"right" }}>LABA/UNIT</span>
                        <span style={{ textAlign:"center" }}>MARGIN</span>
                      </div>
                      {hasil.map(({ p, h })=>(
                        <div key={p.id} style={{ display:"grid",
                          gridTemplateColumns:"1.3fr 95px 95px 95px 70px", fontSize:12,
                          padding:"3px 0", alignItems:"center" }}>
                          <span style={{ color:C.ink }}>{p.name}</span>
                          <span className="mono" style={{ textAlign:"right" }}>{money(h.hargaBaru)}</span>
                          <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(h.bersih)}</span>
                          <span className="mono" style={{ textAlign:"right", fontWeight:700,
                            color:h.laba>=0?C.pos:C.neg }}>{money(h.laba)}</span>
                          <span className="mono" style={{ textAlign:"center",
                            color:h.margin===null?C.sub:(h.margin<0?C.neg:h.margin<mt?C.brass:C.pos) }}>
                            {h.margin===null?"—":pct(h.margin)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ---- Dampak ke proyeksi bulanan ---- */}
        {dampak.adaIsi && (
          <div style={{ marginTop:14, border:`1px solid ${C.brass}40`, borderRadius:11,
            background:C.brass+"08", padding:"14px 16px" }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>
              Dampak Promo ke Proyeksi Bulanan</div>
            <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <Cell2 l="Omzet tanpa promo" v={money(n.omzetBln)} bold />
              <Cell2 l="Omzet dengan promo" v={money(n.omzetBln - dampak.omzetTurun)} bold />
              <Cell2 l="Laba tanpa promo" v={money(n.labaBln)} bold />
              <Cell2 l="Laba dengan promo" v={money(n.labaBln - dampak.labaTurun)} bold />
            </div>
            <div style={{ fontSize:12, color:C.ink, marginTop:10, lineHeight:1.65 }}>
              Promo yang berjalan memangkas omzet <b>{money(dampak.omzetTurun)}</b> dan laba
              <b> {money(dampak.labaTurun)}</b> per bulan
              {n.labaBln>0 && <> — sekitar <b>{pct(dampak.labaTurun/n.labaBln)}</b> dari laba proyeksi</>}.
              {n.labaBln - dampak.labaTurun < 0
                ? <span style={{ color:C.neg, fontWeight:600 }}> Dengan promo sebesar ini rencananya
                    jadi rugi. Kurangi besaran diskon atau porsi penjualan yang kena promo.</span>
                : <> Angka ini belum masuk ke tahap 5 dan 6 — anggap sebagai pengurang saat membaca
                    kelayakan, atau sesuaikan harga jual di tahap 2 kalau promonya memang permanen.</>}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

/* ================= Tahap 4: Pemasaran ================= */
function TabPemasaran({ r, n, onChange, busy, setBusy, setFlash }) {
  const kosong = () => ({ channel:"", kind:"sosmed", plan:"", budget_month:"",
    target:"", status:"rencana" });
  const [form, setForm] = useState(kosong());
  const [edit, setEdit] = useState(null);

  const isi = (m) => {
    setEdit(m.id);
    setForm({ channel:m.channel||"", kind:m.kind||"sosmed", plan:m.plan||"",
      budget_month:String(Math.round(Number(m.budget_month)||0)||""),
      target:m.target||"", status:m.status||"rencana" });
  };

  const simpan = async () => {
    if (!form.channel.trim()) { setFlash("✗ Kanal pemasaran wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      const v = { ...form, budget_month:+form.budget_month||0 };
      if (edit && edit!=="baru") await updateMarketing(edit, v);
      else await addMarketing(r.id, v);
      setFlash("✓ Aktivitas pemasaran tersimpan"); setEdit(null); setForm(kosong()); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (m) => {
    if (!confirm(`Hapus aktivitas "${m.channel}"?`)) return;
    try { await deleteMarketing(m.id); onChange(); } catch(err){ alert(err.message); }
  };

  const rasioMark = n.omzetBln > 0 ? n.markBln/n.omzetBln : null;

  return (
    <>
      <TahapHead no={4} judul="Pemasaran"
        ket="Rencana konten, iklan, promo, dan kolaborasi — anggarannya masuk ke biaya bulanan." />

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong()); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.teal,
            color:edit?C.sub:"#fff", padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Aktivitas</>}</button>
      </div>

      {edit && (
        <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
          borderRadius:11, padding:16, marginBottom:14 }}>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Kanal / Platform</label>
              <input placeholder="mis. Instagram Reels" value={form.channel}
                onChange={e=>setForm({...form,channel:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Jenis</label>
              <select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})} style={inp}>
                {Object.entries(JENIS_PEMASARAN).map(([k,v])=>
                  <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label style={lbl}>Anggaran / bulan (Rp)</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.budget_month}
                onChange={e=>setForm({...form,budget_month:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
          </div>
          <label style={lbl}>Rencana aktivitas</label>
          <textarea rows={3} value={form.plan}
            onChange={e=>setForm({...form,plan:e.target.value})}
            placeholder={"Apa yang dikerjakan dan seberapa sering.\n\nmis. 3 Reels per minggu: cuplikan latihan siswa pakai merchandise, testimoni orang tua, dan proses produksi."}
            style={{ ...inp, height:"auto", lineHeight:1.6, resize:"vertical", marginBottom:10 }} />
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:12 }}>
            <div><label style={lbl}>Target terukur</label>
              <input placeholder="mis. jangkauan 50rb/bulan, 20 pesanan dari IG" value={form.target}
                onChange={e=>setForm({...form,target:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={inp}>
                <option value="rencana">Rencana</option>
                <option value="jalan">Berjalan</option>
                <option value="selesai">Selesai</option></select></div>
          </div>
          <button className="btn" onClick={simpan} disabled={busy||!form.channel.trim()}
            style={{ width:"100%", padding:"10px", borderRadius:9,
              background:(form.channel.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
              color:"#fff", fontWeight:700, fontSize:13.5 }}>
            {busy?"Menyimpan…":(edit==="baru"?"Simpan Aktivitas":"Simpan Perubahan")}</button>
        </div>
      )}

      {n.mark.length===0 && !edit && (
        <Kosong teks="Belum ada rencana pemasaran. Tambahkan rencana konten Instagram, iklan berbayar, promo peluncuran, atau kolaborasi." />
      )}

      {n.mark.length>0 && <>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {n.mark.map(m=>{
            const jm = JENIS_PEMASARAN[m.kind] || JENIS_PEMASARAN.lainnya;
            return (
              <div key={m.id} style={{ border:`1px solid ${C.line}`, borderLeft:`3px solid ${jm.tone}`,
                borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:13.5 }}>{m.channel}</span>
                  <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:jm.tone+"18", color:jm.tone }}>{jm.label.toUpperCase()}</span>
                  {m.status!=="rencana" && <span style={{ fontSize:10, color:C.sub }}>· {m.status}</span>}
                  <span className="mono" style={{ marginLeft:"auto", fontSize:13, fontWeight:700,
                    color:Number(m.budget_month)>0?C.neg:C.sub }}>
                    {Number(m.budget_month)>0 ? `${money(Number(m.budget_month))}/bln` : "tanpa biaya"}</span>
                  <span className="no-print" style={{ display:"flex", gap:3 }}>
                    <button className="btn" onClick={()=>isi(m)} title="Ubah"
                      style={{ background:"transparent", color:C.sub, padding:2 }}><Pencil size={13} /></button>
                    <button className="btn" onClick={()=>hapus(m)} title="Hapus"
                      style={{ background:"transparent", color:C.sub, padding:2 }}><Trash2 size={13} /></button>
                  </span>
                </div>
                {m.plan && <div style={{ fontSize:12.5, color:C.ink, lineHeight:1.6,
                  whiteSpace:"pre-wrap", marginBottom:m.target?6:0 }}>{m.plan}</div>}
                {m.target && <div style={{ fontSize:11.5, color:C.sub }}>
                  <b>Target:</b> {m.target}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:12, padding:"11px 14px", borderRadius:9, background:C.surf,
          fontSize:12.5, lineHeight:1.6, color:C.ink }}>
          Total anggaran pemasaran <b>{money(n.markBln)}</b> per bulan
          {rasioMark!==null && <> — sekitar <b>{pct(rasioMark)}</b> dari proyeksi omzet.
            {rasioMark > 0.25
              ? " Porsi ini cukup besar; wajar saat peluncuran, tapi turunkan setelah penjualan stabil."
              : rasioMark > 0 && rasioMark < 0.05
                ? " Porsi ini kecil — produk baru biasanya perlu dorongan lebih besar di awal."
                : " Porsi ini wajar untuk produk yang sedang dibangun."}</>}
        </div>
      </>}
    </>
  );
}

/* ================= Tahap 5: Anggaran ================= */
function TabAnggaran({ r, n, onChange, busy, setBusy, setFlash }) {
  const kosong = (kind) => ({ kind:kind||"awal", category:kind==="bulanan"?"Sewa":"Peralatan",
    name:"", amount:"", notes:"" });
  const [form, setForm] = useState(kosong("awal"));
  const [edit, setEdit] = useState(null);
  const [omzetLain, setOmzetLain] = useState(String(Math.round(Number(r.proj_revenue_month)||0)||""));

  const isi = (b) => {
    setEdit(b.id);
    setForm({ kind:b.kind||"awal", category:b.category||"Lainnya", name:b.name||"",
      amount:String(Math.round(Number(b.amount)||0)||""), notes:b.notes||"" });
  };

  const simpan = async () => {
    if (!form.name.trim()) { setFlash("✗ Nama pos anggaran wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      const v = { ...form, amount:+form.amount||0 };
      if (edit && edit!=="baru") await updateBudget(edit, v);
      else await addBudget(r.id, v);
      setFlash("✓ Pos anggaran tersimpan"); setEdit(null); setForm(kosong(form.kind)); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const hapus = async (b) => {
    if (!confirm(`Hapus pos anggaran "${b.name}"?`)) return;
    try { await deleteBudget(b.id); onChange(); } catch(err){ alert(err.message); }
  };

  const simpanOmzetLain = async () => {
    setBusy(true); setFlash("");
    try {
      await updateInitiativeRevenue(r.id, +omzetLain||0);
      setFlash("✓ Proyeksi pendapatan lain tersimpan"); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  const kategoriPilihan = form.kind==="bulanan" ? KATEGORI_BULANAN : KATEGORI_MODAL;

  const BarisBudget = ({ b }) => (
    <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.6fr 130px 70px",
      padding:"9px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
      <span style={{ fontSize:11, color:C.sub }}>{b.category}</span>
      <span><b style={{ color:C.deep }}>{b.name}</b>
        {b.notes && <div style={{ fontSize:10.5, color:C.sub, marginTop:2 }}>{b.notes}</div>}</span>
      <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(Number(b.amount)||0)}</span>
      <span className="no-print" style={{ display:"flex", gap:3, justifyContent:"center" }}>
        <button className="btn" onClick={()=>isi(b)} title="Ubah"
          style={{ background:"transparent", color:C.sub, padding:2 }}><Pencil size={13} /></button>
        <button className="btn" onClick={()=>hapus(b)} title="Hapus"
          style={{ background:"transparent", color:C.sub, padding:2 }}><Trash2 size={13} /></button>
      </span>
    </div>
  );

  const Otomatis = ({ label, nilai, dari }) => (
    <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.6fr 130px 70px",
      padding:"9px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12,
      alignItems:"center", background:C.teal+"08" }}>
      <span style={{ fontSize:11, color:C.teal, fontWeight:600 }}>Otomatis</span>
      <span><b style={{ color:C.deep }}>{label}</b>
        <div style={{ fontSize:10.5, color:C.sub, marginTop:2 }}>dari {dari}</div></span>
      <span className="mono" style={{ textAlign:"right", fontWeight:600 }}>{money(nilai)}</span>
      <span></span>
    </div>
  );

  return (
    <>
      <TahapHead no={5} judul="Anggaran"
        ket="Penjumlahan semuanya: proyeksi pendapatan, modal awal, dan biaya bulanan." />

      {/* --- Proyeksi pendapatan --- */}
      <div style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"10px 14px", background:C.pos+"12", fontWeight:700,
          fontSize:12.5, color:C.deep }}>PROYEKSI PENDAPATAN / BULAN</div>
        <Otomatis label="Penjualan produk" nilai={n.omzetProduk} dari="tahap 2 — target jual per bulan" />
        <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.line}` }}>
          <label style={lbl}>Pendapatan lain per bulan (Rp)</label>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input className="mono" inputMode="numeric" placeholder="0" value={omzetLain}
              onChange={e=>setOmzetLain(e.target.value.replace(/\D/g,""))}
              style={{ ...inp, maxWidth:220 }} />
            <button className="btn no-print" onClick={simpanOmzetLain} disabled={busy}
              style={{ background:C.teal, color:"#fff", padding:"9px 15px", borderRadius:8,
                fontSize:12.5, fontWeight:600 }}>Simpan</button>
          </div>
          <div style={{ fontSize:11, color:C.sub, marginTop:6, lineHeight:1.5 }}>
            Untuk rencana non-produk seperti cabang atau layanan baru — mis. perkiraan iuran bulanan
            dari siswa cabang baru. Kosongkan kalau pendapatannya hanya dari produk.
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.6fr 130px 70px",
          padding:"11px 14px", background:C.surf, fontSize:12.5, fontWeight:700 }}>
          <span></span><span>TOTAL PENDAPATAN / BULAN</span>
          <span className="mono" style={{ textAlign:"right", color:C.pos }}>{money(n.omzetBln)}</span>
          <span></span>
        </div>
      </div>

      {/* --- Form pos anggaran --- */}
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button className="btn no-print" onClick={()=>{ setEdit(edit?null:"baru"); setForm(kosong("awal")); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:edit?C.surf:C.teal,
            color:edit?C.sub:"#fff", padding:"8px 14px", borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          {edit ? <><X size={14}/> Tutup</> : <><Plus size={14}/> Tambah Pos Anggaran</>}</button>
      </div>

      {edit && (
        <div className="pop no-print" style={{ border:`2px solid ${edit==="baru"?C.teal:C.brass}`,
          borderRadius:11, padding:16, marginBottom:14 }}>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Jenis Biaya</label>
              <select value={form.kind}
                onChange={e=>setForm({...form, kind:e.target.value,
                  category:e.target.value==="bulanan"?"Sewa":"Peralatan"})}
                style={{ ...inp, fontWeight:600, color:form.kind==="awal"?C.brass:C.neg }}>
                <option value="awal">Modal awal — sekali bayar</option>
                <option value="bulanan">Biaya bulanan — rutin</option></select></div>
            <div><label style={lbl}>Kategori</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
                {kategoriPilihan.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
          </div>
          <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={lbl}>Nama Pos</label>
              <input placeholder={form.kind==="awal"
                ? "mis. Desain logo & label produk"
                : "mis. Sewa gudang kecil"} value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Jumlah (Rp)</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.amount}
                onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
          </div>
          <label style={lbl}>Catatan</label>
          <input placeholder="mis. sudah termasuk revisi 2x" value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})} style={{ ...inp, marginBottom:12 }} />
          <div style={{ fontSize:11.5, color:C.sub, marginBottom:12, lineHeight:1.55,
            background:C.surf, padding:"10px 12px", borderRadius:8 }}>
            Stok produk awal dan anggaran pemasaran <b>tidak perlu dicatat di sini</b> — keduanya
            sudah terhitung otomatis dari tahap 2 dan tahap 4.
          </div>
          <button className="btn" onClick={simpan} disabled={busy||!form.name.trim()}
            style={{ width:"100%", padding:"10px", borderRadius:9,
              background:(form.name.trim()&&!busy)?(edit==="baru"?C.teal:C.brass):C.line,
              color:"#fff", fontWeight:700, fontSize:13.5 }}>
            {busy?"Menyimpan…":(edit==="baru"?"Simpan Pos Anggaran":"Simpan Perubahan")}</button>
        </div>
      )}

      {/* --- Modal awal --- */}
      <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:11,
        overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"10px 14px", background:C.brass+"18", fontWeight:700,
          fontSize:12.5, color:C.deep }}>MODAL AWAL — SEKALI BAYAR</div>
        {n.stokAwal>0 && <Otomatis label="Stok produk awal" nilai={n.stokAwal}
          dari="tahap 2 — harga produksi × jumlah produksi awal" />}
        {n.budAwal.map(b=><BarisBudget key={b.id} b={b} />)}
        {n.stokAwal===0 && n.budAwal.length===0 && (
          <div style={{ padding:"16px 14px", fontSize:12.5, color:C.sub, fontStyle:"italic" }}>
            Belum ada pos modal awal. Tambahkan peralatan, desain, perizinan, atau deposit sewa.</div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.6fr 130px 70px",
          padding:"11px 14px", background:C.deep, color:"#fff", fontSize:13, fontWeight:700 }}>
          <span></span><span>TOTAL MODAL DIBUTUHKAN</span>
          <span className="mono" style={{ textAlign:"right" }}>{money(n.modalHitung)}</span>
          <span></span>
        </div>
      </div>

      {/* --- Biaya bulanan --- */}
      <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden" }}>
        <div style={{ padding:"10px 14px", background:C.neg+"12", fontWeight:700,
          fontSize:12.5, color:C.deep }}>BIAYA BULANAN — RUTIN</div>
        {n.hppBln>0 && <Otomatis label="Harga pokok produk terjual" nilai={n.hppBln}
          dari="tahap 2 — harga produksi × target jual per bulan" />}
        {n.feeBln>0 && <Otomatis label="Potongan platform penjualan" nilai={n.feeBln}
          dari={`tahap 3 — ${pct(n.feePctEfektif)} dari omzet`} />}
        {n.markBln>0 && <Otomatis label="Anggaran pemasaran" nilai={n.markBln}
          dari="tahap 4 — total anggaran aktivitas" />}
        {n.budBulan.map(b=><BarisBudget key={b.id} b={b} />)}
        {n.biayaHitung===0 && (
          <div style={{ padding:"16px 14px", fontSize:12.5, color:C.sub, fontStyle:"italic" }}>
            Belum ada biaya bulanan. Isi tahap 2–4, atau tambahkan pos seperti sewa dan gaji.</div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.6fr 130px 70px",
          padding:"11px 14px", background:C.deep, color:"#fff", fontSize:13, fontWeight:700 }}>
          <span></span><span>TOTAL BIAYA / BULAN</span>
          <span className="mono" style={{ textAlign:"right" }}>{money(n.biayaHitung)}</span>
          <span></span>
        </div>
      </div>

      {/* --- Hasil --- */}
      <div style={{ marginTop:16, border:`1px solid ${n.labaBln>=0?C.pos:C.neg}40`, borderRadius:11,
        background:(n.labaBln>=0?C.pos:C.neg)+"08", padding:"14px 16px" }}>
        <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          <Cell2 l="Pendapatan / bulan" v={money(n.omzetBln)} bold />
          <Cell2 l="Biaya / bulan" v={money(n.biayaBln)} bold />
          <Cell2 l="Laba / bulan" v={money(n.labaBln)} bold />
          <Cell2 l="Margin" v={n.marginBln===null?"—":pct(n.marginBln)} bold />
        </div>
        <div style={{ fontSize:12, color:C.sub, marginTop:10, lineHeight:1.6 }}>
          Angka ini otomatis dipakai di kartu rencana, ringkasan portofolio, dan tahap 6 Kelayakan —
          tidak perlu diketik ulang di mana pun.
        </div>
      </div>
    </>
  );
}

/* ================= Tahap 6: Kelayakan & Pendanaan ================= */
function TabKelayakan({ r, n, rel, danaTersedia, tertaut, ubahStatus, onChange, busy, setBusy, setFlash }) {
  const [dana, setDana] = useState(String(Math.round(Number(r.funding_secured)||0)||""));
  const [sumber, setSumber] = useState(r.funding_source||"laba");
  const [faktor, setFaktor] = useState(1);        // skenario untuk arus kas
  const [ramp, setRamp] = useState(3);            // bulan sampai target penuh

  const mb = modelBiaya(n);
  const skPes = skenario(n, 0.6), skReal = skenario(n, 1), skOpt = skenario(n, 1.3);
  const kas12 = arusKas(n, faktor, ramp);
  const totalQty = n.produk.reduce((s,p)=>s+(Number(p.qty_month)||0), 0);

  const simpanDana = async () => {
    setBusy(true); setFlash("");
    try {
      await updateInitiativeFunding(r.id, { funding_secured:+dana||0, funding_source:sumber });
      setFlash("✓ Pendanaan tersimpan"); await onChange();
    } catch(err){ setFlash("✗ "+err.message); }
    setBusy(false);
  };

  return (
    <>
      <TahapHead no={6} judul="Kelayakan & Pendanaan"
        ket="Kesimpulan dari seluruh tahap — apakah layak dijalankan dan dananya mencukupi." />

      {!n.adaRincian && (
        <div style={{ border:`1px dashed ${C.line}`, borderRadius:11, padding:"20px 18px",
          marginBottom:16 }}>
          <div style={{ fontSize:13, color:C.ink, lineHeight:1.65, marginBottom:14, textAlign:"center" }}>
            Belum ada angka untuk dinilai. Begitu <b>tahap 2 Produk</b> terisi — cukup satu produk
            dengan harga produksi, harga jual, dan target jual per bulan — seluruh bagian di bawah
            ini terhitung sendiri:
          </div>
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { j:"Titik Impas", k:"Berapa persen dari target bulanan yang harus tercapai supaya tidak rugi — setara berapa unit terjual." },
              { j:"Uji Skenario", k:"Perbandingan pesimis 60%, realistis 100%, dan optimis 130% berdampingan, lengkap dengan laba dan balik modalnya." },
              { j:"Arus Kas 12 Bulan", k:"Grafik dan tabel saldo kas tiap bulan — menunjukkan kapan kasnya paling tipis." },
            ].map(x=>(
              <div key={x.j} style={{ border:`1px solid ${C.line}`, borderRadius:9, padding:"11px 13px" }}>
                <div style={{ fontWeight:700, fontSize:12.5, marginBottom:4 }}>{x.j}</div>
                <div style={{ fontSize:11.5, color:C.sub, lineHeight:1.55 }}>{x.k}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
        gap:12, marginBottom:16 }}>
        <div className="card" style={{ padding:"13px 15px" }}>
          <div style={{ fontSize:11.5, color:C.sub }}>Modal dibutuhkan</div>
          <div className="mono" style={{ fontSize:17, fontWeight:700, marginTop:5 }}>{money(n.modal)}</div>
        </div>
        <div className="card" style={{ padding:"13px 15px" }}>
          <div style={{ fontSize:11.5, color:C.sub }}>Laba / bulan</div>
          <div className="mono" style={{ fontSize:17, fontWeight:700, marginTop:5,
            color:n.labaBln>=0?C.pos:C.neg }}>{money(n.labaBln)}</div>
        </div>
        <div className="card" style={{ padding:"13px 15px" }}>
          <div style={{ fontSize:11.5, color:C.sub }}>Balik modal</div>
          <div className="mono" style={{ fontSize:17, fontWeight:700, marginTop:5 }}>
            {n.bep===null?"—":`${n.bep.toFixed(1)} bln`}</div>
        </div>
        <div className="card" style={{ padding:"13px 15px" }}>
          <div style={{ fontSize:11.5, color:C.sub }}>ROI / tahun</div>
          <div className="mono" style={{ fontSize:17, fontWeight:700, marginTop:5,
            color:n.roi!==null&&n.roi>=0.2?C.pos:C.sub }}>
            {n.roi===null?"—":pct(n.roi)}</div>
        </div>
      </div>

      {/* ---------- Titik impas ---------- */}
      {n.omzetBln > 0 && (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:11, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Titik Impas</div>
          {mb.impasFaktor === null ? (
            <div style={{ fontSize:12.5, color:C.neg, lineHeight:1.6 }}>
              Setiap unit yang terjual belum menutup biaya variabelnya sendiri — berapa pun
              jumlah yang terjual, rencana ini tetap rugi. Naikkan harga jual atau tekan harga
              produksi dulu sebelum lanjut.
            </div>
          ) : (
            <>
              <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                <Cell2 l="Perlu tercapai" v={pct(mb.impasFaktor)} bold />
                <Cell2 l="Setara omzet" v={money(n.omzetBln*mb.impasFaktor)} bold />
                <Cell2 l={totalQty>0?"Setara unit terjual":"Margin kontribusi"}
                  v={totalQty>0
                      ? `${Math.ceil(totalQty*mb.impasFaktor)} dari ${totalQty} unit`
                      : (mb.rasioKontrib===null?"—":pct(mb.rasioKontrib))} bold />
              </div>
              <div style={{ fontSize:12, color:C.sub, marginTop:10, lineHeight:1.6 }}>
                {mb.impasFaktor <= 0.5
                  ? <>Cukup <b>{pct(mb.impasFaktor)}</b> dari target bulanan untuk menutup biaya tetap
                      ({money(mb.tetap)}). Ruang amannya lebar — meleset separuh pun masih untung.</>
                  : mb.impasFaktor <= 0.85
                    ? <>Perlu <b>{pct(mb.impasFaktor)}</b> dari target bulanan untuk impas. Masih wajar,
                        tapi tidak banyak ruang meleset — pantau penjualan bulanan sejak awal.</>
                    : mb.impasFaktor < 1
                      ? <>Perlu <b>{pct(mb.impasFaktor)}</b> dari target untuk sekadar impas. Nyaris tanpa
                          ruang aman: sedikit saja target tidak tercapai, rencana ini rugi.</>
                      : <>Butuh <b>{pct(mb.impasFaktor)}</b> dari target — di atas target itu sendiri.
                          Dengan struktur biaya sekarang rencana ini rugi bahkan bila target tercapai penuh.</>}
                {mb.bisaPilah && <> Biaya tetapnya {money(mb.tetap)}/bulan, biaya variabelnya {money(mb.variabel)} pada target penuh.</>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- Uji skenario ---------- */}
      {n.omzetBln > 0 && (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden", marginBottom:16 }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.line}` }}>
            <div style={{ fontWeight:700, fontSize:13 }}>Uji Skenario</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:3, lineHeight:1.55 }}>
              Semua angka di tahap sebelumnya adalah perkiraan. Tabel ini menunjukkan apa yang
              terjadi bila penjualan meleset — biaya tetap tidak ikut turun, jadi dampaknya
              lebih besar daripada sekadar proporsional.
            </div>
          </div>
          <div className="scroll-x">
            <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr",
              padding:"9px 16px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
              <span></span>
              <span style={{ textAlign:"right" }}>PESIMIS · 60%</span>
              <span style={{ textAlign:"right" }}>REALISTIS · 100%</span>
              <span style={{ textAlign:"right" }}>OPTIMIS · 130%</span>
            </div>
            {[
              { l:"Omzet / bulan", k:"omzet", uang:true },
              { l:"Biaya / bulan", k:"biaya", uang:true },
              { l:"Laba / bulan", k:"laba", uang:true, tebal:true },
              { l:"Margin", k:"margin", persen:true },
              { l:"Balik modal", k:"bep", bulan:true },
              { l:"ROI / tahun", k:"roi", persen:true },
            ].map(baris=>(
              <div key={baris.k} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr",
                padding:baris.tebal?"11px 16px":"8px 16px", borderBottom:`1px solid ${C.line}`,
                fontSize:12.5, alignItems:"center",
                background:baris.tebal?C.surf:"transparent", fontWeight:baris.tebal?700:400 }}>
                <span style={{ color:baris.tebal?C.ink:C.sub }}>{baris.l}</span>
                {[skPes, skReal, skOpt].map((sk,i)=>{
                  const v = sk[baris.k];
                  const teks = v===null||v===undefined ? "—"
                    : baris.uang ? money(v)
                    : baris.persen ? pct(v)
                    : baris.bulan ? `${v.toFixed(1)} bln` : String(v);
                  const warna = baris.k==="laba" ? (v>=0?C.pos:C.neg)
                    : baris.k==="bep" ? (v===null?C.neg:C.ink) : C.ink;
                  return <span key={i} className="mono"
                    style={{ textAlign:"right", color:warna,
                      fontWeight: i===1 ? 700 : (baris.tebal?700:600) }}>{teks}</span>;
                })}
              </div>
            ))}
          </div>
          <div style={{ padding:"12px 16px", fontSize:12.5, color:C.ink, lineHeight:1.65 }}>
            {skPes.laba >= 0
              ? <>Pada skenario pesimis pun rencana ini masih untung {money(skPes.laba)} per bulan,
                  dengan balik modal {skPes.bep===null?"—":`${skPes.bep.toFixed(1)} bulan`}.
                  Ini rencana yang tahan meleset.</>
              : <>Pada skenario pesimis rencana ini <b style={{ color:C.neg }}>rugi {money(Math.abs(skPes.laba))}
                  per bulan</b>. Artinya kalau penjualan hanya tercapai 60%, kamu menombok tiap bulan —
                  pertimbangkan menekan biaya tetap, memperkecil skala awal, atau menunda sampai
                  permintaannya lebih pasti.</>}
          </div>
        </div>
      )}

      {/* ---------- Proyeksi arus kas ---------- */}
      {(n.modal > 0 || n.omzetBln > 0) && (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:11, overflow:"hidden", marginBottom:16 }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.line}` }}>
            <div style={{ fontWeight:700, fontSize:13 }}>Proyeksi Arus Kas 12 Bulan</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:3, lineHeight:1.55 }}>
              Balik modal menganggap laba mengalir rata sejak hari pertama. Kenyataannya modal
              keluar lebih dulu dan penjualan naik bertahap — di sinilah terlihat kapan kas
              paling tipis.
            </div>
          </div>

          <div className="no-print" style={{ display:"flex", gap:16, flexWrap:"wrap",
            padding:"12px 16px", background:C.surf, borderBottom:`1px solid ${C.line}` }}>
            <div>
              <div style={{ fontSize:10.5, color:C.sub, marginBottom:5 }}>SKENARIO</div>
              <div style={{ display:"flex", gap:4 }}>
                {[{f:0.6,l:"Pesimis"},{f:1,l:"Realistis"},{f:1.3,l:"Optimis"}].map(o=>(
                  <button key={o.f} className="btn" onClick={()=>setFaktor(o.f)}
                    style={{ padding:"6px 12px", borderRadius:7, fontSize:11.5, fontWeight:600,
                      background:faktor===o.f?C.teal:"#fff", color:faktor===o.f?"#fff":C.sub,
                      border:`1px solid ${faktor===o.f?C.teal:C.line}` }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:10.5, color:C.sub, marginBottom:5 }}>TARGET PENUH TERCAPAI DALAM</div>
              <div style={{ display:"flex", gap:4 }}>
                {[1,3,6].map(b=>(
                  <button key={b} className="btn" onClick={()=>setRamp(b)}
                    style={{ padding:"6px 12px", borderRadius:7, fontSize:11.5, fontWeight:600,
                      background:ramp===b?C.brass:"#fff", color:ramp===b?"#fff":C.sub,
                      border:`1px solid ${ramp===b?C.brass:C.line}` }}>
                    {b===1?"Langsung":`${b} bulan`}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding:"14px 16px 6px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={kas12.baris.map(b=>({
                  m: b.bulan===0?"Mulai":`B${b.bulan}`, saldo: Math.round(b.saldo) }))}
                margin={{ left:-18, right:6, top:6 }}>
                <defs>
                  <linearGradient id={`kasg-${r.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.teal} stopOpacity={.3}/>
                    <stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize:11, fill:C.sub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10.5, fill:C.sub }} tickFormatter={moneyShort}
                  axisLine={false} tickLine={false} width={54} />
                <Tooltip formatter={(v)=>money(v)}
                  contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
                <Area type="monotone" dataKey="saldo" stroke={C.teal} strokeWidth={2.4}
                  fill={`url(#kasg-${r.id})`} name="Saldo kas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="scroll-x" style={{ borderTop:`1px solid ${C.line}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"70px 1fr 1fr 1fr 1fr",
              padding:"9px 16px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
              <span>BULAN</span>
              <span style={{ textAlign:"right" }}>KAS MASUK</span>
              <span style={{ textAlign:"right" }}>KAS KELUAR</span>
              <span style={{ textAlign:"right" }}>BERSIH</span>
              <span style={{ textAlign:"right" }}>SALDO</span>
            </div>
            {kas12.baris.map(b=>{
              const terendah = b.bulan===kas12.titikTerendah.bulan;
              return (
                <div key={b.bulan} style={{ display:"grid", gridTemplateColumns:"70px 1fr 1fr 1fr 1fr",
                  padding:"8px 16px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center",
                  background: terendah ? C.brass+"10" : "transparent" }}>
                  <span style={{ fontWeight:600, color:C.deep }}>
                    {b.bulan===0?"Mulai":b.bulan}
                    {b.ramp!==undefined && b.ramp<1 &&
                      <span style={{ fontSize:9.5, color:C.sub, fontWeight:400 }}> {pct(b.ramp)}</span>}
                  </span>
                  <span className="mono" style={{ textAlign:"right", color:b.masuk?C.pos:C.line }}>
                    {b.masuk?money(b.masuk):"–"}</span>
                  <span className="mono" style={{ textAlign:"right", color:b.keluar?C.neg:C.line }}>
                    {b.keluar?money(b.keluar):"–"}</span>
                  <span className="mono" style={{ textAlign:"right",
                    color:b.bersih>=0?C.ink:C.neg }}>{money(b.bersih)}</span>
                  <span className="mono" style={{ textAlign:"right", fontWeight:700,
                    color:b.saldo>=0?C.pos:C.neg }}>{money(b.saldo)}</span>
                </div>
              );
            })}
          </div>

          <div style={{ padding:"13px 16px", fontSize:12.5, color:C.ink, lineHeight:1.65 }}>
            Titik kas terendah di <b>{kas12.titikTerendah.bulan===0?"saat modal dikeluarkan":`bulan ${kas12.titikTerendah.bulan}`}</b>,
            yaitu <b style={{ color:kas12.titikTerendah.saldo>=0?C.pos:C.neg }}>
              {money(kas12.titikTerendah.saldo)}</b>.
            {kas12.titikTerendah.saldo < 0 && <>
              {" "}Kekurangan sebesar {money(Math.abs(kas12.titikTerendah.saldo))} itu harus ditutup dari
              kas usaha yang berjalan{danaTersedia>0 && <> (saat ini {money(danaTersedia)})</>} —
              {Math.abs(kas12.titikTerendah.saldo) <= danaTersedia
                ? " secara angka masih tertutup, tapi pastikan operasional rutin tidak ikut tersedot."
                : " dan ini melebihi kas yang ada sekarang. Perkecil modal awal atau cari pendanaan tambahan."}
            </>}
            {kas12.pulih
              ? <> Kas kembali positif di bulan <b>{kas12.pulih.bulan}</b>.</>
              : <> Kas belum kembali positif sampai bulan 12 dengan skenario ini.</>}
          </div>
        </div>
      )}

      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* pendanaan */}
        <div style={{ border:`1px solid ${C.line}`, borderRadius:11, padding:"14px 16px" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Pendanaan</div>
          <RowLine l="Modal dibutuhkan (dari anggaran)" v={n.modal} />
          <RowLine l="Dana tersedia" v={n.siap} c={C.pos} />
          <div style={{ borderTop:`1px solid ${C.line}`, marginTop:6, paddingTop:8 }}>
            <RowLine l="Kekurangan" v={n.kurang} c={n.kurang>0?C.neg:C.pos} bold />
          </div>
          <div style={{ height:8, borderRadius:99, background:C.surf, overflow:"hidden", marginTop:10 }}>
            <div style={{ height:"100%", borderRadius:99, background:n.kurang>0?C.brass:C.pos,
              width:`${n.modal>0?Math.min(100,(n.siap/n.modal)*100):0}%` }} /></div>

          <div className="no-print" style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.line}` }}>
            <div className="row-stack" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Dana sudah tersedia (Rp)</label>
                <input className="mono" inputMode="numeric" placeholder="0" value={dana}
                  onChange={e=>setDana(e.target.value.replace(/\D/g,""))} style={inp} /></div>
              <div><label style={lbl}>Sumber dana</label>
                <select value={sumber} onChange={e=>setSumber(e.target.value)} style={inp}>
                  {Object.entries(SUMBER_DANA).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <button className="btn" onClick={simpanDana} disabled={busy}
              style={{ width:"100%", padding:"9px", borderRadius:8, background:C.teal,
                color:"#fff", fontWeight:600, fontSize:12.5 }}>
              {busy?"Menyimpan…":"Simpan Pendanaan"}</button>
          </div>
        </div>

        {/* proyeksi vs realisasi */}
        <div style={{ border:`1px solid ${C.line}`, borderRadius:11, padding:"14px 16px" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Proyeksi vs Realisasi</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px",
            fontSize:10.5, color:C.sub, fontWeight:600, paddingBottom:6 }}>
            <span></span><span style={{ textAlign:"right" }}>PROYEKSI</span>
            <span style={{ textAlign:"right" }}>AKTUAL</span></div>
          <BandingBaris l="Pendapatan / bln" a={n.omzetBln} b={rel.ada?rel.aRev:null} tone={C.pos} />
          <BandingBaris l="Biaya / bln" a={n.biayaBln} b={rel.ada?rel.aBeban:null} tone={C.neg} />
          <div style={{ borderTop:`1px solid ${C.line}`, marginTop:6, paddingTop:6 }}>
            <BandingBaris l="Laba" a={n.labaBln} b={rel.ada?rel.aLaba:null} bold />
          </div>
          <div style={{ fontSize:11, color:C.sub, marginTop:9, lineHeight:1.5 }}>
            {tertaut===0
              ? <>Belum ada akun tertaut, jadi kolom aktual masih kosong. Klik ikon rantai di kartu
                  rencana untuk memilih akun pendapatan & biaya yang terkait.</>
              : <>Aktual dari {tertaut} akun tertaut, akumulasi sepanjang {YEAR} ({rel.aTrx} transaksi).
                  Proyeksi bersifat per bulan.</>}
          </div>
          {rel.aAset>0 && (
            <div style={{ fontSize:11.5, color:C.ink, marginTop:8, padding:"7px 10px",
              borderRadius:7, background:C.surf }}>
              Modal yang sudah dibelanjakan: <b>{money(rel.aAset)}</b>
              {n.modal>0 && <> dari rencana {money(n.modal)} ({pct(rel.aAset/n.modal)})</>}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop:14 }}>
        {penilaianInisiatif(n, r, danaTersedia, rel).map((p,i)=>(
          <div key={i} style={{ display:"flex", gap:9, alignItems:"flex-start",
            padding:"9px 13px", borderRadius:9, marginBottom:7,
            background:p.tone+"0D", borderLeft:`3px solid ${p.tone}` }}>
            <span style={{ fontSize:12.5, color:C.ink, lineHeight:1.55 }}>{p.m}</span>
          </div>
        ))}
      </div>

      <div className="no-print" style={{ marginTop:12, display:"flex", gap:6,
        alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:11.5, color:C.sub, marginRight:2 }}>Ubah status:</span>
        {Object.entries(STATUS_INISIATIF).map(([k,v])=>(
          <button key={k} className="btn" onClick={()=>ubahStatus(r,k)} disabled={r.status===k}
            style={{ padding:"5px 11px", borderRadius:7, fontSize:11.5, fontWeight:600,
              background:r.status===k?v.tone:C.surf, color:r.status===k?"#fff":C.sub,
              cursor:r.status===k?"default":"pointer" }}>{v.label}</button>
        ))}
      </div>
    </>
  );
}

/* ---- potongan kecil yang dipakai berulang ---- */
const TahapHead = ({ no, judul, ket }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:4 }}>
      <span style={{ width:22, height:22, borderRadius:99, background:C.teal, color:"#fff",
        display:"grid", placeItems:"center", fontSize:11, fontWeight:700 }}>{no}</span>
      <span style={{ fontWeight:700, fontSize:14.5 }}>{judul}</span>
    </div>
    <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.55 }}>{ket}</div>
  </div>
);

const Kosong = ({ teks }) => (
  <div style={{ padding:"24px 18px", textAlign:"center", border:`1px dashed ${C.line}`,
    borderRadius:11, color:C.sub, fontSize:13, lineHeight:1.6 }}>{teks}</div>
);

const KpiMini = ({ l, v, c }) => (
  <div style={{ background:"#fff", padding:"11px 14px" }}>
    <div style={{ fontSize:10.5, color:C.sub }}>{l}</div>
    <div className="mono" style={{ fontSize:14, fontWeight:700, color:c||C.ink, marginTop:3 }}>{v}</div>
  </div>
);

const BandingBaris = ({ l, a, b, tone, bold }) => (
  <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px", fontSize:12.5, padding:"4px 0" }}>
    <span style={{ color:bold?C.ink:C.sub, fontWeight:bold?600:400 }}>{l}</span>
    <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(a)}</span>
    <span className="mono" style={{ textAlign:"right", fontWeight:bold?700:600,
      color: b===null ? C.line : (tone || (b>=0?C.ink:C.neg)) }}>
      {b===null ? "–" : money(b)}</span>
  </div>
);

/* ---- penilaian otomatis, memakai hasil hitungan seluruh tahap ---- */
function penilaianInisiatif(n, r, danaTersedia, rel) {
  const out = [];
  if (!n.adaRincian) {
    out.push({ tone:C.sub, m:"Tahap 2 sampai 5 belum diisi, jadi kelayakannya belum bisa dinilai." });
    return out;
  }
  if (n.omzetBln === 0)
    out.push({ tone:C.brass, m:"Belum ada proyeksi pendapatan. Isi target jual per bulan di tahap 2, atau pendapatan lain per bulan di tahap 5." });
  if (n.labaBln <= 0 && n.omzetBln > 0)
    out.push({ tone:C.neg, m:`Biaya bulanan (${money(n.biayaBln)}) menyamai atau melebihi pendapatan (${money(n.omzetBln)}). Rencana ini belum balik modal — tinjau harga jual, volume, atau pos biaya terbesarnya.` });
  if (n.bep !== null && n.bep > 0) {
    if (n.bep <= 12)
      out.push({ tone:C.pos, m:`Perkiraan balik modal ${n.bep.toFixed(1)} bulan — tergolong cepat. ROI tahunan ${pct(n.roi)}.` });
    else if (n.bep <= 24)
      out.push({ tone:C.brass, m:`Perkiraan balik modal ${n.bep.toFixed(1)} bulan (sekitar ${(n.bep/12).toFixed(1)} tahun). Masih wajar untuk investasi peralatan atau cabang, asal proyeksinya konservatif.` });
    else
      out.push({ tone:C.neg, m:`Perkiraan balik modal ${n.bep.toFixed(1)} bulan — cukup lama. Pertimbangkan menurunkan modal awal, menaikkan harga, atau mendahulukan rencana lain.` });
  }
  if (n.kurang > 0) {
    if (n.kurang <= danaTersedia)
      out.push({ tone:C.brass, m:`Masih kurang ${money(n.kurang)}. Kas & bank saat ini ${money(danaTersedia)}, jadi secara angka tertutup — tapi sisakan dana operasional rutin sebelum memakainya.` });
    else
      out.push({ tone:C.neg, m:`Kekurangan dana ${money(n.kurang)} melebihi kas & bank yang ada (${money(danaTersedia)}). Perlu pendanaan luar, atau jalankan bertahap dengan modal lebih kecil.` });
  } else if (n.modal > 0) {
    out.push({ tone:C.pos, m:"Dana untuk rencana ini sudah tersedia penuh." });
  }
  if (n.marginBln !== null && n.marginBln > 0 && n.marginBln < 0.15)
    out.push({ tone:C.brass, m:`Margin proyeksi hanya ${pct(n.marginBln)} — tipis, jadi sedikit saja biaya meleset bisa membuat rugi. Beri ruang aman pada perhitungan biayanya.` });
  // dari rincian produk
  const rugi = n.produk.filter(p=>(Number(p.price_unit)||0) <= (Number(p.cost_unit)||0)
    && (Number(p.price_unit)||0) > 0);
  if (rugi.length > 0)
    out.push({ tone:C.neg, m:`${rugi.length} produk harga jualnya belum menutup harga produksi (${rugi.map(p=>p.name).join(", ")}). Perbaiki sebelum produksi dimulai.` });
  const belumHarga = n.produk.filter(p=>!(Number(p.price_unit)||0));
  if (belumHarga.length > 0)
    out.push({ tone:C.sub, m:`${belumHarga.length} produk belum punya rencana harga jual, jadi belum ikut terhitung di proyeksi.` });
  if (n.produk.length > 0 && n.kanal.length === 0)
    out.push({ tone:C.brass, m:"Tahap 3 belum diisi. Potongan marketplace seperti Shopee bisa memangkas margin cukup besar kalau tidak diperhitungkan." });
  if (n.produk.length > 0 && n.mark.length === 0)
    out.push({ tone:C.brass, m:"Tahap 4 belum diisi. Produk baru biasanya perlu dorongan konten dan promo di awal agar dikenal." });
  // realisasi vs proyeksi
  if (rel && rel.ada && n.omzetBln > 0) {
    const bulanJalan = r.start_date ? Math.max(1, Math.round(
      (new Date(`${YEAR}-12-31`) - new Date(r.start_date)) / (1000*60*60*24*30))) : null;
    if (bulanJalan) {
      const harusnya = n.omzetBln * Math.min(bulanJalan, 12);
      if (harusnya > 0) {
        const capai = rel.aRev / harusnya;
        if (capai >= 1)
          out.push({ tone:C.pos, m:`Realisasi pendapatan ${money(rel.aRev)} sudah melampaui proyeksi untuk masa berjalan (${pct(capai)}). Proyeksi berikutnya bisa dinaikkan.` });
        else if (capai >= 0.6)
          out.push({ tone:C.brass, m:`Realisasi pendapatan ${money(rel.aRev)}, sekitar ${pct(capai)} dari proyeksi masa berjalan. Belum sesuai rencana, tapi masih dalam jangkauan.` });
        else
          out.push({ tone:C.neg, m:`Realisasi pendapatan baru ${pct(capai)} dari proyeksi masa berjalan (${money(rel.aRev)} dari perkiraan ${money(harusnya)}). Tinjau apakah proyeksinya terlalu optimistis atau eksekusinya tersendat.` });
      }
    }
  }
  // dari analisis SWOT
  if (n.posisi && n.posisi.cukup) {
    const p = n.posisi;
    out.push({ tone:p.tone, m:`Analisis SWOT menempatkan rencana ini di posisi ${p.nama.toLowerCase()} (internal ${p.internal>=0?"+":""}${p.internal}, eksternal ${p.eksternal>=0?"+":""}${p.eksternal}). ${p.saran}` });
    if (p.nama === "Bertahan" && n.modal > 0)
      out.push({ tone:C.neg, m:`Posisi SWOT bertahan tapi modal yang disiapkan ${money(n.modal)}. Pertimbangkan uji coba skala kecil dulu sebelum mengeluarkan seluruh modal itu.` });
    const tanpaTindak = n.swot.filter(s=>!s.action || !String(s.action).trim()).length;
    if (tanpaTindak > 0)
      out.push({ tone:C.sub, m:`${tanpaTindak} butir SWOT belum punya tindak lanjut. Tanpa itu, SWOT berhenti jadi daftar dan tidak membantu keputusan.` });
  } else if (!n.swot || n.swot.length === 0) {
    out.push({ tone:C.sub, m:"Analisis SWOT di tahap 1 belum diisi. Mengisi kekuatan, kelemahan, peluang, dan ancaman membantu menilai apakah angka di atas realistis." });
  }
  // dari skema diskon
  if (n.diskon && n.diskon.length > 0 && n.produk.length > 0) {
    const feeUntuk = (d) => {
      if (d.channel_id) {
        const c = n.kanal.find(x=>x.id===d.channel_id);
        if (c) return (Number(c.fee_pct)||0)/100;
      }
      return n.feePctEfektif;
    };
    const bermasalah = [];
    let labaTurun = 0;
    n.diskon.filter(d=>d.active!==false).forEach(d=>{
      const f = feeUntuk(d);
      const sasaran = d.product_id ? n.produk.filter(p=>p.id===d.product_id) : n.produk;
      const rugi = sasaran.filter(p=>hasilDiskon(p, d, f).laba < 0);
      if (rugi.length) bermasalah.push(`${d.name} (${rugi.map(p=>p.name).join(", ")})`);
      const share = (Number(d.share_pct)||0)/100;
      if (share > 0) sasaran.forEach(p=>{
        labaTurun += -hasilDiskon(p, d, f).selisihLaba * (Number(p.qty_month)||0) * share;
      });
    });
    if (bermasalah.length)
      out.push({ tone:C.neg, m:`Ada skema diskon yang membuat produk rugi per unit: ${bermasalah.join("; ")}. Perbaiki besarannya di tahap 3, atau batasi hanya untuk produk bermargin lebar.` });
    if (labaTurun > 0 && n.labaBln > 0) {
      const porsi = labaTurun/n.labaBln;
      if (porsi >= 1)
        out.push({ tone:C.neg, m:`Promo yang direncanakan memangkas laba ${money(labaTurun)}/bulan — melebihi laba proyeksi itu sendiri (${money(n.labaBln)}). Dengan skema ini rencananya rugi.` });
      else if (porsi >= 0.3)
        out.push({ tone:C.brass, m:`Promo yang direncanakan memangkas ${pct(porsi)} dari laba bulanan (${money(labaTurun)}). Masih untung, tapi pastikan promo ini benar-benar menambah volume — bukan cuma memberi diskon ke pembeli yang toh akan beli.` });
    }
  }
  if (r.status === "ide")
    out.push({ tone:C.sub, m:"Status masih Ide. Pindahkan ke Kajian setelah anggarannya dihitung serius." });
  return out;
}

// ============================================================
// LAPORAN OWNER — ringkasan eksekutif + detail lengkap, siap PDF
// ============================================================
function OwnerReport({ orgId, orgName, accounts }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(()=>{ (async()=>{
    try {
      const [ , end] = periodRange(YEAR, "all");
      const start = `${YEAR}-01-01`;
      const [pnl, sheet, retained, bal, trend, ach, target] = await Promise.all([
        rpcPnl(orgId, start, end),
        rpcBalanceSheet(orgId, end),
        rpcRetainedProfit(orgId, end),
        rpcAccountBalances(orgId, start, end),
        rpcMonthlyTrend(orgId, YEAR),
        getAchievement(orgId, YEAR),
        getTarget(orgId, YEAR),
      ]);
      setData({ pnl, sheet, retained, bal, trend, ach, target });
    } catch(e){ setErr(e.message); }
  })(); /* eslint-disable-next-line */ }, [orgId]);

  if (err) return <Center>Gagal memuat: {err}</Center>;
  if (!data) return <Center>Menyiapkan laporan…</Center>;

  const { pnl, sheet, retained, bal, trend, ach, target } = data;
  const S=(type,branch)=>pnl.filter(r=>r.type===type&&(!branch||r.branch===branch)).reduce((s,r)=>s+Number(r.amount),0);
  const rev=S("Pendapatan"), cogs=S("COGS"), opBank=S("Beban Op"), kasBeban=S("Beban Kas"),
    oi=S("Other Income"), oe=S("Other Expense");
  const totalBeban=cogs+opBank+kasBeban+oe;
  const laba=rev-totalBeban+oi;
  const npm=rev?laba/rev:0;
  const aset=sheet.filter(a=>["Kas & Bank","Akun Piutang","Aktiva Tetap"].includes(a.type)).reduce((s,a)=>s+Number(a.balance),0);
  const hutang=sheet.filter(a=>a.type==="Kewajiban").reduce((s,a)=>s+Number(a.balance),0);
  const bankBal=bal.filter(b=>b.code==="1-10002").reduce((s,b)=>s+Number(b.balance),0);
  const kasBal=bal.filter(b=>b.code==="1-10007").reduce((s,b)=>s+Number(b.balance),0);
  const tP=target?Number(target.target_pendapatan):0;
  const cabang = perCabang(pnl, accounts);
  const totalRevCabang = cabang.reduce((s,b)=>s+b.rev,0);

  const trendData = (trend||[]).map(t=>({ m:MONTHS[Number(t.bulan)-1]?.slice(0,3)||t.bulan,
    rev:Number(t.pendapatan), profit:Number(t.laba) }));

  const KPI=({label,val,tone})=>(
    <div style={{ border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 16px" }}>
      <div style={{ fontSize:12, color:C.sub }}>{label}</div>
      <div className="mono" style={{ fontSize:19, fontWeight:700, color:tone||C.ink, marginTop:4 }}>{val}</div>
    </div>
  );

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:12, letterSpacing:".12em", color:C.brass, fontWeight:600, textTransform:"uppercase" }}>Laporan untuk Owner</div>
          <h1 style={{ margin:"5px 0 3px", fontSize:25, fontWeight:700 }}>{orgName}</h1>
          <div style={{ color:C.sub, fontSize:13.5 }}>Ringkasan Keuangan Tahun {YEAR} · dicetak {new Date().toLocaleDateString("id-ID")}</div>
        </div>
        <button className="btn no-print" onClick={()=>window.print()}
          style={{ display:"flex", alignItems:"center", gap:6, background:C.deep, color:"#fff",
            padding:"10px 18px", borderRadius:9, fontSize:13, fontWeight:600 }}>
          <Printer size={15} /> Simpan PDF</button>
      </div>

      {/* Ringkasan eksekutif */}
      <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>Ringkasan Eksekutif</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
          <KPI label="Total Pendapatan" val={money(rev)} tone={C.teal} />
          <KPI label="Total Beban" val={money(totalBeban)} tone={C.neg} />
          <KPI label="Laba Bersih" val={money(laba)} tone={C.pos} />
          <KPI label="Margin Laba" val={pct(npm)} tone={npm>=0.15?C.pos:C.neg} />
          <KPI label="Saldo Bank" val={money(bankBal)} />
          <KPI label="Saldo Kas" val={money(kasBal)} />
          <KPI label="Total Aset" val={money(aset)} />
          <KPI label="Total Hutang" val={money(hutang)} tone={hutang>0?C.neg:C.sub} />
        </div>
      </div>

      {/* Grafik tren */}
      <div className="card" style={{ padding:"18px 18px 8px", marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14.5, marginBottom:2 }}>Tren Pendapatan & Laba {YEAR}</div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={trendData} margin={{ left:-18, right:6, top:10 }}>
            <defs>
              <linearGradient id="or" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.35}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
              <linearGradient id="op" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.pos} stopOpacity={.25}/><stop offset="100%" stopColor={C.pos} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize:12, fill:C.sub }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:C.sub }} tickFormatter={moneyShort} axisLine={false} tickLine={false} width={54} />
            <Tooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:10, border:`1px solid ${C.line}`, fontSize:12 }} />
            <Area type="monotone" dataKey="rev" stroke={C.teal} strokeWidth={2.4} fill="url(#or)" name="Pendapatan" />
            <Area type="monotone" dataKey="profit" stroke={C.pos} strokeWidth={2.4} fill="url(#op)" name="Laba" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performa per cabang */}
      {cabang.length>0 && (
        <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Performa per Cabang {YEAR}</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>
            Kontribusi laba = pendapatan cabang − biaya operasional cabang (belum dipotong beban umum)
          </div>

          {/* ringkasan kartu per cabang */}
          <div className="grid-auto" style={{ display:"grid",
            gridTemplateColumns:`repeat(${Math.min(cabang.length,3)},1fr)`, gap:12, marginBottom:16 }}>
            {cabang.map(b=>{
              const eff = b.rev ? b.kontrib/b.rev : 0;
              return (
                <div key={b.nama} style={{ border:`1px solid ${C.line}`, borderRadius:12,
                  borderLeft:`4px solid ${b.warna}`, padding:"13px 15px" }}>
                  <div style={{ fontWeight:700, fontSize:13.5, marginBottom:8 }}>{b.nama}</div>
                  <ORowMini l="Pendapatan" v={b.rev} c={C.pos} />
                  <ORowMini l="Operasional" v={b.op} c={C.neg} />
                  <div style={{ borderTop:`1px solid ${C.line}`, marginTop:6, paddingTop:6 }}>
                    <ORowMini l="Kontribusi laba" v={b.kontrib} c={b.kontrib>=0?C.pos:C.neg} bold />
                  </div>
                  <div style={{ marginTop:8, fontSize:11, color:C.sub }}>
                    {b.rev>0
                      ? <>Efisiensi <b>{pct(eff)}</b>{totalRevCabang>0 && <> · porsi omzet <b>{pct(b.rev/totalRevCabang)}</b></>}</>
                      : "Belum ada pendapatan tahun ini"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* tabel ringkas untuk cetak */}
          <div className="scroll-x" style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr 90px",
              padding:"9px 14px", background:C.deep, color:"#DDECEC", fontSize:10.5, fontWeight:600 }}>
              <span>CABANG</span>
              <span style={{ textAlign:"right" }}>PENDAPATAN</span>
              <span style={{ textAlign:"right" }}>OPERASIONAL</span>
              <span style={{ textAlign:"right" }}>KONTRIBUSI LABA</span>
              <span style={{ textAlign:"center" }}>PORSI</span>
            </div>
            {cabang.map(b=>(
              <div key={b.nama} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr 90px",
                padding:"9px 14px", borderBottom:`1px solid ${C.line}`, fontSize:12, alignItems:"center" }}>
                <span style={{ display:"flex", alignItems:"center", gap:7, fontWeight:600, color:C.deep }}>
                  <span style={{ width:8, height:8, borderRadius:99, background:b.warna }} />{b.nama}</span>
                <span className="mono" style={{ textAlign:"right" }}>{money(b.rev)}</span>
                <span className="mono" style={{ textAlign:"right", color:C.neg }}>{money(b.op)}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:700,
                  color:b.kontrib>=0?C.pos:C.neg }}>{money(b.kontrib)}</span>
                <span className="mono" style={{ textAlign:"center", color:C.sub }}>
                  {totalRevCabang>0 ? pct(b.rev/totalRevCabang) : "–"}</span>
              </div>
            ))}
            <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr 90px",
              padding:"11px 14px", background:C.surf, fontSize:12, fontWeight:700 }}>
              <span>TOTAL CABANG</span>
              <span className="mono" style={{ textAlign:"right" }}>{money(totalRevCabang)}</span>
              <span className="mono" style={{ textAlign:"right", color:C.neg }}>
                {money(cabang.reduce((s,b)=>s+b.op,0))}</span>
              <span className="mono" style={{ textAlign:"right", color:C.pos }}>
                {money(cabang.reduce((s,b)=>s+b.kontrib,0))}</span>
              <span style={{ textAlign:"center" }}>100%</span>
            </div>
          </div>
          {rev > totalRevCabang && (
            <div style={{ fontSize:11, color:C.sub, marginTop:10, lineHeight:1.5 }}>
              Ada {money(rev-totalRevCabang)} pendapatan yang belum diberi cabang (akun umum), sehingga
              total cabang di atas lebih kecil dari total pendapatan {money(rev)}.
            </div>
          )}
        </div>
      )}

      {/* Target vs pencapaian */}
      {target && (
        <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
          <div style={{ fontWeight:600, fontSize:14.5, marginBottom:12 }}>Pencapaian Target {YEAR}</div>
          {[
            { l:"Pendapatan", a:Number(ach.pendapatan), t:tP, m:true },
            { l:"Laba Bersih", a:Number(ach.laba), t:Number(target.target_laba), m:true },
            { l:"Jumlah Transaksi", a:Number(ach.transaksi), t:Number(target.target_transaksi), m:false },
          ].map(x=>{ const p=x.t?x.a/x.t:0; return (
            <div key={x.l} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, marginBottom:5 }}>
                <span style={{ fontWeight:600 }}>{x.l}</span>
                <span className="mono">{x.m?money(x.a):x.a.toLocaleString("id-ID")} / {x.m?money(x.t):x.t.toLocaleString("id-ID")} · <b style={{ color:p>=1?C.pos:C.brass }}>{pct(p)}</b></span>
              </div>
              <div style={{ height:8, borderRadius:99, background:C.surf, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, background:p>=1?C.pos:C.teal, width:`${Math.min(100,p*100)}%` }} /></div>
            </div>
          );})}
        </div>
      )}

      {/* Laba Rugi ringkas */}
      <div className="card" style={{ overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"12px 20px", background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>LAPORAN LABA RUGI {YEAR}</div>
        <ORow l="Total Pendapatan" v={rev} c={C.pos} />
        <ORow l="Cost of Goods Sold" v={-cogs} />
        <ORow l="Biaya Operasional (Bank)" v={-opBank} />
        <ORow l="Beban Umum & Admin (Kas)" v={-kasBeban} />
        {oi>0 && <ORow l="Pendapatan Lain" v={oi} c={C.pos} />}
        {oe>0 && <ORow l="Beban Lain" v={-oe} />}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 200px", padding:"13px 20px",
          background:laba>=0?C.pos+"12":C.neg+"12", fontWeight:700, fontSize:14 }}>
          <span>LABA BERSIH</span>
          <span className="mono" style={{ textAlign:"right", color:laba>=0?C.pos:C.neg }}>{money(laba)}</span></div>
      </div>

      {/* Neraca ringkas */}
      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ padding:"12px 20px", background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>POSISI KEUANGAN (NERACA) {YEAR}</div>
        <ORow l="Total Aset" v={aset} />
        <ORow l="Total Kewajiban (Hutang)" v={hutang} c={hutang>0?C.neg:C.sub} />
        <ORow l="Total Modal + Laba" v={aset-hutang} c={C.brass} />
      </div>
    </div>
  );
}
const ORow = ({ l, v, c }) => (
  <div style={{ display:"grid", gridTemplateColumns:"1fr 200px", padding:"10px 20px",
    borderBottom:`1px solid ${C.line}`, fontSize:13 }}>
    <span style={{ color:C.sub }}>{l}</span>
    <span className="mono" style={{ textAlign:"right", fontWeight:600, color:c||C.ink }}>{money(v)}</span>
  </div>
);
const ORowMini = ({ l, v, c, bold }) => (
  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0" }}>
    <span style={{ color:bold?C.ink:C.sub, fontWeight:bold?600:400 }}>{l}</span>
    <span className="mono" style={{ fontWeight:bold?700:600, color:c||C.ink }}>{money(v)}</span>
  </div>
);

// ============================================================
// SALDO AWAL (Opening Balance) — tetapkan posisi awal, modal owner penyeimbang
// ============================================================
function SaldoAwal({ orgId, accounts, acctByCode, onChange }) {
  const [sudahAda, setSudahAda] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [date, setDate] = useState(`${YEAR}-01-01`);
  // baris aset/kewajiban yang dimiliki di awal (selain modal)
  const asetAkun = accounts.filter(a=>["Kas & Bank","Akun Piutang","Aktiva Tetap","Kewajiban"].includes(a.type)
    && a.is_active!==false && a.code!=="1-10800");
  const [lines, setLines] = useState([{ account_id: asetAkun[0]?.id || "", amount:"" }]);

  useEffect(()=>{ (async()=>{
    try { setSudahAda(await hasOpeningBalance(orgId)); } catch(e){ setFlash("✗ "+e.message); }
  })(); }, [orgId]);

  const modalId = acctByCode["3-30001"]?.id;
  const setLine=(i,f,v)=>setLines(lines.map((l,x)=>x===i?{...l,[f]:v}:l));
  const addLine=()=>setLines([...lines,{account_id:asetAkun[0]?.id||"",amount:""}]);
  const rmLine=(i)=>setLines(lines.filter((_,x)=>x!==i));

  // hitung: aset (normal Db) di debet, kewajiban (normal Kr) di kredit; modal = penyeimbang
  const calc = lines.map(l=>{
    const acc = accounts.find(a=>a.id===l.account_id);
    const amt = +l.amount||0;
    return { acc, amt, isAset: acc?.normal_side==="Db" };
  }).filter(x=>x.acc && x.amt>0);
  const totalAset = calc.filter(x=>x.isAset).reduce((s,x)=>s+x.amt,0);
  const totalKewajiban = calc.filter(x=>!x.isAset).reduce((s,x)=>s+x.amt,0);
  const modalPenyeimbang = totalAset - totalKewajiban; // modal owner

  const simpan = async () => {
    if (calc.length===0) { setFlash("✗ Isi minimal satu akun & nominal"); return; }
    if (modalPenyeimbang < 0) { setFlash("✗ Kewajiban melebihi aset — cek angka"); return; }
    setBusy(true); setFlash("");
    try {
      const jl = [];
      calc.forEach(x=>{
        if (x.isAset) jl.push({ account_id:x.acc.id, debit:x.amt, credit:0 });
        else jl.push({ account_id:x.acc.id, debit:0, credit:x.amt });
      });
      // modal owner sebagai penyeimbang (kredit)
      if (modalPenyeimbang > 0) jl.push({ account_id: modalId, debit:0, credit: modalPenyeimbang });
      await saveOpeningBalance(orgId, date, jl);
      setFlash("✓ Saldo awal tersimpan");
      setSudahAda(true);
      onChange();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="pop">
      <PageHead eyebrow="Master Data" title="Saldo Awal"
        sub="Tetapkan posisi awal aset & kewajiban — Modal Owner otomatis jadi penyeimbang" />

      {sudahAda && (
        <div className="card" style={{ padding:"14px 18px", marginBottom:16, background:C.brass+"10",
          border:`1px solid ${C.brass}40`, fontSize:13, color:C.ink }}>
          <b style={{ color:C.brass }}>⚠ Saldo awal sudah pernah dibuat.</b> Menambah lagi akan membuat jurnal
          saldo awal kedua (bisa menyebabkan dobel). Pastikan ini memang yang Anda inginkan.
        </div>
      )}

      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontSize:12.5, color:C.sub, marginBottom:14, lineHeight:1.6, background:C.surf, padding:"12px 14px", borderRadius:8 }}>
          <b>Cara pakai:</b> masukkan aset yang dimiliki Samudra pada tanggal mulai pencatatan (mis. saldo kas,
          peralatan, dll) dan kewajiban/hutang awal (kalau ada). Sistem menghitung <b>Modal Owner</b> sebagai
          penyeimbang secara otomatis (Aset − Kewajiban = Modal). Karena uang beroperasi lewat rekening owner,
          Anda cukup catat aset yang benar-benar dimiliki entitas — sisanya jadi modal owner.
        </div>

        <div style={{ marginBottom:14, maxWidth:200 }}>
          <label style={lbl}>Tanggal Saldo Awal</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 180px 40px", gap:8, fontSize:11.5,
          color:C.sub, fontWeight:600, padding:"0 2px 6px" }}>
          <span>AKUN (aset / kewajiban)</span><span style={{ textAlign:"right" }}>NILAI</span><span /></div>
        {lines.map((l,i)=>(
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 180px 40px", gap:8, marginBottom:7, alignItems:"center" }}>
            <select value={l.account_id} onChange={e=>setLine(i,"account_id",e.target.value)} style={inp}>
              {asetAkun.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name} ({a.type})</option>)}
            </select>
            <input className="mono" inputMode="numeric" placeholder="0" value={l.amount}
              onChange={e=>setLine(i,"amount",e.target.value.replace(/\D/g,""))} style={{ ...inp, textAlign:"right" }} />
            <button className="btn" onClick={()=>rmLine(i)} disabled={lines.length<=1}
              style={{ background:"transparent", color:lines.length<=1?C.line:C.neg, display:"grid", placeItems:"center", height:38 }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="btn" onClick={addLine}
          style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.surf, color:C.teal,
            padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:600, marginTop:4 }}>
          <Plus size={15} /> Tambah baris</button>

        <div style={{ marginTop:16, padding:"12px 14px", borderRadius:10, background:C.surf, fontSize:13 }}>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
            <span style={{ color:C.sub }}>Total Aset</span>
            <span className="mono" style={{ fontWeight:600 }}>{money(totalAset)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
            <span style={{ color:C.sub }}>Total Kewajiban</span>
            <span className="mono" style={{ fontWeight:600, color:C.neg }}>{money(totalKewajiban)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0 0", marginTop:4, borderTop:`1px solid ${C.line}` }}>
            <span style={{ fontWeight:700 }}>Modal Owner (penyeimbang)</span>
            <span className="mono" style={{ fontWeight:700, color:C.teal }}>{money(modalPenyeimbang)}</span></div>
        </div>

        <button className="btn" onClick={simpan} disabled={busy||calc.length===0}
          style={{ width:"100%", marginTop:14, padding:"12px", borderRadius:10,
            background: calc.length&&!busy?C.teal:C.line, color:"#fff", fontWeight:700, fontSize:14.5 }}>
          {busy?"Menyimpan…":"Simpan Saldo Awal"}</button>
        {flash && <div className="pop" style={{ marginTop:10, textAlign:"center",
          color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}
      </div>
    </div>
  );
}

// ============================================================
// PENDAPATAN DITERIMA DI MUKA (agregat) — pengakuan bertahap sesuai SAK
// ============================================================
function Deferred({ orgId, acctByCode, accounts, onChange }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const now = new Date();
  // kalau tahun buku bukan tahun berjalan, pakai akhir tahun sebagai batas pengakuan
  const asOf = now.getFullYear()===YEAR
    ? `${YEAR}-${String(now.getMonth()+1).padStart(2,"0")}-28`
    : `${YEAR}-12-28`;
  const revenueAccounts = accounts.filter(a=>a.type==="Pendapatan" && a.is_active!==false);
  const blank = () => ({ received_date:`${YEAR}-01-01`, description:"", total_amount:"",
    months:"3", cash:"bank", revenueCode:"4-40000" });
  const [form, setForm] = useState(blank());

  const reload = async () => {
    try { setRows(await getDeferredSummary(orgId, asOf)); } catch(e){ setFlash("✗ "+e.message); }
  };
  useEffect(()=>{ if(orgId) reload(); /* eslint-disable-next-line */ }, [orgId]);

  const simpan = async () => {
    if (!form.total_amount || !form.months) { setFlash("✗ Jumlah & lama bulan wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      await addDeferredRevenue(orgId, {
        received_date: form.received_date, description: form.description,
        total_amount: +form.total_amount||0, months: +form.months||1, cash: form.cash,
      }, acctByCode);
      setFlash("✓ Penerimaan di muka tercatat sebagai kewajiban");
      setForm(blank()); setShowForm(false);
      reload(); onChange();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  const hapus = async (d) => {
    if (!confirm("Hapus catatan pendapatan diterima di muka ini? (jurnal terkait tetap ada)")) return;
    try { await deleteDeferredRevenue(d.id); reload(); } catch(e){ alert(e.message); }
  };

  const akuiSemua = async (d) => {
    if (!confirm(`Akui semua pendapatan ${d.description||""} yang sudah jatuh tempo s/d sekarang?`)) return;
    setBusy(true); setFlash("");
    try {
      const n = await recognizeAllDue(orgId, d, asOf, acctByCode, "4-40000");
      setFlash(n>0?`✓ ${n} bulan pendapatan diakui`:"Semua sudah diakui sebelumnya");
      reload(); onChange();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  const totalDiterima = rows.reduce((s,d)=>s+Number(d.total_amount),0);
  const totalDiakui = rows.reduce((s,d)=>s+Number(d.recognized),0);
  const totalSisa = rows.reduce((s,d)=>s+Number(d.remaining),0);

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Master Data" title="Pendapatan Diterima di Muka"
          sub="Iuran/paket dibayar di depan — diakui bertahap tiap bulan (sesuai SAK)" />
        <button className="btn no-print" onClick={()=>{ setShowForm(!showForm); setFlash(""); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:showForm?C.surf:C.teal,
            color:showForm?C.sub:"#fff", padding:"9px 16px", borderRadius:9, fontSize:13, fontWeight:600, marginTop:4 }}>
          {showForm ? <><X size={15}/> Tutup</> : <><Plus size={15}/> Catat Penerimaan</>}
        </button>
      </div>

      {showForm && (
        <div className="card pop" style={{ padding:20, marginBottom:16, border:`2px solid ${C.teal}` }}>
          <div style={{ fontSize:12.5, color:C.sub, marginBottom:14, lineHeight:1.6, background:C.surf, padding:"12px 14px", borderRadius:8 }}>
            <b>Contoh:</b> 10 siswa bayar paket 3 bulan @Rp 900.000 = Rp 9.000.000 diterima Januari.
            Isi total Rp 9.000.000, lama 3 bulan. Sistem mencatatnya dulu sebagai <b>kewajiban</b> (belum jadi
            pendapatan), lalu tiap bulan Anda "akui" Rp 3.000.000 jadi pendapatan sampai habis. Ini sesuai
            prinsip SAK: pendapatan diakui saat jasa diberikan, bukan saat uang diterima.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"150px 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Tanggal Terima</label>
              <input type="date" value={form.received_date} onChange={e=>setForm({...form,received_date:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Keterangan</label>
              <input placeholder="mis. Paket 3 bulan batch Januari" value={form.description}
                onChange={e=>setForm({...form,description:e.target.value})} style={inp} /></div>
          </div>
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label style={lbl}>Total Diterima (Rp)</label>
              <input className="mono" inputMode="numeric" placeholder="9000000" value={form.total_amount}
                onChange={e=>setForm({...form,total_amount:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Diakui selama (bulan)</label>
              <input className="mono" inputMode="numeric" placeholder="3" value={form.months}
                onChange={e=>setForm({...form,months:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Uang masuk ke</label>
              <select value={form.cash} onChange={e=>setForm({...form,cash:e.target.value})}
                style={{ ...inp, fontWeight:600, color:form.cash==="bank"?C.teal:C.kas }}>
                <option value="bank">Bank BCA</option><option value="kas">Kas</option></select></div>
          </div>
          {form.total_amount && form.months && (
            <div style={{ fontSize:12.5, color:C.teal, fontWeight:600, marginBottom:12 }}>
              → Akan diakui {money((+form.total_amount||0)/(+form.months||1))}/bulan selama {form.months} bulan
            </div>
          )}
          <button className="btn" onClick={simpan} disabled={busy||!form.total_amount}
            style={{ width:"100%", padding:"11px", borderRadius:9,
              background:(form.total_amount&&!busy)?C.teal:C.line, color:"#fff", fontWeight:700, fontSize:14 }}>
            {busy?"Menyimpan…":"Simpan Penerimaan"}</button>
        </div>
      )}
      {flash && <div className="pop" style={{ textAlign:"center", marginBottom:14,
        color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}

      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:16 }}>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Total Diterima</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6 }}>{money(totalDiterima)}</div></div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Sudah Diakui (Pendapatan)</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6, color:C.pos }}>{money(totalDiakui)}</div></div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Sisa Kewajiban</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6, color:C.brass }}>{money(totalSisa)}</div></div>
      </div>

      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 110px 80px 110px 110px 120px", padding:"11px 18px",
          background:C.deep, color:"#DDECEC", fontSize:11.5, fontWeight:600 }}>
          <span>KETERANGAN</span>
          <span style={{ textAlign:"right" }}>TOTAL</span>
          <span style={{ textAlign:"center" }}>/BLN</span>
          <span style={{ textAlign:"right" }}>DIAKUI</span>
          <span style={{ textAlign:"right" }}>SISA</span>
          <span style={{ textAlign:"right" }}>AKSI</span></div>
        {rows.length===0 && <div style={{ padding:"20px 18px", color:C.sub, fontSize:13 }}>Belum ada. Klik "Catat Penerimaan".</div>}
        {rows.map(d=>{
          const belumAkui = Number(d.remaining) > 0.5;
          const perluAkui = Number(d.months_due) * Number(d.per_month) - Number(d.recognized) > 0.5;
          return (
            <div key={d.id} style={{ display:"grid", gridTemplateColumns:"1.6fr 110px 80px 110px 110px 120px",
              padding:"11px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center" }}>
              <span><b style={{ color:C.deep }}>{d.description||"(tanpa keterangan)"}</b>
                <div style={{ fontSize:10.5, color:C.sub }}>Terima: {d.received_date} · {d.months} bulan</div></span>
              <span className="mono" style={{ textAlign:"right" }}>{money(Number(d.total_amount))}</span>
              <span className="mono" style={{ textAlign:"center", color:C.sub, fontSize:11 }}>{money(Number(d.per_month))}</span>
              <span className="mono" style={{ textAlign:"right", color:C.pos }}>{money(Number(d.recognized))}</span>
              <span className="mono" style={{ textAlign:"right", fontWeight:700, color:belumAkui?C.brass:C.sub }}>{money(Number(d.remaining))}</span>
              <span className="no-print" style={{ display:"flex", gap:5, justifyContent:"flex-end", alignItems:"center", paddingLeft:8 }}>
                {perluAkui && <button className="btn" onClick={()=>akuiSemua(d)} disabled={busy} title="Akui pendapatan jatuh tempo"
                  style={{ background:C.teal, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 9px", borderRadius:6, whiteSpace:"nowrap" }}>
                  AKUI</button>}
                <button className="btn" onClick={()=>hapus(d)} title="Hapus"
                  style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:2 }}><Trash2 size={14} /></button>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11.5, color:C.sub, marginTop:12, lineHeight:1.6 }}>
        <b>Cara kerja (SAK — pengakuan pendapatan):</b> saat terima uang di muka, dicatat sebagai <b>kewajiban</b>
        (Pendapatan Diterima di Muka), bukan langsung pendapatan. Tombol <b>AKUI</b> memindahkan porsi bulan yang
        sudah berjalan menjadi pendapatan riil (Debet "Pendapatan Diterima di Muka", Kredit "Pendapatan").
        Ini membuat Laba Rugi mencerminkan jasa yang benar-benar sudah diberikan. Catat secara <b>agregat</b>
        (gabungan banyak siswa), tidak perlu per individu.
      </div>
    </div>
  );
}

// ============================================================
// ASET TETAP & PENYUSUTAN (garis lurus, sesuai SAK EMKM)
// ============================================================
function AsetTetap({ orgId, acctByCode, accounts }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const now = new Date();
  // batas perhitungan penyusutan mengikuti tahun buku yang dipilih
  const asOf = now.getFullYear()===YEAR
    ? `${YEAR}-${String(now.getMonth()+1).padStart(2,"0")}-28`
    : `${YEAR}-12-28`;
  const blank = () => ({ name:"", category:"Peralatan", acquire_date:`${YEAR}-01-01`,
    cost:"", residual:"", useful_life_years:"5", account_asset:"1-10705" });
  const [form, setForm] = useState(blank());

  const reload = async () => {
    try { setRows(await rpcAssetDepreciation(orgId, asOf)); }
    catch(e){ setFlash("✗ "+e.message); }
  };
  useEffect(()=>{ if(orgId) reload(); /* eslint-disable-next-line */ }, [orgId]);

  const simpan = async () => {
    if (!form.name || !form.cost) { setFlash("✗ Nama & harga wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      const payload = {
        name: form.name, category: form.category, acquire_date: form.acquire_date,
        cost: +form.cost||0, residual: +form.residual||0,
        useful_life_years: +form.useful_life_years||1, account_asset: form.account_asset,
      };
      if (editId) { await updateFixedAsset(editId, payload); setFlash("✓ Aset diperbarui"); }
      else { await addFixedAsset(orgId, payload); setFlash("✓ Aset ditambahkan"); }
      setForm(blank()); setShowForm(false); setEditId(null);
      reload();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  const startEdit = (a) => {
    setEditId(a.id); setShowForm(true);
    setForm({ name:a.name, category:a.category||"Peralatan", acquire_date:a.acquire_date,
      cost:String(Math.round(a.cost)), residual:String(Math.round(a.residual)),
      useful_life_years:String(a.useful_life_years), account_asset:"1-10705" });
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  const hapus = async (a) => {
    if (!confirm(`Hapus aset "${a.name}"?`)) return;
    try { await deleteFixedAsset(a.id); reload(); } catch(e){ alert(e.message); }
  };

  // Posting SEMUA bulan tertunggak sekaligus
  const postingSemua = async (a) => {
    const belum = Math.round(Number(a.accumulated)/Number(a.depr_per_month)) - Math.round(Number(a.posted_amount)/Number(a.depr_per_month));
    if (!confirm(`Posting semua penyusutan ${a.name} yang belum tercatat (perkiraan ${belum} bulan)?\n\nSetiap bulan dari perolehan sampai batas periode akan dicatat ke jurnal.`)) return;
    setBusy(true); setFlash("");
    try {
      const n = await postAllOutstanding(orgId, a, asOf, acctByCode);
      setFlash(n>0 ? `✓ ${n} bulan penyusutan ${a.name} berhasil diposting ke jurnal`
                   : `Semua penyusutan ${a.name} sudah tercatat sebelumnya`);
      reload();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  // Modal jadwal per-bulan
  const [schedFor, setSchedFor] = useState(null);   // aset yang dibuka jadwalnya
  const [sched, setSched] = useState([]);
  const bukaJadwal = async (a) => {
    setSchedFor(a); setSched([]);
    try { setSched(await getDepreciationSchedule(orgId, a.id, asOf)); }
    catch(e){ setFlash("✗ "+e.message); }
  };
  const postingSatuBulan = async (a, s) => {
    setBusy(true);
    try {
      await postDepreciationMonth(orgId, a, s.period_year, s.period_month, Number(s.amount), acctByCode);
      setSched(await getDepreciationSchedule(orgId, a.id, asOf));
      reload();
    } catch(e){ setFlash("✗ "+e.message); }
    finally { setBusy(false); }
  };

  const totalCost = rows.reduce((s,a)=>s+Number(a.cost),0);
  const totalAkum = rows.reduce((s,a)=>s+Number(a.accumulated),0);
  const totalBuku = rows.reduce((s,a)=>s+Number(a.book_value),0);

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Master Data" title="Aset Tetap & Penyusutan"
          sub={`Metode garis lurus — dihitung s/d ${asOf}`} />
        <button className="btn no-print" onClick={()=>{ setShowForm(!showForm); setEditId(null); setForm(blank()); setFlash(""); }}
          style={{ display:"flex", alignItems:"center", gap:6, background:showForm?C.surf:C.teal,
            color:showForm?C.sub:"#fff", padding:"9px 16px", borderRadius:9, fontSize:13, fontWeight:600, marginTop:4 }}>
          {showForm ? <><X size={15}/> Tutup</> : <><Plus size={15}/> Tambah Aset</>}
        </button>
      </div>

      {showForm && (
        <div className="card pop" style={{ padding:20, marginBottom:16, border:`2px solid ${editId?C.brass:C.teal}` }}>
          {editId && <div style={{ marginBottom:12, fontSize:13, fontWeight:600, color:C.brass }}>
            <Pencil size={14} style={{ verticalAlign:"-2px", marginRight:6 }} />Edit aset</div>}
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Nama Aset</label>
              <input placeholder="mis. Alat Latihan Renang" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Kategori</label>
              <input placeholder="mis. Peralatan" value={form.category}
                onChange={e=>setForm({...form,category:e.target.value})} style={inp} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label style={lbl}>Tanggal Beli</label>
              <input type="date" value={form.acquire_date}
                onChange={e=>setForm({...form,acquire_date:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Harga Beli (Rp)</label>
              <input className="mono" inputMode="numeric" placeholder="10000000" value={form.cost}
                onChange={e=>setForm({...form,cost:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Nilai Residu (Rp)</label>
              <input className="mono" inputMode="numeric" placeholder="0" value={form.residual}
                onChange={e=>setForm({...form,residual:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
            <div><label style={lbl}>Umur (tahun)</label>
              <input className="mono" inputMode="numeric" placeholder="5" value={form.useful_life_years}
                onChange={e=>setForm({...form,useful_life_years:e.target.value.replace(/\D/g,"")})} style={inp} /></div>
          </div>
          <div style={{ fontSize:11.5, color:C.sub, marginBottom:12, lineHeight:1.5, background:C.surf, padding:"10px 12px", borderRadius:8 }}>
            <b>Nilai Residu</b> = perkiraan nilai jual aset di akhir masa manfaat (isi 0 kalau tidak ada).
            Penyusutan/bulan = (Harga − Residu) ÷ (Umur × 12).
            {form.cost && form.useful_life_years && <span style={{ color:C.teal, fontWeight:600 }}>
              {" "}→ Estimasi: {money(((+form.cost||0)-(+form.residual||0))/((+form.useful_life_years||1)*12))}/bulan</span>}
          </div>
          <button className="btn" onClick={simpan} disabled={busy||!form.name||!form.cost}
            style={{ width:"100%", padding:"11px", borderRadius:9,
              background:(form.name&&form.cost&&!busy)?(editId?C.brass:C.teal):C.line, color:"#fff", fontWeight:700, fontSize:14 }}>
            {busy?"Menyimpan…":(editId?"Simpan Perubahan":"Simpan Aset")}</button>
        </div>
      )}
      {flash && <div className="pop" style={{ textAlign:"center", marginBottom:14,
        color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}

      {/* ringkasan */}
      <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:16 }}>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Total Harga Perolehan</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6 }}>{money(totalCost)}</div></div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Akumulasi Penyusutan</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6, color:C.neg }}>{money(totalAkum)}</div></div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:12.5, color:C.sub }}>Nilai Buku (Sisa)</div>
          <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:6, color:C.teal }}>{money(totalBuku)}</div></div>
      </div>

      {/* daftar aset */}
      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 105px 95px 70px 105px 110px 160px", padding:"11px 18px",
          background:C.deep, color:"#DDECEC", fontSize:11.5, fontWeight:600 }}>
          <span>NAMA ASET</span>
          <span style={{ textAlign:"right" }}>HARGA</span>
          <span style={{ textAlign:"right" }}>SUSUT/BLN</span>
          <span style={{ textAlign:"center" }}>BULAN</span>
          <span style={{ textAlign:"right" }}>AKUMULASI</span>
          <span style={{ textAlign:"right" }}>NILAI BUKU</span>
          <span style={{ textAlign:"right" }}>AKSI</span></div>
        {rows.length===0 && <div style={{ padding:"20px 18px", color:C.sub, fontSize:13 }}>Belum ada aset. Klik "Tambah Aset" untuk mulai.</div>}
        {rows.map(a=>{
          const lunas = Number(a.book_value) <= Number(a.residual);
          const posted = Number(a.posted_amount);
          const seharusnya = Number(a.accumulated);
          const tertunggak = seharusnya - posted;   // yang belum diposting
          const adaTertunggak = tertunggak > 0.5;
          return (
            <div key={a.id} style={{ display:"grid", gridTemplateColumns:"1.5fr 105px 95px 70px 105px 110px 160px",
              padding:"11px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center" }}>
              <span><b style={{ color:C.deep }}>{a.name}</b>
                {a.category && <span style={{ fontSize:10.5, color:C.sub }}> · {a.category}</span>}
                <div style={{ fontSize:10.5, color:C.sub }}>Beli: {a.acquire_date} · umur {a.useful_life_years}th
                  {adaTertunggak && <span style={{ color:C.brass, fontWeight:700 }}> · {money(tertunggak)} belum diposting</span>}
                  {!adaTertunggak && posted>0 && <span style={{ color:C.pos, fontWeight:700 }}> · ✓ tercatat</span>}
                </div></span>
              <span className="mono" style={{ textAlign:"right" }}>{money(Number(a.cost))}</span>
              <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(Number(a.depr_per_month))}</span>
              <span style={{ textAlign:"center", color:C.sub }}>{a.months_elapsed}/{a.useful_life_years*12}</span>
              <span className="mono" style={{ textAlign:"right", color:C.neg }}>{money(Number(a.accumulated))}</span>
              <span className="mono" style={{ textAlign:"right", fontWeight:700, color:lunas?C.sub:C.teal }}>{money(Number(a.book_value))}</span>
              <span className="no-print" style={{ display:"flex", gap:5, justifyContent:"flex-end", alignItems:"center", paddingLeft:8 }}>
                {adaTertunggak && <button className="btn" onClick={()=>postingSemua(a)} disabled={busy} title="Posting semua bulan tertunggak"
                  style={{ background:C.teal, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 9px", borderRadius:6, whiteSpace:"nowrap" }}>
                  POSTING</button>}
                <button className="btn" onClick={()=>bukaJadwal(a)} title="Lihat jadwal per bulan"
                  style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:2 }} disabled={busy}><FileText size={14} /></button>
                <button className="btn" onClick={()=>startEdit(a)} title="Edit"
                  style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:2 }}><Pencil size={14} /></button>
                <button className="btn" onClick={()=>hapus(a)} title="Hapus"
                  style={{ background:"transparent", color:C.sub, display:"grid", placeItems:"center", padding:2 }}><Trash2 size={14} /></button>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11.5, color:C.sub, marginTop:12, lineHeight:1.6 }}>
        <b>Cara kerja (garis lurus, SAK EMKM):</b> tiap bulan aset menyusut sebesar (Harga − Residu) ÷ (Umur × 12).
        Tombol <b>POSTING</b> mencatat <b>semua bulan tertunggak sekaligus</b> ke jurnal (mis. aset dibeli Januari, batas
        periode Juli → 7 bulan langsung tercatat). Ikon <b>dokumen</b> membuka jadwal per bulan kalau Anda ingin posting
        satu-satu. Tiap posting membuat jurnal Debet "Beban Penyusutan", Kredit "Akumulasi Penyusutan" — akumulasi
        mengurangi nilai aset di Neraca, beban muncul di Laba Rugi. Sistem mencegah dobel posting untuk bulan yang sama.
      </div>

      {/* Modal jadwal per bulan */}
      {schedFor && (
        <div className="no-print" onClick={()=>setSchedFor(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,42,42,.45)", display:"grid", placeItems:"center", zIndex:50, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} className="pop"
            style={{ background:"#fff", borderRadius:14, width:"min(560px,100%)", maxHeight:"80vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#fff" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>Jadwal Penyusutan</div>
                <div style={{ fontSize:12.5, color:C.sub }}>{schedFor.name} · {money(Number(schedFor.depr_per_month))}/bulan</div>
              </div>
              <button className="btn" onClick={()=>setSchedFor(null)} style={{ background:"transparent", color:C.sub }}><X size={18} /></button>
            </div>
            <div style={{ padding:"8px 0" }}>
              {sched.length===0 && <div style={{ padding:"18px 20px", color:C.sub, fontSize:13 }}>Memuat jadwal…</div>}
              {sched.map((s,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"10px 20px", borderBottom:`1px solid ${C.line}` }}>
                  <span style={{ fontSize:13 }}>{MONTHS[s.period_month-1]} {s.period_year}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span className="mono" style={{ fontSize:12.5, color:C.sub }}>{money(Number(s.amount))}</span>
                    {s.is_posted
                      ? <span style={{ fontSize:11, fontWeight:700, color:C.pos, minWidth:90, textAlign:"right" }}>✓ Tercatat</span>
                      : <button className="btn" onClick={()=>postingSatuBulan(schedFor, s)} disabled={busy}
                          style={{ background:C.teal, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", borderRadius:6, minWidth:90 }}>
                          Posting</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART OF ACCOUNT
// ============================================================
function COAView({ accounts, orgId, onChange }) {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);      // id akun yang diedit
  const [editUsed, setEditUsed] = useState(false); // apakah akun terpakai (kunci field)
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const blank = () => ({ code:"", name:"", type:"Beban Kas", branch:"",
    normal_side:"Db", statement:"LR", pay_source:"kas" });
  const [form, setForm] = useState(blank());

  const label={bank:"Bank",kas:"Kas"};
  const TIPE = ["Kas & Bank","Akun Piutang","Aktiva Tetap","Kewajiban","Ekuitas",
    "Pendapatan","COGS","Beban Op","Beban Kas","Other Income","Other Expense"];

  const rows = accounts.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())||a.code.includes(q));

  // pilihan cabang = cabang yang sudah dipakai di COA + cabang yang dikenal aplikasi
  const pilihanCabang = (() => {
    const set = new Set(CABANG_DIKENAL);
    accounts.forEach(a=>{ if (a.branch) set.add(a.branch); });
    const ada = [...set];
    const dikenal = CABANG_DIKENAL.filter(c=>ada.includes(c));
    return [...dikenal, ...ada.filter(c=>!CABANG_DIKENAL.includes(c)).sort()];
  })();

  const startEdit = async (a) => {
    setEditId(a.id); setShowForm(true); setFlash("");
    setForm({ code:a.code, name:a.name, type:a.type, branch:a.branch||"",
      normal_side:a.normal_side, statement:a.statement, pay_source:a.pay_source||"" });
    try { setEditUsed((await accountUsedCount(a.id)) > 0); } catch { setEditUsed(false); }
    window.scrollTo({ top:0, behavior:"smooth" });
  };
  const cancelForm = () => { setShowForm(false); setEditId(null); setEditUsed(false); setForm(blank()); setFlash(""); };

  const simpan = async () => {
    if (!form.code || !form.name) { setFlash("✗ Kode dan nama wajib diisi"); return; }
    setBusy(true); setFlash("");
    try {
      if (editId) {
        const wasUsed = await updateAccount(editId, form);
        setFlash(wasUsed ? "✓ Akun diperbarui (hanya nama & sumber, karena sudah dipakai)" : "✓ Akun berhasil diperbarui");
      } else {
        await addAccount(orgId, form);
        setFlash("✓ Akun berhasil ditambahkan");
      }
      cancelForm();
      onChange();
    } catch (e) {
      setFlash("✗ " + (e.message.includes("duplicate") ? "Kode akun sudah ada" : e.message));
    } finally { setBusy(false); }
  };

  const hapus = async (a) => {
    if (!confirm(`Hapus akun ${a.code} · ${a.name}?`)) return;
    setFlash("");
    try { await deleteAccount(a.id); setFlash("✓ Akun dihapus"); onChange(); }
    catch (e) { setFlash("✗ " + e.message); alert(e.message); }
  };

  const toggle = async (a) => {
    try { await setAccountActive(a.id, !a.is_active); onChange(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="pop">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <PageHead eyebrow="Master Data" title="Chart of Account"
          sub={`${accounts.length} akun · berlaku untuk semua tahun buku`} />
        <button className="btn no-print" onClick={()=> showForm ? cancelForm() : setShowForm(true) }
          style={{ display:"flex", alignItems:"center", gap:6, background:showForm?C.surf:C.teal,
            color:showForm?C.sub:"#fff", padding:"9px 16px", borderRadius:9, fontSize:13, fontWeight:600, marginTop:4 }}>
          {showForm ? <><X size={15}/> Tutup</> : <><Plus size={15}/> Tambah Akun</>}
        </button>
      </div>

      {/* Form tambah / edit akun */}
      {showForm && (
        <div className="card pop" style={{ padding:20, marginBottom:16,
          border:`2px solid ${editId?C.brass:C.teal}` }}>
          {editId && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14,
              padding:"8px 12px", borderRadius:8, background:C.brass+"15", color:C.brass, fontWeight:600, fontSize:13 }}>
              <span><Pencil size={14} style={{ verticalAlign:"-2px", marginRight:6 }} />
                Edit akun {form.code}{editUsed && " — sudah dipakai, hanya nama & sumber bisa diubah"}</span>
              <button className="btn" onClick={cancelForm}
                style={{ background:"transparent", color:C.brass, display:"flex", alignItems:"center", gap:4, fontSize:12.5 }}>
                <X size={14} /> Batal</button>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"140px 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Kode Akun</label>
              <input placeholder="mis. 6-60020" value={form.code} disabled={editUsed}
                onChange={e=>setForm({...form,code:e.target.value})}
                style={{ ...inp, background:editUsed?C.surf:"#fff", cursor:editUsed?"not-allowed":"text" }} /></div>
            <div><label style={lbl}>Nama Akun</label>
              <input placeholder="mis. Biaya Perawatan Kolam" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} style={inp} /></div>
          </div>
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Tipe</label>
              <select value={form.type} disabled={editUsed} onChange={e=>{
                const t=e.target.value;
                const kr=["Pendapatan","Ekuitas","Other Income","Kewajiban"].includes(t);
                const nrc=["Kas & Bank","Akun Piutang","Aktiva Tetap","Kewajiban","Ekuitas"].includes(t);
                setForm({...form, type:t, normal_side:kr?"Kr":"Db", statement:nrc?"NRC":"LR"});
              }} style={{ ...inp, background:editUsed?C.surf:"#fff" }}>
                {TIPE.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Cabang</label>
              <select value={form.branch} disabled={editUsed} onChange={e=>setForm({...form,branch:e.target.value})}
                style={{ ...inp, background:editUsed?C.surf:"#fff" }}>
                <option value="">— (umum)</option>
                {pilihanCabang.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={lbl}>Sumber (untuk beban)</label>
              <select value={form.pay_source||""} onChange={e=>setForm({...form,pay_source:e.target.value||null})} style={inp}>
                <option value="">— (bukan beban)</option>
                <option value="bank">Bank</option>
                <option value="kas">Kas</option></select></div>
          </div>
          <div className="grid-auto" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div><label style={lbl}>Saldo Normal</label>
              <select value={form.normal_side} disabled={editUsed} onChange={e=>setForm({...form,normal_side:e.target.value})}
                style={{ ...inp, background:editUsed?C.surf:"#fff" }}>
                <option value="Db">Debet (Db)</option>
                <option value="Kr">Kredit (Kr)</option></select></div>
            <div><label style={lbl}>Masuk Laporan</label>
              <select value={form.statement} disabled={editUsed} onChange={e=>setForm({...form,statement:e.target.value})}
                style={{ ...inp, background:editUsed?C.surf:"#fff" }}>
                <option value="LR">Laba Rugi (LR)</option>
                <option value="NRC">Neraca (NRC)</option></select></div>
          </div>
          {!editUsed && (
            <div style={{ fontSize:11.5, color:C.sub, marginBottom:12, lineHeight:1.5,
              background:C.surf, padding:"10px 12px", borderRadius:8 }}>
              Tips: Pendapatan/Ekuitas/Kewajiban(hutang) → sisi Kredit. Beban/Aset → sisi Debet. Pola kode:
              1-xxx (Aset), 2-xxx (Hutang), 3-xxx (Modal), 4-xxx (Pendapatan), 5-xxx (COGS), 6-xxx (Beban).
            </div>
          )}
          <button className="btn" onClick={simpan} disabled={busy||!form.code||!form.name}
            style={{ width:"100%", padding:"11px", borderRadius:9,
              background:(form.code&&form.name&&!busy)?(editId?C.brass:C.teal):C.line, color:"#fff", fontWeight:700, fontSize:14 }}>
            {busy?"Menyimpan…":(editId?"Simpan Perubahan":"Simpan Akun")}</button>
        </div>
      )}
      {flash && <div className="pop" style={{ textAlign:"center", marginBottom:14,
        color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}

      <div className="card no-print" style={{ padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
        <Search size={16} color={C.sub} />
        <input placeholder="Cari akun…" value={q} onChange={e=>setQ(e.target.value)}
          style={{ border:"none", outline:"none", fontSize:13.5, flex:1, background:"transparent" }} /></div>

      <div className="card scroll-x" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"105px 1fr 120px 50px 55px 110px", padding:"11px 18px",
          background:C.deep, color:"#DDECEC", fontSize:12, fontWeight:600 }}>
          <span>KODE</span><span>NAMA AKUN</span><span>TIPE</span><span>SN</span><span>SUMBER</span>
          <span style={{ textAlign:"right" }}>AKSI</span></div>
        {rows.map(a=>{
          const nonaktif = a.is_active===false;
          return (
            <div key={a.id} style={{ display:"grid", gridTemplateColumns:"105px 1fr 120px 50px 55px 110px",
              padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center",
              opacity: nonaktif?0.45:1 }}>
              <span className="mono" style={{ fontWeight:600, color:C.deep }}>{a.code}</span>
              <span>{a.name}{a.branch && <span style={{ fontSize:10, color:C.sub }}> · {a.branch}</span>}
                {nonaktif && <span style={{ fontSize:9.5, fontWeight:700, marginLeft:6, padding:"1px 6px",
                  borderRadius:20, background:C.neg+"18", color:C.neg }}>NONAKTIF</span>}</span>
              <span style={{ color:C.sub }}>{a.type}</span>
              <span style={{ color:C.sub }}>{a.normal_side}</span>
              <span style={{ fontWeight:600, fontSize:11.5,
                color:a.pay_source==="bank"?C.teal:a.pay_source==="kas"?C.kas:C.line }}>
                {label[a.pay_source]||"—"}</span>
              <span className="no-print" style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button className="btn" onClick={()=>startEdit(a)} title="Edit"
                  style={{ background:"transparent", color:C.sub }}
                  onMouseEnter={ev=>ev.currentTarget.style.color=C.teal}
                  onMouseLeave={ev=>ev.currentTarget.style.color=C.sub}><Pencil size={14} /></button>
                <button className="btn" onClick={()=>toggle(a)} title={nonaktif?"Aktifkan":"Nonaktifkan"}
                  style={{ background:"transparent", color:nonaktif?C.pos:C.sub, fontSize:15 }}>
                  {nonaktif ? "○" : "●"}</button>
                <button className="btn" onClick={()=>hapus(a)} title="Hapus"
                  style={{ background:"transparent", color:C.sub }}
                  onMouseEnter={ev=>ev.currentTarget.style.color=C.neg}
                  onMouseLeave={ev=>ev.currentTarget.style.color=C.sub}><Trash2 size={14} /></button>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11.5, color:C.sub, marginTop:12, lineHeight:1.5 }}>
        Akun yang sudah dipakai di jurnal tidak bisa dihapus (demi keamanan laporan) — gunakan tombol
        nonaktifkan (●) untuk menyembunyikannya dari pilihan transaksi.
      </div>
    </div>
  );
}

const styleSheet = `
  *{box-sizing:border-box}
  .mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";letter-spacing:-.01em}
  .nav-item:hover{background:rgba(255,255,255,.08)}
  .card{background:#fff;border:1px solid ${C.line};border-radius:14px}
  .btn{cursor:pointer;border:none;font-family:inherit;transition:all .15s}
  .btn:active{transform:translateY(1px)}
  input,select{font-family:inherit}
  @keyframes pop{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  .pop{animation:pop .25s ease}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{animation:spin 1s linear infinite}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}

  /* ---- topbar & sidebar: desktop ---- */
  .mobile-topbar{ display:none }
  .nav-close{ display:none }

  /* ---- layar kecil ---- */
  @media (max-width: 900px) {
    .mobile-topbar{
      display:flex; align-items:center; gap:10px;
      position:fixed; top:0; left:0; right:0; height:54px; z-index:60;
      background:${C.deep}; padding:0 12px;
      box-shadow:0 2px 10px rgba(0,0,0,.18);
    }
    .nav-close{ display:block }
    .sidebar{
      position:fixed !important; top:0; left:0; z-index:70;
      transform:translateX(-105%); transition:transform .22s ease;
      box-shadow:0 0 40px rgba(0,0,0,.35);
    }
    .sidebar.open{ transform:translateX(0) }
    .nav-overlay{
      position:fixed; inset:0; background:rgba(8,26,26,.55); z-index:65;
    }
    main{ padding:68px 14px 28px !important; max-width:100% !important }

    /* grid otomatis jadi satu kolom */
    .grid-auto{ grid-template-columns:1fr !important }
    .grid-2{ grid-template-columns:repeat(2,1fr) !important }

    /* tabel lebar bisa digeser ke samping */
    .scroll-x{ overflow-x:auto !important; -webkit-overflow-scrolling:touch }
    .scroll-x > *{ min-width:640px }

    /* baris form transaksi menumpuk */
    .row-stack{ grid-template-columns:1fr !important }
  }

  @media (max-width: 520px) {
    .grid-2{ grid-template-columns:1fr !important }
  }

  @media print {
    aside, .no-print { display: none !important; }
    main { padding: 0 !important; max-width: 100% !important; }
    body { background: #fff !important; }
    #print-area { animation: none !important; }
    .card { break-inside: avoid; box-shadow: none !important; }
    @page { margin: 14mm; }
  }
`;