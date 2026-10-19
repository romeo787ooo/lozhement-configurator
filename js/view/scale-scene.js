"use strict";
// Independent millimetre-based scene; opening it does not change the layout.
const SCALE3 = { active: false, height: 1800, view: "iso" };
function scaleMaterial3(scene, name, color) {
  const m=new BABYLON.StandardMaterial(name,scene);
  m.diffuseColor=BABYLON.Color3.FromHexString(color);
  m.specularColor=BABYLON.Color3.Black();m.backFaceCulling=false;
  return m;
}
async function ensureScaleScene3() {
  if(SCALE3.scene)return;
  const scene=SCALE3.scene=new BABYLON.Scene(V3.bjs.engine);
  scene.useRightHandedSystem=true;
  scene.clearColor=new BABYLON.Color4(.09,.11,.13,1);
  const camera=SCALE3.camera=new BABYLON.ArcRotateCamera("scale-camera",0,1,4000,BABYLON.Vector3.Zero(),scene);
  camera.upVector=new BABYLON.Vector3(0,0,1);
  camera.minZ=1;camera.maxZ=40000;camera.lowerRadiusLimit=500;camera.upperRadiusLimit=14000;
  const light=new BABYLON.HemisphericLight("scale-light",new BABYLON.Vector3(.2,-.5,1),scene);
  light.intensity=.95;light.groundColor=new BABYLON.Color3(.35,.35,.35);
  const floor=BABYLON.MeshBuilder.CreateBox("floor",{width:10000,depth:10,height:10000},scene);
  floor.position.z=-5;
  floor.material=scaleMaterial3(scene,"floor-material","#667079");
  const grid=[];
  for(let n=-5000;n<=5000;n+=500){
    grid.push([new BABYLON.Vector3(n,-5000,.1),new BABYLON.Vector3(n,5000,.1)]);
    grid.push([new BABYLON.Vector3(-5000,n,.1),new BABYLON.Vector3(5000,n,.1)]);
  }
  const lines=BABYLON.MeshBuilder.CreateLineSystem("floor-grid",{lines:grid},scene);
  lines.color=new BABYLON.Color3(.48,.52,.56);
  SCALE3.caseMaterial=scaleMaterial3(scene,"case-material",caseColor());
  SCALE3.humanTask=(async()=>{
    const response=await fetch("assets/human/human.json");
    if(!response.ok)throw Error("Не удалось загрузить модель человека");
    const data=await response.json(), positions=[];
    let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<data.positions.length;i+=3){
      const p=data.positions;
      minX=Math.min(minX,p[i]);maxX=Math.max(maxX,p[i]);
      minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);
      minZ=Math.min(minZ,p[i+2]);maxZ=Math.max(maxZ,p[i+2]);
    }
    const unit=1/(maxY-minY);
    for(let i=0;i<data.positions.length;i+=3){
      const p=data.positions;
      positions.push((p[i]-(minX+maxX)/2)*unit,-(p[i+2]-(minZ+maxZ)/2)*unit,(p[i+1]-minY)*unit);
    }
    const mesh=SCALE3.human=new BABYLON.Mesh("human",scene), vd=new BABYLON.VertexData();
    vd.positions=positions;vd.indices=data.indices;vd.uvs=data.uvs;vd.normals=[];
    BABYLON.VertexData.ComputeNormals(positions,data.indices,vd.normals,{useRightHandedSystem:true});vd.applyToMesh(mesh);
    mesh.material=scaleMaterial3(scene,"human-material","#ffffff");
    mesh.material.diffuseTexture=new BABYLON.Texture("assets/human/texture.jpg",scene);
    mesh.scaling.setAll(SCALE3.height);mesh.rotation.z=Math.PI;
    SCALE3.humanWidth=(maxX-minX)*unit;
    updateScaleCase3();fitScaleCamera3();
  })();
  await SCALE3.humanTask;
}
function updateScaleCase3() {
  if(!SCALE3.scene||!A)return;
  const d=typeof CASE_MESH!=="undefined"&&CASE_MESH[S.caseId], c=A.c;
  SCALE3.human?.scaling.setAll(SCALE3.height);
  const offset=(SCALE3.humanWidth||.3)*SCALE3.height/2+200;
  SCALE3.caseMaterial.diffuseColor=BABYLON.Color3.FromHexString(caseColor());
  for(const mesh of SCALE3.caseMeshes||[])mesh.dispose();
  SCALE3.caseMeshes=[];
  if(d){
    const hinge=d.hinge>0?d.zmax:d.zmin;
    for(const name of ["base","lid"]){
      const part=d[name], q=new Uint16Array(b64buf(part.v)), pos=[];
      for(let i=0;i<q.length;i+=3){
        const X=part.o[0]+q[i]*d.s,Y=part.o[1]+q[i+1]*d.s,Z=part.o[2]+q[i+2]*d.s;
        pos.push(X+d.L/2+offset,d.W/2-Math.abs(Z-hinge),Y-d.ymin_b);
      }
      const indices=part.w16?new Uint16Array(b64buf(part.i)):new Uint32Array(b64buf(part.i));
      const mesh=new BABYLON.Mesh("scale-case-"+name,SCALE3.scene),vd=new BABYLON.VertexData();
      vd.positions=pos;vd.indices=indices;vd.normals=[];
      BABYLON.VertexData.ComputeNormals(pos,indices,vd.normals,{useRightHandedSystem:true});vd.applyToMesh(mesh);
      mesh.material=SCALE3.caseMaterial;SCALE3.caseMeshes.push(mesh);
    }
  }else{
    const mesh=BABYLON.MeshBuilder.CreateBox("scale-case",{width:c.out.l,height:c.out.w,depth:c.out.h},SCALE3.scene);
    mesh.position.set(offset+c.out.l/2,0,c.out.h/2);mesh.material=SCALE3.caseMaterial;
    SCALE3.caseMeshes.push(mesh);
  }
  SCALE3.width=offset+(d?d.L:c.out.l)+(SCALE3.humanWidth||.3)*SCALE3.height/2;
  SCALE3.center=(offset+(d?d.L:c.out.l)-(SCALE3.humanWidth||.3)*SCALE3.height/2)/2;
  $("v3n").textContent="Рост человека: "+Math.round(SCALE3.height/10)+" см. Кейс: "+c.out.l+" × "+c.out.w+" × "+c.out.h+" мм. Сетка пола: 50 см."+(d?"":" Упрощённый корпус по наружным размерам.");
}
function fitScaleCamera3() {
  const camera=SCALE3.camera;if(!camera)return;
  const aspect=V3.bjs.engine.getAspectRatio(camera);
  const extent=Math.max(SCALE3.height,SCALE3.width/Math.max(.3,aspect));
  const distance=extent/2/Math.tan(camera.fov/2)*1.55;
  const target=new BABYLON.Vector3(SCALE3.center,0,SCALE3.height/2);
  const views={iso:[.65,-1,.45],front:[0,-1,0],side:[1,0,0],top:[0,-.001,1]};
  const direction=BABYLON.Vector3.FromArray(views[SCALE3.view]).normalize();
  camera.setTarget(target);camera.setPosition(target.add(direction.scale(distance)));
}
async function toggleScaleScene3() {
  if(!V3.bjs?.ready){$("v3n").textContent="Дождитесь запуска 3D-визуализатора.";return;}
  SCALE3.active=!SCALE3.active;
  const active=SCALE3.active;
  $("v3-human").setAttribute("aria-pressed",String(active));
  $("v3-human").textContent=active?"Вернуться к ложементу":"Сравнить с человеком";
  $("v3-human-controls").hidden=!active;
  for(const el of document.querySelector(".t3").children)
    if(el.id!=="v3-human"&&el.id!=="v3-human-controls")el.hidden=active;
  $("v3l").hidden=active;$("v3lab").hidden=active;
  if(active){
    V3.bjs.camera.detachControl();$("v3n").textContent="Загрузка модели человека…";
    try{
      await ensureScaleScene3();
      if(!SCALE3.active)return;
      updateScaleCase3();fitScaleCamera3();
      SCALE3.camera.attachControl($("gl3d"),true);
    }catch(e){
      if(SCALE3.active)await toggleScaleScene3();
      SCALE3.scene?.dispose();SCALE3.scene=null;SCALE3.human=null;
      $("v3n").textContent=e.message;
    }
  }else{
    SCALE3.camera?.detachControl();V3.bjs.camera.attachControl($("gl3d"),true);
    renderBabylon3D();
  }
}
document.getElementById("v3-human").addEventListener("click",toggleScaleScene3);
document.getElementById("v3-human-height").addEventListener("change",e=>{
  SCALE3.height=Math.max(100,Math.min(230,Number(e.target.value)||180))*10;
  e.target.value=SCALE3.height/10;updateScaleCase3();fitScaleCamera3();
});
document.querySelectorAll("[data-scale-view]").forEach(el=>el.addEventListener("click",()=>{
  SCALE3.view=el.dataset.scaleView;fitScaleCamera3();
}));
document.getElementById("v3-scale-in").onclick=()=>{if(SCALE3.camera)SCALE3.camera.radius=Math.max(500,SCALE3.camera.radius/1.2);};
document.getElementById("v3-scale-out").onclick=()=>{if(SCALE3.camera)SCALE3.camera.radius=Math.min(14000,SCALE3.camera.radius*1.2);};
document.getElementById("v3-scale-fit").onclick=fitScaleCamera3;
