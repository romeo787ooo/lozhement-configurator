"use strict";
// Заказ: состав, сохранение файлов, пакет ZIP, отправка.

// ---------- Заказ ----------
function orderInfo() {
  const d = new Date(), p2 = n => String(n).padStart(2, "0");
  const no = S.submitted ? S.submitted.no : "Л-" + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + "-" + String(Math.floor(1000 + Math.random() * 9000));
  const date = S.submitted ? S.submitted.date : p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear();
  return { no, date, who: [S.form.name, S.form.org].filter(Boolean).join(", ") };
}
function orderText(A, nums, order, q) {
  const { F, P, c } = A, L = [];
  L.push("Заказ ложемента " + order.no + " от " + order.date, "");
  L.push("Кейс: " + caseName(c) + " (внутри " + c.l + "×" + c.w + "×" + c.h + " мм)" + (S.needCase ? ", кейс тоже нужен" : ", кейс у заказчика есть"));
  L.push("Материал: " + MATERIALS[S.material].name, "Количество комплектов: " + q.qty);
  for(const it of S.items.filter(i=>i.model))L.push('Импортированное изделие: '+it.name+'; источник '+it.model.source+'. Карман построен по внешней выпуклой проекции, глубина постоянная; проверить технологичность перед изготовлением.');
  L.push((hasTiers()?"Габарит пакета ярусов: ":"Ложемент корпуса: ") + r1(F.L) + "×" + r1(F.W) + "×" + (hasTiers()?tierHeight():c.body) + " мм; крышки: " + r1(F.L) + "×" + r1(F.W) + "×" + c.lid + " мм", "");
  L.push("Вырезы:");
  if(hasTiers())for(const [i,t] of tierList().entries())L.push('Ярус '+(i+1)+' снизу: '+t.name+'; толщина '+t.thickness+' мм; дно ≥ '+t.bottom+' мм; отметка '+r1(t.offset)+' мм; зазор сверху '+t.gap+' мм. Файл yarus-'+(i+1)+'.dxf');
  for (const { no, r } of nums.list) L.push("  " + no + ". " + r.it.name + " — предмет " + (r.it.shape === "cyl" ? "Ø" + r.it.l : r.it.l + "×" + r.it.w) + "×" + r.it.h + " мм, вырез " + sizeTxt(r.it, P) + ", глубина " + r.d.depth + " мм, " + (r.zone === "lid" ? "крышка" : "корпус") + (notchR(r.it, P) ? ", выемка под палец" : ""));
  for (const g of A.ghosts) L.push("  " + nums.ghostNo[g.key] + " ответный вырез в крышке под «" + g.it.name + "», глубина " + g.depth + " мм");
  for(const {no,r} of nums.list.filter(x=>x.r.it.stepParentId))L.push('Ступень '+no+': под «'+(stepParent(r.it)?.name||'—')+'», начало '+r.d.startDepth+' мм, дно '+r.d.depth+' мм от поверхности ложемента. Нижний карман проходит через верхний; опорный уступ ≥ '+Math.max(5,P.bridge)+' мм. Для доступа вынуть верхний предмет.');
  if(hasTiers())for(const {no,r} of nums.list)L.push('Размещение выреза '+no+': '+levelName(r.it));
  L.push("", "Оценка (условные тарифы): комплект " + fmt(q.unit) + " ₽, подготовка " + fmt(q.setup) + " ₽, итого " + fmt(q.total) + " ₽");
  L.push("", "Контакты: " + S.form.name + "; " + S.form.contact + (S.form.org ? "; " + S.form.org : ""));
  if (S.form.comment) L.push("Комментарий: " + S.form.comment);
  L.push("", "Файлы: "+(hasTiers()?"yarus-N.dxf (номер снизу)":"korpus.dxf")+" и kryshka.dxf — контуры для станка (мм, слой VYREZ_Dnnn = глубина от верха соответствующего ложемента), chertezh.svg — чертёж с таблицей вырезов.");
  return L.join("\r\n");
}
function orderJSON(A, nums, order, q) {
  const { F, P, c } = A;
  return JSON.stringify({
    order: order.no, date: order.date, case: { model: c.id, inner: [c.l, c.w, c.h], lid: c.lid, body: c.body }, needCase: S.needCase,
    tiers:hasTiers()?tierList():undefined, steppedPockets:nums.list.filter(x=>x.r.it.stepParentId).map(({no,r})=>({pocketNo:no,upperPocketNo:nums.list.find(x=>x.r.it.id===r.it.stepParentId)?.no,startDepth:r.d.startDepth,bottomDepth:r.d.depth,supportLedge:Math.max(5,P.bridge)})), material: MATERIALS[S.material].name, qty: q.qty, foam: { length: r1(F.L), width: r1(F.W) }, params: S.params,
    pockets: nums.list.map(({ no, r }) => ({ no, item: r.it.name, shape: r.it.shape, item_mm: [r.it.l, r.it.w, r.it.h], zone: r.zone, tierId:r.tierId, tierName:r.zone==='body'?levelName(r.it):null, x: r1(r.g.pocket.x), y: r1(r.g.pocket.y), w: r1(r.g.pocket.w), h: r1(r.g.pocket.h), depth: r.d.depth, notch: !!notchR(r.it, P), rotated: !!r.pl.rot }))
      .concat(A.ghosts.map(g => ({ no: nums.ghostNo[g.key], item: g.it.name, zone: "lid", counter: true, x: r1(g.rect.x), y: r1(g.rect.y), w: r1(g.rect.w), h: r1(g.rect.h), depth: g.depth }))),
    estimate: { unit: Math.round(q.unit), setup: q.setup, total: Math.round(q.total) },
    contact: S.form
  }, null, 2);
}

