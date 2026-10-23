"use strict";
function workspaceIcon(name){
 const paths={
  case:'M3 7h18v13H3z M8 7V4h8v3 M3 11h18',
  items:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  settings:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  total:'M18 4H6l7 8-7 8h12',order:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',
  auto:'M3 4h7v7H3z M14 4h7v7h-7z M3 15h7v6H3z M14 18h7 M18 15l3 3-3 3',
  rotate:'M5 8a8 8 0 1 1-1 8 M5 3v5h5',
  delete:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  notch:'M4 4h5a3 3 0 0 0 6 0h5v16H4z',
  contour:'M4 19 7 5l12 3-2 11z M3 18h3v3H3z M6 4h3v3H6z M18 7h3v3h-3z',
  fit:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
  reset:'M5 8a8 8 0 1 1-1 8 M5 3v5h5 M12 8v5h4',
  plus:'M12 5v14 M5 12h14',minus:'M5 12h14'
 };
 return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
}
function initWorkspaceIcons(){
 for(const [id,icon,label] of [
  ['btn-auto','auto','Авторасстановка — заново разместить предметы в кейсе'],
  ['btn-rot','rotate','Повернуть выбранный предмет на 90°'],
  ['btn-del','delete','Удалить выбранный экземпляр (Delete)'],
  ['btn-notch','notch','Добавить или убрать выемку под палец'],
  ['btn-sketch','contour','Редактировать контур выреза выбранного предмета'],
  ['fs2','fit','Развернуть план 2D на весь экран'],['fs3','fit','Развернуть 3D на весь экран'],
  ['zoom2-reset','reset','Сбросить масштаб плана до 100%'],['zoom2-in','plus','Приблизить план'],['zoom2-out','minus','Отдалить план']
 ]){
  const b=$(id);b.innerHTML=workspaceIcon(icon);b.title=label;b.setAttribute('aria-label',label);b.classList.add('workspace-icon');
 }
 const select=$('sel-ori'),label=select.closest('label');
 label.firstChild.textContent='';label.insertAdjacentHTML('afterbegin',workspaceIcon('case'));label.title='Ориентация предмета — выберите, на какой грани он лежит';
}
// Раскладка экрана: панели, разделители, полный экран.

// ---------- Раскладка экрана: панели, шторки, полный экран ----------
function initLayout() {
  const L = document.querySelector(".layout"), VW = $("views");
  initWorkspaceIcons();
  let expandedWidth=400;
  const expand = id => {
    L.classList.remove('rail','nol');L.style.setProperty('--wl',expandedWidth+'px');$('t-left').setAttribute('aria-pressed','true');
    if(id){openStep(id,true);$(id).scrollIntoView({block:'nearest',behavior:'smooth'});$(id).querySelector('.step-h').focus({preventScroll:true});}
  };
  const rail=document.createElement('nav');rail.className='sidebar-rail';rail.setAttribute('aria-label','Разделы конструктора');
  for(const [id,name,icon] of [['s-case','Кейс','case'],['s-items','Предметы','items'],['s-tech','Материал и параметры','settings'],['s-total','Итого','total'],['s-order','Заказ','order']]){
    const button=document.createElement('button');button.type='button';button.className='btn rail-button';button.title='Открыть раздел «'+name+'»';button.setAttribute('aria-label',name);button.innerHTML=workspaceIcon(icon);button.onclick=()=>expand(id);rail.append(button);
  }
  document.querySelector('.steps').prepend(rail);
  const tog = (id, fn) => { const b = $(id); b.onclick = () => { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); fn(on); }; };
  tog("t-left", on => { L.classList.toggle("nol", !on); setTimeout(() => V3.on && draw3(), 30); });
  tog("t-2d", on => VW.classList.toggle("no2", !on));
  tog("t-3d", on => { VW.classList.toggle("no3", !on); setView3(on); });
  const drag = (h, fn, start = () => {}) => h.addEventListener("pointerdown", e => {
    start(e);
    h.setPointerCapture(e.pointerId); h.addEventListener("pointermove", fn);
    const up = () => { h.removeEventListener("pointermove", fn); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
    h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); e.preventDefault();
  });
  let railDrag=false,dragX=0,dragWidth=0;
  drag($("sp-l"), e => {
    if(railDrag && e.clientX-dragX<4)return;
    const r=L.getBoundingClientRect(),width=Math.min(r.width-320,railDrag?dragWidth+e.clientX-dragX:e.clientX-r.left);
    if(width<=260){L.classList.add('rail');return;}
    L.classList.remove('rail');expandedWidth=width;L.style.setProperty('--wl',width+'px');
  },e=>{railDrag=L.classList.contains('rail');dragX=e.clientX;dragWidth=expandedWidth;});
  $('sp-l').tabIndex=0;
  $('sp-l').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();L.classList.add('rail');}if(e.key==='ArrowRight'){e.preventDefault();expand();}});
  drag($("sp-v"), e => { const r = VW.getBoundingClientRect(), f = Math.max(0.2, Math.min(0.8, (e.clientX - r.left) / r.width)); VW.style.setProperty("--a", f + "fr"); VW.style.setProperty("--b", (1 - f) + "fr"); });
  let previousPlanZoom=null;
  const leave = el => {
    el.classList.remove("fs");$(el.id==='p2d'?'fs2':'fs3').setAttribute('aria-pressed','false');
    if(el.id==='p2d' && previousPlanZoom!==null){zoom2D=previousPlanZoom;previousPlanZoom=null;applyZoom2D();}
  };
  for (const [b, p] of [["fs2", "p2d"], ["fs3", "p3d"]]) $(b).onclick = () => {
    const el = $(p), on = !el.classList.contains("fs");
    if(on){el.classList.add('fs');if(p==='p2d'){previousPlanZoom=zoom2D;zoom2D=1;applyZoom2D();}}else leave(el);
    $(b).setAttribute("aria-pressed", String(on));
    if (on && el.requestFullscreen) el.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen();
  };
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) document.querySelectorAll(".pane.fs").forEach(leave); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".pane.fs").forEach(leave); });
}
