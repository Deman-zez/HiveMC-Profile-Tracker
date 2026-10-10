"use strict";

const SKIP = new Set(["UUID","uuid","xuid","mcid","username","username_cc","index","human_index","player_number"]);
const COS_ORDER = ["hub_title","title","costume","avatar","backbling","back_bling","mount","pet","hat"];
const COS_WORDS = /^(hub_title|title|costume|avatar|backbling|back_bling|mount|pet|hat|emote|victory_dance|win_celebration|projectile_trail|death_cry|pet_pin|stat_track)s?$/;
let saveWarned = false;
const DEFAULT_GAMES = GAMES.map(g => g[0]).filter(g => g !== "wars");
let state = load() || { nick:"", games:DEFAULT_GAMES, lang:"auto",
  finals:true, snaps:[], last:{}, dead:[], lastDiag:0 };
state.last = state.last || {};
state.dead = state.dead || [];
state.lang = state.lang || "auto";
if(state.finals === undefined) state.finals = true;
if(!Array.isArray(state.games) || !state.games.length ||
   (state.games.length === 4 && ["main","bed","sky","dr"].every(g => state.games.includes(g)))){
  state.games = DEFAULT_GAMES.slice();
}
if(!state.gamesV2){
  state.games = DEFAULT_GAMES.slice();
  state.gamesV2 = 1;
  state.setAt = Date.now();
}
if(!state.tagged){
  const n = (state.nick || "").trim().toLowerCase();
  state.snaps.forEach(x => { if(!x.n) x.n = n; });
  state.tagged = 1; save();
}
/* The set of games follows what Hive returns in /game/all/all: a new code shows up everywhere on its own,
   a code Hive stops returning disappears everywhere (old snapshots keep their data). */
