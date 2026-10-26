"use strict";
// Self-contained mesh payloads travel with project JSON; no object URLs in state.
const ItemModels=(()=>{
  const cache=new WeakMap(),MAX_TRIANGLES=50000;
  const fail=message=>{throw Error(message);};
  const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  function hull(points){
    const a=points.sort((p,q)=>p.x-q.x||p.y-q.y).filter((p,i,v)=>!i||p.x!==v[i-1].x||p.y!==v[i-1].y);
    const cross=(o,p,q)=>(p.x-o.x)*(q.y-o.y)-(p.y-o.y)*(q.x-o.x),half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=1e-12)h.pop();h.push(p);}return h;};
    return half(a).slice(0,-1).concat(half(a.slice().reverse()).slice(0,-1));
  }
  function oriented(p,up){return up===0?[p[1],p[2],p[0]]:up===1?[1-p[0],p[2],p[1]]:p;}
  function parse(buffer,name,unit){
    if(buffer.byteLength>20*1024*1024)fail('Максимальный размер файла — 20 МБ.');
    if(![1,10,1000,25.4].includes(unit))fail('Выберите единицы измерения.');
    const positions=[],indices=[],map=new Map();let degenerate=0;
    const vertex=p=>{
      if(p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e9))fail('Некорректные координаты вершин.');
      const key=p.join(',');if(!map.has(key)){map.set(key,positions.length/3);positions.push(...p);}return map.get(key);
    };
    const triangle=(a,b,c)=>{
      const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
      if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-15){degenerate++;return;}
      indices.push(vertex(a),vertex(b),vertex(c));
      if(indices.length/3>MAX_TRIANGLES)fail('Не более 50 000 треугольников. Упростите сетку перед импортом.');
    };
    const ext=name.split('.').pop().toLowerCase();
    if(ext==='stl'){
      const dv=new DataView(buffer),n=buffer.byteLength>=84?dv.getUint32(80,true):0;
      if(n&&84+n*50===buffer.byteLength){
        if(n>MAX_TRIANGLES)fail('Не более 50 000 треугольников.');
        for(let i=0;i<n;i++){const at=84+i*50+12,p=[];for(let j=0;j<3;j++)p.push([0,1,2].map(k=>dv.getFloat32(at+j*12+k*4,true)));triangle(...p);}
      }else{
        const text=new TextDecoder().decode(buffer),p=[];
        if(!/^\s*solid\b/i.test(text)||! /endsolid/i.test(text))fail('Повреждённый STL.');
        for(const line of text.split(/\r?\n/)){const m=line.trim().split(/\s+/);if(m[0].toLowerCase()==='vertex'){if(m.length!==4)fail('Некорректная вершина STL.');p.push(m.slice(1).map(Number));if(p.length===3){triangle(...p);p.length=0;}}}
        if(p.length)fail('Неполный треугольник STL.');
      }
    }else if(ext==='obj'){
      const vertices=[];
      for(const line of new TextDecoder().decode(buffer).split(/\r?\n/)){
        const parts=line.replace(/#.*/,'').trim().split(/\s+/);
        if(parts[0]==='v'){if(parts.length<4)fail('Некорректная вершина OBJ.');const v=parts.slice(1,4).map(Number);if(v.some(x=>!Number.isFinite(x)))fail('Некорректная вершина OBJ.');vertices.push(v);}
        if(parts[0]==='f'){
          if(parts.length<4||parts.length>129)fail('Некорректная грань OBJ.');
          const p=parts.slice(1).map(t=>{const n=Number(t.split('/')[0]),i=n<0?vertices.length+n:n-1;if(!Number.isInteger(n)||!n||!vertices[i])fail('Некорректный индекс OBJ.');return vertices[i];});
          // Accept convex planar polygons; reject ambiguous concave faces instead of corrupting them.
          if(p.length>3){
            const a=p[1].map((x,k)=>x-p[0][k]),b=p[2].map((x,k)=>x-p[0][k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);
            if(!len)fail('Триангулируйте грани OBJ перед импортом.');
            for(let i=0;i<p.length;i++){const u=p[(i+1)%p.length].map((x,k)=>x-p[i][k]),v=p[(i+2)%p.length].map((x,k)=>x-p[(i+1)%p.length][k]),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(c.reduce((s,x,k)=>s+x*n[k],0)<-1e-9||Math.abs(p[i].reduce((s,x,k)=>s+(x-p[0][k])*n[k],0))/len>1e-5)fail('Триангулируйте невыпуклые или неплоские грани OBJ перед импортом.');}
          }
          for(let i=1;i+1<p.length;i++)triangle(p[0],p[i],p[i+1]);
        }
      }
    }else fail('Поддерживаются OBJ и STL.');
    if(!indices.length)fail('Файл не содержит треугольников.');
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    positions.forEach((v,i)=>{lo[i%3]=Math.min(lo[i%3],v);hi[i%3]=Math.max(hi[i%3],v);});
    const dim=hi.map((v,i)=>(v-lo[i])*unit);
    if(dim.some(d=>d<.1||d>10000))fail('Габариты должны быть от 0,1 до 10 000 мм по каждой оси. Проверьте единицы.');
    const q=new Uint16Array(positions.map((v,i)=>Math.round((v-lo[i%3])/(hi[i%3]-lo[i%3])*65535)));
    const projections=[0,1,2].map(up=>{const points=[];for(let i=0;i<q.length;i+=3){const p=oriented([q[i]/65535,q[i+1]/65535,q[i+2]/65535],up);points.push({x:p[0],y:p[1]});}return hull(points);});
    if(projections.some(p=>p.length>512))fail('Проекция слишком подробная. Упростите модель перед импортом (до 512 вершин внешнего контура).');
    const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
    const open=[...edges.values()].some(n=>n!==2);
    return {version:1,vertices:b64(new Uint8Array(q.buffer)),indices:b64(new Uint8Array(new Uint32Array(indices).buffer)),projections,dim,triangles:indices.length/3,source:name.slice(0,200),open,degenerate};
  }
  function decode(model){
    if(cache.has(model))return cache.get(model);
    if(model.version!==1||typeof model.vertices!=='string'||typeof model.indices!=='string'||model.vertices.length>2000000||model.indices.length>1000000)fail('Повреждённые данные модели.');
    const v=bytes(model.vertices),i=bytes(model.indices);
    if(v.length%6||i.length%12||i.length/12>MAX_TRIANGLES)fail('Повреждённая сетка.');
    const result={v:new Uint16Array(v.buffer),i:new Uint32Array(i.buffer)};
    if(result.i.some(n=>n>=result.v.length/3))fail('Некорректные индексы сетки.');
    cache.set(model,result);return result;
  }
  function draw(m,it,x,y,z,rot){
    const data=decode(it.model),points=[];
    for(let i=0;i<data.v.length;i+=3){const p=oriented([data.v[i]/65535,data.v[i+1]/65535,data.v[i+2]/65535],it.up);points.push(m.v(x+(rot?p[1]*it.w:p[0]*it.l),y+(rot?(1-p[0])*it.l:p[1]*it.w),z+p[2]*it.h));}
    for(let i=0;i<data.i.length;i+=3)m.tri(points[data.i[i]],points[data.i[i+1]],points[data.i[i+2]]);
  }
  function contour(it,clear){
    const points=it.customShape.map(p=>({X:Math.round(p.x*it.l*1000),Y:Math.round(p.y*it.w*1000)}));
    if(clear>0){const offset=new ClipperLib.ClipperOffset(2,50),out=[];offset.AddPath(points,ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);offset.Execute(out,clear*1000);if(out.length!==1)fail('Не удалось построить контур модели.');return out[0].map(p=>({x:p.X/1000+clear,y:p.Y/1000+clear}));}
    return points.map(p=>({x:p.X/1000,y:p.Y/1000}));
  }
  return {parse,decode,draw,contour};
})();
