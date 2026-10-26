"use strict";
// Переключение вида состава, инспектор выбранного предмета и перетаскивание.

// Отрисовка компактного дерева находится в compact-tree.js.
const ZONE_NAME = { lid: "Крышка", body: "Основание" };
const itemsView = () => S.itemsView === "cards" ? "cards" : "tree";
function renderItems() {
  const tree = itemsView() === "tree";
  $('s-items').classList.toggle('tree-mode',tree);
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
function renderItemInspector(box,it) {
  const P=S.params, rs=A?A.res.filter(r=>r.it===it):[], rank={ok:0,warn:1,err:2};
  const w=rs.reduce((a,r)=>!a||rank[r.level]>rank[a.level]?r:a,null);
  const dot=r=>hEl('span',r&&r.level!=='ok'?'dot '+r.level:'');
  const mainFields=hEl('dl','props inspector-main');
  const advanced=document.createElement('details');advanced.className='inspector-advanced';advanced.open=treeAdvanced;
  advanced.append(hEl('summary',null,'Дополнительно'));
  const advancedFields=hEl('dl','props');advanced.append(advancedFields);
  advanced.ontoggle=()=>{if(advanced.isConnected)treeAdvanced=advanced.open;};
  box.append(mainFields);
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
    const f = k => it.id + ":" + k;
    const pn = {props:advancedFields};
    if (pn.props) {
      const p = pn.props;
      const nm = inp(f("name"), "text", it.name, "Название", e => { it.name = e.target.value; refresh(); }); nm.className = "nm";
      prop(p, "Название", nm);
      const dimIn = (k, i, min, max, lbl) => inp(f(k), "number", it.dim[i], lbl, e => {
        const v = parseFloat(e.target.value); if (!isFinite(v)) return;
        it.dim[i] = Math.max(min, Math.min(max, v)); if (it.kind === "cyl" && i === 0) it.dim[1] = it.dim[0];
        treeLater(() => { applyOrient(it,it.orient === "auto" ? it.pref : +it.orient); reflowItem(it); });
      }, { min, max });
      if (it.kind === "cyl") prop(p, "Ø × длина, мм", dimIn("d0", 0, 5, 2000, "Диаметр"), "×", dimIn("d2", 2, 1, 2000, "Длина"));
      else prop(p, "Д × Ш × В, мм", dimIn("d0", 0, 5, 2000, "Длина"), "×", dimIn("d1", 1, 5, 2000, "Ширина"), "×", dimIn("d2", 2, 1, 2000, "Высота"));
      prop(p, "Форма", sel_(f("kind"), [["rect", "Прямоугольный"], ["cyl", "Цилиндр"]], it.kind, "Форма", e => {
        it.kind = e.target.value; it.dim = [it.dim[0], it.kind === "cyl" ? it.dim[0] : it.dim[1], it.dim[2]];
        it.orient = "auto"; it.pref = 2; applyOrient(it, 2); if (it.kind === "cyl") it.notch = false; reflowItem(it);
      }));
      prop(p, "Количество", inp(f("qty"), "number", it.qty, "Количество", e => {
        const v = parseInt(e.target.value, 10); if (!isFinite(v)) return; it.qty = Math.max(1, Math.min(50, v)); treeLater(() => { applyOrient(it,it.orient === "auto" ? it.pref : +it.orient); reflowItem(it); });
      }, { min: 1, max: 50 }));
    }

    const rn = {props:mainFields};
    if (rn.props) {
      let p = rn.props;
      prop(p, "Где лежит", sel_(f("zone"), hasTiers()?[["lid","Крышка"],...tierList().map(t=>[t.id,t.name])]:[["lid", "Крышка"], ["body", "Основание"]], levelOf(it), "Где лежит", e => {
        const id=e.target.value;it.zone=id==='lid'?'lid':'body';if(hasTiers()&&id!=='lid')it.tierId=id;setOpen(it.zone,true);setOpen(id,true);if(hasTiers())S.activeTier=id;reflowItem(it);
      }));
      const os = hEl("select"); os.dataset.f = f("ori"); os.setAttribute("aria-label", "Как класть"); fillOrient(it, os);
      os.onchange = e => { it.orient = e.target.value; applyOrient(it,it.orient==='auto'?it.pref:+it.orient);reflowItem(it); };
      prop(p, "Как класть", os);
      p = advancedFields;
      if (it.kind !== "cyl") {
        const l = hEl("label", "chk"); l.append(inp(f("notch"), "checkbox", it.notch, "Выемка под палец", e => { it.notch = e.target.checked; reflowItem(it); }), "под палец Ø" + P.notchD + " мм");
        prop(p, "Выемка", l);
      }
      if (w && w.level !== "ok") prop(p, "Состояние", hEl("span", "chip " + w.level, w.text));
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
  const actions=hEl('div','inspector-actions');
  if(it.model){
    box.append(hEl('p','note','3D-модель · '+it.model.source+' · '+it.model.triangles+' треугольников. Контур: выпуклая проекция.'));
    for(const field of ['kind','d0','d1','d2','notch']){const el=advanced.querySelector('[data-f="'+it.id+':'+field+'"]');if(el){el.disabled=true;el.title='Габариты из модели. Для изменения масштаба повторите импорт.';}}
  }
  const contour=tierButton('Редактировать контур…','Открыть текущий контур предмета',()=>openSketchEditor());
  const step=tierButton('Ступенчатый карман…','Настроить размещение под другим предметом',editSteppedPocket);
  actions.append(contour,step);box.append(actions,advanced);
  if(it.stepParentId){mainFields.querySelector('select').disabled=true;advancedFields.querySelectorAll('.pi input').forEach(i=>i.disabled=true);box.append(hEl('p','note','Размещение связано с верхним предметом. Для изменения отделения сначала снимите связь ступенчатого кармана.'));}
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
  if(S.items.find(i=>i.id===row.dataset.itemId)?.stepParentId){e.preventDefault();return;}
  treeDragId=row.dataset.itemId;e.dataTransfer.setData('text/plain',treeDragId);e.dataTransfer.effectAllowed='move';hideCtx();
});
$("tree").addEventListener("dragover",e=>{
  if(!treeDragId&&!treeDragTier)return;const row=e.target.closest('[data-item-id],[data-zone],[data-tier-id]');if(!row)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';clearTreeDrop();
  row.classList.add(row.dataset.zone||row.dataset.tierId&&!treeDragTier?'drop-zone':e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2?'drop-before':'drop-after');
});
$("tree").addEventListener("drop",e=>{
  if(!treeDragId&&!treeDragTier)return;const row=e.target.closest('[data-item-id],[data-zone],[data-tier-id]');if(!row)return;
  e.preventDefault();if(treeDragTier){if(row.dataset.tierId)reorderTier(treeDragTier,row.dataset.tierId,e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2);treeDragTier=null;clearTreeDrop();return;}
  let target=S.items.find(i=>i.id===row.dataset.itemId);if(target?.stepParentId)target=stepParent(target)||target;
  const zone=row.dataset.zone||(row.dataset.tierId?'body':zoneOf(target));
  const after=row.classList.contains('drop-after'),id=treeDragId;treeDragId=null;clearTreeDrop();
  moveTreeItem(id,zone,target?.id,after,row.dataset.tierId||(target&&tierFor(target).id));
});
$("tree").addEventListener("dragend",()=>{treeDragId=null;treeDragTier=null;clearTreeDrop();});
$("tree-all").addEventListener("click", () => {
  const ids = treeGroupIds();
  treeQuery='';S.treeOpen = ids.every(isOpen) ? [] : ids;
  saveDraft(); renderTree();
});
