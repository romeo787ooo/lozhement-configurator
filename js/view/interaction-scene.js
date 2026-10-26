"use strict";
// Independent demonstration. All dimensions are millimetres; Z is up.
const INTERACT3={active:false,mode:"one",view:"iso"};
INTERACT3.returnLabel="← К ложементу";
INTERACT3.carryNote="Калибр 5040 · человек 180 см · сетка 50 см. Статичная демонстрация способов переноски, без расчёта веса и нагрузки.";
async function loadInteractionHuman3(scene){
  const B=BABYLON,I=INTERACT3;
  const model=await B.SceneLoader.ImportMeshAsync(null,"assets/human/interaction/","human.glb",scene);
  I.character=model;I.humanRoot=model.meshes[0];
  I.humanRoot.rotationQuaternion=B.Quaternion.RotationAxis(B.Axis.X,Math.PI/2);
  I.humanRoot.scaling.setAll(1000);
  I.humanClips=Object.fromEntries(model.animationGroups.map(group=>[group.name.replace(/^carry_/,""),group]));
  I.humanHands=["grip_l","grip_r"].map(name=>model.transformNodes.find(node=>node.name===name));
  if(I.humanHands.some(node=>!node))throw Error("В модели человека отсутствуют кости кистей.");
  for(const mode of ["one","two","roll","side"])if(!I.humanClips[mode])throw Error("В модели человека отсутствует поза: "+mode);
  for(const mesh of model.meshes){mesh.isPickable=false;
    if(mesh.material){mesh.material.backFaceCulling=false;mesh.material.environmentIntensity=.6;}
  }
  for(const group of model.animationGroups)group.stop();I.humanMode=null;
  const partner=await B.SceneLoader.ImportMeshAsync(null,"assets/human/interaction/","human.glb",scene);
  I.partner=partner;I.partnerRoot=partner.meshes[0];
  I.partnerRoot.rotationQuaternion=I.humanRoot.rotationQuaternion.clone();I.partnerRoot.scaling.setAll(1000);
  I.partnerHand=partner.transformNodes.find(node=>node.name==="grip_r");
  for(const mesh of partner.meshes){mesh.isPickable=false;if(mesh.material){mesh.material.backFaceCulling=false;mesh.material.environmentIntensity=.6;}}
  for(const clip of partner.animationGroups)clip.stop();
  const pose=partner.animationGroups.find(clip=>clip.name==="carry_two");
  pose.start(false);pose.pause();pose.goToFrame(pose.from);
  I.partnerRoot.setEnabled(false);
}
function updateInteractionHuman3(){
  const I=INTERACT3,group=I.humanClips?.[I.mode==="two"?"one":I.mode];if(!group)return;
  I.humanRoot.position.x=I.mode==="two"?-786.64:0;
  I.partnerRoot.position.x=786.64;I.partnerRoot.setEnabled(I.mode==="two");
  if(I.humanMode!==I.mode){
    for(const clip of Object.values(I.humanClips))clip.stop();
    group.start(false);group.pause();I.humanMode=I.mode;
  }
  // Static poses: no frame observer or animation clock.
  group.goToFrame(group.from);
  I.reachErrors=I.grips.map((grip,index)=>{
    const wrist=I.mode==="two"&&index===1?I.partnerHand:I.humanHands[0];wrist.computeWorldMatrix(true);
    return BABYLON.Vector3.Distance(wrist.getAbsolutePosition(),grip);
  });
}
async function ensureInteraction3(){
  if(INTERACT3.scene)return;
  const B=BABYLON,d=CASE_MESH["5040"];
  if(!d)throw Error("Модель Калибр 5040 не загружена.");
  const response=await fetch("assets/cases/5040-interaction.json");
  if(!response.ok)throw Error("Не удалось загрузить данные ручек 5040.");
  const mapping=await response.json();
  const scene=INTERACT3.scene=new B.Scene(V3.bjs.engine);
  scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.075,.095,.115,1);
  const camera=INTERACT3.camera=new B.ArcRotateCamera("interaction-camera",0,1,3500,B.Vector3.Zero(),scene);
  camera.upVector=new B.Vector3(0,0,1);camera.minZ=1;camera.maxZ=20000;
  camera.lowerRadiusLimit=600;camera.upperRadiusLimit=10000;camera.wheelDeltaPercentage=.02;
  const light=new B.HemisphericLight("interaction-light",new B.Vector3(.3,-.5,1),scene);
  light.intensity=1;light.groundColor=new B.Color3(.35,.39,.45);
  const floor=B.MeshBuilder.CreateBox("interaction-floor",{width:8000,height:8000,depth:10},scene);
  floor.position.z=-5;floor.material=scaleMaterial3(scene,"interaction-floor-material","#414e5b");
  const grid=[];for(let x=-4000;x<=4000;x+=500){grid.push([new B.Vector3(x,-4000,.2),new B.Vector3(x,4000,.2)]);grid.push([new B.Vector3(-4000,x,.2),new B.Vector3(4000,x,.2)]);}
  B.MeshBuilder.CreateLineSystem("interaction-grid",{lines:grid},scene).color=new B.Color3(.3,.36,.42);
  const root=INTERACT3.root=new B.TransformNode("interaction-case",scene);
  const material=scaleMaterial3(scene,"interaction-case-material","#ffffff");
  const color=rgb3(caseColor()),pivots=INTERACT3.pivots={};
  // CAD format X,Y-up,Z-width -> scene X,Y-width,Z-up.
  function meshPart(name,part,sourceIndices){
    const q=new Uint16Array(b64buf(part.v)),black=new Set(part.blackVertices||[]),map=new Map(),pos=[],indices=[],colors=[];
    for(const old of sourceIndices){
      if(!map.has(old)){map.set(old,map.size);const i=old*3;
        pos.push(part.o[0]+q[i]*d.s,part.o[2]+q[i+2]*d.s,part.o[1]+q[i+1]*d.s);
        colors.push(...(black.has(old)?[.025,.025,.025]:color),1);
      }indices.push(map.get(old));
    }
    const mesh=new B.Mesh(name,scene),vd=new B.VertexData();vd.positions=pos;vd.indices=indices;vd.colors=colors;vd.normals=[];
    B.VertexData.ComputeNormals(pos,indices,vd.normals,{useRightHandedSystem:true});vd.applyToMesh(mesh);
    mesh.material=material;mesh.parent=root;mesh.isPickable=false;return mesh;
  }
  const base=d.base,indices=base.w16?new Uint16Array(b64buf(base.i)):new Uint32Array(b64buf(base.i));
  if(indices.length!==mapping.indexCount)throw Error("Данные ручек не соответствуют модели 5040.");
  const excluded=new Uint8Array(indices.length);
  for(const [id,[start,count]] of Object.entries(mapping.ranges)){
    excluded.fill(1,start,start+count);
    const mesh=meshPart("interaction-part-"+id,base,indices.subarray(start,start+count));
    const pivot=pivots[id]=new B.TransformNode("handle-"+id,scene);pivot.parent=root;mesh.parent=pivot;
    const origin={1:[-316,0,-78],7:[306,0,-65],8:[-306,0,-65],9:[0,-247,-115],13:[0,0,0],43:[316.5,145.25,-254],44:[316.5,-145.25,-254]}[id];
    pivot.position=B.Vector3.FromArray(origin);mesh.position=pivot.position.negate();
  }
  meshPart("interaction-body",base,indices.filter((_,i)=>!excluded[i]));
  meshPart("interaction-lid",d.lid,d.lid.w16?new Uint16Array(b64buf(d.lid.i)):new Uint32Array(b64buf(d.lid.i)));
  await loadInteractionHuman3(scene);
  poseInteraction3();fitInteraction3();
}
function poseInteraction3(){
  const I=INTERACT3,B=BABYLON,v=(x,y,z)=>new B.Vector3(x,y,z),root=I.root;if(!root)return;
  for(const p of Object.values(I.pivots)){p.rotation.set(0,0,0);}
  I.pivots[13].position.set(0,0,0);
  root.position.set(0,0,0);root.rotationQuaternion=B.Quaternion.Identity();
  let grips;
  if(I.mode==="one"){
    I.pivots[9].rotation.x=-Math.PI/2;
    root.rotationQuaternion=B.Quaternion.RotationAxis(v(0,0,1),-Math.PI/2).multiply(B.Quaternion.RotationAxis(v(1,0,0),-Math.PI/2));
    grips=[v(0,-302,-115.3)];
    root.computeWorldMatrix(true);const local=B.Vector3.TransformCoordinates(grips[0],root.getWorldMatrix());
    root.position=v(410,0,970).subtract(local);
  }else if(I.mode==="two"){
    I.pivots[7].rotation.y=-Math.PI/2;I.pivots[8].rotation.y=Math.PI/2;
    root.position.set(0,0,1035);grips=[v(-376.64,0,-65),v(376.64,0,-65)];
  }else{
    const angle=(I.mode==="roll"?25:37)*Math.PI/180;
    const x=v(0,Math.sin(angle),-Math.cos(angle)),y=v(-1,0,0),z=B.Vector3.Cross(x,y);
    const matrix=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(x,y,z,matrix);
    root.rotationQuaternion=B.Quaternion.FromRotationMatrix(matrix);
    if(I.mode==="roll"){
      I.pivots[13].position.x=-370;grips=[v(-647.62,0,-288.7)];
    }else{
      I.pivots[1].rotation.y=Math.PI/2;grips=[v(-478.11,0,-78)];
    }
    root.computeWorldMatrix(true);
    // Both real CAD wheels touch the floor; no case-wide bounding-box shortcut.
    I.floorHeights??={};let bottom=I.floorHeights[I.mode]??Infinity;
    if(!Number.isFinite(bottom))for(const id of [43,44])for(const mesh of I.pivots[id].getChildMeshes()){
      mesh.computeWorldMatrix(true);const p=mesh.getVerticesData(B.VertexBuffer.PositionKind),m=mesh.getWorldMatrix();
      for(let n=0;n<p.length;n+=3)bottom=Math.min(bottom,B.Vector3.TransformCoordinates(v(p[n],p[n+1],p[n+2]),m).z);
    }
    I.floorHeights[I.mode]=bottom;root.position.z=-bottom;
    root.computeWorldMatrix(true);const hand=B.Vector3.TransformCoordinates(grips[0],root.getWorldMatrix());
    root.position.x+=300-hand.x;root.position.y+=80-hand.y;
  }
  root.computeWorldMatrix(true);const targets=grips.map(g=>B.Vector3.TransformCoordinates(g,root.getWorldMatrix()));I.grips=targets;
  updateInteractionHuman3();

}
function fitInteraction3(){
  const I=INTERACT3;if(!I.camera)return;
  const B=BABYLON,aspect=V3.bjs.engine.getAspectRatio(I.camera),target=new B.Vector3(I.mode==="two"?0:180,80,900);
  const direction=B.Vector3.FromArray({iso:[1,-1.5,.6],front:[0,-1,.1],side:[1,0,.1]}[I.view]).normalize();
  const distance=Math.max(2000,(I.mode==="two"?2300:1600)/Math.max(.3,aspect))/2/Math.tan(I.camera.fov/2)*(I.mode==="two"?1.4:1.25);
  I.camera.setTarget(target);I.camera.setPosition(target.add(direction.scale(distance)));
}
async function setHumanSceneMode3(mode){
  const I=INTERACT3;if(I.busy)return;
  I.busy=true;$("interaction-mode").disabled=true;
  try{
    if(mode==="compare"){await ensureScaleScene3();updateScaleCase3();}
    else {await ensureInteraction3();I.mode=mode;poseInteraction3();}
    V3.bjs.camera.detachControl();I.camera?.detachControl();SCALE3.camera?.detachControl();
    I.active=mode!=="compare";SCALE3.active=mode==="compare";
    I.selectedMode=mode;$("interaction-mode").value=mode;
    $("v3-human-controls").hidden=mode!=="compare";
    (SCALE3.active?SCALE3.camera:I.camera).attachControl($("gl3d"),false);
    fitHumanScene3();
    if(I.active)$("v3n").textContent=I.carryNote;
  }finally{I.busy=false;$("interaction-mode").disabled=false;}
}
function fitHumanScene3(){if(SCALE3.active)fitScaleCamera3();else fitInteraction3();}
async function toggleInteraction3(){
  const I=INTERACT3;if(I.busy||!V3.bjs?.ready)return;
  if(I.active||SCALE3.active){
    I.active=false;SCALE3.active=false;
    I.camera?.detachControl();SCALE3.camera?.detachControl();V3.bjs.camera.attachControl($("gl3d"),false);
    for(const [el,hidden] of I.visibility)el.hidden=hidden;
    $("v3-interaction-controls").hidden=true;$("v3-human-controls").hidden=true;
    $("v3-interaction").textContent=I.entryLabel;
    renderBabylon3D();$("v3n").textContent=I.note;
  }else{
    I.entryLabel=$("v3-interaction").textContent;I.note=$("v3n").textContent;
    I.visibility=[...document.querySelector(".t3").children,...["v3objects","v3l","v3lab"].map($)].map(el=>[el,el.hidden]);
    try{await setHumanSceneMode3(I.selectedMode||"compare");}
    catch(e){$("v3n").textContent=e.message;return;}
    for(const [el] of I.visibility)el.hidden=!["v3-interaction","v3-interaction-controls","v3-human-controls"].includes(el.id);
    $("v3-human-controls").hidden=!SCALE3.active;
    $("v3-interaction").textContent=I.returnLabel;
  }
  $("v3-interaction").setAttribute("aria-pressed",String(I.active||SCALE3.active));
}
$("v3-interaction").onclick=toggleInteraction3;
$("interaction-mode").onchange=e=>setHumanSceneMode3(e.target.value).catch(error=>{$("v3n").textContent=error.message;$("interaction-mode").value=INTERACT3.selectedMode;});
document.querySelectorAll("[data-interaction-view]").forEach(el=>el.onclick=()=>{INTERACT3.view=SCALE3.view=el.dataset.interactionView;fitHumanScene3();});
$("interaction-in").onclick=()=>{const camera=SCALE3.active?SCALE3.camera:INTERACT3.camera;if(camera)camera.radius=Math.max(500,camera.radius/1.2);};
$("interaction-out").onclick=()=>{const camera=SCALE3.active?SCALE3.camera:INTERACT3.camera;if(camera)camera.radius=Math.min(14000,camera.radius*1.2);};
$("interaction-fit").onclick=fitHumanScene3;
