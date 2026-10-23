"use strict";
const el=id=>document.getElementById(id), date=s=>new Date(s).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
let editing=null;
function message(text){el('message').textContent=text;}
function blankState(caseId){return {caseId,cat:-1,query:'',material:'ppe-black',qty:1,needCase:false,params:Object.fromEntries(PARAMS.map(p=>[p[0],p[2]])),items:[],place:{},selected:null,form:{name:'',contact:'',org:'',comment:''},submitted:null};}
function download(p){const blob=new Blob([JSON.stringify({format:'lozhement-project',version:1,project:p},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=p.name.replace(/[\\/:*?"<>|]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function action(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{try{fn();}catch(e){message('Не удалось выполнить действие: '+e.message);}};parent.append(b);return b;}
function render(){
  try{
    const query=el('search').value.trim().toLocaleLowerCase();
    const projects=Projects.list().filter(p=>(p.name+' '+p.draft.caseId).toLocaleLowerCase().includes(query));
    if(el('sort').value==='name')projects.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    const box=el('projects');box.replaceChildren();
    if(!projects.length){const e=document.createElement('div');e.className='empty';e.textContent=query?'Проекты не найдены. Измените запрос.':'Здесь появятся ваши компоновки. Создайте первый проект.';box.append(e);}
    for(const p of projects){
      const s=p.draft||p.saved,card=document.createElement('article');card.className='card';
      const tag=document.createElement('span');tag.className='case-tag';tag.textContent='▣ Калибр '+s.caseId;
      const title=document.createElement('h2');title.textContent=p.name;
      const guide=document.createElement('p');if(s.demoGuide)guide.textContent='Три съёмных яруса: питание → оптика → оборудование. Откройте проект и сравните виды «В сборе» и «Разнести ярусы».';else guide.hidden=true;
      const info=document.createElement('dl');
      const c=caseById(s.caseId);
      for(const [label,value] of [['Предметов',(s.items||[]).reduce((n,i)=>n+(i.qty||1),0)],['Ярусов основания',s.tiers?.length||1],['Внутренние размеры',c?`${c.l} × ${c.w} × ${c.h} мм`:'—']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;info.append(dt,dd);}
      const stamp=document.createElement('p');stamp.textContent='Изменён '+date(p.updatedAt);
      const saved=document.createElement('p');saved.textContent=JSON.stringify(p.saved)===JSON.stringify(p.draft)?'Все изменения сохранены':'Есть автоматически сохранённый черновик';
      const actions=document.createElement('div');actions.className='actions';const link=document.createElement('a');link.className='open';link.href='index.html?project='+encodeURIComponent(p.id);link.textContent='Открыть';actions.append(link);
      action(actions,'Переименовать',()=>showDialog(p));
      action(actions,'Копировать',()=>{Projects.create(p.name+' — копия',s);render();});
      action(actions,'Скачать',()=>download(p));
      if(JSON.stringify(p.saved)!==JSON.stringify(p.draft))action(actions,'К сохранённой версии',()=>{if(confirm('Заменить черновик последней сохранённой версией?')){Projects.write({...p,draft:p.saved},p.revision);render();}});
      action(actions,'Удалить',()=>{if(confirm('Удалить проект «'+p.name+'»? Перед удалением можно скачать копию.')){Projects.remove(p.id);render();}}).className='danger';
      card.append(tag,title,guide,info,stamp,saved,actions);box.append(card);
    }
  }catch(e){message('Не удалось прочитать проекты: '+e.message);}
}
function showDialog(p=null){editing=p;el('dialog-title').textContent=p?'Переименовать проект':'Новый проект';el('project-title').value=p?.name||'';el('case-label').hidden=!!p;el('dialog-error').textContent='';el('project-dialog').showModal();el('project-title').focus();}
for(const c of CASES){const o=document.createElement('option');o.value=c.id;o.textContent=`Калибр ${c.id} · ${c.l} × ${c.w} × ${c.h} мм`;el('project-case').append(o);}el('project-case').value='7030';
el('new-project').onclick=()=>showDialog();el('cancel-dialog').onclick=()=>el('project-dialog').close();
el('project-form').onsubmit=e=>{e.preventDefault();try{const name=el('project-title').value.trim();if(!name)throw Error('Введите название.');if(editing){Projects.write({...editing,name},editing.revision);el('project-dialog').close();render();}else{const p=Projects.create(name,blankState(el('project-case').value));location.href='index.html?project='+encodeURIComponent(p.id);}}catch(err){el('dialog-error').textContent=err.message;}};
el('search').oninput=render;el('sort').onchange=render;
el('import-project').onclick=()=>el('import-file').click();
el('import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>15*1024*1024)throw Error('Файл слишком большой (максимум 15 МБ).');const data=JSON.parse(await file.text());const p=data.project,s=p?.draft||p?.saved;if(data.format!=='lozhement-project'||data.version!==1||!s||!Array.isArray(s.items)||!caseById(s.caseId)||!s.params||!s.place||typeof p.name!=='string')throw Error('Неверный формат копии проекта.');Projects.create(p.name,s);render();message('Копия загружена как отдельный проект.');}catch(err){message('Не удалось загрузить копию: '+err.message);}finally{e.target.value='';}};
window.addEventListener('storage',render);
const demoButton=document.createElement('button');demoButton.textContent='Создать демо · 3 яруса';demoButton.onclick=()=>{try{const p=createTierDemo();location.href='index.html?project='+encodeURIComponent(p.id);}catch(e){message('Не удалось создать демо: '+e.message);}};document.querySelector('.filters').append(demoButton);
try{Projects.migrate();ensureTierDemo();}catch(e){message('Не удалось подготовить проекты: '+e.message);}
render();
