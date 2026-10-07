"use strict";

const searchCache = new Map();
let searchTimer = null, searchSeq = 0;
async function searchPlayers(q){
  if(searchCache.has(q)) return searchCache.get(q);
  const url = API + "/player/search/" + encodeURIComponent(q);
  let res = null;
  for(let attempt = 0; attempt < 2; attempt++){
    noteRequest();
    try{ res = await hiveFetch(url, { cache:"no-store" }); break; }
    catch(e){
      if(attempt === 0 && budgetLeft() > 0){ await new Promise(r => setTimeout(r, 700)); continue; }
      throw new Error(T("netErr"));
    }
  }
  if(res.status === 429) throw new Error(T("limitErr"));
  if(!res.ok) throw new Error(httpMsg(res.status));
  let data;
  try{ data = await res.json(); }
  catch(e){ throw new Error(T("badJson")); }
  if(data && !Array.isArray(data) && typeof data === "object"){
    const arr = Object.values(data).find(v => Array.isArray(v));
    if(arr) data = arr;
  }
  const list = (Array.isArray(data) ? data : []).map(it =>
    typeof it === "string" ? { name: it }
      : { name: pick(it, "username_cc", "username", "name", "player") || "",
          uuid: pick(it, "UUID", "uuid"),
          rank: pick(it, "rank", "player_rank"),
          icon: cosIcon(pick(it, "avatar", "equipped_avatar")) || pick(it, "avatar_url", "icon")
                || state.avatars[String(pick(it, "username", "username_cc", "name") || "").toLowerCase()] }
  ).filter(x => x.name);
  if(list.length) searchCache.set(q, list);
  return list;
}
function hueOf(str){
  let h = 0;
  for(const ch of String(str || "?")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
let suggTimer = null;
function hideSugg(){
  const box = $("#sugg");
  if(box.classList.contains("hidden")) return;
  clearTimeout(suggTimer);
  if(state.lite || matchMedia("(prefers-reduced-motion: reduce)").matches){
    box.classList.add("hidden"); return;
  }
  box.classList.add("closing");
  suggTimer = setTimeout(() => {
    box.classList.remove("closing");
    box.classList.add("hidden");
  }, 160);
}
function showSugg(html){
  const box = $("#sugg");
  clearTimeout(suggTimer);
  box.classList.remove("closing");
  box.innerHTML = html;
  box.classList.remove("hidden");
  box.querySelectorAll("button,.note2").forEach((el, i) => el.style.setProperty("--i", i));
  box.style.animation = "none";
  void box.offsetWidth;
  box.style.animation = "";
  box.querySelectorAll("button[data-n]").forEach(b => b.onclick = () => {
    $("#nick").value = b.dataset.n;
    state.nick = b.dataset.n;
    state.dead = []; state.lastDiag = 0;
    save(); hideSugg(); tickDiag(); renderSnap(); renderTrend();
  });
}
function askSearch(q){
  clearTimeout(searchTimer);
  const query = q.trim();
  if(query.length < 4 || !/^[a-zA-Z0-9 ]+$/.test(query)){ hideSugg(); return; }
  const seq = ++searchSeq;
  searchTimer = setTimeout(async () => {
    try{
      const list = await searchPlayers(query);
      if(seq !== searchSeq) return;
      if(!list.length){ showSugg('<div class="note2">' + esc(T("noPlayers")) + "</div>"); return; }
      showSugg(list.map(x => suggRow(x, query)).join(""));
    }catch(e){
      if(seq === searchSeq) showSugg('<div class="note2">' + esc(e.message) + "</div>");
    }
  }, 450);
}
function suggRow(x, query){
  const i = x.name.toLowerCase().indexOf(query.toLowerCase());
  const nm = i < 0 ? esc(x.name)
    : esc(x.name.slice(0, i)) + '<span class="hit">' +
      esc(x.name.slice(i, i + query.length)) + "</span>" +
      esc(x.name.slice(i + query.length));
  const tag = rankTag(x.rank);
  const letter = x.name.trim().charAt(0).toUpperCase() || "?";
  return '<button type="button" data-n="' + esc(x.name) + '">' +
    '<span class="av" style="--h:' + hueOf(x.uuid || x.name) + '"><span>' +
      (x.icon ? '<img alt="" loading="lazy" src="' + esc(x.icon) + '">'
              : "<i>" + esc(letter) + "</i>") +
    "</span></span>" +
    '<span class="nm">' + nm + "</span>" +
    (tag ? '<span class="tag" style="color:' + tag.c + '">[' + tag.t + "]</span>" : "") +
    "</button>";
}
