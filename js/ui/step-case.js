"use strict";
// Шаг 1: выбор кейса.

// ---------- Шаг 1: кейс ----------
function renderCats() {
  const el = $("cats"); el.textContent = "";
  [["Все", -1], ...CATS.map((n, i) => [n, i])].forEach(([n, i]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = n;
    b.setAttribute("aria-pressed", String(S.cat === i));
    b.onclick = () => { S.cat = i; renderCats(); renderCaseList(); };
    el.appendChild(b);
  });
}
function caseMatches(c) {
  if (S.cat >= 0 && c.cat !== S.cat) return false;
  const q = S.query.toLowerCase().replace(/pelican|peli|калибр/g, "").trim();
  if (!q) return true;
  return c.id.toLowerCase().includes(q) || c.peli.toLowerCase().includes(q);
}
function renderCaseList() {
  const el = $("case-list"); el.textContent = "";
  const list = CASES.filter(caseMatches);
  if (!list.length) { const p = document.createElement("p"); p.className = "hint"; p.style.padding = "10px"; p.textContent = "Ничего не найдено. Попробуйте номер модели, например 4035."; el.appendChild(p); return; }
  for (const c of list) {
    const b = document.createElement("button"); b.type = "button"; b.className = "case-row"; b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(c.id === S.caseId));
    b.innerHTML = '<span class="m"></span><span class="d mono"></span><span class="p"></span>';
    b.children[0].textContent = c.id;
    if(typeof CASE_MESH!=="undefined"&&CASE_MESH[c.id]){
      const badge=document.createElement('span');badge.className='case-model-badge';badge.textContent='3D';badge.title='Доступна реальная 3D-модель кейса';badge.setAttribute('aria-label',badge.title);b.children[0].append(' ',badge);
    }
    b.children[1].textContent = c.l + "×" + c.w + "×" + c.h;
    b.children[2].textContent = c.peli ? "Peli " + c.peli.split(",")[0] : "";
    b.onclick = () => { S.caseId = c.id; renderCaseList(); renderCaseCard(); relayout(); };
    el.appendChild(b);
  }
}
function renderCaseCard() {
  const c = curCase(), el = $("case-card");
  const rows = [
    ["Внутри", c.l + " × " + c.w + " × " + c.h + " мм"],
    ["Крышка / корпус", c.lid + " / " + c.body + " мм"],
    ["Снаружи", c.out.l + " × " + c.out.w + " × " + c.out.h + " мм"],
    ["Аналог Peli", c.peli || "не указан"],
    ["У дилера", c.price ? "от " + fmt(c.price) + " ₽ без наполнителя (hardcases.ru)" : "нет данных"]
  ];
  el.innerHTML = '<div class="name"></div><dl class="kv"></dl>';
  el.querySelector(".name").textContent = caseName(c);
  const dl = el.querySelector("dl");
  for (const [k, v] of rows) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; if (k !== "Аналог Peli" && k !== "У дилера") dd.className = "mono"; dl.append(dt, dd); }
}
