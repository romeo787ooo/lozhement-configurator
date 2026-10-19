"use strict";
// Запуск: инициализация интерфейса и первый расчёт.

// ---------- Запуск ----------
function init() {
  renderCats(); renderCaseList(); renderCaseCard(); renderTemplates(); renderItems(); renderParams();
  $("q").value = S.query; $("mat").value = S.material; $("qty").value = S.qty; $("need-case").checked = S.needCase;
  $("f-name").value = S.form.name || ""; $("f-contact").value = S.form.contact || ""; $("f-org").value = S.form.org || ""; $("f-comment").value = S.form.comment || "";
  $("q").addEventListener("input", e => { S.query = e.target.value; renderCaseList(); });
  $("btn-suggest").onclick = suggestCases;
  $("btn-add").onclick = () => { S.items.push(mkItem({ name: "Предмет " + (S.items.length + 1), shape: "rect", l: 100, w: 60, h: 40 })); renderItems(); relayout(); };
  $("btn-add-tpl").onclick = () => { S.items.push(mkItem(TEMPLATES[+$("tpl").value])); renderItems(); relayout(); };
  $("mat").onchange = e => { S.material = e.target.value; refresh(); };
  $("qty").addEventListener("input", e => { S.qty = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)); refresh(); });
  $("need-case").onchange = e => { S.needCase = e.target.checked; refresh(); };
  ["f-name", "f-contact", "f-org", "f-comment"].forEach(id => $(id).addEventListener("input", () => { S.form[id.slice(2)] = $(id).value; saveDraft(); }));
  $("order-form").addEventListener("submit", submitOrder);
  $("btn-svg").onclick = exportSvg;
  $("btn-auto").onclick = () => relayout();
  $("btn-rot").onclick = rotateSelected;
  const v = $("view");
  v.addEventListener("pointerdown", onDown); v.addEventListener("pointermove", onMove);
  v.addEventListener("pointerup", onUp); v.addEventListener("pointercancel", onUp);
  v.addEventListener("focusin", e => { const g = e.target.closest && e.target.closest(".pk"); if (g && S.selected !== g.dataset.key) { selectItem(g.dataset.key); const n = v.querySelector('.pk[data-key="' + g.dataset.key + '"]'); if (n) n.focus(); } });
  document.addEventListener("keydown", e => {
    if (typeof sketchIsOpen === "function" && sketchIsOpen()) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    if (!S.selected || !S.place[S.selected]) return;
    const refocus = () => { const n = v.querySelector('.pk[data-key="' + S.selected + '"]'); if (n) n.focus(); };
    if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") { rotateSelected(); refocus(); e.preventDefault(); return; }
    const step = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (mv) { const p = S.place[S.selected]; S.place[S.selected] = { x: p.x + mv[0], y: p.y + mv[1], rot: p.rot }; refresh(); refocus(); e.preventDefault(); }
  });
  if (!Object.keys(S.place || {}).length) relayout(); else refresh();
  renderDone();
}
initView3();
initLayout();
initZoom2D();
initTools();
initSketchEditor();
init();
