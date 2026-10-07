"use strict";

const LB = {}, LB_PLACE = {};
const LB_SEASONS = [5, 4, 3, 2, 1];
const LB_MONTHS_BACK = 6;
const LB_PAGE = 100;
const LB_SKIP_KEYS = new Set(["index", "human_index", "username", "username_cc", "UUID", "uuid", "id", "xuid"]);
let lbPick = null, lbSeq = 0, lbSearch = null, lbRestore = null;
const LB_CHUNK = 40;
let lbPending = null, lbMinRows = 0, lbShown = "";
const lbSentIO = "IntersectionObserver" in window ? new IntersectionObserver(es => {
  if(es.some(e => e.isIntersecting)) lbAppend(60);
}, { rootMargin: "0px 0px 900px 0px" }) : null;
function lbAppend(n){
  const card = $("#lbBody .lbcard"), sent = card && card.querySelector(".lbsent");
  if(!sent || !lbPending || !lbPending.rows.length) return false;
  const p = lbPending, part = p.rows.splice(0, n);
  sent.insertAdjacentHTML("beforebegin", part.map(x => lbRow(x, p.m, p.me, p.top, p.overall)).join(""));
  const names = card.querySelectorAll(".lbn"), pairs = [];
  for(let i = Math.max(0, names.length - part.length); i < names.length; i++) pairs.push([names[i], 11.5]);
  shrinkFit(pairs);
  if(!p.rows.length && lbSentIO) lbSentIO.unobserve(sent);
  return true;
}
function lbPaint(entry, game, sort, keepRows){
  lbMinRows = keepRows ? $("#lbBody").querySelectorAll(".lbcard .lbr").length : 0;
  $("#lbBody").innerHTML = lbHTML(entry, game, sort);
  lbMinRows = 0;
  lbShown = game + "|" + $("#lbPeriod").value + "|" + sort + "|" + entry.t + "|" + entry.d.length;
  const sent = $("#lbBody .lbsent");
  if(sent && lbSentIO && lbPending && lbPending.rows.length) lbSentIO.observe(sent);
  lbPodiumAvatars();
}
const lbAvTried = new Set();
function lbPodiumAvatars(){
  document.querySelectorAll("#lbBody .pod[data-n]").forEach(async el => {
    const name = el.dataset.n, k = name.toLowerCase();
    if(state.avatars[k] || lbAvTried.has(k)) return;
    lbAvTried.add(k);
    try{
      let d = await lbFetch(API + "/game/all/main/" + encodeURIComponent(name));
      if(d && typeof d === "object" && !Array.isArray(d)){
        const ks = Object.keys(d);
        if(ks.length === 1 && d[ks[0]] && typeof d[ks[0]] === "object") d = d[ks[0]];
      }
      const url = d && cosIcon(pick(d, "equipped_avatar", "avatar_equipped"));
      if(!url) return;
      state.avatars[k] = url;
      saveSoon();
      document.querySelectorAll('#lbBody .pod[data-n] .podav').forEach(av => {
        const pod = av.closest(".pod");
        if(pod && pod.dataset.n.toLowerCase() === k){
          const pav = av.querySelector(".pav");
          if(pav) pav.outerHTML = pavHTML(name);
        }
      });
    }catch(e){}
  });
}
function lbFillTo(y){
  let guard = 0;
  while(document.documentElement.scrollHeight < y + innerHeight + 200 && lbAppend(120) && guard++ < 50){}
}

