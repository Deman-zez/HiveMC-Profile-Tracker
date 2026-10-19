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
  ["all", null], ["24h", 86400000], ["7d", 7*86400000], ["30d", 30*86400000], ["months", null]
];
const ACT = {};
const ACT_MAX = 2000;
let actShown = 20;
let actDaysShown = 7, actOpen = null;
const actDayKey = sec => { const d = new Date(sec * 1000);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function actDayLabel(key){
  const [y, m, d] = key.split("-").map(Number), date = new Date(y, m - 1, d), now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - date) / 86400000);
  if(diff === 0) return T("actToday");
  if(diff === 1) return T("actYesterday");
  const loc = L === "ru" ? "ru-RU" : "en-US";
  const s = date.toLocaleDateString(loc, Object.assign({ weekday: "short", day: "numeric", month: "long" },
    y !== now.getFullYear() ? { year: "numeric" } : {}));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
let actClockOnly = false;
function agoText(sec){
  if(actClockOnly){
    const d = new Date(sec * 1000);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
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
/* Games recorded while the site was closed: the worker polls the activity feed of the site owner's own
   profile every 20 minutes and keeps it, and the site merges that history in on every visit. */
const actSrv = () => PROXY.replace(/\/\?url=$/, "") + "/activity/";
const ACT_SRV_KEY = "hive.tracker.actsrv.v1";
async function pullServerActivity(uuid){
  let st = {};
  try{ st = JSON.parse(localStorage.getItem(ACT_SRV_KEY) || "{}") || {}; }catch(e){}
  const me = String(state.main || "").toLowerCase();
  try{
    if(me && nickKey() === me && Date.now() - (st["t:" + uuid] || 0) > 12 * 3600 * 1000){
      const r = await fetch(actSrv() + "track", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, nick: state.nick }) });
      if(r.ok) st["t:" + uuid] = Date.now();
    }
    const since = st["s:" + uuid] || 0;
    const r = await fetch(actSrv() + uuid + "?since=" + since, { cache: "no-store" });
    if(r.ok){
      const j = await r.json();
      const ev = Array.isArray(j.events) ? j.events : [];
      if(ev.length){
        mergeAct(uuid, ev);
        st["s:" + uuid] = Math.max(since, ...ev.map(e => e.time || 0)) - 600;
      }
    }
  }catch(e){}
  try{ localStorage.setItem(ACT_SRV_KEY, JSON.stringify(st)); }catch(e){}
}
async function fetchActivity(uuid){
  const c = ACT[uuid];
  if(c && (c.p || Date.now() - c.t < 2 * 60 * 1000)) return;
  ACT[uuid] = { t: c ? c.t : 0, p: true };
  await pullServerActivity(uuid);
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
function actGroups(list){
  const out = list.filter(e => e.type === "ROUND_PLAYED").map(e => ({ e, ex: [] }));
  list.forEach(e => {
    if(e.type === "ROUND_PLAYED") return;
    const c = e.unlock_id && CAT[e.unlock_id];
    let best = null, bd = 601;
    if(catKind(c) === "GAME_LEVEL") out.forEach(g => {
      if(!g.e.time || !e.time || c.g !== g.e.game) return;
      const d = Math.abs(g.e.time - e.time);
      if(d < bd){ bd = d; best = g; }
    });
    if(best) best.ex.push(e); else out.push({ e, ex: [] });
  });
  return out.sort((a, b) => (b.e.time || 0) - (a.e.time || 0));
}
function unlSpan(e, grp){
  return '<span class="ag unl"' + (e.unlock_id ? ' data-unl="' + esc(e.unlock_id) + '" data-ut="' + esc(e.unlock_type || "") + '"' +
    (grp ? ' data-grp="1"' : "") : "") + ">" + lockerHTML(e.unlock_type, e.unlock_id, grp) + "</span>";
}
function actRow(e, ex){
  const t = typeof e.time === "number" ? agoText(e.time) : "";
  if(e.type === "ROUND_PLAYED"){
    const r = e.victory === true ? ["w", T("actWin")] : e.victory === false ? ["l", T("actLoss")] : ["", T("actPlayed")];
    return '<div class="act"><span class="ag">' + esc(NAME(e.game)) + '</span><span class="ar ' + r[0] + '">' +
      esc(r[1]) + '</span><span class="at">' + esc(t) + "</span>" +
      (ex && ex.length ? ex.map(x => '<div class="actx">' + unlSpan(x, true) + "</div>").join("") : "") + "</div>";
  }
  return '<div class="act">' + unlSpan(e, false) + '<span class="at">' + esc(t) + "</span></div>";
}
const CAT_KEY = "hive.tracker.catalogue.v2";
let CAT = (() => { try{ return JSON.parse(localStorage.getItem(CAT_KEY)) || {}; }catch(e){ return {}; } })();
const catPath = type => /title/i.test(type) ? "titles" : /costume/i.test(type) ? "costumes" : null;
const catKind = c => !c ? "" : c.x && c.x.type ? c.x.type : c.g && c.l ? "GAME_LEVEL" : "";
function lockerHTML(type, id, grp){
  const c = (id && CAT[id]) || null;
  const name = (c && c.d) || lockerName(id);
  let html = esc(lockerKind(type)) + (name ? ": " + (hasMC(name) ? mcText(name) : esc(name)) : "");
  if(catKind(c) === "GAME_LEVEL" && c.l)
    html += ' <small class="aunl">' + (c.g && !grp ? esc(NAME(c.g)) + ", " : "") + esc(T("unlLvl", c.l)) + "</small>";
  else if(c && c.x && c.x.type) html += ' <small class="aunl">' + esc(titleHow({ x: c.x })) + "</small>";
  return html;
}
let catBusy = false;
async function fillCatalogue(box, redraw){
  if(catBusy) return;
  const stale = id => !CAT[id] || (!CAT[id].d && Date.now() - (CAT[id].t || 0) > 3 * 60 * 60 * 1000);
  const spans = [...box.querySelectorAll("[data-unl]")].filter(el => stale(el.dataset.unl) && catPath(el.dataset.ut));
  const ids = [...new Set(spans.map(el => el.dataset.unl))].slice(0, 10);
  if(!ids.length) return;
  catBusy = true;
  let changed = false;
  for(const id of ids){
    const type = spans.find(el => el.dataset.unl === id).dataset.ut;
    try{
      const r = await hiveFetch(API + "/catalogue/" + catPath(type) + "/" + encodeURIComponent(id), { headers: HIVE_HEADERS });
      if(r.status === 404){ CAT[id] = { d: "", t: Date.now() }; changed = true; continue; }
      if(!r.ok) break;
      const j = await r.json(), md = j && j.unlock_data && j.unlock_data.metadata;
      const ud = j && j.unlock_data && typeof j.unlock_data === "object" ? j.unlock_data : null;
      CAT[id] = { d: typeof j.display === "string" ? j.display : (j.name || ""), g: md && md.game || "", l: md && md.level || 0,
        x: ud ? { type: ud.type, offer: ud.offer, metadata: ud.metadata } : null, t: Date.now() };
      changed = true;
    }catch(e){ break; }
  }
  catBusy = false;
  if(!changed) return;
  try{ localStorage.setItem(CAT_KEY, JSON.stringify(CAT)); }catch(e){}
  if(redraw && box.isConnected) redraw();
  else box.querySelectorAll("[data-unl]").forEach(el => { el.innerHTML = lockerHTML(el.dataset.ut, el.dataset.unl, !!el.dataset.grp); });
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
/* Recent games: today's games are listed as they are; older days are one line each with their totals and
   open on tap. An open day's header sticks to the top like a date in a chat, on a frosted bar. */
function actHTML(list, err){
  const all = list || [];
  const groups = actGroups(all);
  const today = actDayKey(Date.now() / 1000);
  const todayRows = [], days = [];
  groups.forEach(g => {
    const k = typeof g.e.time === "number" ? actDayKey(g.e.time) : "?";
    if(k === today){ todayRows.push(g); return; }
    let d = days[days.length - 1];
    if(!d || d.k !== k) days.push(d = { k, gs: [], games: 0, wins: 0, rewards: 0 });
    d.gs.push(g);
    if(g.e.type === "ROUND_PLAYED"){ d.games++; if(g.e.victory === true) d.wins++; }
    d.rewards += (g.e.type === "ROUND_PLAYED" ? 0 : 1) + g.ex.length;
  });
  if(!actOpen) actOpen = new Set();
  let head = "";
  if(todayRows.length){
    const tg = todayRows.filter(g => g.e.type === "ROUND_PLAYED"), tw = tg.filter(g => g.e.victory === true).length;
    const twr = tg.length ? Math.round(tw / tg.length * 100) : 0;
    const tsum = tg.length
      ? '<span class="adg">' + esc(nf(tg.length) + " " + gamesWord(tg.length)) + '</span><span class="adw' + (twr >= 50 ? " good" : "") + '">' + twr + "%</span>"
      : "";
    const now = new Date();
    const dateTxt = now.toLocaleDateString(L === "ru" ? "ru-RU" : "en-US", { weekday: "short", day: "numeric", month: "long" });
    const strip = tg.slice(0, 24).reverse().map((g, i) => '<i class="' + (g.e.victory === true ? "w" : "l") + '" style="--ei:' + i + '"></i>').join("");
    head = '<div class="actDay open today"><div class="actDh static">' +
      '<span class="tdl"><span class="tdLive"></span><span class="tdT"><b>' + esc(T("actToday")) + "</b><small>" + esc(dateTxt) + "</small></span></span>" +
      '<span class="ads">' + tsum + "</span>" +
      (tg.length > 1 ? '<span class="tdStrip" aria-hidden="true">' + strip + "</span>" : "") + "</div>" +
      '<div class="actDb"><div class="actDbIn">' + actDayRows(today, todayRows) + "</div></div></div>";
  }
  const body = days.slice(0, actDaysShown).map((d, i) => {
    const open = actOpen.has(d.k);
    const wr = d.games ? Math.round(d.wins / d.games * 100) : 0;
    const sum = d.games
      ? '<span class="adg">' + esc(nf(d.games) + " " + gamesWord(d.games)) + '</span><span class="adw' + (wr >= 50 ? " good" : "") + '">' + wr + "%</span>"
      : '<span class="adg">' + esc(T("actDayRewards", nf(d.rewards))) + "</span>";
    return '<div class="actDay' + (open ? " open" : "") + '" data-k="' + d.k + '" style="--ei:' + i + '">' +
      '<button type="button" class="actDh" aria-expanded="' + open + '"><b>' + esc(d.k === "?" ? "—" : actDayLabel(d.k)) + "</b>" +
      '<span class="ads">' + sum + "</span>" + ACT_CHEV + "</button>" +
      '<div class="actDb"' + (open ? "" : ' hidden') + '><div class="actDbIn">' + (open ? actDayRows(d.k, d.gs) : "") + "</div></div></div>";
  }).join("");
  const more = days.length > actDaysShown
    ? '<button type="button" class="mini actmore">' + esc((n => T(n === 1 ? "actMoreDay1" : "actMoreDays", n))(Math.min(14, days.length - actDaysShown))) + "</button>" : "";
  const empty = !head && !body ? '<p class="sub" style="margin:0">' + esc(err || T("actEmpty")) + "</p>" : "";
  return "<h2>" + esc(T("actTitle")) + (groups.length ? ' <span class="actn">' + nf(groups.length) + "</span>" : "") +
    '</h2><div class="card actCard">' + head + body + empty + more + "</div>";
}
const winsWord = n => L === "ru" ? "поб." : (n === 1 ? "win" : "wins");
// rows of one day: today keeps "5 min ago", older days only need the clock time
function actDayRows(k, groups){
  const today = actDayKey(Date.now() / 1000);
  actClockOnly = k !== today;
  try{ return groups.map(g => actRow(g.e, g.ex)).join(""); }
  finally{ actClockOnly = false; }
}
const ACT_CHEV = '<svg class="actCh" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>';
const actMotion = () => !state.lite && !matchMedia("(prefers-reduced-motion: reduce)").matches;
function actSlide(body, open, done){
  const inner = body.firstElementChild;
  if(body.__anim){ body.__anim.cancel(); body.__anim = null; }
  if(open) body.hidden = false;
  if(!actMotion()){ if(!open) body.hidden = true; if(done) done(); return; }
  const h = inner.offsetHeight, from = open ? 0 : h, to = open ? h : 0;
  body.style.overflow = "hidden";
  const a = body.animate([{ height: from + "px" }, { height: to + "px" }],
    { duration: open ? Math.min(560, 300 + h * .35) : Math.min(380, 220 + h * .15),
      easing: open ? "cubic-bezier(.22,1,.36,1)" : "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
  body.__anim = a;
  let fade = null;
  if(open){
    // One animation for the whole list: a dozen separate row animations made phone browsers repaint the
    // entire card on every frame, which showed up as flicker. The list glides down as one piece instead.
    fade = inner.animate([{ opacity: 0, transform: "translate3d(0,-14px,0)" }, { opacity: 1, transform: "none" }],
      { duration: 420, delay: 40, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
  }else{
    // the fade is held at zero until the day is really hidden, otherwise rows pop back mid-collapse
    fade = inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" });
  }
  a.onfinish = () => {
    if(!open) body.hidden = true;
    body.style.overflow = "";
    a.cancel(); body.__anim = null;
    if(fade && !open) fade.cancel();
    if(done) done();
  };
  a.oncancel = () => { if(fade) fade.cancel(); };
}
function actBindDays(box, list){
  box.querySelectorAll(".actDay .actDh:not(.static)").forEach(h => h.onclick = () => {
    const day = h.parentNode, k = day.dataset.k, body = day.querySelector(".actDb"), inner = body.firstElementChild;
    const opening = !day.classList.contains("open");
    if(opening){
      actOpen.add(k);
      if(!inner.childElementCount){
        const groups = actGroups(list || []).filter(g => typeof g.e.time === "number" && actDayKey(g.e.time) === k);
        inner.innerHTML = actDayRows(k, groups);
        fillCatalogue(box);
      }
      day.classList.add("open");
      actSlide(body, true);
    }else if(day.classList.contains("stuck")){
      // Closing a day you have scrolled into: collapsing it in place would yank everything under the
      // pinned header. Instead the header stays exactly where it is on screen, the day's games vanish
      // above the fold, and the days below glide up into view.
      actOpen.delete(k);
      if(body.__anim){ body.__anim.cancel(); body.__anim = null; }
      const docTop = day.getBoundingClientRect().top + scrollY;
      const pin = parseFloat(getComputedStyle(h).top) || 0;
      day.classList.remove("open", "stuck");
      body.hidden = true;
      scrollTo({ top: Math.max(0, docTop - pin), behavior: "instant" });
      if(actMotion()){
        let el = day.nextElementSibling, i = 0;
        while(el && i < 8){
          el.animate([{ opacity: 0, transform: "translate3d(0,22px,0)" }, { opacity: 1, transform: "none" }],
            { duration: 360, delay: i * 30, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
          el = el.nextElementSibling; i++;
        }
      }
      actStickCheck();
    }else{
      actOpen.delete(k);
      day.classList.remove("open", "stuck");
      actSlide(body, false);
    }
    h.setAttribute("aria-expanded", opening);
  });
}
/* a sticky day header gets its frosted bar only while it is actually stuck at the top */
let actStickTick = false;
function actStickCheck(){
  if(actStickTick) return;
  actStickTick = true;
  requestAnimationFrame(() => {
    actStickTick = false;
    const view = $("#vTrend"); if(!view || view.classList.contains("hidden")) return;
    view.querySelectorAll(".actDay.open > .actDh").forEach(h => {
      const top = parseFloat(getComputedStyle(h).top) || 0;
      const r = h.getBoundingClientRect(), d = h.parentNode.getBoundingClientRect();
      h.parentNode.classList.toggle("stuck", r.top <= top + 1 && d.top < r.top - 1);
    });
  });
}
addEventListener("scroll", actStickCheck, { passive: true });
async function renderActivity(){
  const box = $("#trendAct"); if(!box) return;
  if(typeof calAnim !== "undefined" && !$("#vTrend").classList.contains("hidden")) calAnim = "in";
  const mine = mySnaps(), last = mine[mine.length - 1];
  const uuid = last && last.g.main && pick(last.g.main, "UUID", "uuid");
  if(!uuid){ box.innerHTML = ""; const sd = $("#trendSide"); if(sd) sd.innerHTML = ""; return; }
  const draw = () => {
    const c = ACT[uuid] || {};
    const list = (state.actLog || {})[uuid] || [];
    box.innerHTML = (list.length || !c.p ? actHTML(list, c.err)
      : "<h2>" + esc(T("actTitle")) + '</h2><div class="card"><p class="sub" style="margin:0">' + esc(T("tqLoading")) + "</p></div>");
    const side = $("#trendSide");
    if(side && typeof calHTML === "function"){ side.innerHTML = calHTML(list); calBind(side); }
    actBindDays(box, list);
    const mb = box.querySelector(".actmore");
    if(mb) mb.onclick = () => {
      const from = box.querySelectorAll(".actCard > .actDay").length;
      actDaysShown += 14; draw();
      staggerIn([...box.querySelectorAll(".actCard > .actDay")].slice(from), 14);
    };
    fillCatalogue(box, draw);
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
  // monthly history comes from Hive itself, so one snapshot (to know the player's games) is enough
  if(mine.length < 1){
    body.innerHTML = '<p class="sub" style="margin-top:10px">' + esc(T("trendNeed")) + "</p>";
    gSel.innerHTML = mSel.innerHTML = "";
    if(ctl) ctl.classList.add("hidden");
    return;
  }
  if(ctl) ctl.classList.remove("hidden");
  const keepG = gSel.value || "main";
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
  const keepM = mSel.value || (game === "main" ? "daily_login_streak" : "");
  mSel.innerHTML = opts.map(k => '<option value="' + k + '">' + esc(derivedLabel(k)) + "</option>").join("");
  if(opts.includes(keepM)) mSel.value = keepM;
  const metric = mSel.value;

  const keepR = rSel.value || "all";
  rSel.innerHTML = TREND_RANGES.map(([v]) =>
    '<option value="' + v + '">' + esc(T("range" + (v === "all" ? "All" : v === "months" ? "Months" : v))) + "</option>").join("");
  rSel.value = mine.length < 2 ? "months" : keepR;
  if(rSel.value === "months"){
    // Hive's monthly stats exist per game only, and carry their own set of fields
    const games = withData.filter(g => g !== "main");
    const months = histMonthList(HIST_MONTHS).map(x => histMonth(state.nick, x.y, x.m)).filter(Boolean);
    const keepG2 = gSel.value !== "main" ? gSel.value : (keepG !== "main" ? keepG : "");
    gSel.innerHTML = games.map(g => '<option value="' + g + '">' + esc(NAME(g)) + "</option>").join("");
    gSel.value = games.includes(keepG2) ? keepG2 : (games[0] || "");
    const g2 = gSel.value;
    const keys = new Set();
    months.forEach(d => { const c = d[g2]; if(c) Object.keys(c).forEach(k => {
      if(!SKIP.has(k) && typeof c[k] === "number" && !isDateKey(k) && !/^(index|human_index)$/.test(k)) keys.add(k); }); });
    const mopts = [];
    if(keys.has("played") || keys.has("games_played")) mopts.push("__winrate");
    if(keys.has("deaths")) mopts.push("__kd");
    ["played", "victories", "kills", "deaths", "xp"].forEach(k => { if(keys.has(k)){ mopts.push(k); keys.delete(k); } });
    mopts.push(...keys);
    if(!mopts.length) mopts.push("played", "victories");
    const keepM2 = mSel.value;
    mSel.innerHTML = mopts.map(k => '<option value="' + k + '">' + esc(derivedLabel(k)) + "</option>").join("");
    mSel.value = mopts.includes(keepM2) ? keepM2 : (mopts.includes("played") ? "played" : mopts[0]);
    renderTrendMonths(g2, mSel.value, body);
    return;
  }
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

/* "By month": one bar per calendar month from Hive's monthly stats, newest on the right */
function renderTrendMonths(game, metric, body){
  const nick = state.nick, list = histMonthList(HIST_MONTHS).reverse();
  const st = histState(nick);
  const first = histFirstPlayed();
  const months = list.filter(x => !first || Date.UTC(x.y, x.m, 1) > first);
  const loc = L === "ru" ? "ru-RU" : "en-US";
  const rows = months.map(x => {
    const d = histMonth(nick, x.y, x.m), c = d && d[game];
    const v = c ? metricVal(c, metric) : (d ? 0 : null);
    return { x, v, known: !!d };
  });
  const known = rows.filter(r => r.known && r.v !== null);
  const unit = metric === "__winrate" ? "%" : "";
  const fmt = n => (metric === "__kd" || metric === "__winrate" ? (+n).toFixed(2) : nf(Math.round(n))) + unit;
  const ratioMetric = metric === "__kd" || metric === "__winrate";
  const max = Math.max(1, ...known.map(r => r.v || 0));
  const done = st.got >= st.want;
  const noteHTML = done ? '<p class="sub hmNote">' + esc(T("histNote")) + "</p>"
    : '<div class="hmProg' + (st.waiting ? " wait" : "") + '"><span class="hmPt">' + esc(T("histMonthsLbl")) + "</span>" +
      '<span class="hmPbar"><i style="width:' + (st.got / Math.max(1, st.want) * 100).toFixed(1) + '%"></i></span>' +
      "<b>" + st.got + " / " + st.want + "</b></div>";
  const note = done ? T("histNote") : st.got + " / " + st.want;
  if(!known.length){
    body.innerHTML = '<div class="card">' + noteHTML + "</div>";
  }else{
    const best = known.reduce((a, b) => (b.v > a.v ? b : a));
    const total = known.reduce((s, r) => s + (r.v || 0), 0);
    const active = known.filter(r => r.v > 0);
    const avg = active.length ? total / active.length : 0;
    body.innerHTML = '<div class="card hmCard"><div class="hmBars">' + rows.map((r, i) => {
      const h = r.known && r.v !== null ? Math.max(r.v > 0 ? 4 : 0, r.v / max * 100) : 0;
      const label = new Date(Date.UTC(r.x.y, r.x.m - 1, 1)).toLocaleDateString(loc, { month: "short", timeZone: "UTC" }).replace(".", "").slice(0, 3);
      return '<div class="hmCol' + (r.known ? "" : " wait") + (r === best ? " best" : "") + (r.x.current ? " now" : "") + '" style="--ei:' + i + '">' +
        '<span class="hmVal">' + (r.known && r.v ? esc(fmt(r.v)) : "") + "</span>" +
        '<span class="hmTrack"><i style="height:' + h.toFixed(1) + '%"></i></span>' +
        '<span class="hmLbl">' + esc(label) + "</span></div>";
    }).join("") + "</div>" +
    '<div class="hmSum">' +
      '<div><small>' + esc(T("histBest")) + "</small><b>" + esc(fmt(best.v)) + "</b><em>" +
        esc(new Date(Date.UTC(best.x.y, best.x.m - 1, 1)).toLocaleDateString(loc, { month: "long", timeZone: "UTC" }) + " " + best.x.y) + "</em></div>" +
      (ratioMetric ? "" : '<div><small>' + esc(T("histTotal")) + "</small><b>" + esc(fmt(total)) + "</b></div>") +
      '<div><small>' + esc(T("histAvg")) + "</small><b>" + esc(fmt(avg)) + "</b></div>" +
    "</div>" + noteHTML + "</div>";
  }
  if(st.got < st.want && !st.waiting) histLoad();
}
let histRedraw = 0;
onHist(() => {
  clearTimeout(histRedraw);
  histRedraw = setTimeout(() => {
    const r = $("#trendRange");
    if(r && r.value === "months" && !$("#vTrend").classList.contains("hidden")) renderTrend();
    const w = document.querySelector("#trendSide .calWrap");
    if(w && typeof calRender === "function") calRender(w, "");
  }, 120);
});