// ---------- Сохранение файлов ----------
let DL = null;
// На обычном сайте (GitHub Pages, локальный файл) window.claude нет: скачиваем через ссылку на Blob.
const DL_WEB = !(window.claude && typeof window.claude.use === "function");
if (DL_WEB) DL = {
  save: ({ filename, data }) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.svg$/i.test(filename) ? "image/svg+xml" : "application/octet-stream" });
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    return Promise.resolve({ status: "saved" });
  }
};
(async () => {
  try { if (!DL_WEB) DL = await window.claude.use("downloads"); } catch (e) { DL = null; }
  updateDl();
})();
function updateDl() {
  const b = $("btn-svg"); b.disabled = !DL; b.title = DL ? "" : "Скачивание недоступно в этом просмотре";
  const z = $("btn-zip"); if (z) { z.disabled = !DL; z.title = b.title; }
}
function say(where, cls, text) { const m = $(where)||$('order-msg'); if(!m)return; m.innerHTML = '<div class="msg ' + cls + '"></div>'; m.firstChild.textContent = text; }
async function saveFile(name, data, where) {
  if (!DL) { say(where, "err", "Скачивание недоступно в этом просмотре. Откройте прототип на claude.ai."); return; }
  try { await DL.save({ filename: name, data }); say(where, "ok", "Файл " + name + " передан на сохранение."); }
  catch (e) { say(where, e && e.code === "declined" ? "ok" : "err", e && e.code === "declined" ? "Сохранение отменено." : "Не удалось сохранить файл: " + ((e && (e.message || e.code)) || "ошибка")); }
}
function exportSvg() {
  const nums = numbering(A), order = orderInfo();
  saveFile("chertezh-lozhement-" + latin(A.c.id) + ".svg", drawingSVG(A, nums, order), "order-msg");
}
async function exportZip() {
  if((hasTiers()||S.items.some(it=>it.stepParentId))&&A.errors){say('zip-msg','err','Исправьте ошибки размещения и глубины карманов перед выгрузкой производственных файлов.');return;}
  if (!window.JSZip) { say("zip-msg", "err", "Не загрузилась библиотека архивов. Скачайте чертёж отдельно кнопкой «Скачать чертёж»."); return; }
  const nums = numbering(A), order = orderInfo(), q = quote(A), zip = new window.JSZip();
  if(hasTiers())for(const [i,t] of tierList().entries()){
    const ta=tierAnalysis(A,t),tn={...nums,list:nums.list.filter(x=>x.r.tierId===t.id)};
    zip.file('yarus-'+(i+1)+'.dxf',dxfFor('body',ta,tn));
  }else zip.file("korpus.dxf", dxfFor("body", A, nums));
  zip.file("kryshka.dxf", dxfFor("lid", A, nums));
  zip.file("chertezh.svg", drawingSVG(A, nums, order));
  zip.file("zakaz.txt", "﻿" + orderText(A, nums, order, q));
  zip.file("zakaz.json", orderJSON(A, nums, order, q));
  const blob = await zip.generateAsync({ type: "blob" });
  saveFile("zakaz-" + latin(order.no).replace(/^-/, "L-") + ".zip", blob, "zip-msg");
}
function submitOrder(e) {
  e.preventDefault();
  S.form = { name: $("f-name").value.trim(), contact: $("f-contact").value.trim(), org: $("f-org").value.trim(), comment: $("f-comment").value.trim() };
  if (!S.items.length) return say("order-msg", "err", "Добавьте хотя бы один предмет.");
  if (A.errors) return say("order-msg", "err", "В раскладке есть ошибки (" + A.errors + "). Они отмечены красным: передвиньте предметы, выберите кейс больше или нажмите «Подобрать кейс».");
  if (!S.form.name || !S.form.contact) return say("order-msg", "err", "Укажите имя и телефон или e-mail, чтобы менеджер мог связаться с вами.");
  $("order-msg").textContent = "";
  const o = orderInfo(); S.submitted = { no: o.no, date: o.date };
  renderDone(); renderPath(); saveDraft();
}
function renderDone() {
  const box = $("order-done");
  if (!S.submitted) { box.textContent = ""; return; }
  box.innerHTML = '<div class="done-box"><h3></h3><p class="note" style="margin:0"></p><ul>' +
    "<li>korpus.dxf и kryshka.dxf — контуры для станка, слой на каждую глубину выреза</li>" +
    "<li>chertezh.svg — чертёж с размерами, таблицей вырезов и штампом</li>" +
    "<li>zakaz.txt и zakaz.json — состав заказа, контакты и расчёт</li></ul>" +
    '<div class="row"><button class="btn primary" type="button" id="btn-zip">Скачать пакет заказа (.zip)</button><button class="btn" type="button" id="btn-copy">Скопировать текст заказа</button></div><div id="zip-msg"></div></div>';
  box.querySelector("h3").textContent = "Заказ " + S.submitted.no + " сформирован";
  box.querySelector("p").textContent = "Это прототип: отправка менеджеру здесь не подключена. В рабочей версии на сайте заказ вместе с этими файлами сразу уходит на почту заказов. Скачайте пакет, чтобы увидеть, что получит менеджер.";
  $("btn-zip").onclick = exportZip;
  $("btn-copy").onclick = () => {
    const txt = orderText(A, numbering(A), orderInfo(), quote(A));
    const fallback = () => { const m = $("zip-msg"); m.innerHTML = '<textarea readonly rows="8" style="margin-top:8px"></textarea>'; m.firstChild.value = txt; m.firstChild.select(); };
    try { navigator.clipboard.writeText(txt).then(() => say("zip-msg", "ok", "Текст заказа скопирован."), fallback); } catch (e) { fallback(); }
  };
  updateDl();
}
