"use strict";

function urlFor(game){
  const path = game === "main" ? "/game/all/main/" + encodeURIComponent(state.nick)
             : game === "all"  ? "/game/all/all/" + encodeURIComponent(state.nick)
                               : "/game/all/" + game + "/" + encodeURIComponent(state.nick);
  return API + path;
}
async function pullAll(){
  noteRequest();
  let res;
  try{ res = await hiveFetch(urlFor("all"), { cache:"no-store", headers: HIVE_HEADERS }); }
  catch(e){ throw new Error(T("netErr")); }
  if(res.status === 429){
    const ra = +res.headers.get("Retry-After");
    const err = new Error(ra ? T("limitHive", Math.max(1, Math.ceil(ra / 60))) : limitMsg(nickKey()));
    err.limited = true;
    throw err;
  }
  noteHit(nickKey());
  if(!res.ok) throw new Error(httpMsg(res.status));
  const data = await res.json();
  return { data: (data && typeof data === "object" && !Array.isArray(data)) ? data : {} };
}
async function pullEach(){
  const out = {}, missing = [];
  await Promise.all(state.games.concat("parkour").map(async g => {
    try{
      noteRequest();
      const res = await hiveFetch(urlFor(g), { cache:"no-store", headers: HIVE_HEADERS });
      if(res.status === 404){ missing.push(g); return; }
      if(!res.ok) return;
      let d = await res.json();
      if(d && typeof d === "object" && !Array.isArray(d)){
        const ks = Object.keys(d);
        if(ks.length === 1 && d[ks[0]] && typeof d[ks[0]] === "object" && !Array.isArray(d[ks[0]])) d = d[ks[0]];
      }
      if(d && typeof d === "object" && !Array.isArray(d) && Object.keys(d).length) out[g] = d;
    }catch(e){}
  }));
  return Object.keys(out).length ? { data: out, missing } : null;
}
async function snapshot(){
  if(!state.nick){ toast(T("needNick")); return; }
  const n = nickKey();
  const btn = $("#fetchBtn");
  if(btn.disabled) return;
  state.lastSnapAt = Date.now(); save();
  btn.disabled = true; btn.classList.add("busy"); btn.textContent = T("snapping");
  const now = Date.now(), snap = { t: now, n, g: {} };
  let failed = "";
  try{
    let data, missing = null;
    try{ data = (await pullAll()).data; }
    catch(e){
      if(!e.limited) throw e;
      const r = await pullEach();
      if(!r) throw e;
      data = r.data; missing = r.missing;
    }
    state.last[lk("_all")] = Date.now();
    for(const [g] of GAMES){
      const gd = data[g];
      const hasData = gd && typeof gd === "object" && Object.keys(gd).length > 0;
      if(hasData){
        snap.g[g] = gd;
        state.dead = state.dead.filter(x => x !== g);
      } else if(g !== "main" && !state.dead.includes(g) && (missing === null || missing.includes(g))){
        state.dead.push(g);
      }
    }
    if(data.parkour && typeof data.parkour === "object" && !Array.isArray(data.parkour) && data.parkour.parkours)
      snap.g.parkour = data.parkour;
    const md = snap.g.main;
    if(md){
      const url = cosIcon(pick(md, "equipped_avatar", "avatar_equipped"));
      const who = (pick(md, "username", "username_cc") || state.nick).toLowerCase();
      if(url){
        state.avatars[who] = url;
        const keys = Object.keys(state.avatars);
        if(keys.length > 60) delete state.avatars[keys[0]];
      }
      const cc = md.username_cc;
      if(cc && state.main && state.main.toLowerCase() === cc.toLowerCase()) state.main = cc;
      if(cc && cc.toLowerCase() === n && cc !== state.nick){
        state.nick = cc;
        const inp = $("#nick"); if(inp) inp.value = cc;
      }
    }
  }catch(e){ failed = e.message; }
  if(Object.keys(snap.g).length){
    const mine = mySnaps(), prev = mine[mine.length-1];
    if(prev){
      snap.old = [];
      for(const g in prev.g) if(!(g in snap.g)){
        snap.g[g] = prev.g[g];
        snap.old.push(g);
      }
      if(!snap.old.length) delete snap.old;
    }
    state.snaps.push(snap);
    if(state.snaps.length > 300) state.snaps.shift();
    save();
    syncSoon();
  }
  btn.classList.remove("busy"); btn.textContent = T("snap");
  renderSnap(); renderTrend();
  if(failed) toast(failed);
  const wait = SNAP_GAP - (Date.now() - state.lastSnapAt);
  if(wait > 0) setTimeout(() => { btn.disabled = false; }, wait);
  else btn.disabled = false;
}
