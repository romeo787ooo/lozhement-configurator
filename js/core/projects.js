"use strict";
// Independent records prevent edits to one project from overwriting another.
const Projects = (() => {
  const prefix = 'lozhement-project-v1:', legacy = 'lozhement-draft-3d-demo';
  const copy = value => JSON.parse(JSON.stringify(value));
  function read(id) { const raw=localStorage.getItem(prefix+id); return raw ? JSON.parse(raw) : null; }
  function list() {
    const result=[];
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(key.startsWith(prefix)) { const p=JSON.parse(localStorage.getItem(key)); if(p?.id)result.push(p); }
    }
    return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  function write(p, revision) {
    const current=read(p.id);
    if(revision!==undefined && (!current || current.revision!==revision)) throw Error('Проект изменён в другой вкладке или удалён. Сохраните копию, чтобы не потерять свою версию.');
    const next={...p,revision:(current?.revision||0)+1,updatedAt:new Date().toISOString()};
    localStorage.setItem(prefix+p.id,JSON.stringify(next));
    return next;
  }
  function create(name,state) {
    name=name.trim().slice(0,100);if(!name)throw Error('Введите название проекта.');
    const now=new Date().toISOString();
    return write({id:crypto.randomUUID(),name,createdAt:now,updatedAt:now,savedAt:now,saved:copy(state),draft:copy(state)});
  }
  function migrate() {
    const marker='lozhement-project-migrated-v1';
    if(localStorage.getItem(marker))return;
    const raw=localStorage.getItem(legacy);
    if(raw){const state=JSON.parse(raw);if(Array.isArray(state?.items))create('Мой первый проект',state);}
    localStorage.setItem(marker,'1');
  }
  return {read,list,write,create,migrate,copy,remove:id=>localStorage.removeItem(prefix+id)};
})();