function lbMonthDate(back){
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
}
function lbMonthName(d){
  return d.toLocaleString(L === "ru" ? "ru-RU" : "en-US", { month:"long", year:"numeric", timeZone:"UTC" })
    .replace(/\s*г\.$/, "");
}
function lbPeriods(game){
  if(game === "overall") return [["all", T("tfAll")]];
  const out = [["all", T("tfAll")]];
  for(let i = 0; i < LB_MONTHS_BACK; i++)
    out.push(["m" + i, i ? lbMonthName(lbMonthDate(i)) : T("lbMonth", lbMonthName(lbMonthDate(0)))]);
  if(game === "bed") LB_SEASONS.forEach(s => out.push(["s" + s, T("lbSeason", s)]));
  return out;
}
function lbUrl(game, period){
  if(period === "all") return API + "/game/all/" + game;
  if(period[0] === "m"){
    const d = lbMonthDate(+period.slice(1));
    return API + "/game/monthly/" + game + "/" + d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1);
  }
  return API + "/game/season/" + game + "/" + period.slice(1);
}
function lbPlayerUrl(game, period, nick){
  const n = encodeURIComponent(nick);
  if(period === "all") return API + "/game/all/" + game + "/" + n;
  if(period[0] === "m"){
    const d = lbMonthDate(+period.slice(1));
    return API + "/game/monthly/player/all/" + n + "/" + d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1);
  }
  return API + "/game/season/player/" + game + "/" + n + "/" + period.slice(1);
}
async function lbFetch(url){
  noteRequest();
  let res;
  try{ res = await hiveFetch(url, { cache:"no-store", headers: HIVE_HEADERS }); }
  catch(e){ throw new Error(T("netErr")); }
  if(res.status === 429) throw new Error(T("lbLimit"));
  if(res.status === 404) return null;
  if(!res.ok){ const err = new Error(httpMsg(res.status)); err.status = res.status; throw err; }
  return res.json();
}
const lbName = p => String(p.username_cc || p.username || "?");
const lbPlaceOf = (p, i) => typeof p.human_index === "number" ? p.human_index
  : typeof p.index === "number" ? p.index + 1 : i + 1;
const lbArr = d => Array.isArray(d) ? d : (d && typeof d === "object" && Object.values(d).find(Array.isArray)) || [];
async function loadLb(game, period, stale){
  if(game === "overall") return loadOverall(stale);
  const key = game + "|" + period, c = LB[key];
  if(c && (stale || Date.now() - c.t < 10 * 60 * 1000)) return c;
  try{
    const d = lbArr(await lbFetch(lbUrl(game, period)));
    LB[key] = { t: Date.now(), d, more: period !== "all" && d.length >= LB_PAGE };
  }catch(e){ if(c) return c; throw e; }
  return LB[key];
}
async function lbMore(entry, game, period){
  try{
    const d = lbArr(await lbFetch(lbUrl(game, period) + "/" + LB_PAGE + "/" + entry.d.length));
    const seen = new Set(entry.d.map(p => lbName(p).toLowerCase()));
    const fresh = d.filter(p => !seen.has(lbName(p).toLowerCase()));
    entry.d.push(...fresh);
    entry.more = fresh.length >= LB_PAGE;
  }catch(e){
    entry.more = false;
    if(e.status && e.status < 500) return;
    throw e;
  }
}

const lbGameLevel = (p, code) => Math.floor(levelFromXP(num(p, "xp"), code) || gameLevel(p, code) || 0);
async function loadOverall(stale){
  const c = LB["overall|all"];
  if(c && (stale || Date.now() - c.t < 10 * 60 * 1000)) return c;
  const codes = GAMES.map(g => g[0]).filter(g => g !== "main");
  const res = await Promise.allSettled(codes.map(g => loadLb(g, "all")));
  const acc = new Map();
  res.forEach((r, i) => {
    if(r.status !== "fulfilled") return;
    const code = codes[i];
    r.value.d.forEach(p => {
      const k = lbName(p).toLowerCase();
      const a = acc.get(k) || { username: lbName(p), played: 0, victories: 0, kills: 0, deaths: 0, __xp: [], __games: 0 };
      a.played += num(p, "played") || num(p, "games_played");
      a.victories += num(p, "victories");
      a.kills += killsOf(p);
      a.deaths += num(p, "deaths");
      a.__xp.push([code, p]);
      a.__games++;
      acc.set(k, a);
    });
  });
  if(!acc.size){
    const err = res.find(r => r.status === "rejected");
    throw err ? err.reason : new Error(T("lbEmpty"));
  }
  LB["overall|all"] = { t: Date.now(), d: [...acc.values()], more: false, overall: true, games: res.filter(r => r.status === "fulfilled").length };
  return LB["overall|all"];
}

