"use strict";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const nf = n => typeof n === "number" ? n.toLocaleString(L === "ru" ? "ru-RU" : "en-US") : String(n);
const pct = (a,b) => b ? (a / b * 100).toFixed(2) + "%" : "—";
const ratio = (a,b) => b ? (a / b).toFixed(2) : (a ? a.toFixed(2) : "0.00");
const nice = v => { const t = String(v).trim();
  return /[A-Z]|\s/.test(t) ? t : pretty(t); };
const hasMC = v => typeof v === "string" &&
  /[§&][0-9a-z]|[\uE000-\uF8FF]|[\uDB80-\uDBBF][\uDC00-\uDFFF]/i.test(v);
const pretty = s => String(s).replace(/[_-]+/g," ").replace(/\b\w/g, c => c.toUpperCase()).trim();
const EXTRA_GAMES = { gi:"Ghost Invasion", mob:"Mob Game", parkour:"Parkour Worlds",
  "sky-kits":"SkyWars Kits", "sky-classic":"SkyWars Classic" };
const NAME = c => { const g = GAMES.find(x => x[0] === c);
  return g ? (L === "ru" ? g[1] : g[2]) : (EXTRA_GAMES[c] || c); };
const label = k => (L === "ru" && LABELS_RU[k]) || pretty(k);
const cosLabel = k => (L === "ru" && COS_RU[k]) || pretty(k);
function mountModal(m, from){
  document.body.append(m);
  document.documentElement.classList.add("locked");
  const ok = from && from.getBoundingClientRect &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches && !state.lite;
  if(ok){
    const r = from.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const inner = m.querySelector(".inner");
    if(inner){
      const ir = inner.getBoundingClientRect();
      m.style.setProperty("--ox", Math.round(x - ir.left) + "px");
      m.style.setProperty("--oy", Math.round(y - ir.top) + "px");
      m.classList.add("fromEl");
    }
  }
  requestAnimationFrame(() => m.classList.add("in"));
  if(typeof navModal === "function") navModal(m);
}
function closeModal(m, how){
  if(m.dataset.closing) return;
  m.dataset.closing = "1";
  if(m.__nav){ m.__nav = false; if(how !== true && how !== "nav" && typeof navBack === "function") navBack(); }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){
    m.remove();
    if(!document.querySelector(".modal")) document.documentElement.classList.remove("locked");
    return;
  }
  m.classList.remove("in");
  m.classList.add("out");
  setTimeout(() => {
    m.remove();
    if(!document.querySelector(".modal"))
      document.documentElement.classList.remove("locked");
  }, 200);
}
const TOAST_MS = 4000;
function toast(t){
  const o = document.querySelector(".toast"); if(o) o.remove();
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = t;
  const hide = () => {
    if(el.dataset.out) return;
    el.dataset.out = "1";
    if(state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches){ el.remove(); return; }
    el.classList.add("out");
    setTimeout(() => el.remove(), 260);
  };
  el.onclick = hide;
  document.body.append(el);
  setTimeout(hide, TOAST_MS);
}
function when(ts){
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const day = sameDay ? (L === "ru" ? "сегодня" : "today")
    : d.getDate() + "." + String(d.getMonth()+1).padStart(2,"0");
  return day + ", " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function pick(o, ...keys){ for(const k of keys) if(o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; }
function num(o, k){ return o && typeof o[k] === "number" ? o[k] : 0; }
function dateOf(v){
  if(typeof v !== "number") return String(v);
  const d = new Date(v > 1e12 ? v : v * 1000);
  const p = n => String(n).padStart(2,"0");
  return p(d.getDate()) + "." + p(d.getMonth()+1) + "." + d.getFullYear();
}
function scanStr(o, re){ if(!o) return;
  for(const k of Object.keys(o)) if(re.test(k) && typeof o[k] === "string" && o[k]) return o[k]; }
function rankTag(rank){
  const r = String(rank || "").toUpperCase();
  if(/ULTIMATE|ULTRA/.test(r)) return { t:"U", c:"var(--violet)", c1:"#6a25ad", c2:"#dcaaff" };
  if(/PLUS|\+/.test(r)) return { t:"+", c:"var(--green)", c1:"#1c8a4d", c2:"#8bffbd" };
  return null;
}
const MCCOL = {"0":"#000000","1":"#0000AA","2":"#00AA00","3":"#00AAAA","4":"#AA0000","5":"#AA00AA",
  "6":"#FFAA00","7":"#AAAAAA","8":"#555555","9":"#5555FF",a:"#55FF55",b:"#55FFFF",c:"#FF5555",
  d:"#FF55FF",e:"#FFFF55",f:"#FFFFFF",g:"#DDD605",
  u:"#B14BFF",i:"#FFC02E",j:"#C77DFF",p:"#5BE8C4",m:"#9AA0B5",t:"#FF6B5A",h:"#FF7AB8",
  n:"#C68A4E",q:"#5CE68A",r:"#FFFFFF",s:"#7FE8FF"};
const PUA = /[\uE000-\uF8FF]|[\uDB80-\uDBBF][\uDC00-\uDFFF]/;
const isGlyph = cp => (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0x10FFFD);
const GLYPHS = "https://playhive.com/_nextassets/glyphs/";
const GLYPH_BASE = 0xE100;
function glyphImg(cp){
  const id = cp - GLYPH_BASE;
  if(id < 0) return "";
  return '<img class="tic gl" alt="" decoding="async" src="' + GLYPHS + id +
    '.png" onerror="this.remove()">';
}
function mcSegments(str){
  const t = String(str);
  if(!/[§&][0-9a-z]/i.test(t) && !PUA.test(t)) return [{ t: pretty(t), c: null }];
  const out = [];
  let cur = null, buf = "";
  const push = () => { if(buf){ out.push({ t: buf, c: cur }); buf = ""; } };
  for(let i = 0; i < t.length; i++){
    const ch = t[i], nx = (t[i+1] || "").toLowerCase();
    if((ch === "§" || ch === "&") && MCCOL[nx]){ push(); cur = MCCOL[nx]; i++; continue; }
    if((ch === "§" || ch === "&") && /[0-9a-z]/.test(nx)){ push(); i++; continue; }
    const cp = t.codePointAt(i);
    if(isGlyph(cp)){ push(); out.push({ g: cp, c: cur }); if(cp > 0xFFFF) i++; continue; }
    buf += ch;
  }
  push();
  return out;
}
function tones(hex){
  const n = parseInt(String(hex).slice(1), 16);
  if(!isFinite(n)) return [hex, hex, hex];
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const spread = Math.max(r,g,b) - Math.min(r,g,b);
  const pale = lum > 0.62 && spread <= 48;
  const hx = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  const mix = (k, t) => "#" + hx(r + (t - r) * k) + hx(g + (t - g) * k) + hx(b + (t - b) * k);
  return [mix(pale ? .34 : .28, 0), hex, pale ? "#ffffff" : mix(.34, 255)];
}
function mcText(str, shine){
  const segs = mcSegments(str);
  if(!shine) return segs.map(x =>
    x.g ? glyphImg(x.g)
        : x.c ? '<span style="color:' + x.c + '">' + esc(x.t) + "</span>" : esc(x.t)).join("");
  let si = 0;
  return segs.map(x => {
    if(x.g){ si += 1; return glyphImg(x.g); }
    const t = tones(x.c || "#f4eefb");
    const idx = si++;
    return '<span class="sh" style="--c1:' + t[0] + ";--c2:" + t[1] + ";--c3:" + t[2] +
      ";animation-delay:" + (-0.55 * idx).toFixed(2) + 's">' + esc(x.t) + "</span>";
  }).join("");
}
function titleIcon(v){
  const u = cosIcon(v);
  return u ? '<img class="tic" alt="" loading="lazy" decoding="async" src="' + esc(u) +
    '" onerror="this.remove()">' : "";
}
const CDN_PREFIX = { avatar:"", hat:"hat-", costume:"costume-", backbling:"backbling-",
  back_bling:"backbling-", mount:"mount-", pet:"pet-", hub_title:null, title:null };
function iconUrl(base, id){
  const pre = CDN_PREFIX[base];
  if(pre === null || pre === undefined || typeof id !== "string" || !id) return null;
  const slug = id.toLowerCase().replace(/[''"".!?()]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  if(!slug) return null;
  return "https://cdn.playhive.com/avatars/" + pre + slug + ".png";
}
const isDateKey = k => /first_(played|joined|login)|last_login|_date$/.test(k);

function httpMsg(st){ return st >= 500 ? T("hiveDown", st) : T("httpErr", st); }
