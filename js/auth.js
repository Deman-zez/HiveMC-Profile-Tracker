"use strict";

// Xbox sign-in by device code: the worker talks to Microsoft and Xbox Live and returns a signed pass
const AUTH_KEY = "hive.tracker.auth.v1";
const workerBase = () => PROXY.replace(/\/\?url=$/, "");
let AUTH = null;
try{ AUTH = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }catch(e){ AUTH = null; }
const authOn = () => !!(AUTH && AUTH.token);
const authHeaders = () => authOn() ? { Authorization: "Bearer " + AUTH.token } : {};
function authSave(){
  try{ if(AUTH) localStorage.setItem(AUTH_KEY, JSON.stringify(AUTH)); else localStorage.removeItem(AUTH_KEY); }catch(e){}
}
async function authPost(path, body){
  const r = await fetch(workerBase() + "/auth/" + path, { method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(j.error || T("httpErr", r.status));
  return j;
}
const XB_PATH = "M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z";
const xbLogo = () => '<svg class="xbLogo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="' + XB_PATH + '"/></svg>';

function xboxLogin(from){
  const m = document.createElement("div");
  m.className = "modal xbm";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("xbTitle")) + '</h3><button class="close">' + esc(T("close")) + "</button></div>" +
    '<div class="xbBody"><p class="sub">' + esc(T("tqLoading")) + "</p></div></div>";
  let alive = true;
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")){ alive = false; closeModal(m); } };
  mountModal(m, from);
  const body = m.querySelector(".xbBody");
  const fail = msg => {
    if(!alive) return;
    body.innerHTML = '<p class="xbErr">' + esc(msg) + '</p><button class="primary" type="button" id="xbAgain">' + esc(T("xbAgain")) + "</button>";
    body.querySelector("#xbAgain").onclick = () => { alive = false; closeModal(m); setTimeout(() => xboxLogin(), 250); };
  };
  (async () => {
    let s;
    try{ s = await authPost("start"); }catch(e){ fail(T("xbFail", e.message)); return; }
    if(!alive) return;
    const link = s.url + (s.url.includes("?") ? "&" : "?") + "otc=" + encodeURIComponent(s.code);
    body.innerHTML =
      '<ol class="xbSteps"><li><span>' + esc(T("xbStep1")) + '</span><a class="primary xbOpen" href="' + esc(link) + '" target="_blank" rel="noopener">' +
        xbLogo() + "<span>" + esc(T("xbOpen")) + "</span></a>" +
        '<small class="xbFallback">' + esc(T("xbFallback")) + ' <button type="button" class="xbCode" title="' + esc(T("copy")) + '">' + esc(s.code) + "</button></small></li>" +
      "<li><span>" + esc(T("xbStep2")) + "</span></li>" +
      "<li><span>" + esc(T("xbStep3")) + "</span></li></ol>" +
      '<div class="xbWait"><i class="xbDot"></i><span>' + esc(T("xbWait")) + "</span></div>" +
      '<p class="xbNote">' + esc(T("xbNote")) + "</p>";
    body.querySelector(".xbCode").onclick = async () => {
      try{ await navigator.clipboard.writeText(s.code); toast(T("copied")); }catch(e){ toast(T("clipFail")); }
    };
    const until = Date.now() + s.expires * 1000;
    let busy = false, wake = null;
    const nap = ms => new Promise(r => { wake = r; setTimeout(r, ms); });
    const back = () => { if(document.visibilityState === "visible" && wake) wake(); };
    document.addEventListener("visibilitychange", back);
    try{
      while(alive && Date.now() < until){
        await nap(s.interval * 1000);
        if(!alive || busy) continue;
        busy = true;
        let p = null;
        try{ p = await authPost("poll", { device: s.device }); }catch(e){}
        busy = false;
        if(!p || p.pending) continue;
        if(p.token){
          AUTH = { token: p.token, gamertag: p.gamertag, uuid: p.uuid, at: Date.now() };
          authSave();
          alive = false; closeModal(m);
          onSignedIn();
          toast(T("xbDone", p.gamertag));
          return;
        }
        fail(p.fail === "expired" ? T("xbExpired") : p.fail === "declined" ? T("xbDeclined")
          : p.fail === "noHive" ? T("xbNoHive", p.gamertag || "") : p.fail === "noXbox" ? T("xbNoXbox")
        : p.fail === "hiveBusy" ? T("xbHiveBusy") : p.fail === "hiveDown" ? T("xbHiveDown")
          : p.fail === "child" ? T("xbChild") : T("xbFail", p.detail || p.fail));
        return;
      }
    }finally{ document.removeEventListener("visibilitychange", back); }
    if(alive) fail(T("xbExpired"));
  })();
}

function onSignedIn(){
  state.onbSkip = 1;
  if(!state.nick) state.nick = AUTH.gamertag;
  setMainNick(AUTH.gamertag);
  const inp = $("#nick"); if(inp) inp.value = AUTH.gamertag;
  if(!state.sync || !state.sync.id) state.sync = { xbox: true, id: "xbox", at: 0, err: "" };
  save();
  renderSync(); renderSnap(); renderTrend(); trendGate();
  if(state.sync.xbox) syncNow(true);
  if(typeof trackMe === "function") trackMe(true);
}
function xboxLogout(){
  if(!confirm(T("xbOutAsk"))) return;
  fetch(workerBase() + "/activity/untrack", { method: "POST", keepalive: true,
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()), body: "{}" }).catch(() => {});
  try{ localStorage.removeItem("hive.tracker.trackat"); }catch(e){}
  if(state.sync && state.sync.xbox){ delete state.sync; save(); }
  AUTH = null; authSave();
  const ci = $("#syncCode"); if(ci) ci.value = "";
  renderSync(); trendGate();
}
