"use strict";

/* Calendar under "Recent games": a month heat map of the games the site has recorded, and a panel with
   that day's stats and games when a day is tapped. Days are local calendar days of this device. */
let calMonth = null, calSel = null, calAnim = "in", calQuery = "", calList = [];

/* "go to date" box: 12.10, 12.10.2026, 12 октября, вчера, октябрь 2026, 3 (day of the shown month) */
const CAL_MONTHS = [/^(янв|jan)/, /^(фев|feb)/, /^(мар|mar)/, /^(апр|apr)/, /^(мая|май|may)/, /^(июн|jun)/,
  /^(июл|jul)/, /^(авг|aug)/, /^(сен|sep)/, /^(окт|oct)/, /^(ноя|nov)/, /^(дек|dec)/];
const calMonthOf = w => CAL_MONTHS.findIndex(re => re.test(w));
function calParse(q){
  const s = String(q || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/г\.?$/, "").trim();
  if(!s) return null;
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = { "сегодня": 0, "today": 0, "вчера": 1, "yesterday": 1, "позавчера": 2 }[s];
  if(shift !== undefined) return { day: new Date(today.getTime() - shift * 86400000) };
  const fixYear = (y, m, d) => {
    if(y) return y < 100 ? 2000 + y : y;
    return new Date(now.getFullYear(), m, d) > today ? now.getFullYear() - 1 : now.getFullYear();
  };
  let m = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/.exec(s);
  if(m){
    const d = +m[1], mo = +m[2] - 1, y = fixYear(m[3] ? +m[3] : 0, mo, d), date = new Date(y, mo, d);
    return date.getMonth() === mo && date.getDate() === d ? { day: date } : null;
  }
  m = /^(\d{1,2}) ([a-zа-яё]+)(?: (\d{4}))?$/.exec(s);
  if(m && calMonthOf(m[2]) >= 0){
    const d = +m[1], mo = calMonthOf(m[2]), y = fixYear(m[3] ? +m[3] : 0, mo, d), date = new Date(y, mo, d);
    return date.getMonth() === mo ? { day: date } : null;
  }
  m = /^([a-zа-яё]+)(?: (\d{4}))?$/.exec(s);
  if(m && calMonthOf(m[1]) >= 0){
    const mo = calMonthOf(m[1]);
    let y = m[2] ? +m[2] : now.getFullYear();
    if(!m[2] && new Date(y, mo, 1) > today) y--;
    return { month: new Date(y, mo, 1) };
  }
  m = /^(\d{1,2})$/.exec(s);
  if(m && calMonth){
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), +m[1]);
    return date.getMonth() === calMonth.getMonth() ? { day: date } : null;
  }
  return null;
}

const calKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const calLocale = () => (L === "ru" ? "ru-RU" : "en-US");
const calWeekStart = () => (L === "ru" ? 1 : 0);

function calDays(list){
  const days = new Map();
  list.forEach(e => {
    if(typeof e.time !== "number") return;
    const k = calKey(new Date(e.time * 1000));
    let d = days.get(k);
    if(!d) days.set(k, d = { ev: [], games: 0, wins: 0, rewards: 0, modes: {} });
    d.ev.push(e);
    if(e.type === "ROUND_PLAYED"){
      d.games++;
      if(e.victory === true) d.wins++;
      const m = d.modes[e.game] || (d.modes[e.game] = { p: 0, w: 0 });
      m.p++; if(e.victory === true) m.w++;
    }else d.rewards++;
  });
  return days;
}

