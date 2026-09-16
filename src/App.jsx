import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, BookOpen, Layers, Scale, ScrollText, Landmark,
  TrendingUp, ArrowLeftRight, Building2, Plus, Trash2, Check, AlertCircle,
  Search, LogOut, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle,
  PiggyBank, ShoppingCart, ChevronLeft, Pencil, BarChart3, X,
  TrendingDown, Lightbulb, Printer, ChevronDown, ChevronUp, Banknote,
  Target as TargetIcon, FileText, Package, Flag, Clock, UserPlus, Menu, Copy
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
          {tab==="ledger"    && <Ledger balances={balances} />}
          {tab==="trial"     && <Trial balances={balances} />}
          {tab==="pnl"       && <PnL pnl={pnl} pnlPrev={pnlPrev} period={period} accounts={accounts} />}
          {tab==="balance"   && <Balance sheet={sheet} retained={retained} period={period} />}
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
        </>}

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
function Balance({ sheet, retained, period }) {
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
        {bal?"✓ SEIMBANG — Total Aktiva = Kewajiban + Modal":`✗ SELISIH ${money(Math.abs(totalAset-totalPasiva))} — cek jurnal`}
      </div>
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