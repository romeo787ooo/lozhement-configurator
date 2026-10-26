"use strict";
// Геометрия: ложемент, вырезы, глубины, контуры со скруглениями и выемками.

// ---------- Геометрия ----------
const curCase = () => caseById(S.caseId);
function foamOf(c, P) { return { L: c.l - 2 * P.fit, W: c.w - 2 * P.fit }; }
function instances(items) {
  const out = [];
  for (const it of items) for (let n = 0; n < Math.max(1, Math.min(50, it.qty | 0 || 1)); n++) out.push({ key: it.id + "#" + n, it, n });
  return out;
}
function pocketSize(it, P) {
  if(it.customShape?.length>=3 && it.customPocketScale){const c=P.clear;return {pw:(it.l+2*c)*it.customPocketScale.x,ph:((it.shape==="cyl"?it.l:it.w)+2*c)*it.customPocketScale.y};}
  const c = P.clear;
  if (it.shape === "cyl") { const d = it.l + 2 * c; return { pw: d, ph: d }; }
  return { pw: it.l + 2 * c, ph: it.w + 2 * c };
}
function notchR(it, P) {
  if(it.customShape?.length>=3)return 0;
  if (!it.notch || it.shape !== "rect") return 0;
  const { pw } = pocketSize(it, P);
  const r = Math.min(P.notchD / 2, pw / 2 - P.toolR - 1);
  return r >= 5 ? r : 0;
}
function fpDims(it, P, rot) {
  const { pw, ph } = pocketSize(it, P), e = notchR(it, P);
  return rot ? { w: ph + e, h: pw } : { w: pw, h: ph + e };
}
function geom(it, pl, P) {
  const { pw, ph } = pocketSize(it, P), e = notchR(it, P);
  if (!pl.rot) return { rot: false, fp: { x: pl.x, y: pl.y, w: pw, h: ph + e }, pocket: { x: pl.x, y: pl.y, w: pw, h: ph }, notch: e ? { cx: pl.x + pw / 2, cy: pl.y + ph, r: e, edge: "top" } : null };
  return { rot: true, fp: { x: pl.x, y: pl.y, w: ph + e, h: pw }, pocket: { x: pl.x + e, y: pl.y, w: ph, h: pw }, notch: e ? { cx: pl.x + e, cy: pl.y + pw / 2, r: e, edge: "left" } : null };
}
const r1 = v => Math.round(v * 10) / 10;
function regularDepthInfo(it, c, P, zone) {
  const st = Math.max(1, P.step), up = v => Math.ceil(v / st - 1e-9) * st, down = v => Math.floor(v / st + 1e-9) * st;
  if(zone!=='lid' && hasTiers()){
    const t=tierFor(it,c),max=down(t.thickness-t.bottom),need=up(it.h);
    return need<=max?{depth:need,protr:0,lidDepth:0}:{depth:Math.max(0,max),err:t.name+': высота '+it.h+' мм, доступно '+Math.max(0,max)+' мм над дном'};
  }
  if (zone === "lid") {
    const maxP = down(c.lid - P.minBottom), need = up(it.h);
    if (need <= maxP) return { depth: need, protr: 0, lidDepth: 0 };
    return { depth: Math.max(0, maxP), err: "высота " + it.h + " мм не помещается в крышку (до " + Math.max(0, maxP) + " мм), перенесите в корпус" };
  }
  const maxP = down(c.body - P.minBottom), need = up(it.h);
  if (maxP <= 0) return { depth: 0, err: "корпус слишком мелкий" };
  if (need <= maxP) return { depth: need, protr: 0, lidDepth: 0 };
  const protr = r1(it.h - maxP), lidNeed = up(protr), lidMax = down(c.lid - P.minBottom);
  if (lidNeed <= lidMax) return { depth: maxP, protr, lidDepth: lidNeed };
  return { depth: maxP, protr, err: "высота " + it.h + " мм: не хватает " + r1(it.h - maxP - lidMax) + " мм по высоте кейса" };
}
// Контур: прямоугольник со скруглением и выемкой под палец; дуги против часовой стрелки, ось Y вверх.
function rrSegs(r, rad, notch) {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h, k = Math.max(0, Math.min(rad, r.w / 2, r.h / 2));
  const segs = [];
  const line = (ax, ay, bx, by) => { if (Math.hypot(bx - ax, by - ay) > 1e-6) segs.push({ t: "L", x1: ax, y1: ay, x2: bx, y2: by }); };
  const arc = (cx, cy, rr, a0, a1) => { if (rr > 1e-6) segs.push({ t: "A", cx, cy, r: rr, a0, a1 }); };
  const edge = (ax, ay, bx, by, name) => {
    if (notch && notch.edge === name) {
      const len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len, n = notch;
      line(ax, ay, n.cx - dx * n.r, n.cy - dy * n.r);
      const a0 = Math.atan2(-dy, -dx) * 180 / Math.PI;
      arc(n.cx, n.cy, n.r, a0, a0 + 180);
      line(n.cx + dx * n.r, n.cy + dy * n.r, bx, by);
    } else line(ax, ay, bx, by);
  };
  edge(x0 + k, y0, x1 - k, y0, "bottom"); arc(x1 - k, y0 + k, k, 270, 360);
  edge(x1, y0 + k, x1, y1 - k, "right"); arc(x1 - k, y1 - k, k, 0, 90);
  edge(x1 - k, y1, x0 + k, y1, "top"); arc(x0 + k, y1 - k, k, 90, 180);
  edge(x0, y1 - k, x0, y0 + k, "left"); arc(x0 + k, y0 + k, k, 180, 270);
  return segs;
}
function pocketSegs(it, g, P) {
  if(it.model && it.customShape?.length>=3 && !it.customPocketScale){
    const p=g.pocket,points=ItemModels.contour(it,P.clear).map(v=>!g.rot?{x:p.x+v.x,y:p.y+v.y}:{x:p.x+v.y,y:p.y+it.l+2*P.clear-v.x});
    return points.map((a,i)=>{const b=points[(i+1)%points.length];return {t:'L',x1:a.x,y1:a.y,x2:b.x,y2:b.y};});
  }
  if (Array.isArray(it.customShape) && it.customShape.length >= 3) {
    const p = g.pocket, pts = it.customShape;
    const map = v => it.shape === "cyl" || !g.rot
      ? { x: p.x + v.x * p.w, y: p.y + v.y * p.h }
      : { x: p.x + v.y * p.w, y: p.y + (1 - v.x) * p.h };
    return pts.map((v, i) => { const n = pts[(i + 1) % pts.length], a = map(v), b = map(n); return { t: "L", x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
  }
  if (it.shape === "cyl") return [{ t: "C", cx: g.pocket.x + g.pocket.w / 2, cy: g.pocket.y + g.pocket.h / 2, r: g.pocket.w / 2 }];
  return rrSegs(g.pocket, P.toolR, g.notch);
}
function segsLength(segs) {
  return segs.reduce((s, g) => s + (g.t === "L" ? Math.hypot(g.x2 - g.x1, g.y2 - g.y1) : g.t === "A" ? g.r * (g.a1 - g.a0) * Math.PI / 180 : 2 * Math.PI * g.r), 0);
}
const mirrorRect = (r, W) => ({ x: r.x, y: W - r.y - r.h, w: r.w, h: r.h });
