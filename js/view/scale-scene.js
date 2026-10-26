"use strict";
// Independent millimetre-based scene; opening it does not change the layout.
const SCALE3 = { active: false, height: 1800, view: "iso", lid: 0 };
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
  camera.wheelDeltaPercentage=0.01;
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
    const model=await BABYLON.SceneLoader.ImportMeshAsync(null,"assets/human/interaction/","human.glb",scene);
    SCALE3.human=model.meshes[0];
    SCALE3.human.rotationQuaternion=BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X,Math.PI/2);
    for(const clip of model.animationGroups)clip.stop();
    const pose=model.animationGroups.find(clip=>clip.name==="carry_compare");
    if(!pose)throw Error("Missing comparison pose");
    pose.start(false);pose.pause();pose.goToFrame(pose.from);
    for(const mesh of model.meshes){mesh.isPickable=false;if(mesh.material){mesh.material.backFaceCulling=false;mesh.material.environmentIntensity=.6;}}
    SCALE3.humanWidth=.32;
    updateScaleCase3();fitScaleCamera3();
  })();
  await SCALE3.humanTask;
}
function updateScaleCase3() {
  if(!SCALE3.scene||!A)return;
  const d=typeof CASE_MESH!=="undefined"&&CASE_MESH[S.caseId], c=A.c;
  SCALE3.human?.scaling.setAll(SCALE3.height/1.8);
  const offset=(SCALE3.humanWidth||.3)*SCALE3.height/2+200;
  SCALE3.caseMaterial.diffuseColor=BABYLON.Color3.FromHexString(caseColor());
  for(const mesh of SCALE3.caseMeshes||[])mesh.dispose();
  SCALE3.lidPivot?.dispose();
  const pivot=SCALE3.lidPivot=new BABYLON.TransformNode("scale-lid-hinge",SCALE3.scene);
  const split=d ? -d.ymin_b : c.out.h*c.body/(c.body+c.lid);
  pivot.position.set(offset, d ? d.W/2-d.ax.off : c.out.w/2, split+(d?d.ax.y:0));
  const attachLid=mesh=>{
    mesh.parent=pivot;
    mesh.position.subtractInPlace(pivot.position);
  };
  SCALE3.caseMeshes=[];
  if(d){
    SCALE3.caseMaterial.diffuseColor=BABYLON.Color3.White();
    const hinge=d.hinge>0?d.zmax:d.zmin;
    for(const name of ["base","lid"]){
      const part=d[name], q=new Uint16Array(b64buf(part.v)), pos=[],colors=[],black=new Set(part.blackVertices||[]),color=rgb3(caseColor());
      for(let i=0;i<q.length;i+=3){
        const X=part.o[0]+q[i]*d.s,Y=part.o[1]+q[i+1]*d.s,Z=part.o[2]+q[i+2]*d.s;
        pos.push(X+d.L/2+offset,d.W/2-Math.abs(Z-hinge),Y-d.ymin_b);
        colors.push(...(black.has(i/3)?[.025,.025,.025]:color),1);
      }
      const indices=part.w16?new Uint16Array(b64buf(part.i)):new Uint32Array(b64buf(part.i));
      const mesh=new BABYLON.Mesh("scale-case-"+name,SCALE3.scene),vd=new BABYLON.VertexData();
      vd.positions=pos;vd.indices=indices;vd.normals=[];vd.colors=colors;
      BABYLON.VertexData.ComputeNormals(pos,indices,vd.normals,{useRightHandedSystem:true});vd.applyToMesh(mesh);
      mesh.material=SCALE3.caseMaterial;SCALE3.caseMeshes.push(mesh);
      if(name==="lid")attachLid(mesh);
    }
  }else{
    for(const name of ["base","lid"]){
      const height=name==="base"?split:c.out.h-split;
      const mesh=BABYLON.MeshBuilder.CreateBox("scale-case-"+name,{width:c.out.l,height:c.out.w,depth:height},SCALE3.scene);
      mesh.position.set(offset+c.out.l/2,0,(name==="base"?0:split)+height/2);
      mesh.material=SCALE3.caseMaterial;SCALE3.caseMeshes.push(mesh);
      if(name==="lid")attachLid(mesh);
    }
  }
  moveScaleLid3(SCALE3.lid);
  SCALE3.width=offset+(d?d.L:c.out.l)+(SCALE3.humanWidth||.3)*SCALE3.height/2;
  SCALE3.center=(offset+(d?d.L:c.out.l)-(SCALE3.humanWidth||.3)*SCALE3.height/2)/2;
  $("v3n").textContent="Рост человека: "+Math.round(SCALE3.height/10)+" см. Кейс: "+c.out.l+" × "+c.out.w+" × "+c.out.h+" мм. Сетка пола: 50 см."+(d?"":" Упрощённый корпус по наружным размерам.");
}
function moveScaleLid3(angle) {
  SCALE3.lid=Math.max(0,Math.min(135,Number(angle)||0));
  if(SCALE3.lidPivot)SCALE3.lidPivot.rotation.x=-SCALE3.lid*Math.PI/180;
  $("v3-scale-lid").value=SCALE3.lid;
  $("v3-scale-lid-value").textContent=SCALE3.lid+"°";
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
document.getElementById("v3-human-height").addEventListener("change",e=>{
  SCALE3.height=Math.max(100,Math.min(230,Number(e.target.value)||180))*10;
  e.target.value=SCALE3.height/10;updateScaleCase3();fitScaleCamera3();
});
document.getElementById("v3-scale-lid").oninput=e=>moveScaleLid3(e.target.value);
document.getElementById("v3-scale-open").onclick=()=>moveScaleLid3(100);
document.getElementById("v3-scale-close").onclick=()=>moveScaleLid3(0);
