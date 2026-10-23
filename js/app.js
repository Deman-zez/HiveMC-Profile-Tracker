"use strict";

applyLang();
(function openFromLink(){
  let n = "";
  try{ n = (new URLSearchParams(location.search).get("nick") || "").trim(); }catch(e){}
  if(!n || !/^[a-zA-Z0-9 ]{1,32}$/.test(n)) return;
  try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){}
  if(n.toLowerCase() !== nickKey()) switchNick(niceNick(n));
  const last = mySnaps().pop();
  if(!last || Date.now() - last.t > 10 * 60 * 1000) snapshot();
})();
navSave();
loadHiveData().then(() => { if(HD){ renderSnap(); } });
setTimeout(() => { loadGlobalStats().then(d => { if(d){ noteRealGames(d); renderSnap(); } }).catch(() => {}); }, 1500);
if(state.sync && state.sync.id) syncNow(false);
loadTitleMeta().catch(() => {});
setInterval(tickStatus, 30000);
if(typeof trackMe === "function") setTimeout(() => trackMe(false), 4000);
trendGate();
requestAnimationFrame(() => document.documentElement.classList.add("ready"));
