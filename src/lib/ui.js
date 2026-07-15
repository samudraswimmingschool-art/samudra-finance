// Design tokens & formatter — dipakai seluruh komponen
export const C = {
  ink:"#0B2027", deep:"#0E3A43", teal:"#12707E", surf:"#EAF1F1", paper:"#F7FAFA",
  brass:"#C08A2D", pos:"#1F8A5B", neg:"#C2453B", line:"#D9E4E4", sub:"#5C7377", kas:"#8A5A2B",
};

export const money = (n) => !n ? "–" : "Rp " + Math.round(n).toLocaleString("id-ID");
export const moneyShort = (n) => {
  if (!n) return "0"; const a = Math.abs(n);
  if (a >= 1e9) return (n/1e9).toFixed(1)+" M";
  if (a >= 1e6) return (n/1e6).toFixed(0)+" jt";
  return (n/1e3).toFixed(0)+" rb";
};
export const pct = (n) => (n*100).toFixed(1)+"%";

export const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"];

export const lbl = { display:"block", fontSize:11.5, color:C.sub, fontWeight:600, marginBottom:5 };
export const inp = { width:"100%", padding:"9px 11px", border:`1px solid ${C.line}`,
  borderRadius:8, fontSize:13.5, outline:"none", color:C.ink, background:"#fff" };
