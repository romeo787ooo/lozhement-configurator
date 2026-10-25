"use strict";
// План 2D (SVG): отрисовка, выделение, перетаскивание, поворот.

const NS = "http://www.w3.org/2000/svg";
// ---------- Раскладка (SVG) ----------
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function segPath(segs, tx, ty) {
  if (!segs.length) return "";
  const s0 = segs[0], st = s0.t === "L" ? [s0.x1, s0.y1] : [s0.cx + s0.r * Math.cos(s0.a0 * Math.PI / 180), s0.cy + s0.r * Math.sin(s0.a0 * Math.PI / 180)];
  let d = "M" + tx(st[0]).toFixed(2) + " " + ty(st[1]).toFixed(2);
  for (const g of segs) {
    if (g.t === "L") d += " L" + tx(g.x2).toFixed(2) + " " + ty(g.y2).toFixed(2);
    else if (g.t === "A") {
      const ex = g.cx + g.r * Math.cos(g.a1 * Math.PI / 180), ey = g.cy + g.r * Math.sin(g.a1 * Math.PI / 180);
      d += " A" + g.r.toFixed(2) + " " + g.r.toFixed(2) + " 0 " + (g.a1 - g.a0 > 180 ? 1 : 0) + " 0 " + tx(ex).toFixed(2) + " " + ty(ey).toFixed(2);
    }
  }
  return d + " Z";
}
let VIEW = null;
let zoom2D = 1, baseViewBox2D = null;
function applyZoom2D() {
  const svg = $("view");
  if (!svg || !baseViewBox2D) return;
  const [x, y, w, h] = baseViewBox2D;
  const nw = w / zoom2D, nh = h / zoom2D;
  svg.setAttribute("viewBox", [x + (w - nw) / 2, y + (h - nh) / 2, nw, nh].join(" "));
  const label = $("zoom2-label"); if (label) label.textContent = Math.round(zoom2D * 100) + "%";
}
function initZoom2D() {
  const change = factor => { zoom2D = Math.max(0.5, Math.min(2.5, Math.round(zoom2D * factor * 100) / 100)); applyZoom2D(); };
  if ($("zoom2-in")) $("zoom2-in").onclick = () => change(1.2);
  if ($("zoom2-out")) $("zoom2-out").onclick = () => change(1 / 1.2);
  if ($("zoom2-reset")) $("zoom2-reset").onclick = () => { zoom2D = 1; applyZoom2D(); };
}
function renderView() {
  const svg = $("view"), c = A.c, P = A.P, F = A.F;
  const Lo = c.out.l, Wo = c.out.w, M = Math.max(24, Lo * 0.05), fs = Math.max(9, Lo / 46), gap = Math.max(16, Wo * 0.07);
  const wx = (c.out.l - c.l) / 2, wy = (c.out.w - c.w) / 2;
  const levels=hasTiers()?(S.activeTier==='all'?['lid',...tierList().slice().reverse().map(t=>t.id)]:[S.activeTier||S.tiers.at(-1).id]):['lid','body'];
  const H = levels.length*Wo+(levels.length-1)*gap+2*M+fs;
  baseViewBox2D = [0, 0, Lo + 2 * M, H];
  svg.setAttribute("viewBox", "0 0 " + (Lo + 2 * M).toFixed(1) + " " + H.toFixed(1));
  svg.textContent = "";
  const zones=Object.fromEntries(levels.map((id,i)=>[id,{top:M+fs*.6+i*(Wo+gap)}]));
  VIEW = { svg, zones: {} };
  for (const z of levels) {
    const top = zones[z].top, ox = M + wx + P.fit, oy = top + wy + P.fit;
    const tx = x => ox + x, ty = y => oy + F.W - y;
    VIEW.zones[z] = { ox, oy, tx, ty };
    el("rect", { x: M, y: top, width: Lo, height: Wo, rx: Math.min(28, Wo * 0.08), fill: "var(--case)" }, svg);
    el("rect", { x: M + wx, y: top + wy, width: c.l, height: c.w, rx: Math.min(14, c.w * 0.05), fill: "var(--case-edge)" }, svg);
    el("path", { d: segPath(rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null), tx, ty), fill: "var(--foam)", stroke: "var(--foam-edge)", "stroke-width": 1 }, svg);
    const lbl = el("text", { x: M, y: z === "lid" ? top - fs * 0.45 : top + Wo + fs * 1.15, "font-size": fs * 0.95, fill: "var(--ink-2)", "font-family": "Golos Text, sans-serif" }, svg);
    lbl.textContent = (z === "lid" ? "Крышка · ложемент " + c.lid + " мм" : "Корпус · ложемент " + c.body + " мм") + " · " + r1(F.L) + " × " + r1(F.W) + " мм";
    if(hasTiers()&&z!=='lid'){const t=tierList().find(t=>t.id===z);lbl.textContent=t.name+' · '+t.thickness+' мм · от дна '+r1(t.offset)+' мм';}
  }
  if(!hasTiers())for (const fx of [0.22, 0.78]) el("rect", { x: M + Lo * fx - Lo * 0.05, y: zones.lid.top + Wo, width: Lo * 0.1, height: gap, rx: 3, fill: "var(--case-edge)" }, svg);
  const zl = VIEW.zones.lid;
  for (const g of zl?A.ghosts:[]) {
    const d = g.it.shape === "cyl" ? null : segPath(rrSegs(g.rect, P.toolR, null), zl.tx, zl.ty);
    const common = { fill: "var(--pocket-ghost)", stroke: "var(--dim)", "stroke-width": Math.max(1, fs * 0.12), "stroke-dasharray": fs * 0.5 + " " + fs * 0.35 };
    if (d) el("path", Object.assign({ d }, common), svg);
    else el("circle", Object.assign({ cx: zl.tx(g.rect.x + g.rect.w / 2), cy: zl.ty(g.rect.y + g.rect.h / 2), r: g.rect.w / 2 }, common), svg);
    const t = el("text", { x: zl.tx(g.rect.x + g.rect.w / 2), y: zl.ty(g.rect.y + g.rect.h / 2) + fs * 0.3, "text-anchor": "middle", "font-size": fs * 0.7, fill: "var(--pocket-text)", "fill-opacity": 0.75, "font-family": "IBM Plex Mono, monospace" }, svg);
    t.textContent = "ответный " + g.depth;
  }
  for (const r of [...A.res].sort((a,b)=>Number(!!a.it.stepParentId)-Number(!!b.it.stepParentId))) {
    if (!r.g) continue;
    const z = VIEW.zones[levelOf(r.it)], foamD = r.zone === "lid" ? c.lid : tierFor(r.it).thickness;
    if(!z)continue;
    const grp = el("g", { class: "pk", "data-key": r.key, tabindex: "0", role: "button", "aria-label": r.it.name + ": " + r.text }, svg);
    const sel = S.selected === r.key, bad = r.level === "err";
    const attrs = { fill: "var(--pocket)", "fill-opacity": (0.55 + 0.45 * Math.min(1, r.d.depth / foamD)).toFixed(2),
      stroke: bad ? "var(--err)" : sel ? "var(--accent)" : "var(--foam-edge)", "stroke-width": bad || sel ? Math.max(1.5, fs * 0.22) : 1 };
    const segs = pocketSegs(r.it, r.g, P);
    if(r.it.stepParentId){attrs['stroke-dasharray']='6 4';attrs.stroke=bad?'var(--err)':'var(--accent)';attrs['fill-opacity']=0.85;}
    if (segs[0].t === "C") el("circle", Object.assign({ cx: z.tx(segs[0].cx), cy: z.ty(segs[0].cy), r: segs[0].r }, attrs), grp);
    else el("path", Object.assign({ d: segPath(segs, z.tx, z.ty) }, attrs), grp);
    const p = r.g.pocket, cx = z.tx(p.x + p.w / 2), cy = z.ty(stepChild(r.it)?p.y+p.h-fs*1.5:p.y + p.h / 2), maxCh = Math.floor(p.w / (fs * 0.5));
    if (maxCh >= 3) {
      const name = r.it.name.length > maxCh ? r.it.name.slice(0, Math.max(1, maxCh - 1)) + "…" : r.it.name;
      const t1 = el("text", { x: cx, y: cy - (p.h > fs * 2.6 ? fs * 0.15 : -fs * 0.3), "text-anchor": "middle", "font-size": fs * 0.78, fill: "var(--pocket-text)", "font-family": "Golos Text, sans-serif", "pointer-events": "none" }, grp);
      t1.textContent = name;
      if (p.h > fs * 2.6) {
        const t2 = el("text", { x: cx, y: cy + fs * 0.85, "text-anchor": "middle", "font-size": fs * 0.66, fill: "var(--pocket-text)", "fill-opacity": 0.8, "font-family": "IBM Plex Mono, monospace", "pointer-events": "none" }, grp);
        t2.textContent = (r.it.stepParentId?'↓ '+r.d.startDepth+'–':'глуб. ') + r.d.depth + (r.d.protr ? " +" + r.d.lidDepth : "");
      }
    }
  }
  if(hasTiers()&&S.tierNeighbours&&S.activeTier!=='all'&&S.activeTier!=='lid'){
    const z=VIEW.zones[S.activeTier],index=S.tiers.findIndex(t=>t.id===S.activeTier);
    for(const r of A.res.filter(r=>r.g&&r.zone==='body'&&Math.abs(S.tiers.findIndex(t=>t.id===r.tierId)-index)===1)){
      const segs=pocketSegs(r.it,r.g,P),attrs={fill:'none',stroke:'var(--dim)','stroke-width':1,'stroke-dasharray':'5 5','pointer-events':'none',opacity:.5};
      if(segs[0].t==='C')el('circle',{...attrs,cx:z.tx(segs[0].cx),cy:z.ty(segs[0].cy),r:segs[0].r},svg);else el('path',{...attrs,d:segPath(segs,z.tx,z.ty)},svg);
    }
  }
  applyZoom2D();
}

