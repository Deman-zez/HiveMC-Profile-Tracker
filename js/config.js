"use strict";

const API = "https://api.playhive.com/v0";
const HIVE_HEADERS = {
  "X-Hive-Resolve-Dynamic-Hub-Titles": "true",
  "X-Hive-API-Version": "2024-03-29"
};
const PROXY = "https://misty-sky-2dcb.zhoski-demon.workers.dev/?url=";
/* Requests go through the proxy, which caches and throttles them so Hive's rate limit is spared.
   A direct request to Hive is only a fallback, and only when the proxy could not be reached at all:
   - proxy answered (200, 404, 429, 5xx ...): use that answer, never ask Hive again;
   - proxy refused the request (403): ask Hive directly;
   - network error (proxy blocked/offline): ask Hive directly;
   - timeout: the proxy may still be talking to Hive, so a second direct request would count twice -> give up. */
const PROXY_TIMEOUT = 15000;   // longer than the proxy's own 12 s wait for Hive, so its 503/504 reaches us first
async function hiveFetch(url, opts){
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), PROXY_TIMEOUT);
  try{
    const r = await fetch(PROXY + encodeURIComponent(url), Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}));
    if(r.ok){ r.__via = "proxy"; apiStatus(true); return r; }
    if(r.status !== 403){ r.__via = "proxy"; return r; }
  }catch(e){
    if(e && e.name === "AbortError") throw e;
  }
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

/* shrink any overflowing label (long month names) inside control blocks */
(function labelShrinker(){
  function fitEl(el){
    el.style.minWidth = "0";
    el.style.maxWidth = "100%";
    el.style.overflow = "hidden";
    el.style.textOverflow = "ellipsis";
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "";
    el.title = el.textContent || "";
    let size = parseFloat(getComputedStyle(el).fontSize) || 16, guard = 0;
    while(el.scrollWidth > el.clientWidth + 1 && size > 10 && guard++ < 16){
      size -= 1; el.style.fontSize = size + "px";
    }
  }
  function scan(root){
    if(!root) return;
    const nodes = root.querySelectorAll("*");
    for(let i = 0; i < nodes.length; i++){
      const el = nodes[i];
      if(!el.clientWidth) continue;
      if(el.scrollWidth <= el.clientWidth + 1) continue;
      if(el.childElementCount > 0) continue;
      fitEl(el);
    }
  }
  function run(){
    try{
      scan(document.querySelector(".lbctl"));
      scan(document.querySelector(".trendctl"));
    }catch(e){}
  }
  let queued = 0;
  function soon(){ if(!queued) queued = requestAnimationFrame(() => { queued = 0; run(); }); }
  addEventListener("resize", soon);
  document.addEventListener("change", e => { if(e.target && e.target.closest && e.target.closest(".lbctl,.trendctl")) soon(); });
  if(typeof MutationObserver === "function"){
    const mo = new MutationObserver(soon);
    [".lbctl", ".trendctl"].forEach(sel => {
      const el = document.querySelector(sel);
      if(el) mo.observe(el, { childList:true, subtree:true, characterData:true });
    });
  }
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  run(); soon();
  setTimeout(soon, 300);
  setTimeout(soon, 1200);
  setTimeout(soon, 3000);
})();