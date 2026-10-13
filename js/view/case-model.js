"use strict";
// Точные модели кейсов и цвет кейса в 3D.

// ---------- Точные модели кейсов (STL → встроенные упрощённые сетки) ----------
function b64buf(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
function getCaseMesh(id) {
  const d = typeof CASE_MESH !== "undefined" && CASE_MESH[id]; if (!d || !V3.gl) return null;
  if (d._m !== undefined) return d._m;
  const gl = V3.gl; d._m = null;
  if (!V3.u32 && !(d.lid.w16 && d.base.w16)) return null;
  const zh = d.hinge > 0 ? d.zmax : d.zmin;
  const mk = (part, map) => {
    const q = new Uint16Array(b64buf(part.v)), n = q.length / 3, pos = new Float32Array(q.length), nor = new Float32Array(q.length);
    for (let i = 0; i < n; i++) { const r = map(part.o[0] + q[3 * i] * d.s, part.o[1] + q[3 * i + 1] * d.s, part.o[2] + q[3 * i + 2] * d.s); pos[3 * i] = r[0]; pos[3 * i + 1] = r[1]; pos[3 * i + 2] = r[2]; }
    const idx = part.w16 ? new Uint16Array(b64buf(part.i)) : new Uint32Array(b64buf(part.i));
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { nor[k] += nx; nor[k + 1] += ny; nor[k + 2] += nz; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(nor[3 * i], nor[3 * i + 1], nor[3 * i + 2]) || 1; nor[3 * i] /= l; nor[3 * i + 1] /= l; nor[3 * i + 2] /= l; }
    const buf = (tgt, data) => { const b = gl.createBuffer(); gl.bindBuffer(tgt, b); gl.bufferData(tgt, data, gl.STATIC_DRAW); return b; };
    return { pb: buf(gl.ARRAY_BUFFER, pos), nb: buf(gl.ARRAY_BUFFER, nor), ib: buf(gl.ELEMENT_ARRAY_BUFFER, idx), cnt: idx.length, w16: part.w16 };
  };
  // система STL: X — длина, Y — вверх, Z — ширина; в закрытом положении плоскость разъёма на Y = 0
  d._m = {
    d,
    base: mk(d.base, (X, Y, Z) => [X + d.L / 2, d.W - Math.abs(Z - zh), Y - d.ymin_b]),
    lid: mk(d.lid, (X, Y, Z) => [X + d.L / 2, d.W - Math.abs(Z - zh), Y - d.ymin_b]),
  };
  return d._m;
}

// ---------- Цвет кейса (пример набора; позже список подгрузится из каталога) ----------
const CASE_COLORS = [["Чёрный", "#2f3438"], ["Серый", "#7d868e"], ["Оливковый", "#5f6b3c"], ["Жёлтый", "#e2b714"], ["Оранжевый", "#e8590c"], ["Синий", "#2f5fd0"]];
function caseColor() { return (S.caseColor && /^#[0-9a-f]{6}$/i.test(S.caseColor)) ? S.caseColor : CASE_COLORS[1][1]; }
function initColors3() {
  const box = $("v3c"); box.textContent = "";
  for (const [name, hex] of CASE_COLORS) {
    const b = document.createElement("button"); b.type = "button"; b.className = "csw"; b.style.background = hex; b.title = name; b.setAttribute("aria-label", "Цвет кейса: " + name);
    b.onclick = () => { S.caseColor = hex; saveDraft(); mark(); render3D(); };
    box.appendChild(b);
  }
  const mark = () => box.querySelectorAll(".csw").forEach((b, i) => b.setAttribute("aria-pressed", String(CASE_COLORS[i][1] === caseColor())));
  mark(); V3.markColor = mark;
}
