"use strict";
// Авторасстановка с подбором положения предметов.

// Авторасстановка с подбором положения: сначала как задано, затем переворачиваем предметы с режимом «Авто», пока всё не поместится
function layoutScore(c, P, items, place) {
  let p = 0, a = 0; const b = P.bridge;
  for (const x of instances(items)) { if (!place[x.key]) p++; if (depthInfo(x.it, c, P, x.it.zone === "lid" ? "lid" : "body").err) p++; const s = pocketSize(x.it, P); a += (s.pw + b) * (s.ph + b); }
  return { p, a };
}
function arrangeFor(c, P, items) {
  const autos = items.filter(i => i.orient === "auto" && orientsOf(i).length > 1);
  for (const it of items) applyOrient(it, it.orient === "auto" ? it.pref : +it.orient);
  let place = arrangeBase(c, P, items), cur = layoutScore(c, P, items, place);
  if (!autos.length || !cur.p) return place;
  // быстрая отсечка: даже при самых компактных положениях предметы не помещаются по площади
  const F = foamOf(c, P), cap = (F.L - 2 * P.margin) * (F.W - 2 * P.margin) * 1.02, sum = { body: 0, lid: 0 };
  for (const it of items) sum[it.zone === "lid" ? "lid" : "body"] += Math.max(1, it.qty | 0) * Math.min(...orientsOf(it).map(o => (o.l + 2 * P.clear + P.bridge) * (o.w + 2 * P.clear + P.bridge)));
  if ((!hasTiers() && sum.body > cap) || sum.lid > cap) return place;
  for (let g = 0; g < 6 && cur.p > 0; g++) {
    let best = null;
    for (const it of autos) {
      const keep = it.up;
      for (const o of orientsOf(it)) {
        if (o.up === keep) continue;
        applyOrient(it, o.up);
        const pl = arrangeBase(c, P, items), s = layoutScore(c, P, items, pl);
        if (!best || s.p < best.s.p || (s.p === best.s.p && s.a < best.s.a)) best = { it, up: o.up, pl, s };
      }
      applyOrient(it, keep);
    }
    if (!best || best.s.p > cur.p || (best.s.p === cur.p && best.s.a >= cur.a)) break;
    applyOrient(best.it, best.up); place = best.pl; cur = best.s;
  }
  return place;
}
