"use strict";

const SEARCH_SVG = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const NICK_OK = /^[a-zA-Z0-9 ]+$/;

function recentNicks(limit){
  const seen = new Map();
  for(let i = state.snaps.length - 1; i >= 0; i--){
    const s = state.snaps[i], n = s.n || "";
    if(n && !seen.has(n)) seen.set(n, s.t);
  }
  const me = nickKey();
  return [...seen].filter(([n]) => n !== me).slice(0, limit || 5).map(([n, t]) => ({ name: niceNick(n), t }));
}

function recentRow(x){
  const k = x.name.toLowerCase(), isMain = !!state.main && state.main.toLowerCase() === k;
  const url = state.avatars[k], letter = x.name.trim().charAt(0).toUpperCase() || "?";
  return '<button type="button" data-n="' + esc(x.name) + '">' +
    '<span class="av" style="--h:' + hueOf(k) + '"><span>' +
      (url ? '<img alt="" loading="lazy" src="' + esc(url) + '">' : "<i>" + esc(letter) + "</i>") +
    "</span></span>" +
    '<span class="nm">' + esc(x.name) + "</span>" +
    '<small class="rt">' + esc(isMain ? T("qsMine") : when(x.t)) + "</small></button>";
}

function openPlayer(name){
  const n = niceNick(String(name || "").trim().slice(0, 32));
  if(!n || !NICK_OK.test(n)){ toast(T("needNick")); return; }
  openProfileOf(n);
}

function openSearch(){
  if(document.querySelector(".modal.msearch")) return;
  const m = document.createElement("div");
  m.className = "modal msearch";
  m.innerHTML = '<div class="inner"><div class="qsbar">' +
    '<span class="qsico">' + SEARCH_SVG + "</span>" +
    '<input id="qsNick" type="text" autocapitalize="none" autocomplete="off" spellcheck="false" enterkeyhint="go" ' +
      'placeholder="' + esc(T("qsPh")) + '">' +
    '<button type="button" class="qsx" aria-label="' + esc(T("close")) + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>' +
    '<div class="sugg qslist" id="qsList"></div></div>';
  m.onclick = e => { if(e.target === m || e.target.closest(".qsx")) closeModal(m); };
  mountModal(m);

  const inp = m.querySelector("#qsNick"), box = m.querySelector("#qsList");
  let tmr = null, seq = 0;
  const pick = n => { closeModal(m, "nav"); openPlayer(n); };
  const show = html => {
    box.innerHTML = html;
    box.querySelectorAll("button,.note2,.qshead").forEach((el, i) => el.style.setProperty("--i", i));
    box.querySelectorAll("button[data-n]").forEach(b => b.onclick = () => pick(b.dataset.n));
  };
  const showRecent = () => {
    const list = recentNicks(5);
    show(list.length ? '<div class="qshead">' + esc(T("qsRecent")) + "</div>" + list.map(recentRow).join("")
                     : '<div class="note2">' + esc(T("qsEmpty")) + "</div>");
  };
  inp.oninput = () => {
    clearTimeout(tmr);
    const q = inp.value.trim();
    if(!q){ seq++; showRecent(); return; }
    if(!NICK_OK.test(q)){ seq++; show('<div class="note2">' + esc(T("qsBad")) + "</div>"); return; }
    if(q.length < 4){ seq++; show('<div class="note2">' + esc(T("qsEnter")) + "</div>"); return; }
    const my = ++seq;
    tmr = setTimeout(async () => {
      try{
        const list = await searchPlayers(q);
        if(my !== seq) return;
        show(list.length ? list.map(x => suggRow(x, q)).join("")
                         : '<div class="note2">' + esc(T("qsNone")) + "</div>");
      }catch(e){ if(my === seq) show('<div class="note2">' + esc(e.message) + "</div>"); }
    }, 350);
  };
  inp.onkeydown = e => {
    if(e.key === "Enter"){ const v = inp.value.trim(); if(v) pick(v); }
    if(e.key === "Escape") closeModal(m);
  };
  showRecent();
  setTimeout(() => inp.focus(), 60);
}

addEventListener("keydown", e => {
  if(e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if(document.querySelector(".modal")) return;
  e.preventDefault();
  openSearch();
});

function onboardHTML(){
  return '<div class="card onb"><h2 class="onbh">' + esc(T("onbTitle")) + "</h2>" +
    '<p class="sub">' + esc(T("onbSub")) + "</p>" +
    '<div class="nickbox"><input id="onbNick" type="text" autocapitalize="none" autocomplete="off" spellcheck="false" ' +
      'enterkeyhint="go" placeholder="' + esc(T("nickPh")) + '"><div class="sugg hidden" id="onbSugg"></div></div>' +
    '<button type="button" class="primary" id="onbGo">' + esc(T("onbGo")) + "</button></div>";
}
function onboardBind(){
  const inp = $("#onbNick"); if(!inp) return;
  const go = n => {
    const v = niceNick(String(n || "").trim().slice(0, 32));
    if(!v || !NICK_OK.test(v)){ toast(T("needNick")); return; }
    state.main = v;
    touchSettings();
    switchNick(v);
    $("#nick").value = v;
    syncSoon();
    snapshot();
  };
  attachSearch(inp, $("#onbSugg"), go);
  inp.onkeydown = e => { if(e.key === "Enter") go(inp.value); };
  $("#onbGo").onclick = () => go(inp.value);
}
