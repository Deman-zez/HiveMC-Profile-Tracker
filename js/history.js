"use strict";

/* Monthly history straight from Hive: /game/monthly/player/all/{nick}/{year}/{month} returns that
   player's stats for every game in one calendar month. It fills what snapshots can't - months when the
   site wasn't opened - and works from the very first visit.
   Requests are spent carefully: a finished month never changes, so it is fetched once and kept for good;
   only the current month is refreshed (shared with the "this month" numbers elsewhere). Hive allows only
   3 requests per hour for the same player and game, so loading stops at the first "too many requests"
   and the remaining months are picked up later by themselves. */
const HIST_KEY = "hive.tracker.monthhist.v1";
const HIST_MONTHS = 12;
let HIST = {};
try{ HIST = JSON.parse(localStorage.getItem(HIST_KEY) || "{}") || {}; }catch(e){ HIST = {}; }
let histBusy = false, histListeners = [], histTimer = 0;
let histWaitUntil = +(localStorage.getItem(HIST_KEY + ".wait") || 0);

const histKeyOf = (y, m) => y + "-" + String(m).padStart(2, "0");
function histSave(){
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(HIST)); }
  catch(e){                                   // keep the newest players if storage is tight
    const ks = Object.keys(HIST); if(ks.length > 1){ delete HIST[ks[0]]; histSave(); }
  }
}
function histMonthList(n){
  const d = new Date(), out = [];
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  for(let i = 0; i < n; i++){
    out.push({ y, m, key: histKeyOf(y, m), current: i === 0 });
    if(--m < 1){ m = 12; y--; }
  }
  return out;
}
function histFirstPlayed(){
  const s = mySnaps().filter(x => x.g && x.g.main).pop();
  const v = s && s.g.main && (s.g.main.first_played || s.g.main.first_login);
  if(typeof v !== "number") return 0;
  return v > 1e12 ? v : v * 1000;
}
function histData(nick){ return HIST[String(nick || "").toLowerCase()] || {}; }
function histMonth(nick, y, m){ const e = histData(nick)[histKeyOf(y, m)]; return e ? e.d : null; }
function histState(nick){
  const have = histData(nick), list = histMonthList(HIST_MONTHS);
  const first = histFirstPlayed();
  const want = list.filter(x => !first || Date.UTC(x.y, x.m, 1) > first);
  return { want: want.length, got: want.filter(x => have[x.key]).length, waiting: Date.now() < histWaitUntil };
}
function onHist(fn){ histListeners.push(fn); }
const histNotify = () => histListeners.forEach(fn => { try{ fn(); }catch(e){} });

async function histFetch(nick, y, m){
  const url = API + "/game/monthly/player/all/" + encodeURIComponent(nick) + "/" + y + "/" + m;
  noteRequest();
  const res = await hiveFetch(url, { cache: "no-store", headers: HIVE_HEADERS });
  if(res.status === 429){
    const ra = +res.headers.get("Retry-After");
    const err = new Error("limited"); err.wait = (ra > 0 ? ra : 20 * 60) * 1000; throw err;
  }
  if(res.status === 404 || res.status >= 500) return {};        // Hive: no record for that month
  if(!res.ok) throw new Error(httpMsg(res.status));
  const d = await res.json().catch(() => ({}));
  if(!d || typeof d !== "object" || Array.isArray(d)) return {};
  // Hive sometimes answers with just {"message": "..."} - a rate limit or "no data", never real stats
  if(typeof d.message === "string" && !Object.values(d).some(v => v && typeof v === "object")){
    if(/too many/i.test(d.message)){ const err = new Error("limited"); err.wait = 20 * 60 * 1000; throw err; }
    return {};
  }
  return d;
}
// newest first: the months people look at load first
async function histLoad(onlyKey){
  const nick = state.nick, k = nickKey();
  if(!nick || histBusy || Date.now() < histWaitUntil) return;
  histBusy = true;
  try{
    const have = HIST[k] || (HIST[k] = {});
    const first = histFirstPlayed();
    for(const x of histMonthList(HIST_MONTHS)){
      if(onlyKey && x.key !== onlyKey) continue;
      if(first && Date.UTC(x.y, x.m, 1) <= first) break;      // nothing before the first game
      const e = have[x.key];
      // a month with stats never changes; an empty answer ("Server Error" is how Hive says "no record")
      // is re-checked after a few days in case it was a real hiccup
      const emptyOld = e && e.empty && Date.now() - e.t > 3 * 86400000;
      if(e && !emptyOld && (!x.current || Date.now() - e.t < 15 * 60 * 1000)) continue;
      if(x.current && MONTHLY[k] && Date.now() - MONTHLY[k].t < 15 * 60 * 1000){
        have[x.key] = { t: MONTHLY[k].t, d: MONTHLY[k].d }; continue;
      }
      try{
        const d = await histFetch(nick, x.y, x.m);
        if(nickKey() !== k) return;
        have[x.key] = Object.keys(d).length ? { t: Date.now(), d } : { t: Date.now(), d, empty: true };
        if(x.current) MONTHLY[k] = { t: Date.now(), d };
        histSave(); histNotify();
      }catch(e){
        if(e.wait){
          histWaitUntil = Date.now() + e.wait;
          try{ localStorage.setItem(HIST_KEY + ".wait", String(histWaitUntil)); }catch(_){}
          histResumeLater();
          histNotify();
        }
        break;
      }
      await new Promise(r => setTimeout(r, 450));
    }
  }finally{ histBusy = false; histNotify(); }
}
// totals of one month over every game Hive returned
function histTotals(d){
  let played = 0, wins = 0;
  if(d) for(const g of Object.keys(d)){
    const c = d[g]; if(!c || typeof c !== "object" || Array.isArray(c)) continue;
    played += num(c, "played") || num(c, "games_played"); wins += num(c, "victories");
  }
  return { played, wins };
}

// keep loading the remaining months on its own once Hive's window has passed (while the site is open)
function histResumeLater(){
  clearTimeout(histTimer);
  const wait = histWaitUntil - Date.now();
  if(wait <= 0) return;
  histTimer = setTimeout(() => { if(state.nick) histLoad(); }, wait + 2000);
}
histResumeLater();
