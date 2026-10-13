"use strict";
// Сводка, статус раскладки, цена, шаги мастера.

// ---------- Сводка, статус, цена ----------
function renderStatus() {
  const el = $("status-chips"); el.textContent = "";
  const add = (cls, txt) => { const s = document.createElement("span"); s.className = "chip " + cls; s.textContent = txt; el.appendChild(s); };
  if (!S.items.length) add("", "Добавьте предметы");
  else if (A.errors) add("err", "Нужно исправить: " + A.errors);
  else add("ok", "Всё помещается");
  if (A.warns) add("warn", "Ответных вырезов в крышке: " + A.warns);
}
function renderSummary() {
  const q = quote(A), el = $("summary");
  const cells = [
    ["Кейс", A.c.id, A.c.peli ? "аналог Peli " + A.c.peli.split(",")[0] : "аналог Peli не указан"],
    ["Заполнение корпуса", Math.round(A.fillBody * 100) + "%", "крышка " + Math.round(A.fillLid * 100) + "%"],
    ["Вырезов", String(A.res.filter(r => r.g).length + A.ghosts.length), "из них ответных " + A.ghosts.length],
    ["Оценка за комплект", fmt(q.unit) + " ₽", "без подготовки и кейса"]
  ];
  el.textContent = "";
  for (const [l, v, s] of cells) { const d = document.createElement("div"); d.innerHTML = '<div class="l"></div><div class="v"></div><div class="s"></div>'; d.children[0].textContent = l; d.children[1].textContent = v; d.children[2].textContent = s; el.appendChild(d); }
}
function renderPrice() {
  const q = quote(A), el = $("price"); el.textContent = "";
  const line = (a, b, cls) => { const d = document.createElement("div"); d.className = "line" + (cls ? " " + cls : ""); d.innerHTML = "<span></span><span class=\"mono\"></span>"; d.children[0].textContent = a; d.children[1].textContent = b; el.appendChild(d); };
  line("Материал: " + q.vol.toFixed(1) + " дм³ × " + S.params.rateVol + " ₽" + (MATERIALS[S.material].k !== 1 ? " × " + MATERIALS[S.material].k : ""), fmt(q.mat) + " ₽");
  line("Резка: " + q.cut.toFixed(1) + " м × " + S.params.rateCut + " ₽", fmt(q.cutCost) + " ₽");
  line("Комплект ложементов (корпус + крышка)", fmt(q.unit) + " ₽");
  line("Подготовка программы, один раз", fmt(q.setup) + " ₽");
  if (S.needCase) line("Кейс " + caseName(A.c), "по запросу");
  line("Итого за " + q.qty + " шт.", fmt(q.total) + " ₽", "tot");
  if (q.qty > 1) line("За комплект с учётом подготовки", fmt(q.total / q.qty) + " ₽");
}
function renderPath() {
  const st = { case: !!curCase(), items: S.items.length > 0, layout: S.items.length > 0 && !A.errors, order: !!S.submitted };
  let cur = false;
  document.querySelectorAll("#path li").forEach(li => {
    const done = st[li.dataset.p]; li.className = done ? "done" : !cur ? (cur = true, "cur") : "";
  });
}
