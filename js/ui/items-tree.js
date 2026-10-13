"use strict";
// Шаг 2, вид «Дерево»: кейс → крышка и основание → предметы со свойствами и расположением.

// ---------- Шаг 2, вид «Дерево»: кейс → крышка и основание → предметы ----------
const ZONE_NAME = { lid: "Крышка", body: "Основание" };
const itemsView = () => S.itemsView === "cards" ? "cards" : "tree";
function renderItems() {
  const tree = itemsView() === "tree";
  document.querySelectorAll("#iv button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === itemsView())));
  $("tree").hidden = !tree; $("items").hidden = tree; $("tree-all").hidden = !tree;
  if (tree) { $("items").textContent = ""; renderTree(); } else { $("tree").textContent = ""; renderCards(); }
}
function treeOpen() { if (!Array.isArray(S.treeOpen)) S.treeOpen = ["case", "lid", "body"]; return S.treeOpen; }
const isOpen = id => treeOpen().includes(id);
function setOpen(id, on) { const o = treeOpen(), i = o.indexOf(id); if (on && i < 0) o.push(id); else if (!on && i >= 0) o.splice(i, 1); }
const zoneOf = it => it.zone === "lid" ? "lid" : "body";
const dimTxt = it => it.kind === "cyl" ? "Ø" + it.dim[0] + "×" + it.dim[2] : it.dim.join("×");
let treeSel = null, treeTimer = 0;
const addTpl = { lid: "7", body: "0" };
const treeLater = fn => { clearTimeout(treeTimer); treeTimer = setTimeout(fn, 300); };
function hEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function addItemTo(zone, val) {
  const it = val === "custom" ? mkItem({ name: "Предмет " + (S.items.length + 1), shape: "rect", l: 100, w: 60, h: 40 }, { zone, notch: zone !== "lid" })
    : mkItem(TEMPLATES[+val], { zone, notch: zone !== "lid" && TEMPLATES[+val].shape === "rect" });
  S.items.push(it); S.selected = it.id + "#0"; setOpen(zone, true); setOpen(it.id, true);
  renderItems(); reflowItem(it);
}
function removeItem(it) {
  for (const k of Object.keys(S.place)) if (k.startsWith(it.id + "#")) delete S.place[k];
  S.items = S.items.filter(x => x !== it);
  if (S.selected && S.selected.startsWith(it.id + "#")) S.selected = null;
  setOpen(it.id, false); renderItems(); refresh();
}
function renderTree() {
  const box = $("tree"); if (!box || box.hidden) return;
  const c = curCase(), P = S.params, F = foamOf(c, P), rank = { ok: 0, warn: 1, err: 2 }, res = A ? A.res : [];
  const sel = selInfo(), selChanged = S.selected !== treeSel;
  if (sel && selChanged) { setOpen("case", true); setOpen(zoneOf(sel.it), true); setOpen(sel.it.id, true); }
  treeSel = S.selected;
  // Дерево перестраивается целиком: запоминаем фокус, курсор и прокрутку, чтобы ввод не сбивался.
  const ae = document.activeElement, fkey = ae && box.contains(ae) && ae.dataset ? ae.dataset.f : null;
  let caret = null; try { if (fkey && typeof ae.selectionStart === "number") caret = [ae.selectionStart, ae.selectionEnd]; } catch (e) { caret = null; }
  const st = box.scrollTop;
  box.textContent = "";
  const worst = rs => rs.reduce((a, r) => !a || rank[r.level] > rank[a.level] ? r : a, null);
  const dot = (r, title) => { const d = hEl("span", "dot" + (r ? " " + r.level : "")); if (!r) d.style.visibility = "hidden"; d.title = title || (r ? r.text : ""); return d; };
  const inp = (f, type, val, lbl, on, attrs, ev) => {
    const i = hEl("input"); i.type = type; i.dataset.f = f; i.setAttribute("aria-label", lbl);
    if (type === "checkbox") i.checked = !!val; else i.value = val;
    Object.assign(i, attrs || {}); i.addEventListener(ev || (type === "checkbox" ? "change" : "input"), on); return i;
  };
  const sel_ = (f, opts, val, lbl, on) => {
    const s = hEl("select"); s.dataset.f = f; s.setAttribute("aria-label", lbl);
    for (const [v, t] of opts) { const o = hEl("option", null, t); o.value = v; s.appendChild(o); }
    s.value = val; s.onchange = on; return s;
  };
  const prop = (dl, label, ...kids) => { const dd = hEl("dd"); kids.forEach(k => dd.append(k)); dl.append(hEl("dt", null, label), dd); return dd; };
  const propWide = (dl, label, kid) => { dl.append(hEl("dt", "wide", label)); const dd = hEl("dd", "wide"); dd.append(kid); dl.append(dd); };
  const node = (parent, id, lv, label, o) => {
    const li = hEl("li"), open = isOpen(id);
    li.setAttribute("role", "treeitem"); li.setAttribute("aria-level", lv); li.setAttribute("aria-expanded", String(open));
    if (o.sel) li.setAttribute("aria-selected", "true");
    const row = hEl("div", "tn" + (o.sel ? " sel" : "")); row.dataset.lv = lv;
    const tw = hEl("button", "tw"); tw.type = "button"; tw.setAttribute("aria-label", (open ? "Свернуть: " : "Развернуть: ") + label);
    tw.onclick = () => { setOpen(id, !open); renderTree(); };
    const sw = hEl("i", "sw" + (lv === 1 ? " case" : "")); sw.style.background = o.color;
    const tl = hEl("button", "tl", label); tl.type = "button"; tl.title = label; tl.onclick = o.onLabel || tw.onclick;
    row.append(tw, sw, tl);
    if (o.qty > 1) row.appendChild(hEl("span", "qb", "×" + o.qty));
    if (o.meta) row.appendChild(hEl("span", "tm", o.meta));
    row.appendChild(o.dot);
    li.appendChild(row); parent.appendChild(li);
    if (!open) return {};
    const props = hEl("dl", "props"); li.appendChild(props);
    let kids = null;
    if (!o.leaf) { kids = hEl("ul"); kids.setAttribute("role", "group"); li.appendChild(kids); }
    return { props, kids };
  };

  const root = hEl("ul"); box.appendChild(root);
  const cn = node(root, "case", 1, caseName(c), { color: caseColor(), meta: c.l + "×" + c.w + "×" + c.h, dot: dot(worst(res), A ? (A.errors ? "Нужно исправить: " + A.errors : "Всё помещается") : "") });
  if (cn.props) {
    prop(cn.props, "Внутри", c.l + " × " + c.w + " × " + c.h + " мм").classList.add("mono");
    prop(cn.props, "Крышка / осн.", "глубина " + c.lid + " / " + c.body + " мм");
    prop(cn.props, "Снаружи", c.out.l + " × " + c.out.w + " × " + c.out.h + " мм").classList.add("mono");
    if (c.peli) prop(cn.props, "Аналог Peli", c.peli);
    const b = hEl("button", "btn sm", "Сменить кейс"); b.type = "button"; b.onclick = () => { openStep("s-case"); $("q").focus(); };
    prop(cn.props, "", b);
  }
  if (cn.kids) for (const z of ["lid", "body"]) {
    const its = S.items.filter(it => zoneOf(it) === z), zr = res.filter(r => r.zone === z);
    const pcs = its.reduce((s, it) => s + Math.max(1, it.qty | 0), 0), depth = z === "lid" ? c.lid : c.body;
    const fill = A ? Math.round((z === "lid" ? A.fillLid : A.fillBody) * 100) : 0;
    const zn = node(cn.kids, z, 2, ZONE_NAME[z], { color: "var(--foam)", meta: its.length ? pcs + " шт · " + fill + "%" : "пусто", dot: dot(worst(zr)) });
    if (zn.props) {
      prop(zn.props, "Ложемент", r1(F.L) + " × " + r1(F.W) + " × " + depth + " мм").classList.add("mono");
      const ghosts = A && z === "lid" ? A.ghosts.length : 0, miss = zr.filter(r => !r.g).length;
      prop(zn.props, "Вырезов", zr.filter(r => r.g).length + (ghosts ? " + ответных " + ghosts : "") + (miss ? " · не разместились: " + miss : ""));
      prop(zn.props, "Заполнение", fill + "%");
      const ts = sel_("add-" + z, TEMPLATES.map((t, i) => [String(i), t.name]).concat([["custom", "Свой предмет"]]), addTpl[z], "Что добавить в " + ZONE_NAME[z].toLowerCase(), e => { addTpl[z] = e.target.value; });
      const ab = hEl("button", "btn sm", "Добавить"); ab.type = "button"; ab.onclick = () => addItemTo(z, ts.value);
      prop(zn.props, "Добавить", ts, ab);
    }
    if (zn.kids) {
      if (!its.length) zn.kids.appendChild(hEl("li", "empty", "Пока пусто"));
      for (const it of its) itemNode(zn.kids, it);
    }
  }

  function itemNode(parent, it) {
    const rs = res.filter(r => r.it === it), w = worst(rs), idx = S.items.indexOf(it);
    const bad = rs.some(r => !r.g || r.d.err), isSel = !!S.selected && S.selected.startsWith(it.id + "#");
    const n = node(parent, it.id, 3, it.name, {
      color: bad ? RED3 : PAL3[idx % PAL3.length], qty: Math.max(1, it.qty | 0), meta: dimTxt(it), dot: dot(w), sel: isSel, leaf: true,
      onLabel: () => { if (isSel) { setOpen(it.id, !isOpen(it.id)); renderTree(); } else selectItem(it.id + "#0"); }
    });
    if (!n.props) return;
    const p = n.props, f = k => it.id + ":" + k;
    const nm = inp(f("name"), "text", it.name, "Название", e => { it.name = e.target.value; refresh(); }); nm.className = "nm";
    prop(p, "Название", nm);
    const dimIn = (k, i, min, max, lbl) => inp(f(k), "number", it.dim[i], lbl, e => {
      const v = parseFloat(e.target.value); if (!isFinite(v)) return;
      it.dim[i] = Math.max(min, Math.min(max, v)); if (it.kind === "cyl" && i === 0) it.dim[1] = it.dim[0];
      treeLater(() => reflowItem(it));
    }, { min, max });
    if (it.kind === "cyl") prop(p, "Ø × длина, мм", dimIn("d0", 0, 5, 2000, "Диаметр"), "×", dimIn("d2", 2, 1, 2000, "Длина"));
    else prop(p, "Д × Ш × В, мм", dimIn("d0", 0, 5, 2000, "Длина"), "×", dimIn("d1", 1, 5, 2000, "Ширина"), "×", dimIn("d2", 2, 1, 2000, "Высота"));
    prop(p, "Форма", sel_(f("kind"), [["rect", "Прямоугольный"], ["cyl", "Цилиндр"]], it.kind, "Форма", e => {
      it.kind = e.target.value; it.dim = [it.dim[0], it.kind === "cyl" ? it.dim[0] : it.dim[1], it.dim[2]];
      it.orient = "auto"; it.pref = 2; applyOrient(it, 2); if (it.kind === "cyl") it.notch = false; reflowItem(it);
    }));
    prop(p, "Количество", inp(f("qty"), "number", it.qty, "Количество", e => {
      const v = parseInt(e.target.value, 10); if (!isFinite(v)) return; it.qty = Math.max(1, Math.min(50, v)); treeLater(() => reflowItem(it));
    }, { min: 1, max: 50 }));
    prop(p, "Где лежит", sel_(f("zone"), [["lid", "Крышка"], ["body", "Основание"]], zoneOf(it), "Где лежит", e => { it.zone = e.target.value; setOpen(it.zone, true); reflowItem(it); }));
    const os = hEl("select"); os.dataset.f = f("ori"); os.setAttribute("aria-label", "Как класть"); fillOrient(it, os);
    os.onchange = e => { it.orient = e.target.value; reflowItem(it); };
    prop(p, "Как класть", os);
    if (it.kind !== "cyl") {
      const l = hEl("label", "chk"); l.append(inp(f("notch"), "checkbox", it.notch, "Выемка под палец", e => { it.notch = e.target.checked; reflowItem(it); }), "под палец Ø" + P.notchD + " мм");
      prop(p, "Выемка", l);
    }
    if (w) prop(p, "Состояние", hEl("span", "chip " + w.level, w.text));
    const pls = hEl("div", "pls");
    for (const r of rs) {
      const row = hEl("div", "pi" + (S.selected === r.key ? " sel" : ""));
      const no = hEl("button", "no", "№" + (r.n + 1)); no.type = "button"; no.title = "Выделить на плане и в 3D"; no.onclick = () => selectItem(r.key);
      row.append(no);
      if (r.g) {
        const pk = r.g.pocket;
        const xy = axis => {
          const lab = hEl("label"), cur = axis === "x" ? pk.x : pk.y;
          lab.append(axis.toUpperCase(), inp(f("p" + r.n + axis), "number", Math.round(cur), axis.toUpperCase() + " выреза №" + (r.n + 1) + ", мм", e => {
            const nv = parseFloat(e.target.value); if (!isFinite(nv)) return;
            const pl = S.place[r.key]; if (!pl) return;
            S.place[r.key] = Object.assign({}, pl, axis === "x" ? { x: Math.round(pl.x + nv - cur) } : { y: Math.round(pl.y + nv - cur) });
            S.selected = r.key; refresh();
          }, null, "change"));
          return lab;
        };
        row.append(xy("x"), xy("y"));
        if (it.shape !== "cyl") {
          const rb = hEl("button", "btn sm ghost", r.pl.rot ? "90°" : "0°"); rb.type = "button"; rb.title = "Повернуть на 90°";
          rb.onclick = () => { selectItem(r.key, false); rotateSelected(); };
          row.append(rb);
        }
        row.append(hEl("span", "dp", "глуб. " + r.d.depth + (r.d.protr ? "+" + r.d.lidDepth : "")));
      } else row.append(hEl("span", "dp", "не размещён"));
      row.append(dot(r));
      pls.append(row);
    }
    if (!rs.length) pls.append(hEl("span", "dp", "пересчитывается…"));
    propWide(p, "Расположение: X, Y от левого нижнего угла ложемента, мм", pls);
    const del = hEl("button", "btn sm ghost", it.qty > 1 ? "Удалить позицию (все " + it.qty + " шт.)" : "Удалить позицию"); del.type = "button"; del.style.color = "var(--err)";
    del.onclick = () => removeItem(it);
    prop(p, "", del);
  }

  box.scrollTop = st;
  if (fkey) { const n = box.querySelector('[data-f="' + fkey + '"]'); if (n) { n.focus({ preventScroll: true }); if (caret) try { n.setSelectionRange(caret[0], caret[1]); } catch (e) { /* поле без курсора */ } } }
  if (sel && selChanged) {
    const r = box.querySelector(".tn.sel");
    if (r) {
      const top = r.offsetTop, nx = r.nextElementSibling, bot = top + r.offsetHeight + (nx ? Math.min(nx.offsetHeight, box.clientHeight * 0.6) : 0);
      if (top < box.scrollTop) box.scrollTop = top - 6;
      else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = Math.min(top - 6, bot - box.clientHeight + 6);
    }
  }
  const allIds = S.items.map(i => i.id);
  $("tree-all").textContent = allIds.length && allIds.every(isOpen) ? "Свернуть предметы" : "Развернуть всё";
}
document.querySelectorAll("#iv button").forEach(b => b.addEventListener("click", () => { S.itemsView = b.dataset.v; saveDraft(); renderItems(); if (A) renderItemStatus(); }));
$("tree-all").addEventListener("click", () => {
  const ids = S.items.map(i => i.id);
  S.treeOpen = ids.length && ids.every(isOpen) ? ["case", "lid", "body"] : ["case", "lid", "body", ...ids];
  saveDraft(); renderTree();
});
