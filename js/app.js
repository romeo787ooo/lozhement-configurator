"use strict";
// Ядро приложения: общий перерасчёт и перерисовка.

// ---------- Состояние и перерасчёт ----------
let A = null;
const $ = id => document.getElementById(id);
function relayout() { S.place = arrangeFor(curCase(), S.params, S.items); refresh(); }
function refresh() {
  A = analyze(curCase(), S.params, S.items, S.place);
  renderView(); renderStatus(); renderItemStatus(); renderSummary(); renderPrice(); renderPath(); saveDraft();
  updateTools(); updateStepSummaries();
  if (V3.on) render3D();
}
