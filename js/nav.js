"use strict";

let snapScroll = 0;
document.querySelectorAll(".tabs button").forEach(b => {
  b.onclick = () => {
    const v = b.dataset.v;
    if(!$("#vSnap").classList.contains("hidden")) snapScroll = scrollY;
    const views = { snap:"#vSnap", trend:"#vTrend", top:"#vTop", set:"#vSet" };
    for(const [k, sel] of Object.entries(views)) $(sel).classList.toggle("hidden", v !== k);
    document.querySelectorAll(".tabs button").forEach(x => x.removeAttribute("aria-current"));
    b.setAttribute("aria-current","page");
    if(v === "trend") renderTrend();
    if(v === "top") renderLb();
    if(v === "snap") renderSnap();
    wheelTo = null;
    if(v === "snap"){
      scrollTo(0, snapScroll);
      requestAnimationFrame(() => scrollTo(0, snapScroll));
    } else scrollTo(0, 0);
    const sec = $(views[v] || "#vSnap");
    reveal(sec);
    sec.classList.remove("swap");
    void sec.offsetWidth;
    sec.classList.add("swap");
  };
});
let stickOn = false, stickTick = false, lastShade = -1;
const shadeEl = $("#shade");
function onScroll(){
  if(stickTick) return;
  stickTick = true;
  requestAnimationFrame(() => {
    stickTick = false;
    const on = scrollY > 130 && !$("#vSnap").classList.contains("hidden");
    if(on !== stickOn){ stickOn = on; $("#stick").classList.toggle("on", on); }

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
    e.target.closest(".primary,.mini,.chip,.close,.tabs button,.sugg button,.mainBtn,.myBtn,.shareBtn");
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
