"use strict";
// Положение предмета: на какую грань класть, варианты ориентации.

// ---------- Положение предмета: на какую грань класть ----------
function orientDims(it, up) {
  const d = it.dim;
  if (it.kind === "cyl") return up === 2 ? { shape: "cyl", l: d[0], w: d[0], h: d[2] } : { shape: "rect", l: d[2], w: d[0], h: d[0] };
  const r = [0, 1, 2].filter(i => i !== up);
  return { shape: "rect", l: d[r[0]], w: d[r[1]], h: d[up] };
}
function applyOrient(it, up) { it.up = up; Object.assign(it, orientDims(it, up)); }
function orientsOf(it) {
  const d = it.dim;
  if (it.kind === "cyl") {
    const o = [{ up: 2, label: "стоя", ...orientDims(it, 2) }];
    if (Math.abs(d[2] - d[0]) > 0.5) o.push({ up: 0, label: "лёжа", ...orientDims(it, 0) });
    return o;
  }
  const rank = [0, 1, 2].sort((a, b) => d[a] - d[b]), names = ["плашмя", "на длинном ребре", "на коротком ребре"], seen = new Set(), out = [];
  rank.forEach((up, k) => {
    const od = orientDims(it, up), key = [Math.min(od.l, od.w), Math.max(od.l, od.w), od.h].join("|");
    if (!seen.has(key)) { seen.add(key); out.push({ up, label: names[k], ...od }); }
  });
  return out;
}
function ensureOrient(it) {
  if (!it.kind) it.kind = it.shape;
  if (!it.dim) { it.dim = it.kind === "cyl" ? [it.l, it.l, it.h] : [it.l, it.w, it.h]; it.orient = "auto"; it.pref = 2; it.up = 2; }
  if (it.orient == null) it.orient = "auto";
  if (it.pref == null) it.pref = 2;
  applyOrient(it, it.orient === "auto" ? it.pref : +it.orient);
  return it;
}
function fillOrient(it, s) {
  const os = orientsOf(it), cur = os.find(o => o.up === it.up) || os[0];
  const txt = o => o.label + ": " + (o.shape === "cyl" ? "Ø" + o.l : o.l + "×" + o.w) + ", высота " + o.h;
  s.textContent = "";
  const add = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; s.appendChild(o); };
  add("auto", "Авто → " + txt(cur));
  for (const o of os) add(String(o.up), txt(o));
  s.value = [...s.options].some(o => o.value === String(it.orient)) ? String(it.orient) : "auto";
  s.disabled = os.length < 2;
}
