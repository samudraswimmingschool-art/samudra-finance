import React, { useState } from "react";
import { signIn } from "../lib/api";
import { C, inp, lbl } from "../lib/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try { await signIn(email, pw); }
    catch (e) { setErr(e.message || "Gagal masuk"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center",
      background:`linear-gradient(135deg,${C.deep},${C.teal})`, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ background:"#fff", padding:"36px 34px", borderRadius:18, width:360,
        boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:24 }}>
          <div style={{ width:40, height:40, borderRadius:10,
            background:`linear-gradient(135deg,${C.teal},${C.brass})`, display:"grid",
            placeItems:"center", fontWeight:800, color:"#fff", fontSize:18 }}>S</div>
          <div><div style={{ fontWeight:700, fontSize:18 }}>Samudra</div>
            <div style={{ fontSize:11, color:C.brass, letterSpacing:".08em" }}>FINANCE</div></div>
        </div>
        <label style={lbl}>Email</label>
        <input style={{ ...inp, marginBottom:12 }} value={email}
          onChange={(e)=>setEmail(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter"&&submit()} placeholder="owner@samudra.id" />
        <label style={lbl}>Password</label>
        <input style={{ ...inp, marginBottom:18 }} type="password" value={pw}
          onChange={(e)=>setPw(e.target.value)}
          onKeyDown={(e)=>e.key==="Enter"&&submit()} placeholder="••••••••" />
        {err && <div style={{ color:C.neg, fontSize:12.5, marginBottom:12 }}>{err}</div>}
        <button onClick={submit} disabled={busy}
          style={{ width:"100%", padding:"12px", borderRadius:10, border:"none",
            background:C.teal, color:"#fff", fontWeight:700, fontSize:14.5,
            cursor:busy?"wait":"pointer", fontFamily:"inherit" }}>
          {busy ? "Memproses…" : "Masuk"}
        </button>
      </div>
    </div>
  );
}
