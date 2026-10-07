"use strict";

const SYNC_URL = "https://misty-sky-2dcb.zhoski-demon.workers.dev/sync/";
function sha256hex(str){
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,
    0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
    0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,
    0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,
    0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const bytes = Array.from(new TextEncoder().encode(str));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while(bytes.length % 64 !== 56) bytes.push(0);
  for(let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for(let o = 0; o < bytes.length; o += 64){
    for(let i = 0; i < 16; i++)
      w[i] = (bytes[o+i*4] << 24) | (bytes[o+i*4+1] << 16) | (bytes[o+i*4+2] << 8) | bytes[o+i*4+3];
    for(let i = 16; i < 64; i++){
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for(let i = 0; i < 64; i++){
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
async function gzipPack(obj){
  const json = JSON.stringify(obj);
  if(typeof CompressionStream !== "function") throw new Error(T("syncOld"));
  return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
}
async function gzipUnpack(buf){
  return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}
const touchSettings = () => { state.setAt = Date.now(); };
function syncPayload(){
  return { v: 1, snaps: state.snaps, main: state.main || "", games: state.games, finals: state.finals,
    avatars: state.avatars, setAt: state.setAt || 0, actLog: state.actLog || {} };
}
function mergeRemote(r){
  if(!r || typeof r !== "object") return false;
  const before = state.snaps.length, setBefore = state.setAt || 0;
  const seen = new Set(state.snaps.map(x => (x.n || "") + "|" + x.t));
  (Array.isArray(r.snaps) ? r.snaps : []).forEach(x => {
    if(!x || typeof x.t !== "number" || !x.g || typeof x.g !== "object") return;
    const k = (x.n || "") + "|" + x.t;
    if(!seen.has(k)){ seen.add(k); state.snaps.push(x); }
  });
  state.snaps.sort((a, b) => a.t - b.t);
  trimSnaps();
  if((r.setAt || 0) > (state.setAt || 0)){
    const codes = GAMES.map(x => x[0]);
    if(typeof r.main === "string") state.main = r.main.trim().slice(0, 32) || undefined;
    if(Array.isArray(r.games)){ const g = r.games.filter(x => codes.includes(x)); if(g.length) state.games = g; }
    if(typeof r.finals === "boolean") state.finals = r.finals;
    state.setAt = r.setAt;
  }
  if(r.actLog && typeof r.actLog === "object" && !Array.isArray(r.actLog))
    for(const [u, list] of Object.entries(r.actLog)) mergeAct(u, list);
  if(r.avatars && typeof r.avatars === "object" && !Array.isArray(r.avatars))
    for(const [k, v] of Object.entries(r.avatars)) if(!state.avatars[k] && typeof v === "string") state.avatars[k] = v;
  return state.snaps.length !== before || (state.setAt || 0) !== setBefore;
}
var syncBusy = false, syncAgain = false, syncTimer = null;
const syncSoon = () => { if(!state.sync) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 2500); };
async function syncNow(manual){
  if(!state.sync || !state.sync.id) return;
  if(syncBusy){ syncAgain = true; return; }
  syncBusy = true; renderSync();
  try{
    const url = SYNC_URL + state.sync.id;
    const res = await fetch(url, { cache:"no-store" });
    let changed = false;
    if(res.ok) changed = mergeRemote(await gzipUnpack(await res.arrayBuffer()));
    else if(res.status !== 404) throw new Error(await errText(res));
    const up = await fetch(url, { method:"PUT", body: await gzipPack(syncPayload()),
      headers: { "Content-Type": "application/octet-stream" } });
    if(!up.ok) throw new Error(await errText(up));
    state.sync.at = Date.now(); state.sync.err = ""; save();
    if(changed){
      $("#finals").checked = !!state.finals;
      renderChips(); renderSnap(); renderTrend();
    }
    if(manual) toast(T("syncDone"));
  }catch(e){
    const msg = e && e.name === "TypeError" ? T("netErr") : (e && e.message) || String(e);
    if(state.sync){ state.sync.err = msg; save(); }
    if(manual) toast(T("syncFail", msg));
  }finally{
    syncBusy = false; renderSync();
    if(syncAgain){ syncAgain = false; syncSoon(); }
  }
}
async function errText(res){
  try{ const j = await res.json(); if(j && j.error) return j.error; }catch(e){}
  return T("httpErr", res.status);
}
function renderSync(){
  const on = !!(state.sync && state.sync.id);
  const inp = $("#syncCode"), btn = $("#syncBtn");
  if(!inp) return;
  $("#lSync").textContent = T("lSync");
  inp.placeholder = T("syncPh");
  inp.readOnly = on;
  if(on && document.activeElement !== inp) inp.value = state.sync.code;
  btn.classList.toggle("hidden", on);
  btn.textContent = T("syncConnect");
  $("#syncActs").classList.toggle("hidden", !on);
  $("#syncNowBtn").textContent = syncBusy ? T("snapping") : T("syncNowBtn");
  $("#syncNowBtn").disabled = syncBusy;
  $("#syncOffBtn").textContent = T("syncOff");
  $("#syncStatus").textContent = !on ? "" : syncBusy ? T("snapping")
    : state.sync.err ? T("syncErr", state.sync.err)
    : state.sync.at ? T("syncAt", when(state.sync.at)) : T("syncNever");
  $("#syncStatus").classList.toggle("bad", on && !!state.sync.err && !syncBusy);
  $("#syncHint").textContent = T("syncHint");
}
$("#syncBtn").onclick = () => {
  const code = $("#syncCode").value.trim();
  if(code.length < 8){ toast(T("syncShort")); return; }
  state.sync = { code, id: sha256hex("hive-tracker:" + code), at: 0, err: "" };
  save(); renderSync(); syncNow(true);
};
$("#syncCode").onkeydown = e => { if(e.key === "Enter" && !(state.sync && state.sync.id)) $("#syncBtn").click(); };
$("#syncNowBtn").onclick = () => syncNow(true);
$("#syncOffBtn").onclick = () => {
  delete state.sync; save(); $("#syncCode").value = ""; renderSync();
};
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && state.sync && Date.now() - (state.sync.at || 0) > 60000) syncNow(false);
});
