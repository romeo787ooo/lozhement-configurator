"use strict";
// Сворачиваемые шаги, панель инструментов и контекстное меню плана.

// ---------- Сворачиваемые секции левой панели ----------
function openStep(id, open = true) {
  const s = $(id); if (!s) return;
  s.classList.toggle("collapsed", !open);
  const h = s.querySelector(".step-h"); if (h) h.setAttribute("aria-expanded", String(open));
}
function updateStepSummaries() {
  if (!A) return;
  const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  set("ss-case", caseName(curCase()) + " · " + curCase().l + "×" + curCase().w + "×" + curCase().h);
  const pcs = S.items.reduce((s, i) => s + Math.max(1, i.qty | 0), 0);
  set("ss-items", S.items.length ? S.items.length + " поз., " + pcs + " шт." + (A.errors ? " · ошибок: " + A.errors : "") : "пусто");
  set("ss-tech", MATERIALS[S.material].name.split(",")[0]);
  try { set("ss-order", "≈ " + fmt(quote(A).total) + " ₽"); } catch (e) { set("ss-order", ""); }
}
// ---------- Панель инструментов и контекстное меню 2D ----------
function selInfo() {
  const key = S.selected; if (!key) return null;
  const [id, n] = key.split("#"), it = S.items.find(i => i.id === id);
  return it ? { key, it, n: +n } : null;
}
function updateTools() {
  const s = selInfo(), has = !!(s && S.place[s.key]);
  $("btn-del").disabled = !s;
  const so = $("sel-ori"); if (s) fillOrient(s.it, so); else { so.textContent = ""; so.disabled = true; }
  const nb = $("btn-notch"), cyl = !s || s.it.shape === "cyl";
  nb.disabled = cyl; nb.setAttribute("aria-pressed", String(!!(s && s.it.notch && !cyl)));
  $("btn-rot").disabled = !has || cyl;
  const sk = $("btn-sketch"); if (sk) sk.disabled = !s;
  renderSteppedControls();
}
function actDelete() {
  const s = selInfo(); if (!s) return;
  const { it, n } = s, q = Math.max(1, it.qty | 0);
  if (q > 1) {
    for (let j = n; j < q - 1; j++) { const nx = S.place[it.id + "#" + (j + 1)]; if (nx) S.place[it.id + "#" + j] = nx; else delete S.place[it.id + "#" + j]; }
    delete S.place[it.id + "#" + (q - 1)]; it.qty = q - 1;
  } else { S.items = S.items.filter(x => x !== it); delete S.place[it.id + "#0"]; }
  S.selected = null; renderItems(); refresh();
}
function actOrient(val) { const s = selInfo(); if (!s) return; s.it.orient = val; reflowItem(s.it); }
function actNotch() { const s = selInfo(); if (!s || s.it.shape === "cyl") return; s.it.notch = !s.it.notch; renderItems(); reflowItem(s.it); }
// Перерасстановка только одного предмета: остальные остаются на местах
function reflowItem(it) {
  if(it.stepParentId||stepChild(it)){refresh();return;}
  const c = curCase(), P = S.params, b = P.bridge, F = foamOf(c, P), om = P.margin - b / 2, Wc = F.L - 2 * om, Hc = F.W - 2 * om;
  const mine = instances([it]), others = instances(S.items.filter(x => x !== it)), zn = z => z === "lid" ? "lid" : "body";
  const cell = x => { const g = geom(x.it, S.place[x.key], P).fp; return { x: g.x - P.margin, y: g.y - P.margin, w: g.w + b, h: g.h + b }; };
  const keep = it.up, ups = it.orient === "auto" ? [keep, ...orientsOf(it).map(o => o.up).filter(u => u !== keep)] : [+it.orient];
  for (const up of ups) {
    applyOrient(it, up);
    const obst = others.filter(x => levelOf(x.it) === levelOf(it) && S.place[x.key]).map(cell);
    if (zn(it.zone) === "lid") for (const x of others) {
      if (zn(x.it.zone) === "lid" || !S.place[x.key] || !depthInfo(x.it, c, P, "body").protr) continue;
      const m = mirrorRect(geom(x.it, S.place[x.key], P).pocket, F.W);
      obst.push({ x: m.x - b / 2 - om, y: m.y - b / 2 - om, w: m.w + b, h: m.h + b });
    }
    const r = packInst(P, mine, Wc, Hc, obst);
    if (!r.miss.length) { for (const k in r.out) S.place[k] = { x: P.margin + r.out[k].x, y: P.margin + r.out[k].y, rot: r.out[k].rot }; refresh(); return; }
  }
  if(hasTiers()){for(const x of mine)delete S.place[x.key];refresh();}else relayout();
}
function showCtx(x, y, key) {
  selectItem(key); const s = selInfo(), m = $("ctx"); if (!s) return;
  const it = s.it, os = orientsOf(it), cyl = it.shape === "cyl";
  m.textContent = "";
  const mi = (label, fn, o = {}) => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.disabled = !!o.disabled; if (o.danger) b.className = "danger";
    b.innerHTML = '<span class="ck"></span><span></span>'; b.children[0].textContent = o.checked ? "✓" : ""; b.children[1].textContent = label;
    b.onclick = () => { hideCtx(); fn(); }; m.appendChild(b);
  };
  const hd = t => { const d = document.createElement("div"); d.className = "ctx-h"; d.textContent = t; m.appendChild(d); };
  if(hasTiers()){hd("Ярус / размещение");for(const [id,name] of [["lid","Крышка"],...tierList().map(t=>[t.id,t.name])])mi(name,()=>moveInstanceTier(key,id),{checked:levelOf(it)===id});}
  hd(it.name + (it.qty > 1 ? " · " + (s.n + 1) + " из " + it.qty : ""));
  mi("Повернуть на 90°", rotateSelected, { disabled: cyl || !S.place[s.key] });
  hd("Как класть");
  mi("Авто", () => actOrient("auto"), { checked: it.orient === "auto", disabled: os.length < 2 });
  for (const o of os) mi(o.label + " (" + (o.shape === "cyl" ? "Ø" + o.l : o.l + "×" + o.w) + ", высота " + o.h + ")", () => actOrient(String(o.up)), { checked: it.orient !== "auto" && +it.orient === o.up, disabled: os.length < 2 });
  m.appendChild(document.createElement("hr"));
  mi("Выемка под палец", actNotch, { checked: !!it.notch && !cyl, disabled: cyl });
  mi("Редактировать контур выреза…", () => openSketchEditor());
  mi("Ступенчатый карман…", editSteppedPocket);
  m.appendChild(document.createElement("hr"));
  mi(it.qty > 1 ? "Удалить этот экземпляр" : "Удалить предмет", actDelete, { danger: true });
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + "px"; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + "px";
  const f = m.querySelector("button:not(:disabled)"); if (f) f.focus();
}
function hideCtx() { $("ctx").hidden = true; }
function initTools() {
  document.querySelectorAll(".step").forEach(s => {
    const h = s.querySelector(".step-h"); h.setAttribute("role", "button"); h.tabIndex = 0;
    openStep(s.id, s.id==='s-total');
    h.onclick = () => openStep(s.id, s.classList.contains("collapsed"));
    h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); h.click(); } };
  });
  $("btn-del").onclick = actDelete; $("btn-notch").onclick = actNotch; $("sel-ori").onchange = e => actOrient(e.target.value);
  $("view").addEventListener("contextmenu", e => { const g = e.target.closest && e.target.closest(".pk"); if (!g) { hideCtx(); return; } e.preventDefault(); showCtx(e.clientX, e.clientY, g.dataset.key); });
  document.addEventListener("pointerdown", e => { if (!$("ctx").hidden && !e.target.closest("#ctx")) hideCtx(); });
  addEventListener("resize", hideCtx); addEventListener("scroll", hideCtx, true);
  document.addEventListener("keydown", e => {
    if(document.querySelector('dialog[open]'))return;
    if (typeof sketchIsOpen === "function" && sketchIsOpen()) return;
    if (e.key === "Escape") hideCtx();
    if ((e.key === "Delete" || e.key === "Backspace") && S.selected && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && !$("ctx").contains(document.activeElement)) { e.preventDefault(); actDelete(); }
  });
}
