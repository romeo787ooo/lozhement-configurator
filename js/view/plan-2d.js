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
function renderView() {
  const svg = $("view"), c = A.c, P = A.P, F = A.F;
  const Lo = c.out.l, Wo = c.out.w, M = Math.max(24, Lo * 0.05), fs = Math.max(9, Lo / 46), gap = Math.max(16, Wo * 0.07);
  const wx = (c.out.l - c.l) / 2, wy = (c.out.w - c.w) / 2;
  const H = 2 * Wo + gap + 2 * M + fs;
  svg.setAttribute("viewBox", "0 0 " + (Lo + 2 * M).toFixed(1) + " " + H.toFixed(1));
  svg.textContent = "";
  const zones = { lid: { top: M + fs * 0.6 }, body: { top: M + fs * 0.6 + Wo + gap } };
  VIEW = { svg, zones: {} };
  for (const z of ["lid", "body"]) {
    const top = zones[z].top, ox = M + wx + P.fit, oy = top + wy + P.fit;
    const tx = x => ox + x, ty = y => oy + F.W - y;
    VIEW.zones[z] = { ox, oy, tx, ty };
    el("rect", { x: M, y: top, width: Lo, height: Wo, rx: Math.min(28, Wo * 0.08), fill: "var(--case)" }, svg);
    el("rect", { x: M + wx, y: top + wy, width: c.l, height: c.w, rx: Math.min(14, c.w * 0.05), fill: "var(--case-edge)" }, svg);
    el("path", { d: segPath(rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null), tx, ty), fill: "var(--foam)", stroke: "var(--foam-edge)", "stroke-width": 1 }, svg);
    const lbl = el("text", { x: M, y: z === "lid" ? top - fs * 0.45 : top + Wo + fs * 1.15, "font-size": fs * 0.95, fill: "var(--ink-2)", "font-family": "Golos Text, sans-serif" }, svg);
    lbl.textContent = (z === "lid" ? "Крышка · ложемент " + c.lid + " мм" : "Корпус · ложемент " + c.body + " мм") + " · " + r1(F.L) + " × " + r1(F.W) + " мм";
  }
  for (const fx of [0.22, 0.78]) el("rect", { x: M + Lo * fx - Lo * 0.05, y: zones.lid.top + Wo, width: Lo * 0.1, height: gap, rx: 3, fill: "var(--case-edge)" }, svg);
  const zl = VIEW.zones.lid;
  for (const g of A.ghosts) {
    const d = g.it.shape === "cyl" ? null : segPath(rrSegs(g.rect, P.toolR, null), zl.tx, zl.ty);
    const common = { fill: "var(--pocket-ghost)", stroke: "var(--dim)", "stroke-width": Math.max(1, fs * 0.12), "stroke-dasharray": fs * 0.5 + " " + fs * 0.35 };
    if (d) el("path", Object.assign({ d }, common), svg);
    else el("circle", Object.assign({ cx: zl.tx(g.rect.x + g.rect.w / 2), cy: zl.ty(g.rect.y + g.rect.h / 2), r: g.rect.w / 2 }, common), svg);
    const t = el("text", { x: zl.tx(g.rect.x + g.rect.w / 2), y: zl.ty(g.rect.y + g.rect.h / 2) + fs * 0.3, "text-anchor": "middle", "font-size": fs * 0.7, fill: "var(--pocket-text)", "fill-opacity": 0.75, "font-family": "IBM Plex Mono, monospace" }, svg);
    t.textContent = "ответный " + g.depth;
  }
  for (const r of A.res) {
    if (!r.g) continue;
    const z = VIEW.zones[r.zone], foamD = r.zone === "lid" ? c.lid : c.body;
    const grp = el("g", { class: "pk", "data-key": r.key, tabindex: "0", role: "button", "aria-label": r.it.name + ": " + r.text }, svg);
    const sel = S.selected === r.key, bad = r.level === "err";
    const attrs = { fill: "var(--pocket)", "fill-opacity": (0.55 + 0.45 * Math.min(1, r.d.depth / foamD)).toFixed(2),
      stroke: bad ? "var(--err)" : sel ? "var(--accent)" : "var(--foam-edge)", "stroke-width": bad || sel ? Math.max(1.5, fs * 0.22) : 1 };
    const segs = pocketSegs(r.it, r.g, P);
    if (segs[0].t === "C") el("circle", Object.assign({ cx: z.tx(segs[0].cx), cy: z.ty(segs[0].cy), r: segs[0].r }, attrs), grp);
    else el("path", Object.assign({ d: segPath(segs, z.tx, z.ty) }, attrs), grp);
    const p = r.g.pocket, cx = z.tx(p.x + p.w / 2), cy = z.ty(p.y + p.h / 2), maxCh = Math.floor(p.w / (fs * 0.5));
    if (maxCh >= 3) {
      const name = r.it.name.length > maxCh ? r.it.name.slice(0, Math.max(1, maxCh - 1)) + "…" : r.it.name;
      const t1 = el("text", { x: cx, y: cy - (p.h > fs * 2.6 ? fs * 0.15 : -fs * 0.3), "text-anchor": "middle", "font-size": fs * 0.78, fill: "var(--pocket-text)", "font-family": "Golos Text, sans-serif", "pointer-events": "none" }, grp);
      t1.textContent = name;
      if (p.h > fs * 2.6) {
        const t2 = el("text", { x: cx, y: cy + fs * 0.85, "text-anchor": "middle", "font-size": fs * 0.66, fill: "var(--pocket-text)", "fill-opacity": 0.8, "font-family": "IBM Plex Mono, monospace", "pointer-events": "none" }, grp);
        t2.textContent = "глуб. " + r.d.depth + (r.d.protr ? " +" + r.d.lidDepth : "");
      }
    }
  }
}

