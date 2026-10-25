"use strict";
function tierButton(text,title,fn){const b=document.createElement('button');b.type='button';b.className='btn sm';b.textContent=text;b.title=title;b.onclick=fn;return b;}
function tierChanged(){normalizeTiers();refresh();renderItems();}
function selectTier(id){S.activeTier=id;S.selected=null;renderView();renderTierControls();renderItems();updateTools();applyTierScene();saveDraft();}
function enableTiers(){
  S.tiers=[{id:'tier-1',name:'Ярус 1 · Нижний',thickness:curCase().body,bottom:S.params.minBottom,gap:0}];
  S.activeTier='tier-1';S.items.filter(it=>it.zone!=='lid').forEach(it=>it.tierId='tier-1');tierChanged();
}
function addTier(){
  if(!hasTiers())enableTiers();
  const id='tier-'+Date.now(),remaining=curCase().body-tierHeight();
  const t={id,name:'Ярус '+(S.tiers.length+1),thickness:Math.max(S.params.minBottom+5,remaining>0?remaining:40),bottom:S.params.minBottom,gap:0};
  S.tiers.push(t);S.activeTier=id;setOpen(id,true);tierChanged();editTier(id);
}
function reorderTier(id,target,after=false){
  if(id===target)return;
  const i=S.tiers.findIndex(t=>t.id===id),j=S.tiers.findIndex(t=>t.id===target);if(i<0||j<0)return;
  const [t]=S.tiers.splice(i,1),at=S.tiers.findIndex(t=>t.id===target);S.tiers.splice(at+(after?1:0),0,t);tierChanged();
}
function moveInstanceTier(key,level){
  const [id,nText]=key.split('#'),n=+nText;let it=S.items.find(x=>x.id===id);if(!it||levelOf(it)===level)return;
  if(it.qty>1){
    const copy=structuredClone(it);copy.id='i'+uid++;copy.qty=1;
    const old=S.place[key]&&{...S.place[key]};
    for(let j=n;j<it.qty-1;j++){const next=S.place[id+'#'+(j+1)];if(next)S.place[id+'#'+j]=next;else delete S.place[id+'#'+j];}
    delete S.place[id+'#'+(it.qty-1)];it.qty--;S.items.splice(S.items.indexOf(it)+1,0,copy);it=copy;key=it.id+'#0';if(old)S.place[key]=old;
  }
  it.zone=level==='lid'?'lid':'body';if(level!=='lid')it.tierId=level;
  S.activeTier=level;S.selected=key;setOpen(level,true);tierChanged();
}
function editTier(id){
  const t=S.tiers.find(t=>t.id===id);if(!t)return;
  const d=$('tier-dialog');d.textContent='';const title=hEl('h3',null,'Параметры яруса');d.append(title);
  const fields={};
  for(const [key,label,type] of [['name','Название','text'],['thickness','Толщина яруса с дном, мм','number'],['bottom','Минимальная толщина дна, мм','number'],['gap','Зазор над ярусом, мм','number']]){
    const l=hEl('label','tier-field',label),input=document.createElement('input');input.type=type;input.value=t[key];if(type==='number'){input.min=key==='gap'?0:1;input.step=0.5;}l.append(input);d.append(l);fields[key]=input;
  }
  const note=hEl('p','note','Высота от дна основания: '+r1(tierList().find(x=>x.id===id).offset)+' мм. Зазор учитывается в высоте, но не в объёме материала.');d.append(note);
  const error=hEl('p','note');error.style.color='var(--err)';d.append(error);
  d.append(tierButton('Сохранить','Применить параметры',()=>{
    const thickness=+fields.thickness.value,bottom=+fields.bottom.value,gap=+fields.gap.value;
    if(!fields.name.value.trim()||![thickness,bottom,gap].every(Number.isFinite)||thickness<=bottom||bottom<1||gap<0){error.textContent='Нужны название, толщина больше дна, дно от 1 мм и неотрицательный зазор.';return;}
    Object.assign(t,{name:fields.name.value.trim(),thickness,bottom,gap});d.close();tierChanged();
  }),tierButton('Отмена','Закрыть без изменений',()=>d.close()));d.showModal();
}
function deleteTier(id){
  if(S.tiers.length===1){alert('Последний ярус удалить нельзя.');return;}
  const d=$('tier-dialog');d.textContent='';d.append(hEl('h3',null,'Удалить ярус'));
  const select=document.createElement('select');
  for(const t of S.tiers.filter(t=>t.id!==id))select.add(new Option('Перенести предметы в «'+t.name+'»',t.id));
  select.add(new Option('Удалить вместе с предметами','delete'));d.append(select);
  d.append(tierButton('Удалить ярус','Применить выбранное действие',()=>{
    for(const it of S.items.filter(it=>it.zone!=='lid'&&tierFor(it).id===id)){
      if(select.value==='delete'){for(const x of instances([it]))delete S.place[x.key];S.items=S.items.filter(x=>x!==it);}else it.tierId=select.value;
    }
    S.tiers=S.tiers.filter(t=>t.id!==id);S.selected=null;d.close();tierChanged();
  }),tierButton('Отмена','Отменить удаление',()=>d.close()));d.showModal();
}
function tierMenu(id,x,y){
  const m=$('ctx');m.textContent='';
  const add=(name,fn)=>m.append(tierButton(name,name,()=>{hideCtx();fn();}));
  add('Параметры / переименовать',()=>editTier(id));
  add('Дублировать ярус',()=>{
    const t=S.tiers.find(t=>t.id===id),copy={...t,id:'tier-'+Date.now(),name:t.name+' (копия)'};
    const items=S.items.filter(it=>it.zone!=='lid'&&tierFor(it).id===id);
    const ids=new Map(items.map(it=>[it.id,'i'+uid++]));
    for(const it of items){const n=structuredClone(it);n.id=ids.get(it.id);n.tierId=copy.id;if(n.stepParentId)n.stepParentId=ids.get(n.stepParentId)||n.stepParentId;S.items.push(n);for(let j=0;j<it.qty;j++)if(S.place[it.id+'#'+j])S.place[n.id+'#'+j]={...S.place[it.id+'#'+j]};}
    S.tiers.splice(S.tiers.indexOf(t)+1,0,copy);S.activeTier=copy.id;tierChanged();
  });
  const i=S.tiers.findIndex(t=>t.id===id);
  if(i<S.tiers.length-1)add('Переместить выше',()=>reorderTier(id,S.tiers[i+1].id,true));
  if(i>0)add('Переместить ниже',()=>reorderTier(id,S.tiers[i-1].id));
  add('Удалить ярус…',()=>deleteTier(id));m.hidden=false;
  m.style.left=Math.max(4,Math.min(x,innerWidth-m.offsetWidth-4))+'px';m.style.top=Math.max(4,Math.min(y,innerHeight-m.offsetHeight-4))+'px';
}
function renderTierControls(){
  const box=$('tier-controls');if(!box)return;box.textContent='';
  $('btn-auto').disabled=hasTiers()&&S.activeTier==='all';
  if(!hasTiers()){box.append(tierButton('▱ Ярусная компоновка','Создать съёмные ярусы основания',enableTiers));$('tier-tabs').hidden=true;$('tier-scene-controls').hidden=true;return;}
  $('btn-auto').title=S.activeTier==='all'?'Выберите ярус для авторасстановки':'Расставить предметы только в текущем ярусе';
  const height=tierHeight();box.append(hEl('span','note',S.tiers.length+' ярус(а) · '+r1(height)+' / '+curCase().body+' мм'));
  box.append(tierButton('+ Ярус','Добавить съёмный ложемент',addTier));
  const errors=tierErrors();if(errors.length){const p=hEl('p','note',errors.join('. '));p.style.color='var(--err)';box.append(p);}
  const tabs=$('tier-tabs');tabs.textContent='';tabs.hidden=false;
  for(const [id,name] of [['lid','Крышка'],...tierList().slice().reverse().map(t=>[t.id,t.name]),['all','Все']]){
    const b=tierButton(name,'Показать '+name,()=>selectTier(id));b.setAttribute('aria-pressed',String(S.activeTier===id));tabs.append(b);
  }
  const label=hEl('label','chk');const check=document.createElement('input');check.type='checkbox';check.checked=!!S.tierNeighbours;check.onchange=()=>{S.tierNeighbours=check.checked;renderView();saveDraft();};label.append(check,'Соседние ярусы');tabs.append(label);
  $('tier-scene-controls').hidden=false;
}
function initTierUI(){
  const controls=hEl('div','tier-controls');controls.id='tier-controls';$('tree').before(controls);
  const tabs=hEl('div','tier-tabs');tabs.id='tier-tabs';tabs.hidden=true;$('p2d').querySelector('.ph').after(tabs);
  const d=document.createElement('dialog');d.id='tier-dialog';document.body.append(d);
  const scene=hEl('div','tier-scene-controls');scene.id='tier-scene-controls';scene.hidden=true;
  const mode=document.createElement('select');mode.id='tier-scene-mode';mode.setAttribute('aria-label','Отображение ярусов');
  for(const [v,n] of [['assembled','В сборе'],['exploded','Разнести ярусы'],['selected','Выбранный ярус']])mode.add(new Option(n,v));
  const range=document.createElement('input');range.type='range';range.min=0;range.max=250;range.value=80;range.id='tier-explode';range.title='Расстояние между ярусами, мм';range.setAttribute('aria-label',range.title);
  mode.value=['assembled','exploded','selected'].includes(S.tierViewMode)?S.tierViewMode:'assembled';range.value=Number.isFinite(S.tierViewGap)?Math.max(0,Math.min(250,S.tierViewGap)):80;
  mode.onchange=()=>{S.tierViewMode=mode.value;saveDraft();applyTierScene();if(babylonBounds3()){fitCam3();syncBabylonCamera3();}};range.oninput=()=>{S.tierViewGap=+range.value;saveDraft();applyTierScene();};scene.append(mode,range);$('p3d').querySelector('.t3').append(scene);
}
function applyTierScene(){
  const b=V3.bjs;if(!b?.ready||!hasTiers())return;
  const mode=$('tier-scene-mode').value,gap=+$('tier-explode').value;
  for(const mesh of b.scene.meshes){
    const id=mesh.metadata?.tierId,idx=S.tiers.findIndex(t=>t.id===id);
    if(idx>=0){mesh.position.z=mode==='exploded'?idx*gap:0;mesh.setEnabled(!V3.hiddenTiers?.has(id)&&(mode!=='selected'||S.activeTier==='all'||id===S.activeTier));}
    else if(mesh.name==='base'||mesh.metadata?.shell)mesh.setEnabled(mode!=='selected'||S.activeTier==='all');
    else if(mesh.metadata?.zone==='lid')mesh.setEnabled(mode!=='selected'||S.activeTier==='all'||S.activeTier==='lid');
  }
  for(const l of V3.lab)if(l.tierId){const idx=S.tiers.findIndex(t=>t.id===l.tierId);l.p[2]=l.baseZ+(mode==='exploded'?idx*gap:0);}
  b.labelProbe=null;
}
