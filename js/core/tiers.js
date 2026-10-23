"use strict";
// Tiers are ordered from the case floor upwards. Thickness includes the bottom.
function hasTiers(){return Array.isArray(S.tiers)&&S.tiers.length>0;}
function tierList(c=curCase()){
  if(!hasTiers())return [{id:'body',name:'Основание',thickness:c.body,bottom:S.params.minBottom,gap:0,offset:0}];
  let offset=0;
  return S.tiers.map((t,i)=>{const row={...t,index:i,offset};offset+=t.thickness+t.gap;return row;});
}
function tierFor(it,c=curCase()){return tierList(c).find(t=>t.id===it.tierId)||tierList(c)[0];}
function levelOf(it){return it.zone==='lid'?'lid':hasTiers()?tierFor(it).id:'body';}
function tierHeight(){return hasTiers()?S.tiers.reduce((n,t)=>n+t.thickness+t.gap,0):curCase().body;}
function tierErrors(c=curCase()){
  if(!hasTiers())return [];
  const errors=[];
  for(const t of S.tiers)if(!Number.isFinite(t.thickness)||!Number.isFinite(t.bottom)||!Number.isFinite(t.gap)||t.thickness<=0||t.bottom<1||t.bottom>=t.thickness||t.gap<0)errors.push(t.name+': проверьте толщину, дно и зазор');
  const height=tierHeight();if(height>c.body+0.01)errors.push('Ярусы выше основания на '+r1(height-c.body)+' мм');
  return errors;
}
function normalizeTiers(){
  if(!hasTiers())return;
  for(const it of S.items)if(it.zone!=='lid'&&!S.tiers.some(t=>t.id===it.tierId))it.tierId=S.tiers.some(t=>t.id===S.activeTier)?S.activeTier:S.tiers[0].id;
  if(!['all','lid',...S.tiers.map(t=>t.id)].includes(S.activeTier))S.activeTier=S.tiers.at(-1).id;
}
function levelName(it){return it.zone==='lid'?'Крышка':tierFor(it).name;}
function tierAnalysis(A,t){
  return {...A,c:{...A.c,body:t.thickness},res:A.res.filter(r=>r.zone==='body'&&r.tierId===t.id),ghosts:[],exportTier:t};
}
function arrangeCurrentTier(){
  if(!hasTiers()){relayout();return;}
  const level=S.activeTier==='all'?S.tiers.at(-1).id:S.activeTier;
  const items=S.items.filter(it=>levelOf(it)===level),place=arrangeFor(curCase(),S.params,items);
  for(const x of instances(items)){delete S.place[x.key];if(place[x.key])S.place[x.key]=place[x.key];}
  refresh();renderItems();
}
