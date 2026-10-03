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
const LIST_KIND = b => /title|costume/.test(b);
const LIMIT = b => LIST_KIND(b) ? 5 : 12;
function itemHTML(base, it){
  const name = typeof it === "string" ? it : (pick(it, "name", "human_name", "id") || "");
  const id = typeof it === "string" ? it : (pick(it, "id", "index", "name") || "");
  const url = cosIcon(it) || iconUrl(base, String(id));
  const first = String(name).replace(/[§&][0-9a-z]/gi,"").trim().charAt(0).toUpperCase() || "?";
  if(/^\[?placeholder\]?$/i.test(String(name).trim())) return "";
  const clean = String(name).replace(/[§&][0-9a-z]/gi,"").trim();
  const rar = it && typeof it === "object" ? (pick(it, "rarity", "rarity_name") || "") : "";
  return '<div class="it" data-tn="' + esc(clean) + '" data-tr="' + esc(String(rar)) + '"><div class="box">' +
    (url ? '<img alt="" loading="lazy" decoding="async" src="' + esc(url) + '" onerror="this.replaceWith(Object.assign(' +
      'document.createElement(\'em\'),{textContent:' + JSON.stringify(first).replace(/"/g, "&quot;") + '}))">'
         : "<em>" + esc(first) + "</em>") +
    "</div></div>";
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
  requestAnimationFrame(() => {
    const box = m.querySelector(".mbody");
    if(!box) return;
    box.innerHTML = '<div class="card">' + (LIST_KIND(base) ? rowsHTML(base, arr)
      : '<div class="grid">' + arr.map(it => itemHTML(base, it)).join("") + "</div>") + "</div>";
    markTq(box);
  });
}
function fmtTicks(t){
  const ms = Math.round(t * 50), m = Math.floor(ms / 60000), sec = Math.floor(ms % 60000 / 1000);
  return (m ? m + ":" + String(sec).padStart(2, "0") : sec) + "." + String(ms % 1000).padStart(3, "0");
}
function parkourHTML(pk){
  const P = pk && pk.parkours;
  if(!P || typeof P !== "object") return "";
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const worlds = Object.entries(P).filter(([, v]) => isObj(v));
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
    return '<details class="pkw"><summary><span>' + esc(pretty(wk)) + '</span><span class="pks">★ ' +
      nf(+w.parkour_stars || 0) + "</span></summary>" + list + "</details>";
  }).join("");
  const total = typeof P.total_stars === "number" ? P.total_stars
    : worlds.reduce((a, [, w]) => a + (+w.parkour_stars || 0), 0);
  if(!worlds.length && !total) return "";
  return '<div class="card"><h3>Parkour Worlds</h3>' +
    tilesHTML([{ k: T("pkStars"), v: nf(total), d: "" }, { k: T("pkDone"), v: nf(done), d: "" }]) +
    (rows ? '<div class="pkl">' + rows + "</div>" : "") + "</div>";
}
function cosmeticsHTML(main, extra){
  const g = cosGroups(main), keys = Object.keys(g);
  if(!keys.length) return "";
  const ordered = keys.slice().sort((x,y) => {
    const ix = COS_ORDER.indexOf(x), iy = COS_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  const counts = ordered.map(k => ({ k, v:cosCount(g[k].un) }))
    .filter(t => t.v !== null).map(t => ({ k:cosLabelN(t.k, t.v), v:nf(t.v), d:"" }));
  const worn = ordered.filter(k => "eq" in g[k]).map(k => {
    const n = cosName(g[k].eq), icon = cosIcon(g[k].eq);
    return '<div class="cos"><span>' + esc(cosLabel(k)) + "</span><b>" +
      (icon ? '<span class="ciw"><span><img alt="" loading="lazy" decoding="async" src="' + esc(icon) +
        '" onerror="this.closest(\'.ciw\').remove()"></span></span>' : "") +
      '<span class="cv">' +
      (n === null ? esc(T("notWorn")) : hasMC(n) ? mcText(n) : esc(nice(n))) +
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
