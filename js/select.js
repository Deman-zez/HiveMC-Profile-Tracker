"use strict";

const SEL_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
let selOpen = null;

function enhanceSelect(sel){
  if(!sel || sel.__cs) return;
  sel.__cs = true;
  const wrap = document.createElement("span");
  wrap.className = "selw";
  if(sel.id) wrap.dataset.for = sel.id;
  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel);
  const lab = document.createElement("span");
  lab.className = "selLab"; lab.setAttribute("aria-hidden", "true");
  wrap.append(lab);
  sel.__lab = lab;
  // keep the label in sync even when code sets .value directly
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(sel, "value", { configurable: true,
    get(){ return proto.get.call(this); },
    set(v){ proto.set.call(this, v); selLabel(this); } });
  sel.addEventListener("change", () => selLabel(sel));
  new MutationObserver(() => selLabel(sel)).observe(sel, { childList: true, subtree: true, characterData: true });
  selLabel(sel);
  wrap.insertAdjacentHTML("beforeend", '<svg class="selArr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>');
  sel.tabIndex = -1;
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "button");
  wrap.addEventListener("click", () => openSelect(sel, wrap));
  wrap.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === " " || e.key === "ArrowDown"){ e.preventDefault(); openSelect(sel, wrap); }
  });
}

function selLabel(sel){
  const lab = sel.__lab; if(!lab) return;
  const o = sel.options[sel.selectedIndex];
  const full = o ? o.textContent : "", short = o && o.dataset.short, subT = o && o.dataset.sub;
  lab.classList.toggle("two", !!subT);
  if(subT){ lab.innerHTML = '<span class="selmain">' + esc(full) + '</span><small class="selsub">' + esc(subT) + "</small>"; lab.style.fontSize = ""; return; }
  lab.textContent = full;
  lab.style.fontSize = "";
  if(!lab.clientWidth) return;                         // hidden view: refit when shown
  if(short && lab.scrollWidth > lab.clientWidth + 1) lab.textContent = short;
  let size = parseFloat(getComputedStyle(lab).fontSize) || 16, guard = 0;
  while(lab.scrollWidth > lab.clientWidth + 1 && size > 12 && guard++ < 12){ size -= .5; lab.style.fontSize = size + "px"; }
}
function refitSelects(root){ (root || document).querySelectorAll("select").forEach(s => s.__lab && selLabel(s)); }
addEventListener("resize", () => refitSelects());
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => refitSelects());
function closeSelect(instant){
  const o = selOpen; if(!o) return;
  selOpen = null;
  o.wrap.classList.remove("open");
  const calm = instant || state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(calm){ o.pop.remove(); return; }
  o.pop.classList.add("out");
  setTimeout(() => o.pop.remove(), 200);
}

function openSelect(sel, wrap){
  if(sel.disabled) return;
  if(selOpen){ const same = selOpen.sel === sel; closeSelect(); if(same) return; }
  const opts = [...sel.options].filter(o => !o.hidden);
  if(!opts.length) return;
  const pop = document.createElement("div");
  pop.className = "selpop";
  pop.setAttribute("role", "listbox");
  pop.innerHTML = opts.map((o, i) => '<button type="button" role="option" class="selo' + (o.value === sel.value ? " on" : "") +
    '" data-v="' + esc(o.value) + '"' + (o.disabled ? " disabled" : "") + ' style="--ei:' + Math.min(i, 14) + '">' +
    '<span class="selt">' + esc(o.textContent) + (o.dataset.sub ? '<small class="selsub">' + esc(o.dataset.sub) + "</small>" : "") +
    "</span>" + (o.value === sel.value ? SEL_CHECK : "") + "</button>").join("");
  document.body.append(pop);
  selOpen = { sel, wrap, pop };
  wrap.classList.add("open");

  const r = wrap.getBoundingClientRect(), vh = innerHeight, gap = 8;
  const w = Math.max(r.width, 200), left = Math.min(Math.max(10, r.left), innerWidth - w - 10);
  const below = vh - r.bottom - 90, above = r.top - 20;
  const up = below < 220 && above > below;
  const maxH = Math.max(160, Math.min(420, (up ? above : below) - gap));
  pop.style.width = w + "px";
  pop.style.left = left + "px";
  pop.style.maxHeight = maxH + "px";
  if(up){ pop.style.bottom = (vh - r.top + gap) + "px"; pop.classList.add("up"); }
  else pop.style.top = (r.bottom + gap) + "px";
  const on = pop.querySelector(".on");
  if(on) pop.scrollTop = Math.max(0, on.offsetTop - maxH / 2 + on.offsetHeight / 2);

  pop.addEventListener("click", e => {
    const b = e.target.closest(".selo"); if(!b || b.disabled) return;
    const changed = sel.value !== b.dataset.v;
    sel.value = b.dataset.v;
    pop.querySelectorAll(".selo").forEach(x => x.classList.toggle("on", x === b));
    setTimeout(() => {
      closeSelect();
      if(changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, 90);
  });
}

addEventListener("pointerdown", e => {
  if(!selOpen) return;
  if(selOpen.pop.contains(e.target) || selOpen.wrap.contains(e.target)) return;
  closeSelect();
}, true);
addEventListener("keydown", e => { if(e.key === "Escape" && selOpen) closeSelect(); });
addEventListener("resize", () => closeSelect(true));
addEventListener("scroll", () => { if(selOpen) closeSelect(); }, { passive: true });

document.querySelectorAll("select").forEach(enhanceSelect);
