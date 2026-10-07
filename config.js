"use strict";

const API = "https://api.playhive.com/v0";
const HIVE_HEADERS = {
  "X-Hive-Resolve-Stat-Track": "true",
  "X-Hive-API-Version": "2024-03-29"
};
const PROXY = "https://misty-sky-2dcb.zhoski-demon.workers.dev/?url=";
async function hiveFetch(url, opts){
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), 7000);
  try{
    const r = await fetch(PROXY + encodeURIComponent(url), Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}));
    if(r.ok){ r.__via = "proxy"; return r; }
  }catch(e){}
  finally{ if(timer) clearTimeout(timer); }
  const r = await fetch(url, opts);
  r.__via = "direct";
  return r;
}
const KEY = "hive.tracker.v1";
const DIAG_CD = 5 * 1000;
const REQ_LIMIT = 80;
const REQ_WINDOW = 60 * 60 * 1000;
const SNAP_GAP = 5 * 1000;
const GAMES = [
  ["main","Профиль","Profile"],["bed","BedWars","BedWars"],["sky","SkyWars","SkyWars"],
  ["murder","Murder Mystery","Murder Mystery"],["hide","Hide and Seek","Hide and Seek"],
  ["dr","DeathRun","DeathRun"],["sg","Survival Games","Survival Games"],
  ["bridge","The Bridge","The Bridge"],["ctf","Capture the Flag","Capture the Flag"],
  ["drop","Block Drop","Block Drop"],["party","Block Party","Block Party"],
  ["ground","Ground Wars","Ground Wars"],["grav","Gravity","Gravity"],
  ["build","Build Battle","Build Battle"],["wars","Treasure Wars","Treasure Wars"]
];
