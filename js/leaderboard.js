"use strict";

const LB = {};
const LB_SEASONS = [5, 4, 3, 2, 1];
let lbPick = null, lbSeq = 0;

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
async function loadLb(game, period){
  const key = game + "|" + period, c = LB[key];
  if(c && Date.now() - c.t < 10 * 60 * 1000) return c.d;
  noteRequest();
  let res;
  try{ res = await hiveFetch(lbUrl(game, period), { cache:"no-store", headers: HIVE_HEADERS }); }
  catch(e){ if(c) return c.d; throw new Error(T("netErr")); }
  if(res.status === 429){ if(c) return c.d; throw new Error(T("lbLimit")); }
  if(res.status === 404){ LB[key] = { t: Date.now(), d: [] }; return []; }
  if(!res.ok){ if(c) return c.d; throw new Error(httpMsg(res.status)); }
  let d = await res.json();
  if(!Array.isArray(d)) d = (d && typeof d === "object" && Object.values(d).find(Array.isArray)) || [];
  LB[key] = { t: Date.now(), d };
  return d;
}
function lbMe(){ return String(state.main || state.nick || "").trim().toLowerCase(); }
function lbHTML(list){
  if(!list.length) return '<p class="sub" style="margin-top:20px">' + esc(T("lbEmpty")) + "</p>";
  const me = lbMe();
  let mine = 0;
  const rows = list.map((p, i) => {
    const name = String(p.username_cc || p.username || "?");
    const place = typeof p.human_index === "number" ? p.human_index
      : typeof p.index === "number" ? p.index + 1 : i + 1;
    const played = num(p, "played") || num(p, "games_played"), wins = num(p, "victories");
    const isMe = !!me && name.toLowerCase() === me;
    if(isMe) mine = place;
    return '<button type="button" class="lbr' + (isMe ? " me" : "") + (place <= 3 ? " p" + place : "") +
      '" data-n="' + esc(name) + '"><span class="lbp">' + nf(place) + '</span><span class="lbn">' + esc(name) +
      '</span><span class="lbv"><b>' + nf(wins) + "</b><small>" +
      esc(T("lbSub", nf(played), played ? pct(wins, played) : "—")) + "</small></span></button>";
  }).join("");
  const who = state.main || state.nick || "";
  const banner = who ? '<div class="lbme">' + esc(mine ? T("lbYou", nf(mine)) : T("lbNotIn", who)) + "</div>" : "";
  return banner + '<div class="card lbcard">' + rows + '</div><p class="sub lbh">' + esc(T("lbHint")) + "</p>";
}
async function renderLb(){
  const gSel = $("#lbGame"), pSel = $("#lbPeriod"), body = $("#lbBody");
  if(!gSel) return;
  $("#topHead").textContent = T("tab4");
  $("#topSub").textContent = T("topSub");
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
  body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(T("tqLoading")) + "</p>";
  try{
    const list = await loadLb(game, period);
    if(seq !== lbSeq) return;
    body.innerHTML = lbHTML(list);
    reveal(body);
    if(period === "m0" && !body.querySelector(".lbr.me") && lbMe() === nickKey()){
      loadMonthly().then(d => {
        const c = d && d[game];
        const place = c && (typeof c.human_index === "number" ? c.human_index
          : typeof c.index === "number" ? c.index + 1 : 0);
        const b = body.querySelector(".lbme");
        if(seq === lbSeq && place && b) b.textContent = T("lbYou", nf(place));
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
$("#lbBody").addEventListener("click", e => {
  const r = e.target.closest && e.target.closest(".lbr[data-n]");
  if(r) openProfileOf(r.dataset.n);
});
