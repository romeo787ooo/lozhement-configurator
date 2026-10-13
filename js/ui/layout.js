"use strict";
// Раскладка экрана: панели, разделители, полный экран.

// ---------- Раскладка экрана: панели, шторки, полный экран ----------
function initLayout() {
  const L = document.querySelector(".layout"), VW = $("views");
  const tog = (id, fn) => { const b = $(id); b.onclick = () => { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); fn(on); }; };
  tog("t-left", on => { L.classList.toggle("nol", !on); setTimeout(() => V3.on && draw3(), 30); });
  tog("t-2d", on => VW.classList.toggle("no2", !on));
  tog("t-3d", on => { VW.classList.toggle("no3", !on); setView3(on); });
  const drag = (h, fn) => h.addEventListener("pointerdown", e => {
    h.setPointerCapture(e.pointerId); h.addEventListener("pointermove", fn);
    const up = () => { h.removeEventListener("pointermove", fn); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
    h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); e.preventDefault();
  });
  drag($("sp-l"), e => { const r = L.getBoundingClientRect(); L.style.setProperty("--wl", Math.max(260, Math.min(r.width - 320, e.clientX - r.left)) + "px"); });
  drag($("sp-v"), e => { const r = VW.getBoundingClientRect(), f = Math.max(0.2, Math.min(0.8, (e.clientX - r.left) / r.width)); VW.style.setProperty("--a", f + "fr"); VW.style.setProperty("--b", (1 - f) + "fr"); });
  const leave = el => { el.classList.remove("fs"); };
  for (const [b, p] of [["fs2", "p2d"], ["fs3", "p3d"]]) $(b).onclick = () => {
    const el = $(p), on = !el.classList.contains("fs");
    el.classList.toggle("fs", on); $(b).setAttribute("aria-pressed", String(on));
    if (on && el.requestFullscreen) el.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen();
  };
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) document.querySelectorAll(".pane.fs").forEach(leave); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".pane.fs").forEach(leave); });
}
