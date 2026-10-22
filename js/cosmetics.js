"use strict";

function cosGroups(src){
  const g = {}, set = (b, kind, v) => { (g[b] = g[b] || {})[kind] = v; };
  const main = Object.assign({}, src);
  for(const box of ["cosmetics","appearance","equipped","unlocked","collection"]){
    if(src[box] && typeof src[box] === "object" && !Array.isArray(src[box]))
      for(const k of Object.keys(src[box])){
        const key = /^(equipped|unlocked)$/.test(box) ? k + "_" + box : k;
        if(!(key in main)) main[key] = src[box][k];
      }
  }
  for(const k of Object.keys(main)){
    let m;
    if((m = k.match(/^cosmetics\.(.+)$/))) set(m[1], "un", main[k]);
    else if((m = k.match(/^(.+)_equipped$/))) set(m[1], "eq", main[k]);
    else if((m = k.match(/^equipped_(.+)$/))) set(m[1], "eq", main[k]);
    else if((m = k.match(/^(.+)_unlocked$/))) set(m[1], "un", main[k]);
    else if((m = k.match(/^unlocked_(.+)$/))) set(m[1], "un", main[k]);
    else if((m = k.match(/^(.+?)_(?:count|owned|total)$/)) && COS_WORDS.test(m[1]))
      set(m[1].replace(/s$/,""), "un", main[k]);
    else if(COS_WORDS.test(k)){
      const base = k.replace(/s$/,"");
      const v = main[k];
      if(Array.isArray(v) || typeof v === "number") set(base, "un", v);
      else if(typeof v === "string" || (v && typeof v === "object")) set(base, "eq", v);
    }
  }
  return g;
}
const cosName = v => v === null || v === undefined || v === "" ? null
  : (typeof v === "object" ? (pick(v, "display", "name", "human_name", "title", "id", "index") ?? null) : v);
const cosIcon = v => { if(v && typeof v === "object"){
  const u = pick(v, "url", "icon", "image"); if(typeof u === "string" && /^https?:/.test(u)) return u; } return null; };
const cosCount = v => typeof v === "number" ? v : Array.isArray(v) ? v.length
  : (v && typeof v === "object" ? Object.keys(v).length : null);
const itemsNewFirst = v => { const a = itemsOf(v); return a ? a.slice().reverse() : null; };
function itemsOf(v){
  if(Array.isArray(v)) return v;
  if(v && typeof v === "object" && !("name" in v)) return Object.values(v);
  return null;
}
const LIST_KIND = b => /title/.test(b);
/* Costume pictures are official Hive renders on cdn.playhive.com/avatars/costume/<id>.png.
   The API does not say which picture belongs to which costume, but Hive's own support page
   lists every costume with its picture, so the site reads that page once a day and matches by name. */