function lbSortOptions(game, entry){
  const common = [["wins", T("lbSortWins")], ["played", T("lbSortPlayed")], ["winrate", T("lbSortWr")],
    ["kills", T("lbSortKills")], ["kd", "K/D"]];
  const hasLv = Object.keys(META_GAMES).length > 0;
  const base = game === "overall"
    ? (hasLv ? [["level", T("lbSortLevel")]].concat(common) : common)
    : [["hive", T("lbSortHive")]].concat(common, hasLv ? [["level", T("lbSortLv")]] : []);
  if(game !== "overall" && entry && entry.d.length){
    const seen = new Set(["victories", "played", "games_played", "kills", "deaths", "xp"]);
    const keys = [];
    entry.d.slice(0, 20).forEach(p => Object.keys(p).forEach(k => {
      if(!LB_SKIP_KEYS.has(k) && !seen.has(k) && typeof p[k] === "number"){ seen.add(k); keys.push(k); }
    }));
    keys.forEach(k => base.push(["f:" + k, label(k).toLowerCase()]));
  }
  return base;
}
function lbMetric(sort, game){
  const played = p => num(p, "played") || num(p, "games_played");
  const M = {
    hive:    { v: p => num(p, "victories"), f: nf, unit: () => T("lbWinsLow") },
    wins:    { v: p => num(p, "victories"), f: nf, unit: () => T("lbWinsLow") },
    played:  { v: played, f: nf, unit: () => T("lbGamesLow") },
    winrate: { v: p => played(p) ? num(p, "victories") / played(p) * 100 : 0, f: v => v.toFixed(2) + "%", unit: () => "" },
    kills:   { v: p => game === "overall" ? num(p, "kills") : killsOf(p), f: nf, unit: () => T("lbKillsLow") },
    kd:      { v: p => { const k = game === "overall" ? num(p, "kills") : killsOf(p), d = num(p, "deaths"); return d ? k / d : k; },
               f: v => v.toFixed(2), unit: () => "K/D" },
    level:   { v: p => game === "overall" ? p.__xp.reduce((s, [c, q]) => s + lbGameLevel(q, c), 0) : lbGameLevel(p, game),
               f: nf, unit: () => T("lbLevelLow") }
  };
  if(sort.startsWith("f:")){ const k = sort.slice(2); return { v: p => num(p, k), f: nf, unit: () => label(k) }; }
  return M[sort] || M.hive;
}
function lbView(entry, game, sort){
  const m = lbMetric(sort, game);
  const minPlayed = sort === "winrate" || sort === "kd" ? 10 : 0;
  let list = entry.d.map((p, i) => ({ p, hive: lbPlaceOf(p, i) }));
  if(sort !== "hive"){
    list = list.filter(x => !minPlayed || (num(x.p, "played") || num(x.p, "games_played")) >= minPlayed);
    list.forEach(x => { x.sv = m.v(x.p); });
    list.sort((a, b) => b.sv - a.sv);
    list.forEach((x, i) => { x.place = i + 1; });
  }else list.forEach(x => { x.place = x.hive; });
  return { list, m };
}

