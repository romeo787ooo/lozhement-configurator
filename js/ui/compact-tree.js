"use strict";
let treeQuery='',treeAdvanced=false,treeInspectorOpen=false;
function treeGroupIds(){return ['body','lid',...(hasTiers()?S.tiers.map(t=>t.id):[]),...S.items.filter(it=>stepChild(it)).map(it=>it.id)];}
function treeSelect(it){treeInspectorOpen=true;selectItem(S.selected?.startsWith(it.id+'#')?S.selected:it.id+'#0');}
function openTreeAdd(zone='body',tierId=null){
  let d=$('tree-add-dialog');if(!d){d=document.createElement('dialog');d.id='tree-add-dialog';document.body.append(d);}d.replaceChildren();
  d.append(hEl('h3',null,'Добавить предмет'));
  const target=document.createElement('select');target.setAttribute('aria-label','Отделение');
  for(const [id,name] of (hasTiers()?[...tierList().map(t=>[t.id,t.name]),['lid','Крышка']]:[['body','Основание'],['lid','Крышка']]))target.add(new Option(name,id));
  target.value=tierId||zone;if(!target.value)target.selectedIndex=0;
  const template=document.createElement('select');template.setAttribute('aria-label','Предмет');template.add(new Option('Свой предмет','custom'));
  TEMPLATES.forEach((t,i)=>template.add(new Option(t.name,String(i))));
  d.append(target,template,tierButton('Добавить','Добавить в выбранное отделение',()=>{const id=target.value;if(hasTiers())S.activeTier=id;treeQuery='';treeInspectorOpen=true;d.close();addItemTo(id==='lid'?'lid':'body',template.value);}),tierButton('Отмена','Закрыть',()=>d.close()));d.showModal();
}
$('tree').addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea'))return;
  if(e.key==='Escape'&&treeInspectorOpen){treeInspectorOpen=false;renderTree();return;}
  const row=e.target.closest('.tn');if(!row)return;
  const titles=Array.from($('tree').querySelectorAll('.tree-list .tn>.tl')),at=titles.indexOf(row.querySelector('.tl'));
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();titles[Math.max(0,Math.min(titles.length-1,at+(e.key==='ArrowDown'?1:-1)))]?.focus();}
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
    e.preventDefault();e.stopPropagation();const id=row.dataset.node,li=row.parentElement;if(li.hasAttribute('aria-expanded')){setOpen(id,e.key==='ArrowRight');renderTree();}
  }
});
function renderTree(){
  const box=$('tree');if(!box||box.hidden)return;
  let layout=$('tree-layout-options');
  if(!layout){layout=document.createElement('details');layout.id='tree-layout-options';layout.append(hEl('summary'));box.before(layout);for(const id of ['tier-controls','stepped-controls'])if($(id))layout.append($(id));}
  const steps=S.items.filter(it=>it.stepParentId).length;
  layout.querySelector('summary').textContent='Компоновка'+(hasTiers()?' · ярусов: '+S.tiers.length:steps?' · ступенчатых пар: '+steps:'');
  const ae=document.activeElement,fkey=box.contains(ae)?ae?.dataset?.f:null;
  const advanced=box.querySelector('.inspector-advanced');if(advanced)treeAdvanced=advanced.open;
  let caret=null;try{if(fkey&&ae.selectionStart!==null)caret=[ae.selectionStart,ae.selectionEnd];}catch(e){}
  const scroll=box.querySelector('.tree-list')?.scrollTop||0,propsScroll=box.querySelector('.item-inspector')?.scrollTop||0;
  const sel=selInfo(),changed=S.selected!==treeSel;treeSel=S.selected;
  if(sel&&changed){setOpen(zoneOf(sel.it),true);if(hasTiers())setOpen(tierFor(sel.it).id,true);const parent=stepParent(sel.it);if(parent)setOpen(parent.id,true);treeInspectorOpen=true;}
  box.replaceChildren();box.removeAttribute('role');box.classList.toggle('inspecting',!!sel&&treeInspectorOpen);
  const toolbar=hEl('div','composition-toolbar');
  const search=document.createElement('input');search.type='search';search.placeholder='Найти предмет';search.setAttribute('aria-label','Поиск предметов');search.dataset.f='tree-search';search.value=treeQuery;
  search.oninput=()=>{treeQuery=search.value;treeInspectorOpen=false;renderTree();};
  const add=tierButton('+ Добавить','Добавить предмет',()=>openTreeAdd('body',hasTiers()&&S.activeTier!=='all'?S.activeTier:null));toolbar.append(search,add);box.append(toolbar);
  const list=hEl('div','tree-list'),root=hEl('ul');root.setAttribute('role','tree');root.setAttribute('aria-label','Состав предметов');list.append(root);box.append(list);
  const query=treeQuery.trim().toLocaleLowerCase(),res=A?.res||[];
  const matches=it=>!query||it.name.toLocaleLowerCase().includes(query);
  const children=it=>S.items.filter(c=>c.stepParentId===it.id&&c!==it&&levelOf(c)===levelOf(it)&&!it.stepParentId);
  const visible=it=>matches(it)||children(it).some(matches);
  const action=(row,label,text,fn)=>{const b=tierButton(text,label,e=>fn(e));b.classList.add('row-action');b.setAttribute('aria-label',label);row.append(b);return b;};
  const node=(parent,id,name,level,opts={})=>{
    const li=hEl('li');li.setAttribute('role','treeitem');li.setAttribute('aria-level',level);
    const expanded=!!query||isOpen(id);if(opts.group)li.setAttribute('aria-expanded',String(expanded));
    if(opts.selected)li.setAttribute('aria-selected','true');
    const row=hEl('div','tn'+(opts.selected?' sel':''));row.dataset.lv=level;row.dataset.node=id;
    if(opts.item){row.dataset.itemId=id;row.draggable=!opts.item.stepParentId;row.title=(opts.item.stepParentId?'Под «'+(stepParent(opts.item)?.name||'удалённым предметом')+'»\n':'')+(itemTipText(id+'#0')||name+' · '+dimTxt(opts.item)+' мм');}
    if(opts.zone)row.dataset.zone=id;
    if(opts.tier){row.dataset.tierId=id;row.draggable=true;}
    if(opts.group){const toggle=hEl('button','tw');toggle.type='button';toggle.dataset.f='toggle-'+id;toggle.setAttribute('aria-label',(expanded?'Свернуть: ':'Развернуть: ')+name);toggle.onclick=()=>{setOpen(id,!expanded);saveDraft();renderTree();};row.append(toggle);}else row.append(hEl('span','tree-leaf-spacer'));
    const icon=hEl('span','compact-symbol',opts.item?(opts.item.stepParentId?'↳':'■'):opts.tier?'▱':'▣');if(opts.item)icon.style.color=PAL3[S.items.indexOf(opts.item)%PAL3.length];icon.setAttribute('aria-hidden','true');row.append(icon);
    const title=hEl('button','tl',name);title.type='button';title.dataset.f='node-'+id;
    title.onclick=()=>{if(opts.item)treeSelect(opts.item);else if(opts.tier){setOpen(id,true);selectTier(id);}else{setOpen(id,!expanded);renderTree();}};
    row.onclick=e=>{if(e.target===row)title.click();};row.append(title);
    if(opts.meta)row.append(hEl('span','tm',opts.meta));
    if(opts.item?.qty>1)row.append(hEl('span','qb','×'+opts.item.qty));
    const issues=res.filter(r=>opts.ids?.includes(r.it.id)&&r.level!=='ok');
    if(issues.length){const err=hEl('span','tree-issue'+(issues.some(r=>r.level==='err')?' error':''),'!'+(opts.group?' '+issues.length:''));err.title=issues.map(r=>r.it.name+': '+r.text).join('\n');err.setAttribute('aria-label',err.title);row.append(err);}
    if(opts.item)action(row,'Действия: '+name,'⋯',e=>{const r=e.currentTarget.getBoundingClientRect();showCtx(r.left,r.bottom,S.selected?.startsWith(id+'#')?S.selected:id+'#0');});
    if(opts.zone)action(row,'Добавить предмет: '+name,'+',()=>openTreeAdd(id));
    if(opts.tier){action(row,'Добавить предмет: '+name,'+',()=>openTreeAdd('body',id));action(row,'Действия яруса: '+name,'⋯',e=>{const r=e.currentTarget.getBoundingClientRect();tierMenu(id,r.left,r.bottom);});}
    li.append(row);parent.append(li);
    if(opts.group&&expanded){const ul=hEl('ul');ul.setAttribute('role','group');li.append(ul);return ul;}
    return null;
  };
  const itemNode=(parent,it,level,force=false)=>{
    if(!force&&!visible(it))return;
    const kids=children(it),list=node(parent,it.id,it.name,level,{item:it,group:!!kids.length,selected:sel?.it===it,ids:[it.id,...kids.map(i=>i.id)]});
    if(list)for(const child of kids)itemNode(list,child,level+1,matches(it));
  };
  let shown=0;
  for(const zone of ['body','lid']){
    const all=S.items.filter(it=>zoneOf(it)===zone),its=all.filter(visible);if(query&&!its.length)continue;
    shown+=its.length;
    const ul=node(root,zone,ZONE_NAME[zone],1,{zone:true,group:true,meta:zone==='body'&&hasTiers()?'Ярусов: '+S.tiers.length:all.reduce((n,i)=>n+i.qty,0)+' шт.',ids:all.map(i=>i.id)});if(!ul)continue;
    const addItems=(parent,items,level)=>{
      const ids=new Set(items.map(i=>i.id));for(const it of items)if(!it.stepParentId||!ids.has(it.stepParentId)||stepParent(it)?.stepParentId)itemNode(parent,it,level);
      if(!items.length)parent.append(hEl('li','empty','Пока пусто'));
    };
    if(zone==='body'&&hasTiers())for(const tier of tierList().slice().reverse()){
      const members=all.filter(i=>tierFor(i).id===tier.id);if(query&&!members.some(visible))continue;
      const group=node(ul,tier.id,tier.name,2,{tier:true,group:true,meta:members.reduce((n,i)=>n+i.qty,0)+' шт.',ids:members.map(i=>i.id),selected:S.activeTier===tier.id});if(group)addItems(group,members,3);
    }else addItems(ul,all,2);
  }
  if(query&&!shown)list.append(hEl('p','empty','Ничего не найдено. Измените запрос.'));
  const inspector=hEl('section','item-inspector');inspector.id='item-inspector';inspector.setAttribute('aria-label','Свойства выбранного предмета');box.append(inspector);
  if(sel){
    const header=hEl('div','inspector-heading');const back=tierButton('← К составу','Вернуться к дереву',()=>{treeInspectorOpen=false;renderTree();});back.classList.add('inspector-back');header.append(back,hEl('strong',null,sel.it.name));
    action(header,'Действия выбранного предмета','⋯',e=>{const r=e.currentTarget.getBoundingClientRect();showCtx(r.left,r.bottom,S.selected);});inspector.append(header,hEl('p','note',dimTxt(sel.it)+' мм · '+levelName(sel.it)));
    renderItemInspector(inspector,sel.it);
  }else inspector.append(hEl('p','note','Выберите предмет, чтобы изменить его свойства.'));
  list.scrollTop=scroll;inspector.scrollTop=propsScroll;
  if(fkey){const focus=Array.from(box.querySelectorAll('[data-f]')).find(e=>e.dataset.f===fkey);if(focus){focus.focus({preventScroll:true});if(caret)try{focus.setSelectionRange(...caret);}catch(e){}}}
  if(changed&&sel){const row=Array.from(list.querySelectorAll('[data-item-id]')).find(e=>e.dataset.itemId===sel.it.id);row?.scrollIntoView({block:'nearest'});}
  $('tree-all').textContent=treeGroupIds().every(isOpen)?'Свернуть всё':'Развернуть всё';
}
