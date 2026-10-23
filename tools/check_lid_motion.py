"""Check that lid motion reuses meshes and matches a full geometry rebuild."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:5500", wait_until="networkidle")
    page.wait_for_function("V3.bjs?.ready")
    result = page.evaluate("""() => {
      const results=[];
      for(const id of ['4035','7030','5040','7010']) {
        S.caseId=id; V3.lid=100; relayout();
        const b=V3.bjs, meshes=b.scene.meshes.slice(), originalBuild=build3;
        let builds=0;
        build3=(...args)=>{builds++;return originalBuild(...args);};
        const start=performance.now();
        for(let angle=0;angle<=180;angle++) {
          const slider=document.getElementById('v3a');
          slider.value=angle; slider.dispatchEvent(new Event('input'));
        }
        const ms=performance.now()-start;
        build3=originalBuild;
        if(builds || meshes.some((mesh,i)=>mesh!==b.scene.meshes[i]))
          throw new Error('Lid motion rebuilt meshes');
        let maxError=0;
        for(const angle of [0,45,100,180]) {
          V3.lid=angle;moveLid3();
          const expected=build3({d:CASE_MESH[id]});
          let offset=0;
          for(const mesh of meshes) {
            if(mesh.name==='base' || mesh.name==='lid')continue;
            const vertices=mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const matrix=mesh.computeWorldMatrix(true);
            for(let i=0;i<vertices.length;i+=Math.max(3,Math.floor(vertices.length/30/3)*3)){
              const actual=BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.FromArray(vertices,i),matrix);
              const target=BABYLON.Vector3.FromArray(expected.p,offset+i);
              maxError=Math.max(maxError,BABYLON.Vector3.Distance(actual,target));
            }
            offset+=vertices.length;
          }
          for(let i=0;i<expected.lab.length;i++) {
            maxError=Math.max(maxError,Math.hypot(...expected.lab[i].p.map((v,k)=>v-V3.lab[i].p[k])));
          }
        }
        if(maxError>0.001)throw new Error('Hinge transform mismatch: '+maxError);
        // A subsequent layout rebuild must dispose the old pivot and remain movable.
        const pivot=b.lidPivot;
        relayout(); V3.lid=35;moveLid3();
        if(pivot===b.lidPivot || b.scene.transformNodes.filter(n=>n.name==='lid-hinge').length!==1)
          throw new Error('Stale hinge after relayout');
        results.push({id,updates:181,ms,builds,maxError});
      }
      return results;
    }""")
    assert not errors, errors
    print(result)
    browser.close()
