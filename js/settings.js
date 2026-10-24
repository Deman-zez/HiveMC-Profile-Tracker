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
  [["#tab1", "tab1"], ["#tab2", "tab2"], ["#tab3", "tab3"], ["#tab4", "tab4"]].forEach(([s, k]) => {
    const b = $(s); b.setAttribute("aria-label", T(k)); b.title = T(k);
  });
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
  $("#wipeBtn").textContent = T("wipeBtn");
  $("#sloganSub").textContent = T("sloganSub");
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
    state.dead = [];
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
  afterPaint(goMainNow);
}
function goMainNow(){
  const other = state.main.toLowerCase() !== nickKey();
  if(other) navSave();
  scrollTo(0, 0);
  if(other){ switchNick(state.main); navPush("snap", 0); }
  snapshot();
}
$("#myBtn").onclick = goMain;
