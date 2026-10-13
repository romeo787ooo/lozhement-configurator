"use strict";
// Подбор кейса по предметам.

// ---------- Подбор кейса по предметам ----------
function suggestCases() {
  const box = $("suggest"); box.hidden = false; box.textContent = "";
  if (!S.items.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "Сначала добавьте предметы в шаге 2."; box.appendChild(p); return; }
  const found = [], snap = S.items.map(i => i.up);
  for (const c of CASES) {
    const place = arrangeFor(c, S.params, S.items), a = analyze(c, S.params, S.items, place);
    if (!a.errors) found.push({ c, place, fill: a.fillBody, vol: c.l * c.w * c.h, ups: S.items.map(i => i.up) });
  }
  S.items.forEach((i, k) => applyOrient(i, snap[k]));
  found.sort((a, b) => a.vol - b.vol);
  const head = document.createElement("p"); head.className = "hint"; head.style.margin = "0";
  head.textContent = found.length ? "Подходят " + found.length + " моделей. Самые компактные:" : "Ни один кейс не подошёл. Уменьшите число предметов или разделите комплект на два кейса.";
  box.appendChild(head);
  for (const f of found.slice(0, 5)) {
    const b = document.createElement("button"); b.type = "button"; b.className = "sug";
    b.innerHTML = '<span><b></b> <span class="mono"></span><br><span class="hint" style="margin:0"></span></span><span class="chip ok"></span>';
    b.querySelector("b").textContent = caseName(f.c);
    b.querySelector(".mono").textContent = f.c.l + "×" + f.c.w + "×" + f.c.h;
    b.querySelector(".hint").textContent = [f.c.peli ? "аналог Peli " + f.c.peli.split(",")[0] : "", f.c.price ? "у дилера от " + fmt(f.c.price) + " ₽" : ""].filter(Boolean).join(" · ") || "цена по запросу";
    b.querySelector(".chip").textContent = "заполнение " + Math.round(f.fill * 100) + "%";
    b.onclick = () => { S.items.forEach((i, k) => applyOrient(i, f.ups[k])); S.caseId = f.c.id; S.place = f.place; box.hidden = true; renderCaseList(); renderCaseCard(); refresh(); };
    box.appendChild(b);
  }
}
