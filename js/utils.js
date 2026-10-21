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
const NAME = c => { const g = GAMES.find(x => x[0] === c) || GAMES_BASE.find(x => x[0] === c);
  if(g && !g.dyn) return L === "ru" ? g[1] : g[2];
  const m = typeof META_GAMES === "object" && META_GAMES[c] && META_GAMES[c].n;
  return EXTRA_GAMES[c] || (m ? String(m).replace(/([a-z])([A-Z])/g, "$1 $2") : pretty(c)); };
const label = k => (L === "ru" && LABELS_RU[k]) || pretty(k);
const cosLabel = k => (L === "ru" && COS_RU[k]) || pretty(k);
function mountModal(m, from){
  document.body.append(m);
  if(innerWidth >= 900){
    const stop = e => { if(!e.target.closest || !e.target.closest(".inner")) e.preventDefault(); };
    m.addEventListener("wheel", stop, { passive: false });
    m.addEventListener("touchmove", stop, { passive: false });
  }else document.documentElement.classList.add("locked");
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
const RANKS = {
  ULTIMATE:          { t:"U",        m:"#a05fd6", c1:"#6a25ad", c2:"#dcaaff" },
  PLUS:              { t:"+",        m:"#4fd48a", c1:"#1c8a4d", c2:"#8bffbd" },
  YOUTUBER:          { t:"YT",       m:"#ff5555" },
  STREAMER:          { t:"STREAMER", m:"#b14bff" },
  TIKTOK:            { t:"TIKTOK",   m:"#ff5ec4" },
  VIP:               { t:"VIP",      m:"#c77dff" },
  HELPER:            { t:"HELPER",   m:"#55c8ff" },
  MODERATOR:         { t:"MOD",      m:"#ffaa00" },
  HIVE_TEAM:         { t:"HIVE",     m:"#ffd84a" },
  STAFF_MANAGER:     { t:"HIVE",     m:"#ffd84a" },
  COMMUNITY_MANAGER: { t:"HIVE",     m:"#ffd84a" },
  OWNER:             { t:"HIVE",     m:"#ffd84a" }
};
const RANK_NAMES = {
  REGULAR: ["Обычный", "Regular"], PLUS: ["Hive+", "Hive+"], ULTIMATE: ["Hive Ultimate", "Hive Ultimate"],
  YOUTUBER: ["YouTube", "YouTube"], STREAMER: ["Стример", "Streamer"], TIKTOK: ["TikTok", "TikTok"],
  VIP: ["VIP", "VIP"], HELPER: ["Хелпер", "Helper"], MODERATOR: ["Модератор", "Moderator"],
  HIVE_TEAM: ["Команда Hive", "Hive Team"], STAFF_MANAGER: ["Менеджер персонала", "Staff Manager"],
  COMMUNITY_MANAGER: ["Комьюнити-менеджер", "Community Manager"], OWNER: ["Владелец", "Owner"]
};
function rankName(rank){
  const r = String(rank || "").toUpperCase().trim().replace(/[\s-]+/g, "_");
  const n = RANK_NAMES[r];
  return n ? n[L === "ru" ? 0 : 1] : pretty(String(rank || "").toLowerCase());
}
function mixHex(a, b, k){
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
function rankTag(rank){
  let r = String(rank || "").toUpperCase().trim().replace(/[\s-]+/g, "_");
  if(!RANKS[r]){
    if(/ULTIMATE|ULTRA/.test(r)) r = "ULTIMATE";
    else if(/^PLUS$|\+/.test(r)) r = "PLUS";
    else if(/YOU_?TUBE/.test(r)) r = "YOUTUBER";
    else if(/MOD/.test(r)) r = "MODERATOR";
  }
  const k = RANKS[r];
  if(!k) return null;
  return { t: k.t, c: k.m, m: k.m, c1: k.c1 || mixHex(k.m, "#000000", .42), c2: k.c2 || mixHex(k.m, "#ffffff", .55) };
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
function staggerIn(els, cap){
  if((typeof state === "object" && state.lite) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const list = [...els], vh = innerHeight, steps = cap || 24;
  if(list.length && list[0].closest && list[0].closest(".quiet")) return;
  let k = 0;
  const seen = list.filter(el => { const r = el.getBoundingClientRect(); return r.bottom > -40 && r.top < vh + 40; });
  seen.forEach(el => el.classList.remove("enter"));
  if(seen.length) void seen[0].offsetWidth;
  seen.forEach(el => {
    const i = Math.min(k++, steps);
    el.style.setProperty("--ei", i);
    el.classList.add("enter");
    setTimeout(() => el.classList.remove("enter"), 700 + i * 30);
  });
}
const NICK_CASE = new Map();
function learnNick(n){ if(typeof n === "string" && n.trim()) NICK_CASE.set(n.trim().toLowerCase(), n.trim()); }
function properNick(q){ return NICK_CASE.get(String(q || "").trim().toLowerCase()) || null; }
const NICK_FIELDS = "#lbFind, #nick, #cmpNick, #qsNick, #onbNick";
function fixNickField(inp){
  if(!inp || !inp.matches || !inp.matches(NICK_FIELDS)) return false;
  const v = inp.value, t = v.trim();
  if(t.length < 3 || /^#?\d+$/.test(t)) return false;
  const p = properNick(t);
  if(!p || p === t) return false;
  inp.value = p;
  try{ inp.setSelectionRange(p.length, p.length); }catch(e){}
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
const fixActiveNickField = () => fixNickField(document.activeElement);
document.addEventListener("focusout", e => fixNickField(e.target), true);
document.addEventListener("keydown", e => { if(e.key === "Enter") fixNickField(e.target); }, true);
const CREATORS = new Set(["demanzez"]);
const creatorTag = name => CREATORS.has(String(name || "").trim().toLowerCase()) ? '<span class="crt">Creator</span>' : "";
const SHORT_NAMES = { ctf: "CTF" };   // used when the full name does not fit a closed dropdown
const isDateKey = k => /first_(played|joined|login)|last_login|_date$/.test(k);
const hasStats = c => !!c && typeof c === "object" && !Array.isArray(c) && Object.entries(c).some(([k, v]) =>
  typeof v === "number" && v > 0 && !SKIP.has(k) && !isDateKey(k) && !/^(level|prestige)$/.test(k));

function httpMsg(st){ return st >= 500 ? T("hiveDown", st) : T("httpErr", st); }

const GLOW_R = 190;
let glowX = -1e4, glowY = -1e4, glowLit = new Set(), glowBtns = [], glowBtnsAt = 0;
function glowParts(b){
  let g = b.__glow;
  if(!g || !g[0].isConnected){
    b.insertAdjacentHTML("beforeend", '<span class="mglow" aria-hidden="true"><i></i></span><span class="mring" aria-hidden="true"><i></i></span>');
    const sp = b.querySelectorAll(":scope > .mglow, :scope > .mring");
    g = b.__glow = [sp[0], sp[0].firstChild, sp[1], sp[1].firstChild];
  }
  return g;
}
function glowPaint(){
  const now = new Set();
  if(!state.lite && glowX > -1e3){
    const t = performance.now();
    if(t - glowBtnsAt > 400){ glowBtns = [...document.querySelectorAll(".mini")]; glowBtnsAt = t; }
    for(const b of glowBtns){
      if(b.disabled || !b.isConnected) continue;
      const r = b.getBoundingClientRect();
      if(!r.width || r.bottom < -GLOW_R || r.top > innerHeight + GLOW_R) continue;
      const dx = glowX < r.left ? r.left - glowX : glowX > r.right ? glowX - r.right : 0;
      const dy = glowY < r.top ? r.top - glowY : glowY > r.bottom ? glowY - r.bottom : 0;
      const d = Math.hypot(dx, dy);
      if(d > GLOW_R) continue;
      const [gw, gi, rw, ri] = glowParts(b), k = 1 - d / GLOW_R;
      // the inner light lives inside the 1px border, the rim light starts at the outer edge
      gi.style.transform = "translate3d(" + (glowX - r.left - 1).toFixed(1) + "px," + (glowY - r.top - 1).toFixed(1) + "px,0)";
      ri.style.transform = "translate3d(" + (glowX - r.left).toFixed(1) + "px," + (glowY - r.top).toFixed(1) + "px,0)";
      const o = (k * k * (3 - 2 * k)).toFixed(3);
      gw.style.opacity = o; rw.style.opacity = o;
      now.add(b);
    }
  }
  glowLit.forEach(b => { if(!now.has(b) && b.__glow){ b.__glow[0].style.opacity = "0"; b.__glow[2].style.opacity = "0"; } });
  glowLit = now;
}
document.addEventListener("pointermove", e => {
  if(e.pointerType !== "mouse") return;
  let x = e.clientX, y = e.clientY;
  const pr = e.getPredictedEvents ? e.getPredictedEvents() : null;
  if(pr && pr.length){ const p = pr[Math.min(pr.length - 1, 1)]; x = p.clientX; y = p.clientY; }
  glowX = x; glowY = y; glowPaint();
}, { passive: true });
document.addEventListener("pointerout", e => { if(!e.relatedTarget){ glowX = glowY = -1e4; glowPaint(); } });
let glowScrollRaf = 0;
addEventListener("scroll", () => {
  if(glowX < -1e3 || glowScrollRaf) return;
  glowScrollRaf = requestAnimationFrame(() => { glowScrollRaf = 0; glowPaint(); });
}, { passive: true });

document.addEventListener("pointerover", e => {
  if(e.pointerType !== "mouse") return;
  const c = e.target.closest && e.target.closest(".map, .mvBtn");
  if(c && !c.classList.contains("mh")){
    c.classList.add("mh");
    c.addEventListener("pointerleave", () => c.classList.remove("mh"), { once: true });
  }
}, { passive: true });

document.addEventListener("pointerover", e => {
  if(e.pointerType !== "mouse") return;
  const b = e.target.closest && e.target.closest(".tabs button");
  if(b && !b.classList.contains("th")){
    b.classList.add("th");
    b.addEventListener("pointerleave", () => b.classList.remove("th"), { once: true });
  }
}, { passive: true });

function tapOn(el, fn){
  if(!el) return;
  let sx = 0, sy = 0, down = false;
  el.addEventListener("pointerdown", e => {
    if(e.pointerType === "mouse") return;
    down = true; sx = e.clientX; sy = e.clientY;
  }, { passive: true });
  el.addEventListener("pointercancel", () => { down = false; });
  el.addEventListener("pointerup", e => {
    if(!down || e.pointerType === "mouse") return;
    down = false;
    if(Math.hypot(e.clientX - sx, e.clientY - sy) > 12) return;
    el.__tapAt = Date.now();
    e.preventDefault();
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener("click", eat, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", eat, true), 600);
    fn(e);
  });
  el.addEventListener("click", e => {
    if(Date.now() - (el.__tapAt || 0) < 700){ e.preventDefault(); e.stopPropagation(); return; }
    fn(e);
  });
}
