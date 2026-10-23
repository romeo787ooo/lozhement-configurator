"use strict";
// Проверка раскладки: края, перемычки, высота, ответные вырезы в крышке.

// ---------- Проверка раскладки ----------
const overlap = (a, b, g) => a.x < b.x + b.w + g - 1e-6 && b.x < a.x + a.w + g - 1e-6 && a.y < b.y + b.h + g - 1e-6 && b.y < a.y + a.h + g - 1e-6;
function analyze(c, P, items, place) {
  const F = foamOf(c, P), all = instances(items), res = [], ghosts = [];
  for (const x of all) {
    const zone = x.it.zone === "lid" ? "lid" : "body", d = depthInfo(x.it, c, P, zone), pl = place[x.key];
    const r = { key: x.key, it: x.it, n: x.n, zone, tierId: zone==='body'?tierFor(x.it,c).id:null, d, pl, g: pl ? geom(x.it, pl, P) : null, errs: [] };
    if (!pl) r.errs.push("не поместился в ложемент");
    if (d.err) r.errs.push(d.err);
    if (r.g) {
      const f = r.g.fp, m = P.margin - 0.01;
      if (f.x < m || f.y < m || f.x + f.w > F.L - m || f.y + f.h > F.W - m) r.errs.push("слишком близко к краю ложемента");
      if (zone === "body" && d.protr && !d.err) ghosts.push({ key: x.key, it: x.it, rect: mirrorRect(r.g.pocket, F.W), depth: d.lidDepth });
    }
    res.push(r);
  }
  for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) {
    const a = res[i], b = res[j];
    if (!a.g || !b.g || a.zone !== b.zone || a.tierId !== b.tierId) continue;
    if (overlap(a.g.fp, b.g.fp, P.bridge)) { a.errs.push("мало места до соседнего выреза"); b.errs.push("мало места до соседнего выреза"); }
  }
  for (const r of res) if (r.g && r.zone === "lid") for (const gh of ghosts) if (overlap(r.g.fp, gh.rect, P.bridge)) r.errs.push("пересекается с ответным вырезом в крышке");
  for (const r of res) {
    r.errs = [...new Set(r.errs)];
    r.level = r.errs.length ? "err" : r.d.protr ? "warn" : "ok";
    r.text = r.errs.length ? r.errs.join("; ")
      : r.d.protr ? "выступает на " + r.d.protr + " мм, в крышке ответный вырез " + r.d.lidDepth + " мм"
      : (r.zone === "lid" ? "в крышке" : "в корпусе") + ", глубина выреза " + r.d.depth + " мм";
  }
  const area = z => res.filter(r => r.g && r.zone === z).reduce((s, r) => s + (r.it.shape === "cyl" ? Math.PI * (r.g.pocket.w / 2) ** 2 : r.g.pocket.w * r.g.pocket.h), 0) / (F.L * F.W);
  return { c, P, F, res, ghosts, tierErrors:tierErrors(c), fillBody: area("body")/tierList(c).length, fillLid: area("lid"), errors: res.filter(r => r.level === "err").length+tierErrors(c).length, warns: res.filter(r => r.level === "warn").length };
}
