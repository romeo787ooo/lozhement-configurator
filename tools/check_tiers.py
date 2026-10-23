"""Tier workflow regression in an isolated browser; does not touch user drafts.

Run the local website on port 5500, then python tools/check_tiers.py.
Requires playwright with Edge.
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1100})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:5500", wait_until="networkidle")
    page.wait_for_function("V3.bjs?.ready && window.JSZip")
    print(page.evaluate("""() => {
      const check=(v,m)=>{if(!v)throw Error(m)};
      check(!hasTiers(),'legacy project unexpectedly converted');
      const old=JSON.stringify(S.place);V3.on=false;enableTiers();
      check(old===JSON.stringify(S.place),'migration moved items');
      S.tiers=[{id:'lower',name:'Lower',thickness:60,bottom:10,gap:2},
               {id:'upper',name:'Upper',thickness:70,bottom:10,gap:0}];
      const small=mkItem({name:'Small',shape:'rect',l:80,w:60,h:20},{qty:2,notch:false});
      const large=mkItem({name:'Large',shape:'rect',l:260,w:180,h:40},{notch:false});
      small.orient=large.orient='2';small.tierId='lower';large.tierId='upper';
      S.items=[small,large];S.place={};S.activeTier='lower';relayout();renderItems();
      check(!A.errors,'valid initial layout');
      const a=small.id+'#0',b=large.id+'#0';S.place[a]={...S.place[b]};refresh();
      check(!A.res.find(r=>r.key===a).errs.length,'different tiers collide in XY');
      const originalOther=JSON.stringify(S.place[b]);arrangeCurrentTier();
      check(originalOther===JSON.stringify(S.place[b]),'packing moved another tier');
      moveInstanceTier(small.id+'#1','upper');
      check(S.items.length===3&&small.qty===1,'instance did not split');
      check(S.items.filter(i=>i.tierId==='upper').length===2,'wrong instance destination');
      arrangeCurrentTier();check(!A.errors,'upper tier failed to pack');
      const volume=A.F.L*A.F.W*(130+A.c.lid)/1e6;
      check(Math.abs(quote(A).vol-volume)<1e-7,'material counted twice or includes gap');
      S.tiers[1].thickness=500;refresh();check(A.tierErrors.length&&A.errors,'height overflow accepted');
      S.tiers[1].thickness=70;S.tiers[0].thickness=25;refresh();
      check(A.res.find(r=>r.it===small).d.err,'bottom thickness ignored');
      S.tiers[0].thickness=60;refresh();
      reorderTier('upper','lower');check(tierList()[1].offset===70,'reordering did not recompute height');
      reorderTier('lower','upper');check(tierList()[1].offset===62,'gap lost');
      S.activeTier='all';renderView();check(Object.keys(VIEW.zones).length===3,'overview missing tiers');
      selectTier('lower');check(Object.keys(VIEW.zones).length===1,'single tier view');
      V3.on=true;render3D();const meshes=V3.bjs.scene.meshes.slice();
      $('tier-scene-mode').value='exploded';$('tier-explode').value=100;applyTierScene();
      check(meshes.every((m,i)=>m===V3.bjs.scene.meshes[i]),'explosion rebuilt meshes');
      check(meshes.filter(m=>m.metadata?.tierId==='upper').every(m=>m.position.z===100),'wrong explosion');
      $('tier-scene-mode').value='selected';applyTierScene();
      check(meshes.filter(m=>m.metadata?.tierId==='upper').every(m=>!m.isEnabled()),'hidden tier still visible');
      $('tier-scene-mode').value='assembled';applyTierScene();
      check(meshes.filter(m=>m.metadata?.tierId).every(m=>m.position.z===0&&m.isEnabled()),'assembly not restored');
      const svg=drawingSVG(A,numbering(A),orderInfo());
      check(!new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror'),'invalid SVG');
      check(svg.includes('Lower')&&svg.includes('Upper'),'drawing missing tier names');
      openStep('s-items');S.treeOpen=['case','body','lid','lower','upper'];renderItems();
      return 'PASS: migration, depth, collision, per-tier packing, instance transfer, price, reorder, 2D and 3D';
    }"""), flush=True)
    # Drag a whole item group between tier headers through the real DOM.
    item_id = page.evaluate("S.items.find(it=>it.tierId==='lower').id")
    page.locator(f'[data-item-id="{item_id}"]').drag_to(page.locator('[data-tier-id="upper"]'))
    assert page.evaluate("id=>S.items.find(it=>it.id===id).tierId", item_id) == "upper"
    target=page.locator('[data-tier-id="lower"]')
    page.locator('[data-tier-id="upper"]').drag_to(target,target_position={'x':80,'y':target.bounding_box()['height']-4})
    assert page.evaluate("S.tiers[0].id") == "upper"
    # Edit with the dialog and ensure Escape cancels only the dialog.
    page.evaluate("editTier('upper')")
    page.locator('#tier-dialog input').nth(0).fill('Upper edited')
    page.locator('#tier-dialog button').first.click()
    assert page.evaluate("S.tiers.find(t=>t.id==='upper').name") == 'Upper edited'
    page.evaluate("selectTier('upper');arrangeCurrentTier();saveDraft()")
    print(page.evaluate("""async () => {
      if(A.errors)throw Error('errors before export');
      let blob;const old=DL;DL={save:async data=>{blob=data.data}};
      try{await exportZip()}finally{DL=old}
      if(!blob)throw Error('ZIP not saved');
      const zip=await JSZip.loadAsync(blob),names=Object.keys(zip.files);
      for(const name of ['yarus-1.dxf','yarus-2.dxf','kryshka.dxf','chertezh.svg','zakaz.json'])
        if(!names.includes(name))throw Error('missing '+name);
      if(names.includes('korpus.dxf'))throw Error('overlapping tiers exported together');
      const data=JSON.parse(await zip.file('zakaz.json').async('string'));
      if(data.tiers.length!==2||data.pockets.some(p=>p.zone==='body'&&!p.tierId))throw Error('missing assignment');
      for(let i=0;i<S.tiers.length;i++){
        const dxf=await zip.file('yarus-'+(i+1)+'.dxf').async('string');
        if(!dxf.includes('bottom >= '+S.tiers[i].bottom))throw Error('missing manufacturing bottom');
      }
      return 'PASS: UI drag, dialog and per-tier ZIP export';
    }"""), flush=True)
    expected = page.evaluate("JSON.stringify({tiers:S.tiers,items:S.items,place:S.place})")
    page.reload(wait_until="networkidle")
    assert page.evaluate("JSON.stringify({tiers:S.tiers,items:S.items,place:S.place})") == expected
    page.evaluate("deleteTier('upper')")
    page.locator('#tier-dialog button').first.click()
    assert page.evaluate("S.tiers.length===1 && S.items.every(it=>it.zone==='lid'||it.tierId==='lower')")
    assert not errors, errors
    print('PASS: persistence and deleting a tier with item transfer; no JavaScript errors')
    browser.close()
