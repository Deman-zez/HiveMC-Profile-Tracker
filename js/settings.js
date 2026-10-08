"use strict";

function renderChips(){
  const box = $("#gameChips"); box.innerHTML = "";
  GAMES.forEach(([code]) => {
    const b = document.createElement("button");
    b.className = "chip" + (state.dead.includes(code) ? " dead" : "");
    b.textContent = NAME(code);
    b.setAttribute("aria-pressed", state.games.includes(code));
    b.onclick = () => {
      state.games = state.games.includes(code) ? state.games.filter(g => g !== code) : state.games.concat(code);
      touchSettings(); save(); syncSoon(); renderChips(); renderSnap(); renderTrend();
    };
    box.append(b);
  });
}
function applyLang(){
  L = langCode();
  document.documentElement.lang = L;
  $("#tab1").textContent = T("tab1"); $("#tab2").textContent = T("tab2"); $("#tab3").textContent = T("tab3");
  $("#tab4").textContent = T("tab4");
  renderLb();
  $("#fetchBtn").textContent = T("snap");
  $("#trendHead").textContent = T("tab2"); $("#setHead").textContent = T("tab3");
  $("#trendSub").textContent = T("trendSub"); $("#trendChartHead").textContent = T("chartHead"); $("#setSub").textContent = T("setSub");
  $("#lNick").textContent = T("lNick"); $("#nick").placeholder = T("nickPh");
  $("#lLang").textContent = T("lLang"); $("#lang").options[0].textContent = T("auto");
  $("#lGames").textContent = T("lGames");
  $("#lFinals").textContent = T("finalsLabel");
  $("#finals").checked = !!state.finals;
  $("#lLite").textContent = T("liteLabel");
  $("#lite").checked = !!state.lite;
  tickDiag();
  $("#exportBtn").textContent = T("exportBtn"); $("#importBtn").textContent = T("importBtn");
  $("#wipeBtn").textContent = T("wipeBtn"); $("#diagBtn").textContent = T("diagBtn");
  $("#limitNote").textContent = T("limitNote");
  if(typeof renderSync === "function") renderSync();
  renderChips(); renderSnap(); renderTrend();
}
$("#finals").onchange = e => { state.finals = e.target.checked; touchSettings(); save(); syncSoon(); renderSnap(); };
$("#lite").onchange = e => {
  state.lite = e.target.checked; save();
  document.documentElement.classList.toggle("lite", state.lite);
};
$("#lang").value = state.lang;
$("#lang").onchange = e => { state.lang = e.target.value; save(); applyLang(); };
$("#nick").value = state.main || state.nick;
let nickTimer = null;
function setMainNick(v){
  v = String(v || "").trim().slice(0, 32);
  const wasMain = String(state.main || "").toLowerCase();
  const viewingOwn = !state.nick || nickKey() === wasMain;
  if(v) state.main = v; else delete state.main;
  if(viewingOwn && v.toLowerCase() !== nickKey()){
    state.nick = v;
    state.dead = []; state.lastDiag = 0;
    tickDiag();
  }
  touchSettings(); syncSoon();
}
$("#nick").oninput = e => {
  setMainNick(e.target.value);
  save();
  clearTimeout(nickTimer);
  nickTimer = setTimeout(() => { renderSnap(); renderTrend(); }, 250);
  askSearch(e.target.value);
};
$("#nick").onblur = () => setTimeout(hideSugg, 180);
$("#nick").onfocus = e => { if(e.target.value.trim().length >= 4) askSearch(e.target.value); };
$("#exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type:"application/json" }));
  a.download = "hive-" + (state.nick || "stats") + ".json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const p = JSON.parse(r.result);
      if(!Array.isArray(p.snaps)) throw new Error("no snapshots");
      const codes = GAMES.map(x => x[0]);
      const clean = {
        nick: typeof p.nick === "string" ? p.nick.trim().slice(0, 32) : state.nick,
        lang: ["auto","ru","en"].includes(p.lang) ? p.lang : state.lang,
        finals: typeof p.finals === "boolean" ? p.finals : state.finals,
        lite: typeof p.lite === "boolean" ? p.lite : !!state.lite,
        main: typeof p.main === "string" && p.main.trim() ? p.main.trim().slice(0, 32) : state.main,
        games: Array.isArray(p.games) ? p.games.filter(g => codes.includes(g)) : state.games,
        snaps: p.snaps.filter(x => x && typeof x.t === "number" && x.g && typeof x.g === "object")
                      .slice(-300),
        avatars: p.avatars && typeof p.avatars === "object" && !Array.isArray(p.avatars)
          ? p.avatars : {},
        last: p.last && typeof p.last === "object" && !Array.isArray(p.last) ? p.last : {},
        dead: Array.isArray(p.dead) ? p.dead.filter(g => codes.includes(g)) : [],
        tagged: 1
      };
      if(!clean.games.length) clean.games = DEFAULT_GAMES.slice();
      state = Object.assign(state, clean);
      state.reqLog = []; state.lastSnapAt = 0;
      save();
      $("#nick").value = state.main || state.nick; $("#lang").value = state.lang || "auto";
      applyLang(); toast(T("imported"));
    }catch(err){ toast(T("unreadable", err.message)); }
  };
  r.readAsText(f); e.target.value = "";
};
$("#wipeBtn").onclick = () => {
  if(!confirm(T("wipeAsk"))) return;
  const n = nickKey();
  state.snaps = state.snaps.filter(x => (x.n || "") !== n);
  Object.keys(state.last).forEach(k => { if(k.startsWith(n + "|")) delete state.last[k]; });
  save(); renderSnap(); renderTrend();
};
$("#fetchBtn").onclick = snapshot;
function goMain(){
  if(!state.main) return;
  const other = state.main.toLowerCase() !== nickKey();
  if(other) navSave();
  wheelTo = null; scrollTo(0, 0);
  if(other){ switchNick(state.main); navPush("snap", 0); }
  snapshot();
}
$("#myBtn").onclick = goMain;

$("#diagBtn").onclick = diag;
function tickDiag(){
  const b = $("#diagBtn");
  if(!b || diagBusy) return;
  const left = DIAG_CD - (Date.now() - state.lastDiag);
  b.textContent = T("diagBtn");
  if(left > 0){ b.disabled = true; setTimeout(tickDiag, Math.min(left, 5000)); }
  else b.disabled = false;
}