function lbMe(){ return String(state.main || state.nick || "").trim().toLowerCase(); }
function lbStats(p){
  const played = num(p, "played") || num(p, "games_played"), wins = num(p, "victories");
  return { played, wins, wr: played ? pct(wins, played) : "—" };
}
function lbSubline(p, overall){
  const x = lbStats(p);
  return overall ? T("lbOverallSub", nf(x.played), x.wr, p.__games) : T("lbGamesWr", nf(x.played), x.wr);
}
function lbCells(x, m, overall){
  const p = x.p, s = lbStats(p), v = m.f(m.v(p));
  return '<span class="lbp">' + (x.place ? nf(x.place) : "—") + "</span>" +
    '<span class="lbu"><span class="lbnn"><span class="lbn">' +
    esc(lbName(p)) + '</span><small class="lbs">' + esc(lbSubline(p, overall)) + "</small></span></span>" +
    '<span class="lbv"><b>' + v + "</b><small>" + esc(m.unit()) + "</small></span>" +
    '<span class="lbc lbcw">' + v + '</span><span class="lbc">' + nf(s.played) + '</span><span class="lbc">' +
    '<em class="wrc">' + s.wr + "</em></span>";
}
function lbRow(x, m, me, top, overall){
  const name = lbName(x.p), isMe = !!me && name.toLowerCase() === me;
  const w = top > 0 ? Math.max(2, Math.min(100, m.v(x.p) / top * 100)) : 0;
  return '<button type="button" class="lbr' + (isMe ? " me" : "") + '" style="--w:' + w.toFixed(1) + '%" data-n="' +
    esc(name) + '" data-p="' + x.place + '">' + lbCells(x, m, overall) + "</button>";
}
function lbPodium(list, m, me){
  if(list.length < 3 || list[0].place !== 1) return "";
  return '<div class="podium">' + [1, 0, 2].map(i => {
    const x = list[i], name = lbName(x.p), isMe = !!me && name.toLowerCase() === me;
    return '<button type="button" class="pod pod' + x.place + (isMe ? " me" : "") + '" data-n="' + esc(name) +
      '" data-p="' + x.place + '"><span class="podav">' + pavHTML(name) + '<b class="podm">' + x.place + "</b></span>" +
      '<span class="podn">' + esc(name) + '</span><span class="podw">' + m.f(m.v(x.p)) + "</span>" +
      '<small class="pods">' + esc(m.unit() || T("winrate")) + "</small></button>";
  }).join("") + "</div>";
}
const lbHead = m => '<div class="lbhead"><span>#</span><span>' + esc(T("lbColPlayer")) + "</span><span>" +
  esc(m.unit() || T("winrate")) + "</span><span>" + esc(T("played")) + "</span><span>" + esc(T("lbColWr")) + "</span></div>";
function lbHTML(entry, game, sort){
  if(!entry.d.length) return '<p class="sub" style="margin-top:20px">' + esc(T("lbEmpty")) + "</p>";
  const overall = game === "overall";
  const { list, m } = lbView(entry, game, sort);
  const me = lbMe(), top = list.reduce((mx, x) => Math.max(mx, x.sv !== undefined ? x.sv : m.v(x.p)), 0);
  const podium = lbPodium(list, m, me);
  const rest = podium ? list.slice(3) : list;
  const first = Math.max(LB_CHUNK, lbMinRows);
  lbPending = { rows: rest.slice(first), m, me, top, overall };
  const rows = rest.slice(0, first).map(x => lbRow(x, m, me, top, overall)).join("");
  const mi = list.find(x => me && lbName(x.p).toLowerCase() === me);
  const who = state.main || state.nick || "";
  const banner = who ? '<div class="lbme"><span class="lbav">' + pavHTML(who) + '</span><span>' +
    esc(mi ? T("lbYou", nf(mi.place)) : T("lbNotIn", who)) + "</span></div>" : "";
  const note = overall ? '<p class="sub lbnote">' + esc(T("lbOverallNote", entry.games || 0)) + "</p>"
    : sort !== "hive" ? '<p class="sub lbnote">' + esc(T("lbSortNote", nf(entry.d.length))) + "</p>" : "";
  const foot = entry.more && sort === "hive" ? '<button type="button" class="mini lbmore">' + esc(T("lbMore")) + "</button>"
    : '<p class="sub lbend">' + esc(T(overall ? "lbOverallEnd" : "lbEnd", nf(list.length))) + "</p>";
  return banner + note + podium + (rows ? '<div class="card lbcard">' + lbHead(m) + rows +
    '<i class="lbsent" aria-hidden="true"></i></div>' : "") + foot +
    '<p class="sub lbh">' + esc(T("lbHint")) + "</p>";
}

