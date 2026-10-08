"use strict";

const CARD_W = 1200, CARD_H = 675;

function cardImage(url){
  return new Promise(resolve => {
    if(!url) return resolve(null);
    const viaBlob = async () => {
      const r = await fetch(PROXY + encodeURIComponent(url), { cache: "force-cache" });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const b = await r.blob();
      if(!/^image\//.test(b.type)) throw new Error("not an image");
      return createImageBitmap(b);
    };
    const direct = () => new Promise(res => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
    viaBlob().then(resolve, () => direct().then(resolve));
  });
}

function cardRound(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let cardFamily = null;
function cardFont(px, weight){
  if(!cardFamily) cardFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return (weight || 800) + " " + px + "px " + cardFamily;
}

function cardFit(ctx, text, max, px, weight, min){
  let size = px;
  ctx.font = cardFont(size, weight);
  while(size > (min || 12) && ctx.measureText(text).width > max){ size -= 1; ctx.font = cardFont(size, weight); }
  return size;
}

function cardData(){
  const mine = mySnaps(), last = mine[mine.length - 1];
  if(!last) return null;
  const main = last.g.main || {};
  const playedOf = c => num(c, "played") || num(c, "games_played");
  const codes = state.games.filter(g => g !== "main" && last.g[g] && playedOf(last.g[g]))
    .sort((a, b) => playedOf(last.g[b]) - playedOf(last.g[a]));
  let P = 0, W = 0, K = 0, D = 0, LV = 0;
  codes.forEach(g => {
    const c = last.g[g];
    P += playedOf(c); W += num(c, "victories"); K += killsOf(c); D += num(c, "deaths");
    LV += Math.floor(gameLevel(c, g));
  });
  const title = pick(main, "hub_title_equipped", "equipped_hub_title", "hub_title", "title");
  const ava = pick(main, "avatar_equipped", "equipped_avatar");
  const lvlKey = Object.keys(main).find(k => /level/i.test(k) && typeof main[k] === "number");
  const top = codes[0];
  return {
    nick: state.nick, tag: rankTag(pick(main, "rank", "player_rank")),
    title: title ? String(cosName(title) || title) : "",
    avatar: cosIcon(ava) || (typeof cosName(ava) === "string"
      ? "https://cdn.playhive.com/avatars/" + encodeURIComponent(cosName(ava)) + ".png" : ""),
    hubLevel: lvlKey ? main[lvlKey] : LV || null,
    stats: [
      [T("played"), nf(P)], [T("wins"), nf(W)], [T("winrate"), pct(W, P)],
      [T("killsTotal"), nf(K)], [T("kd"), ratio(K, D)],
      typeof main.daily_login_streak === "number" ? [T("streak"), nf(main.daily_login_streak)]
        : LV ? [T("levelSum"), nf(LV)] : null
    ].filter(Boolean),
    top: top ? { name: NAME(top), wins: num(last.g[top], "victories"), played: playedOf(last.g[top]),
      wr: pct(num(last.g[top], "victories"), playedOf(last.g[top])) } : null,
    t: last.t
  };
}

async function drawCard(d){
  const cv = document.createElement("canvas");
  cv.width = CARD_W; cv.height = CARD_H;
  const ctx = cv.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, CARD_W * .55, CARD_H);
  bg.addColorStop(0, "#2a1442"); bg.addColorStop(1, "#140a20");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = (x, y, r, c) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, CARD_W, CARD_H);
  };
  glow(170, 90, 520, "rgba(178,102,235,.42)");
  glow(1080, 120, 380, "rgba(255,192,46,.10)");
  glow(980, 640, 460, "rgba(96,44,160,.38)");

  const PAD = 64, AV = 176;
  const frame = ctx.createLinearGradient(PAD, PAD, PAD + AV, PAD + AV);
  frame.addColorStop(0, "#ffd970"); frame.addColorStop(1, "#d99a15");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  cardRound(ctx, PAD, PAD, AV, AV, 30); ctx.fillStyle = frame; ctx.fill();
  ctx.restore();
  const IN = 12, ix = PAD + IN, iw = AV - IN * 2;
  ctx.save();
  cardRound(ctx, ix, ix, iw, iw, 20); ctx.clip();
  const img = await cardImage(d.avatar);
  if(img){
    ctx.fillStyle = "#170e22"; ctx.fillRect(ix, ix, iw, iw);
    const sw = img.width, sh = img.height, cut = .175;
    ctx.drawImage(img, sw * cut, sh * cut, sw * (1 - cut * 2), sh * (1 - cut * 2), ix, ix, iw, iw);
  }else{
    const h = hueOf(String(d.nick).toLowerCase());
    const g = ctx.createLinearGradient(ix, ix, ix + iw, ix + iw);
    g.addColorStop(0, "hsl(" + h + " 58% 46%)"); g.addColorStop(1, "hsl(" + (h + 34) + " 62% 28%)");
    ctx.fillStyle = g; ctx.fillRect(ix, ix, iw, iw);
    ctx.fillStyle = "#fff"; ctx.font = cardFont(72); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText((String(d.nick).trim().charAt(0) || "?").toUpperCase(), ix + iw / 2, ix + iw / 2 + 4);
  }
  ctx.restore();

  const tx = PAD + AV + 40, tmax = CARD_W - tx - PAD;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  let y = PAD + 34;
  if(typeof d.hubLevel === "number"){
    ctx.font = cardFont(26, 800); ctx.fillStyle = "#ffc02e";
    ctx.fillText(T("level") + " " + nf(d.hubLevel), tx, y);
    y += 70;
  }else y += 36;

  const tagText = d.tag ? " [" + d.tag.t + "]" : "";
  const nickPx = cardFit(ctx, d.nick + tagText, tmax, 68, 800, 34);
  ctx.font = cardFont(nickPx, 800);
  ctx.fillStyle = "#f4eefb"; ctx.fillText(d.nick, tx, y);
  if(d.tag){
    let x = tx + ctx.measureText(d.nick + " ").width;
    ctx.fillText("[", x, y); x += ctx.measureText("[").width;
    const lw = ctx.measureText(d.tag.t).width;
    const tg = ctx.createLinearGradient(x, y - nickPx * .8, x + lw, y);
    const mid = d.tag.t === "U" ? "#a05fd6" : "#4fd48a";
    tg.addColorStop(0, mid); tg.addColorStop(.55, d.tag.c1); tg.addColorStop(1, d.tag.c1);
    ctx.fillStyle = tg; ctx.fillText(d.tag.t, x, y); x += lw;
    ctx.fillStyle = "#f4eefb"; ctx.fillText("]", x, y);
  }

  if(d.title){
    const segs = mcSegments(d.title).filter(s => s.t);
    const plain = segs.map(s => s.t).join("");
    const px = cardFit(ctx, plain, tmax, 32, 600, 18);
    ctx.font = cardFont(px, 600);
    let x = tx;
    y += 54;
    segs.forEach(s => { ctx.fillStyle = s.c || "#ff7ab8"; ctx.fillText(s.t, x, y); x += ctx.measureText(s.t).width; });
  }

  const n = d.stats.length, gap = 16, top = 284, th = 124;
  const tw = (CARD_W - PAD * 2 - gap * (n - 1)) / n;
  d.stats.forEach(([k, v], i) => {
    const x = PAD + i * (tw + gap);
    cardRound(ctx, x, top, tw, th, 22);
    ctx.fillStyle = "rgba(255,255,255,.075)"; ctx.fill();
    ctx.textAlign = "center";
    const vp = cardFit(ctx, v, tw - 24, 44, 800, 22);
    ctx.font = cardFont(vp, 800); ctx.fillStyle = "#f4eefb";
    ctx.fillText(v, x + tw / 2, top + 62);
    const kp = cardFit(ctx, k, tw - 20, 20, 500, 13);
    ctx.font = cardFont(kp, 500); ctx.fillStyle = "#a493be";
    ctx.fillText(k, x + tw / 2, top + 98);
  });

  ctx.textAlign = "left";
  if(d.top){
    const gx = PAD, gy = top + th + 20, gw = CARD_W - PAD * 2, gh = 112;
    cardRound(ctx, gx, gy, gw, gh, 22);
    ctx.fillStyle = "rgba(24,13,38,.72)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.lineWidth = 2; ctx.stroke();
    const line = ctx.createLinearGradient(gx + 30, 0, gx + gw - 30, 0);
    line.addColorStop(0, "rgba(255,192,46,0)"); line.addColorStop(.5, "rgba(255,192,46,.9)"); line.addColorStop(1, "rgba(255,192,46,0)");
    ctx.fillStyle = line; ctx.fillRect(gx + 30, gy + 1, gw - 60, 2);

    const lx = gx + 30, cy = gy + gh / 2;
    ctx.font = cardFont(34, 800); ctx.fillStyle = "#f4eefb"; ctx.textBaseline = "alphabetic";
    ctx.fillText(d.top.name, lx, cy - 4);
    const badge = T("mostPlayed");
    ctx.font = cardFont(15, 800);
    const bw = ctx.measureText(badge).width + 22, bh = 26, by = cy + 10;
    cardRound(ctx, lx, by, bw, bh, 7); ctx.fillStyle = "#a05fd6"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(badge, lx + 11, by + bh / 2 + 1);
    ctx.textBaseline = "alphabetic";

    const cells = [[nf(d.top.wins), T("winsLow")], [nf(d.top.played), T("playedLow")], [d.top.wr, T("winrateLow")]];
    const cw = 190, cg = 12, ch = gh - 28, cx0 = gx + gw - 14 - cells.length * cw - (cells.length - 1) * cg;
    cells.forEach(([v, k], i) => {
      const x = cx0 + i * (cw + cg), yy = gy + 14;
      cardRound(ctx, x, yy, cw, ch, 16); ctx.fillStyle = "rgba(255,255,255,.075)"; ctx.fill();
      ctx.textAlign = "left";
      const vp = cardFit(ctx, v, cw - 32, 34, 800, 20);
      ctx.font = cardFont(vp, 800); ctx.fillStyle = "#f4eefb"; ctx.fillText(v, x + 16, yy + 44);
      ctx.font = cardFont(17, 500); ctx.fillStyle = "#a493be"; ctx.fillText(k, x + 16, yy + 70);
    });
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(PAD, CARD_H - 92, CARD_W - PAD * 2, 1);
  ctx.font = cardFont(22, 600); ctx.fillStyle = "#a493be";
  ctx.fillText(String(SITE).replace(/^https?:\/\//, "").replace(/\/$/, ""), PAD, CARD_H - 48);
  ctx.textAlign = "right"; ctx.fillStyle = "#ffc02e"; ctx.font = cardFont(22, 800);
  ctx.fillText("HiveMC Profile Tracker", CARD_W - PAD, CARD_H - 48);
  return cv;
}

async function openShareCard(from){
  if(!state.nick) return;
  const d = cardData();
  if(!d){ shareProfile(); return; }
  const link = profileLink(state.nick);
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = '<div class="inner"><div class="mhead"><h3>' + esc(T("cardTitle")) + '</h3><button class="close">' +
    esc(T("close")) + '</button></div><div class="cardpv"><p class="sub">' + esc(T("cardMaking")) + "</p></div>" +
    '<div class="cardbtns"><button type="button" class="primary cardsend" disabled>' + esc(T("cardSend")) + "</button>" +
    '<button type="button" class="mini cardsave" disabled>' + esc(T("cardSave")) + "</button>" +
    '<button type="button" class="mini cardlink">' + esc(T("cardLink")) + "</button></div></div>";
  m.onclick = e => { if(e.target === m || e.target.classList.contains("close")) closeModal(m); };
  mountModal(m, from);
  m.querySelector(".cardlink").onclick = async () => {
    try{ await navigator.clipboard.writeText(link); toast(T("linkCopied")); }
    catch(e){ prompt(T("linkCopy"), link); }
  };
  let blob = null;
  try{
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const cv = await drawCard(d);
    blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if(!blob) throw new Error("toBlob");
  }catch(e){
    m.querySelector(".cardpv").innerHTML = '<p class="sub">' + esc(T("cardFail")) + "</p>";
    return;
  }
  const url = URL.createObjectURL(blob);
  const fname = "hive-" + String(state.nick).replace(/[^\w-]+/g, "_") + ".png";
  m.querySelector(".cardpv").innerHTML = '<img alt="" src="' + url + '">';
  const send = m.querySelector(".cardsend"), saveBtn = m.querySelector(".cardsave");
  const file = typeof File === "function" ? new File([blob], fname, { type: "image/png" }) : null;
  const canFiles = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  send.disabled = false; saveBtn.disabled = false;
  if(!canFiles) send.remove();
  send.onclick = async () => {
    try{ await navigator.share({ files: [file], text: link }); }
    catch(e){ if(!(e && e.name === "AbortError")) toast(T("cardFail")); }
  };
  saveBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.append(a); a.click(); a.remove();
  };
  const obs = new MutationObserver(() => { if(!m.isConnected){ URL.revokeObjectURL(url); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
}
