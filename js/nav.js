"use strict";

const VIEWS = { snap:"#vSnap", trend:"#vTrend", top:"#vTop", set:"#vSet" };
let curView = "snap", snapScroll = 0, navSkip = 0, navSkipT = 0;
try{ history.scrollRestoration = "manual"; }catch(e){}
function lbSel(){
  const g = $("#lbGame"), p = $("#lbPeriod"), s = $("#lbSort");
  return g && g.value ? { g: g.value, p: p.value, s: s.value } : null;
}
function navEntry(v, y, extra){
  return Object.assign({ hv: 1, v, nick: state.nick || "", y: Math.max(0, Math.round(y || 0)), lb: lbSel() }, extra || {});
}
function navSave(){
  const st = history.state && history.state.hv ? history.state : null;
  try{ history.replaceState(navEntry(curView, scrollY, st && st.m ? { m: st.m } : null), ""); }catch(e){}
}
function navPush(v, y, extra){
  try{ history.pushState(navEntry(v, y, extra), ""); }catch(e){}
}
function showView(v, y){
  if(!VIEWS[v]) v = "snap";
  curView = v;
  for(const [k, sel] of Object.entries(VIEWS)) $(sel).classList.toggle("hidden", v !== k);
  requestAnimationFrame(() => { placeTabInd(true); if(typeof refitSelects === "function") refitSelects(); });

  document.querySelectorAll(".tabs button").forEach(x => {
    if(x.dataset.v === v) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current");
  });
  if(typeof toTopShow === "function") toTopShow(false);
  let done = null;
  if(v === "trend") renderTrend();
  if(v === "top") done = renderLb();
  if(v === "snap") renderSnap();
  const to = () => { scrollTo(0, y); requestAnimationFrame(() => scrollTo(0, y)); };
  to();
  if(done && y) done.then(() => { if(curView === v){ if(v === "top") lbFillTo(y); to(); } });
  const sec = $(VIEWS[v]);
  reveal(sec);
  fitText(sec);
  fitNames(sec);
  sec.classList.remove("swap");
  void sec.offsetWidth;
  sec.classList.add("swap");
  return done;
}
function go(v, opts){
  opts = opts || {};
  if(v === curView && !opts.force){
    showView(v, v === "snap" ? scrollY : 0);
    navSave();
    return;
  }
  if(!opts.saved) navSave();
  if(curView === "snap") snapScroll = scrollY;
  const y = opts.y !== undefined ? opts.y : v === "snap" ? snapScroll : 0;
  const onModal = history.state && history.state.m;
  showView(v, y);
  if(onModal){ try{ history.replaceState(navEntry(v, y), ""); }catch(e){} }
  else navPush(v, y);
}
function navModal(m){
  navSave();
  navPush(curView, scrollY, { m: 1 });
  m.__nav = true;
}
function navBack(){
  if(!(history.state && history.state.m)) return;
  navSkip++;
  clearTimeout(navSkipT);
  navSkipT = setTimeout(() => { navSkip = 0; }, 800);
  history.back();
}
addEventListener("popstate", e => {
  if(navSkip){ navSkip--; return; }
  const open = [...document.querySelectorAll(".modal")].filter(m => !m.dataset.closing);
  if(open.length){ closeModal(open[open.length - 1], true); return; }
  if(typeof closeTq === "function") closeTq();
  const st = e.state && e.state.hv ? e.state : { v: "snap", y: 0 };
  if(st.nick && st.nick.toLowerCase() !== nickKey()){
    switchNick(niceNick(st.nick));
    if(!mySnaps().length) snapshot();
  }
  if(st.v === "top" && st.lb) lbRestore = Object.assign({ stale: true }, st.lb);
  if(curView === "snap" && st.v !== "snap") snapScroll = scrollY;
  showView(st.v, st.y || 0);
});
try{ history.replaceState(navEntry("snap", 0), ""); }catch(e){}
/* tabs switch on finger release, not on the synthesized click: the press animation and the sliding
   glass plate under the finger must never swallow a tap */
