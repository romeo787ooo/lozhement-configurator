"""OBJ/STL parsing, real samples, projection, persistence and rendering regression."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5500/')
    page.wait_for_function('typeof V3!=="undefined" && V3.bjs?.ready',timeout=90000)
    checks=page.evaluate(r'''async()=>{
      const assert=(v,m)=>{if(!v)throw Error(m);};
      const obj='v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf -4 -2 -3\nf 1 2 4\nf 2 3 4\nf 3 1 4';
      const raw=new TextEncoder().encode(obj).buffer;
      const small=ItemModels.parse(raw,'tetra.obj',1),large=ItemModels.parse(raw,'tetra.obj',1000);
      assert(small.triangles===4&&!small.open,'OBJ negative indices / closed tetrahedron');
      assert(large.dim.every(d=>d===1000),'Units');
      for(const bad of ['v NaN 0 0\nf 1 2 3','v 0 0 0\nf 0 1 2','not a mesh']){
        let threw=false;try{ItemModels.parse(new TextEncoder().encode(bad).buffer,'bad.obj',1);}catch(e){threw=true;}assert(threw,'Reject invalid OBJ');
      }
      const ascii='solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 1\nendloop\nendfacet\nendsolid sample';
      assert(ItemModels.parse(new TextEncoder().encode(ascii).buffer,'ascii.stl',1).open,'ASCII STL / open mesh warning');
      const results=[];
      for(const file of ['battery.obj','cylinder.stl']){
        const model=ItemModels.parse(await (await fetch('assets/items/'+file)).arrayBuffer(),file,1);
        const it=modelItem(model,file);
        for(const up of [0,1,2])for(const rot of [false,true]){
          applyOrient(it,up);const m=mesh3();ItemModels.draw(m,it,0,0,0,rot);
          assert(m.p.length===model.triangles*9,'Actual mesh, not prism');
          const dims=rot?[it.w,it.l,it.h]:[it.l,it.w,it.h];
          m.p.forEach((v,i)=>assert(v>=-1e-6&&v<=dims[i%3]+1e-6,'Orientation bounds'));
          const contour=ItemModels.contour(it,2),path=contour.map(v=>({X:Math.round(v.x*1000),Y:Math.round(v.y*1000)}));
          // Every projected model vertex must lie inside the clearance pocket.
          for(let i=0;i<m.p.length;i+=3){const x=rot?it.l-m.p[i+1]:m.p[i],y=rot?m.p[i]:m.p[i+1];assert(ClipperLib.Clipper.PointInPolygon({X:Math.round((x+2)*1000),Y:Math.round((y+2)*1000)},path)!==0,'Pocket contains model');}
        }
        results.push({file,triangles:model.triangles,dim:model.dim});
      }
      return results;
    }''')
    print(checks,flush=True)
    if not page.locator('#import-item-model').is_visible():page.locator('#s-items .step-h').click()
    page.locator('#import-item-model').click()
    page.locator('#model-demo').click()
    page.wait_for_url('**/index.html?project=*',timeout=90000)
    page.wait_for_function('!!activeProject && S.items.length===2 && S.items.every(i=>i.model)',timeout=90000)
    page.wait_for_function('V3.bjs?.ready',timeout=90000)
    summary=page.evaluate('({items:S.items.map(i=>({name:i.name,up:i.up,dim:i.dim})),errors:A.res.flatMap(r=>r.errs)})')
    print(summary,flush=True)
    assert not summary['errors'],summary
    assert page.evaluate('''()=>{const n=numbering(A),d=dxfFor('body',A,n),svg=drawingSVG(A,n,orderInfo());return !d.includes('NaN')&&!svg.includes('NaN')&&A.res.every(r=>pocketSegs(r.it,r.g,A.P).every(s=>d.includes(s.x1.toFixed(3))&&d.includes(s.y1.toFixed(3))));}''')
    before=page.evaluate('JSON.stringify(S.items)')
    page.reload();page.wait_for_function('V3.bjs?.ready',timeout=90000)
    assert page.evaluate('JSON.stringify(S.items)')==before
    page.evaluate("V3.hide.shell=true;render3D()")
    page.locator('#p3d').screenshot(path=str(Path(tempfile.gettempdir())/'imported-models.png'))
    # Project JSON round trip retains embedded meshes and their contours.
    assert page.evaluate('''()=>{const saved=Projects.read(projectId),copy=Projects.create('Import roundtrip',JSON.parse(JSON.stringify(saved.saved)));return JSON.stringify(copy.saved.items)===JSON.stringify(S.items);}''')
    # Manual local file flow, cancellation and error handling must not mutate the project.
    if not page.locator('#import-item-model').is_visible():page.locator('#s-items .step-h').click()
    page.locator('#import-item-model').click()
    page.locator('#model-file').set_input_files(str(Path('assets/items/battery.obj').resolve()))
    page.wait_for_function('!document.getElementById("model-apply").disabled')
    page.locator('#model-cancel').click()
    assert page.evaluate('JSON.stringify(S.items)')==before
    page.evaluate('S.items=[];S.place={};refresh();renderItems()')
    page.locator('#import-item-model').click()
    page.locator('#model-file').set_input_files(str(Path('assets/items/cylinder.stl').resolve()))
    page.wait_for_function('!document.getElementById("model-apply").disabled')
    page.locator('#model-orient').select_option('2')
    page.locator('#model-apply').click()
    assert page.evaluate('S.items.length===1 && S.items[0].up===2 && !!S.items[0].model')
    page.reload();page.wait_for_function('V3.bjs?.ready',timeout=90000)
    assert page.evaluate('S.items.length===1 && S.items[0].up===2 && !!S.items[0].model')
    assert not errors,errors
    print('PASS: formats, units, malformed inputs, orientations, contours, DXF/SVG, demo, local upload, persistence and cancellation')
    browser.close()
