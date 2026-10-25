"use strict";
// Нумерация вырезов, DXF для станка, чертёж SVG.

// ---------- Нумерация вырезов ----------
function numbering(A) {
  const pick = z => A.res.filter(r => r.g && r.zone === z).sort((a, b) => (b.g.pocket.y + b.g.pocket.h) - (a.g.pocket.y + a.g.pocket.h) || a.g.pocket.x - b.g.pocket.x);
  const list = []; let n = 1;
  for (const r of pick("body")) list.push({ no: String(n++), r });
  for (const r of pick("lid")) list.push({ no: String(n++), r });
  const ghostNo = {};
  for (const x of list) ghostNo[x.r.key] = x.no + "'";
  return { list, ghostNo };
}
const TR = { "Д": "D", "Т": "T", "Кофр": "Kofr" };
const latin = s => String(s).replace(/Кофр|Д|Т/g, m => TR[m]).replace(/[^\x20-\x7E]/g, "");
const pad3 = n => String(Math.round(n)).padStart(3, "0");
const sizeTxt = (it, P) => it.shape === "cyl" ? "Ø" + r1(it.l + 2 * P.clear) : r1(it.l + 2 * P.clear) + "×" + r1(it.w + 2 * P.clear);

// ---------- DXF (R12, мм, слой на каждую глубину выреза) ----------
function dxfFor(zone, A, nums) {
  const { F, P, c } = A, ents = [], layers = new Map([["KONTUR", 7], ["METKI", 8]]), f = v => (+v).toFixed(3);
  const colors = [1, 2, 3, 4, 5, 6, 30, 140, 210];
  const lay = depth => { const n = "VYREZ_D" + pad3(depth); if (!layers.has(n)) layers.set(n, colors[(layers.size - 2) % colors.length]); return n; };
  const ent = (g, ly) => {
    if (g.t === "L") return ["0", "LINE", "8", ly, "10", f(g.x1), "20", f(g.y1), "30", "0", "11", f(g.x2), "21", f(g.y2), "31", "0"];
    if (g.t === "C") return ["0", "CIRCLE", "8", ly, "10", f(g.cx), "20", f(g.cy), "30", "0", "40", f(g.r)];
    const s = ((g.a0 % 360) + 360) % 360, e = ((g.a1 % 360) + 360) % 360;
    return ["0", "ARC", "8", ly, "10", f(g.cx), "20", f(g.cy), "30", "0", "40", f(g.r), "50", f(s), "51", f(e)];
  };
  const th = Math.max(5, Math.min(12, F.L / 60));
  const text = (t, x, y) => ["0", "TEXT", "8", "METKI", "10", f(x), "20", f(y), "30", "0", "40", f(th), "1", t, "72", "1", "73", "2", "11", f(x), "21", f(y), "31", "0"];
  const out = [];
  rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null).forEach(g => out.push(ent(g, "KONTUR")));
  for (const { no, r } of nums.list.filter(x => x.r.zone === zone)) {
    const ly = lay(r.d.depth);
    if(r.it.stepParentId)out.push(['999','STEPPED POCKET '+no+'; start depth '+r.d.startDepth+' mm; bottom depth '+r.d.depth+' mm; upper pocket '+nums.list.find(x=>x.r.it.id===r.it.stepParentId)?.no]);
    pocketSegs(r.it, r.g, P).forEach(g => out.push(ent(g, ly)));
    out.push(text(no, r.g.pocket.x + r.g.pocket.w / 2, r.g.pocket.y + r.g.pocket.h / 2));
  }
  if (zone === "lid") for (const g of A.ghosts) {
    const ly = lay(g.depth), segs = g.it.shape === "cyl" ? [{ t: "C", cx: g.rect.x + g.rect.w / 2, cy: g.rect.y + g.rect.h / 2, r: g.rect.w / 2 }] : rrSegs(g.rect, P.toolR, null);
    segs.forEach(s => out.push(ent(s, ly)));
    out.push(text(nums.ghostNo[g.key] || "'", g.rect.x + g.rect.w / 2, g.rect.y + g.rect.h / 2));
  }
  const depth = zone === "lid" ? c.lid : c.body;
  const head = ["999", ...(A.exportTier?["Tier "+(A.exportTier.index+1)+"; bottom >= "+A.exportTier.bottom+" mm; Z="+A.exportTier.offset+" mm", "999"]:[]), "Lozhement Kalibr " + latin(c.id) + " " + (zone === "lid" ? "KRYSHKA" : "KORPUS") + " " + r1(F.L) + "x" + r1(F.W) + "x" + depth + " mm. Sloi VYREZ_Dnnn: glubina vyreza nnn mm.",
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "9", "$INSUNITS", "70", "4",
    "9", "$EXTMIN", "10", "0", "20", "0", "9", "$EXTMAX", "10", f(F.L), "20", f(F.W), "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0", "0", "ENDTAB",
    "0", "TABLE", "2", "LAYER", "70", String(layers.size)];
  for (const [n, col] of layers) head.push("0", "LAYER", "2", n, "70", "0", "62", String(col), "6", "CONTINUOUS");
  head.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
  return head.concat(...out, ["0", "ENDSEC", "0", "EOF"]).join("\r\n") + "\r\n";
}

