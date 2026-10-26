"""Isolated browser checks for the 5040 interaction scene."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5500/')
    page.wait_for_function('typeof V3!=="undefined" && V3.bjs?.ready',timeout=90000)
    before=page.evaluate('JSON.stringify(S)')
    page.locator('#v3-interaction').click()
    page.wait_for_function('SCALE3.active && SCALE3.human',timeout=60000)
    page.select_option('#interaction-mode','one')
    page.wait_for_function('INTERACT3.active',timeout=60000)
    assert page.evaluate('INTERACT3.character.skeletons.length')>0
    assert page.evaluate('Object.keys(INTERACT3.humanClips).sort()')==['compare','one','roll','side','two']
    page.evaluate("document.querySelector('#p3d').classList.add('fs');V3.bjs.engine.resize();fitInteraction3()")
    for mode in ['one','two','roll','side']:
        page.select_option('#interaction-mode',mode)
        page.wait_for_timeout(500)
        result=page.evaluate('''()=>{
          const I=INTERACT3,B=BABYLON;
          let bottom=Infinity;
          for(const mesh of I.root.getChildMeshes()){
            mesh.computeWorldMatrix(true);const pos=mesh.getVerticesData(B.VertexBuffer.PositionKind),m=mesh.getWorldMatrix();
            for(let i=0;i<pos.length;i+=3)bottom=Math.min(bottom,B.Vector3.TransformCoordinates(B.Vector3.FromArray(pos,i),m).z);
          }
          return {reach:I.reachErrors,bottom,meshes:I.scene.meshes.length,grips:I.grips.map(p=>p.asArray())};
        }''')
        print(mode,result,flush=True)
        page.locator('#p3d').screenshot(path=str(Path(tempfile.gettempdir())/f'interaction-{mode}.png'))
        if mode=='two':
            clearance=page.evaluate('''()=>{
              const I=INTERACT3,B=BABYLON;I.scene.render();
              const gaps=[];
              for(const [character,root] of [[I.character,I.humanRoot],[I.partner,I.partnerRoot]]){
                let nearest=Infinity,count=0;
                for(const mesh of character.meshes){
                  if(!mesh.getTotalVertices())continue;
                  const p=mesh.getPositionData(true,true),m=mesh.computeWorldMatrix(true);
                  for(let i=0;i<p.length;i+=3){const v=B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),m);
                    if(Math.abs(v.x-root.position.x)<180 && v.z>700 && v.z<1100){nearest=Math.min(nearest,Math.abs(v.x));count++;}}
                }
                gaps.push({gap:nearest-377,count});
              }
              return {gaps,partner:I.partnerRoot.isEnabled()};
            }''')
            print('Both torso clearances (mm)',clearance,flush=True)
            assert clearance['partner']
            assert all(v['count']>100 and v['gap']>100 for v in clearance['gaps']),clearance
            page.evaluate("INTERACT3.view='side';fitInteraction3()")
            page.locator('#p3d').screenshot(path=str(Path(tempfile.gettempdir())/'interaction-two-side.png'))
            page.evaluate("INTERACT3.view='iso';fitInteraction3()")
        assert max(result['reach'])<1,result
        assert page.evaluate('INTERACT3.partnerRoot.isEnabled()')==(mode=='two')
        assert result['bottom']>-.1,result
        checks=page.evaluate('''()=>{
          const I=INTERACT3,B=BABYLON;I.scene.render();
          const shoes=I.character.meshes.find(m=>m.name==='Human.shoes02');
          const positions=shoes.getPositionData(true,true),matrix=shoes.getWorldMatrix();
          let bottom=Infinity;
          for(let n=0;n<positions.length;n+=3)bottom=Math.min(bottom,B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,n),matrix).z);
          return {reach:Math.max(...I.reachErrors),bottom};
        }''')
        assert checks['bottom']>-1,('Shoes penetrate floor',mode,checks)
        page.evaluate('''()=>{const I=INTERACT3,B=BABYLON;const target=I.grips[0];I.camera.setTarget(target);I.camera.setPosition(target.add(new B.Vector3(300,-400,200)));}''')
        page.locator('#p3d').screenshot(path=str(Path(tempfile.gettempdir())/f'grip-{mode}.png'))
        page.evaluate('fitInteraction3()')
    assert page.locator('#interaction-play').count()==0
    first=page.evaluate('INTERACT3.humanHands[0].getAbsolutePosition().asArray()')
    page.wait_for_timeout(300)
    assert page.evaluate('INTERACT3.humanHands[0].getAbsolutePosition().asArray()')==first
    mesh_count=page.evaluate('INTERACT3.scene.meshes.length')
    page.locator('#v3-interaction').click()
    assert not page.evaluate('INTERACT3.active')
    assert page.evaluate('JSON.stringify(S)')==before,'Preview changed project'
    page.locator('#v3-interaction').click()
    assert page.evaluate('INTERACT3.scene.meshes.length')==mesh_count
    page.locator('#v3-interaction').click()
    page.locator('#v3-interaction').click()
    page.select_option('#interaction-mode','compare')
    page.wait_for_function('SCALE3.active && SCALE3.human',timeout=60000)
    page.locator('#v3-human-height').fill('170')
    page.locator('#v3-human-height').dispatch_event('change')
    assert page.evaluate('SCALE3.human.scaling.x')==1700/1.8
    page.locator('#v3-scale-open').click()
    assert page.evaluate('SCALE3.lid')==100
    page.locator('#v3-scale-close').click()
    assert page.evaluate('SCALE3.lid')==0
    assert page.locator('#v3-human').count()==0
    page.locator('#p3d').screenshot(path=str(Path(tempfile.gettempdir())/'interaction-compare.png'))
    page.locator('#v3-interaction').click()
    assert not page.locator('#v3-interaction-controls').is_visible()
    assert page.locator('#v3-interaction').is_visible()
    assert not errors,errors
    print('PASS: poses, reach, floor clearance, static controls, return and unchanged project')
    browser.close()
