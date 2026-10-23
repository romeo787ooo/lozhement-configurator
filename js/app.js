"use strict";
// Ядро приложения: общий перерасчёт и перерисовка.

// ---------- Состояние и перерасчёт ----------
let A = null;
const $ = id => document.getElementById(id);
function relayout() { normalizeTiers(); S.place = arrangeFor(curCase(), S.params, S.items); refresh(); }
function refresh() {
  normalizeTiers();
  A = analyze(curCase(), S.params, S.items, S.place);
  renderView(); renderStatus(); renderItemStatus(); renderSummary(); renderPrice(); renderPath(); saveDraft();
  updateTools(); updateStepSummaries(); renderTierControls();
  if (V3.on) render3D();
}
