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
// module fallbacks: keep the site alive if main-profile.js failed to load
if(typeof avatarFor !== "function"){
  window.avatarFor = function(name){
    const k = String(name || "").toLowerCase();
    return (state.avatars && state.avatars[k]) || "";
  };
}
if(typeof pavHTML !== "function"){
  window.pavHTML = function(name){
    const letter = String(name || "?").trim().charAt(0).toUpperCase() || "?";
    const url = avatarFor(name);
    const h = typeof hueOf === "function" ? hueOf(String(name || "").toLowerCase()) : 265;
    return '<span class="pav" style="--h:' + h + '">' +
      (url ? '<img alt="" src="' + esc(url) + '" onerror="this.remove()">' : "<i>" + esc(letter) + "</i>") + "</span>";
  };
}
if(typeof mainRankStyle !== "function"){
  window.mainRankStyle = function(){ return ""; };
}
if(typeof niceNick !== "function"){
  window.niceNick = function(n){ return String(n || "").trim(); };
}
if(typeof profileLink !== "function"){
  window.profileLink = function(n){
    return "https://deman-zez.github.io/HiveMC-Profile-Tracker/?nick=" + encodeURIComponent(n);
  };
}
if(typeof shareProfile !== "function"){
  window.shareProfile = async function(){
    if(!state.nick) return;
    const url = profileLink(state.nick);
    try{ await navigator.clipboard.writeText(url); toast(T("linkCopied")); }
    catch(e){ prompt(T("linkCopy"), url); }
  };
}
if(typeof switchNick !== "function"){
  window.switchNick = function(n){
    state.nick = n;
    state.dead = [];
    save(); renderSnap();
    if(typeof renderTrend === "function") renderTrend();
    if(typeof trendGate === "function") trendGate();
  };
}