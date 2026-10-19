"use strict";
// Lightweight 2D pocket editor. Geometry is normalized to the selected item's bounding box.
let SKETCH = { key: null, points: [], tool: "select", hover: null, cursor: null, drag: null, snap: true, undo: [], redo: [], moved: false, image: null, imageName: "", aiImage: null, aiPipeline: null, aiBusy: false };
const SK_NS = "http://www.w3.org/2000/svg";
const SK_BOX = { x: 20, y: 20, w: 400, h: 260 };
const SK_MAX_POINTS = 80;
function sketchIsOpen() { const d = $("sketch-dialog"); return !!(d && (d.open || d.hasAttribute("open"))); }
function skEl(tag, attrs, parent) { const e = document.createElementNS(SK_NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function skToCanvas(p) { return { x: SK_BOX.x + p.x * SK_BOX.w, y: SK_BOX.y + (1 - p.y) * SK_BOX.h }; }
function skToNorm(p) { let n={x:Math.max(0,Math.min(1,(p.x-SK_BOX.x)/SK_BOX.w)),y:Math.max(0,Math.min(1,1-(p.y-SK_BOX.y)/SK_BOX.h))};if(SKETCH.snap){const s=selInfo(),step=1;n.x=Math.max(0,Math.min(1,Math.round(n.x* Math.max(1,s?.it.l||1)/step)*step/Math.max(1,s?.it.l||1)));n.y=Math.max(0,Math.min(1,Math.round(n.y* Math.max(1,s?.it.w||1)/step)*step/Math.max(1,s?.it.w||1)));}return n; }
function skSnapshot(){return SKETCH.points.map(p=>({x:p.x,y:p.y}));}
function skSaveUndo(){SKETCH.undo.push(skSnapshot());if(SKETCH.undo.length>80)SKETCH.undo.shift();SKETCH.redo=[];}
function skUndo(){if(!SKETCH.undo.length)return;SKETCH.redo.push(skSnapshot());SKETCH.points=SKETCH.undo.pop();SKETCH.hover=null;drawSketch();}
function skRedo(){if(!SKETCH.redo.length)return;SKETCH.undo.push(skSnapshot());SKETCH.points=SKETCH.redo.pop();SKETCH.hover=null;drawSketch();}
function skTransform(fn){if(SKETCH.points.length<3)return;skSaveUndo();SKETCH.points=fn(skSnapshot()).map(p=>({x:+p.x.toFixed(5),y:+p.y.toFixed(5)}));drawSketch();}
function skRotate(deg){const cx=SKETCH.points.reduce((a,p)=>a+p.x,0)/SKETCH.points.length,cy=SKETCH.points.reduce((a,p)=>a+p.y,0)/SKETCH.points.length,a=deg*Math.PI/180;skTransform(ps=>ps.map(p=>({x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*Math.sin(a),y:cy+(p.x-cx)*Math.sin(a)+(p.y-cy)*Math.cos(a)})));}
function skMove(dx,dy){skTransform(ps=>ps.map(p=>({x:p.x+dx,y:p.y+dy})));}
function skDuplicate(){if(SKETCH.points.length<3)return;const copy=skSnapshot();skSaveUndo();SKETCH.points=copy.map(p=>({x:Math.min(.99,p.x+.04),y:Math.min(.99,p.y-.04)}));drawSketch();}
function skFitToBounds(){const p=SKETCH.points;if(p.length<1)return false;const xs=p.map(v=>v.x),ys=p.map(v=>v.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY,margin=.02,scale=Math.min((1-margin*2)/Math.max(w,1e-6),(1-margin*2)/Math.max(h,1e-6),1),left=margin+(1-margin*2-w*scale)/2,top=margin+(1-margin*2-h*scale)/2;const next=p.map(v=>({x:+(left+(v.x-minX)*scale).toFixed(5),y:+(top+(v.y-minY)*scale).toFixed(5)}));const changed=next.some((v,i)=>v.x!==p[i].x||v.y!==p[i].y);if(changed)SKETCH.points=next;return changed;}
function skValidate(){const p=SKETCH.points;if(p.length<3)return 'Нужно минимум 3 точки';if(p.length>SK_MAX_POINTS)return 'Слишком много точек (максимум '+SK_MAX_POINTS+')';for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a.x-b.x,a.y-b.y)<.003)return 'Есть слишком короткий сегмент';}const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const intersects=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<-1e-8&&orient(c,d,a)*orient(c,d,b)<-1e-8;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){if(Math.abs(i-j)<=1||(i===0&&j===p.length-1))continue;if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return 'Контур самопересекается';}return '';}
function skRound(){if(SKETCH.points.length<3)return;const r=Number($('sketch-radius').value)||0;if(r<=0)return;const s=selInfo();const minDim=Math.max(1,Math.min(s?.it.l||1,s?.it.w||1));const t=Math.min(.2,r/minDim);const out=[];SKETCH.points.forEach((p,i)=>{const prev=SKETCH.points[(i-1+SKETCH.points.length)%SKETCH.points.length],next=SKETCH.points[(i+1)%SKETCH.points.length];out.push({x:p.x+(prev.x-p.x)*t,y:p.y+(prev.y-p.y)*t},{x:p.x+(next.x-p.x)*t,y:p.y+(next.y-p.y)*t});});skSaveUndo();SKETCH.points=out;drawSketch();}
function skArray(){const count=Math.max(2,Math.min(12,Number($('sketch-array-count').value)||2)),dx=(Number($('sketch-array-x').value)||0)/(selInfo()?.it.l||1),dy=(Number($('sketch-array-y').value)||0)/(selInfo()?.it.w||1),base=skSnapshot();if(base.length<3)return;skSaveUndo();if(!window.polygonClipping){alert('Для массива нужна библиотека геометрических операций.');return;}try{let merged=[base.map(p=>[p.x,p.y])];for(let i=1;i<count;i++){const ring=base.map(p=>[p.x+dx*i,p.y+dy*i]);merged=polygonClipping.union([merged],[[ring]]);}if(merged.length!==1||merged[0].length!==1){SKETCH.undo.pop();alert('Массив создаёт отдельные контуры. В этой версии они не могут быть сохранены как один карман.');return;}SKETCH.points=merged[0][0].slice(0,-1).map(([x,y])=>({x,y}));drawSketch();}catch(e){SKETCH.undo.pop();alert('Не удалось создать массив: проверьте шаг и количество.');}}
function skOffset(){const s=selInfo(),mm=Number($('sketch-offset').value)||0;if(SKETCH.points.length<3||!s||mm===0)return;if(!window.ClipperLib){alert('Модуль Offset не загрузился. Проверьте подключение к интернету.');return;}try{const scale=1000, path=SKETCH.points.map(p=>({X:Math.round(p.x*s.it.l*scale),Y:Math.round(p.y*s.it.w*scale)}));const co=new ClipperLib.ClipperOffset(2,0.25*scale);co.AddPath(path,ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);const solution=new ClipperLib.Paths();co.Execute(solution,mm*scale);if(!solution.length)throw Error();const best=solution.sort((a,b)=>Math.abs(ClipperLib.Clipper.Area(b))-Math.abs(ClipperLib.Clipper.Area(a)))[0];skSaveUndo();SKETCH.points=best.map(p=>({x:p.X/scale/s.it.l,y:p.Y/scale/s.it.w}));drawSketch();}catch(e){alert('Не удалось сместить контур. Возможно, величина смещения слишком велика.');}}