async function lbPlayerPlace(game, period, nick){
  const key = game + "|" + period + "|" + nick.toLowerCase(), c = LB_PLACE[key];
  if(c && Date.now() - c.t < 10 * 60 * 1000) return c.v;
  let d = await lbFetch(lbPlayerUrl(game, period, nick));
  if(period[0] === "m") d = d && d[game];
  let v = null;
  if(d && typeof d === "object" && !Array.isArray(d)){
    const place = typeof d.human_index === "number" ? d.human_index : typeof d.index === "number" ? d.index + 1 : 0;
    v = { place, p: d };
  }
  LB_PLACE[key] = { t: Date.now(), v };
  return v;
}
function lbCur(){ return { game: $("#lbGame").value, period: $("#lbPeriod").value, sort: $("#lbSort").value || "hive" }; }
function lbFlash(place){
  $("#lbBody").querySelectorAll(".flash").forEach(r => r.classList.remove("flash"));
  let row = $("#lbBody").querySelector('[data-p="' + place + '"]');
  while(!row && lbAppend(200)) row = $("#lbBody").querySelector('[data-p="' + place + '"]');
  if(!row) return false;
  row.scrollIntoView({ block:"center", behavior: state.lite ? "auto" : "smooth" });
  void row.offsetWidth; row.classList.add("flash");
  return true;
}
function lbFoundCard(name, place, p, game){
  const m = lbMetric("hive", game);
  return '<div class="card lbfound lbcard">' + lbHead(m) + '<button type="button" class="lbr" data-n="' + esc(name) + '">' +
    lbCells({ p, place }, m, false) + "</button>" +
    (place ? "" : '<p class="sub" style="margin:6px 4px 2px">' + esc(T("lbNoPlace")) + "</p>") + "</div>";
}
async function lbFind(q){
  q = String(q || "").trim().replace(/^#/, "");
  if(lbSearch) lbSearch.stop();
  const out = $("#lbFound");
  out.innerHTML = "";
  $("#lbBody").querySelectorAll(".flash").forEach(r => r.classList.remove("flash"));
  if(!q) return;
  const { game, period, sort } = lbCur();
  const seq = lbSeq;
  let entry;
  try{ entry = await loadLb(game, period); }catch(e){ out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; return; }
  if(/^\d+$/.test(q)){
    const n = +q;
    if(n < 1) return;
    out.innerHTML = '<p class="sub">' + esc(T("tqLoading")) + "</p>";
    try{
      while(sort === "hive" && entry.d.length < n && entry.more){ await lbMore(entry, game, period); if(seq !== lbSeq) return; }
    }catch(e){ out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; return; }
    if(seq !== lbSeq) return;
    lbPaint(entry, game, sort);
    out.innerHTML = lbFlash(n) ? "" : '<p class="sub">' + esc(T("lbBeyond", nf(lbView(entry, game, sort).list.length))) + "</p>";
    return;
  }
  const hit = lbView(entry, game, sort).list.find(x => lbName(x.p).toLowerCase() === q.toLowerCase());
  if(hit){ lbFlash(hit.place); return; }
  if(game === "overall"){ out.innerHTML = '<p class="sub">' + esc(T("lbNotFound", q)) + "</p>"; return; }
  out.innerHTML = '<p class="sub">' + esc(T("tqLoading")) + "</p>";
  try{
    const r = await lbPlayerPlace(game, period, q);
    if(seq !== lbSeq) return;
    if(!r){ out.innerHTML = '<p class="sub">' + esc(T("lbNotFound", q)) + "</p>"; return; }
    out.innerHTML = lbFoundCard((r.p.username_cc || r.p.username || q), r.place, r.p, game);
  }catch(e){ if(seq === lbSeq) out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; }
}

const GSTAT_KEY = "hive.tracker.globalstats";
let GSTAT = null, gstatP = null;
async function loadGlobalStats(){
  if(GSTAT) return GSTAT;
  try{
    const c = JSON.parse(localStorage.getItem(GSTAT_KEY) || "null");
    if(c && Date.now() - c.t < 86400000 && c.d) return (GSTAT = c.d);
  }catch(e){}
  if(!gstatP) gstatP = (async () => {
    let d = await lbFetch(API + "/global/statistics");
    if(d && typeof d === "object" && !Array.isArray(d)){
      const inner = Object.values(d).find(v => v && typeof v === "object" && !Array.isArray(v) && typeof v.global === "number");
      if(inner && typeof d.global !== "number") d = inner;
    }
    if(!d || typeof d !== "object") return null;
    try{ localStorage.setItem(GSTAT_KEY, JSON.stringify({ t: Date.now(), d })); }catch(e){}
    return (GSTAT = d);
  })().finally(() => { gstatP = null; });
  return gstatP;
}
function renderGlobalStats(game){
  const box = $("#lbGlobal"); if(!box) return;
  const draw = d => {
    if(!d || typeof d.global !== "number"){ box.innerHTML = ""; return; }
    const codes = GAMES.map(g => g[0]).filter(g => g !== "main").concat("parkour")
      .filter(g => typeof d[g] === "number").sort((a, b) => d[b] - d[a]);
    const open = box.querySelector(".lbgd.open") !== null;
    box.innerHTML = '<div class="lbgd still' + (open ? " open" : "") + '"><button type="button" class="lbgh" aria-expanded="' + open +
      '"><span class="lbgs"><b>' + nf(d.global) +
      "</b><small>" + esc(T("gsAll")) + "</small></span>" +
      (game !== "overall" && typeof d[game] === "number"
        ? '<span class="lbgs"><b>' + nf(d[game]) + "</b><small>" + esc(T("gsGame", NAME(game))) + "</small></span>" : "") +
      '<i aria-hidden="true">›</i></button><div class="lbgb"><div><div class="lbgl">' + codes.map((g, i) =>
        '<div class="lbgi' + (g === game ? " on" : "") + '" style="--i:' + i + '"><span>' + esc(NAME(g)) + "</span><b>" + nf(d[g]) +
        "</b><i style=\"width:" + (d[g] / d.global * 100).toFixed(1) + '%"></i></div>').join("") + "</div></div></div></div>";
    const wrap = box.querySelector(".lbgd"), head = box.querySelector(".lbgh");
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.remove("still")));
    head.onclick = () => {
      const on = wrap.classList.toggle("open");
      head.setAttribute("aria-expanded", on);
    };
  };
  if(GSTAT) draw(GSTAT);
  else loadGlobalStats().then(draw).catch(() => { box.innerHTML = ""; });
}

