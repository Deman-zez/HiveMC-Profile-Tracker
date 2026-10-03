"use strict";

function showRaw(text){
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("rawTitle")) +
    '</h3><button class="close">' + esc(T("close")) + '</button></div><pre class="raw"></pre>' +
    '<button class="mini" id="copyRaw">' + esc(T("copy")) + "</button></div>";
  m.querySelector(".raw").textContent = text;
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  m.querySelector("#copyRaw").onclick = async () => {
    try{ await navigator.clipboard.writeText(text); toast(T("copied")); }
    catch(e){ toast(T("clipFail")); }
  };
  document.body.append(m);
}
let diagBusy = false;
async function diag(){
  if(diagBusy) return;
  if(!state.nick){ toast(T("needNick")); return; }
  const btn = $("#diagBtn");
  if(btn && btn.disabled) return;
  noteRequest();
  const url = urlFor("main");
  diagBusy = true;
  if(btn){ btn.disabled = true; btn.textContent = T("snapping"); }
  let st, txt;
  try{
    const r = await hiveFetch(url, { cache:"no-store", headers: HIVE_HEADERS });
    st = "HTTP " + r.status + " " + (r.statusText || "") + " · " + (r.__via === "proxy" ? T("viaProxy") : T("viaDirect"));
    if(r.ok) noteHit(nickKey());
    txt = await r.text();
  }catch(e){ st = T("noReq"); txt = String(e && e.message || e); }
  finally{
    diagBusy = false;
    state.lastDiag = Date.now(); save(); tickDiag();
  }
  showRaw(url + "\n\n" + st + "\n\n" + String(txt).slice(0, 40000));
}
