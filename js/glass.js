"use strict";

/* Real "liquid glass" bends what is behind the bar near its rounded edges, like a lens.
   Chromium can run an SVG displacement filter on the backdrop; other browsers keep the plain blur. */
(function(){
  const nav = document.querySelector(".tabs.glass");
  const ua = navigator.userAgent || "";
  const chromium = /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS|iPhone|iPad|Firefox/.test(ua);
  if(!nav || !chromium || !window.CSS || !CSS.supports("backdrop-filter", "url(#lgRefract)")) return;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = '<filter id="lgRefract" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ' +
    'color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">' +
    '<feImage id="lgMap" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>';
  document.body.append(svg);
  const filter = svg.querySelector("filter"), img = svg.querySelector("#lgMap");

  // signed distance to a rounded rectangle centred at 0,0
  const sdf = (x, y, hw, hh, r) => {
    const qx = Math.abs(x) - (hw - r), qy = Math.abs(y) - (hh - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };

  let lastKey = "";
  function build(){
    const w = Math.round(nav.offsetWidth), h = Math.round(nav.offsetHeight);
    if(!w || !h) return;
    const r = parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 20;
    const key = w + "x" + h + "x" + r;
    if(key === lastKey) return;
    lastKey = key;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"), data = ctx.createImageData(w, h), px = data.data;
    const hw = w / 2, hh = h / 2, band = Math.min(18, hh);
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        const cx = x + .5 - hw, cy = y + .5 - hh;
        const d = -sdf(cx, cy, hw, hh, r);            // distance inside the edge
        let dx = 0, dy = 0;
        if(d >= 0 && d < band){
          const t = 1 - d / band, k = t * t * t;       // strongest right at the rim
          const gx = sdf(cx + 1, cy, hw, hh, r) - sdf(cx - 1, cy, hw, hh, r);
          const gy = sdf(cx, cy + 1, hw, hh, r) - sdf(cx, cy - 1, hw, hh, r);
          const gl = Math.hypot(gx, gy) || 1;
          dx = (gx / gl) * k; dy = (gy / gl) * k;      // sample from further out: the rim magnifies
        }
        const i = (y * w + x) * 4;
        px[i] = 128 + dx * 127; px[i + 1] = 128 + dy * 127; px[i + 2] = 128; px[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    filter.setAttribute("width", w); filter.setAttribute("height", h);
    img.setAttribute("width", w); img.setAttribute("height", h);
    img.setAttribute("href", cv.toDataURL());
    nav.classList.add("refract");
  }
  let raf = 0;
  const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(build); };
  addEventListener("resize", soon);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  soon();
})();
