"use strict";

let HD = null, hdTried = false;
async function loadHiveData(){
  if(hdTried) return HD;
  hdTried = true;
  for(const u of ["https://cdn.jsdelivr.net/npm/hive-bedrock-data/+esm",
                  "https://esm.sh/hive-bedrock-data"]){
    try{ HD = await import(u); if(HD) break; }catch(e){ HD = null; }
  }
  return HD;
}
const CAPS = {
  bed:100, sky:100, murder:100,
  dr:75, hide:75,
  sg:50, ctf:50,
  build:30,
  drop:25, party:25, grav:25,
  bridge:20, ground:20
};
const CAP_DEFAULT = 75;
let META_GAMES = {};
try{ const c = JSON.parse(localStorage.getItem("hive.tracker.titlemeta.v3") || localStorage.getItem("hive.tracker.titlemeta.v2") || "null");
  if(c && c.g && typeof c.g === "object") META_GAMES = c.g; }catch(e){}
function maxLevelOf(code){
  const mg = META_GAMES[code]; if(mg && mg.max) return mg.max;
  try{ const g = HD && HD.Games && HD.Games[code]; if(g && g.max_level) return g.max_level; }catch(e){}
  return CAPS[code] || CAP_DEFAULT;
}
const XP_TABLES = {};
function xpTable(code){
  const mg = META_GAMES[code];
  if(!mg || !Array.isArray(mg.xp) || !mg.xp.length) return null;
  const c = XP_TABLES[code];
  if(c && c.src === mg.xp) return c.t;
  const first = mg.xp.find(([x]) => x > 0);
  const shift = first && first[1] === 1 ? 1 : 0;
  const t = mg.xp.map(([x, l]) => [x, l + shift]);
  if(shift && !t.some(([x]) => x === 0)) t.unshift([0, 1]);
  XP_TABLES[code] = { src: mg.xp, t };
  return t;
}
function levelFromXP(xp, code){
  const tb = xpTable(code);
  if(tb && xp >= 0){
    let lv = null;
    for(const [need, l] of tb){ if(xp >= need) lv = l; else break; }
    if(lv !== null) return lv;
  }
  if(!HD || !xp) return null;
  try{
    const f = HD.calculateLevelFromXP || (HD.default && HD.default.calculateLevelFromXP);
    const v = f && f(xp, code);
    return typeof v === "number" && isFinite(v) ? v : null;
  }catch(e){ return null; }
}
function gameLevel(c, code){
  if(!c) return 0;
  if(typeof c.level === "number" && c.level) return c.level;
  return levelFromXP(num(c,"xp"), code) || 0;
}
