"use strict";

const DERIVED = {
  __winrate: c => { const p = num(c,"played") || num(c,"games_played");
    return p ? +(num(c,"victories") / p * 100).toFixed(2) : null; },
  __kd: c => { const d = num(c,"deaths"); return d ? +(killsOf(c) / d).toFixed(2) : null; }
};
const derivedLabel = k => k === "__winrate" ? T("winrate") : k === "__kd" ? T("kd") : label(k);
function metricVal(c, k){
  if(!c) return null;
  if(DERIVED[k]) return DERIVED[k](c);
  return typeof c[k] === "number" ? c[k] : null;
}
const TREND_RANGES = [
  ["all", null], ["24h", 86400000], ["7d", 7*86400000], ["30d", 30*86400000]
];
const ACT = {};
const ACT_MAX = 300;
let actShown = 20;
function agoText(sec){
  const diff = Date.now() - sec * 1000;
  if(diff < 60000) return T("agoNow");
  if(diff < 3600000) return T("agoMin", Math.floor(diff / 60000));
  if(diff < 86400000) return T("agoH", Math.floor(diff / 3600000));
  return when(sec * 1000);
}
const actKey = e => [e.time, e.type, e.game || "", JSON.stringify(e.unlock ?? e.item ?? e.cosmetic ?? e.id ?? "")].join("|");
function mergeAct(uuid, list){
  if(!uuid || !Array.isArray(list)) return 0;
  const store = state.actLog || (state.actLog = {});
  const cur = store[uuid] || [], seen = new Set(cur.map(actKey));
  let added = 0;
  list.forEach(e => {
    if(!e || typeof e !== "object" || typeof e.time !== "number") return;
    const k = actKey(e);
    if(!seen.has(k)){ seen.add(k); cur.push(e); added++; }
  });
  cur.sort((x, y) => y.time - x.time);
  store[uuid] = cur.slice(0, ACT_MAX);
  if(added) save();
  return added;
}
async function fetchActivity(uuid){
  const c = ACT[uuid];
  if(c && (c.p || Date.now() - c.t < 2 * 60 * 1000)) return;
  ACT[uuid] = { t: c ? c.t : 0, p: true };
  try{
    noteRequest();
    const res = await hiveFetch(API + "/player/activity/" + encodeURIComponent(uuid), { cache:"no-store" });
    if(!res.ok) throw new Error(httpMsg(res.status));
    let d = await res.json();
    if(!Array.isArray(d)) d = (d && Object.values(d).find(Array.isArray)) || [];
    mergeAct(uuid, d);
    ACT[uuid] = { t: Date.now() };
  }catch(e){
    ACT[uuid] = { t: Date.now(), err: e.message };
  }
}
function actRow(e){
  const t = typeof e.time === "number" ? agoText(e.time) : "";
  if(e.type === "ROUND_PLAYED"){
    const r = e.victory === true ? ["w", T("actWin")] : e.victory === false ? ["l", T("actLoss")] : ["", T("actPlayed")];
    return '<div class="act"><span class="ag">' + esc(NAME(e.game)) + '</span><span class="ar ' + r[0] + '">' +
      esc(r[1]) + '</span><span class="at">' + esc(t) + "</span></div>";
  }
  return '<div class="act"><span class="ag"' + (e.unlock_id ? ' data-unl="' + esc(e.unlock_id) + '" data-ut="' +
    esc(e.unlock_type || "") + '"' : "") + ">" + lockerHTML(e.unlock_type, e.unlock_id) +
    '</span><span class="at">' + esc(t) + "</span></div>";
}
const CAT_KEY = "hive.tracker.catalogue.v1";
let CAT = (() => { try{ return JSON.parse(localStorage.getItem(CAT_KEY)) || {}; }catch(e){ return {}; } })();
const catPath = type => /title/i.test(type) ? "titles" : /costume/i.test(type) ? "costumes" : null;
function lockerHTML(type, id){
  const c = (id && CAT[id]) || null;
  const name = (c && c.d) || lockerName(id);
  let html = esc(lockerKind(type)) + (name ? ": " + (hasMC(name) ? mcText(name) : esc(name)) : "");
  if(c && c.g && c.l) html += ' <small class="aunl">' + esc(NAME(c.g)) + ", " + esc(T("unlLvl", c.l)) + "</small>";
  return html;
}
let catBusy = false;
async function fillCatalogue(box){
  if(catBusy) return;
  const spans = [...box.querySelectorAll("[data-unl]")].filter(el => !CAT[el.dataset.unl] && catPath(el.dataset.ut));
  const ids = [...new Set(spans.map(el => el.dataset.unl))].slice(0, 10);
  if(!ids.length) return;
  catBusy = true;
  let changed = false;
  for(const id of ids){
    const type = spans.find(el => el.dataset.unl === id).dataset.ut;
    try{
      const r = await hiveFetch(API + "/catalogue/" + catPath(type) + "/" + encodeURIComponent(id), { headers: HIVE_HEADERS });
      if(!r.ok){ CAT[id] = { d: "", t: Date.now() }; changed = true; continue; }
      const j = await r.json(), md = j && j.unlock_data && j.unlock_data.metadata;
      CAT[id] = { d: typeof j.display === "string" ? j.display : (j.name || ""), g: md && md.game || "", l: md && md.level || 0 };
      changed = true;
    }catch(e){ break; }
  }
  catBusy = false;
  if(!changed) return;
  try{ localStorage.setItem(CAT_KEY, JSON.stringify(CAT)); }catch(e){}
  box.querySelectorAll("[data-unl]").forEach(el => { el.innerHTML = lockerHTML(el.dataset.ut, el.dataset.unl); });
}
function lockerKind(type){
  const k = String(type || "").toLowerCase();
  return T(/title/.test(k) ? "actNewTitle" : /avatar/.test(k) ? "actNewAvatar" : /costume/.test(k) ? "actNewCostume"
    : /hat/.test(k) ? "actNewHat" : /back/.test(k) ? "actNewBack" : /pet/.test(k) ? "actNewPet"
    : /mount/.test(k) ? "actNewMount" : "actLocker");
}
function lockerName(id){
  if(!id) return "";
  const main = (mySnaps().filter(s => s.g.main).pop() || { g: {} }).g.main;
  let found = "";
  const walk = (v, depth) => {
    if(found || !v || typeof v !== "object" || depth > 4) return;
    if(!Array.isArray(v) && Object.values(v).includes(id)){
      const n = pick(v, "display", "name", "human_name");
      if(typeof n === "string"){ found = n; return; }
    }
    for(const x of Object.values(v)) walk(x, depth + 1);
  };
  walk(main, 0);
  return found;
}
function actHTML(list, err){
  const all = list || [];
  const rows = all.slice(0, actShown).map(actRow).join("");
  const more = all.length > actShown
    ? '<button type="button" class="mini actmore">' + esc(T("actMore", Math.min(20, all.length - actShown))) + "</button>" : "";
  return "<h2>" + esc(T("actTitle")) + (all.length ? ' <span class="actn">' + nf(all.length) + "</span>" : "") +
    '</h2><div class="card">' +
    (rows || '<p class="sub" style="margin:0">' + esc(err || T("actEmpty")) + "</p>") + more + "</div>";
}
async function renderActivity(){
  const box = $("#trendAct"); if(!box) return;
  const mine = mySnaps(), last = mine[mine.length - 1];
  const uuid = last && last.g.main && pick(last.g.main, "UUID", "uuid");
  if(!uuid){ box.innerHTML = ""; return; }
  const draw = () => {
    const c = ACT[uuid] || {};
    const list = (state.actLog || {})[uuid] || [];
    box.innerHTML = list.length || !c.p ? actHTML(list, c.err)
      : "<h2>" + esc(T("actTitle")) + '</h2><div class="card"><p class="sub" style="margin:0">' + esc(T("tqLoading")) + "</p></div>";
    const mb = box.querySelector(".actmore");
    if(mb) mb.onclick = () => { actShown += 20; draw(); };
    fillCatalogue(box);
  };
  if($("#vTrend").classList.contains("hidden")){ draw(); return; }
  const pending = fetchActivity(uuid);
  draw();
  await pending;
  const cur = mySnaps().pop();
  if(cur && cur.g.main && pick(cur.g.main, "UUID", "uuid") === uuid) draw();
}
function renderToday(){
  const box = $("#trendToday");
  if(!box) return;
  box.innerHTML = todayHTML(mySnaps());
  fitNames(box);
  fitText(box);
}
function renderTrend(){
  renderToday();
  renderActivity();
  const gSel = $("#trendGame"), mSel = $("#trendMetric"), rSel = $("#trendRange"), body = $("#trendBody");
  const mine = mySnaps();
  const order = GAMES.map(g => g[0]);
  const withData = state.games.filter(g => mine.some(s => s.g[g]))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const ctl = $(".trendctl");
  if(mine.length < 2){
    body.innerHTML = '<p class="sub" style="margin-top:10px">' + esc(T("trendNeed")) + "</p>";
    gSel.innerHTML = mSel.innerHTML = "";
    if(ctl) ctl.classList.add("hidden");
    return;
  }
  if(ctl) ctl.classList.remove("hidden");
  const keepG = gSel.value;
  gSel.innerHTML = withData.map(g => '<option value="' + g + '">' + esc(NAME(g)) + "</option>").join("");
  if(withData.includes(keepG)) gSel.value = keepG;
  const game = gSel.value;

  const numeric = new Set();
  mine.forEach(s => { const d = s.g[game]; if(d) Object.keys(d).forEach(k => {
    if(!SKIP.has(k) && typeof d[k] === "number" && !isDateKey(k)) numeric.add(k); }); });
  const opts = [];
  const sample = (mine.map(x => x.g[game]).filter(Boolean).pop()) || {};
  if(metricVal(sample, "__winrate") !== null) opts.push("__winrate");
  if(metricVal(sample, "__kd") !== null) opts.push("__kd");
  opts.push(...numeric);
  const keepM = mSel.value;
  mSel.innerHTML = opts.map(k => '<option value="' + k + '">' + esc(derivedLabel(k)) + "</option>").join("");
  if(opts.includes(keepM)) mSel.value = keepM;
  const metric = mSel.value;

  const keepR = rSel.value || "all";
  rSel.innerHTML = TREND_RANGES.map(([v]) =>
    '<option value="' + v + '">' + esc(T("range" + (v === "all" ? "All" : v))) + "</option>").join("");
  rSel.value = keepR;
  const range = TREND_RANGES.find(x => x[0] === rSel.value) || TREND_RANGES[0];
  const cutoff = range[1] === null ? -Infinity : Date.now() - range[1];

  const bounded = range[1] !== null;
  const all = mine
    .filter(s => s.g[game] && !(s.old || []).includes(game) && metricVal(s.g[game], metric) !== null)
    .map(s => ({ t:s.t, v:metricVal(s.g[game], metric) }))
    .sort((a, b) => a.t - b.t);
  let pts = all.filter(p => p.t >= cutoff);
  if(bounded){
    const before = all.filter(p => p.t < cutoff).pop();
    if(before) pts.unshift({ t: cutoff, v: before.v });
  }
  pts = pts.filter((p, i, arr) => i === 0 || i === arr.length - 1 || p.v !== arr[i-1].v);
  if(pts.length < 2){ body.innerHTML = '<p class="sub" style="margin-top:20px">' + esc(T("trendFew")) + "</p>"; return; }

  const unit = metric === "__winrate" ? "%" : "";
  const fmtM = n => (metric === "__kd" || metric === "__winrate" ? n.toFixed(2) : nf(n)) + unit;
  const W = 300, H = 110;
  const vs = pts.map(p => p.v), min = Math.min(...vs), max = Math.max(...vs), span = (max - min) || 1;
  const t0 = bounded ? cutoff : pts[0].t;
  const t1 = bounded ? Date.now() : pts[pts.length-1].t, tspan = (t1 - t0) || 1;
  const x = i => (pts[i].t - t0) / tspan * W;
  const y = v => H - (v - min) / span * (H - 10) - 5;
  const path = pts.map((p,i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const grew = vs[vs.length-1] - vs[0];

  const lastX = (x(pts.length-1) / W * 100).toFixed(2);
  const lastY = (y(vs[vs.length-1]) / H * 100).toFixed(2);

  body.innerHTML = '<div class="card"><div class="chart">' +
    '<svg class="line" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">' +
    '<path vector-effect="non-scaling-stroke" d="' + path + '"/></svg>' +
    pts.slice(0, -1).map((p, i) => '<i class="dot sm" style="left:' +
      (x(i) / W * 100).toFixed(2) + "%;top:" + (y(p.v) / H * 100).toFixed(2) + '%"></i>').join("") +
    '<i class="dot" style="left:' + lastX + '%;top:' + lastY + '%"></i></div>' +
    '<div class="tmeta"><span>' + esc(when(t0)) + "</span><span>" +
    esc(when(t1)) + "</span></div>" +
    '<div class="tsum"><div class="tsv"><small>' + esc(T("trendWas")) + "</small><b>" + esc(fmtM(vs[0])) +
      '</b></div><span class="tsa">→</span><div class="tsv"><small>' + esc(T("trendNow")) + "</small><b>" +
      esc(fmtM(vs[vs.length-1])) + '</b></div><span class="tsd ' + (grew > 0 ? "up" : grew < 0 ? "down" : "") +
      '">' + esc((grew > 0 ? "+" : grew < 0 ? "−" : "±") + fmtM(Math.abs(grew))) + "</span></div></div>";
}
$("#trendGame").onchange = renderTrend;
$("#trendMetric").onchange = renderTrend;
$("#trendRange").onchange = renderTrend;
