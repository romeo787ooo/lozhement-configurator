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
  if(hasTiers()&&zone!=="lid")it.tierId=S.tiers.some(t=>t.id===S.activeTier)?S.activeTier:S.tiers[0].id;
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
  if (sel && selChanged) { setOpen("case", true); setOpen(zoneOf(sel.it), true); if(hasTiers())setOpen(tierFor(sel.it).id,true); setOpen(sel.it.id, true); setOpen(sel.it.id + ":params", true); }
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
    if(lv===2)row.dataset.zone=id;
    if(o.item){row.dataset.itemId=id;row.draggable=true;}
    if(o.tier){row.dataset.tierId=id;row.draggable=true;row.onclick=e=>{if(e.target===row)selectTier(id);};}
    const tw = hEl("button", "tw"); tw.type = "button"; tw.setAttribute("aria-label", (open ? "Свернуть: " : "Развернуть: ") + label);
    tw.onclick = () => { setOpen(id, !open); renderTree(); };
    const sw = hEl("i", "sw tree-symbol" + (lv === 1 ? " case" : "")); sw.style.color = o.color;
    const icon=lv===1?'M3 7h18v13H3z M8 7V4h8v3 M3 11h18':o.tier?'M3 8l9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5':o.item?'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 5 9-5 M12 12v9':lv===2?'M3 7h18v13H3z M3 11h18':'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5';
    sw.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon+'"/></svg>';
    const tl = hEl("button", "tl", label); tl.type = "button"; tl.title = label; tl.onclick = o.onLabel || tw.onclick;
    const eye=hEl('button','tree-eye');eye.type='button';
    let visible=true,toggle=null;
    if(o.item){const it=S.items.find(i=>i.id===id);visible=!V3.hide.items.has(id)&&!(S.stepReveal&&stepChild(it));toggle=()=>toggleSteppedItemVisibility(it);}
    else if(o.tier){visible=!V3.hiddenTiers?.has(id);toggle=()=>{V3.hiddenTiers??=new Set();visible?V3.hiddenTiers.add(id):V3.hiddenTiers.delete(id);applyTierScene();renderRows3();};}
    else if(lv===1){visible=!V3.hide.shell;toggle=()=>{V3.hide.shell=!V3.hide.shell;render3D();};}
    else if(id==='lid'){visible=!V3.hide.lid;toggle=()=>{V3.hide.lid=!V3.hide.lid;render3D();};}
    if(toggle){eye.innerHTML=EYE3(visible);eye.title=(visible?'Скрыть в 3D: ':'Показать в 3D: ')+label;eye.setAttribute('aria-label',eye.title);eye.setAttribute('aria-pressed',String(visible));eye.onclick=()=>{toggle();renderTree();};}
    else{eye.hidden=true;}
    row.append(tw, sw, eye, tl);
    if (o.qty > 1) row.appendChild(hEl("span", "qb", "×" + o.qty));
    if (o.meta) { const meta=hEl("span", "tm", o.meta); meta.title=o.metaTitle||o.meta; row.appendChild(meta); }
    row.appendChild(o.dot);
    li.appendChild(row); parent.appendChild(li);
    if (!open) return { row };
    const props = hEl("dl", "props"); li.appendChild(props);
    let kids = null;
    if (!o.leaf) { kids = hEl("ul"); kids.setAttribute("role", "group"); li.appendChild(kids); }
    return { props, kids, row };
  };

  const root = hEl("ul"); box.appendChild(root);
  const cn = node(root, "case", 1, caseName(c), { color: caseColor(), meta: c.l + "×" + c.w + "×" + c.h + " мм внутри", dot: dot(worst(res), A ? (A.errors ? "Нужно исправить: " + A.errors : "Всё помещается") : "") });
  const action=(row,text,label,fn)=>{const b=hEl("button","tree-action",text);b.type="button";b.title=label;b.setAttribute("aria-label",label);b.onclick=fn;row.append(b);return b;};
  const info=action(cn.row,"ⓘ","Характеристики кейса",()=>{setOpen("case:info",!isOpen("case:info"));setOpen("case",true);renderTree();});
  info.setAttribute("aria-expanded",String(isOpen("case:info")));
  action(cn.row,"Сменить","Сменить кейс",()=>{openStep("s-case");$("q").focus();});
  if (cn.props) {
    cn.props.hidden=!isOpen("case:info");
    prop(cn.props, "Снаружи", c.out.l + " × " + c.out.w + " × " + c.out.h + " мм").classList.add("mono");
    if (c.peli) prop(cn.props, "Аналог Peli", c.peli);
  }
  if (cn.kids) for (const z of ["lid", "body"]) {
    const its = S.items.filter(it => zoneOf(it) === z), zr = res.filter(r => r.zone === z);
    const pcs = its.reduce((s, it) => s + Math.max(1, it.qty | 0), 0), depth = z === "lid" ? c.lid : c.body;
    const fill = A ? Math.round((z === "lid" ? A.fillLid : A.fillBody) * 100) : 0;
    const ghosts = A && z === "lid" ? A.ghosts.length : 0, miss = zr.filter(r => !r.g).length;
    const stats=pcs+" шт · "+fill+"%"+(ghosts?" · ответных: "+ghosts:"")+(miss?" · не размещено: "+miss:"");
    const zn = node(cn.kids, z, 2, ZONE_NAME[z], { color: "var(--foam)", meta: r1(F.L)+"×"+r1(F.W)+"×"+depth+" мм · "+stats, metaTitle:"Ложемент · "+stats+" заполнения", dot: dot(worst(zr)) });
    const add=action(zn.row,"+","Добавить предмет: "+ZONE_NAME[z],()=>{setOpen(z+":add",!isOpen(z+":add"));setOpen(z,true);renderTree();if(isOpen(z+":add"))box.querySelector('[data-f="add-'+z+'"]').focus();});
    add.setAttribute("aria-expanded",String(isOpen(z+":add")));
    if (zn.props) {
      zn.props.hidden=!isOpen(z+":add");
      zn.props.classList.add("tree-add");
      const ts = sel_("add-" + z, TEMPLATES.map((t, i) => [String(i), t.name]).concat([["custom", "Свой предмет"]]), addTpl[z], "Что добавить в " + ZONE_NAME[z].toLowerCase(), e => { addTpl[z] = e.target.value; });
      const ab = hEl("button", "btn sm", "Добавить"); ab.type = "button"; ab.onclick = () => addItemTo(z, ts.value);
      const controls=prop(zn.props, "", ts, ab); controls.classList.add("wide");controls.previousElementSibling.remove();
    }
    if (zn.kids) {
      if (!its.length) zn.kids.appendChild(hEl("li", "empty", "Пока пусто"));
      if(z==='body'&&hasTiers()){
        for(const t of tierList().slice().reverse()){
          const children=its.filter(it=>tierFor(it).id===t.id);
          const tn=node(zn.kids,t.id,3,t.name,{tier:true,color:'var(--foam)',meta:t.thickness+' мм · '+children.reduce((n,it)=>n+it.qty,0)+' шт.',dot:dot(worst(zr.filter(r=>r.tierId===t.id))),sel:S.activeTier===t.id,onLabel:()=>{setOpen(t.id,true);selectTier(t.id);}});
          if(tn.props)tn.props.remove();
          action(tn.row,'⚙','Параметры: '+t.name,()=>editTier(t.id));
          if(tn.kids){if(!children.length)tn.kids.append(hEl('li','empty','?'));for(const it of children)itemNode(tn.kids,it);}
        }
        action(zn.row,'+ ▱','Добавить ярус',addTier);
      }else for (const it of its) itemNode(zn.kids, it);
    }
  }

  function itemNode(parent, it) {
    const rs = res.filter(r => r.it === it), w = worst(rs), idx = S.items.indexOf(it);
    const bad = rs.some(r => !r.g || r.d.err), isSel = !!S.selected && S.selected.startsWith(it.id + "#");
    const n = node(parent, it.id, hasTiers()&&it.zone!=="lid"?4:3, it.name, {item:true,
      color: bad ? RED3 : PAL3[idx % PAL3.length], qty: Math.max(1, it.qty | 0), meta: it.stepParentId?'↓ под '+(stepParent(it)?.name||'удалённым'):dimTxt(it), dot: dot(w), sel: isSel,
      onLabel: () => { if (isSel) { setOpen(it.id, !isOpen(it.id)); renderTree(); } else selectItem(it.id + "#0"); }
    });
    if (!n.kids) return;
    // У узла предмета нет собственной панели: только два смысловых раздела.
    if (n.props) n.props.remove();
    const f = k => it.id + ":" + k;
    const pn = node(n.kids, it.id + ":params", 4, "Параметры предмета", {
      color: "var(--accent)", meta: "", dot: dot(null), leaf: true
    });
    if (pn.props) {
      const p = pn.props;
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
    }

    const rn = node(n.kids, it.id + ":placement", 4, "Параметры размещения", {
      color: "var(--accent)", meta: "", dot: dot(w), leaf: true
    });
    if (rn.props) {
      const p = rn.props;
      prop(p, "Где лежит", sel_(f("zone"), hasTiers()?[["lid","Крышка"],...tierList().map(t=>[t.id,t.name])]:[["lid", "Крышка"], ["body", "Основание"]], levelOf(it), "Где лежит", e => {
        const id=e.target.value;it.zone=id==='lid'?'lid':'body';if(hasTiers()&&id!=='lid')it.tierId=id;setOpen(it.zone,true);setOpen(id,true);if(hasTiers())S.activeTier=id;reflowItem(it);
      }));
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
        row.append(dot(r)); pls.append(row);
      }
      if (!rs.length) pls.append(hEl("span", "dp", "пересчитывается…"));
      propWide(p, "Позиции: X, Y от левого нижнего угла ложемента, мм", pls);
      const del = hEl("button", "btn sm ghost", it.qty > 1 ? "Удалить позицию (все " + it.qty + " шт.)" : "Удалить позицию"); del.type = "button"; del.style.color = "var(--err)";
      del.onclick = () => removeItem(it);
      prop(p, "", del);
    }
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
// A tree row represents the entire quantity; a plan drag represents one instance.
function moveTreeItem(id,zone,targetId=null,after=false,tierId=null) {
  const item=S.items.find(i=>i.id===id);if(!item||targetId===id)return;
  const changed=zoneOf(item)!==zone || (tierId&&item.tierId!==tierId);
  S.items=S.items.filter(i=>i!==item);
  const target=S.items.findIndex(i=>i.id===targetId);
  const last=S.items.reduce((n,i,k)=>zoneOf(i)===zone?k:n,-1);
  S.items.splice(target>=0?target+(after?1:0):last+1,0,item);
  item.zone=zone;if(hasTiers()&&zone!=="lid")item.tierId=tierId||S.tiers[0].id;setOpen(zone,true);
  if(changed)reflowItem(item);else refresh();
  renderItems();
}
let treeDragId=null,treeDragTier=null;
const clearTreeDrop=()=>$("tree").querySelectorAll('.drop-before,.drop-after,.drop-zone').forEach(e=>e.classList.remove('drop-before','drop-after','drop-zone'));
$("tree").addEventListener("contextmenu",e=>{
  const tier=e.target.closest('[data-tier-id]');if(tier){e.preventDefault();tierMenu(tier.dataset.tierId,e.clientX,e.clientY);return;}
  const row=e.target.closest('[data-item-id]');if(!row)return;
  e.preventDefault();const id=row.dataset.itemId;
  showCtx(e.clientX,e.clientY,S.selected?.startsWith(id+'#')?S.selected:id+'#0');
});
$("tree").addEventListener("dragstart",e=>{
  const tier=e.target.closest('[data-tier-id]');if(tier){treeDragTier=tier.dataset.tierId;e.dataTransfer.setData('text/plain',treeDragTier);return;}
  const row=e.target.closest('[data-item-id]');if(!row)return;
  treeDragId=row.dataset.itemId;e.dataTransfer.setData('text/plain',treeDragId);e.dataTransfer.effectAllowed='move';hideCtx();
});
$("tree").addEventListener("dragover",e=>{
  if(!treeDragId&&!treeDragTier)return;const row=e.target.closest('[data-item-id],[data-zone],[data-tier-id]');if(!row)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';clearTreeDrop();
  row.classList.add(row.dataset.zone?'drop-zone':e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2?'drop-before':'drop-after');
});
$("tree").addEventListener("drop",e=>{
  if(!treeDragId&&!treeDragTier)return;const row=e.target.closest('[data-item-id],[data-zone],[data-tier-id]');if(!row)return;
  e.preventDefault();if(treeDragTier){if(row.dataset.tierId)reorderTier(treeDragTier,row.dataset.tierId,e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2);treeDragTier=null;clearTreeDrop();return;}
  const target=S.items.find(i=>i.id===row.dataset.itemId),zone=row.dataset.zone||(row.dataset.tierId?'body':zoneOf(target));
  const after=row.classList.contains('drop-after'),id=treeDragId;treeDragId=null;clearTreeDrop();
  moveTreeItem(id,zone,target?.id,after,row.dataset.tierId||(target&&tierFor(target).id));
});
$("tree").addEventListener("dragend",()=>{treeDragId=null;treeDragTier=null;clearTreeDrop();});
$("tree-all").addEventListener("click", () => {
  const ids = [...(hasTiers()?S.tiers.map(t=>t.id):[]),...S.items.flatMap(i => [i.id, i.id + ":params", i.id + ":placement"])];
  S.treeOpen = ids.length && ids.every(isOpen) ? ["case", "lid", "body"] : ["case", "lid", "body", ...ids];
  saveDraft(); renderTree();
});
