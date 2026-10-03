"use strict";

function sizeClass(v){
  const n = String(v).length;
  return n <= 6 ? "" : n <= 9 ? "sm" : n <= 12 ? "xs" : "xxs";
}
function tilesHTML(list, extra){
  return '<div class="tiles">' + (extra || "") + list.map((m, i) => {
    const long = String(m.v).length >= 10;
    const cls = (m.wide ? " wide" : (m.w2 || long ? " w2" : "")) + (m.act ? " tap" : "");
    return '<div class="tile' + cls + '"' + (m.act ? ' data-act="' + m.act + '"' : "") +
      ' style="--i:' + i + '"><b class="' + sizeClass(m.v) + '">' + (m.vhtml || esc(m.v)) + "</b>" +
      "<small>" + esc(m.k) + "</small></div>";
  }).join("") + "</div>";
}
const revealIO = ("IntersectionObserver" in window) ? new IntersectionObserver(es => {
  es.forEach(e => { if(e.isIntersecting){ e.target.classList.add("in"); revealIO.unobserve(e.target); } });
}, { rootMargin:"0px 0px -30px 0px", threshold:.02 }) : null;
function reveal(root){
  if(!revealIO){ return; }
  (root || document).querySelectorAll(".card,.games,h2,.phead,.chips").forEach((el, i) => {
    if(el.classList.contains("rv")) return;
    el.classList.add("rv");
    el.style.transitionDelay = Math.min(i, 6) * 25 + "ms";
    revealIO.observe(el);
  });
}
const WAVE = 5;
function syncTitleWave(){
  const box = document.querySelector(".title");
  if(!box) return;
  const els = [...box.querySelectorAll(".sh")];
  if(!els.length) return;
  const x0 = Math.min(...els.map(e => e.offsetLeft));
  const w = Math.max(...els.map(e => e.offsetLeft + e.offsetWidth)) - x0;
  if(!(w > 0)) return;
  box.style.setProperty("--w", w + "px");
  els.forEach(e => {
    e.style.animationDelay = (WAVE * ((e.offsetLeft - x0) / w - 1)).toFixed(3) + "s";
  });
}
addEventListener("resize", syncTitleWave);
function fitText(root){
  const all = (root || document).querySelectorAll(".tile b");
  const jobs = [];
  all.forEach(el => {
    if(el.closest(".tile.wide, .tile.w2")) return;
    if(el.scrollWidth > el.clientWidth + 1)
      jobs.push({ el, size: parseFloat(getComputedStyle(el).fontSize) || 24 });
  });
  jobs.forEach(j => {
    const ratio = j.el.clientWidth / j.el.scrollWidth;
    let size = Math.max(10, Math.floor(j.size * ratio));
    j.el.style.fontSize = size + "px";
    if(size > 10 && j.el.scrollWidth > j.el.clientWidth + 1)
      j.el.style.fontSize = (size - 1) + "px";
  });
}
addEventListener("resize", () => fitText());
const KILL_KEY = /(^|_)kills$/;
const KILL_EXTRA = /^(murders|murderer_eliminations|eliminations)$/;
function killsParts(c){
  let base = 0, fin = 0;
  if(!c) return { base, fin };
  for(const key of Object.keys(c)){
    const v = c[key];
    if(typeof v !== "number") continue;
    if(key === "final_kills") fin += v;
    else if(KILL_KEY.test(key) || KILL_EXTRA.test(key)) base += v;
  }
  return { base, fin };
}
function killsOf(c){
  const p = killsParts(c);
  return p.base + (state.finals ? p.fin : 0);
}
const RATING_ORDER = [
  "rating_love_received", "love_ratings",
  "rating_great_received", "great_ratings",
  "rating_good_received", "good_ratings",
  "rating_okay_received", "okay_ratings",
  "rating_meh_received", "meh_ratings"
];
function orderedKeys(cur){
  const keys = Object.keys(cur);
  const ratingKeys = keys.filter(k => RATING_ORDER.includes(k))
    .sort((a, b) => RATING_ORDER.indexOf(a) - RATING_ORDER.indexOf(b));
  if(!ratingKeys.length) return keys;
  let inserted = false;
  const out = [];
  keys.forEach(k => {
    if(RATING_ORDER.includes(k)){
      if(!inserted){ out.push(...ratingKeys); inserted = true; }
    } else out.push(k);
  });
  return out;
}
function hasKillField(c){
  if(!c) return false;
  for(const key of Object.keys(c)){
    if(typeof c[key] !== "number") continue;
    if(key === "final_kills" || KILL_KEY.test(key) || KILL_EXTRA.test(key)) return true;
  }
  return false;
}
function metrics(cur, old){
  const out = [];
  const delta = k => {
    if(!old || typeof cur[k] !== "number" || typeof old[k] !== "number") return "";
    const d = cur[k] - old[k];
    return d === 0 ? "" : (d > 0 ? "+" : "−") + nf(Math.abs(d));
  };
  const played = num(cur,"played") || num(cur,"games_played");
  const wins = num(cur,"victories"), deaths = num(cur,"deaths");
  const kills = killsOf(cur);
  let firstTile = null;

  for(const k of orderedKeys(cur)){
    if(SKIP.has(k)) continue;
    const v = cur[k];
    if(v === null || typeof v === "object") continue;
    if(typeof v === "boolean"){ out.push({ k:label(k), v: v ? "✓" : "—", d:"" }); continue; }
    if(hasMC(v)){ out.push({ k:label(k), v:String(v).replace(/[§&][0-9a-z]/gi,""),
      vhtml:mcText(v), d:"" }); continue; }
    if(isDateKey(k) && typeof v === "number" && v > 1e8){
      firstTile = { k:T("firstPlayed"), v:dateOf(v), d:"", wide:true }; continue;
    }
    out.push({ k:labelN(k, v), v:nf(v), d:delta(k) });
  }
  if(played && wins) out.push({ k:T("winrate"), v:pct(wins, played), d:"", wide:true });
  if(firstTile) out.push(firstTile);
  if(played && wins) out.push({ k: L === "ru" ? pluralRU(played - wins, LOSSES_RU) : T("losses"),
    v:nf(played - wins), d:"" });
  if(hasKillField(cur) && deaths) out.push({ k:T("kd"), v:ratio(kills, deaths), d:"" });
  if(played && kills) out.push({ k:T("perGameK"), v:ratio(kills, played), d:"" });
  if(played && deaths) out.push({ k:T("perGameD"), v:ratio(deaths, played), d:"" });
  if(played && num(cur,"xp")) out.push({ k:T("perGameX"), v:ratio(num(cur,"xp"), played), d:"" });
  if(played && num(cur,"final_kills")) out.push({ k:T("perGameF"), v:ratio(num(cur,"final_kills"), played), d:"" });
  return out;
}
function openGame(code, from){
  const mine = mySnaps();
  const last = mine[mine.length-1], prev = mine[mine.length-2];
  const cur = last && last.g[code]; if(!cur) return;
  const old = prev && prev.g[code];
  let bar = "";
  const lvRaw = gameLevel(cur, code);
  if(lvRaw){
    const cap = maxLevelOf(code);
    const lv = Math.floor(cap ? Math.min(lvRaw, cap) : lvRaw);
    const note = T("level") + (num(cur,"prestige") ? " · " + T("prestige") + " " + cur.prestige : "");
    bar = '<div class="tile wide lvl"><b>' + (cap ? lv + " / " + cap : lv) + "</b>" +
      (cap ? '<div class="bar"><i style="width:' + (lv / cap * 100).toFixed(2) + '%"></i></div>' : "") +
      "<small>" + note + "</small></div>";
  }
  const m = document.createElement("div");
  m.className = "modal";
  const seg = code === "main" ? "" :
    '<div class="seg" role="tablist"><button type="button" data-tf="all" aria-pressed="true">' + esc(T("tfAll")) +
    '</button><button type="button" data-tf="month" aria-pressed="false">' + esc(T("tfMonth")) + "</button></div>";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(NAME(code)) +
    '</h3><button class="close">' + esc(T("close")) + "</button></div>" + seg + '<div class="mbody"></div></div>';
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
  const box = m.querySelector(".mbody");
  const fillAll = () => {
    box.innerHTML =
      (old ? '<p class="sub" style="margin:0 0 14px">' + esc(T("sinceHint", when(prev.t))) + "</p>" : "") +
      tilesHTML(metrics(cur, old), bar);
    fitText(m);
  };
  m.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    m.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
    if(b.dataset.tf === "month") fillMonth(box, code, m); else fillAll();
  });
  requestAnimationFrame(fillAll);
}
const MONTHLY = {};
async function loadMonthly(){
  const n = nickKey(), c = MONTHLY[n];
  if(c && Date.now() - c.t < 15 * 60 * 1000) return c.d;
  const d0 = new Date();
  const url = API + "/game/monthly/player/all/" + encodeURIComponent(state.nick) + "/" +
    d0.getUTCFullYear() + "/" + (d0.getUTCMonth() + 1);
  noteRequest();
  let res;
  try{ res = await hiveFetch(url, { cache:"no-store", headers: HIVE_HEADERS }); }
  catch(e){ if(c) return c.d; throw new Error(T("netErr")); }
  if(res.status === 429){ if(c) return c.d; throw new Error(T("limitHiveLater")); }
  if(res.status === 404){ MONTHLY[n] = { t: Date.now(), d: {} }; return {}; }
  if(!res.ok){ if(c) return c.d; throw new Error(T("httpErr", res.status)); }
  let d = await res.json();
  if(!d || typeof d !== "object" || Array.isArray(d)) d = {};
  MONTHLY[n] = { t: Date.now(), d };
  return d;
}
async function fillMonth(box, code, m){
  box.innerHTML = '<p class="sub" style="margin:0">' + esc(T("tqLoading")) + "</p>";
  try{
    const d = await loadMonthly();
    if(!box.isConnected || !m.querySelector('.seg [data-tf="month"][aria-pressed="true"]')) return;
    const raw = d && d[code];
    const c = raw && typeof raw === "object" && !Array.isArray(raw) ? Object.assign({}, raw) : null;
    if(!c || !(num(c, "played") || num(c, "games_played"))){
      box.innerHTML = '<p class="sub" style="margin:0">' + esc(T("monthNone")) + "</p>"; return;
    }
    const place = typeof c.human_index === "number" ? c.human_index
      : typeof c.index === "number" ? c.index + 1 : 0;
    delete c.id;
    const month = new Date().toLocaleString(L === "ru" ? "ru-RU" : "en-US", { month:"long", timeZone:"UTC" });
    box.innerHTML = '<p class="sub" style="margin:0 0 14px">' + esc(T("monthHint", month)) + "</p>" +
      tilesHTML(metrics(c, null), place ? '<div class="tile wide"><b>#' + nf(place) + "</b><small>" +
        esc(T("monthRank")) + "</small></div>" : "");
    fitText(m);
  }catch(e){ if(box.isConnected) box.innerHTML = '<p class="sub" style="margin:0">' + esc(e.message) + "</p>"; }
}
function openKills(from){
  const mine = mySnaps();
  const last = mine[mine.length-1]; if(!last) return;
  const playedOf = c => num(c,"played") || num(c,"games_played");
  const codes = state.games.filter(g => g !== "main" && last.g[g])
    .sort((a,b) => playedOf(last.g[b]) - playedOf(last.g[a]));
  let base = 0, fin = 0;
  const rows = codes.map(g => {
    const c = last.g[g], used = [], other = [];
    for(const k of Object.keys(c)){
      if(typeof c[k] !== "number") continue;
      if(k === "final_kills" || KILL_KEY.test(k) || KILL_EXTRA.test(k)) used.push(k + " " + nf(c[k]));
      else if(/kill|murder|elimin/i.test(k)) other.push(k + " " + nf(c[k]));
    }
    const p = killsParts(c);
    base += p.base; fin += p.fin;
    if(!p.base && !p.fin) return "";
    return '<div class="cos"><span>' + esc(NAME(g)) +
      (used.length ? "<i>" + esc(used.join(" · ")) + "</i>" : "") +
      (other.length ? '<i style="color:var(--gold)">' + esc(T("skippedF")) + ": " +
        esc(other.join(", ")) + "</i>" : "") +
      "</span><b>" + nf(p.base + p.fin) + "</b></div>";
  }).join("");

  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("killsTitle")) +
    '</h3><button class="close">' + esc(T("close")) + "</button></div>" +
    '<div class="card">' + rows +
    '<div class="cos sum" style="margin-top:8px"><span>' +
    esc(T("sumNoFinals")) + "</span><b>" + nf(base) + "</b></div>" +
    '<div class="cos sum gold"><span>' + esc(T("sumWithFinals")) + "</span><b>" + nf(base + fin) + "</b></div>" +
    '</div><p class="sub">' + esc(T("killsHint")) + "</p></div>";
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
}
