"use strict";

const PLUS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>';
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
  state.nick = n; $("#nick").value = n;
  state.dead = []; state.lastDiag = 0;
  save(); tickDiag(); renderSnap(); renderTrend();
}
function openMainPicker(from){
  const cur = state.main || "";
  const viewing = cur && cur.toLowerCase() === nickKey();
  const m = document.createElement("div");
  m.className = "modal mpick";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("mainTitle")) +
    '</h3><button class="close">' + esc(T("close")) + "</button></div>" +
    '<p class="sub mhint">' + esc(T("mainHint")) + "</p>" +
    '<div class="nickbox"><input id="mainNick" type="text" autocapitalize="none" autocomplete="off" ' +
      'spellcheck="false" placeholder="' + esc(T("nickPh")) + '" value="' + esc(cur) + '">' +
      '<div class="sugg hidden" id="mainSugg"></div></div>' +
    '<button class="primary" id="mainSave">' + esc(T("mainSave")) + "</button>" +
    (cur ? '<div class="chips btns mextra">' +
      (viewing ? "" : '<button class="mini" id="mainOpen">' + esc(T("mainOpen")) + "</button>") +
      '<button class="mini" id="mainClear">' + esc(T("mainClear")) + "</button></div>" : "") +
    "</div>";
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);

  const inp = m.querySelector("#mainNick"), box = m.querySelector("#mainSugg");
  let tmr = null, seq = 0;
  const hide = () => box.classList.add("hidden");
  const show = html => {
    box.innerHTML = html; box.classList.remove("hidden");
    box.querySelectorAll("button,.note2").forEach((el, i) => el.style.setProperty("--i", i));
    box.querySelectorAll("button[data-n]").forEach(b => b.onclick = () => { inp.value = b.dataset.n; hide(); });
  };
  inp.oninput = () => {
    clearTimeout(tmr);
    const q = inp.value.trim();
    if(!/^[a-zA-Z0-9 ]*$/.test(q) || !q){ hide(); return; }
    if(q.length < 4){ show('<div class="note2">' + esc(T("minChars")) + "</div>"); return; }
    const my = ++seq;
    tmr = setTimeout(async () => {
      try{
        const list = await searchPlayers(q);
        if(my !== seq) return;
        show(list.length ? list.map(x => suggRow(x, q)).join("")
                         : '<div class="note2">' + esc(T("noPlayers")) + "</div>");
      }catch(e){ if(my === seq) show('<div class="note2">' + esc(e.message) + "</div>"); }
    }, 450);
  };
  inp.onblur = () => setTimeout(hide, 180);
  inp.onkeydown = e => { if(e.key === "Enter") m.querySelector("#mainSave").click(); };

  m.querySelector("#mainSave").onclick = () => {
    const v = inp.value.trim();
    if(!v){ toast(T("needNick")); return; }
    state.main = niceNick(v.slice(0, 32));
    if(!state.nick){ state.nick = state.main; $("#nick").value = state.main; state.dead = []; }
    touchSettings(); save(); syncSoon(); closeModal(m); toast(T("mainSaved")); renderSnap(); renderTrend();
  };
  const op = m.querySelector("#mainOpen");
  if(op) op.onclick = () => { closeModal(m); switchNick(state.main); };
  const cl = m.querySelector("#mainClear");
  if(cl) cl.onclick = () => { delete state.main; touchSettings(); save(); syncSoon(); closeModal(m); renderSnap(); };
}
