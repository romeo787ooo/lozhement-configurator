"use strict";
// Lightweight 2D pocket editor. Geometry is normalized to the selected item's bounding box.
let SKETCH = { key: null, points: [], tool: "select", hover: null, cursor: null, drag: null, snap: true, undo: [], redo: [], moved: false, image: null, imageName: "", aiImage: null, aiPipeline: null, aiBusy: false };
const SK_NS = "http://www.w3.org/2000/svg";
const SK_BOX = { x: 20, y: 20, w: 400, h: 260 };
const SK_MAX_POINTS = 80;
function sketchIsOpen() { const d = $("sketch-dialog"); return !!(d && (d.open || d.hasAttribute("open"))); }
function skEl(tag, attrs, parent) { const e = document.createElementNS(SK_NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const skWidth=()=>SKETCH.pocketSize?.pw||1, skHeight=()=>SKETCH.pocketSize?.ph||1;
function skToCanvas(p) { const v=SKETCH.viewport||{x:0,y:0,w:1,h:1};return { x: SK_BOX.x + (p.x-v.x)/v.w * SK_BOX.w, y: SK_BOX.y + (1-(p.y-v.y)/v.h) * SK_BOX.h }; }
function skToNorm(p) {
 const v=SKETCH.viewport||{x:0,y:0,w:1,h:1};
 const n={x:v.x+(p.x-SK_BOX.x)/SK_BOX.w*v.w,y:v.y+(1-(p.y-SK_BOX.y)/SK_BOX.h)*v.h};
 if(SKETCH.snap){n.x=Math.round(n.x*skWidth())/skWidth();n.y=Math.round(n.y*skHeight())/skHeight();}return n;
}
function skExpandCanvas() {
 if(SKETCH.drag!==null)return; // Keep the coordinate system stable under the pointer.
 const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y);
 const x=Math.min(0,...xs),y=Math.min(0,...ys),w=Math.max(1,...xs)-x,h=Math.max(1,...ys)-y;
 const scale=Math.max(w*skWidth()/SK_BOX.w,h*skHeight()/SK_BOX.h)*1.15;
 const vw=scale*SK_BOX.w/skWidth(),vh=scale*SK_BOX.h/skHeight();
 SKETCH.viewport={x:x+w/2-vw/2,y:y+h/2-vh/2,w:vw,h:vh};
 const image=$('sketch-reference-image'),a=skToCanvas({x:0,y:1}),b=skToCanvas({x:1,y:0});
 if(image)for(const [k,val] of Object.entries({x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}))image.setAttribute(k,val);
}
function skSnapshot(){return SKETCH.points.map(p=>({x:p.x,y:p.y}));}
function skSaveUndo(){SKETCH.undo.push(skSnapshot());if(SKETCH.undo.length>80)SKETCH.undo.shift();SKETCH.redo=[];}
function skUndo(){if(!SKETCH.undo.length)return;SKETCH.redo.push(skSnapshot());SKETCH.points=SKETCH.undo.pop();SKETCH.hover=null;drawSketch();}
function skRedo(){if(!SKETCH.redo.length)return;SKETCH.undo.push(skSnapshot());SKETCH.points=SKETCH.redo.pop();SKETCH.hover=null;drawSketch();}
function skTransform(fn){if(SKETCH.points.length<3)return;skSaveUndo();SKETCH.points=fn(skSnapshot()).map(p=>({x:+p.x.toFixed(5),y:+p.y.toFixed(5)}));drawSketch();}
function skRotate(deg){const cx=SKETCH.points.reduce((a,p)=>a+p.x,0)/SKETCH.points.length,cy=SKETCH.points.reduce((a,p)=>a+p.y,0)/SKETCH.points.length,a=deg*Math.PI/180;skTransform(ps=>ps.map(p=>({x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*skHeight()/skWidth()*Math.sin(a),y:cy+(p.x-cx)*skWidth()/skHeight()*Math.sin(a)+(p.y-cy)*Math.cos(a)})));}
function skMove(dx,dy){skTransform(ps=>ps.map(p=>({x:p.x+dx,y:p.y+dy})));}
function skDuplicate(){if(SKETCH.points.length<3)return;const copy=skSnapshot();skSaveUndo();SKETCH.points=copy.map(p=>({x:p.x+.04,y:p.y-.04}));drawSketch();}
function skFitToBounds(){const p=SKETCH.points;if(p.length<1)return false;const xs=p.map(v=>v.x),ys=p.map(v=>v.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY,margin=.02,scale=Math.min((1-margin*2)/Math.max(w,1e-6),(1-margin*2)/Math.max(h,1e-6),1),left=margin+(1-margin*2-w*scale)/2,top=margin+(1-margin*2-h*scale)/2;const next=p.map(v=>({x:+(left+(v.x-minX)*scale).toFixed(5),y:+(top+(v.y-minY)*scale).toFixed(5)}));const changed=next.some((v,i)=>v.x!==p[i].x||v.y!==p[i].y);if(changed)SKETCH.points=next;return changed;}
function skValidate(){const p=SKETCH.points;if(p.length<3)return 'Нужно минимум 3 точки';if(p.length>SK_MAX_POINTS)return 'Слишком много точек (максимум '+SK_MAX_POINTS+')';for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a.x-b.x,a.y-b.y)<1e-7)return 'Есть слишком короткий сегмент';}const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const intersects=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<-1e-8&&orient(c,d,a)*orient(c,d,b)<-1e-8;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){if(Math.abs(i-j)<=1||(i===0&&j===p.length-1))continue;if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return 'Контур самопересекается';}return '';}
function skRound(){if(SKETCH.points.length<3)return;const r=Number($('sketch-radius').value)||0;if(r<=0)return;const s=selInfo();const minDim=Math.max(1,Math.min(s?.it.l||1,s?.it.w||1));const t=Math.min(.2,r/minDim);const out=[];SKETCH.points.forEach((p,i)=>{const prev=SKETCH.points[(i-1+SKETCH.points.length)%SKETCH.points.length],next=SKETCH.points[(i+1)%SKETCH.points.length];out.push({x:p.x+(prev.x-p.x)*t,y:p.y+(prev.y-p.y)*t},{x:p.x+(next.x-p.x)*t,y:p.y+(next.y-p.y)*t});});skSaveUndo();SKETCH.points=out;drawSketch();}
function skArray(){const count=Math.max(2,Math.min(12,Number($('sketch-array-count').value)||2)),dx=(Number($('sketch-array-x').value)||0)/skWidth(),dy=(Number($('sketch-array-y').value)||0)/skHeight(),base=skSnapshot();if(base.length<3)return;skSaveUndo();if(!window.polygonClipping){alert('Для массива нужна библиотека геометрических операций.');return;}try{let merged=[base.map(p=>[p.x,p.y])];for(let i=1;i<count;i++){const ring=base.map(p=>[p.x+dx*i,p.y+dy*i]);merged=polygonClipping.union([merged],[[ring]]);}if(merged.length!==1||merged[0].length!==1){SKETCH.undo.pop();alert('Массив создаёт отдельные контуры. В этой версии они не могут быть сохранены как один карман.');return;}SKETCH.points=merged[0][0].slice(0,-1).map(([x,y])=>({x,y}));drawSketch();}catch(e){SKETCH.undo.pop();alert('Не удалось создать массив: проверьте шаг и количество.');}}
function skOffset(){const s=selInfo(),mm=Number($('sketch-offset').value)||0;if(SKETCH.points.length<3||!s||mm===0)return;if(!window.ClipperLib){alert('Модуль Offset не загрузился. Проверьте подключение к интернету.');return;}try{const scale=1000, path=SKETCH.points.map(p=>({X:Math.round(p.x*skWidth()*scale),Y:Math.round(p.y*skHeight()*scale)}));const co=new ClipperLib.ClipperOffset(2,0.25*scale);co.AddPath(path,ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);const solution=new ClipperLib.Paths();co.Execute(solution,mm*scale);if(!solution.length)throw Error();const best=solution.sort((a,b)=>Math.abs(ClipperLib.Clipper.Area(b))-Math.abs(ClipperLib.Clipper.Area(a)))[0];skSaveUndo();SKETCH.points=best.map(p=>({x:p.X/scale/skWidth(),y:p.Y/scale/skHeight()}));drawSketch();}catch(e){alert('Не удалось сместить контур. Возможно, величина смещения слишком велика.');}}