function calHTML(list){
  if(!list.length) return "";
  calList = list;
  return '<div class="calWrap">' + calInner() + "</div>";
}
function calInner(){
  const list = calList;
  const days = calDays(list), now = new Date();
  const first = list.reduce((m, e) => typeof e.time === "number" ? Math.min(m, e.time) : m, Infinity);
  const firstMonth = new Date(new Date(first * 1000).getFullYear(), new Date(first * 1000).getMonth(), 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if(!calMonth) calMonth = thisMonth;
  if(calMonth < firstMonth) calMonth = firstMonth;
  if(calMonth > thisMonth) calMonth = thisMonth;

  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const inMonth = [...days.entries()].filter(([k]) => k.startsWith(y + "-" + String(mo + 1).padStart(2, "0")));
  const max = Math.max(1, ...inMonth.map(([, d]) => d.games));
  const monthGames = inMonth.reduce((s, [, d]) => s + d.games, 0);
  const monthWins = inMonth.reduce((s, [, d]) => s + d.wins, 0);

  const ws = calWeekStart();
  const heads = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + ((i + ws) % 7));
    return '<span class="calWd">' + esc(d.toLocaleDateString(calLocale(), { weekday: "narrow" })) + "</span>";
  }).join("");

  const lead = (new Date(y, mo, 1).getDay() - ws + 7) % 7;
  const count = new Date(y, mo + 1, 0).getDate();
  const todayKey = calKey(now);
  let cells = "";
  for(let i = 0; i < lead; i++) cells += '<span class="calPad"></span>';
  for(let day = 1; day <= count; day++){
    const date = new Date(y, mo, day), k = calKey(date), d = days.get(k);
    const lvl = d && d.games ? Math.min(4, Math.ceil(d.games / max * 4)) : 0;
    const future = date > now;
    const cls = "calDay lv" + lvl + (k === todayKey ? " today" : "") + (k === calSel ? " sel" : "") +
      (future ? " future" : "") + (d && !d.games && d.rewards ? " rew" : "");
    cells += '<button type="button" class="' + cls + '" data-k="' + k + '"' + (future ? " disabled" : "") +
      ' style="--ei:' + (lead + day - 1) + '" aria-label="' + esc(date.toLocaleDateString(calLocale(), { day: "numeric", month: "long" })) +
      (d ? ", " + esc(T("calGamesN", d.games)) : "") + '"><b>' + day + "</b>" + (d && d.rewards ? '<i class="calRw"></i>' : "") + "</button>";
  }

  const monthName = calMonth.toLocaleDateString(calLocale(), { month: "long" }) + " " + y;
  const prevOk = calMonth > firstMonth, nextOk = calMonth < thisMonth;
  const anim = calAnim; calAnim = "";
  return "<h2>" + esc(T("calTitle")) + '</h2><div class="card calCard">' +
    '<div class="calHead">' +
      '<button type="button" class="calNav" data-d="-1"' + (prevOk ? "" : " disabled") + ' aria-label="' + esc(T("calPrev")) + '">' + CAL_ARROW + "</button>" +
      '<div class="calTitle ' + (anim ? "a-" + anim : "") + '"><b>' + esc(monthName.charAt(0).toUpperCase() + monthName.slice(1)) + "</b>" +
        "<small>" + esc(monthGames ? T("calMonthSum", nf(monthGames), monthGames ? (monthWins / monthGames * 100).toFixed(0) : 0) : T("calMonthNone")) + "</small>" +
        calHiveLine(y, mo + 1) + "</div>" +
      '<button type="button" class="calNav next" data-d="1"' + (nextOk ? "" : " disabled") + ' aria-label="' + esc(T("calNext")) + '">' + CAL_ARROW + "</button>" +
    "</div>" +
    '<form class="calFind" autocomplete="off"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
      '<input type="text" inputmode="text" enterkeyhint="go" placeholder="' + esc(T("calFindPh")) + '" value="' + esc(calQuery) + '" aria-label="' + esc(T("calFindPh")) + '"></form>' +
    '<div class="calGrid' + (anim ? " a-" + anim : "") + '">' + heads + cells + "</div>" +
    '<div class="calLegend"><span>' + esc(T("calLess")) + '</span><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>' + esc(T("calMore")) + "</span></div>" +
    '<div class="calDet"' + (calSel ? "" : " hidden") + '><div class="calDetIn">' + calDetailHTML(days) + "</div></div>" +
    "</div>";
}

const CAL_ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';

