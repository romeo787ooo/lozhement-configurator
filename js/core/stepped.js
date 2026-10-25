"use strict";
// One lower pocket per upper item; a continuous foam support ledge surrounds it.
const stepParent=(it,items=S.items)=>items.find(p=>p.id===it.stepParentId);
const stepChild=(it,items=S.items)=>items.find(p=>p.stepParentId===it.id);
function stepLinkError(it,items=S.items){
  if(!it.stepParentId)return '';
  const p=stepParent(it,items);
  if(!p)return 'Верхний предмет удалён. Отсоедините нижний карман или выберите другой предмет.';
  if(p===it||p.stepParentId||stepChild(it,items))return 'Поддерживаются две ступени: верхний и нижний карман.';
  if(it.qty!==1||p.qty!==1)return 'Для ступенчатого кармана нужны отдельные предметы с количеством 1.';
  if(items.filter(x=>x.stepParentId===p.id).length!==1)return 'Под верхним предметом допускается один нижний карман.';
  if(it.zone!==p.zone||levelOf(it)!==levelOf(p))return 'Обе ступени должны находиться в одном ложементе.';
  return '';
}
function depthInfo(it,c,P,zone){
  if(!it.stepParentId)return regularDepthInfo(it,c,P,zone);
  const error=stepLinkError(it),parent=stepParent(it);
  if(error)return {depth:0,err:error};
  const upper=regularDepthInfo(parent,c,P,zone),step=Math.max(1,P.step);
  const startDepth=upper.depth,depth=startDepth+Math.ceil((it.h+Math.max(0,P.clear))/step)*step;
  const limit=zone==='lid'?c.lid-P.minBottom:hasTiers()?tierFor(it,c).thickness-tierFor(it,c).bottom:c.body-P.minBottom;
  return {depth,startDepth,protr:0,lidDepth:0,...(upper.err||upper.protr||depth>limit+1e-6?{err:'Ступенчатый карман: суммарная глубина '+depth+' мм, доступно '+limit+' мм. Проверьте высоту предметов и дно.'}:{})};
}
function syncSteppedPlaces(items=S.items,place=S.place,P=S.params){
  for(const it of items.filter(i=>i.stepParentId)){
    const parent=stepParent(it,items);if(!parent||parent===it||parent.stepParentId)continue;
    it.zone=parent.zone;it.tierId=parent.tierId;
    const pp=place[parent.id+'#0'];if(!pp){delete place[it.id+'#0'];continue;}
    const pg=geom(parent,pp,P).pocket,rot=!!pp.rot!==!!it.stepRotate?90:0;
    const cg=geom(it,{x:0,y:0,rot},P).pocket;
    place[it.id+'#0']={x:pg.x+pg.w/2-cg.w/2-cg.x,y:pg.y+pg.h/2-cg.h/2-cg.y,rot};
  }
  return place;
}
function stepGeometryError(it,place=S.place,P=S.params,items=S.items){
  if(!it.stepParentId)return '';
  const link=stepLinkError(it,items);if(link)return link;
  const parent=stepParent(it,items),a=place[parent.id+'#0'],b=place[it.id+'#0'];
  if(!a||!b)return 'Не размещены обе ступени кармана.';
  const outer=polyOf(pocketSegs(parent,geom(parent,a,P),P)),inner=polyOf(pocketSegs(it,geom(it,b,P),P));
  const inside=([x,y])=>{let yes=false;for(let i=0,j=outer.length-1;i<outer.length;j=i++){
    const [ax,ay]=outer[i],[bx,by]=outer[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)yes=!yes;
  }return yes;};
  const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const ledge=Math.max(5,P.bridge);
  for(let i=0;i<inner.length;i++){
    const a=inner[i],b=inner[(i+1)%inner.length];if(!inside(a))return 'Нижний карман должен проходить через верхний проём.';
    for(let j=0;j<outer.length;j++){
      const c=outer[j],d=outer[(j+1)%outer.length];
      if((cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||Math.min(dist(a,c,d),dist(b,c,d),dist(c,a,b),dist(d,a,b))<ledge-0.01)
        return 'Вокруг нижнего кармана нужен опорный уступ не менее '+ledge+' мм. Уменьшите нижний предмет или увеличьте верхний.';
    }
  }
  return '';
}
function arrangeFor(c,P,items){
  const roots=items.filter(i=>!i.stepParentId),place=arrangeRoots(c,P,roots);
  return syncSteppedPlaces(items,place,P);
}