const GAME_OWN_CARD = new Set(["parkour"]);
const GAME_GRACE_MS = 3 * 24 * 60 * 60 * 1000, GAME_GRACE_MISSES = 3;
function applyGameList(codes, fresh){
  if(!Array.isArray(codes) || codes.length < 5) return false;
  if(fresh){
    // a game Hive stops returning is kept for a while: it may be a hiccup on Hive's side
    const now = Date.now(), seen = state.gameSeenAt || {}, miss = state.gameMiss || {};
    const prev = Array.isArray(state.apiGames) ? state.apiGames : [];
    codes.forEach(c => { seen[c] = now; delete miss[c]; });
    const kept = prev.filter(c => !codes.includes(c) && c !== "main").filter(c => {
      miss[c] = (miss[c] || 0) + 1;
      if(!seen[c]) seen[c] = now;
      const keep = miss[c] < GAME_GRACE_MISSES || now - (seen[c] || now) < GAME_GRACE_MS;
      if(!keep){ delete miss[c]; delete seen[c]; }
      return keep;
    });
    state.gameSeenAt = seen; state.gameMiss = miss;
    codes = codes.concat(kept);
  }
  const have = new Set(codes);
  const next = GAMES_BASE.filter(g => g[0] === "main" || have.has(g[0]));
  codes.forEach(c => {
    if(c === "main" || GAME_OWN_CARD.has(c) || !/^[a-z0-9-]{1,24}$/.test(c) || next.some(g => g[0] === c)) return;
    const g = [c, "", ""]; g.dyn = true; next.push(g);
  });
  const before = GAMES.map(g => g[0]).join(), after = next.map(g => g[0]).join();
  GAMES.splice(0, GAMES.length, ...next);
  if(fresh){
    const seen = new Set(state.gamesSeen || GAMES_BASE.map(g => g[0]));
    const live = new Set(next.map(g => g[0]));
    const parked = new Set(state.gamesParked || []);
    next.forEach(g => {
      if(parked.has(g[0])){ parked.delete(g[0]); if(!state.games.includes(g[0])) state.games.push(g[0]); }
      else if(!seen.has(g[0]) && !state.games.includes(g[0])) state.games.push(g[0]);
    });
    state.games.filter(g => !live.has(g) && g !== "main").forEach(g => parked.add(g));
    state.gamesParked = [...parked];
    state.games = state.games.filter(g => live.has(g));
    state.gamesSeen = [...new Set([...seen, ...live])];
    state.apiGames = codes.slice();
  }
  return before !== after;
}
applyGameList(state.apiGames, false);
state.games = state.games.filter(g => GAMES.some(x => x[0] === g));
state.lastDiag = state.lastDiag || 0;
state.reqLog = state.reqLog || [];
state.lastSnapAt = state.lastSnapAt || 0;
state.hits = state.hits || [];
const HIVE_WINDOW = 60 * 60 * 1000, HIVE_PER_PLAYER = 3;
function noteHit(n){
  const t0 = Date.now() - HIVE_WINDOW;
  state.hits = state.hits.filter(h => h.t > t0);
  state.hits.push({ n, t: Date.now() }); saveSoon();
}
function limitMsg(n){
  const t0 = Date.now() - HIVE_WINDOW;
  const mine = state.hits.filter(h => h.n === n && h.t > t0).sort((a, b) => a.t - b.t);
  if(!mine.length) return T("limitHiveLater");
  const k = Math.max(0, mine.length - HIVE_PER_PLAYER);
  const wait = Math.max(1, Math.ceil((mine[k].t + HIVE_WINDOW - Date.now()) / 60000));
  return T("limitHive", wait);
}
state.avatars = state.avatars || {};
function load(){ try{ const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
const SNAP_MAX = 300, SNAP_MAX_OTHER = 30;
function compactSnaps(){
  const latest = new Map();
  state.snaps.forEach((s, i) => latest.set(s.n || "", i));
  state.snaps.forEach((s, i) => {
    if(s.c || latest.get(s.n || "") === i) return;
    const m = s.g && s.g.main;
    if(m) for(const k of Object.keys(m)) if(m[k] && typeof m[k] === "object") delete m[k];
    s.c = 1;
  });
}
function trimSnaps(max){
  max = max || SNAP_MAX;
  const keep = new Set([String(state.main || "").toLowerCase(), nickKey()]);
  const per = new Map();
  for(let i = state.snaps.length - 1; i >= 0; i--){
    const n = state.snaps[i].n || "";
    if(keep.has(n)) continue;
    per.set(n, (per.get(n) || 0) + 1);
    if(per.get(n) > SNAP_MAX_OTHER) state.snaps.splice(i, 1);
  }
  while(state.snaps.length > max){
    const i = state.snaps.findIndex(s => !keep.has(s.n || ""));
    state.snaps.splice(i < 0 ? 0 : i, 1);
  }
}
function save(){
  try{ compactSnaps(); }catch(e){}
  for(let tries = 0; tries < 6; tries++){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); saveWarned = false; return; }
    catch(e){
      const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
      if(!quota || state.snaps.length < 20) break;
      trimSnaps(Math.floor(state.snaps.length * .8));
    }
  }
  if(!saveWarned){ saveWarned = true; try{ toast(T("saveFail")); }catch(_){} }
}
function langCode(){
  if(state.lang === "ru" || state.lang === "en") return state.lang;
  const l = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  return /^ru|^be|^uk|^kk/i.test(l) ? "ru" : "en";
}
let L = langCode();
const T = (k, ...a) => { let s = (STR[L] && STR[L][k]) || STR.en[k] || k;
  a.forEach((v,i) => s = s.replace("%" + (i+1), v)); return s; };
function pruneLogs(){
  const t = Date.now() - REQ_WINDOW;
  state.reqLog = (state.reqLog || []).filter(x => x > t);
}
function budgetLeft(){ pruneLogs(); return REQ_LIMIT - state.reqLog.length; }
let saveT = 0;
function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(save, 800); }
addEventListener("pagehide", () => { if(saveT){ clearTimeout(saveT); save(); } });
function noteRequest(){ pruneLogs(); state.reqLog.push(Date.now()); saveSoon(); }
const nickKey = () => (state.nick || "").trim().toLowerCase();
const lk = g => nickKey() + "|" + g;
const mySnaps = () => state.snaps.filter(x => (x.n || "") === nickKey());
