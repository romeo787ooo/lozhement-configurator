"use strict";
// Шаг 3: технологические параметры.

// ---------- Шаг 3: параметры ----------
function renderParams() {
  const g = $("pgrid"); g.textContent = "";
  for (const [k, label] of PARAMS) {
    const l = document.createElement("label"), i = document.createElement("input");
    l.textContent = label; l.htmlFor = "p-" + k; i.id = "p-" + k; i.type = "number"; i.min = "0"; i.value = S.params[k];
    i.addEventListener("input", () => { const v = parseFloat(i.value); if (isFinite(v) && v >= 0) { S.params[k] = v; debouncedRelayout(); } });
    g.append(l, i);
  }
  const reset = document.createElement("button"); reset.type = "button"; reset.className = "btn sm"; reset.textContent = "Вернуть значения по умолчанию"; reset.style.gridColumn = "1 / -1";
  reset.onclick = () => { S.params = Object.fromEntries(PARAMS.map(p => [p[0], p[2]])); renderParams(); relayout(); };
  g.appendChild(reset);
}
