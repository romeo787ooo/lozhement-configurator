"use strict";
let itemTipTimer=0;
function hideItemTip(){clearTimeout(itemTipTimer);const tip=$('item-hover-tip');if(tip)tip.hidden=true;}
function itemTipText(key){
 const r=A?.res.find(r=>r.key===key);if(!r)return '';
 const it=r.it,p=r.g?.pocket;
 return [it.name+(it.qty>1?' · экземпляр '+(r.n+1)+' из '+it.qty:''),
  'Предмет: '+[it.l,it.w,it.h].map(r1).join(' × ')+' мм',
  'Отделение: '+(r.zone==='lid'?'крышка':'основание'),
  hasTiers()&&r.zone==='body'?'Ярус: '+levelName(it)+' · от дна '+r1(tierFor(it).offset)+' мм':'',
  p?'Вырез: '+[p.w,p.h].map(r1).join(' × ')+' мм · глубина '+r.d.depth+' мм':'Не размещён',
  p?'Позиция X: '+r1(p.x)+' · Y: '+r1(p.y)+' мм · поворот '+(r.pl.rot||0)+'°':'',
  r.text].filter(Boolean).join('\n');
}
function scheduleItemTip(e,resolve){
 hideItemTip();if(e.buttons)return;
 const x=e.clientX,y=e.clientY;
 itemTipTimer=setTimeout(()=>{
  const text=itemTipText(resolve());if(!text)return;
  let tip=$('item-hover-tip');if(!tip){tip=document.createElement('div');tip.id='item-hover-tip';tip.className='item-hover-tip';tip.setAttribute('role','tooltip');document.body.append(tip);}
  tip.textContent=text;tip.hidden=false;tip.style.left='0px';tip.style.top='0px';
  const r=tip.getBoundingClientRect();tip.style.left=Math.max(4,Math.min(x+14,innerWidth-r.width-4))+'px';tip.style.top=Math.max(4,Math.min(y+18,innerHeight-r.height-4))+'px';
 },600);
}
$('view').addEventListener('pointermove',e=>{const key=e.target.closest('.pk')?.dataset.key;scheduleItemTip(e,()=>key);});
$('gl3d').addEventListener('pointermove',e=>scheduleItemTip(e,()=>{
 const b=V3.bjs;if(!b?.ready||SCALE3.active)return null;
 const rect=$('gl3d').getBoundingClientRect();
 const hit=b.scene.pick((e.clientX-rect.left)*b.engine.getRenderWidth()/rect.width,(e.clientY-rect.top)*b.engine.getRenderHeight()/rect.height,m=>m.isEnabled()&&m.isVisible);
 return hit?.pickedMesh?.metadata?.key;
}));
for(const id of ['view','gl3d']){const el=$(id);el.addEventListener('pointerleave',hideItemTip);el.addEventListener('pointerdown',hideItemTip);el.addEventListener('wheel',hideItemTip);}
document.addEventListener('scroll',hideItemTip,true);window.addEventListener('resize',hideItemTip);
