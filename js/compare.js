"use strict";

const CMP = {};
async function loadPlayerAll(nick){
  const k = nick.toLowerCase();
  const own = state.snaps.filter(x => x.n === k).pop();
  if(own && Date.now() - own.t < 10 * 60 * 1000) return own.g;
  const c = CMP[k];
  if(c && Date.now() - c.t < 10 * 60 * 1000) return c.d;
  noteRequest();
  let res;
  try{ res = await hiveFetch(API + "/game/all/all/" + encodeURIComponent(nick), { cache:"no-store", headers: HIVE_HEADERS }); }
  catch(e){ throw new Error(T("netErr")); }
  if(res.status === 404) throw new Error(T("cmpNotFound"));
  if(res.status === 429) throw new Error(limitMsg(k));
  if(!res.ok) throw new Error(httpMsg(res.status));
  const d = await res.json();
  if(!d || typeof d !== "object" || Array.isArray(d) || !Object.keys(d).length) throw new Error(T("cmpNotFound"));
  noteHit(k);
  CMP[k] = { t: Date.now(), d };
  return d;
}
function cmpHTML(aName, A, bName, B){
  const playedOf = c => c && !Array.isArray(c) ? (num(c, "played") || num(c, "games_played")) : 0;
  const codes = GAMES.map(g => g[0]).filter(g => g !== "main" && (playedOf(A[g]) || playedOf(B[g])));
  const row = (label, a, b, fmt) => {
    const w = a > b ? 1 : b > a ? 2 : 0;
    return '<div class="cr"><span>' + esc(label) + '</span><b class="' + (w === 1 ? "up" : "") + '">' + fmt(a) +
      '</b><b class="' + (w === 2 ? "up" : "") + '">' + fmt(b) + "</b></div>";
  };
  const wr = (w, p) => p ? w / p * 100 : 0, kd = (k, d) => d ? k / d : k;
  const fWr = v => v.toFixed(2) + "%", fKd = v => v.toFixed(2);
  const head = '<div class="cr ch"><span></span><b>' + esc(aName) + "</b><b>" + esc(bName) + "</b></div>";
  const tot = X => { const t = { P:0, W:0, K:0, D:0 };
    codes.forEach(g => { const c = X[g]; if(!playedOf(c)) return;
      t.P += playedOf(c); t.W += num(c, "victories"); t.K += killsOf(c); t.D += num(c, "deaths"); });
    return t; };
  const a = tot(A), b = tot(B);
  let out = '<div class="card cmpc"><h3>' + esc(T("cmpTotal")) + "</h3>" + head +
    row(T("played"), a.P, b.P, nf) + row(T("wins"), a.W, b.W, nf) +
    row(T("winrate"), wr(a.W, a.P), wr(b.W, b.P), fWr) + row(T("killsTotal"), a.K, b.K, nf) +
    row(T("kd"), kd(a.K, a.D), kd(b.K, b.D), fKd) + "</div>";
  codes.forEach(g => {
    const x = A[g] && !Array.isArray(A[g]) ? A[g] : {}, y = B[g] && !Array.isArray(B[g]) ? B[g] : {};
    const px = playedOf(x), py = playedOf(y);
    let rows = row(T("wins"), num(x, "victories"), num(y, "victories"), nf) + row(T("played"), px, py, nf) +
      row(T("winrate"), wr(num(x, "victories"), px), wr(num(y, "victories"), py), fWr);
    if(hasKillField(x) || hasKillField(y))
      rows += row(T("kd"), kd(killsOf(x), num(x, "deaths")), kd(killsOf(y), num(y, "deaths")), fKd);
    out += '<div class="card cmpc"><h3>' + esc(NAME(g)) + "</h3>" + head + rows + "</div>";
  });
  return out;
}
function attachSearch(inp, box, onPick, skip){
  let tmr = null, seq = 0;
  const hide = () => box.classList.add("hidden");
  const show = html => {
    box.innerHTML = html; box.classList.remove("hidden");
    box.querySelectorAll("button,.note2").forEach((el, i) => el.style.setProperty("--i", i));
    box.querySelectorAll("button[data-n]").forEach(b => b.onclick = () => { inp.value = b.dataset.n; hide(); onPick(b.dataset.n); });
  };
  inp.oninput = () => {
    clearTimeout(tmr);
    const q = inp.value.trim();
    if(!/^[a-zA-Z0-9 ]*$/.test(q) || !q || (skip && skip(q))){ hide(); return; }
    if(q.length < 4){ show('<div class="note2">' + esc(T("minChars")) + "</div>"); return; }
    const my = ++seq;
    tmr = setTimeout(async () => {
      try{
        const list = await searchPlayers(q);
        if(my !== seq) return;
        show(list.length ? list.map(x => suggRow(x, q)).join("") : '<div class="note2">' + esc(T("noPlayers")) + "</div>");
      }catch(e){ if(my === seq) show('<div class="note2">' + esc(e.message) + "</div>"); }
    }, 450);
  };
  inp.onblur = () => setTimeout(hide, 180);
  return { stop(){ clearTimeout(tmr); seq++; hide(); } };
}
function openCompare(from){
  const mine = mySnaps(), last = mine[mine.length - 1];
  const m = document.createElement("div");
  m.className = "modal mcmp";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("cmpTitle")) +
    '</h3><button class="close">' + esc(T("close")) + "</button></div>" +
    '<p class="sub mhint">' + esc(T("cmpHint")) + "</p>" +
    '<div class="nickbox"><input id="cmpNick" type="text" autocapitalize="none" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + esc(T("nickPh")) + '"><div class="sugg hidden" id="cmpSugg"></div></div>' +
    '<button class="primary" id="cmpGo">' + esc(T("cmpGo")) + '</button><div class="cmpBody"></div></div>';
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
  const inp = m.querySelector("#cmpNick"), out = m.querySelector(".cmpBody");
  let seq = 0;
  let search = null;
  const run = async n => {
    n = String(n || "").trim();
    if(!n) return;
    if(search) search.stop();
    inp.blur();
    if(!last){ out.innerHTML = '<p class="sub">' + esc(T("cmpNoMe")) + "</p>"; return; }
    const my = ++seq;
    out.innerHTML = '<p class="sub">' + esc(T("tqLoading")) + "</p>";
    try{
      const d = await loadPlayerAll(n);
      if(my !== seq || !out.isConnected) return;
      const other = (d.main && (d.main.username_cc || d.main.username)) || n;
      out.innerHTML = cmpHTML(state.nick, last.g, other, d);
    }catch(e){ if(my === seq) out.innerHTML = '<p class="sub">' + esc(e.message) + "</p>"; }
  };
  search = attachSearch(inp, m.querySelector("#cmpSugg"), run);
  inp.onkeydown = e => { if(e.key === "Enter") run(inp.value); };
  m.querySelector("#cmpGo").onclick = () => run(inp.value);
}
