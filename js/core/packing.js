"use strict";
// Раскладка вырезов: MaxRects с поворотом, ряды одинаковых предметов.

// ---------- Раскладка: MaxRects (лучшее совпадение короткой стороны) с поворотом на 90° ----------
function mrPack(W, H, list, obstacles) {
  let free = [{ x: 0, y: 0, w: W, h: H }];
  const occupy = r => {
    const nf = [];
    for (const f of free) {
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) { nf.push(f); continue; }
      if (r.x > f.x) nf.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w) nf.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
      if (r.y > f.y) nf.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h) nf.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
    }
    const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    free = nf.filter((a, i) => a.w > 0.01 && a.h > 0.01 && !nf.some((b, j) => j !== i && b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h && (j < i || !same(a, b))));
  };
  obstacles.forEach(occupy);
  const out = {}, miss = [];
  for (const it of list) {
    let best = null;
    for (const f of free) for (const o of it.opts) {
      if (o.w > f.w + 1e-6 || o.h > f.h + 1e-6) continue;
      const s1 = Math.min(f.w - o.w, f.h - o.h), s2 = Math.max(f.w - o.w, f.h - o.h);
      if (!best || s1 < best.s1 - 1e-6 || (Math.abs(s1 - best.s1) < 1e-6 && (s2 < best.s2 - 1e-6 || (Math.abs(s2 - best.s2) < 1e-6 && f.y + f.x < best.y + best.x))))
        best = { s1, s2, x: f.x, y: f.y, w: o.w, h: o.h, rot: o.rot, o };
    }
    if (!best) { miss.push(it.key); continue; }
    out[it.key] = { x: best.x, y: best.y, rot: best.rot, o: best.o };
    occupy({ x: best.x, y: best.y, w: best.w, h: best.h });
  }
  return { out, miss };
}
const SORTS = [
  (a, b) => b.area - a.area, (a, b) => b.maxs - a.maxs, (a, b) => b.per - a.per,
  (a, b) => b.opts[0].w - a.opts[0].w, (a, b) => b.opts[0].h - a.opts[0].h
];
function packZone(W, H, list, obstacles) {
  let best = null;
  for (const s of SORTS) {
    const r = mrPack(W, H, list.slice().sort(s), obstacles);
    if (!best || r.miss.length < best.miss.length) best = r;
    if (!r.miss.length) break;
  }
  return best || { out: {}, miss: [] };
}
// Упаковка экземпляров с группировкой одинаковых предметов в ряды (qty > 1): сначала пробуем блок «k в ряд × m рядов»
function packInst(P, insts, Wc, Hc, obst) {
  const b = P.bridge;
  const cellOf = (it, rot) => { const d = fpDims(it, P, rot); return { w: d.w + b, h: d.h + b }; };
  const mk = (key, opts) => ({ key, opts, area: opts[0].w * opts[0].h, maxs: Math.max(opts[0].w, opts[0].h), per: opts[0].w + opts[0].h });
  const single = x => { const o = [{ ...cellOf(x.it, 0), rot: 0 }]; if (x.it.shape !== "cyl") o.push({ ...cellOf(x.it, 1), rot: 90 }); return mk(x.key, o); };
  const byItem = new Map();
  for (const x of insts) { if (!byItem.has(x.it.id)) byItem.set(x.it.id, []); byItem.get(x.it.id).push(x); }
  let groups = []; const solo = [];
  for (const arr of byItem.values()) (arr.length > 1 ? groups : solo).push(...(arr.length > 1 ? [arr] : arr));
  for (let pass = 0; pass <= byItem.size + 1; pass++) {
    const list = solo.map(single), gm = new Map();
    for (const arr of groups) {
      const n = arr.length, it = arr[0].it, opts = [], seen = new Set();
      for (const rot of it.shape === "cyl" ? [0] : [0, 90]) {
        const cell = cellOf(it, rot);
        for (let cols = 1; cols <= n; cols++) {
          const rows = Math.ceil(n / cols); if (cols * rows - n >= cols) continue;
          const w = cols * cell.w, h = rows * cell.h, k = w + "|" + h; if (seen.has(k)) continue; seen.add(k);
          opts.push({ w, h, rot, cols, cell });
        }
      }
      opts.sort((a, c) => a.h - c.h || a.w - c.w);
      const key = "G:" + it.id; gm.set(key, arr); list.push(mk(key, opts));
    }
    const r = packZone(Wc, Hc, list, obst), missG = r.miss.filter(k => gm.has(k));
    if (!missG.length) {
      const out = {};
      for (const k in r.out) {
        if (!gm.has(k)) { out[k] = r.out[k]; continue; }
        const g = r.out[k], arr = gm.get(k);
        arr.forEach((x, i) => { out[x.key] = { x: g.x + (i % g.o.cols) * g.o.cell.w, y: g.y + Math.floor(i / g.o.cols) * g.o.cell.h, rot: g.rot }; });
      }
      return { out, miss: r.miss };
    }
    // блок не поместился: разбиваем эту группу на отдельные экземпляры и пробуем снова
    groups = groups.filter(arr => !missG.includes("G:" + arr[0].it.id));
    for (const k of missG) solo.push(...gm.get(k));
  }
  return { out: {}, miss: insts.map(x => x.key) };
}

// Раскладка всех предметов для кейса c. Возвращает словарь размещений (нет ключа — не поместился).
function arrangeBase(c, P, items) {
  const F = foamOf(c, P), b = P.bridge, om = P.margin - b / 2, Wc = F.L - 2 * om, Hc = F.W - 2 * om;
  const all = instances(items), place = {};
  const body = packInst(P, all.filter(x => x.it.zone !== "lid"), Wc, Hc, []);
  for (const k in body.out) place[k] = { x: P.margin + body.out[k].x, y: P.margin + body.out[k].y, rot: body.out[k].rot };
  const obst = [];
  for (const x of all) {
    if (x.it.zone === "lid" || !place[x.key]) continue;
    const d = depthInfo(x.it, c, P, "body");
    if (!d.protr) continue;
    const m = mirrorRect(geom(x.it, place[x.key], P).pocket, F.W);
    obst.push({ x: m.x - b / 2 - om, y: m.y - b / 2 - om, w: m.w + b, h: m.h + b });
  }
  const lid = packInst(P, all.filter(x => x.it.zone === "lid"), Wc, Hc, obst);
  for (const k in lid.out) place[k] = { x: P.margin + lid.out[k].x, y: P.margin + lid.out[k].y, rot: lid.out[k].rot };
  return place;
}
