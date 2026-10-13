"use strict";
// Шаг 2, вид «Карточки»: список предметов карточками.

// ---------- Шаг 2: предметы ----------
function renderCards() {
  const el = $("items"); el.textContent = "";
  for (const it of S.items) {
    const d = document.createElement("div"); d.className = "item"; d.dataset.id = it.id;
    d.dataset.sel = String(!!S.selected && S.selected.startsWith(it.id + "#"));
    d.innerHTML =
      '<div class="row"><input class="name" aria-label="Название"><label class="chk">шт <input class="qty" type="number" min="1" max="50" aria-label="Количество"></label>' +
      '<button class="btn sm ghost del" type="button" aria-label="Удалить предмет">Удалить</button></div>' +
      '<div class="row"><select class="shape" aria-label="Форма"><option value="rect">Прямоугольный</option><option value="cyl">Цилиндр</option></select>' +
      '<select class="zone" aria-label="Где лежит"><option value="body">В корпусе</option><option value="lid">В крышке</option></select>' +
      '<label class="chk"><input type="checkbox" class="notch"> выемка под палец</label></div>' +
      '<div class="dims"><label><span class="lab-l">Длина</span><input type="number" class="l" min="5" max="2000"></label>' +
      '<label class="wbox">Ширина<input type="number" class="w" min="5" max="2000"></label>' +
      '<label><span class="lab-h">Высота</span><input type="number" class="h" min="1" max="1000"></label></div>' +
      '<div class="row"><label class="chk" style="flex:1;min-width:0">Как класть <select class="ori" aria-label="Как класть предмет" style="flex:1;min-width:0"></select></label></div>' +
      '<div><span class="chip" id="st-' + it.id + '">…</span></div>';
    const q = s => d.querySelector(s);
    q(".name").value = it.name; q(".qty").value = it.qty; q(".shape").value = it.kind; q(".zone").value = it.zone;
    q(".notch").checked = !!it.notch; q(".notch").disabled = it.shape === "cyl";
    q(".l").value = it.dim[0]; q(".w").value = it.dim[1]; q(".h").value = it.dim[2];
    q(".lab-l").textContent = it.kind === "cyl" ? "Диаметр" : "Длина";
    q(".lab-h").textContent = it.kind === "cyl" ? "Длина" : "Высота";
    q(".wbox").hidden = it.kind === "cyl"; fillOrient(it, q(".ori"));
    q(".ori").onchange = e => { it.orient = e.target.value; relayout(); };
    q(".name").oninput = e => { it.name = e.target.value; refresh(); };
    const dimIn = (cls, idx, min, max) => q(cls).addEventListener("input", e => {
      const v = parseFloat(e.target.value); if (!isFinite(v)) return;
      it.dim[idx] = Math.max(min, Math.min(max, v)); if (it.kind === "cyl" && idx === 0) it.dim[1] = it.dim[0];
      debouncedRelayout();
    });
    dimIn(".l", 0, 5, 2000); dimIn(".w", 1, 5, 2000); dimIn(".h", 2, 1, 2000);
    q(".qty").addEventListener("input", e => { const v = parseFloat(e.target.value); if (!isFinite(v)) return; it.qty = Math.max(1, Math.min(50, v)); debouncedRelayout(); });
    q(".shape").onchange = e => { it.kind = e.target.value; it.dim = [it.dim[0], it.kind === "cyl" ? it.dim[0] : it.dim[1], it.dim[2]]; it.orient = "auto"; it.pref = 2; applyOrient(it, 2); if (it.kind === "cyl") it.notch = false; renderItems(); relayout(); };
    q(".zone").onchange = e => { it.zone = e.target.value; relayout(); };
    q(".notch").onchange = e => { it.notch = e.target.checked; relayout(); };
    q(".del").onclick = () => { S.items = S.items.filter(x => x !== it); renderItems(); relayout(); };
    d.addEventListener("focusin", () => { if (!S.selected || !S.selected.startsWith(it.id + "#")) selectItem(it.id + "#0"); });
    el.appendChild(d);
  }
  if (!S.items.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "Пока пусто. Добавьте предмет из шаблона или свой."; el.appendChild(p); }
}
let relayoutTimer = 0;
function debouncedRelayout() { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(relayout, 250); }
function renderItemStatus() {
  const rank = { ok: 0, warn: 1, err: 2 };
  for (const it of S.items) {
    const so = document.querySelector('.item[data-id="' + it.id + '"] .ori'); if (so) fillOrient(it, so);
    const el = $("st-" + it.id); if (!el) continue;
    const rs = A.res.filter(r => r.it === it); if (!rs.length) continue;
    const w = rs.reduce((a, b) => rank[b.level] > rank[a.level] ? b : a, rs[0]);
    const bad = rs.filter(r => r.level === "err").length;
    el.className = "chip " + w.level;
    el.textContent = (rs.length > 1 && bad && bad < rs.length ? bad + " из " + rs.length + " шт.: " : "") + w.text;
  }
  document.querySelectorAll(".item").forEach(d => { d.dataset.sel = String(!!S.selected && S.selected.startsWith(d.dataset.id + "#")); });
  if (itemsView() === "tree") renderTree();
}
function renderTemplates() {
  const s = $("tpl"); s.textContent = "";
  TEMPLATES.forEach((t, i) => { const o = document.createElement("option"); o.value = i; o.textContent = t.name + " · " + (t.shape === "cyl" ? "Ø" + t.l + "×" + t.h : t.l + "×" + t.w + "×" + t.h); s.appendChild(o); });
}
