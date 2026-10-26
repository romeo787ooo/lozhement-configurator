"use strict";
// Local OBJ/STL import. Files and mesh data never leave the browser.
function modelItem(model,name,zone='body',tierId=null,orientation='auto'){
  const pref=model.dim.indexOf(Math.min(...model.dim));
  return mkItem({name,shape:'rect',l:model.dim[0],w:model.dim[1],h:model.dim[2]},
    {model,dim:model.dim.slice(),kind:'rect',orient:orientation,pref,zone,tierId,notch:false});
}
function openModelImport(){
  let dialog=$('model-import-dialog');if(dialog)dialog.remove();
  dialog=document.createElement('dialog');dialog.id='model-import-dialog';dialog.style.cssText='width:min(620px,90vw);max-height:90vh;overflow:auto';
  dialog.innerHTML='<h2>Импорт изделия · OBJ / STL</h2><p class="hint">Файл обрабатывается на этом устройстве. До 20 МБ и 50 000 треугольников. Материалы и текстуры OBJ пока не загружаются.</p><input id="model-file" type="file" accept=".obj,.stl" aria-label="Модель изделия"><div class="row"><label>Единицы файла <select id="model-unit"><option value="1">мм</option><option value="10">см</option><option value="1000">м</option><option value="25.4">дюймы</option></select></label><label>Название <input id="model-name" maxlength="100"></label></div><div class="row"><label>Размещение <select id="model-zone"></select></label><label>Как класть <select id="model-orient"><option value="auto">Автоматически</option><option value="0">Ось X вверх</option><option value="1">Ось Y вверх</option><option value="2">Ось Z вверх</option></select></label></div><svg id="model-preview" viewBox="-10 -10 320 180" style="width:100%;height:160px" role="img" aria-label="Проекция будущего кармана"></svg><p id="model-info" role="status"></p><p class="hint">Первая версия: выпуклая внешняя проекция и постоянная глубина. Вогнутости и отверстия заполняются; зазор берётся из параметров ложемента. Авторасстановка может переместить другие предметы. Изменение ориентации заново строит контур модели.</p><div class="row"><button class="btn" id="model-apply" disabled>Добавить и разместить</button><button class="btn" id="model-cancel">Отмена</button></div><hr><div class="row"><button class="btn sm" id="model-battery">Образец: аккумулятор</button><button class="btn sm" id="model-cylinder">Образец: баллон</button><button class="btn sm" id="model-demo">Создать демо-проект</button></div>';
  document.body.append(dialog);
  for(const [id,name] of [...tierList().map(t=>[t.id,t.name]),['lid','Крышка']])$('model-zone').add(new Option(name,id));
  $('model-zone').value=S.activeTier&&S.activeTier!=='all'?S.activeTier:'body';if(!$('model-zone').value)$('model-zone').selectedIndex=0;
  let buffer=null,filename='',model=null,busy=false,request=0;
  const show=()=>{
    $('model-apply').disabled=true;model=null;$('model-preview').replaceChildren();if(!buffer)return;
    try{
      model=ItemModels.parse(buffer,filename,Number($('model-unit').value));
      const up=$('model-orient').value==='auto'?model.dim.indexOf(Math.min(...model.dim)):+$('model-orient').value,axes=[0,1,2].filter(a=>a!==up),w=model.dim[axes[0]],h=model.dim[axes[1]],scale=Math.min(300/w,160/h);
      const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');polygon.setAttribute('points',model.projections[up].map(p=>`${p.x*w*scale},${p.y*h*scale}`).join(' '));polygon.setAttribute('fill','#718aff55');polygon.setAttribute('stroke','#718aff');$('model-preview').append(polygon);
      $('model-info').textContent=model.dim.map(r1).join(' × ')+' мм · '+model.triangles+' треугольников'+(model.open?' · Сетка незамкнута или содержит неманифолдные рёбра; проверьте полноту изделия.':'')+(model.degenerate?' · Пустые треугольники пропущены: '+model.degenerate:'');
      $('model-apply').disabled=false;
    }catch(e){$('model-info').textContent=e.message;}
  };
  const load=async(file,name=file.name)=>{const token=++request;buffer=null;model=null;$('model-apply').disabled=true;$('model-info').textContent='Чтение модели…';try{if(file.size>20*1024*1024)throw Error('Максимум 20 МБ.');const data=await file.arrayBuffer();if(token!==request)return;buffer=data;filename=name;$('model-name').value=name.replace(/\.[^.]+$/,'');show();}catch(e){if(token===request)$('model-info').textContent=e.message;}};
  $('model-file').onchange=e=>{if(e.target.files[0])load(e.target.files[0]);};
  $('model-unit').onchange=show;$('model-orient').onchange=show;
  $('model-cancel').onclick=()=>dialog.close();
  $('model-apply').onclick=()=>{
    if(!model||busy)return;const name=$('model-name').value.trim();if(!name){$('model-info').textContent='Введите название изделия.';return;}
    const old=Projects.copy(S);
    try{
      busy=true;const level=$('model-zone').value,it=modelItem(model,name,level==='lid'?'lid':'body',level,$('model-orient').value);
      if(S.items.reduce((n,i)=>n+(i.model?i.model.vertices.length+i.model.indices.length:0),0)+model.vertices.length+model.indices.length>1500000)throw Error('Модели проекта превышают лимит 1,5 МБ. Упростите сетки или создайте отдельный проект.');
      S.items.push(it);normalizeTiers();S.place=arrangeFor(curCase(),S.params,S.items);S.selected=it.id+'#0';
      if(activeProject){if(!persistProject(true))throw Error('Не удалось сохранить проект: '+$('project-status').textContent);}
      else localStorage.setItem(STORE,JSON.stringify(S));
      renderItems();refresh();dialog.close();
    }catch(e){S=old;$('model-info').textContent=e.message;}finally{busy=false;}
  };
  for(const [id,path,name] of [['model-battery','battery.obj','Аккумулятор.obj'],['model-cylinder','cylinder.stl','Баллон.stl']])$(id).onclick=async()=>{try{$('model-unit').value='1';const r=await fetch('assets/items/'+path);if(!r.ok)throw Error('Образец не загружен.');await load(await r.blob(),name);}catch(e){$('model-info').textContent=e.message;}};
  $('model-demo').onclick=async()=>{
    if(busy)return;busy=true;$('model-demo').disabled=true;const previous=S,previousUid=uid;
    try{
      const models=[];for(const [file,name] of [['battery.obj','Аккумулятор'],['cylinder.stl','Баллон']]){const r=await fetch('assets/items/'+file);if(!r.ok)throw Error('Не удалось загрузить '+name);models.push([ItemModels.parse(await r.arrayBuffer(),file,1),name]);}
      S=defaultState();S.items=models.map(([m,n])=>modelItem(m,n));S.place=arrangeFor(curCase(),S.params,S.items);S.demoGuide='Изделия из предоставленных сборок: аккумулятор (OBJ) и баллон (STL). Модели встроены в проект. Контуры — выпуклые проекции с технологическим зазором.';S.demoSummary='Импорт OBJ/STL: реальная геометрия изделий, автоматическая ориентация и карманы.';
      const p=Projects.create('Демо · Импорт моделей изделий',S);S=previous;uid=previousUid;location.href='index.html?project='+encodeURIComponent(p.id);
    }catch(e){S=previous;uid=previousUid;$('model-info').textContent=e.message;}finally{busy=false;$('model-demo').disabled=false;}
  };
  dialog.showModal();
}
const importModelButton=document.createElement('button');importModelButton.id='import-item-model';importModelButton.type='button';importModelButton.className='btn sm';importModelButton.textContent='◈ Импорт 3D-модели';importModelButton.title='Загрузить изделие OBJ/STL, построить карман и подобрать размещение';importModelButton.onclick=openModelImport;
$('s-items').querySelector('.step-h').after(importModelButton);