// ---------- Перетаскивание и поворот ----------
let drag = null;
  applyZoom2D();

function svgPoint(e) {
  const svg = $("view"), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function selectItem(key, redraw = true) {
  S.selected = key;if(key&&hasTiers()&&S.activeTier!=='all'){const it=S.items.find(it=>key.startsWith(it.id+'#'));if(it)S.activeTier=levelOf(it);renderTierControls();applyTierScene();} $("btn-rot").disabled = !key || !S.place[key];
  if (redraw && A) { renderView(); renderItemStatus(); if (V3.on) render3D(); }
  if (A) updateTools();
  if (key) openStep("s-items");
}
function onDown(e) {
  if (e.button) return;
  const g = e.target.closest && e.target.closest(".pk"); if (!g) { selectItem(null); return; }
  const key = g.dataset.key, pl = S.place[key]; if (!pl) return;
  selectItem(key);
  if(A.res.find(r=>r.key===key)?.it.stepParentId){e.preventDefault();return;}
  const p = svgPoint(e);
  drag = { key, sx: p.x, sy: p.y, x0: pl.x, y0: pl.y, zone: levelOf(A.res.find(r=>r.key===key).it), moved: false };
  $("view").setPointerCapture(e.pointerId);
  e.preventDefault();
}
function onMove(e) {
  if (!drag) return;
  const p = svgPoint(e), dx = p.x - drag.sx, dy = -(p.y - drag.sy);
  if (!drag.moved && Math.hypot(dx, dy) < 1) return;
  drag.moved = true;
  drag.target=Object.keys(VIEW.zones).find(z=>{const v=VIEW.zones[z];return p.x>=v.ox&&p.x<=v.ox+A.F.L&&p.y>=v.oy&&p.y<=v.oy+A.F.W;});
  drag.next={x:Math.round(drag.x0+dx),y:Math.round(drag.y0+dy+(drag.target?VIEW.zones[drag.target].oy-VIEW.zones[drag.zone].oy:0)),rot:S.place[drag.key].rot};
  const group=Array.from($("view").querySelectorAll('.pk')).find(g=>g.dataset.key===drag.key);
  if(group){group.setAttribute('transform',`translate(${dx} ${-dy})`);group.style.opacity=drag.target?'0.8':'0.4';}
}
function transferPlanInstance(key,zone,place) {
  if(hasTiers()){moveInstanceTier(key,zone);S.place[S.selected||key]=place;return;}
  const [id,nText]=key.split('#'),n=+nText;let item=S.items.find(i=>i.id===id);
  if(!item)return;
  if(zoneOf(item)!==zone && item.qty>1){
    const copy=structuredClone(item);copy.id='i'+uid++;copy.qty=1;
    for(let j=n;j<item.qty-1;j++){const next=S.place[id+'#'+(j+1)];if(next)S.place[id+'#'+j]=next;else delete S.place[id+'#'+j];}
    delete S.place[id+'#'+(item.qty-1)];item.qty--;
    S.items.splice(S.items.indexOf(item)+1,0,copy);item=copy;key=copy.id+'#0';
  }
  item.zone=zone;S.place[key]=place;S.selected=key;setOpen(zone,true);
}
function onUp(e) {
  if(!drag)return;
  if(e?.type!=='pointercancel'&&drag.moved&&drag.target)transferPlanInstance(drag.key,drag.target,drag.next);
  drag=null;refresh();renderItems();
}
function rotateSelected() {
  const key = S.selected, pl = key && S.place[key]; if (!pl) return;
  const r = A.res.find(x => x.key === key); if (!r || r.it.shape === "cyl") return;
  if(r.it.stepParentId){r.it.stepRotate=!r.it.stepRotate;refresh();return;}
  const a = fpDims(r.it, S.params, pl.rot ? 1 : 0), b = fpDims(r.it, S.params, pl.rot ? 0 : 1);
  S.place[key] = { x: Math.round(pl.x + a.w / 2 - b.w / 2), y: Math.round(pl.y + a.h / 2 - b.h / 2), rot: pl.rot ? 0 : 90 };
  refresh();
}
