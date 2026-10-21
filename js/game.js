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
/* cards appear as they scroll in, and the faster you scroll, the quicker they appear
   (a fast fling shows them almost at once instead of making you wait for each one) */
let scrollSpeed = 0, lastSY = scrollY, lastST = performance.now();
addEventListener("scroll", () => {
  const now = performance.now(), dt = now - lastST;
  if(dt > 0){
    const v = Math.abs(scrollY - lastSY) / dt;
    scrollSpeed = scrollSpeed * .6 + v * .4;
  }
  lastSY = scrollY; lastST = now;
}, { passive: true });
const revealIO = ("IntersectionObserver" in window) ? new IntersectionObserver(es => {
  const idle = performance.now() - lastST > 160;
  const speed = idle ? 0 : scrollSpeed;
  const k = speed > 4 ? 0 : speed > 2 ? .3 : speed > .8 ? .6 : 1;
  let n = 0;
  es.forEach(e => {
    if(!e.isIntersecting) return;
    const el = e.target;
    el.style.setProperty("--rvk", k);
    el.style.transitionDelay = k ? Math.min(n++, 4) * 30 * k + "ms" : "0ms";
    el.classList.add("in"); revealIO.unobserve(el);
  });
}, { rootMargin:"0px 0px 60px 0px", threshold:.01 }) : null;
function reveal(root){
  if(!revealIO){ return; }
  (root || document).querySelectorAll(".card,.games,h2,.phead,.chips").forEach((el, i) => {
    if(el.classList.contains("rv")) return;
    el.classList.add("rv");
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
  const all = [...(root || document).querySelectorAll(".tile b")].filter(el => !el.closest(".tile.wide, .tile.w2"));
  all.forEach(el => { if(el.style.fontSize) el.style.fontSize = ""; });
  const jobs = [];
  all.forEach(el => {
    if(el.clientWidth && el.scrollWidth > el.clientWidth + 1)
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
const NAME_FIT = [[".podn", 11], [".lbn", 11.5], [".tdc b", 13]];
function shrinkFit(pairs){
  pairs.forEach(([el]) => { if(el.style.fontSize) el.style.fontSize = ""; });
  const jobs = [];
  pairs.forEach(([el, min]) => {
    if(el.clientWidth && el.scrollWidth > el.clientWidth + 1)
      jobs.push({ el, min, size: parseFloat(getComputedStyle(el).fontSize) || 14 });
  });
  jobs.forEach(j => {
    j.size = Math.max(j.min, Math.floor(j.size * j.el.clientWidth / j.el.scrollWidth * 2) / 2);
    j.el.style.fontSize = j.size + "px";
  });
  jobs.forEach(j => {
    if(j.size > j.min && j.el.scrollWidth > j.el.clientWidth + 1) j.el.style.fontSize = Math.max(j.min, j.size - 1) + "px";
  });
}
function fitStick(){
  const nk = document.querySelector("#heroTop .idline");
  if(!nk) return;
  nk.style.fontSize = "";
  if(!nk.clientWidth || nk.scrollWidth <= nk.clientWidth + 1) return;
  shrinkFit([[nk, 15]]);
}
function fitNames(root){
  const pairs = [];
  NAME_FIT.forEach(([sel, min]) => (root || document).querySelectorAll(sel).forEach(el => pairs.push([el, min])));
  shrinkFit(pairs);
  if(!root) fitStick();
}
let fitNamesRAF = 0;
const fitNamesSoon = () => { if(!fitNamesRAF) fitNamesRAF = requestAnimationFrame(() => { fitNamesRAF = 0; fitNames(); }); };
addEventListener("resize", fitNamesSoon);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitNamesSoon);
if(typeof MutationObserver === "function") ["#lbBody", "#lbFound"].forEach(sel => {
  const el = $(sel); if(el) new MutationObserver(fitNamesSoon).observe(el, { childList: true });
});
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
    if(/^(player_)?rank$/.test(k) && typeof v === "string"){
      const tag = rankTag(v), name = rankName(v);
      out.push({ k:label(k), v:name, vhtml: tag ? '<span style="color:' + tag.c + '">' + esc(name) + "</span>" : esc(name), d:"" });
      continue;
    }
    if(typeof v === "string" && /^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(v)){ out.push({ k:label(k), v:pretty(v.toLowerCase()), d:"" }); continue; }
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
  let bar = "", rank = "", lvArgs = null;
  const lvRaw = gameLevel(cur, code);
  if(lvRaw){
    const cap = maxLevelOf(code);
    const lv = Math.floor(cap ? Math.min(lvRaw, cap) : lvRaw);
    const note = T("level") + (num(cur,"prestige") ? " · " + T("prestige") + " " + cur.prestige : "");
    const mg = META_GAMES[code], xp = num(cur, "xp");
    rank = last.g.main ? pick(last.g.main, "rank", "player_rank") : "";
    lvArgs = [code, cur, lv, cap, xp, rank];
    const next = cap && lv >= cap ? '<small class="lvmax">' + esc(T("lvMax")) + "</small>" : levelNextHTML(...lvArgs);
    bar = '<div class="tile wide lvl"><b>' + (cap ? lv + " / " + cap : lv) + "</b>" +
      (cap ? '<div class="bar"><i style="width:' + (lv / cap * 100).toFixed(2) + '%"></i></div>' : "") +
      "<small>" + note + "</small>" + next + levelUnlockHTML(code, lv, cap) + "</div>";
  }
  const m = document.createElement("div");
  m.className = "modal";
  const seg = code === "main" ? "" :
    '<div class="seg" role="tablist"><button type="button" data-tf="all" aria-pressed="true">' + esc(T("tfAll")) +
    '</button><button type="button" data-tf="month" aria-pressed="false">' + esc(T("tfMonth")) + "</button></div>";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(NAME(code)) +
    '</h3><button class="close">' + esc(T("close")) + "</button></div>" + seg + '<div class="mbody"></div><div class="mmaps"></div>' +
    (code === "main" ? "" : '<button type="button" class="mini lbgo">' + esc(T("lbOpen")) + "</button>") + "</div>";
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
  const go = m.querySelector(".lbgo");
  if(go) go.onclick = () => { closeModal(m, "nav"); openLb(code); };
  requestAnimationFrame(fillAll);
  if(MAP_GAMES.includes(code)) loadMaps(code).then(list => {
    const box = m.querySelector(".mmaps");
    if(box && list && list.length){ box.innerHTML = mapsHTML(list); mapsBind(box, list); }
  }).catch(() => {});
  if(lvArgs && xpRate(lvArgs[0], lvArgs[1]).src === "all" && !MONTHLY[nickKey()]){
    loadMonthly().then(() => {
      const el = m.querySelector(".lvnext");
      if(el && m.isConnected) el.outerHTML = levelNextHTML(...lvArgs);
    }).catch(() => {});
  }
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
  if(!res.ok){ if(c) return c.d; throw new Error(httpMsg(res.status)); }
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

function gamesWord(n){ return L === "ru" ? pluralRU(n, ["игра", "игры", "игр"]) : (n === 1 ? "game" : "games"); }
function xpRate(code, cur){
  const playedOf = c => c && !Array.isArray(c) ? (num(c, "played") || num(c, "games_played")) : 0;
  const pNow = playedOf(cur), xNow = num(cur, "xp");
  const since = Date.now() - 30 * 86400000;
  const snaps = mySnaps().filter(s => s.t >= since && s.g[code] && !(s.old || []).includes(code));
  for(const s of snaps){
    const dp = pNow - playedOf(s.g[code]), dx = xNow - num(s.g[code], "xp");
    if(dp >= 5 && dx > 0) return { rate: dx / dp, src: "recent" };
  }
  const mo = MONTHLY[nickKey()], mm = mo && mo.d && mo.d[code];
  if(playedOf(mm) >= 5 && num(mm, "xp") > 0) return { rate: num(mm, "xp") / playedOf(mm), src: "month" };
  return pNow && xNow ? { rate: xNow / pNow, src: "all" } : { rate: 0, src: "" };
}
function unlockKind(t){
  const k = String(t || "").toLowerCase().replace(/^global_?/, "");
  if(/title/.test(k)) return T("unlTitle");
  if(/avatar/.test(k)) return T("unlAvatar");
  if(/costume/.test(k)) return T("unlCostume");
  const raw = String(t || "").replace(/_/g, " ").trim();
  return (L === "ru" && UNLOCK_RU[raw.toLowerCase()]) || raw;
}
function unlIconFail(img){
  const w = img.closest(".ciw");
  if(w) w.remove();
}
function levelUnlockHTML(code, lv, cap){
  const mg = META_GAMES[code], un = mg && mg.u;
  if(!un) return "";
  const at = Object.keys(un).map(Number).filter(l => l > lv && (!cap || l <= cap)).sort((a, b) => a - b)[0];
  if(!at) return "";
  const list = un[at], shown = list.length > 4 ? list.slice(0, 3) : list;
  const rows = shown.map(x => {
    const kind = unlockKind(x.t);
    const icon = x.i
      ? '<span class="ciw lvui"><span><img alt="" src="' + esc(x.i) +
        '" onload="this.closest(\'.ciw\').classList.add(\'ok\')" onerror="unlIconFail(this)"></span></span>' : "";
    const name = hasMC(x.n) ? mcText(x.n) : esc(x.n);
    return '<div class="lvur">' + icon + '<span class="lvun">' + name + "</span>" +
      (kind ? '<span class="lvut">' + esc(kind) + "</span>" : "") + "</div>";
  }).join("");
  const more = list.length > shown.length
    ? '<div class="lvur lvumore">' + esc(T("unlMore", list.length - shown.length)) + "</div>" : "";
  return '<div class="lvunl"><div class="lvuh">' + esc(T("unlAt", at)) + "</div>" + rows + more + "</div>";
}
function rankBoost(rank){
  const r = String(rank || "").toUpperCase();
  return /ULTIMATE|ULTRA/.test(r) ? .75 : /PLUS|\+/.test(r) ? .5 : 0;
}
const BOOSTER = .5;
function levelNextHTML(code, cur, lv, cap, xp, rank){
  const tb = xpTable(code);
  if(!tb || !xp) return "";
  const a = tb.find(([, l]) => l === lv), b = tb.find(([, l]) => l === lv + 1);
  if(!a || !b || b[0] <= xp || b[0] <= a[0]) return "";
  const p = Math.max(0, Math.min(1, (xp - a[0]) / (b[0] - a[0])));
  const r = xpRate(code, cur), need = b[0] - xp;
  let eta = "", far = "", boosted = "";
  if(r.rate){
    const g1 = Math.max(1, Math.ceil(need / r.rate));
    eta = '<span class="lveg"><strong>≈ ' + nf(g1) + "</strong> " + esc(gamesWord(g1)) + "</span>";
    const rb = rankBoost(rank);
    const gb = Math.max(1, Math.ceil(need / (r.rate / (1 + rb) * (1 + rb + BOOSTER))));
    if(gb < g1) boosted = '<span class="lvboost">' + esc(T("lvBoostLine")) + " <strong>≈ " + nf(gb) + "</strong></span>";
    const top = cap && cap > lv + 1 && tb.find(([, l]) => l === cap);
    if(top && top[0] > xp){
      const g2 = Math.max(1, Math.ceil((top[0] - xp) / r.rate));
      far = '<span class="lvfar">' + esc(T("lvFar", cap, nf(g2), gamesWord(g2))) + "</span>";
    }
  }
  return '<div class="lvnext"><div class="bar thin"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>' +
    '<div class="lvrow"><span class="lvneed">' + esc(T("lvTo", lv + 1)) + " <strong>" + nf(need) + "</strong> " +
    esc(T("lvXpWord")) + "</span>" + eta + "</div>" +
    (far || boosted ? '<div class="lvsub">' + far + boosted + "</div>" : "") + "</div>";
}

const MAP_GAMES = ["drop", "ctf", "dr", "grav", "ground", "hide", "murder", "sky", "sg", "wars", "bridge"];
const MAPS = {};
async function loadMaps(code){
  const key = "hive.tracker.maps." + code;
  if(MAPS[code]) return MAPS[code];
  try{
    const c = JSON.parse(localStorage.getItem(key) || "null");
    if(c && Date.now() - c.t < 86400000 && Array.isArray(c.d)) return (MAPS[code] = c.d);
  }catch(e){}
  noteRequest();
  const res = await hiveFetch(API + "/game/map/" + code, { cache:"no-store" });
  if(!res.ok) return [];
  let d = await res.json();
  if(!Array.isArray(d)) d = (d && typeof d === "object" && Object.values(d).find(Array.isArray)) || [];
  d = d.filter(x => x && typeof x === "object" && x.name).map(x => ({ name: x.name, season: x.season, variant: x.variant, image: x.image }));
  try{ localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); }catch(e){}
  return (MAPS[code] = d);
}
const MAP_VARIANT = { REGULAR:["Обычная","Regular"], DUOS:["Дуо","Duos"], TRIOS:["Трио","Trios"], SQUADS:["Отряды","Squads"],
  MEGA:["Мега","Mega"], ROYALE:["Royale","Royale"] };
const MAP_SEASON = { WINTERFEST:["зимняя","Winterfest"], SPRING:["весенняя","Spring"], SUMMER:["летняя","Summer"],
  HALLOWEEN:["хэллоуинская","Halloween"], AUTUMN:["осенняя","Autumn"] };
const MAP_ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';
function mapTags(x){
  const i = L === "ru" ? 0 : 1, out = [];
  if(MAP_VARIANT[x.variant] && x.variant !== "REGULAR") out.push('<i class="mt v">' + esc(MAP_VARIANT[x.variant][i]) + "</i>");
  if(MAP_SEASON[x.season]) out.push('<i class="mt s">' + esc(MAP_SEASON[x.season][i]) + "</i>");
  return out.join("");
}
const mapImg = x => x.image && /^https?:/.test(x.image) ? x.image : "";
const MAPS_PREVIEW = 6;
function mapTile(x, k){
  const img = mapImg(x);
  return '<button type="button" class="map" data-k="' + k + '">' +
    '<span class="mpic">' + (img ? '<img alt="" loading="lazy" decoding="async" src="' + esc(img) + '" onerror="this.remove()">' : "") + "</span>" +
    '<span class="mcap"><b>' + esc(x.name) + "</b>" + (mapTags(x) ? '<span class="mtags">' + mapTags(x) + "</span>" : "") + "</span></button>";
}
function mapsHTML(list){
  return '<div class="mapsHead"><span class="mapsT">' + esc(T("mapsTitle")) + '</span><span class="mapsN">' + list.length + "</span></div>" +
    '<div class="mapsGrid">' + list.slice(0, MAPS_PREVIEW).map(mapTile).join("") + "</div>" +
    (list.length > MAPS_PREVIEW ? '<button type="button" class="mini more mapsAll">' + esc(T("mapsAll", list.length)) + "</button>" : "");
}
function mapsBind(box, list){
  box.querySelectorAll(".mapsGrid .map").forEach(c => tapOn(c, () => openMap(list, +c.dataset.k, c)));
  staggerIn(box.querySelectorAll(".mapsGrid .map"), 8);
  const all = box.querySelector(".mapsAll");
  if(all) tapOn(all, () => openMapsAll(list, all));
}
function openMapsAll(list, from){
  const i = L === "ru" ? 0 : 1;
  const kinds = [];
  list.forEach(x => {
    if(MAP_VARIANT[x.variant] && x.variant !== "REGULAR" && !kinds.some(k => k.v === x.variant)) kinds.push({ v: x.variant, t: MAP_VARIANT[x.variant][i], c: "v" });
    if(MAP_SEASON[x.season] && !kinds.some(k => k.s === x.season)) kinds.push({ s: x.season, t: MAP_SEASON[x.season][i], c: "s" });
  });
  const m = document.createElement("div");
  m.className = "modal mapsx";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("mapsTitle")) + ' <span class="mapsN">' + list.length + "</span></h3>" +
    '<button class="close">' + esc(T("close")) + "</button></div>" +
    '<div class="mapsTools"><label class="mapsFind"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
      '<input type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(T("mapsFind")) + '"></label>' +
      (kinds.length ? '<div class="mapsChips">' + kinds.map((k, n) => '<button type="button" class="mchip ' + k.c + '" data-n="' + n + '">' + esc(k.t) + "</button>").join("") + "</div>" : "") +
    '</div><div class="mapsGrid all"></div><p class="sub mapsNone" hidden>' + esc(T("mapsNone")) + "</p></div>";
  const grid = m.querySelector(".mapsGrid"), inp = m.querySelector(".mapsFind input"), none = m.querySelector(".mapsNone");
  const on = new Set();
  let shown = list;
  const draw = animate => {
    const q = inp.value.trim().toLowerCase();
    shown = list.filter(x => (!q || String(x.name).toLowerCase().includes(q)) &&
      [...on].every(n => { const k = kinds[n]; return k.v ? x.variant === k.v : x.season === k.s; }));
    grid.innerHTML = shown.map(mapTile).join("");
    none.hidden = shown.length > 0;
    grid.querySelectorAll(".map").forEach(c => tapOn(c, () => openMap(shown, +c.dataset.k, c)));
    if(animate) staggerIn(grid.children, 16);
  };
  inp.oninput = () => draw(false);
  m.querySelectorAll(".mchip").forEach(b => tapOn(b, () => {
    const n = +b.dataset.n;
    on.has(n) ? on.delete(n) : on.add(n);
    b.classList.toggle("on", on.has(n));
    draw(true);
  }));
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
  setTimeout(() => draw(true), 30);
}
function openMap(list, k, from){
  const m = document.createElement("div");
  m.className = "modal mapv";
  m.innerHTML = '<div class="inner"><div class="mvStage"><div class="mvPic"></div>' +
    (list.length > 1 ? '<button type="button" class="mvBtn" data-d="-1" aria-label="' + esc(T("mapsPrev")) + '">' + MAP_ARROW + "</button>" +
      '<button type="button" class="mvBtn next" data-d="1" aria-label="' + esc(T("mapsNext")) + '">' + MAP_ARROW + "</button>" : "") +
    '<button type="button" class="close mvClose" aria-label="' + esc(T("close")) + '">✕</button></div>' +
    '<div class="mvInfo"><div><b class="mvName"></b><span class="mtags mvTags"></span></div><span class="mvNum"></span></div></div>';
  const pic = m.querySelector(".mvPic"), motion = !state.lite && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = (n, dir) => {
    k = (n + list.length) % list.length;
    const x = list[k], img = mapImg(x);
    const el = document.createElement("div");
    el.className = "mvImg";
    if(img) el.innerHTML = '<img alt="" decoding="async" src="' + esc(img) + '">';
    const old = pic.querySelector(".mvImg:not(.leaving)");
    pic.append(el);
    if(old && motion && dir){
      old.classList.add("leaving");
      old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translate3d(" + (-dir * 8) + "%,0,0) scale(.98)" }],
        { duration: 280, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }).onfinish = () => old.remove();
      el.animate([{ opacity: 0, transform: "translate3d(" + (dir * 10) + "%,0,0) scale(.98)" }, { opacity: 1, transform: "none" }],
        { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
    }else if(old) old.remove();
    m.querySelector(".mvName").textContent = x.name;
    m.querySelector(".mvTags").innerHTML = mapTags(x);
    m.querySelector(".mvNum").textContent = (k + 1) + " / " + list.length;
  };
  show(k, 0);
  m.querySelectorAll(".mvBtn").forEach(b => tapOn(b, e => { e.stopPropagation(); show(k + +b.dataset.d, +b.dataset.d); }));
  tapOn(m.querySelector(".mvClose"), e => { e.stopPropagation(); closeModal(m); });
  const key = e => {
    if(!m.isConnected){ removeEventListener("keydown", key); return; }
    if(e.key === "ArrowRight") show(k + 1, 1);
    else if(e.key === "ArrowLeft") show(k - 1, -1);
  };
  addEventListener("keydown", key);
  let sx = null;
  pic.addEventListener("pointerdown", e => { sx = e.clientX; });
  pic.addEventListener("pointercancel", () => { sx = null; });
  pic.addEventListener("pointerup", e => {
    if(sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if(Math.abs(dx) > 40 && list.length > 1) show(k + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  m.onclick = e => { if(e.target === m) closeModal(m); };
  mountModal(m, from);
}
