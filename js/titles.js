"use strict";

const TCAT_KEY = "hive.tracker.titles.v2";
let TCAT = null, tcatP = null;
const stripTitle = s => String(s || "").replace(/[§&][0-9a-z]/gi, "").replace(/[‘’`´]/g, "'")
  .replace(/[\uE000-\uF8FF]|[\uDB80-\uDBBF][\uDC00-\uDFFF]/g, "");
const exactTitle = s => stripTitle(s).replace(/\s+/g, " ").trim().toLowerCase();
const looseTitle = s => stripTitle(s).replace(/\([^)]*\)/g, " ")
  .replace(/#?[\d.,]+[kKmM%]?/g, " ")
  .replace(/\s+/g, " ").trim().toLowerCase();
function indexCat(list){
  const byU = new Map(), byExact = new Map(), byLoose = new Map();
  list.forEach(e => {
    if(e.u) byU.set(e.u, e);
    const a = exactTitle(e.d), b = looseTitle(e.d);
    if(a && !byExact.has(a)) byExact.set(a, e);
    if(b && !byLoose.has(b)) byLoose.set(b, e);
  });
  return { byU, byExact, byLoose };
}
async function loadTitleCatalogue(){
  if(TCAT) return TCAT;
  if(!tcatP) tcatP = (async () => {
    try{
      const c = JSON.parse(localStorage.getItem(TCAT_KEY) || "null");
      if(c && Date.now() - c.t < 86400000 && Array.isArray(c.d)) return (TCAT = indexCat(c.d));
    }catch(e){}
    noteRequest();
    let res;
    try{ res = await hiveFetch(API + "/catalogue/titles", { cache:"no-store" }); }
    catch(e){ throw new Error(T("netErr")); }
    if(!res.ok) throw new Error(httpMsg(res.status));
    let d = await res.json();
    if(d && !Array.isArray(d) && typeof d === "object"){
      const arr = Object.values(d).find(Array.isArray);
      d = arr || Object.entries(d).filter(([, v]) => v && typeof v === "object")
        .map(([k, v]) => Object.assign({ UUID: k }, v));
    }
    if(!Array.isArray(d)) d = [];
    const slim = d.map(x => {
      const ud = x.unlock_data || {};
      return { u:x.UUID || x.uuid, d:x.display || x.name || x.title, x:{ type:ud.type, active:ud.active, metadata:ud.metadata,
        offer: ud.store_offer && ud.store_offer.name } };
    });
    if(slim.length) try{ localStorage.setItem(TCAT_KEY, JSON.stringify({ t:Date.now(), d:slim })); }catch(e){}
    return (TCAT = indexCat(slim));
  })();
  try{ return await tcatP; } finally { tcatP = null; }
}
const TMETA_KEY = "hive.tracker.titlemeta.v2";
let TMETA = null, tmetaP = null;
function indexMeta(list){
  const byExact = new Map(), byLoose = new Map();
  list.forEach(e => {
    const a = exactTitle(e.d), b = looseTitle(e.d);
    if(a && !byExact.has(a)) byExact.set(a, e);
    if(b && !byLoose.has(b)) byLoose.set(b, e);
  });
  return { byExact, byLoose };
}
async function loadTitleMeta(){
  if(TMETA) return TMETA;
  if(!tmetaP) tmetaP = (async () => {
    try{
      const c = JSON.parse(localStorage.getItem(TMETA_KEY) || "null");
      if(c && Date.now() - c.t < 7 * 86400000 && Array.isArray(c.d) && c.d.length && c.g) return (TMETA = indexMeta(c.d));
    }catch(e){}
    const codes = GAMES.map(g => g[0]).filter(g => g !== "main");
    const games = {};
    const res = await Promise.allSettled(codes.map(async g => {
      noteRequest();
      const r = await hiveFetch(API + "/game/meta/" + g, { cache:"no-store" });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const m = await r.json(), out = [];
      if(m && typeof m === "object"){
        const xp = Object.entries(m.experienceToLevel || {})
          .map(([x, l]) => [+x, +l]).filter(([x, l]) => isFinite(x) && isFinite(l)).sort((a, b) => a[0] - b[0]);
        const mono = xp.every((p, i) => !i || p[1] >= xp[i - 1][1]);
        if(+m.maxLevel > 0 || (xp.length && mono)) games[g] = { max: +m.maxLevel || 0, xp: mono ? xp : [] };
      }
      const lu = m && m.levelUnlocks;
      if(lu && typeof lu === "object") for(const [lvl, arr] of Object.entries(lu)){
        (Array.isArray(arr) ? arr : []).forEach(u => {
          const gc = u && u.globalCosmetic;
          if(gc && gc.type === "hub_title" && gc.display) out.push({ d: gc.display, g, l: lvl });
          else if(u && /title/i.test(u.type || "") && u.name) out.push({ d: u.name, g, l: lvl });
        });
      }
      return out;
    }));
    const all = res.flatMap(r => r.status === "fulfilled" ? r.value : []);
    if(!all.length && !Object.keys(games).length) return indexMeta([]);
    try{ localStorage.setItem(TMETA_KEY, JSON.stringify({ t:Date.now(), d:all, g:games })); }catch(e){}
    const first = !Object.keys(META_GAMES).length;
    META_GAMES = games;
    if(first && Object.keys(games).length) setTimeout(renderSnap, 0);
    return (TMETA = indexMeta(all));
  })();
  try{ return await tmetaP; } finally { tmetaP = null; }
}
const isoDate = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? m[3] + "." + m[2] + "." + m[1] : v; };
function titleHow(e){
  if(!e || !e.x || !e.x.type) return T("tqNone");
  const x = e.x, md = x.metadata && !Array.isArray(x.metadata) ? x.metadata : {};
  let t;
  if(x.type === "GAME_LEVEL") t = T("tqLevel", md.level, NAME(md.game));
  else if(x.type === "ACHIEVEMENT") t = md.requirement ? T("tqAch", md.requirement) : T("tqNone");
  else if(x.type === "STORE_PURCHASE") t = x.offer ? T("tqStore", x.offer) : T("tqStoreBare");
  else if(x.type === "LEGACY"){
    t = T("tqLegacy");
    if(md.originalUnlockType === "GAME_LEVEL" && md.level) t += " · " + T("tqWas", md.level, NAME(md.game));
    else if(md.description) t += " · " + md.description;
    else if(md.requirement) t += " · " + md.requirement;
    if(md.lastAvailable) t += ", " + T("tqUntil", isoDate(md.lastAvailable));
  }
  else t = pretty(String(x.type).toLowerCase());
  if(x.active === false && x.type !== "LEGACY") t += GONE;
  return t;
}
let tqData = null, tqDataP = null;
const TINFO_KEY = "hive.tracker.titleinfo";
const SUPPORT_TITLES = "https://support.playhive.com/hub-titles/";
let TINFO = null, tinfoP = null;
function parseSupportTitles(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".gh-content, .post-content, article") || doc.body;
  const out = [];
  let game = "", gone = false;
  root.querySelectorAll("h2, h3, p").forEach(el => {
    const t = el.textContent.replace(/\s+/g, " ").trim();
    if(/^H[23]$/.test(el.tagName)){ gone = /unobtainable/i.test(t); game = ""; return; }
    const m = /^Hub titles that can be unlocked by playing (.+?):?$/i.exec(t);
    if(m){ game = m[1]; return; }
    const i = t.indexOf(" - ");
    if(i <= 0) return;
    const n = t.slice(0, i).replace(/\(Stat Track\)/i, "").trim(), d = t.slice(i + 3).trim();
    if(n && d && n.length <= 60) out.push({ n, d, g: game, o: gone ? 1 : 0 });
  });
  return out;
}
function indexInfo(list){
  const exact = new Map(), dup = new Set(), pats = [];
  list.forEach(e => {
    const key = exactTitle(e.n);
    if(!key) return;
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = safe.replace(/(^|\s)(#?)x(%?)(?=\s|$)/g, (m, a, h, p) => a + h + "[\\d.,]+[kmb]?" + p);
    if(rx !== safe){ pats.push({ re: new RegExp("^" + rx + "$"), e }); return; }
    if(exact.has(key) && exact.get(key).d !== e.d) dup.add(key);
    else exact.set(key, e);
  });
  dup.forEach(k => exact.delete(k));
  return { exact, pats };
}
function infoFor(idx, t){
  const k = exactTitle(t);
  return idx.exact.get(k) || (idx.pats.find(p => p.re.test(k)) || {}).e || null;
}
const ITEM_RU = [[/ pet$/i, "питомец"], [/ mount$/i, "транспорт"], [/ costumes?$/i, "костюм"],
  [/ bundle$/i, "набор"], [/ rank$/i, "ранг"], [/ pass$/i, "пропуск"], [/ back bling$/i, "украшение для спины"],
  [/ ticket$/i, "билет"]];
const GONE = "\u0001";
function itemRu(item){
  let s = item.trim();
  const mk = /^limited edition (.+?) plushie from Makeship$/i.exec(s);
  if(mk) return T("tqPlush", mk[1]);
  for(const [re, w] of ITEM_RU) if(re.test(s)) return w + " " + s.replace(re, "");
  return s;
}
function buyText(raw){
  let item = raw, extra = "";
  const q = /\s+from the Quest Store\s*\((.+)\)$/i.exec(item);
  if(q){ item = item.slice(0, q.index); extra = " · " + T("tqQuest", q[1]); }
  const c = /,? and completing the '(.+?)' challenge$/i.exec(item);
  if(c){ item = item.slice(0, c.index); extra += " · " + T("tqChallenge", c[1]); }
  const fh = /\s+from (?:the )?Hive Store$/i.exec(item);
  if(fh) item = item.slice(0, fh.index);
  return T("tqBuy", itemRu(item)) + extra;
}
const INFO_RU = [
  [/^Awarded for reaching level (\d+) in (.+?)(?: during (.+))?$/i, m => T("tqLevel", m[1], m[2]) + (m[3] ? " · " + m[3] : "")],
  [/^Could be obtained by purchasing (?:the )?(.+?) before (?:the )?(.+)$/i, m => buyText(m[1]) + " · " + T("tqBefore", m[2])],
  [/^(?:Obtained|Could be obtained) by purchasing (?:the |a |an )?(.+)$/i, m => buyText(m[1])],
  [/^Could be purchased from the Challenge Merchant during (.+)$/i, m => T("tqMerchant") + " · " + m[1]],
  [/^Can be purchased from the Challenge Merchant$/i, () => T("tqMerchant")],
  [/^(?:Unlocked|Obtained) by completing stage (\d+) of the hub parkour, before (.+)$/i, m => T("tqParkourStage", m[1], m[2])],
  [/^Obtained by completing a hub parkour course, before (.+)$/i, m => T("tqParkourBefore", m[1])],
  [/^Unlocked by completing one of the hub parkour courses$/i, () => T("tqParkour")],
  [/^Awarded for joining the server for (\d+) days in a row$/i, m => T("tqStreak", m[1])],
  [/^Obtained by redeeming the code included in (?:the )?(.+?)(?:'s)? issue of The Buzz newsletter$/i, m => T("tqBuzz", m[1])],
  [/^(?:\w+ )?included in (?:the )?(.+?) issue of The Buzz newsletter$/i, m => T("tqBuzz", m[1])],
  [/^Obtained by opening the (\d+)(?:st|nd|rd|th) .*?daily gift during (.+)$/i, m => T("tqGift", m[1], m[2])],
  [/^Awarded to players who played (.+?) during Season (\d+)( \(displays season ranking\))?$/i,
    m => T("tqSeason", m[2], m[1]) + (m[3] ? T("tqSeasonRank") : "")],
  [/^Awarded to the top ([\d,]+) players on the (.+?) leaderboard$/i, m => T("tqTop", m[1].replace(/,/g, " "), m[2])],
  [/^Awarded to (?:\w+ )?players who played (.+?) for over a year(?: \((.+)\))?$/i, m => T("tqVeteran", m[1]) + (m[2] ? " · " + m[2] : "")],
  [/^Awarded to (.+?) players(?: \((.+)\))?$/i, m => T("tqPlayers", m[1]) + (m[2] ? " · " + m[2] : "")],
  [/^(?:Awarded for riding|Obtained by riding) the (?:train|Monorail)(?: in the (?:Arcade )?hub)? for (?:an|one) hour(?: during (.+))?$/i,
    m => T("tqTrain") + (m[1] ? " · " + m[1] : "")],
  [/^Could be obtained on The Hive's (\d+)\w* birthday \((.+)\)$/i, m => T("tqBirthday", m[1], m[2])],
  [/^Awarded for participating in the (.+?) (?:competition|contest)(?: \((.+)\))?$/i, m => T("tqContest", m[1]) + (m[2] ? " · " + m[2] : "")],
  [/^Awarded to (?:the )?winners(?: and runners up)? of the (.+?)(?: build| video)? (?:competition|contest)(?: \((.+)\))?$/i,
    m => T("tqContestWin", m[1]) + (m[2] ? " · " + m[2] : "")],
  [/^Obtained by Nitro Boosting/i, () => T("tqBoost")],
  [/^It's a secret!?$/i, () => T("tqSecret")],
  [/^Awarded for contributing to the improvement of The Hive's translations$/i, () => T("tqTranslator")],
  [/^Obtained by having your artwork or video featured on The Buzz$/i, () => T("tqFeatured")],
  [/^Obtained by collecting the FREE (.+?) from the Hive Store$/i, m => T("tqFree", itemRu(m[1]))],
  [/^Obtained by talking to (.+?) during (.+)$/i, m => T("tqTalk", m[1]) + " · " + m[2]],
  [/^(?:Awarded for completing|Obtained by completing) (.+)$/i, m => T("tqComplete", m[1].replace(/^the /i, ""))]
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MON_RU = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const MON_RU_G = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const SEASON_RU = { Summer:"лето", Winter:"зима", Spring:"весна", Autumn:"осень", Fall:"осень", Halloween:"Хэллоуин" };
function ruDates(str){
  const mi = n => MONTHS.indexOf(n[0].toUpperCase() + n.slice(1).toLowerCase());
  return str
    .replace(/(\d{1,2})(?:st|nd|rd|th)?(?: of)? (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/gi,
      (m, d, mon, y) => d + " " + MON_RU_G[mi(mon)] + " " + y)
    .replace(/(до )(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/gi,
      (m, pre, mon, y) => pre + MON_RU_G[mi(mon)] + " " + y)
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/gi,
      (m, mon, y) => MON_RU[mi(mon)] + " " + y)
    .replace(/\b(Summer|Winter|Spring|Autumn|Fall|Halloween) (\d{4})/g, (m, w, y) => SEASON_RU[w] + " " + y);
}
function infoText(e){
  const d = e.d.replace(/\s+/g, " ").replace(/\s*\.$/, "").trim();
  const gone = e.o ? GONE : "";
  let m;
  if((m = /^Awarded for reaching level (\d+)$/i.exec(d)) && e.g) return T("tqLevel", m[1], e.g) + gone;
  if((m = /^Awarded for reaching Prestige ([IVX]+)(?: in (.+))?$/i.exec(d))) return T("tqPrestige", m[1], m[2] || e.g) + gone;
  if(L === "ru") for(const [re, f] of INFO_RU){ const mm = re.exec(d); if(mm) return ruDates(f(mm)) + gone; }
  return d + gone;
}
async function loadTitleInfo(){
  if(TINFO) return TINFO;
  if(!tinfoP) tinfoP = (async () => {
    try{
      const c = JSON.parse(localStorage.getItem(TINFO_KEY) || "null");
      if(c && Date.now() - c.t < 86400000 && Array.isArray(c.d) && c.d.length) return (TINFO = indexInfo(c.d));
    }catch(e){}
    noteRequest();
    const r = await fetch(PROXY + encodeURIComponent(SUPPORT_TITLES), { cache:"no-store" });
    if(!r.ok) throw new Error(httpMsg(r.status));
    const list = parseSupportTitles(await r.text());
    if(list.length < 50) throw new Error("parse");
    try{ localStorage.setItem(TINFO_KEY, JSON.stringify({ t:Date.now(), d:list })); }catch(e){}
    return (TINFO = indexInfo(list));
  })();
  try{ return await tinfoP; } finally { tinfoP = null; }
}
function loadTqData(){
  if(tqData) return Promise.resolve(tqData);
  if(!tqDataP) tqDataP = (async () => {
    let cat = null, meta = null, info = null;
    try{ info = await loadTitleInfo(); }catch(e){}
    try{ cat = await loadTitleCatalogue(); }catch(e){}
    try{ meta = await loadTitleMeta(); }catch(e){}
    const d = { cat, meta, info };
    if(info || cat || (meta && meta.byExact.size)) tqData = d;
    return d;
  })().finally(() => { tqDataP = null; });
  return tqDataP;
}
function howFor(d, t, u){
  const inf = d.info && infoFor(d.info, t);
  if(inf) return infoText(inf);
  const ex = exactTitle(t), lo = looseTitle(t);
  const e = d.cat && ((u && d.cat.byU.get(u)) || d.cat.byExact.get(ex) || d.cat.byLoose.get(lo));
  if(e && e.x && e.x.type) return titleHow(e);
  const m = d.meta && (d.meta.byExact.get(ex) || d.meta.byLoose.get(lo));
  return m ? T("tqLevel", m.l, NAME(m.g)) : null;
}
async function markTq(root){
  const btns = [...(root || document).querySelectorAll(".tq:not(.ok)")];
  if(!btns.length) return;
  const d = await loadTqData();
  btns.forEach(b => {
    if(!b.isConnected) return;
    const h = howFor(d, b.dataset.t, b.dataset.u);
    if(h){ b.dataset.how = h; b.classList.add("ok"); } else b.remove();
  });
}
let tqPop = null;
function closeTq(){ if(tqPop){ tqPop.remove(); tqPop = null; } }
async function openTq(btn){
  closeTq();
  const pop = document.createElement("div");
  pop.className = "tqpop"; pop.__btn = btn; pop.__t = performance.now();
  const setText = t => {
    const [main, gone] = String(t).split(GONE);
    pop.innerHTML = "<b>" + esc(T("tqHead")) + "</b><span>" + esc(main) + "</span>" +
      (gone !== undefined ? '<small class="tg">' + esc(T("tqGoneLine")) + "</small>" : "");
  };
  setText(T("tqLoading"));
  document.body.append(pop); tqPop = pop;
  const place = () => {
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const vw = Math.min(document.documentElement.clientWidth,
      window.visualViewport ? visualViewport.width : Infinity);
    const left = Math.min(Math.max(10, r.right + 4 - w), vw - w - 10);
    let top = r.top - h - 10, below = false;
    if(top < 8){ top = r.bottom + 10; below = true; }
    pop.style.left = left + "px"; pop.style.top = top + "px";
    pop.style.setProperty("--ax", (r.left + r.width / 2 - left) + "px");
    pop.classList.toggle("below", below);
  };
  place();
  try{
    const h = btn.dataset.how || howFor(await loadTqData(), btn.dataset.t, btn.dataset.u);
    if(tqPop !== pop) return;
    setText(h || T("tqNone"));
  }catch(err){ if(tqPop === pop) setText(err.message); }
  if(tqPop === pop) place();
}
const RARITY = { common:["Обычный","Common","#c3bcd0"], uncommon:["Необычный","Uncommon","#55ff55"],
  rare:["Редкий","Rare","#5fa8ff"], epic:["Эпический","Epic","#c77dff"], legendary:["Легендарный","Legendary","#ffc02e"],
  mythic:["Мифический","Mythic","#ff6b8a"], mythical:["Мифический","Mythic","#ff6b8a"],
  special:["Особый","Special","#ff9f43"], exclusive:["Эксклюзивный","Exclusive","#ff9f43"] };
const HOVER = matchMedia("(hover: hover) and (pointer: fine)").matches;
function openItemTip(el){
  closeTq();
  const name = el.dataset.tn; if(!name) return;
  const rk = String(el.dataset.tr || "").toLowerCase().replace(/[^a-z]/g, "");
  const r = RARITY[rk];
  const pop = document.createElement("div");
  pop.className = "tqpop itip"; pop.__btn = el; pop.__t = performance.now();
  pop.innerHTML = '<b class="tn">' + esc(name) + "</b>" + (rk ? '<span class="rr" style="color:' +
    (r ? r[2] : "var(--soft)") + '">' + esc(r ? r[L === "ru" ? 0 : 1] : pretty(el.dataset.tr)) + "</span>" : "");
  document.body.append(pop); tqPop = pop;
  const rc = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const vw = Math.min(document.documentElement.clientWidth, window.visualViewport ? visualViewport.width : Infinity);
  const left = Math.min(Math.max(10, rc.left + rc.width / 2 - w / 2), vw - w - 10);
  let top = rc.top - h - 10, below = false;
  if(top < 8){ top = rc.bottom + 10; below = true; }
  pop.style.left = left + "px"; pop.style.top = top + "px";
  pop.style.setProperty("--ax", (rc.left + rc.width / 2 - left) + "px");
  pop.classList.toggle("below", below);
}
if(HOVER){
  document.addEventListener("mouseover", e => {
    const it = e.target.closest && e.target.closest(".it[data-tn]");
    if(it && (!tqPop || tqPop.__btn !== it)) openItemTip(it);
  });
  document.addEventListener("mouseout", e => {
    const it = e.target.closest && e.target.closest(".it[data-tn]");
    if(it && tqPop && tqPop.__btn === it && !it.contains(e.relatedTarget)) closeTq();
  });
}
document.addEventListener("click", e => {
  const it = !HOVER && e.target.closest && e.target.closest(".it[data-tn]");
  if(it){ if(tqPop && tqPop.__btn === it) closeTq(); else openItemTip(it); return; }
  const b = e.target.closest && e.target.closest(".tq");
  if(b){
    e.stopPropagation();
    if(tqPop && tqPop.__btn === b) closeTq(); else openTq(b);
    return;
  }
  if(tqPop && !(e.target.closest && e.target.closest(".tqpop")) &&
     !(tqPop.__btn && tqPop.__btn.contains(e.target))) closeTq();
}, true);
addEventListener("scroll", () => {
  if(tqPop && performance.now() - tqPop.__t > 300) closeTq();
}, true);
addEventListener("resize", closeTq);
