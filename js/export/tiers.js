"use strict";
function drawingTiersSVG(A,nums,order){
  const F=A.F,P=A.P,fs=Math.max(9,F.L/60),pad=fs*3,side=F.L*.7;
  const levels=[{id:'lid',name:'Крышка',thickness:A.c.lid,bottom:P.minBottom,offset:0},...tierList().slice().reverse()];
  const blocks=levels.map(t=>({...t,rows:nums.list.filter(x=>t.id==='lid'?x.r.zone==='lid':x.r.tierId===t.id).sort((a,b)=>Number(!!a.r.it.stepParentId)-Number(!!b.r.it.stepParentId))}));
  const heights=blocks.map(t=>Math.max(F.W+fs*9,t.rows.length*fs*3+fs*9));
  const width=F.L+side+pad*3,height=heights.reduce((n,h)=>n+h,0)+pad*2;
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}mm" height="${height}mm"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" fill="#222" font-size="${fs}">`];
  const text=(x,y,s)=>out.push(`<text x="${x}" y="${y}">${esc(s)}</text>`);
  text(pad,pad,'Калибр '+A.c.id+' · '+order.no+' · порядок сверху вниз');
  let y=pad+fs*3;
  blocks.forEach((t,i)=>{
    text(pad,y,t.name+' · '+r1(F.L)+' × '+r1(F.W)+' × '+t.thickness+' мм');
    text(pad,y+fs*1.7,'Дно ≥ '+t.bottom+' мм'+(t.id==='lid'?'':' · от дна основания '+r1(t.offset)+' мм · зазор сверху '+t.gap+' мм'));
    const top=y+fs*3,tx=x=>pad+x,ty=v=>top+F.W-v;
    out.push(`<path d="${segPath(rrSegs({x:0,y:0,w:F.L,h:F.W},P.cornerR,null),tx,ty)}" fill="#f5f5f5" stroke="#222"/>`);
    t.rows.forEach(({no,r},j)=>{
      const segs=pocketSegs(r.it,r.g,P),c=segs[0];
      if(c.t==='C')out.push(`<circle cx="${tx(c.cx)}" cy="${ty(c.cy)}" r="${c.r}" fill="#ddd" stroke="#222"/>`);
      else out.push(`<path d="${segPath(segs,tx,ty)}" fill="#ddd" stroke="#222"/>`);
      text(tx(r.g.pocket.x+r.g.pocket.w/2),ty(stepChild(r.it)?r.g.pocket.y+r.g.pocket.h-fs*2:r.g.pocket.y+r.g.pocket.h/2),no);
      text(F.L+pad*2,top+j*fs*3,no+'. '+r.it.name);
      text(F.L+pad*2,top+(j*3+1.3)*fs,'Вырез '+sizeTxt(r.it,P)+' · глуб. '+(r.it.stepParentId?r.d.startDepth+'–':'')+r.d.depth+' · X '+r1(r.g.pocket.x)+' Y '+r1(r.g.pocket.y));
    });
    y+=heights[i];
  });
  text(pad,height-pad*.4,'Высота ярусов с зазорами: '+r1(tierHeight())+' / '+A.c.body+' мм. Глубины вырезов отсчитываются от верха соответствующего яруса.');
  out.push('</g></svg>');return out.join('');
}
