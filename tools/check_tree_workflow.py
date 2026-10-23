"""Browser regression checks for tree moves, instance transfer and contour editing."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel="msedge",headless=True)
    page=browser.new_page(viewport={"width":1600,"height":1100})
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto("http://127.0.0.1:5500",wait_until="networkidle")
    page.wait_for_function("typeof A!=='undefined' && A")
    print(page.evaluate("""() => {
      V3.on=false; S.caseId='7030'; S.selected=null;
      const rect=mkItem({name:'Rectangle',shape:'rect',l:100,w:60,h:20},{qty:2,notch:true,orient:'2'});
      const circle=mkItem({name:'Circle',shape:'cyl',l:60,w:60,h:20},{orient:'2'});
      S.items=[rect,circle];S.treeOpen=['case','lid','body'];relayout();renderItems();openStep('s-items');
      const assert=(v,m)=>{if(!v)throw Error(m);};
      // Opening and applying an unchanged contour preserves analytic curves.
      for(const item of S.items){
        S.selected=item.id+'#0';const before=JSON.stringify(item);openSketchEditor();
        assert(SKETCH.points.length>=3 && !skValidate(),'initial contour invalid');
        applySketch();assert(JSON.stringify(item)===before,'no-op changed geometry');
      }
      S.selected=circle.id+'#0';openSketchEditor();SKETCH.points[0].x-=.02;applySketch();
      assert(circle.customShape?.length && pocketSegs(circle,geom(circle,S.place[circle.id+'#0'],S.params),S.params)[0].t==='L','circle edit ignored');
      openSketchEditor();assert(JSON.stringify(SKETCH.points)===JSON.stringify(circle.customShape),'reopen mismatch');closeSketchEditor();
      const keys=JSON.stringify(S.place);moveTreeItem(circle.id,'body',rect.id,false);
      assert(S.items[0]===circle && JSON.stringify(S.place)===keys,'reorder moved layout');
      moveTreeItem(circle.id,'lid');assert(circle.zone==='lid','tree transfer failed');
      moveTreeItem(circle.id,'body');assert(circle.zone==='body','reverse transfer failed');
      const old=structuredClone(S.place[rect.id+'#1']);transferPlanInstance(rect.id+'#0','lid',{x:100,y:100,rot:0});refresh();renderItems();
      assert(rect.qty===1 && JSON.stringify(S.place[rect.id+'#0'])===JSON.stringify(old),'instance split corrupted sibling');
      const moved=S.items.find(i=>i!==rect&&i.name==='Rectangle');assert(moved.zone==='lid'&&moved.qty===1,'instance split failed');
      transferPlanInstance(moved.id+'#0','body',{x:200,y:200,rot:0});refresh();renderItems();assert(moved.zone==='body','reverse plan transfer failed');
      return 'Geometry, reorder and quantity checks passed';
    }"""))
    row=page.locator('#tree [data-item-id]').first
    row.click(button='right')
    assert page.locator('#ctx').is_visible()
    menu=page.locator('#ctx').inner_text()
    page.keyboard.press('Escape')
    source=page.locator('#tree [data-item-id]').first
    item_id=source.get_attribute('data-item-id')
    source.drag_to(page.locator('#tree [data-zone="lid"]'))
    assert page.evaluate('(id)=>S.items.find(i=>i.id===id).zone',item_id)=='lid'
    # Real pointer drag from one plan half to the other.
    page.evaluate('renderView()')
    page.locator('#view').scroll_into_view_if_needed()
    coords=page.evaluate("""(id)=>{const r=A.res.find(r=>r.it.id===id),v=VIEW.zones[r.zone],p=r.g.pocket,m=$('view').getScreenCTM();
      const screen=(x,y)=>{const q=$('view').createSVGPoint();q.x=x;q.y=y;const t=q.matrixTransform(m);return {x:t.x,y:t.y};};
      return {from:screen(v.tx(p.x+p.w/2),v.ty(p.y+p.h/2)),to:screen(VIEW.zones.body.tx(200),VIEW.zones.body.ty(200))};}""",item_id)
    page.mouse.move(**coords['from']);page.mouse.down();page.mouse.move(**coords['to'],steps=12);page.mouse.up()
    assert page.evaluate('(id)=>S.items.find(i=>i.id===id).zone',item_id)=='body'
    assert not errors,errors
    print('Tree context menu, native tree drag and plan pointer drag passed')
    browser.close()
