"use strict";
let activeProject=null, projectFailure='', projectTimer=null;
let projectSaveFailed=false;
const projectId=new URLSearchParams(location.search).get('project');
try {
  Projects.migrate();
  if(projectId){
    activeProject=Projects.read(projectId);
    if(!activeProject)throw Error('Проект не найден. Вернитесь в «Мои проекты».');
    const state=activeProject.draft||activeProject.saved;
    if(!Array.isArray(state?.items)||!caseById(state.caseId))throw Error('Не удалось прочитать проект.');
    S=Object.assign(defaultState(),state,{selected:null,submitted:null});
    uid=1+Math.max(0,...S.items.map(i=>+String(i.id).slice(1)||0));
    S.items.forEach(ensureOrient);
  }
} catch(e){projectFailure=e.message;}
function projectSnapshot(){return Projects.copy({...S,submitted:null,selected:null});}
function projectStatus(message){const el=document.getElementById('project-status');if(el)el.textContent=message;}
function persistProject(manual=false){
  clearTimeout(projectTimer);
  projectTimer=null;
  if(projectFailure){projectStatus(projectFailure);return false;}
  if(!activeProject)return false;
  try {
    const state=projectSnapshot(),next={...activeProject,draft:state};
    if(manual){next.saved=state;next.savedAt=new Date().toISOString();}
    activeProject=Projects.write(next,activeProject.revision);
    projectSaveFailed=false;
    projectStatus(manual?'Проект сохранён':'Черновик сохранён автоматически');return true;
  } catch(e){projectSaveFailed=true;projectStatus('Не сохранено: '+e.message);return false;}
}
function scheduleProjectSave(){
  if(!activeProject&&!projectId)return;
  projectStatus('Есть изменения…');clearTimeout(projectTimer);
  projectTimer=setTimeout(()=>persistProject(),600);
}
function initProjectSession(){
  const bar=document.createElement('div');bar.className='project-bar';
  bar.innerHTML='<a class="btn" href="projects.html">▦ Мои проекты</a><strong id="project-name"></strong><button class="btn" id="project-save" type="button">Сохранить</button><button class="btn" id="project-copy" type="button">Сохранить как…</button><span id="project-status" role="status" aria-live="polite"></span>';
  document.querySelector('.top').after(bar);
  if(S.demoGuide){const guide=document.createElement('p');guide.className='note';guide.textContent=S.demoGuide;bar.after(guide);}
  document.getElementById('project-name').textContent=activeProject?.name||'Несохранённый проект';
  projectStatus(projectFailure||'Кейс, предметы, контуры и ярусы сохраняются в этом браузере');
  const saveAs=()=>{
    const name=prompt('Название проекта',activeProject?activeProject.name+' — копия':'Новый проект');if(name===null)return;
    try{const p=Projects.create(name,projectSnapshot());location.href='index.html?project='+encodeURIComponent(p.id);}catch(e){projectStatus('Не сохранено: '+e.message);}
  };
  document.getElementById('project-save').onclick=()=>activeProject?persistProject(true):saveAs();
  document.getElementById('project-copy').onclick=saveAs;
  if(projectFailure&&projectId){document.querySelector('.layout').inert=true;document.getElementById('project-save').disabled=true;document.getElementById('project-copy').disabled=true;}
  bar.querySelector('a').onclick=e=>{
    if(activeProject){if(!persistProject())e.preventDefault();}
    else if(!projectId){try{const state=projectSnapshot();if(!Projects.list().some(p=>JSON.stringify(p.draft)===JSON.stringify(state)))Projects.create('Текущая компоновка',state);}catch(err){e.preventDefault();projectStatus('Не сохранено: '+err.message);}}
  };
  window.addEventListener('pagehide',()=>{if(projectTimer)persistProject();});
  window.addEventListener('beforeunload',e=>{if(projectTimer)persistProject();if(projectSaveFailed){e.preventDefault();e.returnValue='';}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){e.preventDefault();document.getElementById('project-save').click();}});
}
