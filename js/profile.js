"use strict";

function renderSnap(){
  const mine = mySnaps();
  const last = mine[mine.length-1], prev = mine[mine.length-2];
  const main = last && last.g.main;
  const hero = $("#hero"), body = $("#snapBody");

  const letter = (state.nick || "?").trim().charAt(0).toUpperCase() || "?";
  const rank = main && (pick(main, "rank", "player_rank") || scanStr(main, /rank/i));
  const title = main && (pick(main, "hub_title_equipped", "equipped_hub_title", "hub_title", "title")
    || scanStr(main, /title/i));
  const avaId = main && (pick(main, "avatar_equipped", "equipped_avatar") || scanStr(main, /avatar/i));
  const tag = rankTag(rank);
  const lvlKey = main && Object.keys(main).find(k => /level/i.test(k) && typeof main[k] === "number");
  const hubLevel = lvlKey ? main[lvlKey] : undefined;
  const avaName = cosName(avaId), avaUrl = cosIcon(avaId);

  const rc = tag ? tag.c : "var(--gold)";
  document.documentElement.style.setProperty("--rankc", rc);
  document.documentElement.style.setProperty("--rankc1", tag ? tag.c1 : "#8a6a10");
  document.documentElement.style.setProperty("--rankc2", tag ? tag.c2 : "#ffe6a6");
  const tagHTML = tag ? ' <span class="tag">[<span class="rl">' + tag.t + "</span>]</span>" : "";
  const idHTML = '<span class="nk">' + esc(state.nick || T("noNick")) + tagHTML + "</span>";
  $("#stickNick").innerHTML = idHTML;
  $("#stickTag").innerHTML = "";

  const shareBtn = state.nick ? '<button class="hbtn" id="shareBtn" type="button" aria-label="' +
    esc(T("share")) + '" title="' + esc(T("share")) + '">' + SHARE_SVG + "</button>" : "";
  const searchBtn = '<button class="hbtn" id="searchBtn" type="button" aria-label="' + esc(T("qsOpen")) +
    '" title="' + esc(T("qsOpen")) + '">' + SEARCH_SVG + "</button>";
  if(!state.nick){
    hero.innerHTML = "";
    $("#fetchBtn").classList.add("hidden");
    $("#subtitle").textContent = "";
    $("#myBtn").classList.add("hidden");
    body.innerHTML = onboardHTML();
    onboardBind();
    return;
  }
  $("#fetchBtn").classList.remove("hidden");
  hero.innerHTML = '<div class="herotop"><h1 class="idline">' +
      (typeof hubLevel === "number" ? '<span class="lvl">' + esc(T("level")) + " " + nf(hubLevel) + "</span>" : "") +
      idHTML + "</h1>" + '<div class="corner">' + searchBtn + shareBtn + "</div></div>" +
    '<div class="hero"><div class="ava"><span>' +
      (avaUrl ? '<img alt="" src="' + esc(avaUrl) + '" onerror="this.replaceWith(document.createTextNode(' +
          JSON.stringify(letter).replace(/"/g,"&quot;") + '))">'
       : typeof avaName === "string"
        ? '<img alt="" src="https://cdn.playhive.com/avatars/' + encodeURIComponent(avaName) +
          '.png" onerror="this.replaceWith(document.createTextNode(' +
          JSON.stringify(letter).replace(/"/g,"&quot;") + '))">'
        : esc(letter)) +
    "</span></div>" +
    (title ? '<p class="title">' + mcText(cosName(title) || title, true) + titleIcon(title) +
      "</p>" : "") + "</div>";
  syncTitleWave();
  const sb = $("#shareBtn"); if(sb) sb.onclick = () => openShareCard(sb);
  $("#searchBtn").onclick = openSearch;
  if(state.main){ const pn = niceNick(state.main); if(pn !== state.main){ state.main = pn; $("#nick").value = pn; save(); } }
  if(state.nick){ const pn = niceNick(state.nick);
    if(pn !== state.nick){ state.nick = pn; save(); renderSnap(); return; } }
  const other = !!state.main && state.main.toLowerCase() !== nickKey();
  const myHTML = other ? '<span class="myAv">' + pavHTML(state.main) + '</span><span class="myT">' +
    esc(T("myProfile")) + '</span><span class="myN"' + mainRankStyle() + ">" + esc(state.main) + "</span>" : "";
  ["#myBtn", "#stickMy"].forEach(sel => {
    const b = $(sel); b.classList.toggle("hidden", !other); b.innerHTML = myHTML;
    if(other) b.setAttribute("aria-label", T("myProfile") + " " + state.main); else b.removeAttribute("aria-label");
  });
  fitStick();

  tickStatus();

  body.innerHTML = "";
  if(!last) return;

  if(main) renderStreak(main, body);

  let cols = null;
  const col = which => {
    if(!cols){
      cols = document.createElement("div");
      cols.className = "cols";
      cols.innerHTML = '<div class="colMain"></div><div class="colSide"></div>';
      body.append(cols);
    }
    return cols.querySelector(which === "side" ? ".colSide" : ".colMain");
  };

  const playedOf = c => num(c,"played") || num(c,"games_played");
  const codes = state.games.filter(g => g !== "main" && last.g[g] && playedOf(last.g[g]))
    .sort((a,b) => playedOf(last.g[b]) - playedOf(last.g[a]));

  if(codes.length){
    let P=0, W=0, K=0, D=0, LV=0, PR=0, XP=0, pP=0, pW=0, pK=0;
    codes.forEach(g => {
      const c = last.g[g], o = prev && prev.g[g];
      P += playedOf(c); W += num(c,"victories"); K += killsOf(c); D += num(c,"deaths");
      LV += Math.floor(gameLevel(c, g)); PR += num(c,"prestige"); XP += num(c,"xp");
      if(o){ pP += playedOf(o); pW += num(o,"victories"); pK += killsOf(o); }
    });
    const dl = (now, was) => prev && was && now > was ? "+" + nf(now - was) : "";
    const tiles = [
      { k:T("played"), v:nf(P), d:dl(P,pP) },
      { k:T("wins"), v:nf(W), d:dl(W,pW) },
      { k:T("winrate"), v:pct(W,P), d:"" },
      { k:T("killsTotal"), v:nf(K), d:dl(K,pK), act:"kills" },
      { k:T("kd"), v:ratio(K,D), d:"" }
    ];
    tiles.push(LV ? { k:T("levelSum"), v:nf(LV) + (PR ? " (+" + PR + ")" : ""), d:"" }
                  : { k:T("xpTotal"), v:nf(XP), d:"" });
    body.insertAdjacentHTML("beforeend", "<h2>" + esc(T("totalOver", codes.length)) + "</h2>" +
      '<div class="card">' + tilesHTML(tiles) +
      '<button type="button" class="mini cmpgo">' + esc(T("cmpBtn")) + "</button></div>");
    const cg = body.querySelector(".cmpgo"); if(cg) cg.onclick = () => openCompare(cg);

    const most = codes[0];
    const cards = codes.map(g => {
      const c = last.g[g], played = playedOf(c), wins = num(c,"victories");
      return '<button class="game" data-g="' + g + '"><b>' + esc(NAME(g)) +
        (g === most ? '<span class="badge">' + esc(T("mostPlayed")) + "</span>" : "") + "</b>" +
        '<div class="gs">' +
          "<div><span>" + nf(wins) + "</span><small>" +
            esc(L === "ru" ? pluralRU(wins, WINS_LOW_RU) : (wins === 1 ? "win" : T("winsLow"))) +
          "</small></div>" +
          "<div><span>" + nf(played) + "</span><small>" + esc(T("playedLow")) + "</small></div>" +
          "<div><span>" + (played ? pct(wins, played) : "—") + "</span><small>" +
            esc(T("winrateLow")) + "</small></div>" +
        "</div></button>";
    }).join("");
    col("main").insertAdjacentHTML("beforeend",
      "<h2>" + esc(T("games")) + '</h2><div class="games">' + cards + "</div>");
    body.querySelectorAll(".game").forEach((b, i) => {
      b.style.setProperty("--i", i);
      b.onclick = () => openGame(b.dataset.g, b);
    });
    body.querySelectorAll('[data-act="kills"]').forEach(el => el.onclick = () => openKills(el));
  }

  if(main){
    const html = cosmeticsHTML(main, parkourHTML(last.g.parkour));
    if(html) col("side").insertAdjacentHTML("beforeend", "<h2>" + esc(T("appearance")) + "</h2>" + html);
    col("side").insertAdjacentHTML("beforeend", "<h2>" + esc(T("profileAll")) +
      '</h2><div class="card" style="text-align:center">' +
      '<button class="mini" id="openMain">' + esc(T("showAll")) + "</button></div>");
    const b = body.querySelector("#openMain");
    if(b) b.onclick = () => openGame("main", b);
  }else{
    body.insertAdjacentHTML("beforeend", '<div class="note">' + esc(T("noProfile")) + "</div>");
  }
  body.querySelectorAll("[data-cos]").forEach(b => b.onclick = () => {
    const g = window.__cos || {}, k = b.dataset.cos;
    const arr = itemsNewFirst(g[k] && g[k].un) || [];
    if(arr.length) openCos(k, arr, b);
  });
  if(state.dead.length)
    body.insertAdjacentHTML("beforeend", '<div class="note">' +
      esc(T("deadNote", state.dead.map(NAME).join(", "))) + "</div>");
  fitText(body);
  reveal(body);
  markTq(body);
}
function renderStreak(main, body){
  const cur = pick(main, "daily_login_streak", "login_streak");
  const best = pick(main, "longest_daily_login_streak", "longest_login_streak");
  const gday = ts => Math.floor(ts / 86400000);
  const today = gday(Date.now());

  let updated = null;
  if(typeof cur === "number"){
    const mine = mySnaps();
    for(let i = mine.length - 1; i >= 0; i--){
      const sn = mine[i];
      if(!sn.g.main || gday(sn.t) >= today) continue;
      const was = pick(sn.g.main, "daily_login_streak", "login_streak");
      if(typeof was === "number"){ updated = cur > was; break; }
    }
  }
  const cls = updated === true ? "ok" : updated === false ? "no" : "unk";
  const txt = updated === true ? T("streakDone") : updated === false ? T("streakWait") : T("streakUnknown");

  const nextTs = (today + 1) * 86400000;
  const left = nextTs - Date.now();
  const h = Math.floor(left / 3600000), mn = Math.floor(left % 3600000 / 60000);
  const at = new Date(nextTs).toLocaleTimeString(L === "ru" ? "ru-RU" : "en-US",
    { hour:"2-digit", minute:"2-digit" });

  body.insertAdjacentHTML("beforeend", '<div class="card">' +
    '<div class="srow">' +
      "<div><b>" + esc(cur === undefined ? "—" : nf(cur)) + "</b><small>" + esc(T("streakNow")) + "</small></div>" +
      '<div class="sep"></div>' +
      "<div><b>" + esc(best === undefined ? "—" : nf(best)) + "</b><small>" + esc(T("streakBest")) + "</small></div>" +
    "</div>" +
    '<div class="sfoot"><span class="pill ' + cls + '">' + esc(txt) + "</span>" +
    '<span class="reset">' + esc(T("resetIn", h + " " + T("hh") + " " + mn + " " + T("mm"), at)) +
    "</span></div></div>");
}
function tickStatus(){
  const mine = mySnaps();
  const last = mine[mine.length-1];
  const btn = $("#fetchBtn");
  const locked = Date.now() - state.lastSnapAt < SNAP_GAP;
  if(!btn.classList.contains("busy") && !locked){
    btn.disabled = false;
    btn.textContent = T("snap");
  }
  $("#subtitle").textContent = !state.nick ? "" : !last ? T("noSnaps") : T("lastSnap", when(last.t));
}

function todayHTML(mine){
  const last = mine[mine.length - 1]; if(!last) return "";
  const day0 = Math.floor(Date.now() / 86400000) * 86400000;
  if(last.t < day0) return "";
  let base = null;
  for(let i = mine.length - 2; i >= 0; i--) if(mine[i].t < day0){ base = mine[i]; break; }
  if(!base){ const first = mine.find(x => x.t >= day0); if(first && first !== last) base = first; }
  if(!base) return "";
  const playedOf = c => num(c,"played") || num(c,"games_played");
  const skip = new Set([...(last.old || []), ...(base.old || []), "main", "parkour"]);
  let P = 0, W = 0, K = 0, X = 0;
  for(const g of Object.keys(last.g)){
    const a = last.g[g], b = base.g[g];
    if(skip.has(g) || !a || !b || Array.isArray(a) || Array.isArray(b)) continue;
    P += Math.max(0, playedOf(a) - playedOf(b));
    W += Math.max(0, num(a,"victories") - num(b,"victories"));
    K += Math.max(0, killsOf(a) - killsOf(b));
    X += Math.max(0, num(a,"xp") - num(b,"xp"));
  }
  const at = new Date(day0).toLocaleTimeString(L === "ru" ? "ru-RU" : "en-US", { hour:"2-digit", minute:"2-digit" });
  const inner = P || W || K || X
    ? tilesHTML([{ k:T("tdPlayed"), v:"+" + nf(P), d:"" }, { k:T("tdWins"), v:"+" + nf(W), d:"" },
                 { k:T("tdKills"), v:"+" + nf(K), d:"" }, { k:T("tdXp"), v:"+" + nf(X), d:"" }])
    : '<p class="sub" style="margin:0">' + esc(T("todayNone")) + "</p>";
  return "<h2>" + esc(T("today")) + '</h2><div class="card">' + inner +
    '<p class="sub tdh">' + esc(T("todaySince", at)) + "</p></div>";
}
