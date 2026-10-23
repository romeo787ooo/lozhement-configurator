"use strict";
// Оценка цены ложемента по условным тарифам.

// ---------- Цена ----------
const fmt = n => Math.round(n).toLocaleString("ru-RU");
function quote(A) {
  const { F, c, P } = A, k = MATERIALS[S.material].k;
  const vol = F.L * F.W * ((hasTiers()?S.tiers.reduce((n,t)=>n+t.thickness,0):c.body) + c.lid) / 1e6;
  const outline = segsLength(rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null)) * (tierList(c).length+1);
  let pockets = 0;
  for (const r of A.res) if (r.g) pockets += segsLength(pocketSegs(r.it, r.g, P));
  for (const g of A.ghosts) pockets += segsLength(g.it.shape === "cyl" ? [{ t: "C", r: g.rect.w / 2 }] : rrSegs(g.rect, P.toolR, null));
  const cut = (outline + pockets) / 1000;
  const mat = vol * P.rateVol * k, cutCost = cut * P.rateCut, unit = mat + cutCost, qty = Math.max(1, S.qty | 0);
  return { vol, cut, mat, cutCost, unit, qty, setup: P.setup, total: P.setup + unit * qty };
}
