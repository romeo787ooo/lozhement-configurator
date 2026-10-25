"use strict";
function editSteppedPocket(){
  const selected=selInfo();if(!selected)return;
  const it=selected.it;
  let dialog=$('stepped-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='stepped-dialog';document.body.append(dialog);}
  dialog.replaceChildren();dialog.style.maxWidth='480px';
  const title=hEl('h3',null,'Ступенчатый карман');dialog.append(title);
  dialog.append(hEl('p','note','Выбранный предмет размещается под верхним. Нижний карман центрируется и перемещается вместе с верхним; для доступа сначала вынимают верхний предмет. Две ступени, по одному экземпляру предмета.'));
  const label=hEl('label',null,'Верхний предмет'),select=document.createElement('select');select.style.width='100%';select.add(new Option('Без связи — обычный карман',''));
  for(const p of S.items.filter(p=>p!==it&&!p.stepParentId&&p.qty===1&&levelOf(p)===levelOf(it)&&(!stepChild(p)||stepChild(p)===it)))select.add(new Option(p.name,p.id));
  select.value=it.stepParentId||'';label.append(select);dialog.append(label);
  const error=hEl('p','note');error.setAttribute('role','alert');error.style.color='var(--err)';dialog.append(error);
  const save=tierButton('Применить','Связать карманы и проверить геометрию',()=>{
    if(select.value&&(it.qty!==1||stepChild(it))){error.textContent='Нужен отдельный предмет с количеством 1, без нижней ступени.';return;}
    const old=it.stepParentId,oldPlace=structuredClone(S.place),oldZone=it.zone,oldTier=it.tierId;
    if(select.value)it.stepParentId=select.value;else delete it.stepParentId;
    syncSteppedPlaces();
    const d=depthInfo(it,curCase(),S.params,it.zone),err=select.value&&(stepGeometryError(it)||d.err);
    if(err){if(old)it.stepParentId=old;else delete it.stepParentId;S.place=oldPlace;it.zone=oldZone;it.tierId=oldTier;error.textContent=err;return;}
    dialog.close();if(!select.value)reflowItem(it);else refresh();renderItems();renderSteppedControls();
  });
  dialog.append(save,tierButton('Отмена','Закрыть',()=>dialog.close()));dialog.showModal();
}
function initSteppedUI(){
  // Update only the old demo's misleading initial view, preserving its layout.
  if(S.demoGuide?.startsWith('Демо ступенчатых карманов:')&&!S.stepDemoVersion){
    S.stepReveal=false;S.stepDemoVersion=2;
    S.demoGuide=S.demoGuide.replace('В 3D включено «Снять верхние предметы» — видны нижние углубления и опорные уступы. Отключите флажок для собранного вида.','Включите «Снять верхние предметы», чтобы рассмотреть нижние углубления и опорные уступы.');
  }
  const bar=hEl('div','tier-controls');bar.id='stepped-controls';$('tier-controls').after(bar);
  const scene=hEl('label','chk');const check=document.createElement('input');check.type='checkbox';check.id='stepped-reveal';check.checked=!!S.stepReveal;
  check.onchange=()=>{S.stepReveal=check.checked;saveDraft();render3D();renderTree();renderSteppedControls();};scene.append(check,'Снять верхние предметы');scene.title='Показать нижние карманы и опорные уступы, не меняя компоновку';scene.id='stepped-scene';$('p3d').querySelector('.t3').append(scene);
  const note=hEl('span','note');note.id='stepped-hidden-note';note.setAttribute('role','status');scene.after(note);
  renderSteppedControls();
}
function renderSteppedControls(){
  const bar=$('stepped-controls');if(!bar)return;bar.replaceChildren();
  const button=tierButton('▱ Ступенчатый карман…','Выберите нижний предмет и укажите, под каким предметом он лежит',editSteppedPocket);button.disabled=!selInfo();bar.append(button);
  const count=S.items.filter(it=>it.stepParentId).length;
  if(count)bar.append(hEl('span','note',count+' пар · нижние карманы показаны пунктиром'));
  $('stepped-scene').hidden=!count;
  $('stepped-reveal').checked=!!S.stepReveal;
  $('stepped-hidden-note').textContent=count&&S.stepReveal?'Верхние предметы временно сняты. Снимите флажок, чтобы вернуть их.':'';
}
function toggleSteppedItemVisibility(it){
  if(S.stepReveal&&stepChild(it)){S.stepReveal=false;V3.hide.items.delete(it.id);saveDraft();}
  else V3.hide.items.has(it.id)?V3.hide.items.delete(it.id):V3.hide.items.add(it.id);
  renderSteppedControls();render3D();renderTree();
}
