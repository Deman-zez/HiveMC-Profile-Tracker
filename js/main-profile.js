"use strict";

function pavHTML(name){
  const url = state.avatars[String(name).toLowerCase()];
  const letter = String(name).trim().charAt(0).toUpperCase() || "?";
  return '<span class="pav" style="--h:' + hueOf(String(name).toLowerCase()) + '">' +
    (url ? '<img alt="" src="' + esc(url) + '" onerror="this.replaceWith(Object.assign(' +
      'document.createElement(\'i\'),{textContent:' + JSON.stringify(letter).replace(/"/g, "&quot;") + '}))">'
         : "<i>" + esc(letter) + "</i>") + "</span>";
}
function mainRankStyle(){
  const k = String(state.main || "").toLowerCase();
  for(let i = state.snaps.length - 1; i >= 0; i--){
    const m = state.snaps[i].g && state.snaps[i].g.main;
    if(m && String(m.username || m.username_cc || "").toLowerCase() === k){
      const tag = rankTag(pick(m, "rank", "player_rank"));
      return tag ? ' style="color:' + tag.c2 + ';opacity:1"' : "";
    }
  }
  return "";
}
function niceNick(n){
  const k = String(n || "").trim().toLowerCase();
  if(!k) return n;
  for(let i = state.snaps.length - 1; i >= 0; i--){
    const m = state.snaps[i].g && state.snaps[i].g.main;
    if(m && String(m.username || m.username_cc || "").toLowerCase() === k && m.username_cc) return m.username_cc;
  }
  return nickKey() === k && state.nick ? state.nick : String(n).trim();
}
const SITE = "https://deman-zez.github.io/HiveMC-Profile-Tracker/";
const SHARE_SVG = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" ' +
  'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function profileLink(n){
  const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE;
  return base + "?nick=" + encodeURIComponent(n);
}
async function shareProfile(){
  if(!state.nick) return;
  const url = profileLink(state.nick);
  if(navigator.share){
    try{ await navigator.share({ title: state.nick + " · Hive", url }); return; }
    catch(e){ if(e && e.name === "AbortError") return; }
  }
  try{ await navigator.clipboard.writeText(url); toast(T("linkCopied")); }
  catch(e){ prompt(T("linkCopy"), url); }
}
function switchNick(n){
  state.nick = n;
  state.dead = []; state.lastDiag = 0;
  save(); tickDiag(); renderSnap(); renderTrend();
}