// ---------- Чертёж SVG ----------
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
function drawingSVG(A, nums, order) {
  if(hasTiers()&&!A.exportTier)return drawingTiersSVG(A,nums,order);
  const { F, P, c } = A, fs = Math.max(5, Math.min(14, F.L / 70)), pad = fs * 3, x0 = pad + fs * 4;
  const lidTop = pad + fs * 3, bodyTop = lidTop + F.W + fs * 8, tx0 = x0 + F.L + fs * 6, tw = fs * 46, rh = fs * 1.9;
  const rows = [];
  for (const { no, r } of nums.list) rows.push([no, r.it.name+(r.it.stepParentId?' (нижняя ступень)':''), sizeTxt(r.it, P), r.it.stepParentId?r.d.startDepth+'–'+r.d.depth:r.d.depth, r1(r.g.pocket.x), r1(r.g.pocket.y), r.zone === "lid" ? "крышка" : "корпус"]);
  for (const g of A.ghosts) rows.push([nums.ghostNo[g.key], g.it.name + " (ответный)", sizeTxt(g.it, P), g.depth, r1(g.rect.x), r1(g.rect.y), "крышка"]);
  const tableH = rh * (rows.length + 1), noteY = lidTop + tableH + fs * 2, titleY = noteY + fs * 8, titleH = fs * 13;
  const W = tx0 + tw + pad, H = Math.max(bodyTop + F.W + fs * 6 + pad, titleY + titleH + pad);
  const o = [];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + r1(W) + 'mm" height="' + r1(H) + 'mm" viewBox="0 0 ' + r1(W) + " " + r1(H) + '" font-family="Golos Text, Arial, sans-serif" fill="none" stroke="#111">');
  o.push('<rect x="0" y="0" width="' + r1(W) + '" height="' + r1(H) + '" fill="#fff" stroke="none"/>');
  o.push('<rect x="' + r1(pad / 2) + '" y="' + r1(pad / 2) + '" width="' + r1(W - pad) + '" height="' + r1(H - pad) + '" stroke-width="0.5"/>');
  const T = (x, y, s, size, extra) => o.push('<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + r1(size || fs) + '" fill="#111" stroke="none"' + (extra || "") + ">" + esc(s) + "</text>");
  const view = (zone, top) => {
    const tx = x => x0 + x, ty = y => top + F.W - y, depth = zone === "lid" ? c.lid : c.body;
    T(x0, top - fs * 1.2, (zone === "lid" ? "КРЫШКА" : "КОРПУС") + " · ложемент " + r1(F.L) + " × " + r1(F.W) + " × " + depth + " мм", fs * 1.1, ' font-weight="600"');
    o.push('<path d="' + segPath(rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null), tx, ty) + '" stroke-width="0.7"/>');
    const label = (no, cx, cy) => { o.push('<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(fs * 0.95) + '" fill="#fff" stroke-width="0.35"/>'); T(cx, cy + fs * 0.35, no, fs * 0.95, ' text-anchor="middle"'); };
    for (const { no, r } of nums.list.filter(x => x.r.zone === zone)) {
      const segs = pocketSegs(r.it, r.g, P);
      const style=' stroke-width="0.5"'+(r.it.stepParentId?' stroke-dasharray="3 2"':'');
      if (segs[0].t === "C") o.push('<circle cx="' + r1(tx(segs[0].cx)) + '" cy="' + r1(ty(segs[0].cy)) + '" r="' + r1(segs[0].r) + '"'+style+'/>');
      else o.push('<path d="' + segPath(segs, tx, ty) + '"'+style+'/>');
      label(no, tx(r.g.pocket.x + r.g.pocket.w / 2), ty(stepChild(r.it)?r.g.pocket.y+r.g.pocket.h-fs*2:r.g.pocket.y + r.g.pocket.h / 2));
    }
    if (zone === "lid") for (const g of A.ghosts) {
      const dash = ' stroke-width="0.5" stroke-dasharray="' + r1(fs * 0.6) + " " + r1(fs * 0.4) + '"';
      if (g.it.shape === "cyl") o.push('<circle cx="' + r1(tx(g.rect.x + g.rect.w / 2)) + '" cy="' + r1(ty(g.rect.y + g.rect.h / 2)) + '" r="' + r1(g.rect.w / 2) + '"' + dash + "/>");
      else o.push('<path d="' + segPath(rrSegs(g.rect, P.toolR, null), tx, ty) + '"' + dash + "/>");
      label(nums.ghostNo[g.key], tx(g.rect.x + g.rect.w / 2), ty(g.rect.y + g.rect.h / 2));
    }
    const yb = top + F.W, yd = yb + fs * 2.2, xd = x0 - fs * 2.2, tk = fs * 0.5;
    o.push('<path d="M' + r1(x0) + " " + r1(yb + fs * 0.4) + " V" + r1(yd + fs * 0.6) + " M" + r1(x0 + F.L) + " " + r1(yb + fs * 0.4) + " V" + r1(yd + fs * 0.6) + " M" + r1(x0) + " " + r1(yd) + " H" + r1(x0 + F.L) +
      " M" + r1(x0 - tk) + " " + r1(yd + tk) + " l" + r1(2 * tk) + " " + r1(-2 * tk) + " M" + r1(x0 + F.L - tk) + " " + r1(yd + tk) + " l" + r1(2 * tk) + " " + r1(-2 * tk) + '" stroke-width="0.3"/>');
    T(x0 + F.L / 2, yd - fs * 0.4, r1(F.L), fs, ' text-anchor="middle"');
    o.push('<path d="M' + r1(x0 - fs * 0.4) + " " + r1(top) + " H" + r1(xd - fs * 0.6) + " M" + r1(x0 - fs * 0.4) + " " + r1(yb) + " H" + r1(xd - fs * 0.6) + " M" + r1(xd) + " " + r1(top) + " V" + r1(yb) +
      " M" + r1(xd - tk) + " " + r1(top + tk) + " l" + r1(2 * tk) + " " + r1(-2 * tk) + " M" + r1(xd - tk) + " " + r1(yb + tk) + " l" + r1(2 * tk) + " " + r1(-2 * tk) + '" stroke-width="0.3"/>');
    T(xd - fs * 0.4, top + F.W / 2, r1(F.W), fs, ' text-anchor="middle" transform="rotate(-90 ' + r1(xd - fs * 0.4) + " " + r1(top + F.W / 2) + ')"');
  };
  view("lid", lidTop); view("body", bodyTop);
  const cols = [0, 3, 22, 31, 36, 41, 46].map(k => tx0 + k * fs), heads = ["№", "Предмет", "Вырез", "Глуб.", "X", "Y"];
  o.push('<rect x="' + r1(tx0) + '" y="' + r1(lidTop) + '" width="' + r1(tw) + '" height="' + r1(tableH) + '" stroke-width="0.4"/>');
  heads.forEach((h, i) => T(cols[i] + fs * 0.4, lidTop + rh * 0.68, h, fs * 0.9, ' font-weight="600"'));
  rows.forEach((row, ri) => {
    const y = lidTop + rh * (ri + 1);
    o.push('<path d="M' + r1(tx0) + " " + r1(y) + " H" + r1(tx0 + tw) + '" stroke-width="0.25"/>');
    const name = row[1].length > 30 ? row[1].slice(0, 29) + "…" : row[1];
    [row[0], name, row[2], row[3], row[4], row[5]].forEach((v, i) => T(cols[i] + fs * 0.4, y + rh * 0.68, v, fs * 0.85));
  });
  for (let i = 1; i < 6; i++) o.push('<path d="M' + r1(cols[i]) + " " + r1(lidTop) + " V" + r1(lidTop + tableH) + '" stroke-width="0.25"/>');
  const notes = [
    "Размеры в мм. Вырезы включают зазор " + P.clear + " мм на сторону. Радиус углов вырезов R" + P.toolR + ".",
    "X, Y — от левого нижнего угла ложемента до левого нижнего угла выреза (габарит).",
    "Выемки под палец Ø" + P.notchD + " мм на глубину выреза. Номер со штрихом — ответный вырез в крышке.",
    "Глубина вырезов кратна " + P.step + " мм. Дно под вырезом не менее " + P.minBottom + " мм."
  ];
  notes.forEach((n, i) => T(tx0, noteY + i * fs * 1.5, n, fs * 0.8));
  o.push('<rect x="' + r1(tx0) + '" y="' + r1(titleY) + '" width="' + r1(tw) + '" height="' + r1(titleH) + '" stroke-width="0.6"/>');
  const tl = [
    ["Ложемент для кейса " + caseName(c), fs * 1.3, ' font-weight="700"'],
    ["Материал: " + MATERIALS[S.material].name + ". Количество: " + Math.max(1, S.qty | 0) + " компл.", fs * 0.9, ""],
    ["Корпус " + r1(F.L) + "×" + r1(F.W) + "×" + c.body + " мм, крышка " + r1(F.L) + "×" + r1(F.W) + "×" + c.lid + " мм", fs * 0.9, ""],
    ["Заказ " + order.no + " от " + order.date + (order.who ? ". Заказчик: " + order.who : ""), fs * 0.9, ""],
    ["Масштаб 1:1. Сформировано конструктором ложементов (прототип).", fs * 0.8, ""]
  ];
  tl.forEach(([s, size, extra], i) => T(tx0 + fs * 0.8, titleY + fs * 2 + i * fs * 2.3, s, size, extra));
  o.push("</svg>");
  return o.join("\n");
}
