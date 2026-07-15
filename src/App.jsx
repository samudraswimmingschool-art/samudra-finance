import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, BookOpen, Layers, Scale, ScrollText, Landmark,
  TrendingUp, ArrowLeftRight, Building2, Plus, Trash2, Check, AlertCircle,
  Search, LogOut, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle,
  PiggyBank, ShoppingCart, ChevronLeft, Pencil, BarChart3, X,
  TrendingDown, Lightbulb, Printer, ChevronDown, ChevronUp, Banknote
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
  rpcPnl, rpcBalanceSheet, rpcRetainedProfit, rpcCashFlow, rpcAccountBalances,
  periodRange, signOut,
} from "./lib/api";

const YEAR = 2026;

export default function App() {
  const [session, setSession] = useState(undefined); // undefined=loading
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(false);

  // laporan aktif (di-load sesuai tab & period)
  const [journal, setJournal] = useState([]);
  const [balances, setBalances] = useState([]);
  const [pnl, setPnl] = useState([]);
  const [sheet, setSheet] = useState([]);
  const [retained, setRetained] = useState(0);
  const [flow, setFlow] = useState([]);
  const [flowDetail, setFlowDetail] = useState([]);
  const [trend, setTrend] = useState([]);

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
  const acctById = useMemo(() => {
    const m = {}; accounts.forEach((a) => (m[a.id] = a)); return m;
  }, [accounts]);
  const acctByCode = useMemo(() => {
    const m = {}; accounts.forEach((a) => (m[a.code] = a)); return m;
  }, [accounts]);

  // --- muat data sesuai tab & period ---
  const load = useCallback(async () => {
    if (!orgId) return;
    const [start, end] = periodRange(YEAR, period);
    const asOf = end;
    setLoading(true);
    try {
      if (tab === "journal" || tab === "transaksi") setJournal(await getJournal(orgId, start, end));
      else if (tab === "ledger" || tab === "trial")
        setBalances(await rpcAccountBalances(orgId, start, end));
      else if (tab === "pnl") setPnl(await rpcPnl(orgId, start, end));
      else if (tab === "balance") {
        setSheet(await rpcBalanceSheet(orgId, asOf));
        setRetained(await rpcRetainedProfit(orgId, asOf));
      } else if (tab === "cashflow") {
        setFlow(await rpcCashFlow(orgId, start, end));
        setFlowDetail(await rpcCashFlowDetail(orgId, start, end));
      } else if (tab === "analisis") {
        setPnl(await rpcPnl(orgId, start, end));
        setBalances(await rpcAccountBalances(orgId, start, end));
        setTrend(await rpcMonthlyTrend(orgId, YEAR));
      } else if (tab === "dashboard") {
        setPnl(await rpcPnl(orgId, start, end));
        setBalances(await rpcAccountBalances(orgId, start, end));
        setTrend(await rpcMonthlyTrend(orgId, YEAR));
      }
    } catch (e) { alert("Gagal memuat: " + e.message); }
    finally { setLoading(false); }
  }, [orgId, tab, period]);

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
        {/* Sidebar */}
        <aside style={{ width:236, background:C.deep, color:"#DDECEC", padding:"22px 14px",
          position:"sticky", top:0, height:"100vh", flexShrink:0, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 8px 16px" }}>
            <div style={{ width:34, height:34, borderRadius:9,
              background:`linear-gradient(135deg,${C.teal},${C.brass})`, display:"grid",
              placeItems:"center", fontWeight:800, color:"#fff" }}>S</div>
            <div><div style={{ fontWeight:700, fontSize:15, lineHeight:1 }}>Samudra</div>
              <div style={{ fontSize:11, color:C.brass, letterSpacing:".08em", marginTop:3 }}>FINANCE</div></div>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {NAV.map((n, i) => n.sec ? (
              <div key={"s"+i} style={{ fontSize:10, letterSpacing:".12em", color:"#5F8080",
                fontWeight:700, padding:"14px 12px 6px" }}>{n.sec}</div>
            ) : (
              <div key={n.id} className="nav-item" onClick={() => setTab(n.id)}
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
          {tab==="dashboard" && <Dashboard pnl={pnl} balances={balances} trend={trend} />}
          {tab==="transaksi" && <Transaksi accounts={accounts} acctByCode={acctByCode}
                                          journal={journal} acctById={acctById} orgId={orgId} onChange={load} />}
          {tab==="journal"   && <Journal accounts={accounts} acctById={acctById} acctByCode={acctByCode}
                                          journal={journal} orgId={orgId} onChange={load} />}
          {tab==="analisis"  && <Analisis pnl={pnl} balances={balances} trend={trend} />}
          {tab==="ledger"    && <Ledger balances={balances} />}
          {tab==="trial"     && <Trial balances={balances} />}
          {tab==="pnl"       && <PnL pnl={pnl} period={period} />}
          {tab==="balance"   && <Balance sheet={sheet} retained={retained} period={period} />}
          {tab==="equity"    && <Equity orgId={orgId} period={period} />}
          {tab==="cashflow"  && <CashFlow flow={flow} detail={flowDetail} />}
          {tab==="coa"       && <COAView accounts={accounts} />}
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
  { id:"analisis", label:"Analisis Keuangan", icon:BarChart3 },
  { id:"ledger", label:"Buku Besar", icon:Layers },
  { id:"trial", label:"Neraca Saldo", icon:Scale },
  { id:"pnl", label:"Laba Rugi", icon:ScrollText },
  { id:"balance", label:"Neraca", icon:Landmark },
  { id:"equity", label:"Perubahan Modal", icon:TrendingUp },
  { id:"cashflow", label:"Arus Kas", icon:ArrowLeftRight },
  { sec:"DATA" },
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

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ pnl, balances, trend }) {
  const rev = sumBy(pnl, r=>r.type==="Pendapatan");
  const revP = sumBy(pnl, r=>r.type==="Pendapatan"&&r.branch==="Progresif");
  const revS = sumBy(pnl, r=>r.type==="Pendapatan"&&r.branch==="Saraga");
  const opP = sumBy(pnl, r=>r.type==="Beban Op"&&r.branch==="Progresif");
  const opS = sumBy(pnl, r=>r.type==="Beban Op"&&r.branch==="Saraga");
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

  const kpis = [
    { label:"Pendapatan", val:rev, tone:C.teal, sub:"Progresif + Saraga", g:gRev },
    { label:"Total Beban", val:opBank+kasBeban+cogs, tone:C.neg, sub:"Bank + Kas", g:null },
    { label:"Laba Bersih", val:profit, tone:C.pos, sub:"Margin "+pct(npm), g:gProfit },
    { label:"Saldo Bank BCA", val:bankBal, tone:C.teal, sub:"Kas: "+moneyShort(kasBal), g:null },
  ];

  return (
    <div className="pop">
      <PageHead eyebrow="Beranda Keuangan" title="Ringkasan Performa" sub="Data langsung dari database" />

      {/* KPI dengan indikator pertumbuhan */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:16 }}>
        {kpis.map(k=>(
          <div key={k.label} className="card" style={{ padding:"16px 17px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12.5, color:C.sub, fontWeight:500 }}>{k.label}</span>
              <Delta g={k.g} />
            </div>
            <div className="mono" style={{ fontSize:19, fontWeight:700, marginTop:10 }}>{money(k.val)}</div>
            <div style={{ fontSize:11.5, color:C.sub, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tren + Komposisi beban */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14, marginBottom:16 }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
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
          {[{n:"Progresif",r:revP,o:opP,c:C.teal},{n:"Saraga",r:revS,o:opS,c:C.brass}].map(b=>(
            <div key={b.n} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:99, background:b.c }} />
                <span style={{ fontWeight:600, fontSize:13 }}>Cabang {b.n}</span>
                <span className="mono" style={{ marginLeft:"auto", fontWeight:700, fontSize:13, color:C.pos }}>{money(b.r-b.o)}</span>
              </div>
              <div style={{ height:8, borderRadius:99, background:C.surf, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, background:b.c,
                  width: `${Math.min(100, (revP+revS)? (b.r/(revP+revS))*100 : 0)}%` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.sub, marginTop:4 }}>
                <span>Pendapatan {moneyShort(b.r)}</span>
                <span>Operasional {moneyShort(b.o)}</span>
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
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const bankId = acctByCode["1-10002"]?.id;
  const kasId  = acctByCode["1-10007"]?.id;

  const pilihKategori = (key) => {
    setKat(key);
    const opsi = accounts.filter(KATEGORI[key].filter);
    setForm({
      date: `${YEAR}-07-01`, jumlah: "", cash: "bank",
      lawan_id: opsi[0]?.id || "", memo: "",
    });
    setFlash("");
  };

  const simpan = async () => {
    const K = KATEGORI[kat];
    const nominal = +form.jumlah || 0;
    if (nominal <= 0 || !form.lawan_id) return;
    const cashId = form.cash === "bank" ? bankId : kasId;
    // Susun jurnal debet-kredit otomatis sesuai arah (SAK)
    const lines = K.arah === "masuk"
      ? [ { account_id: cashId, debit: nominal, credit: 0 },       // uang masuk → Kas/Bank Debet
          { account_id: form.lawan_id, debit: 0, credit: nominal } ]
      : [ { account_id: form.lawan_id, debit: nominal, credit: 0 }, // beban/beli → akun Debet
          { account_id: cashId, debit: 0, credit: nominal } ];      // Kas/Bank Kredit
    const namaLawan = acctById[form.lawan_id]?.name || "";
    setBusy(true); setFlash("");
    try {
      await postJournal(orgId, {
        date: form.date,
        memo: form.memo || `${K.label} — ${namaLawan}`,
        cash: form.cash,
        lines,
      });
      setFlash("✓ Transaksi tersimpan & jurnal otomatis dibuat");
      setKat(null); setForm(null);
      onChange();
    } catch (e) { setFlash("✗ " + e.message); }
    finally { setBusy(false); }
  };

  // ---- Tampilan pilih kategori ----
  if (!kat) {
    return (
      <div className="pop">
        <PageHead eyebrow="Catat Transaksi" title="Transaksi"
          sub="Pilih jenis transaksi — jurnal debet-kredit dibuat otomatis (sesuai SAK)." />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
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
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", fontWeight:600, fontSize:14.5, borderBottom:`1px solid ${C.line}` }}>
            Transaksi Terakhir <span style={{ color:C.sub, fontWeight:400 }}>· {journal.length} entri</span></div>
          {journal.length===0 && <div style={{ padding:"18px", color:C.sub, fontSize:13 }}>Belum ada transaksi periode ini.</div>}
          {journal.slice(0,8).map(e=>{
            const t = e.journal_lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
            const isKas = e.cash_source==="kas";
            return (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"12px 18px", borderBottom:`1px solid ${C.line}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:13.5 }}>{e.memo}</span>
                  {e.cash_source && <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 7px",
                    borderRadius:20, background:isKas?C.kas+"18":C.teal+"15", color:isKas?C.kas:C.teal }}>
                    {isKas?"KAS":"BANK"}</span>}
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
  const opsi = accounts.filter(K.filter);
  const nominal = +form.jumlah || 0;
  return (
    <div className="pop">
      <button className="btn" onClick={()=>{setKat(null);setForm(null);}}
        style={{ display:"inline-flex", alignItems:"center", gap:6, background:"transparent",
          color:C.sub, fontSize:13, marginBottom:14, padding:"4px 0" }}>
        <ChevronLeft size={16} /> Kembali ke pilihan
      </button>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <div style={{ width:44, height:44, borderRadius:11, background:K.tone+"18", display:"grid", placeItems:"center" }}>
          <K.icon size={24} color={K.tone} /></div>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>{K.label}</h1>
          <div style={{ fontSize:13, color:C.sub }}>{K.arah==="masuk"?"Uang masuk":"Uang keluar"} · jurnal dibuat otomatis</div>
        </div>
      </div>

      <div className="card" style={{ padding:22, maxWidth:620 }}>
        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <div style={{ flex:"0 0 150px" }}><label style={lbl}>Tanggal</label>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp} /></div>
          <div style={{ flex:1 }}><label style={lbl}>Jumlah (Rp)</label>
            <input className="mono" inputMode="numeric" placeholder="0" value={form.jumlah}
              onChange={e=>setForm({...form,jumlah:e.target.value.replace(/\D/g,"")})}
              style={{ ...inp, fontSize:16, fontWeight:700 }} /></div>
        </div>

        <label style={lbl}>{K.lawanLabel}</label>
        <select value={form.lawan_id} onChange={e=>setForm({...form,lawan_id:e.target.value})}
          style={{ ...inp, marginBottom:14 }}>
          {opsi.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select>

        <label style={lbl}>{K.arah==="masuk"?"Uang masuk ke":"Uang keluar dari"}</label>
        <select value={form.cash} onChange={e=>setForm({...form,cash:e.target.value})}
          style={{ ...inp, marginBottom:14, fontWeight:600, color:form.cash==="bank"?C.teal:C.kas }}>
          <option value="bank">Bank BCA</option>
          <option value="kas">Kas (Petty Cash)</option>
        </select>

        <label style={lbl}>Keterangan (opsional)</label>
        <input placeholder={`mis. ${K.label} bulan Juli`} value={form.memo}
          onChange={e=>setForm({...form,memo:e.target.value})} style={{ ...inp, marginBottom:18 }} />

        {/* ringkasan jurnal otomatis */}
        {nominal>0 && form.lawan_id && (
          <div style={{ background:C.surf, borderRadius:10, padding:"12px 14px", marginBottom:16, fontSize:12.5 }}>
            <div style={{ color:C.sub, fontWeight:600, marginBottom:6, fontSize:11, letterSpacing:".05em" }}>JURNAL OTOMATIS:</div>
            {K.arah==="masuk" ? <>
              <Auto d={`${form.cash==="bank"?"Bank BCA":"Kas"}`} v={nominal} side="Debet" />
              <Auto d={acctById[form.lawan_id]?.name} v={nominal} side="Kredit" />
            </> : <>
              <Auto d={acctById[form.lawan_id]?.name} v={nominal} side="Debet" />
              <Auto d={`${form.cash==="bank"?"Bank BCA":"Kas"}`} v={nominal} side="Kredit" />
            </>}
          </div>
        )}

        <button className="btn" onClick={simpan} disabled={nominal<=0||!form.lawan_id||busy}
          style={{ width:"100%", padding:"13px", borderRadius:10,
            background: nominal>0&&form.lawan_id&&!busy?K.tone:C.line, color:"#fff", fontWeight:700, fontSize:15 }}>
          {busy?"Menyimpan…":`Simpan ${K.label}`}</button>
        {flash && <div className="pop" style={{ marginTop:10, textAlign:"center",
          color:flash.startsWith("✓")?C.pos:C.neg, fontSize:13, fontWeight:600 }}>{flash}</div>}
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
  const blank = () => ({ date:`${YEAR}-07-01`, memo:"", cash:"bank",
    lines:[{ account_id:first, debit:"", credit:"" }, { account_id:bank, debit:"", credit:"" }] });
  const [draft, setDraft] = useState(blank());
  const [editId, setEditId] = useState(null);      // id jurnal yang sedang diedit
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  // filter tanggal (revisi #4)
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
        sub="Input sekali — Buku Besar, Neraca Saldo & Laba Rugi terisi otomatis." />
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
            <input placeholder="mis. Gaji Pelatih Private — Juli" value={draft.memo}
              onChange={e=>setDraft({...draft,memo:e.target.value})} style={inp} /></div>
          <div style={{ flex:"0 0 160px" }}><label style={lbl}>Sumber Kas</label>
            <select value={draft.cash} onChange={e=>setDraft({...draft,cash:e.target.value})}
              style={{ ...inp, fontWeight:600, color:draft.cash==="bank"?C.teal:C.kas }}>
              <option value="bank">Bank BCA</option><option value="kas">Kas (Petty Cash)</option></select></div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 34px", gap:8,
          fontSize:11.5, color:C.sub, fontWeight:600, padding:"0 2px 6px" }}>
          <span>AKUN</span><span style={{ textAlign:"right" }}>DEBET</span>
          <span style={{ textAlign:"right" }}>KREDIT</span><span /></div>
        {draft.lines.map((l,i)=>(
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 150px 150px 34px", gap:8, marginBottom:7, alignItems:"center" }}>
            <select value={l.account_id} onChange={e=>setLine(i,"account_id",e.target.value)} style={inp}>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
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

      <div className="card" style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", fontWeight:600, fontSize:14.5, borderBottom:`1px solid ${C.line}` }}>
          Riwayat Jurnal <span style={{ color:C.sub, fontWeight:400 }}>· {shown.length} entri
          {(fStart||fEnd)?" (terfilter)":" (periode ini)"}</span></div>
        {shown.length===0 && <div style={{ padding:"20px 18px", color:C.sub, fontSize:13 }}>Tidak ada jurnal pada rentang ini.</div>}
        {shown.map(e=>{
          const t = e.journal_lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
          const isKas = e.cash_source==="kas";
          return (
            <div key={e.id} style={{ padding:"13px 18px", borderBottom:`1px solid ${C.line}`,
              background: editId===e.id ? C.brass+"08" : "transparent" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:13.5 }}>{e.memo}</span>
                  {e.cash_source && <span style={{ fontSize:10.5, fontWeight:700, padding:"2px 7px",
                    borderRadius:20, background:isKas?C.kas+"18":C.teal+"15", color:isKas?C.kas:C.teal }}>
                    {isKas?"KAS":"BANK"}</span>}
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
  const groups = ["Kas & Bank","Akun Piutang","Aktiva Tetap","Ekuitas","Pendapatan","COGS","Beban Op","Beban Kas","Other Income","Other Expense"];
  const shown = balances.filter(a=>(Number(a.debit)||Number(a.credit))&&
    (a.name.toLowerCase().includes(q.toLowerCase())||a.code.includes(q)));
  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Buku Besar" sub="Saldo tiap akun dari jurnal." />
      <div className="card" style={{ padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
        <Search size={16} color={C.sub} />
        <input placeholder="Cari akun atau kode…" value={q} onChange={e=>setQ(e.target.value)}
          style={{ border:"none", outline:"none", fontSize:13.5, flex:1, background:"transparent" }} /></div>
      {groups.map(g=>{ const rows=shown.filter(a=>a.type===g); if(!rows.length) return null;
        return (
          <div key={g} className="card" style={{ marginBottom:14, overflow:"hidden" }}>
            <div style={{ padding:"11px 18px", background:C.surf, fontWeight:600, fontSize:13, color:C.deep }}>{g}</div>
            {rows.map(a=>(
              <div key={a.code} style={{ display:"grid", gridTemplateColumns:"1fr 130px 130px 140px",
                padding:"11px 18px", borderTop:`1px solid ${C.line}`, fontSize:13, alignItems:"center" }}>
                <span><b style={{ color:C.deep }}>{a.code}</b> <span style={{ color:C.sub }}>{a.name}</span></span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(a.debit)}</span>
                <span className="mono" style={{ textAlign:"right", color:C.sub }}>{money(a.credit)}</span>
                <span className="mono" style={{ textAlign:"right", fontWeight:700 }}>{money(a.balance)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// TRIAL BALANCE
// ============================================================
function Trial({ balances }) {
  const rows = balances.filter(a=>Number(a.debit)||Number(a.credit));
  const dSum = rows.reduce((s,a)=>s+Number(a.debit),0);
  const cSum = rows.reduce((s,a)=>s+Number(a.credit),0);
  const bal = Math.round(dSum)===Math.round(cSum);
  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Neraca Saldo" sub="Total debet harus sama dengan total kredit." />
      <div className="card" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 160px 160px", padding:"12px 20px",
          background:C.deep, color:"#DDECEC", fontSize:12, fontWeight:600 }}>
          <span>AKUN</span><span style={{ textAlign:"right" }}>DEBET</span><span style={{ textAlign:"right" }}>KREDIT</span></div>
        {rows.map(a=>(
          <div key={a.code} style={{ display:"grid", gridTemplateColumns:"1fr 160px 160px",
            padding:"10px 20px", borderBottom:`1px solid ${C.line}`, fontSize:13 }}>
            <span><b style={{ color:C.deep }}>{a.code}</b> <span style={{ color:C.sub }}>{a.name}</span></span>
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
function PnL({ pnl, period }) {
  const [view, setView] = useState("full");
  const bankOnly = view==="bank";
  const g = (type,branch) => pnl.filter(r=>r.type===type&&(!branch||r.branch===branch));
  const S = (type,branch) => g(type,branch).reduce((s,r)=>s+Number(r.amount),0);

  const revP=S("Pendapatan","Progresif"), revS=S("Pendapatan","Saraga"), rev=S("Pendapatan");
  const cogs=S("COGS"), opP=S("Beban Op","Progresif"), opS=S("Beban Op","Saraga"), opBank=S("Beban Op");
  const kasBeban=S("Beban Kas"), oi=S("Other Income"), oe=S("Other Expense");
  const grossProfit=rev-cogs, afterOp=grossProfit-opBank-kasBeban, profitFull=afterOp+oi-oe;
  const profitBank=rev-opBank+oi-oe;
  const shown=bankOnly?profitBank:profitFull;
  const pettyTotal=cogs+kasBeban;

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
          sub={bankOnly?"Hanya beban yang keluar dari Bank BCA":"Seluruh beban (akuntansi lengkap)"} />
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

      <div className="card" style={{ overflow:"hidden" }}>
        <Section t="PENDAPATAN CABANG PROGRESIF" />
        {g("Pendapatan","Progresif").length?g("Pendapatan","Progresif").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
        <Sub l="Total Pendapatan Progresif" v={revP} />
        <Section t="PENDAPATAN CABANG SARAGA" />
        {g("Pendapatan","Saraga").length?g("Pendapatan","Saraga").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
        <Sub l="Total Pendapatan Saraga" v={revS} />
        <Sub l="TOTAL PENDAPATAN KOTOR SAMUDRA" v={rev} tone={C.pos} />

        {!bankOnly && <>
          <Section t="COST OF GOODS SALES (dari Kas)" tone={C.kas} />
          {g("COGS").length?g("COGS").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
          <Sub l="Total COGS" v={cogs} tone={C.neg} />
          <Sub l="LABA KOTOR" v={grossProfit} strong />
        </>}

        <Section t="BIAYA OPERASIONAL PROGRESIF (dari Bank)" />
        {g("Beban Op","Progresif").length?g("Beban Op","Progresif").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
        <Sub l="Total Operasional Progresif" v={opP} tone={C.neg} />
        <Section t="BIAYA OPERASIONAL SARAGA (dari Bank)" />
        {g("Beban Op","Saraga").length?g("Beban Op","Saraga").map(r=><Row key={r.code} r={r} ind/>):<Empty/>}
        <Sub l="Total Operasional Saraga" v={opS} tone={C.neg} />

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
  const modal = sheet.filter(a=>a.type==="Ekuitas");
  const totalAset = aset.reduce((s,a)=>s+Number(a.balance),0);
  const totalModalInput = modal.reduce((s,a)=>s+Number(a.balance),0);
  const totalModal = totalModalInput + Number(retained);
  const bal = Math.round(totalAset)===Math.round(totalModal);
  const label = period==="all"?"Posisi akhir "+YEAR:`Posisi s/d ${MONTHS[period]} ${YEAR}`;

  const Row=({a})=>(<div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"9px 20px",
    borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
    <span style={{ color:C.sub }}><b style={{ color:C.deep }}>{a.code}</b> {a.name}</span>
    <span className="mono" style={{ textAlign:"right" }}>{money(Number(a.balance))}</span></div>);

  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Neraca" sub={label} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"11px 20px", background:C.teal+"15", fontWeight:700, color:C.deep, fontSize:13 }}>AKTIVA</div>
          {aset.map(a=><Row key={a.code} a={a} />)}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"12px 20px",
            background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>
            <span>TOTAL AKTIVA</span><span className="mono" style={{ textAlign:"right" }}>{money(totalAset)}</span></div>
        </div>
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"11px 20px", background:C.brass+"18", fontWeight:700, color:C.deep, fontSize:13 }}>PASIVA (MODAL)</div>
          {modal.map(a=><Row key={a.code} a={a} />)}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"9px 20px",
            borderBottom:`1px solid ${C.line}`, fontSize:12.5, background:C.surf }}>
            <span style={{ color:C.sub }}>Laba berjalan periode</span>
            <span className="mono" style={{ textAlign:"right", color:C.pos }}>{money(Number(retained))}</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", padding:"12px 20px",
            background:C.deep, color:"#fff", fontWeight:700, fontSize:13.5 }}>
            <span>TOTAL PASIVA</span><span className="mono" style={{ textAlign:"right" }}>{money(totalModal)}</span></div>
        </div>
      </div>
      <div className="card" style={{ marginTop:14, padding:"14px 20px", textAlign:"center",
        background:bal?C.pos+"10":C.neg+"10", border:`1px solid ${bal?C.pos+"40":C.neg+"40"}`,
        color:bal?C.pos:C.neg, fontWeight:700, fontSize:14 }}>
        {bal?"✓ SEIMBANG — Total Aktiva = Total Pasiva":`✗ SELISIH ${money(Math.abs(totalAset-totalModal))} — cek jurnal`}
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
      <PageHead eyebrow="Turunan Otomatis" title="Laporan Perubahan Modal" sub="Alur ekuitas periode berjalan" />
      <div className="card" style={{ overflow:"hidden" }}>
        <R l="Modal Awal (3-30001)" v={modalAwal} />
        <R l="+ Laba Bersih periode" v={laba} tone={C.pos} />
        <R l="Modal Akhir" v={modalAkhir} strong />
      </div>
      <div style={{ fontSize:12, color:C.sub, marginTop:12, lineHeight:1.5 }}>
        Wakaf & dividen dapat ditambahkan sebagai pengurang setelah laba bersih (jurnal tersendiri di ekuitas).
      </div>
    </div>
  );
}

// ============================================================
// ANALISIS KEUANGAN — rasio, tren, per cabang, insight otomatis
// ============================================================
function Analisis({ pnl, balances, trend }) {
  const S = (type,branch) => pnl.filter(r=>r.type===type&&(!branch||r.branch===branch))
    .reduce((s,r)=>s+Number(r.amount),0);
  const rev=S("Pendapatan"), revP=S("Pendapatan","Progresif"), revS=S("Pendapatan","Saraga");
  const cogs=S("COGS"), opBank=S("Beban Op"), opP=S("Beban Op","Progresif"), opS=S("Beban Op","Saraga");
  const kasBeban=S("Beban Kas"), oi=S("Other Income"), oe=S("Other Expense");
  const totalBeban=cogs+opBank+kasBeban+oe;
  const laba=rev-totalBeban+oi;
  const labaKotor=rev-cogs;

  // rasio
  const npm = rev ? laba/rev : 0;                        // net profit margin
  const gpm = rev ? labaKotor/rev : 0;                   // gross profit margin
  const coachRatio = rev ? (opP+opS)/rev : 0;            // biaya pelatih thd pendapatan
  const bebanRatio = rev ? totalBeban/rev : 0;           // efisiensi beban
  const modal = balances.filter(b=>b.type==="Ekuitas").reduce((s,b)=>s+Number(b.balance),0);
  const roi = modal ? laba/modal : 0;

  // per cabang
  const kontribP = revP-opP, kontribS = revS-opS;
  const totalKontrib = kontribP+kontribS;

  // insight otomatis (revisi #3)
  const insights = [];
  if (rev===0) insights.push({ t:"info", m:"Belum ada pendapatan pada periode ini. Input transaksi untuk melihat analisis." });
  else {
    if (npm < 0) insights.push({ t:"bad", m:`Bisnis rugi ${money(Math.abs(laba))} periode ini. Beban (${money(totalBeban)}) melebihi pendapatan. Tinjau pos beban terbesar.` });
    else if (npm < 0.15) insights.push({ t:"warn", m:`Margin laba bersih ${pct(npm)} di bawah target sehat (15%). Pertimbangkan efisiensi beban atau naikkan pendapatan.` });
    else insights.push({ t:"good", m:`Margin laba bersih ${pct(npm)} sehat (target ≥15%). Profitabilitas baik.` });

    if (coachRatio > 0.5) insights.push({ t:"warn", m:`Biaya pelatih ${pct(coachRatio)} dari pendapatan — cukup tinggi (>50%). Cek rasio pelatih terhadap jumlah siswa.` });
    else if (coachRatio > 0) insights.push({ t:"good", m:`Biaya pelatih ${pct(coachRatio)} dari pendapatan, masih dalam batas wajar.` });

    if (revP>0 && revS>0) {
      const lebihUntung = kontribP/Math.max(revP,1) > kontribS/Math.max(revS,1) ? "Progresif" : "Saraga";
      insights.push({ t:"info", m:`Cabang ${lebihUntung} memberi kontribusi laba lebih efisien per rupiah pendapatan. Fokuskan pertumbuhan di sana.` });
    }
    if (revS===0 && revP>0) insights.push({ t:"info", m:"Cabang Saraga belum ada pendapatan periode ini. Bandingkan setelah keduanya aktif." });

    // tren: bandingkan 2 bulan terakhir yang ada data
    const aktif = trend.filter(t=>Number(t.pendapatan)>0);
    if (aktif.length>=2) {
      const a=aktif[aktif.length-2], b=aktif[aktif.length-1];
      const delta=(Number(b.laba)-Number(a.laba));
      if (delta<0) insights.push({ t:"warn", m:`Laba bulan terakhir turun ${money(Math.abs(delta))} dibanding bulan sebelumnya. Cek kenaikan beban atau penurunan pendapatan.` });
      else insights.push({ t:"good", m:`Laba bulan terakhir naik ${money(delta)} dibanding bulan sebelumnya. Tren positif.` });
    }
  }

  const trendData = trend.map(t=>({
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

  return (
    <div className="pop">
      <PageHead eyebrow="Turunan Otomatis" title="Analisis Keuangan"
        sub="Rasio, tren, perbandingan cabang, & rekomendasi otomatis" />

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
      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16, marginBottom:16 }}>
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
        <div style={{ fontWeight:600, fontSize:14.5, marginBottom:14 }}>Perbandingan Cabang — mana lebih untung?</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {[{n:"Progresif",r:revP,o:opP,k:kontribP,c:C.teal},{n:"Saraga",r:revS,o:opS,k:kontribS,c:C.brass}].map(b=>{
            const eff = b.r ? b.k/b.r : 0;
            return (
              <div key={b.n} style={{ border:`1px solid ${C.line}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <div style={{ width:9, height:9, borderRadius:99, background:b.c }} />
                  <span style={{ fontWeight:700, fontSize:14.5 }}>Cabang {b.n}</span>
                </div>
                <RowLine l="Pendapatan" v={b.r} c={C.pos} />
                <RowLine l="Biaya operasional" v={b.o} c={C.neg} />
                <div style={{ borderTop:`1px solid ${C.line}`, marginTop:6, paddingTop:8 }}>
                  <RowLine l="Kontribusi laba" v={b.k} bold />
                </div>
                <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8, background:b.c+"10", fontSize:12 }}>
                  Efisiensi: <b>{pct(eff)}</b> laba per rupiah pendapatan
                  {totalKontrib>0 && <> · porsi <b>{pct(b.k/totalKontrib)}</b> dari total</>}
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
function CashFlow({ flow, detail }) {
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
        sub="Klik judul untuk buka/tutup rincian tiap mutasi Bank & Kas" />
      <Block title="BANK" sumRows={bankSum} rows={bankDetail} tone={C.teal} />
      <Block title="KAS (PETTY CASH)" sumRows={kasSum} rows={kasDetail} tone={C.kas} />
    </div>
  );
}

// ============================================================
// CHART OF ACCOUNT
// ============================================================
function COAView({ accounts }) {
  const [q, setQ] = useState("");
  const rows = accounts.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())||a.code.includes(q));
  const label={bank:"Bank",kas:"Kas"};
  return (
    <div className="pop">
      <PageHead eyebrow="Master Data" title="Chart of Account"
        sub={`${accounts.length} akun · kolom "Sumber" menandai beban dari Bank atau Kas`} />
      <div className="card" style={{ padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
        <Search size={16} color={C.sub} />
        <input placeholder="Cari akun…" value={q} onChange={e=>setQ(e.target.value)}
          style={{ border:"none", outline:"none", fontSize:13.5, flex:1, background:"transparent" }} /></div>
      <div className="card" style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 60px 70px", padding:"11px 18px",
          background:C.deep, color:"#DDECEC", fontSize:12, fontWeight:600 }}>
          <span>KODE</span><span>NAMA AKUN</span><span>TIPE</span><span>SN</span><span>SUMBER</span></div>
        {rows.map(a=>(
          <div key={a.code} style={{ display:"grid", gridTemplateColumns:"120px 1fr 150px 60px 70px",
            padding:"9px 18px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, alignItems:"center" }}>
            <span className="mono" style={{ fontWeight:600, color:C.deep }}>{a.code}</span>
            <span>{a.name}</span>
            <span style={{ color:C.sub }}>{a.type}</span>
            <span style={{ color:C.sub }}>{a.normal_side}</span>
            <span style={{ fontWeight:600, fontSize:11.5,
              color:a.pay_source==="bank"?C.teal:a.pay_source==="kas"?C.kas:C.line }}>
              {label[a.pay_source]||"—"}</span>
          </div>
        ))}
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
  @media print {
    aside, .no-print { display: none !important; }
    main { padding: 0 !important; max-width: 100% !important; }
    body { background: #fff !important; }
    #print-area { animation: none !important; }
    .card { break-inside: avoid; box-shadow: none !important; }
    @page { margin: 14mm; }
  }
`;