function skSetDimensions(){const s=selInfo();if(!s||SKETCH.points.length<3)return;const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),nw=Number($("sketch-width").value),nh=Number($("sketch-height").value);if(!(nw>0&&nh>0&&w>0&&h>0))return;const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;skSaveUndo();SKETCH.points=SKETCH.points.map(p=>({x:cx+(p.x-cx)*nw/(w*skWidth()),y:cy+(p.y-cy)*nh/(h*skHeight())}));drawSketch();}
function skUnionWith(shape){if(SKETCH.points.length<3){SKETCH.points=shape;drawSketch();return;}if(!window.polygonClipping){alert('Модуль объединения контуров не загрузился. Проверьте подключение к интернету.');return;}try{const poly=pts=>[pts.map(p=>[p.x,p.y])],res=polygonClipping.union(poly(SKETCH.points),poly(shape));if(!res.length)throw Error();const rings=res.map(p=>p[0]);if(rings.length!==1){alert('Объединение создало несколько областей. В этой версии поддерживается один внешний контур.');return;}skSaveUndo();SKETCH.points=rings[0].slice(0,-1).map(([x,y])=>({x:+x.toFixed(5),y:+y.toFixed(5)}));drawSketch();}catch(e){alert('Не удалось объединить контуры. Проверьте геометрию фигур.');}}
function skMm(a, b) { const s = selInfo(); return Math.hypot((a.x-b.x)*skWidth(), (a.y-b.y)*skHeight()); }
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
function openSketchEditor() { const s = selInfo(); if (!s) return; SKETCH.selectedPoint=null; SKETCH.key = s.key; SKETCH.viewport=null; skZoom(1,true); skLoadCurrentContour(s.it); SKETCH.initial = JSON.stringify(SKETCH.points); SKETCH.drag=null; SKETCH.moved=false; skClearReferenceImage(); SKETCH.undo = []; SKETCH.redo = []; SKETCH.hover = null; SKETCH.tool = "select"; setSketchTool("select"); $("sketch-item-name").textContent = s.it.name + " · " + s.it.l + " × " + s.it.w + " мм"; drawSketch(); const d = $("sketch-dialog"); if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
function skLoadCurrentContour(it) {
  const g=geom(it,{x:0,y:0,rot:0},S.params);
  SKETCH.pocketSize={pw:g.fp.w,ph:g.fp.h};
  if(it.customShape?.length>=3){SKETCH.points=it.customShape.map(p=>({...p}));return;}
  SKETCH.points=polyOf(pocketSegs(it,g,S.params)).map(([x,y])=>({x:x/g.fp.w,y:y/g.fp.h}));
}
function closeSketchEditor() { skHideMenu(); const d = $("sketch-dialog"); if (d.close) d.close(); else d.removeAttribute("open"); }
function setSketchTool(tool) { SKETCH.tool = tool; document.querySelectorAll("[data-sk-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skTool === tool))); const hint=$("sketch-mode-hint");if(hint)hint.textContent=tool==="draw"?"?????????? ????? ???????. Esc ??? ???? ?? ???????????? ????? ????????? ??????????.":"?????????????? ?????. Alt ? ??????????? ????? ??????? ????."; const c = $("sketch-canvas"); c.style.cursor = tool === "select" ? "default" : "crosshair"; }
function drawSketch() {
 skExpandCanvas(); const g = $("sketch-shape"); g.textContent = ""; const pts = SKETCH.points.map(skToCanvas); const s = selInfo();
 if (pts.length >= 2) { const path = pts.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ")+(pts.length>=3?" Z":""); skEl("path",{d:path,fill:pts.length>=3?"var(--accent-soft)":"none",stroke:"var(--accent)","stroke-width":2.5,"stroke-linejoin":"round"},g); }
 if (SKETCH.cursor && SKETCH.tool === "draw" && pts.length) { const p=skToCanvas(SKETCH.cursor), last=pts[pts.length-1]; skEl("line",{x1:last.x,y1:last.y,x2:p.x,y2:p.y,stroke:"var(--accent)","stroke-dasharray":"4 3","stroke-width":1.5},g); const len=skMm(SKETCH.points[SKETCH.points.length-1],SKETCH.cursor); const t=skEl("text",{x:(last.x+p.x)/2+8,y:(last.y+p.y)/2-8,fill:"var(--ink)","font-size":12,"font-weight":600},g); t.textContent=len.toFixed(1)+" мм"; }
 pts.forEach((p,i)=>{ const selected=SKETCH.hover===i||SKETCH.selectedPoint===i; skEl("circle",{cx:p.x,cy:p.y,r:selected?7:5,fill:selected?"#d94841":"var(--accent)",stroke:"var(--panel)","stroke-width":2,"data-sk-point":i},g); const t=skEl("text",{x:p.x+8,y:p.y-8,fill:"var(--ink)","font-size":11,"font-family":"IBM Plex Mono, monospace","pointer-events":"none"},g); t.textContent=pts.length<=12||selected?String(i+1):""; });
 // Dimension arrows and labels around the drawing bounds.
 if (pts.length) { const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys); const width=((x1-x0)/SK_BOX.w*SKETCH.viewport.w*skWidth()), height=((y1-y0)/SK_BOX.h*SKETCH.viewport.h*skHeight());
  skEl("line",{x1:x0,y1:Math.max(7,y0-13),x2:x1,y2:Math.max(7,y0-13),stroke:"var(--ink-2)","stroke-width":1,"marker-start":"url(#sk-arrow)","marker-end":"url(#sk-arrow)"},g); let tw=skEl("text",{x:(x0+x1)/2,y:Math.max(12,y0-17),fill:"var(--ink-2)","font-size":11,"text-anchor":"middle"},g);tw.textContent=width.toFixed(1)+" мм";
  skEl("line",{x1:Math.min(433,x1+13),y1:y0,x2:Math.min(433,x1+13),y2:y1,stroke:"var(--ink-2)","stroke-width":1},g); let th=skEl("text",{x:Math.min(432,x1+17),y:(y0+y1)/2,fill:"var(--ink-2)","font-size":11,"text-anchor":"start",transform:`rotate(90 ${Math.min(432,x1+17)} ${(y0+y1)/2})`},g);th.textContent=height.toFixed(1)+" мм";
 }
 const n=SKETCH.points.length, err=skValidate(); if(s&&n>=3){const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y);$("sketch-width").value=((Math.max(...xs)-Math.min(...xs))*skWidth()).toFixed(1);$("sketch-height").value=((Math.max(...ys)-Math.min(...ys))*skHeight()).toFixed(1);} $("sketch-status").textContent=n<3?`Точек: ${n}. Нужно ещё ${3-n}.`:`Точек: ${n}. ${err ? "⚠ "+err : (SKETCH.tool==="select"?"Выберите вершину или трансформируйте контур.":"Контур корректен.")}`; $("sketch-apply").disabled=n<3||!!err; $("sketch-undo").disabled=!SKETCH.undo.length; if($("sketch-redo"))$("sketch-redo").disabled=!SKETCH.redo.length;  $("sketch-clear").disabled=!n; $("sketch-delete-point").disabled=SKETCH.selectedPoint==null||!SKETCH.points[SKETCH.selectedPoint];
}
function skEventPoint(e) { const svg=$("sketch-canvas"),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function nearestSketchPoint(p) { let best=null,dist=13; SKETCH.points.forEach((v,i)=>{const q=skToCanvas(v),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){best=i;dist=d;}});return best; }
function skCornerPoints(index, single=false) {
 const ids=[index];if(single)return ids;
 const anchor=skToCanvas(SKETCH.points[index]),count=SKETCH.points.length;
 for(const step of [-1,1])for(let n=1;n<count;n++){
  const i=(index+step*n+count)%count,p=skToCanvas(SKETCH.points[i]);
  if(ids.includes(i)||Math.hypot(p.x-anchor.x,p.y-anchor.y)>9)break;
  ids.push(i);
 }
 return ids;
}
function skHideMenu(){const menu=$('sketch-point-menu');if(menu)menu.hidden=true;}
let skTipTimer=0,skTipKey=null;
function skHideTip(){clearTimeout(skTipTimer);skTipKey=null;const t=$('sketch-tooltip');if(t)t.hidden=true;}
function skTip(key,text,x,y){
 if(skTipKey===key)return;skHideTip();skTipKey=key;
 skTipTimer=setTimeout(()=>{
  if(!sketchIsOpen())return;
  let t=$('sketch-tooltip');if(!t){t=document.createElement('div');t.id='sketch-tooltip';t.className='sk-tooltip';t.setAttribute('role','tooltip');$('sketch-dialog').append(t);}
  t.textContent=text;t.hidden=false;t.style.left='0px';t.style.top='0px';const r=t.getBoundingClientRect();
  t.style.left=Math.max(4,Math.min(x+12,innerWidth-r.width-4))+'px';t.style.top=Math.max(4,Math.min(y+16,innerHeight-r.height-4))+'px';
 },600);
}
function skSegmentTip(e){
 if(SKETCH.drag!==null){skHideTip();return;}
 const p=skEventPoint(e),pts=SKETCH.points,n=pts.length,m=$('sketch-canvas').getScreenCTM();let best=7/Math.hypot(m.a,m.b),index=-1;
 for(let i=0;i<(n>=3?n:n-1);i++){
  const a=skToCanvas(pts[i]),b=skToCanvas(pts[(i+1)%n]),dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0,d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  if(d<best){best=d;index=i;}
 }
 if(index<0){skHideTip();return;}
 const length=skMm(pts[index],pts[(index+1)%n]);skTip('edge-'+index+'-'+length,'Длина отрезка: '+length.toFixed(1)+' мм',e.clientX,e.clientY);
}
function skEndDrawing(){skHideMenu();SKETCH.cursor=null;SKETCH.drag=null;SKETCH.moved=false;setSketchTool('select');drawSketch();}
function skZoom(factor=1,reset=false){
 SKETCH.zoom=reset?1:Math.max(.5,Math.min(4,(SKETCH.zoom||1)*factor));
 const w=440/SKETCH.zoom,h=300/SKETCH.zoom;
 $('sketch-canvas').setAttribute('viewBox',`${(440-w)/2} ${(300-h)/2} ${w} ${h}`);
 $('sketch-zoom-value').textContent=Math.round(SKETCH.zoom*100)+'%';
 $('sketch-zoom-in').disabled=SKETCH.zoom>=4;$('sketch-zoom-out').disabled=SKETCH.zoom<=.5;
}
function skPointMenu(e){
 e.preventDefault();e.stopPropagation();
 const eventPoint=skEventPoint(e),index=nearestSketchPoint(eventPoint),point=skToNorm(eventPoint);
 SKETCH.hover=index;SKETCH.selectedPoint=index;drawSketch();
 let menu=$('sketch-point-menu');
 if(!menu){menu=document.createElement('div');menu.id='sketch-point-menu';menu.className='sk-point-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Действия с точкой');$('sketch-dialog').append(menu);}
 menu.textContent='';
 const add=(text,fn,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.setAttribute('role','menuitem');b.onclick=()=>{skHideMenu();fn();};menu.append(b);};
 add('Добавить точку',()=>skInsertPoint(point,index),SKETCH.points.length>=SK_MAX_POINTS);
 add('Удалить точку',()=>{skSaveUndo();SKETCH.points.splice(index,1);SKETCH.hover=null;drawSketch();},index===null);
 add('UNDO',skUndo,!SKETCH.undo.length);
 menu.hidden=false;menu.style.left='0px';menu.style.top='0px';
 const r=menu.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(e.clientX,innerWidth-r.width-4))+'px';menu.style.top=Math.max(4,Math.min(e.clientY,innerHeight-r.height-4))+'px';menu.querySelector('button').focus();
}
function skInsertPoint(point,index=null) {
 const points=SKETCH.points,n=points.length;if(n>=SK_MAX_POINTS)return;
 let at=n,p={...point};
 if(index!==null&&n>=2){
  const next=points[(index+1)%n];p={x:(points[index].x+next.x)/2,y:(points[index].y+next.y)/2};at=index+1;
 }else if(n>=3&&SKETCH.tool!=="draw"){
  // Insert into the nearest edge, preserving the contour's vertex order.
  let best=Infinity;
  for(let i=0;i<n;i++){
   const a=points[i],b=points[(i+1)%n],dx=(b.x-a.x)*skWidth(),dy=(b.y-a.y)*skHeight();
   const x=(p.x-a.x)*skWidth(),y=(p.y-a.y)*skHeight(),den=dx*dx+dy*dy;
   const t=den?Math.max(0,Math.min(1,(x*dx+y*dy)/den)):0,d=(x-t*dx)**2+(y-t*dy)**2;
   if(d<best){best=d;at=i+1;}
  }
 }
 if(points.some(q=>Math.hypot((q.x-p.x)*skWidth(),(q.y-p.y)*skHeight())<.01))return;
 skSaveUndo();points.splice(at,0,p);SKETCH.hover=at;SKETCH.moved=false;drawSketch();
}
function addSketchPoint(e) { const p=skEventPoint(e); if(p.x<SK_BOX.x||p.x>SK_BOX.x+SK_BOX.w||p.y<SK_BOX.y||p.y>SK_BOX.y+SK_BOX.h)return; const idx=nearestSketchPoint(p); if(SKETCH.tool==="select"){SKETCH.hover=idx; drawSketch();return;} const n=skToNorm(p); const last=SKETCH.points[SKETCH.points.length-1]; if(last&&Math.hypot(last.x-n.x,last.y-n.y)<.015)return; SKETCH.points.push({x:+n.x.toFixed(4),y:+n.y.toFixed(4)});drawSketch(); }
function skCircle() { const pts=[];for(let i=0;i<32;i++){const a=2*Math.PI*i/32;pts.push({x:.5+.46*Math.cos(a),y:.5+.46*Math.sin(a)});}return pts; }
function skSquare() { return [{x:.12,y:.12},{x:.88,y:.12},{x:.88,y:.88},{x:.12,y:.88}]; }
function skHull(points) { const a=points.slice().sort((p,q)=>p.x-q.x||p.y-q.y); if(a.length<3)return a; const cross=(o,x,y)=>(x.x-o.x)*(y.y-o.y)-(x.y-o.y)*(y.x-o.x);const lo=[],up=[];for(const p of a){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}for(let i=a.length-1;i>=0;i--){const p=a[i];while(up.length>=2&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}lo.pop();up.pop();return lo.concat(up); }
function addSketchShape(type) { skUnionWith(type==="circle"?skCircle():skSquare());setSketchTool("select");drawSketch(); }
function applySketch() { const s=selInfo();const err=skValidate();if(!s||s.key!==SKETCH.key||SKETCH.points.length<3||err){if(err){const el=$("sketch-status");if(el)el.textContent="⚠ "+err;}return;}if(JSON.stringify(SKETCH.points)===SKETCH.initial){closeSketchEditor();return;}const xs=SKETCH.points.map(p=>p.x),ys=SKETCH.points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY;
if(w<1e-8||h<1e-8)return;
// Normalize to the new physical bounds, preserving millimetres and placement.
for(const {key} of instances([s.it])){const pl=S.place[key];if(!pl)continue;const rotated=pl.rot&&s.it.shape!=="cyl";
 pl.x+=rotated?minY*skHeight():minX*skWidth();pl.y+=rotated?(1-maxX)*skWidth():minY*skHeight();}
s.it.customShape=SKETCH.points.map(p=>({x:(p.x-minX)/w,y:(p.y-minY)/h}));
s.it.customPocketScale={x:w*skWidth()/(s.it.l+2*S.params.clear),y:h*skHeight()/((s.it.shape==="cyl"?s.it.l:s.it.w)+2*S.params.clear)};s.it.notch=false;closeSketchEditor();renderItems();refresh();updateTools();saveDraft(); }
function initSketchEditor() {
 $("sketch-image-file").addEventListener("change",e=>skLoadReferenceImage(e.target.files&&e.target.files[0]));$("sketch-ai-segment").addEventListener("click",skRunAiSegmentation);$("sketch-image-tolerance").addEventListener("input",e=>$("sketch-image-tolerance-value").textContent=e.target.value);$("sketch-trace-image").addEventListener("click",skTraceFromImage);$("sketch-image-clear").addEventListener("click",skClearReferenceImage);
 $("btn-sketch").addEventListener("click",openSketchEditor);$("sketch-close").addEventListener("click",closeSketchEditor);const canvas=$("sketch-canvas");
 $('sketch-dialog').addEventListener('cancel',e=>{e.preventDefault();skEndDrawing();});
 $('sketch-zoom-in').onclick=()=>skZoom(1.25);$('sketch-zoom-out').onclick=()=>skZoom(1/1.25);
 const toolbar=document.querySelector('.sk-canvas-tools');
 const tips={
  'select':'Перетаскивание точек — выберите вершину и тяните мышью. Alt — перемещение одной точки угла.',
  'sketch-undo':'UNDO — отменяет последнее изменение контура (Ctrl+Z).',
  'sketch-redo':'REDO — повторяет отменённое изменение (Ctrl+Y).',
  'sketch-zoom-in':'Приблизить — увеличивает масштаб холста без изменения размеров контура.',
  'sketch-zoom-out':'Отдалить — уменьшает масштаб, чтобы видеть больше контура.'
 };
 toolbar.querySelector('[data-sk-tool="select"]').setAttribute('aria-label','Перетаскивание точек');
 toolbar.querySelectorAll('button').forEach(b=>{if(tips[b.id||b.dataset.skTool])b.title=tips[b.id||b.dataset.skTool];});
 toolbar.querySelectorAll('button').forEach(b=>{b.dataset.tooltip=b.title;b.removeAttribute('title');});
 toolbar.addEventListener('pointermove',e=>{const b=e.target.closest('button');if(b)skTip(b,b.dataset.tooltip,e.clientX,e.clientY);else skHideTip();});
 toolbar.addEventListener('focusin',e=>{const b=e.target.closest('button');if(b){const r=b.getBoundingClientRect();skTip(b,b.dataset.tooltip,r.left,r.bottom);}});
 toolbar.addEventListener('pointerleave',skHideTip);toolbar.addEventListener('focusout',skHideTip);
 canvas.addEventListener('pointermove',skSegmentTip);canvas.addEventListener('pointerleave',skHideTip);
 $('sketch-dialog').addEventListener('pointerdown',skHideTip,true);$('sketch-dialog').addEventListener('scroll',skHideTip,true);$('sketch-dialog').addEventListener('close',skHideTip);window.addEventListener('resize',skHideTip);
 canvas.addEventListener("click",e=>{if(SKETCH.moved){SKETCH.moved=false;return;}if(SKETCH.tool!=="draw")return;const p=skEventPoint(e);if(SKETCH.tool==="draw"&&nearestSketchPoint(p)!==null){skEndDrawing();return;}if(p.x<SK_BOX.x||p.x>SK_BOX.x+SK_BOX.w||p.y<SK_BOX.y||p.y>SK_BOX.y+SK_BOX.h)return;const n=skToNorm(p),last=SKETCH.points[SKETCH.points.length-1];if(last&&Math.hypot(last.x-n.x,last.y-n.y)<.015)return;skInsertPoint({x:+n.x.toFixed(4),y:+n.y.toFixed(4)});});
 canvas.addEventListener("contextmenu",skPointMenu);
 canvas.addEventListener("pointerdown",e=>{
  if(e.button!==0)return;skHideMenu();const p=skEventPoint(e);
  if(SKETCH.tool!=="select")return;
  const i=nearestSketchPoint(p);if(i===null)return;
  e.preventDefault();SKETCH.selectedPoint=i;SKETCH.drag=i;SKETCH.moved=false;SKETCH.dragAnchor=skToNorm(p);
  SKETCH.dragPoints=skCornerPoints(i,e.altKey).map(index=>({index,point:{...SKETCH.points[index]}}));
  skSaveUndo();canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener("pointermove",e=>{
  const p=skEventPoint(e);SKETCH.cursor=skToNorm(p);
  if(SKETCH.drag!==null){
   const n=skToNorm(p),dx=n.x-SKETCH.dragAnchor.x,dy=n.y-SKETCH.dragAnchor.y;
   for(const {index,point} of SKETCH.dragPoints)SKETCH.points[index]={x:point.x+dx,y:point.y+dy};
   SKETCH.hover=SKETCH.drag;SKETCH.moved=true;
  }else SKETCH.hover=nearestSketchPoint(p);
  drawSketch();
 });
 const finish=()=>{if(SKETCH.drag===null)return;SKETCH.drag=null;SKETCH.dragPoints=null;drawSketch();};
 canvas.addEventListener("pointerup",finish);canvas.addEventListener("pointercancel",finish);
 canvas.addEventListener("mouseleave",()=>{if(SKETCH.drag!==null)return;SKETCH.cursor=null;SKETCH.hover=null;drawSketch();});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sketch-point-menu'))skHideMenu();});
 $('sketch-dialog').addEventListener('scroll',skHideMenu,true);window.addEventListener('resize',skHideMenu);
 document.querySelectorAll("[data-sk-tool]").forEach(b=>b.addEventListener("click",()=>setSketchTool(b.dataset.skTool)));$("sketch-undo").addEventListener("click",skUndo);$("sketch-redo").addEventListener("click",skRedo);$("sketch-clear").addEventListener("click",()=>{skSaveUndo();SKETCH.points=[];SKETCH.selectedPoint=null;SKETCH.hover=null;SKETCH.cursor=null;SKETCH.moved=false;SKETCH.drag=null;skHideMenu();setSketchTool("draw");drawSketch();});$("sketch-delete-point").addEventListener("click",()=>{if(SKETCH.selectedPoint!=null){skSaveUndo();SKETCH.points.splice(SKETCH.selectedPoint,1);}SKETCH.selectedPoint=null;SKETCH.hover=null;drawSketch();});$("sketch-circle").addEventListener("click",()=>addSketchShape("circle"));$("sketch-square").addEventListener("click",()=>addSketchShape("square"));
 $("sketch-example").addEventListener("click",()=>{skSaveUndo();SKETCH.points=[{x:.12,y:.12},{x:.72,y:.12},{x:.88,y:.32},{x:.72,y:.5},{x:.88,y:.7},{x:.72,y:.88},{x:.12,y:.88},{x:.22,y:.5}];drawSketch();});$("sketch-reset").addEventListener("click",()=>{const s=selInfo();if(!s)return;delete s.it.customShape;delete s.it.customPocketScale;s.it.notch=false;closeSketchEditor();renderItems();refresh();updateTools();saveDraft();});$("sketch-apply").addEventListener("click",applySketch);$("sketch-snap").addEventListener("change",e=>{SKETCH.snap=e.target.checked;});$("sketch-set-dimensions").addEventListener("click",skSetDimensions);$("sketch-move").addEventListener("click",()=>skMove((Number($("sketch-dx").value)||0)/skWidth(),(Number($("sketch-dy").value)||0)/skHeight()));$("sketch-rotate").addEventListener("click",()=>skRotate(Number($("sketch-angle").value)||0));$("sketch-duplicate").addEventListener("click",skDuplicate);$("sketch-offset-apply").addEventListener("click",skOffset);$("sketch-round").addEventListener("click",skRound);$("sketch-array-apply").addEventListener("click",skArray);
 $("sketch-dialog").addEventListener("click",e=>{if(e.target===$("sketch-dialog"))closeSketchEditor();});document.addEventListener("keydown",e=>{if(!$('sketch-dialog').open)return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?skRedo():skUndo();}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();skRedo();}else if(e.key==='Delete'&&SKETCH.hover!==null){skSaveUndo();SKETCH.points.splice(SKETCH.hover,1);SKETCH.hover=null;drawSketch();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();skEndDrawing();}});
}