let tabDown = null, tabUpAt = 0;
const tabsNav = $(".tabs");
tabsNav.addEventListener("pointerdown", e => { tabDown = e.button > 0 ? null : e.target.closest("button[data-v]"); }, { passive: true });
tabsNav.addEventListener("pointercancel", () => { tabDown = null; });
addEventListener("pointerup", e => {
  const b = tabDown; tabDown = null;
  if(!b) return;
  const r = b.getBoundingClientRect(), pad = 14;
  if(e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - 24 || e.clientY > r.bottom + 24) return;
  tabUpAt = Date.now();
  go(b.dataset.v);
}, true);
document.querySelectorAll(".tabs button").forEach(b => {
  b.onclick = () => { if(Date.now() - tabUpAt > 600) go(b.dataset.v); };
});
const tabInd = $(".tabInd");
let tabIndX = null;
function placeTabInd(anim){
  const nav = $(".tabs"), btn = nav && nav.querySelector('button[aria-current="page"]'), cur = btn && btn.firstElementChild;
  if(!tabInd || !cur) return;
  // layout offsets ignore the press/pop transforms, so the plate always lands exactly under the label
  const r = { width: cur.offsetWidth, height: cur.offsetHeight };
  const x = btn.offsetLeft + cur.offsetLeft, top = btn.offsetTop + cur.offsetTop;
  if(!r.width) return;
  const moved = tabIndX !== null && Math.abs(x - tabIndX) > 1;
  tabInd.classList.toggle("still", !anim || tabIndX === null);
  if(moved && anim){
    tabInd.classList.remove("stretch"); void tabInd.offsetWidth; tabInd.classList.add("stretch");
  }
  // far jumps glide without overshoot (a springy overshoot over a long distance flies past the edge)

  tabInd.style.width = r.width + "px";
  tabInd.style.height = r.height + "px";
  tabInd.style.transform = "translate3d(" + x.toFixed(1) + "px," + top.toFixed(1) + "px,0)";
  tabIndX = x;
}
addEventListener("resize", () => placeTabInd(false));
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeTabInd(false));
requestAnimationFrame(() => placeTabInd(false));
let stickOn = false, stickTick = false, lastShade = -1;
const shadeEl = $("#shade");
const toTopEl = $("#toTop");
let toTopOn = false;
function toTopShow(on){
  if(on === toTopOn || !toTopEl) return;
  toTopOn = on;
  toTopEl.classList.toggle("on", on);
  toTopEl.tabIndex = on ? 0 : -1;
  if(on){ toTopEl.removeAttribute("aria-hidden"); toTopEl.setAttribute("aria-label", T("toTop")); }
  else toTopEl.setAttribute("aria-hidden", "true");
}
let toTopTarget = null, toTopRAF = 0;
const toTopWide = matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
function topModal(){
  const ms = [...document.querySelectorAll(".modal")].filter(m => !m.dataset.closing && !m.classList.contains("msearch"));
  return ms[ms.length - 1] || null;
}
function modalScroller(m){
  const inner = m.querySelector(".inner");
  if(inner && inner.scrollHeight > inner.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(inner).overflowY)) return inner;
  return m;
}
function toTopUpdate(){
  if(!toTopEl) return;
  const m = topModal(), t = m ? modalScroller(m) : null;
  toTopTarget = t;
  toTopEl.classList.toggle("inmodal", !!m);
  const y = t ? t.scrollTop : scrollY, h = t ? t.clientHeight : innerHeight;
  const need = toTopWide.matches ? 7.5 : 5.5;
  toTopShow((m || curView === "top" || curView === "trend") && y > h * need);
}
const toTopSoon = () => { if(!toTopRAF) toTopRAF = requestAnimationFrame(() => { toTopRAF = 0; toTopUpdate(); }); };
addEventListener("scroll", e => { if(e.target !== document && e.target.closest && e.target.closest(".modal")) toTopSoon(); },
  { capture: true, passive: true });