function skSetDimensions(){const s=selInfo();if(!s||SKETCH.points.length<3)return;const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),nw=Number($("sketch-width").value),nh=Number($("sketch-height").value);if(!(nw>0&&nh>0&&w>0&&h>0))return;const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;skSaveUndo();SKETCH.points=SKETCH.points.map(p=>({x:Math.max(0,Math.min(1,cx+(p.x-cx)*nw/(w*s.it.l))),y:Math.max(0,Math.min(1,cy+(p.y-cy)*nh/(h*s.it.w)))}));drawSketch();}
function skUnionWith(shape){if(SKETCH.points.length<3){SKETCH.points=shape;drawSketch();return;}if(!window.polygonClipping){alert('Модуль объединения контуров не загрузился. Проверьте подключение к интернету.');return;}try{const poly=pts=>[pts.map(p=>[p.x,p.y])],res=polygonClipping.union(poly(SKETCH.points),poly(shape));if(!res.length)throw Error();const rings=res.map(p=>p[0]);if(rings.length!==1){alert('Объединение создало несколько областей. В этой версии поддерживается один внешний контур.');return;}skSaveUndo();SKETCH.points=rings[0].slice(0,-1).map(([x,y])=>({x:+x.toFixed(5),y:+y.toFixed(5)}));drawSketch();}catch(e){alert('Не удалось объединить контуры. Проверьте геометрию фигур.');}}
function skMm(a, b) { const s = selInfo(); return Math.hypot((a.x-b.x)*(s?.it.l||1), (a.y-b.y)*(s?.it.w||1)); }
function skImageStatus(msg) { const el=$('sketch-image-status'); if(el)el.textContent=msg; }
function skSetReferenceImage(dataUrl) { const im=$('sketch-reference-image'); if(!im)return; im.setAttribute('href',dataUrl||''); im.setAttribute('visibility',dataUrl?'visible':'hidden'); }
function skLoadReferenceImage(file) {
 if(!file)return; if(!file.type.startsWith('image/')){skImageStatus('Выберите файл изображения.');return;}
 const reader=new FileReader(); reader.onload=()=>{const img=new Image();img.onload=()=>{SKETCH.image=img;SKETCH.imageName=file.name;SKETCH.aiImage=null;skSetReferenceImage(reader.result);$('sketch-ai-segment').disabled=false;$('sketch-trace-image').disabled=false;$('sketch-image-clear').disabled=false;skImageStatus(`Фото загружено: ${file.name} (${img.naturalWidth}×${img.naturalHeight}). Настройте отделение фона.`);};img.onerror=()=>skImageStatus('Не удалось открыть это изображение. Попробуйте JPG или PNG.');img.src=reader.result;};reader.onerror=()=>skImageStatus('Не удалось прочитать файл.');reader.readAsDataURL(file);
}
async function skRunAiSegmentation() {
 if(!SKETCH.image||SKETCH.aiBusy)return;
 const btn=$('sketch-ai-segment');SKETCH.aiBusy=true;btn.disabled=true;btn.textContent='CarveKit обрабатывает…';
 try {
  if(location.protocol==='file:') throw new Error('FILE_PROTOCOL: откройте приложение через локальный веб-сервер.');
  skImageStatus('CarveKit обрабатывает изображение локально. Первый запуск может загружать модели несколько минут.');
  const source=await (await fetch(SKETCH.image.src)).blob(),fd=new FormData();fd.append('file',source,SKETCH.imageName||'image.png');
  const res=await fetch('http://127.0.0.1:7000/matting',{method:'POST',body:fd});
  if(!res.ok){let detail='HTTP '+res.status;try{const j=await res.json();detail=j.detail||detail;}catch(_){}throw new Error(detail);}
  const mask=await res.blob(),bitmap=await createImageBitmap(mask),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
  SKETCH.aiMaskCanvas=canvas;SKETCH.aiImage=new Image();SKETCH.aiImage.onload=()=>{skSetReferenceImage(canvas.toDataURL('image/png'));skImageStatus('CarveKit построил alpha-маску. Строю редактируемый контур…');skTraceFromImage();};SKETCH.aiImage.src=canvas.toDataURL('image/png');
 } catch(e) { console.error('CarveKit segmentation failed',e);const msg=String(e&&e.message||e);if(msg.startsWith('FILE_PROTOCOL:'))skImageStatus('ИИ не запускается из file://. Откройте приложение через локальный веб-сервер.');else if(/Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg))skImageStatus('CarveKit недоступен. Запустите: uvicorn carvekit_server:app --host 127.0.0.1 --port 7000');else skImageStatus('Ошибка CarveKit: '+msg); }
 finally {SKETCH.aiBusy=false;btn.disabled=false;btn.textContent='ИИ: выделить и построить контур';}
}
function skTraceFromImage() {
 const img=SKETCH.image,s=selInfo(); if(!img||!s)return;
 const src=SKETCH.aiMaskCanvas||img,sw=src.width||src.naturalWidth,sh=src.height||src.naturalHeight;
 const scale=Math.min(320/sw,320/sh),w=Math.max(40,Math.round(sw*scale)),h=Math.max(40,Math.round(sh*scale));
 const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(src,0,0,w,h);
 let data;try{data=cx.getImageData(0,0,w,h).data;}catch(e){skImageStatus('Браузер не разрешил обработать изображение.');return;}
 const n=w*h,mask=new Uint8Array(n),seen=new Uint8Array(n);
 if(SKETCH.aiMaskCanvas){
  // RMBG returns the foreground as alpha. Use a slightly conservative threshold
  // to discard translucent background haze and edge noise before tracing.
  // CarveKit returns a soft alpha matte. For hard product silhouettes a
  // stricter cutoff removes the translucent halo that creates noisy necks,
  // strings and other narrow false contours.
  for(let i=0;i<n;i++)mask[i]=data[i*4+3]>=128?1:0;
 } else {
  const ids=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>(y*w+x)*4),bg=[0,1,2].map(k=>ids.reduce((a,i)=>a+data[i+k],0)/ids.length),tol=Number($('sketch-image-tolerance').value)||55;
  for(let i=0;i<n;i++){const d=i*4;mask[i]=Math.hypot(data[d]-bg[0],data[d+1]-bg[1],data[d+2]-bg[2])>tol?1:0;}
 }
 // Fill tiny one-pixel gaps without repeatedly shrinking the detected object.
 const morph=(input,dilate)=>{const out=new Uint8Array(n);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let hit=0,total=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){total++;hit+=input[(y+dy)*w+x+dx];}out[y*w+x]=dilate?(hit>0?1:0):(hit===total?1:0);}return out;};
 const majority=(input)=>{const out=new Uint8Array(n);for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let hit=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)hit+=input[(y+dy)*w+x+dx];out[y*w+x]=hit>=13?1:0;}return out;};
 mask.set(majority(morph(morph(mask,true),false)));
 // Keep only the largest connected component; this removes disconnected speckles.
 let best=[];const q=new Int32Array(n);for(let i=0;i<n;i++){if(!mask[i]||seen[i])continue;let head=0,tail=0;seen[i]=1;q[tail++]=i;while(head<tail){const k=q[head++],x=k%w,y=(k/w)|0;for(const j of [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;q[tail++]=j;}}if(tail>best.length)best=Array.from(q.slice(0,tail));}
 if(best.length<30){skImageStatus('ИИ-маска слишком мала или пустая. Попробуйте другое фото с предметом целиком в кадре.');return;}
 const component=new Uint8Array(n);let minx=w,miny=h,maxx=0,maxy=0;for(const k of best){component[k]=1;const x=k%w,y=(k/w)|0;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
 // Build an ordered contour from the exposed edges of foreground pixels.
 // Unlike pixel-centre neighbour walking, edge chaining cannot jump from
 // one side of a narrow neck to the other at a diagonal contact.
 const edges=[],edgeAt=new Map(), ek=(x,y)=>x+','+y, filled=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&component[y*w+x], addEdge=(x1,y1,x2,y2)=>{const e={id:edges.length,x1,y1,x2,y2};edges.push(e);const k=ek(x1,y1);if(!edgeAt.has(k))edgeAt.set(k,[]);edgeAt.get(k).push(e);};
 for(const k of best){const x=k%w,y=(k/w)|0;if(!filled(x,y-1))addEdge(x,y,x+1,y);if(!filled(x+1,y))addEdge(x+1,y,x+1,y+1);if(!filled(x,y+1))addEdge(x+1,y+1,x,y+1);if(!filled(x-1,y))addEdge(x,y+1,x,y);}
 const used=new Uint8Array(edges.length),loops=[];for(const first of edges)if(!used[first.id]){const loop=[],start=first;let e=first,guard=0;while(e&&guard<=edges.length+1&&!used[e.id]){used[e.id]=1;loop.push({x:e.x1,y:e.y1});const candidates=(edgeAt.get(ek(e.x2,e.y2))||[]).filter(q=>!used[q.id]||q.id===start.id);const a0=Math.atan2(e.y2-e.y1,e.x2-e.x1);let next=null,bestTurn=-Infinity;for(const q of candidates){const a1=Math.atan2(q.y2-q.y1,q.x2-q.x1);let turn=a1-a0;while(turn<=-Math.PI)turn+=2*Math.PI;while(turn>Math.PI)turn-=2*Math.PI;if(q.id===start.id)turn+=10;if(turn>bestTurn){bestTurn=turn;next=q;}}if(next&&next.id===start.id)break;e=next;guard++;}if(loop.length>=8){let area=0;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];area+=a.x*b.y-b.x*a.y;}loops.push({points:loop,area:Math.abs(area)});}}
 const boundary=loops.sort((a,b)=>b.area-a.area)[0]?.points||[];
 if(boundary.length<8){skImageStatus('Не удалось восстановить связную границу маски. Попробуйте повторить выделение ИИ.');return;}
 // Simplify the ordered contour by geometric error, rather than uniform sampling.
 // Uniformly dropping points can cut across concave regions and create large chords.
 const rdp=(points,epsilon)=>{
  if(points.length<3)return points.slice();
  const eps2=epsilon*epsilon,keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const mark=(a,b)=>{let best=-1,max=eps2,ax=points[a].x,ay=points[a].y,bx=points[b].x,by=points[b].y,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
   for(let i=a+1;i<b;i++){const p=points[i],t=den?Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/den)):0,qx=ax+t*dx,qy=ay+t*dy,d=(p.x-qx)*(p.x-qx)+(p.y-qy)*(p.y-qy);if(d>max){max=d;best=i;}}
   if(best>=0){keep[best]=1;mark(a,best);mark(best,b);}
  };
  mark(0,points.length-1);return points.filter((_,i)=>keep[i]);
 };
 let reduced=boundary.slice(),epsilon=1;
 while(reduced.length>SK_MAX_POINTS){epsilon*=1.35;reduced=rdp(boundary,epsilon);}
 if(reduced.length<3)reduced=boundary.filter((p,i)=>i%Math.max(1,Math.floor(boundary.length/40))===0);
 // The selected item dimensions are the target bounding box. Do not shrink
 // the traced mask to an arbitrary 88%: that created a visible false margin
 // around the source object and made the generated contour systematically too small.
 const bw=Math.max(1,maxx-minx),bh=Math.max(1,maxy-miny),maxW=s.it.l,maxH=s.it.w,ratio=bw/bh;let mmW=maxW,mmH=mmW/ratio;if(mmH>maxH){mmH=maxH;mmW=mmH*ratio;}const spanX=mmW/s.it.l,spanY=mmH/s.it.w;
 let pts=reduced.map(p=>({x:.5-spanX/2+(p.x-minx)/bw*spanX,y:.5+spanY/2-(p.y-miny)/bh*spanY}));
 skSaveUndo();SKETCH.points=pts;SKETCH.hover=null;setSketchTool('select');drawSketch();skImageStatus(`Контур построен по границе ИИ-маски (${SKETCH.points.length} точек). Сохранены вогнутые участки; проверьте тонкие детали и поправьте точки при необходимости.`);
}
function skClearReferenceImage() { SKETCH.image=null;SKETCH.imageName='';skSetReferenceImage('');$('sketch-image-file').value='';SKETCH.aiImage=null;SKETCH.aiMaskCanvas=null;$('sketch-ai-segment').disabled=true;$('sketch-trace-image').disabled=true;$('sketch-image-clear').disabled=true;skImageStatus('Фото убрано. Текущий контур сохранён.'); }
function openSketchEditor() { const s = selInfo(); if (!s || s.it.shape === "cyl") return; SKETCH.key = s.key; SKETCH.points = Array.isArray(s.it.customShape) ? s.it.customShape.map(p => ({x:p.x,y:p.y})) : []; SKETCH.undo = []; SKETCH.redo = []; SKETCH.hover = null; SKETCH.tool = "select"; setSketchTool("select"); $("sketch-item-name").textContent = s.it.name + " · " + s.it.l + " × " + s.it.w + " мм"; drawSketch(); const d = $("sketch-dialog"); if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
function closeSketchEditor() { const d = $("sketch-dialog"); if (d.close) d.close(); else d.removeAttribute("open"); }
function setSketchTool(tool) { SKETCH.tool = tool; document.querySelectorAll("[data-sk-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skTool === tool))); const c = $("sketch-canvas"); c.style.cursor = tool === "select" ? "default" : "crosshair"; }
function drawSketch() {
 const g = $("sketch-shape"); g.textContent = ""; const pts = SKETCH.points.map(skToCanvas); const s = selInfo();
 if (pts.length >= 2) { const path = pts.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ")+(pts.length>=3?" Z":""); skEl("path",{d:path,fill:pts.length>=3?"var(--accent-soft)":"none",stroke:"var(--accent)","stroke-width":2.5,"stroke-linejoin":"round"},g); }
 if (SKETCH.cursor && SKETCH.tool === "draw" && pts.length) { const p=skToCanvas(SKETCH.cursor), last=pts[pts.length-1]; skEl("line",{x1:last.x,y1:last.y,x2:p.x,y2:p.y,stroke:"var(--accent)","stroke-dasharray":"4 3","stroke-width":1.5},g); const len=skMm(SKETCH.points[SKETCH.points.length-1],SKETCH.cursor); const t=skEl("text",{x:(last.x+p.x)/2+8,y:(last.y+p.y)/2-8,fill:"var(--ink)","font-size":12,"font-weight":600},g); t.textContent=len.toFixed(1)+" мм"; }
 pts.forEach((p,i)=>{ const selected=SKETCH.hover===i; skEl("circle",{cx:p.x,cy:p.y,r:selected?7:5,fill:selected?"#d94841":"var(--accent)",stroke:"var(--panel)","stroke-width":2,"data-sk-point":i},g); const t=skEl("text",{x:p.x+8,y:p.y-8,fill:"var(--ink)","font-size":11,"font-family":"IBM Plex Mono, monospace","pointer-events":"none"},g); t.textContent=String(i+1); });
 // Dimension arrows and labels around the drawing bounds.
 if (pts.length) { const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys); const width=((x1-x0)/SK_BOX.w*(s?.it.l||0)), height=((y1-y0)/SK_BOX.h*(s?.it.w||0));
  skEl("line",{x1:x0,y1:Math.max(7,y0-13),x2:x1,y2:Math.max(7,y0-13),stroke:"var(--ink-2)","stroke-width":1,"marker-start":"url(#sk-arrow)","marker-end":"url(#sk-arrow)"},g); let tw=skEl("text",{x:(x0+x1)/2,y:Math.max(12,y0-17),fill:"var(--ink-2)","font-size":11,"text-anchor":"middle"},g);tw.textContent=width.toFixed(1)+" мм";
  skEl("line",{x1:Math.min(433,x1+13),y1:y0,x2:Math.min(433,x1+13),y2:y1,stroke:"var(--ink-2)","stroke-width":1},g); let th=skEl("text",{x:Math.min(432,x1+17),y:(y0+y1)/2,fill:"var(--ink-2)","font-size":11,"text-anchor":"start",transform:`rotate(90 ${Math.min(432,x1+17)} ${(y0+y1)/2})`},g);th.textContent=height.toFixed(1)+" мм";
 }
 const n=SKETCH.points.length, err=skValidate(); if(s&&n>=3){const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y);$("sketch-width").value=((Math.max(...xs)-Math.min(...xs))*s.it.l).toFixed(1);$("sketch-height").value=((Math.max(...ys)-Math.min(...ys))*s.it.w).toFixed(1);} $("sketch-status").textContent=n<3?`Точек: ${n}. Нужно ещё ${3-n}.`:`Точек: ${n}. ${err ? "⚠ "+err : (SKETCH.tool==="select"?"Выберите вершину или трансформируйте контур.":"Контур корректен.")}`; $("sketch-apply").disabled=n<3||!!err; $("sketch-undo").disabled=!SKETCH.undo.length; if($("sketch-redo"))$("sketch-redo").disabled=!SKETCH.redo.length; $("sketch-undo").disabled=!n; $("sketch-clear").disabled=!n; $("sketch-delete-point").disabled=SKETCH.hover===null;
}
function skEventPoint(e) { const svg=$("sketch-canvas"),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function nearestSketchPoint(p) { let best=null,dist=13; SKETCH.points.forEach((v,i)=>{const q=skToCanvas(v),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){best=i;dist=d;}});return best; }
function addSketchPoint(e) { const p=skEventPoint(e); if(p.x<SK_BOX.x||p.x>SK_BOX.x+SK_BOX.w||p.y<SK_BOX.y||p.y>SK_BOX.y+SK_BOX.h)return; const idx=nearestSketchPoint(p); if(SKETCH.tool==="select"){SKETCH.hover=idx; drawSketch();return;} const n=skToNorm(p); const last=SKETCH.points[SKETCH.points.length-1]; if(last&&Math.hypot(last.x-n.x,last.y-n.y)<.015)return; SKETCH.points.push({x:+n.x.toFixed(4),y:+n.y.toFixed(4)});drawSketch(); }
function skCircle() { const pts=[];for(let i=0;i<32;i++){const a=2*Math.PI*i/32;pts.push({x:.5+.46*Math.cos(a),y:.5+.46*Math.sin(a)});}return pts; }
function skSquare() { return [{x:.12,y:.12},{x:.88,y:.12},{x:.88,y:.88},{x:.12,y:.88}]; }
function skHull(points) { const a=points.slice().sort((p,q)=>p.x-q.x||p.y-q.y); if(a.length<3)return a; const cross=(o,x,y)=>(x.x-o.x)*(y.y-o.y)-(x.y-o.y)*(y.x-o.x);const lo=[],up=[];for(const p of a){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}for(let i=a.length-1;i>=0;i--){const p=a[i];while(up.length>=2&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}lo.pop();up.pop();return lo.concat(up); }
function addSketchShape(type) { skUnionWith(type==="circle"?skCircle():skSquare());setSketchTool("select");drawSketch(); }
function applySketch() { const s=selInfo();if(skFitToBounds())drawSketch();const err=skValidate();if(!s||s.key!==SKETCH.key||SKETCH.points.length<3||err){if(err){const el=$("sketch-status");if(el)el.textContent="⚠ "+err;}return;}s.it.customShape=SKETCH.points.map(p=>({x:p.x,y:p.y}));s.it.notch=false;closeSketchEditor();renderItems();refresh();updateTools();saveDraft(); }
function initSketchEditor() {
 $("sketch-image-file").addEventListener("change",e=>skLoadReferenceImage(e.target.files&&e.target.files[0]));$("sketch-ai-segment").addEventListener("click",skRunAiSegmentation);$("sketch-image-tolerance").addEventListener("input",e=>$("sketch-image-tolerance-value").textContent=e.target.value);$("sketch-trace-image").addEventListener("click",skTraceFromImage);$("sketch-image-clear").addEventListener("click",skClearReferenceImage);
 $("btn-sketch").addEventListener("click",openSketchEditor);$("sketch-close").addEventListener("click",closeSketchEditor);const canvas=$("sketch-canvas");
 canvas.addEventListener("click",e=>{if(SKETCH.moved){SKETCH.moved=false;return;}if(SKETCH.tool!=="draw")return;const p=skEventPoint(e);if(p.x<SK_BOX.x||p.x>SK_BOX.x+SK_BOX.w||p.y<SK_BOX.y||p.y>SK_BOX.y+SK_BOX.h)return;const n=skToNorm(p),last=SKETCH.points[SKETCH.points.length-1];if(last&&Math.hypot(last.x-n.x,last.y-n.y)<.015)return;skSaveUndo();SKETCH.points.push({x:+n.x.toFixed(4),y:+n.y.toFixed(4)});drawSketch();});
 canvas.addEventListener("pointerdown",e=>{const p=skEventPoint(e);if(SKETCH.tool==="select"){const i=nearestSketchPoint(p);if(i!==null){SKETCH.drag=i;SKETCH.moved=false;skSaveUndo();canvas.setPointerCapture(e.pointerId);}}});
 canvas.addEventListener("pointermove",e=>{const p=skEventPoint(e);SKETCH.cursor=skToNorm(p);if(SKETCH.drag!==null){const n=skToNorm(p);SKETCH.points[SKETCH.drag]={x:+n.x.toFixed(5),y:+n.y.toFixed(5)};SKETCH.hover=SKETCH.drag;SKETCH.moved=true;}else SKETCH.hover=nearestSketchPoint(p);drawSketch();});canvas.addEventListener("pointerup",()=>{SKETCH.drag=null;});canvas.addEventListener("pointercancel",()=>{SKETCH.drag=null;});canvas.addEventListener("mouseleave",()=>{SKETCH.cursor=null;SKETCH.hover=null;drawSketch();});
 document.querySelectorAll("[data-sk-tool]").forEach(b=>b.addEventListener("click",()=>setSketchTool(b.dataset.skTool)));$("sketch-undo").addEventListener("click",skUndo);$("sketch-redo").addEventListener("click",skRedo);$("sketch-clear").addEventListener("click",()=>{skSaveUndo();SKETCH.points=[];drawSketch();});$("sketch-delete-point").addEventListener("click",()=>{if(SKETCH.hover!==null){skSaveUndo();SKETCH.points.splice(SKETCH.hover,1);}SKETCH.hover=null;drawSketch();});$("sketch-circle").addEventListener("click",()=>addSketchShape("circle"));$("sketch-square").addEventListener("click",()=>addSketchShape("square"));
 $("sketch-example").addEventListener("click",()=>{skSaveUndo();SKETCH.points=[{x:.12,y:.12},{x:.72,y:.12},{x:.88,y:.32},{x:.72,y:.5},{x:.88,y:.7},{x:.72,y:.88},{x:.12,y:.88},{x:.22,y:.5}];drawSketch();});$("sketch-reset").addEventListener("click",()=>{const s=selInfo();if(!s)return;delete s.it.customShape;s.it.notch=false;closeSketchEditor();renderItems();refresh();updateTools();saveDraft();});$("sketch-apply").addEventListener("click",applySketch);$("sketch-snap").addEventListener("change",e=>{SKETCH.snap=e.target.checked;});$("sketch-set-dimensions").addEventListener("click",skSetDimensions);$("sketch-move").addEventListener("click",()=>skMove((Number($("sketch-dx").value)||0)/(selInfo()?.it.l||1),(Number($("sketch-dy").value)||0)/(selInfo()?.it.w||1)));$("sketch-rotate").addEventListener("click",()=>skRotate(Number($("sketch-angle").value)||0));$("sketch-duplicate").addEventListener("click",skDuplicate);$("sketch-offset-apply").addEventListener("click",skOffset);$("sketch-round").addEventListener("click",skRound);$("sketch-array-apply").addEventListener("click",skArray);
 $("sketch-dialog").addEventListener("click",e=>{if(e.target===$("sketch-dialog"))closeSketchEditor();});document.addEventListener("keydown",e=>{if(!$('sketch-dialog').open)return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?skRedo():skUndo();}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();skRedo();}else if(e.key==='Delete'&&SKETCH.hover!==null){skSaveUndo();SKETCH.points.splice(SKETCH.hover,1);SKETCH.hover=null;drawSketch();}else if(e.key==='Escape')closeSketchEditor();});
}