async function renderLb(){
  const gSel = $("#lbGame"), pSel = $("#lbPeriod"), sSel = $("#lbSort"), body = $("#lbBody");
  if(!gSel) return;
  const rs = $("#vTop").classList.contains("hidden") ? null : lbRestore;
  if(rs) lbRestore = null;
  $("#topHead").textContent = T("tab4");
  $("#topSub").textContent = T("topSub");
  $("#lbFind").placeholder = T("lbFindPh");
  $("#lbFindBtn").textContent = T("lbFindBtn");
  const games = ["overall"].concat(GAMES.map(g => g[0]).filter(g => g !== "main"));
  const want = (rs && rs.g) || lbPick || gSel.value || "overall";
  lbPick = null;
  gSel.innerHTML = games.map(g => '<option value="' + g + '">' + esc(g === "overall" ? T("lbOverall") : NAME(g)) + "</option>").join("");
  gSel.value = games.includes(want) ? want : games[0];
  const game = gSel.value, per = lbPeriods(game), keepP = rs ? rs.p : pSel.value;
  pSel.innerHTML = per.map(([v, t]) => '<option value="' + v + '">' + esc(t) + "</option>").join("");
  pSel.value = per.some(p => p[0] === keepP) ? keepP : "all";
  pSel.disabled = per.length < 2;
  const keepS = rs ? rs.s : sSel.value;
  const fillSort = entry => {
    const opts = lbSortOptions(game, entry);
    sSel.innerHTML = opts.map(([v, t]) => '<option value="' + v + '">' + esc(T("lbSortBy", t)) + "</option>").join("");
    sSel.value = opts.some(o => o[0] === keepS) ? keepS : opts[0][0];
  };
  fillSort(null);
  renderGlobalStats(game);
  if($("#vTop").classList.contains("hidden")) return;
  const period = pSel.value, seq = ++lbSeq;
  if(!rs) $("#lbFound").innerHTML = "";
  const have = LB[game === "overall" ? "overall|all" : game + "|" + period];
  const same = have && lbShown.startsWith(game + "|" + period + "|") && body.querySelector(".lbcard, .lbr");
  if(!same){ lbShown = ""; body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(T(game === "overall" ? "lbOverallLoading" : "tqLoading")) + "</p>"; }
  try{
    const entry = await loadLb(game, period, !!rs);
    if(seq !== lbSeq) return;
    fillSort(entry);
    const sort = sSel.value;
    const key = game + "|" + period + "|" + sort + "|" + entry.t + "|" + entry.d.length;
    if(!(lbShown === key && body.querySelector(".lbcard, .lbr"))){
      lbPaint(entry, game, sort);
      reveal(body);
    }
    const me = lbMe();
    if(me && game !== "overall" && period !== "all" && sort === "hive" && !body.querySelector(".lbr.me, .pod.me")){
      lbPlayerPlace(game, period, state.main || state.nick).then(r => {
        const b = body.querySelector(".lbme > span:last-child");
        if(seq === lbSeq && r && r.place && b) b.textContent = T("lbYou", nf(r.place));
      }).catch(() => {});
    }
  }catch(e){
    if(seq === lbSeq) body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(e.message) + "</p>";
  }
}
function openProfileOf(n){
  navSave();
  if(n.toLowerCase() !== nickKey()) switchNick(niceNick(n));
  go("snap", { y: 0, saved: true, force: true });
  const last = mySnaps().pop();
  if(!last || Date.now() - last.t > 10 * 60 * 1000) snapshot();
}
function openLb(game){
  lbPick = game;
  go("top", { force: true });
}
$("#lbGame").onchange = () => { $("#lbPeriod").value = "all"; $("#lbSort").value = ""; renderLb(); };
$("#lbPeriod").onchange = renderLb;
$("#lbSort").onchange = () => {
  const { game, period, sort } = lbCur(), entry = LB[game + "|" + period];
  if(entry){ lbPaint(entry, game, sort); $("#lbFound").innerHTML = ""; }
  else renderLb();
};
$("#lbFindBtn").onclick = () => lbFind($("#lbFind").value);
$("#lbFind").onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); $("#lbFind").blur(); lbFind($("#lbFind").value); } };
document.addEventListener("click", async e => {
  const r = e.target.closest && !e.target.closest(".sugg") && e.target.closest("#vTop [data-n]");
  if(r){ openProfileOf(r.dataset.n); return; }
  const m = e.target.closest && e.target.closest("#vTop .lbmore");
  if(!m) return;
  const { game, period, sort } = lbCur(), seq = lbSeq, entry = LB[game + "|" + period];
  if(!entry) return;
  m.disabled = true; m.textContent = T("tqLoading");
  try{ await lbMore(entry, game, period); }
  catch(err){ toast(err.message); }
  if(seq === lbSeq) lbPaint(entry, game, sort, true);
});
lbSearch = attachSearch($("#lbFind"), $("#lbSugg"), () => {}, q => /^#?\d+$/.test(q));
