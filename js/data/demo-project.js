"use strict";
// Deterministic, editable example; dimensions are illustrative, not product specifications.
function tierDemoState(){
  const state={caseId:'5040',cat:-1,query:'',material:'ppe-2c',qty:1,needCase:true,
    params:Object.fromEntries(PARAMS.map(p=>[p[0],p[2]])),items:[],place:{},selected:null,
    form:{name:'',contact:'',org:'',comment:''},submitted:null,
    tiers:[{id:'demo-bottom',name:'1 · Питание и кабели',thickness:55,bottom:10,gap:2},
      {id:'demo-middle',name:'2 · Оптика и управление',thickness:85,bottom:10,gap:2},
      {id:'demo-top',name:'3 · Основное оборудование',thickness:110,bottom:10,gap:0}],
    activeTier:'all',treeOpen:['case','body','demo-top','demo-middle','demo-bottom'],
    demoGuide:'Демо: три съёмных яруса занимают 254 из 262 мм глубины основания. Аккумуляторы и кабели лежат под оптикой, а сверху — основное оборудование. Размеры предметов условные. Переключайте ярусы в плане 2D; в 3D сравните «В сборе» и «Разнести ярусы».',
    tierViewMode:'exploded',tierViewGap:100};
  function add(name,l,w,h,x,y,tier,shape='rect',zone='body'){
    const id='i'+(state.items.length+1);
    state.items.push({id,name,shape,kind:shape,l,w,h,dim:[l,w,h],orient:'2',pref:2,up:2,qty:1,zone,tierId:tier,notch:shape==='rect'});
    state.place[id+'#0']={x,y,rot:false};
  }
  // Same XY footprints intentionally repeat on different levels.
  for(let i=0;i<4;i++)add('Аккумулятор '+(i+1),110,70,45,35+i*125,40,'demo-bottom');
  add('Зарядный блок',150,95,40,35,155,'demo-bottom');
  add('Сетевой адаптер',110,80,35,210,155,'demo-bottom');
  add('Кабель питания',110,110,30,365,155,'demo-bottom','cyl');
  add('Кейс карт памяти',160,65,25,35,300,'demo-bottom');
  add('Комплект переходников',130,65,30,230,300,'demo-bottom');
  add('USB-кабель',70,70,25,410,310,'demo-bottom','cyl');
  add('Пульт управления',170,110,50,35,40,'demo-middle');
  add('Объектив 24–70',90,90,70,250,45,'demo-middle','cyl');
  add('Объектив 50',80,80,65,390,45,'demo-middle','cyl');
  add('Накамерный свет',190,110,50,35,210,'demo-middle');
  add('Радиомодуль',120,85,45,265,215,'demo-middle');
  add('Фильтры',85,85,25,425,220,'demo-middle','cyl');
  add('Складной дрон',221,97,91,35,40,'demo-top');
  add('Камера с рукояткой',180,130,90,315,40,'demo-top');
  add('Монитор полевой станции',320,150,60,35,225,'demo-top');
  add('Ручной стабилизатор',115,140,85,400,225,'demo-top');
  add('Планшет 10″',250,175,10,35,40,null,'rect','lid');
  return state;
}
function createTierDemo(){return Projects.create('Демо · Выездная съёмка · 3 яруса',tierDemoState());}
function ensureTierDemo(){
  const key='lozhement-tier-demo-v1';
  if(localStorage.getItem(key))return;
  createTierDemo();localStorage.setItem(key,'1');
}

function steppedDemoState(){
  const s=tierDemoState();delete s.tiers;delete s.activeTier;delete s.tierViewMode;delete s.tierViewGap;
  s.items=[];s.place={};s.treeOpen=['case','body'];s.stepReveal=false;s.stepDemoVersion=2;
  s.demoGuide='Демо ступенчатых карманов: один цельный ложемент, без съёмных ярусов. Все предметы показаны. Включите «Снять верхние предметы», чтобы рассмотреть нижние углубления и опорные уступы. На плане нижние карманы обозначены пунктиром. Для извлечения нижнего предмета сначала выньте верхний. Размеры демонстрационные.';
  s.demoSummary='Четыре пары карманов в одном блоке: маленькие предметы под крупными. В 3D можно снять верхние предметы и увидеть ступени.';
  function add(name,l,w,h,x,y,parent=null,shape='rect',zone='body'){
    const id='i'+(s.items.length+1);s.items.push({id,name,l,w,h,shape,kind:shape,dim:[l,w,h],orient:'2',pref:2,up:2,qty:1,zone,notch:false,...(parent?{stepParentId:parent}:{})});s.place[id+'#0']={x,y,rot:0};return id;
  }
  const station=add('Полевая станция',280,160,65,30,40);
  add('Питание станции',150,85,40,95,77.5,station);
  const camera=add('Камера',160,160,95,350,40);
  add('Карты памяти и адаптеры',80,60,25,390,90,camera);
  const monitor=add('Монитор',320,120,45,30,250);
  add('Комплект кабелей',160,60,30,110,280,monitor);
  const lens=add('Объектив',120,120,70,390,250,null,'cyl');
  add('Фильтры',60,60,25,420,280,lens,'cyl');
  add('Планшет',250,175,10,35,40,null,'rect','lid');
  return s;
}
function createSteppedDemo(){return Projects.create('Демо · Ступенчатые карманы',steppedDemoState());}
function ensureSteppedDemo(){const key='lozhement-stepped-demo-v1';if(localStorage.getItem(key))return;createSteppedDemo();localStorage.setItem(key,'1');}
