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
  document.querySelectorAll(".tabs button").forEach(x => {
    if(x.dataset.v === v) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current");
  });
  wheelTo = null;
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
document.querySelectorAll(".tabs button").forEach(b => { b.onclick = () => go(b.dataset.v); });
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
  toTopShow(y > h * (toTopWide.matches ? 3 : 1.5));
}
const toTopSoon = () => { if(!toTopRAF) toTopRAF = requestAnimationFrame(() => { toTopRAF = 0; toTopUpdate(); }); };
addEventListener("scroll", e => { if(e.target !== document && e.target.closest && e.target.closest(".modal")) toTopSoon(); },
  { capture: true, passive: true });
if(typeof MutationObserver === "function") new MutationObserver(toTopSoon).observe(document.body, { childList: true });
if(toTopEl) toTopEl.onclick = () => {
  wheelTo = null;
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
    const on = scrollY > 130 && !$("#vSnap").classList.contains("hidden");
    if(on !== stickOn){ stickOn = on; $("#stick").classList.toggle("on", on); }
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
addEventListener("pointerdown", e => {
  if(state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = e.target.closest &&
    e.target.closest(".primary,.mini,.chip,.close,.tabs button,.sugg button,.myBtn,.hbtn,.toTop");
  if(!b || b.disabled) return;
  const t = b.matches(".tabs button") ? b.firstElementChild : b;
  if(!t) return;
  t.classList.remove("press");
  void t.offsetWidth;
  t.classList.add("press");
  setTimeout(() => t.classList.remove("press"), 440);
}, { passive:true });
addEventListener("scroll", onScroll, { passive:true });
addEventListener("resize", onScroll, { passive:true });
let wheelTo = null, wheelRAF = 0;
const dropWheel = () => {
  wheelTo = null;
  if(wheelRAF){ cancelAnimationFrame(wheelRAF); wheelRAF = 0; }
};
function wheelStep(){
  if(wheelTo === null){ wheelRAF = 0; return; }
  const cur = scrollY, d = wheelTo - cur;
  if(Math.abs(d) < .6){ scrollTo(0, wheelTo); wheelTo = null; wheelRAF = 0; return; }
  scrollTo(0, cur + d * .16);
  wheelRAF = requestAnimationFrame(wheelStep);
}
addEventListener("wheel", e => {
  if(state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if(e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
  if(document.documentElement.classList.contains("locked")) return;
  if(e.target.closest && e.target.closest(".modal,.sugg")) return;
  if(e.deltaMode === 0 && Math.abs(e.deltaY) < 15) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  if(max <= 0) return;
  e.preventDefault();
  const from = wheelTo === null ? scrollY : wheelTo;
  const step = e.deltaY * (e.deltaMode === 1 ? 18 : 1);
  wheelTo = Math.max(0, Math.min(max, from + step));
  if(!wheelRAF) wheelRAF = requestAnimationFrame(wheelStep);
}, { passive:false });
addEventListener("touchstart", dropWheel, { passive:true });
addEventListener("keydown", dropWheel);
addEventListener("pointerdown", dropWheel, { passive:true });