const COSTUME_KEY = "hive.tracker.costumeicons.v8";
const costumeNorm = s => String(s || "").replace(/[§&][0-9a-z]/gi, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
let COSTUMES = null, costumeP = null;
try{
  const c = JSON.parse(localStorage.getItem(COSTUME_KEY) || localStorage.getItem("hive.tracker.costumeicons.v2") || "null");
  if(c && c.d) COSTUMES = c;
}catch(e){}
let costumeLog = null;
let costumeTried = +(localStorage.getItem(COSTUME_KEY + ".try") || 0);
// costume pictures are big and slow from Hive: they go through our worker, which marks them as never
// changing (the file name is the costume's UUID), so the browser keeps them and later visits are instant
// a picture that fails through the worker is tried once straight from Hive before falling back to the letter
function imgFail(img){
  const src = img.getAttribute("src") || "";
  const m = src.startsWith(PROXY) && decodeURIComponent(src.slice(PROXY.length));
  if(m && !img.dataset.tried){ img.dataset.tried = "1"; img.src = m; return; }
  const em = document.createElement("em");
  em.textContent = img.dataset.l || "?";
  img.replaceWith(em);
}
const costumeSrc = u => u && /^https:\/\/(cdn|costume-avatar)\.playhive\.com\/.+\/?[0-9a-f-]{36}\.png$/i.test(u) ? PROXY + encodeURIComponent(u) : u;
function costumeIcon(it){
  const name = typeof it === "string" ? it : it && (it.name || it.human_name);
  const id = it && typeof it === "object" ? String(it.UUID || it.uuid || it.id || "") : "";
  if(COSTUMES && name && COSTUMES.d[costumeNorm(name)]) return costumeSrc(COSTUMES.d[costumeNorm(name)]);
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return costumeSrc("https://cdn.playhive.com/avatars/costume/" + id.toLowerCase() + ".png");
  return null;
}
// how a costume is obtained, in the same words as hub titles
// the support page's usual phrases, in Russian
function costumeRu(t){
  const month = m => { const d = new Date(m + " 1"); return isNaN(d) ? m :
    d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(/\s*г\.?$/, ""); };
  let m;
  if(/^can be purchased from the hive store$/i.test(t)) return "Покупка в магазине Hive";
  if((m = t.match(/^could be purchased from the quest store during (.+)$/i))) return "Был в магазине квестов: " + month(m[1]);
  if((m = t.match(/^can be purchased from the quest store(?: during (.+))?$/i))) return "Магазин квестов" + (m[1] ? ": " + month(m[1]) : "");
  if((m = t.match(/^could be purchased from the hive store during (.+)$/i))) return "Был в магазине Hive: " + month(m[1]);
  if((m = t.match(/^(?:awarded|unlocked) (?:at|for reaching) level (\d+) in ([\w ]+)$/i))) return "Уровень " + m[1] + " в " + m[2];
  if((m = t.match(/^included (?:in|with) (?:the )?(.+?)(?: bundle)?$/i))) return "Входит в набор «" + m[1] + "»";
  if(/^subscribe to our (?:blog )?newsletter$/i.test(t)) return "Подписка на рассылку Hive";
  return null;
}
function costumeHow(name){
  const k = costumeNorm(name);
  // Hive's support page says it best (with the QP price, the store, the month); translated like hub titles
  const sup = COSTUMES && COSTUMES.s && COSTUMES.s[k];
  if(sup){
    const price = (sup.match(/^\s*([\d,.]+\s*(?:QP|Tokens?|Coins?|Minecoins?))\s*/i) || [])[1];
    const body = price ? sup.slice(sup.indexOf(price) + price.length).trim() : sup;
    let text = body.replace(/\s*\.$/, "");
    const ru = L === "ru" ? costumeRu(text) : null;
    if(ru) return (price ? price + " · " : "") + ru;
    if(L === "ru" && typeof infoText === "function"){
      const tr = String(infoText({ d: body, g: "", o: 0 }));
      const [main, gone] = tr.split("\u0001");
      text = main + (gone !== undefined ? " · " + T("tqGoneLine") : "");
    }
    return (price ? price + " · " : "") + text;
  }
  const x = COSTUMES && COSTUMES.h && COSTUMES.h[k];
  if(!x || typeof titleHow !== "function") return "";
  let text = String(titleHow({ x }));
  const desc = x.metadata && x.metadata.description;
  if(desc && typeof infoText === "function"){
    const ru = String(infoText({ d: desc, g: "", o: 0 }));
    if(ru && ru !== desc) text = text.replace(desc, ru);
  }
  const [main, gone] = text.split("\u0001");
  return main + (gone !== undefined ? " · " + T("tqGoneLine") : "");
}
function loadCostumeIcons(){
  if(COSTUMES && Date.now() - COSTUMES.t < 3 * 86400000 && COSTUMES.full) return Promise.resolve(false);
  // with nothing known yet a failed load is retried within minutes; otherwise at most once an hour
  const known = COSTUMES && Object.keys(COSTUMES.d || {}).length;
  if(Date.now() - costumeTried < (known ? 60 * 60 * 1000 : 2 * 60 * 1000)) return Promise.resolve(false);
  if(costumeP) return costumeP;
  costumeTried = Date.now();
  try{ localStorage.setItem(COSTUME_KEY + ".try", String(costumeTried)); }catch(e){}
  costumeP = (async () => {
    // both sources are merged: the API catalogue (with how each costume is obtained) and Hive's support page,
    // which also lists the newest costumes the catalogue does not have yet
    const why = {};
    const [cat, sup] = await Promise.all([
      costumesFromCatalogue().catch(e => { why.cat = String(e && e.message || e); return null; }),
      costumesFromSupport().catch(e => { why.sup = String(e && e.message || e); return null; })]);
    costumeLog = { t: Date.now(), cat: cat ? Object.keys(cat.d).length : 0, sup: sup ? Object.keys(sup.d).length : 0, why };
    const d = Object.assign({}, COSTUMES && COSTUMES.d, sup ? sup.d : {}, cat ? cat.d : {});
    const h = Object.assign({}, COSTUMES && COSTUMES.h, cat ? cat.h : {});
    const s = Object.assign({}, COSTUMES && COSTUMES.s, sup ? sup.info : {});
    if(Object.keys(d).length < 40) return false;
    COSTUMES = { t: Date.now(), d, h, s, full: !!(cat && sup) };
    try{ localStorage.setItem(COSTUME_KEY, JSON.stringify(COSTUMES)); }catch(e){}
    return true;
  })().finally(() => { costumeP = null; });
  return costumeP;
}
const COSTUME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function costumesFromCatalogue(){
  const d = {}, h = {};
  for(let off = 0, guard = 0; guard < 20; off += 50, guard++){
    const r = await hiveFetch(API + "/catalogue/costumes?limit=50&offset=" + off, { cache: "no-store", headers: HIVE_HEADERS });
    if(!r.ok){ if(!off) throw new Error("HTTP " + r.status); break; }
    let list = await r.json();
    if(!Array.isArray(list)) list = (list && typeof list === "object" && Object.values(list).find(Array.isArray)) || [];
    list.forEach(v => {
      if(!v || typeof v !== "object") return;
      const name = [v.display, v.name, v.title].find(x => typeof x === "string" && x);
      const id = [v.UUID, v.uuid, v.id].find(x => typeof x === "string" && COSTUME_UUID.test(x));
      if(!name || !id) return;
      const k = costumeNorm(name);
      d[k] = "https://cdn.playhive.com/avatars/costume/" + id.toLowerCase() + ".png";
      const ud = v.unlock_data;
      if(ud && ud.type) h[k] = { type: ud.type, active: ud.active, metadata: ud.metadata, offer: ud.store_offer && ud.store_offer.name };
    });
    if(list.length < 50) break;
  }
  return Object.keys(d).length ? { d, h } : null;
}
async function costumesFromSupport(){
  const r = await fetch(PROXY + encodeURIComponent("https://support.playhive.com/costumes/"), { cache: "no-store" });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const html = await r.text();
  const d = {}, info = {};
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let cur = null;
  for(let n = walker.nextNode(); n; n = walker.nextNode()){
    if(n.tagName === "IMG"){
      // some costumes use a picture from Hive's own site instead of the avatar CDN
      let src = n.getAttribute("src") || n.getAttribute("data-src") || (n.getAttribute("srcset") || "").split(/[\s,]+/)[0] || "";
      if(src.startsWith("//")) src = "https:" + src;
      else if(src.startsWith("/")) src = "https://support.playhive.com" + src;
      // pictures live on several Hive hosts (cdn.playhive.com, costume-avatar.playhive.com, the support site)
      if(!/^https:\/\/([a-z0-9-]+\.)*playhive\.com\/.+\.(png|webp|jpe?g)(\?.*)?$/i.test(src) || /logo|favicon|\/icons?\//i.test(src)){ continue; }
      cur = src;
      if(n.alt && n.alt.length < 60) d[costumeNorm(n.alt)] = cur;
    }else if(cur && /^(STRONG|B|H3|H4)$/.test(n.tagName)){
      const k = costumeNorm(n.textContent);
      if(k && !d[k]) d[k] = cur;
      const box = n.parentElement;
      if(k && box){
        const text = box.textContent.replace(n.textContent, "").replace(/\s+/g, " ").trim();
        if(text && text.length < 300) info[k] = text;
      }
      cur = null;
    }
  }
  const raw = html.replace(/\\\//g, "/").replace(/&quot;/g, '"');
  const rx = /"(?:name|title|alt|display)"\s*:\s*"([^"]{1,60})"[^{}]{0,400}?avatars\/costume\/([0-9a-f-]{36})\.png|avatars\/costume\/([0-9a-f-]{36})\.png[^{}]{0,400}?"(?:name|title|alt|display)"\s*:\s*"([^"]{1,60})"/gi;
  let m;
  while((m = rx.exec(raw))){
    const k = costumeNorm(m[1] || m[4]);
    if(k && !d[k]) d[k] = "https://cdn.playhive.com/avatars/costume/" + (m[2] || m[3]).toLowerCase() + ".png";
  }
  return Object.keys(d).length ? { d, info } : null;
}
const LIMIT = b => LIST_KIND(b) ? 5 : 12;
function edition(it){
  if(!it || typeof it !== "object") return null;
  const n = +it.edition, t = +(it.editional_total || it.edition_total);
  return n > 0 ? { n, t: t > 0 ? t : 0 } : null;
}
const edLabel = e => "№ " + nf(e.n) + (e.t ? " / " + nf(e.t) : "");
function itemHTML(base, it){
  const name = typeof it === "string" ? it : (pick(it, "name", "human_name", "id") || "");
  const id = typeof it === "string" ? it : (pick(it, "id", "index", "name") || "");
  const url = cosIcon(it) || (base === "costume" ? costumeIcon(it) : null) || (base === "costume" ? null : iconUrl(base, String(id)));
  const first = String(name).replace(/[§&][0-9a-z]/gi,"").trim().charAt(0).toUpperCase() || "?";
  if(/^\[?placeholder\]?$/i.test(String(name).trim())) return "";
  const clean = String(name).replace(/[§&][0-9a-z]/gi,"").trim();
  const rar = it && typeof it === "object" ? (pick(it, "rarity", "rarity_name") || "") : "";
  const ed = edition(it);
  const how = base === "costume" ? costumeHow(clean) : "";
  return '<div class="it' + (ed ? " ltd" : "") + '"' + (base === "costume" ? ' data-cos-tile="1"' : "") + ' data-tn="' + esc(clean) + '"' + (ed ? ' data-ed="' + esc(edLabel(ed)) + '"' : "") +
    (how ? ' data-how="' + esc(how) + '"' : "") + ' data-tr="' + esc(String(rar)) + '"><div class="box">' +
    (url ? '<img alt="" loading="lazy" decoding="async" src="' + esc(url) + '" data-l="' + esc(first) + '" onerror="imgFail(this)">'
         : "<em>" + esc(first) + "</em>") +
    "</div>" + (ed ? '<i class="edb">' + esc("№" + nf(ed.n)) + "</i>" : "") + "</div>";
}
function rowsHTML(base, arr){
  const withHow = /title/.test(base);
  return '<div class="tlist">' + arr.map(it => {
    const n = typeof it === "string" ? it : (pick(it, "display", "name", "id") || "");
    const u = it && typeof it === "object" ? (pick(it, "UUID", "uuid") || "") : "";
    const body = titleIcon(it) + (hasMC(n) ? mcText(n) : esc(nice(n)));
    return withHow
      ? '<div class="trow"><span class="tt">' + body + '</span><button type="button" class="tq" data-t="' +
        esc(n) + '" data-u="' + esc(u) + '" aria-label="?">?</button></div>'
      : "<div>" + body + "</div>";
  }).join("") + "</div>";
}
function listHTML(base, arr){
  const part = arr.slice(0, LIMIT(base));
  return LIST_KIND(base) ? rowsHTML(base, part)
    : '<div class="grid">' + part.map(it => itemHTML(base, it)).join("") + "</div>";
}
function openCos(base, arr, from){
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(cosLabelN(base, arr.length)) +
    " · " + arr.length +
    '</h3><button class="close">' + esc(T("close")) + '</button></div><div class="mbody"></div></div>';
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
  if(base === "costume"){
    const known = COSTUMES ? Object.keys(COSTUMES.d || {}).length : 0;
    const missing = arr.filter(it => !costumeIcon(it)).length;
    if(missing){
      const l = costumeLog, why = l ? Object.entries(l.why).map(([k, v]) => k + ": " + v).join(", ") : "";
      const line = T("cosStatus", nf(known), nf(missing)) +
        (l ? " · " + T("cosStatusLast", nf(l.cat), nf(l.sup)) + (why ? " · " + why : "") : " · " + T("cosStatusNone"));
      m.querySelector(".mhead").insertAdjacentHTML("afterend", '<p class="sub cosstat">' + esc(line) + "</p>");
    }
  }
  const list = LIST_KIND(base);
  const piece = part => list ? rowsHTML(base, part).replace(/^<div class="tlist">|<\/div>$/g, "")
                             : part.map(it => itemHTML(base, it)).join("");
  setTimeout(() => {
    const box = m.querySelector(".mbody");
    if(!box || !m.isConnected) return;
    box.innerHTML = '<div class="card"><div class="' + (list ? "tlist" : "grid") + '"></div></div>';
    const holder = box.querySelector(".tlist, .grid");
    let i = 0;
    const FIRST = list ? 30 : 36, STEP = list ? 60 : 72;
    const put = n => { holder.insertAdjacentHTML("beforeend", piece(arr.slice(i, i + n))); i += n; };
    put(FIRST);
    const inner = m.querySelector(".inner");
    const bottom = () => Math.min(innerHeight, inner ? inner.getBoundingClientRect().bottom : innerHeight);
    while(i < arr.length && holder.lastElementChild && holder.lastElementChild.getBoundingClientRect().top < bottom()) put(STEP);
    staggerIn(holder.children, 30);
    markTq(holder);
    const more = () => {
      if(!m.isConnected || i >= arr.length) return;
      const from = holder.children.length;
      put(STEP);
      staggerIn([...holder.children].slice(from), 30);   // only animates what happens to be on screen
      markTq(holder);
      if(i < arr.length) (window.requestIdleCallback || (f => setTimeout(f, 16)))(more, { timeout: 120 });
    };
    if(i < arr.length) (window.requestIdleCallback || (f => setTimeout(f, 16)))(more, { timeout: 120 });
  }, 30);
}
function fmtTicks(t){
  const ms = Math.round(t * 50), m = Math.floor(ms / 60000), sec = Math.floor(ms % 60000 / 1000);
  return (m ? m + ":" + String(sec).padStart(2, "0") : sec) + "." + String(ms % 1000).padStart(3, "0");
}
const PK_ORDER = ["rooftops", "jungle", "city", "volcano"];
const PK_OPEN = new Set();
document.addEventListener("click", e => {
  const h = e.target.closest && e.target.closest(".pkw > .pkh");
  if(!h) return;
  const w = h.parentElement, open = !w.classList.contains("open");
  w.classList.toggle("open", open);
  h.setAttribute("aria-expanded", open);
  if(open) PK_OPEN.add(w.dataset.w); else PK_OPEN.delete(w.dataset.w);
});
function parkourHTML(pk){
  const P = pk && pk.parkours;
  if(!P || typeof P !== "object") return "";
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const rank = k => { const i = PK_ORDER.indexOf(String(k).toLowerCase()); return i < 0 ? 99 : i; };
  const worlds = Object.entries(P).filter(([, v]) => isObj(v))
    .sort((a, b) => rank(a[0]) - rank(b[0]) || String(a[0]).localeCompare(String(b[0])));
  let done = 0;
  const rows = worlds.map(([wk, w]) => {
    const list = Object.entries(w).filter(([, v]) => isObj(v)).map(([ck, c]) => {
      const t = typeof c.best_run_time === "number" && c.best_run_time > 0 ? c.best_run_time : null;
      if(t) done++;
      const stars = typeof c.course_stars === "number" ? c.course_stars
        : Array.isArray(c.collected_stars) ? c.collected_stars.length : 0;
      return '<div class="pkc"><span>' + esc(pretty(ck)) + '</span><span class="pks">★ ' + nf(stars) +
        "</span><b>" + (t ? fmtTicks(t) : "—") + "</b></div>";
    }).join("");
    const open = PK_OPEN.has(wk);
    return '<div class="pkw' + (open ? " open" : "") + '" data-w="' + esc(wk) + '">' +
      '<button type="button" class="pkh" aria-expanded="' + open + '"><span>' + esc(pretty(wk)) +
      '</span><span class="pks">★ ' + nf(+w.parkour_stars || 0) + '</span><i aria-hidden="true">›</i></button>' +
      '<div class="pkb"><div>' + list + "</div></div></div>";
  }).join("");
  const total = typeof P.total_stars === "number" ? P.total_stars
    : worlds.reduce((a, [, w]) => a + (+w.parkour_stars || 0), 0);
  if(!worlds.length && !total) return "";
  return '<div class="card"><h3>Parkour Worlds</h3>' +
    tilesHTML([{ k: T("pkStars"), v: nf(total), d: "" }, { k: T("pkDone"), v: nf(done), d: "" }]) +
    (rows ? '<div class="pkl">' + rows + "</div>" : "") + "</div>";
}
function cosmeticsHTML(main, extra){
  if(main && (main.costume_unlocked || main.equipped_costume || main.costume_count))
    loadCostumeIcons().then(fresh => { if(fresh) fillCostumeTiles(); });
  const g = cosGroups(main), keys = Object.keys(g);
  if(!keys.length) return "";
  const ordered = keys.slice().sort((x,y) => {
    const ix = COS_ORDER.indexOf(x), iy = COS_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  const counts = ordered.map(k => ({ k, v:cosCount(g[k].un) }))
    .filter(t => t.v !== null).map(t => ({ k:cosLabelN(t.k, t.v), v:nf(t.v), d:"" }));
  const worn = ordered.filter(k => "eq" in g[k]).map(k => {
    const n = cosName(g[k].eq), icon = cosIcon(g[k].eq) || (k === "costume" ? costumeIcon(g[k].eq) : null);
    return '<div class="cos"><span>' + esc(cosLabel(k)) + "</span><b>" +
      (icon ? '<span class="ciw"><span><img alt="" loading="lazy" decoding="async" src="' + esc(icon) +
        '" onerror="this.closest(\'.ciw\').remove()"></span></span>' : "") +
      '<span class="cv">' +
      (n === null ? esc(T("notWorn")) : hasMC(n) ? mcText(n) : esc(nice(n))) +
      (edition(g[k].eq) ? '<i class="edp">' + esc(edLabel(edition(g[k].eq))) + "</i>" : "") +
      "</span></b></div>";
  }).join("");
  let out = '<div class="card">';
  if(counts.length) out += "<h3>" + esc(T("cosOpen")) + "</h3>" + tilesHTML(counts);
  if(worn) out += '<h3 style="margin-top:18px">' + esc(T("cosWorn")) + "</h3>" + worn;
  out += "</div>";
  out += extra || "";

  ordered.forEach(k => {
    const arr = itemsNewFirst(g[k].un);
    if(!arr || !arr.length) return;
    out += '<div class="card"><h3>' + esc(cosLabelN(k, arr.length)) + " · " + arr.length + "</h3>" +
      listHTML(k, arr) +
      (arr.length > LIMIT(k)
        ? '<button class="mini more" data-cos="' + esc(k) + '">' + esc(T("showAllCos")) + "</button>" : "") +
      "</div>";
  });
  window.__cos = g;
  return out;
}

// once the catalogue arrives, put pictures into the costume tiles already on screen instead of redrawing the page
function fillCostumeTiles(){
  document.querySelectorAll('.it[data-cos-tile] .box').forEach(box => {
    const it = box.parentElement, name = it.dataset.tn;
    if(box.querySelector("img")) return;
    const url = costumeIcon(name);
    if(url){
      const img = new Image();
      img.alt = ""; img.decoding = "async"; img.src = url;
      img.onload = () => { box.textContent = ""; box.append(img); };
      img.onerror = () => { if(!img.dataset.tried && url.startsWith(PROXY)){ img.dataset.tried = "1"; img.src = decodeURIComponent(url.slice(PROXY.length)); } };
    }
    const how = costumeHow(name);
    if(how && !it.dataset.how) it.dataset.how = how;
  });
}
