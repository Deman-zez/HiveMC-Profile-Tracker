"use strict";

const API = "https://api.playhive.com/v0";
const HIVE_HEADERS = {
  "X-Hive-Resolve-Stat-Track": "true",
  "X-Hive-API-Version": "2024-03-29"
};
const PROXY = "https://misty-sky-2dcb.zhoski-demon.workers.dev/?url=";
async function hiveFetch(url, opts){
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), 7000);
  let proxyStatus = 0;
  try{
    const r = await fetch(PROXY + encodeURIComponent(url), Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}));
    proxyStatus = r.status;
    if(r.ok){ r.__via = "proxy"; apiStatus(true); return r; }
    // 404 and friends are real answers from Hive; retrying direct would only hit CORS
    if(r.status < 500 && r.status !== 403){ r.__via = "proxy"; if(r.status !== 429) apiStatus(true); return r; }
  }catch(e){}
  finally{ if(timer) clearTimeout(timer); }
  let r;
  try{ r = await fetch(url, opts); }
  catch(e){ throw e; }
  r.__via = "direct";
  if(r.ok) apiStatus(true);
  return r;
}
let apiDownEl = null, apiDismissed = false;
function apiStatus(ok){
  if(ok){
    apiDismissed = false;
    if(apiDownEl && apiDownEl.classList.contains("on")){
      apiDownEl.classList.remove("on");
      setTimeout(() => { if(apiDownEl && !apiDownEl.classList.contains("on")) apiDownEl.hidden = true; }, 260);
    }
    return;
  }
  if(apiDismissed || typeof T !== "function") return;
  if(!apiDownEl){
    apiDownEl = document.createElement("div");
    apiDownEl.className = "apidown";
    apiDownEl.setAttribute("role", "status");
    document.body.append(apiDownEl);
  }
  const off = navigator.onLine === false;
  apiDownEl.innerHTML = '<span class="adi" aria-hidden="true">!</span><div class="adt"><b>' +
    esc(T(off ? "apiOffTitle" : "apiDownTitle")) + "</b><span>" + esc(T(off ? "apiOffText" : "apiDownText")) + "</span></div>" +
    '<button type="button" class="adx" aria-label="' + esc(T("close")) + '">×</button>';
  apiDownEl.querySelector(".adx").onclick = () => { apiDismissed = true; apiDownEl.classList.remove("on"); };
  apiDownEl.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => apiDownEl.classList.add("on")));
}
addEventListener("online", () => { if(apiDownEl && apiDownEl.classList.contains("on")) apiStatus(true); });
const KEY = "hive.tracker.v1";
const DIAG_CD = 5 * 1000;
const REQ_LIMIT = 80;
const REQ_WINDOW = 60 * 60 * 1000;
const SNAP_GAP = 5 * 1000;
const GAMES_BASE = [
  ["main","Профиль","Profile"],["bed","BedWars","BedWars"],["sky","SkyWars","SkyWars"],
  ["murder","Murder Mystery","Murder Mystery"],["hide","Hide and Seek","Hide and Seek"],
  ["dr","DeathRun","DeathRun"],["sg","Survival Games","Survival Games"],
  ["bridge","The Bridge","The Bridge"],["ctf","Capture the Flag","Capture the Flag"],
  ["drop","Block Drop","Block Drop"],["party","Block Party","Block Party"],
  ["ground","Ground Wars","Ground Wars"],["grav","Gravity","Gravity"],
  ["build","Build Battle","Build Battle"],["wars","Treasure Wars","Treasure Wars"]
];
const GAMES = GAMES_BASE.slice();

