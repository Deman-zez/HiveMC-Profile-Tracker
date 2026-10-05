"use strict";

const LB = {}, LB_PLACE = {};
const LB_SEASONS = [5, 4, 3, 2, 1];
const LB_PAGE = 100;
let lbPick = null, lbSeq = 0, lbSearch = null;

function lbMonthDate(back){
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
}
function lbMonthName(d){
  return d.toLocaleString(L === "ru" ? "ru-RU" : "en-US", { month:"long", year:"numeric", timeZone:"UTC" })
    .replace(/\s*г\.$/, "");
}
function lbPeriods(game){
  const out = [["all", T("tfAll")], ["m0", T("lbMonth", lbMonthName(lbMonthDate(0)))], ["m1", lbMonthName(lbMonthDate(1))]];
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
async function loadLb(game, period){
  const key = game + "|" + period, c = LB[key];
  if(c && Date.now() - c.t < 10 * 60 * 1000) return c;
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
function lbMe(){ return String(state.main || state.nick || "").trim().toLowerCase(); }
function lbCells(name, place, p){
  const played = num(p, "played") || num(p, "games_played"), wins = num(p, "victories");
  const wr = played ? pct(wins, played) : "—";
  return '<span class="lbp">' + (place ? nf(place) : "—") + '</span><span class="lbn">' + esc(name) + "</span>" +
    '<span class="lbv"><b>' + nf(wins) + "</b><small>" + esc(T("lbSub", nf(played), wr)) + "</small></span>" +
    '<span class="lbc lbcw">' + nf(wins) + '</span><span class="lbc">' + nf(played) + '</span><span class="lbc">' + wr + "</span>";
}
function lbRow(p, i, me){
  const name = lbName(p), place = lbPlaceOf(p, i);
  const isMe = !!me && name.toLowerCase() === me;
  return '<button type="button" class="lbr' + (isMe ? " me" : "") + (place <= 3 ? " p" + place : "") +
    '" data-n="' + esc(name) + '" data-p="' + place + '">' + lbCells(name, place, p) + "</button>";
}
const lbHead = () => '<div class="lbhead"><span>#</span><span>' + esc(T("lbColPlayer")) + "</span><span>" +
  esc(T("wins")) + "</span><span>" + esc(T("played")) + "</span><span>" + esc(T("lbColWr")) + "</span></div>";
function lbHTML(entry){
  const list = entry.d;
  if(!list.length) return '<p class="sub" style="margin-top:20px">' + esc(T("lbEmpty")) + "</p>";
  const me = lbMe();
  const rows = list.map((p, i) => lbRow(p, i, me)).join("");
  const mine = list.findIndex(p => me && lbName(p).toLowerCase() === me);
  const who = state.main || state.nick || "";
  const banner = who ? '<div class="lbme">' + esc(mine >= 0 ? T("lbYou", nf(lbPlaceOf(list[mine], mine))) : T("lbNotIn", who)) + "</div>" : "";
  const foot = entry.more ? '<button type="button" class="mini lbmore">' + esc(T("lbMore")) + "</button>"
    : '<p class="sub lbend">' + esc(T("lbEnd", nf(list.length))) + "</p>";
  return banner + '<div class="card lbcard">' + lbHead() + rows + "</div>" + foot +
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
function lbCur(){ return { game: $("#lbGame").value, period: $("#lbPeriod").value }; }
function lbFlash(place){
  $("#lbBody").querySelectorAll(".lbr.flash").forEach(r => r.classList.remove("flash"));
  const row = $("#lbBody").querySelector('.lbr[data-p="' + place + '"]');
  if(!row) return false;
  row.scrollIntoView({ block:"center", behavior: state.lite ? "auto" : "smooth" });
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
  return true;
}
function lbFoundCard(name, place, p){
  return '<div class="card lbfound lbcard">' + lbHead() + '<button type="button" class="lbr" data-n="' + esc(name) + '">' +
    lbCells(name, place, p) + "</button>" +
    (place ? "" : '<p class="sub" style="margin:6px 4px 2px">' + esc(T("lbNoPlace")) + "</p>") + "</div>";
}
async function lbFind(q){
  q = String(q || "").trim().replace(/^#/, "");
  if(lbSearch) lbSearch.stop();
  const out = $("#lbFound");
  out.innerHTML = "";
  $("#lbBody").querySelectorAll(".lbr.flash").forEach(r => r.classList.remove("flash"));
  if(!q) return;
  const { game, period } = lbCur();
  const seq = lbSeq;
  let entry;
  try{ entry = await loadLb(game, period); }catch(e){ out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; return; }
  if(/^\d+$/.test(q)){
    const n = +q;
    if(n < 1){ return; }
    out.innerHTML = '<p class="sub">' + esc(T("tqLoading")) + "</p>";
    try{
      while(entry.d.length < n && entry.more){ await lbMore(entry, game, period); if(seq !== lbSeq) return; }
    }catch(e){ out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; return; }
    if(seq !== lbSeq) return;
    $("#lbBody").innerHTML = lbHTML(entry);
    out.innerHTML = lbFlash(n) ? "" : '<p class="sub">' + esc(T("lbBeyond", nf(entry.d.length))) + "</p>";
    return;
  }
  const i = entry.d.findIndex(p => lbName(p).toLowerCase() === q.toLowerCase());
  if(i >= 0){ lbFlash(lbPlaceOf(entry.d[i], i)); return; }
  out.innerHTML = '<p class="sub">' + esc(T("tqLoading")) + "</p>";
  try{
    const r = await lbPlayerPlace(game, period, q);
    if(seq !== lbSeq) return;
    if(!r){ out.innerHTML = '<p class="sub">' + esc(T("lbNotFound", q)) + "</p>"; return; }
    out.innerHTML = lbFoundCard((r.p.username_cc || r.p.username || q), r.place, r.p);
  }catch(e){ if(seq === lbSeq) out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; }
}
async function renderLb(){
  const gSel = $("#lbGame"), pSel = $("#lbPeriod"), body = $("#lbBody");
  if(!gSel) return;
  $("#topHead").textContent = T("tab4");
  $("#topSub").textContent = T("topSub");
  $("#lbFind").placeholder = T("lbFindPh");
  $("#lbFindBtn").textContent = T("lbFindBtn");
  const games = GAMES.map(g => g[0]).filter(g => g !== "main");
  const want = lbPick || gSel.value || state.games.find(g => g !== "main") || "bed";
  lbPick = null;
  gSel.innerHTML = games.map(g => '<option value="' + g + '">' + esc(NAME(g)) + "</option>").join("");
  gSel.value = games.includes(want) ? want : games[0];
  const game = gSel.value, per = lbPeriods(game), keepP = pSel.value;
  pSel.innerHTML = per.map(([v, t]) => '<option value="' + v + '">' + esc(t) + "</option>").join("");
  pSel.value = per.some(p => p[0] === keepP) ? keepP : "all";
  if($("#vTop").classList.contains("hidden")) return;
  const period = pSel.value, seq = ++lbSeq;
  $("#lbFound").innerHTML = "";
  body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(T("tqLoading")) + "</p>";
  try{
    const entry = await loadLb(game, period);
    if(seq !== lbSeq) return;
    body.innerHTML = lbHTML(entry);
    reveal(body);
    const me = lbMe();
    if(me && period !== "all" && !body.querySelector(".lbr.me")){
      lbPlayerPlace(game, period, state.main || state.nick).then(r => {
        const b = body.querySelector(".lbme");
        if(seq === lbSeq && r && r.place && b) b.textContent = T("lbYou", nf(r.place));
      }).catch(() => {});
    }
  }catch(e){
    if(seq === lbSeq) body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(e.message) + "</p>";
  }
}
function openProfileOf(n){
  const tab = document.querySelector('.tabs button[data-v="snap"]');
  if(n.toLowerCase() !== nickKey()) switchNick(niceNick(n));
  if(tab) tab.click();
  const last = mySnaps().pop();
  if(!last || Date.now() - last.t > 10 * 60 * 1000) snapshot();
}
function openLb(game){
  lbPick = game;
  const tab = document.querySelector('.tabs button[data-v="top"]');
  if(tab) tab.click();
}
$("#lbGame").onchange = () => { $("#lbPeriod").value = "all"; renderLb(); };
$("#lbPeriod").onchange = renderLb;
$("#lbFindBtn").onclick = () => lbFind($("#lbFind").value);
$("#lbFind").onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); $("#lbFind").blur(); lbFind($("#lbFind").value); } };
document.addEventListener("click", async e => {
  const r = e.target.closest && e.target.closest("#vTop .lbr[data-n]");
  if(r){ openProfileOf(r.dataset.n); return; }
  const m = e.target.closest && e.target.closest("#vTop .lbmore");
  if(!m) return;
  const { game, period } = lbCur(), seq = lbSeq, entry = LB[game + "|" + period];
  if(!entry) return;
  m.disabled = true; m.textContent = T("tqLoading");
  try{ await lbMore(entry, game, period); }
  catch(err){ toast(err.message); }
  if(seq === lbSeq) $("#lbBody").innerHTML = lbHTML(entry);
});
lbSearch = attachSearch($("#lbFind"), $("#lbSugg"), n => lbFind(n), q => /^#?\d+$/.test(q));
