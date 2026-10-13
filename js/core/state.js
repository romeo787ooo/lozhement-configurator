"use strict";
// Состояние конфигуратора и черновик в localStorage.

function defaultState() {
  uid = 1;
  return {
    caseId: "7030", cat: -1, query: "", material: "ppe-black", qty: 1, needCase: false,
    params: Object.fromEntries(PARAMS.map(p => [p[0], p[2]])),
    items: [mkItem(TEMPLATES[0], { qty: 2 }), mkItem(TEMPLATES[2], { qty: 2 }), mkItem(TEMPLATES[3], { qty: 6 }), mkItem(TEMPLATES[4], { qty: 2 }), mkItem(TEMPLATES[5]), mkItem(TEMPLATES[6], { qty: 3 }), mkItem(TEMPLATES[10], { qty: 2 }), mkItem(TEMPLATES[7], { zone: "lid", notch: false }), mkItem({ name: "Ноутбук 15\"", shape: "rect", l: 380, w: 260, h: 30 }, { zone: "lid", notch: false })],
    place: {}, selected: null, form: { name: "", contact: "", org: "", comment: "" }, submitted: null
  };
}
let S = defaultState();
const STORE = "lozhement-draft-3d-demo";
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved && saved.items && caseById(saved.caseId)) {
    S = Object.assign(defaultState(), saved, { submitted: null, selected: null });
    uid = 1 + Math.max(0, ...S.items.map(i => +String(i.id).slice(1) || 0));
  }
} catch (e) { /* черновик недоступен — работаем с примером */ }
S.items.forEach(ensureOrient);
function saveDraft() {
  try { localStorage.setItem(STORE, JSON.stringify(Object.assign({}, S, { submitted: null }))); } catch (e) { /* без черновика */ }
}