// ---------- Перетаскивание и поворот ----------
let drag = null;
function svgPoint(e) {
  const svg = $("view"), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function selectItem(key, redraw = true) {
  S.selected = key; $("btn-rot").disabled = !key || !S.place[key];
  if (redraw && A) { renderView(); renderItemStatus(); if (V3.on) render3D(); }
  if (A) updateTools();
  if (key) openStep("s-items");
}
function onDown(e) {
  if (e.button) return;
  const g = e.target.closest && e.target.closest(".pk"); if (!g) { selectItem(null); return; }
  const key = g.dataset.key, pl = S.place[key]; if (!pl) return;
  selectItem(key);
  const p = svgPoint(e);
  drag = { key, sx: p.x, sy: p.y, x0: pl.x, y0: pl.y, moved: false };
  $("view").setPointerCapture(e.pointerId);
  e.preventDefault();
}
function onMove(e) {
  if (!drag) return;
  const p = svgPoint(e), dx = p.x - drag.sx, dy = -(p.y - drag.sy);
  if (!drag.moved && Math.hypot(dx, dy) < 1) return;
  drag.moved = true;
  const pl = S.place[drag.key];
  S.place[drag.key] = { x: Math.round(drag.x0 + dx), y: Math.round(drag.y0 + dy), rot: pl.rot };
  A = analyze(curCase(), S.params, S.items, S.place); renderView();
}
function onUp() { if (drag) { drag = null; refresh(); } }
function rotateSelected() {
  const key = S.selected, pl = key && S.place[key]; if (!pl) return;
  const r = A.res.find(x => x.key === key); if (!r || r.it.shape === "cyl") return;
  const a = fpDims(r.it, S.params, pl.rot ? 1 : 0), b = fpDims(r.it, S.params, pl.rot ? 0 : 1);
  S.place[key] = { x: Math.round(pl.x + a.w / 2 - b.w / 2), y: Math.round(pl.y + a.h / 2 - b.h / 2), rot: pl.rot ? 0 : 90 };
  refresh();
}
