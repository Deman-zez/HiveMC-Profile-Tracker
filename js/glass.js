"use strict";

/* Liquid glass: what is behind a glass piece is bent near its rounded rim, like looking through a thick lens.
   Chromium can run an SVG displacement filter on the backdrop; other browsers keep a plain frosted blur. */
const LG_OK = (() => {
  const ua = navigator.userAgent || "";
  return /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS|iPhone|iPad|Firefox/.test(ua) &&
    !!(window.CSS && CSS.supports("backdrop-filter", "url(#x)"));
})();
let lgSvg = null, lgSeq = 0;
const lgObs = typeof ResizeObserver === "function" ? new ResizeObserver(es => es.forEach(e => lgSoon(e.target))) : null;

function lgSdf(x, y, hw, hh, r){
  const qx = Math.abs(x) - (hw - r), qy = Math.abs(y) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function lgMap(w, h, r, band){
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"), data = ctx.createImageData(w, h), px = data.data;
  const hw = w / 2, hh = h / 2;
  band = Math.min(band, hh, hw);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const cx = x + .5 - hw, cy = y + .5 - hh, d = -lgSdf(cx, cy, hw, hh, r);
    let dx = 0, dy = 0;
    if(d >= 0 && d < band){
      const t = 1 - d / band, k = Math.sin(t * Math.PI / 2) ** 2.2;     // smooth lens falloff
      const gx = lgSdf(cx + 1, cy, hw, hh, r) - lgSdf(cx - 1, cy, hw, hh, r);
      const gy = lgSdf(cx, cy + 1, hw, hh, r) - lgSdf(cx, cy - 1, hw, hh, r);
      const gl = Math.hypot(gx, gy) || 1;
      dx = (gx / gl) * k; dy = (gy / gl) * k;
    }
    const i = (y * w + x) * 4;
    px[i] = 128 + dx * 127; px[i + 1] = 128 + dy * 127; px[i + 2] = 128; px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return cv.toDataURL();
}
function lgBuild(el){
  const o = el.__lg; if(!o || !el.isConnected) return;
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if(!w || !h) return;
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16, h / 2, w / 2);
  const key = w + "x" + h + "x" + r;
  if(key === o.key) return;
  o.key = key;
  o.filter.setAttribute("width", w); o.filter.setAttribute("height", h);
  o.img.setAttribute("width", w); o.img.setAttribute("height", h);
  o.img.setAttribute("href", lgMap(w, h, r, o.band));
  el.classList.add("refract");
}
function lgSoon(el){
  const o = el.__lg; if(!o) return;
  clearTimeout(o.t);
  o.t = setTimeout(() => lgBuild(el), o.key ? 160 : 0);
}
function lgAttach(el, opt){
  if(!LG_OK || !el || el.__lg) return;
  if(!lgSvg){
    lgSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    lgSvg.setAttribute("aria-hidden", "true");
    lgSvg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.append(lgSvg);
  }
  const id = "lg" + (++lgSeq);
  const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  f.setAttribute("id", id);
  f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("primitiveUnits", "userSpaceOnUse");
  f.setAttribute("color-interpolation-filters", "sRGB");
  f.setAttribute("x", "0"); f.setAttribute("y", "0");
  const s = opt.scale || 30, dm = (k, res) => '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (s * k).toFixed(1) +
    '" xChannelSelector="R" yChannelSelector="G" result="' + res + '"/>';
  f.innerHTML = '<feImage x="0" y="0" preserveAspectRatio="none" result="map"/>' + (opt.disp
    ? dm(1.09, "dr") + '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
      dm(1, "dg") + '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>' +
      dm(.91, "db") + '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>' +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>'
    : dm(1, "out"));
  lgSvg.append(f);
  el.__lg = { filter: f, img: f.querySelector("feImage"), band: opt.band || 18, key: "", t: 0 };
  el.style.setProperty("--lgf", "url(#" + id + ")");
  if(lgObs) lgObs.observe(el);
  lgSoon(el);
  // drop the filter when the element leaves the page
  const mo = new MutationObserver(() => {
    if(el.isConnected) return;
    mo.disconnect(); if(lgObs) lgObs.unobserve(el); f.remove();
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

/* ---- living light, touch glow, adaptive tint ---- */
const LG_ELS = new Set(), LG_ADAPT = new Set();
const lgFine = matchMedia("(hover: hover) and (pointer: fine)");
let lgLX = 18, lgLY = 0, lgTilt = null, lgRaf = 0;
function lgCalm(){ return (typeof state === "object" && state.lite) || matchMedia("(prefers-reduced-motion: reduce)").matches; }
function lgDecor(el, adapt){
  if(!el) return;
  if(adapt) LG_ADAPT.add(el);
  if(el.__lgd) return;
  el.__lgd = 1;
  el.classList.add("lgl");
  el.insertAdjacentHTML("beforeend", '<span class="lgGlow" aria-hidden="true"></span><span class="lgRim" aria-hidden="true"></span>');
  LG_ELS.add(el);
  el.addEventListener("pointerdown", e => {
    if(lgCalm()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", (e.clientX - r.left).toFixed(0) + "px");
    el.style.setProperty("--ty", (e.clientY - r.top).toFixed(0) + "px");
    el.classList.remove("lit"); void el.offsetWidth; el.classList.add("lit");
    setTimeout(() => el.classList.remove("lit"), 140);
  }, { passive: true });
  el.addEventListener("pointermove", e => {
    if(!lgFine.matches || lgCalm()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", (e.clientX - r.left).toFixed(0) + "px");
    el.style.setProperty("--ty", (e.clientY - r.top).toFixed(0) + "px");
    el.classList.add("hov");
  }, { passive: true });
  el.addEventListener("pointerleave", () => el.classList.remove("hov"));
  lgLight();
}
// the rim highlight follows a light source: phone tilt, the mouse on a computer, a slow drift while scrolling
function lgLight(){
  if(lgRaf) return;
  lgRaf = requestAnimationFrame(() => {
    lgRaf = 0;
    let x = lgLX, y = lgLY;
    if(!lgFine.matches) x += Math.sin(scrollY / 420) * 14;
    LG_ELS.forEach(el => {
      if(!el.isConnected){ LG_ELS.delete(el); return; }
      el.style.setProperty("--lgx", x.toFixed(1) + "%");
      el.style.setProperty("--lgy", y.toFixed(1) + "%");
    });
  });
}
addEventListener("scroll", () => { if(!lgFine.matches) lgLight(); lgAdaptSoon(); }, { passive: true });
addEventListener("pointermove", e => {
  if(!lgFine.matches || lgCalm()) return;
  lgLX = e.clientX / innerWidth * 100;
  lgLY = Math.max(-20, e.clientY / innerHeight * 100 - 40);
  lgLight();
}, { passive: true });
if(!/iPhone|iPad/.test(navigator.userAgent)) addEventListener("deviceorientation", e => {
  if(e.gamma === null || lgCalm()) return;
  lgTilt = e;
  lgLX = 50 + Math.max(-45, Math.min(45, e.gamma)) * 1.3;
  lgLY = Math.max(-30, Math.min(80, (e.beta - 45) * 1.4));
  lgLight();
}, { passive: true });

// tint: darker over bright content (the gold button, avatars) so text on the glass stays readable
const lum = c => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || "");
  if(!m) return null;
  const a = m[4] === undefined ? 1 : +m[4];
  if(a < .05) return null;
  const l = (.2126 * m[1] + .7152 * m[2] + .0722 * m[3]) / 255;
  return { l, a };
};
function lgSampleUnder(el){
  const r = el.getBoundingClientRect();
  if(!r.width || r.bottom < 0 || r.top > innerHeight) return null;
  let sum = 0, n = 0;
  for(let i = 1; i <= 5; i++){
    const x = r.left + r.width * i / 6, y = r.top + r.height / 2;
    let l = .06;
    for(const u of document.elementsFromPoint(x, y)){
      if(el.contains(u) || u === document.body || u === document.documentElement) continue;
      if(u.tagName === "IMG"){ l = .6; break; }
      const cs = getComputedStyle(u), c = lum(cs.backgroundColor);
      if(c && c.a > .5){ l = c.l; break; }
      if(c){ l = c.l * c.a + .06 * (1 - c.a); break; }
      if(cs.backgroundImage && cs.backgroundImage !== "none" && !/^(HTML|BODY)$/.test(u.tagName)){ l = .3; break; }
    }
    sum += l; n++;
  }
  return n ? sum / n : null;
}
let lgAdT = 0;
function lgAdaptSoon(){ if(!lgAdT) lgAdT = setTimeout(() => { lgAdT = 0; lgAdapt(); }, 160); }
function lgAdapt(){
  LG_ADAPT.forEach(el => {
    if(!el.isConnected){ LG_ADAPT.delete(el); return; }
    const L = lgSampleUnder(el);
    if(L === null) return;
    el.style.setProperty("--lgt", Math.min(.72, Math.max(.26, .26 + L * .7)).toFixed(2));
  });
}
addEventListener("resize", lgAdaptSoon);

lgAttach(document.querySelector(".tabs.glass"), { scale: 46, band: 24, disp: true });
lgAttach(document.querySelector(".tabInd"), { scale: 34, band: 16, disp: true });
lgAttach(document.querySelector("#toTop"), { scale: 18, band: 12 });
lgDecor(document.querySelector(".tabs.glass"), true);
lgDecor(document.querySelector(".tabInd"));
lgDecor(document.querySelector("#toTop"));
LG_ADAPT.add(document.querySelector("#heroTop"));
lgAdaptSoon();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
  document.querySelectorAll(".refract, .tabs.glass, .tabInd").forEach(el => el.__lg && (el.__lg.key = "", lgSoon(el)));
});