if(typeof MutationObserver === "function") new MutationObserver(toTopSoon).observe(document.body, { childList: true });
if(toTopEl) toTopEl.onclick = () => {
  toTopEl.classList.remove("go");
  void toTopEl.offsetWidth;
  toTopEl.classList.add("go");
  setTimeout(() => toTopEl.classList.remove("go"), 600);
  const calm = state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches;
  (toTopTarget || window).scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
};
function onScroll(){
  if(stickTick) return;
  stickTick = true;
  requestAnimationFrame(() => {
    stickTick = false;
    if(document.documentElement.classList.contains("locked")) return;
    const on = !$("#vSnap").classList.contains("hidden") && (stickOn ? scrollY > 2 : scrollY > 18);
    if(on !== stickOn){
      stickOn = on;
      const ht = $("#heroTop");
      ht.classList.toggle("stuck", on);
      ht.classList.remove("merging", "splitting"); void ht.offsetWidth;
      if(!state.lite && !matchMedia("(prefers-reduced-motion: reduce)").matches) ht.classList.add(on ? "merging" : "splitting");
      clearTimeout(ht.__mt); ht.__mt = setTimeout(() => ht.classList.remove("merging", "splitting"), 700);
    }
    toTopUpdate();

    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 40 ? Math.min(1, scrollY / max) : 0;
    const v = Math.round(p * 20) / 20;
    if(v !== lastShade){
      lastShade = v;
      shadeEl.style.setProperty("--sd", v);
    }
  });
}
/* Press animations shrink a button under the finger. If the finger is near its edge, the release lands
   outside the shrunken button and the browser sends the click to a parent instead, so nothing happens.
   Remember the button on press and deliver the click to it when that happens. */
const TAP_SEL = "button, a[href], [data-act], [data-n], [data-g], .tile.tap, .lbr, .pod";
let tapEl = null, tapRect = null, tapT = 0;
addEventListener("pointerdown", e => {
  if(e.button > 0){ tapEl = null; return; }
  const el = e.target.closest && e.target.closest(TAP_SEL);
  tapEl = el && !el.disabled ? el : null;
  if(tapEl){ tapRect = tapEl.getBoundingClientRect(); tapT = Date.now(); }
}, { capture: true, passive: true });
addEventListener("pointercancel", () => { tapEl = null; }, true);
addEventListener("pointerup", e => {
  const el = tapEl; tapEl = null;
  if(!el || !el.isConnected || el.disabled || Date.now() - tapT > 900) return;
  if(el.contains(e.target)) return;
  const r = tapRect, pad = 16;
  if(e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
  let done = false;
  const fire = () => {
    if(done) return;
    done = true;
    removeEventListener("click", stray, true);
    if(el.isConnected && !el.disabled) el.click();
  };
  const stray = ev => { if(ev.isTrusted && !el.contains(ev.target)){ ev.stopPropagation(); ev.preventDefault(); } fire(); };
  addEventListener("click", stray, true);
  setTimeout(fire, 350);
}, true);
addEventListener("pointerdown", e => {
  if(state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = e.target.closest &&
    e.target.closest(".primary,.mini,.chip,.close,.sugg button,.myBtn,.hbtn,.toTop");
  if(!b || b.disabled) return;
  const t = b.matches(".tabs button") ? b.firstElementChild : b;
  if(!t) return;
  t.classList.remove("press");
  void t.offsetWidth;
  t.classList.add("press");
  setTimeout(() => t.classList.remove("press"), 440);
}, { passive:true });
addEventListener("scroll", onScroll, { passive:true });
// the darkening follows how far down the page you are, so it must be recalculated whenever the page
// itself gets longer or shorter (a leaderboard reloading, a day opening) - not only on scroll
if(typeof ResizeObserver === "function") new ResizeObserver(() => onScroll()).observe(document.body);
addEventListener("resize", onScroll, { passive:true });
// the mouse wheel scrolls the page natively: no added glide, momentum belongs to finger scrolling only