const calClock = sec => { const d = new Date(sec * 1000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
function calDetailHTML(days){
  if(!calSel) return "";
  const [yy, mm, dd] = calSel.split("-").map(Number);
  const date = new Date(yy, mm - 1, dd), d = days.get(calSel);
  const title = date.toLocaleDateString(calLocale(), { weekday: "long", day: "numeric", month: "long" });
  const head = (sub) => '<div class="calDetHead"><b>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>";
  if(!d) return head("") + '<p class="sub calNone">' + esc(T("calNone")) + "</p>";
  const times = d.ev.map(e => e.time).filter(t => typeof t === "number").sort((a, b) => a - b);
  const span = times.length ? calClock(times[0]) + " – " + calClock(times[times.length - 1]) : "";
  let html = head(span);
  if(d.games){
    let run = 0, best = 0;
    d.ev.filter(e => e.type === "ROUND_PLAYED").sort((a, b) => a.time - b.time).forEach(e => {
      run = e.victory === true ? run + 1 : 0; best = Math.max(best, run);
    });
    const wr = d.wins / d.games, C = 2 * Math.PI * 27;
    html += '<div class="calSum">' +
      '<div class="calRing"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="27"/>' +
        '<circle class="val" cx="32" cy="32" r="27" style="--c:' + C.toFixed(1) + ';stroke-dasharray:' + C.toFixed(1) + ';stroke-dashoffset:' + (C * (1 - wr)).toFixed(1) + '"/></svg>' +
        "<span><b>" + Math.round(wr * 100) + "%</b><small>" + esc(T("calWr")) + "</small></span></div>" +
      '<div class="calNums">' +
        [[nf(d.games), T("tdPlayed"), ""], [nf(d.wins), T("tdWins"), "w"], [nf(d.games - d.wins), T("losses"), "l"], [nf(best), T("calStreak"), "s"]]
          .map(([v, k, c], i) => '<div class="calNum ' + c + '" style="--ei:' + i + '"><b>' + esc(v) + "</b><small>" + esc(k) + "</small></div>").join("") +
      "</div></div>";
    const modes = Object.entries(d.modes).sort((a, b) => b[1].p - a[1].p);
    html += '<div class="calSub">' + esc(T("calModesH")) + "</div>" +
      '<div class="calModes">' + modes.map(([g, m], i) =>
        '<div class="calMode" style="--ei:' + (i + 4) + '"><span class="calMn">' + esc(NAME(g)) + "</span>" +
        '<span class="calBar"><i>' + (m.w ? '<em class="w" style="flex:' + m.w + '"></em>' : "") + (m.p - m.w ? '<em class="l" style="flex:' + (m.p - m.w) + '"></em>' : "") + "</i></span>" +
        '<span class="calMv"><b>' + nf(m.w) + '</b><span>–</span><i>' + nf(m.p - m.w) + "</i></span></div>").join("") + "</div>";
  }
  const groups = actGroups(d.ev);
  html += '<div class="calSub">' + esc(d.rewards ? T("calGamesRew", nf(d.rewards)) : T("calGamesH")) + "</div>";
  actClockOnly = true;
  try{ html += '<div class="calList">' + groups.map(g => actRow(g.e, g.ex)).join("") + "</div>"; }
  finally{ actClockOnly = false; }
  return html;
}

function calRender(wrap, anim){
  calAnim = anim || "";
  wrap.innerHTML = calInner();
  calBindWrap(wrap);
}
let calDetRaf = 0, calDaysCache = null, calDaysFor = null;
function calDaysNow(){
  if(calDaysFor !== calList){ calDaysFor = calList; calDaysCache = calDays(calList); }
  return calDaysCache;
}
// Rapid taps only rebuild the panel once per frame, and the panel animates as one piece instead of
// dozens of separate elements, so switching days quickly stays smooth.
function calShowDetail(wrap){
  cancelAnimationFrame(calDetRaf);
  calDetRaf = requestAnimationFrame(() => {
    const det = wrap.querySelector(".calDet"); if(!det) return;
    const inner = det.firstElementChild;
    const motion = !state.lite && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasOpen = !det.hidden, was = wasOpen ? det.getBoundingClientRect().height : 0;
    if(det.__anim){ det.__anim.cancel(); det.__anim = null; }
    if(inner.__fade){ inner.__fade.cancel(); inner.__fade = null; }
    // keep the old height while the content changes: otherwise the page is shorter for one frame and the
    // browser pulls the scroll position up, then the animation pushes it back down - a visible hop
    if(wasOpen && motion){ det.style.height = was + "px"; det.style.overflow = "hidden"; }
    inner.innerHTML = calDetailHTML(calDaysNow());
    det.hidden = !calSel && !motion;
    setTimeout(() => fillCatalogue(wrap), 400);
    if(!motion){ det.hidden = !calSel; return; }
    if(calSel) det.hidden = false;
    const now = calSel ? inner.offsetHeight : 0;
    det.style.height = "";
    if(Math.abs(now - was) > 1){
      det.style.overflow = "hidden";
      const a = det.animate([{ height: was + "px" }, { height: now + "px" }],
        { duration: wasOpen && calSel ? 380 : 380, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      det.__anim = a;
      a.onfinish = () => { det.hidden = !calSel; det.style.overflow = ""; a.cancel(); if(det.__anim === a) det.__anim = null; };
    }else{ det.hidden = !calSel; det.style.overflow = ""; }
    if(calSel) inner.__fade = inner.animate([{ opacity: wasOpen ? .35 : 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
      { duration: wasOpen ? 200 : 300, easing: "cubic-bezier(.2,.9,.3,1)" });
  });
}
function calBind(box){
  const wrap = box.querySelector(".calWrap");
  if(wrap) calBindWrap(wrap);
}
function calBindWrap(wrap){
  const card = wrap.querySelector(".calCard"); if(!card) return;
  const form = card.querySelector(".calFind");
  if(form) form.onsubmit = e => {
    e.preventDefault();
    const inp = form.querySelector("input"), r = calParse(inp.value);
    if(!r){ form.classList.remove("bad"); void form.offsetWidth; form.classList.add("bad"); return; }
    calQuery = "";
    const target = r.day ? new Date(r.day.getFullYear(), r.day.getMonth(), 1) : r.month;
    const anim = !calMonth || +target === +calMonth ? "" : target > calMonth ? "next" : "prev";
    calMonth = target;
    calSel = r.day ? calKey(r.day) : null;
    inp.blur();
    calRender(wrap, anim);
    if(calSel){
      const det = wrap.querySelector(".calDet"); det.hidden = true; calShowDetail(wrap);
      setTimeout(() => wrap.querySelector(".calDet").scrollIntoView({ behavior: state.lite ? "auto" : "smooth", block: "nearest" }), 80);
    }
  };
  if(form) form.querySelector("input").oninput = e => { calQuery = e.target.value; form.classList.remove("bad"); };
  card.querySelectorAll(".calNav").forEach(b => b.onclick = () => {
    const d = +b.dataset.d;
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + d, 1);
    calSel = null;
    calRender(wrap, d > 0 ? "next" : "prev");
  });
  card.querySelectorAll(".calDay").forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    calSel = calSel === k ? null : k;
    card.querySelectorAll(".calDay.sel").forEach(x => x.classList.remove("sel"));
    if(calSel) b.classList.add("sel");
    calShowDetail(wrap);
  });
}

/* the whole month as Hive counts it (every game played, not only the ones the site saw) */
function calHiveLine(y, m){
  if(typeof histMonth !== "function") return "";
  const d = histMonth(state.nick, y, m);
  if(!d){
    const inRange = histMonthList(HIST_MONTHS).some(x => x.y === y && x.m === m);
    if(inRange) setTimeout(() => histLoad(histKeyOf(y, m)), 0);
    return "";
  }
  const t = histTotals(d);
  if(!t.played) return "";
  return '<small class="calHive">' + esc(T("calHive", nf(t.played), (t.wins / t.played * 100).toFixed(0))) + "</small>";
}

/* Games per day for the last two weeks, stacked by mode, with the number of sessions (games no more
   than 30 minutes apart count as one sitting). Built from the recorded history, which the worker keeps
   filling while the site is closed. */
const DAY_COLORS = { bed: "#e0564a", sky: "#5bb8f0", murder: "#a874e6", dr: "#e8c88a", hide: "#4fd48a", sg: "#79c46a",
  bridge: "#5bd6c8", ctf: "#f09a4a", drop: "#f2d24a", party: "#f07ab8", ground: "#8a9cf0", grav: "#c0a0ff", build: "#ff8f6a", wars: "#d4a03a" };
const dayColor = g => DAY_COLORS[g] || "hsl(" + hueOf(g) + " 55% 60%)";
let daysSel = null, daysShown = false;
function daysData(list){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(today.getTime() - i * 86400000);
    days.push({ key: calKey(d), date: d, modes: {}, games: 0, wins: 0, sessions: 0, times: [] });
  }
  const byKey = new Map(days.map(d => [d.key, d]));
  list.forEach(e => {
    if(e.type !== "ROUND_PLAYED" || typeof e.time !== "number") return;
    const d = byKey.get(calKey(new Date(e.time * 1000))); if(!d) return;
    d.games++; if(e.victory === true) d.wins++;
    d.modes[e.game] = (d.modes[e.game] || 0) + 1;
    d.times.push(e.time);
  });
  days.forEach(d => {
    d.times.sort((a, b) => a - b);
    d.sessions = d.times.reduce((n, t, i) => n + (i === 0 || t - d.times[i - 1] > 30 * 60 ? 1 : 0), 0);
  });
  return days;
}
function daysHTML(list){
  if(!list || !list.length) return "";
  const days = daysData(list);
  if(!days.some(d => d.games)) return "";
  const max = Math.max(1, ...days.map(d => d.games));
  const loc = L === "ru" ? "ru-RU" : "en-US";
  const sel = days.find(d => d.key === daysSel) || [...days].reverse().find(d => d.games);
  daysSel = sel.key;
  const bars = days.map((d, i) => {
    const segs = Object.entries(d.modes).sort((a, b) => b[1] - a[1]).map(([g, n]) =>
      '<i style="flex:' + n + ";background:" + dayColor(g) + '"></i>').join("");
    return '<button type="button" class="dyCol' + (d.key === sel.key ? " on" : "") + '" data-k="' + d.key + '" style="--ei:' + i + '">' +
      '<span class="dyN">' + (d.games || "") + "</span>" +
      '<span class="dyTrack"><span class="dyBar" style="height:' + (d.games / max * 100).toFixed(1) + '%">' + segs + "</span></span>" +
      '<span class="dyD">' + d.date.getDate() + "</span></button>";
  }).join("");
  const anim = !daysShown; daysShown = true;            // grow the bars once, not on every refresh
  return "<h2>" + esc(T("daysTitle")) + '</h2><div class="card dyCard' + (anim ? "" : " still") + '"><div class="dyBars">' + bars + "</div>" +
    '<div class="dyInfo">' + daysInfo(sel, loc) + "</div></div>";
}
function daysInfo(d, loc){
  const title = d.date.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "long" });
  if(!d.games) return '<div class="dyHead"><b>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + "</b></div>" +
    '<p class="sub" style="margin:6px 0 0">' + esc(T("calNone")) + "</p>";
  return '<div class="dyHead"><b>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + "</b><span>" +
    esc(T("daysSum", nf(d.games), (d.wins / d.games * 100).toFixed(0), nf(d.sessions))) + "</span></div>" +
    '<div class="dyModes">' + Object.entries(d.modes).sort((a, b) => b[1] - a[1]).map(([g, n]) =>
      '<span><i style="background:' + dayColor(g) + '"></i>' + esc(NAME(g)) + " <b>" + n + "</b></span>").join("") + "</div>";
}
function daysBind(root){
  const card = root.querySelector(".dyCard"); if(!card) return;
  const loc = L === "ru" ? "ru-RU" : "en-US";
  card.querySelectorAll(".dyCol").forEach(b => b.onclick = () => {
    daysSel = b.dataset.k;
    card.querySelectorAll(".dyCol.on").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    const d = daysData(calList).find(x => x.key === daysSel);
    const info = card.querySelector(".dyInfo");
    if(d && info){ info.innerHTML = daysInfo(d, loc);
      if(!state.lite) info.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" }); }
  });
}
