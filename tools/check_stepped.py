"""Stepped pocket regression; isolated browser, local website on port 5500."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5500/projects.html')
    page.locator('.card').filter(has_text='Демо · Ступенчатые карманы').locator('.open').click()
    page.wait_for_function('typeof A!=="undefined" && A && V3.bjs?.ready')
    assert page.evaluate('S.stepReveal') is False
    assert page.evaluate("build3(null).ranges.some(r=>r.key==='i1#0')")
    page.locator('#stepped-reveal').check()
    upper=page.locator('#v3l .v3r').filter(has_text='Полевая станция')
    assert upper.locator('.eye').get_attribute('aria-pressed')=='false'
    upper.locator('.eye').click()
    assert page.evaluate('S.stepReveal') is False
    assert not page.locator('#stepped-reveal').is_checked()
    assert page.evaluate("build3(null).ranges.some(r=>r.key==='i1#0')")
    page.locator('#stepped-reveal').check()
    print(page.evaluate("""() => {
      const check=(v,m)=>{if(!v)throw Error(m)};
      check(!hasTiers(),'demo must be a single foam block');check(!A.errors,JSON.stringify(A.res.filter(r=>r.errs.length).map(r=>r.errs)));
      const child=S.items[1],parent=S.items[0],r=A.res.find(r=>r.it===child);
      check(r.d.startDepth===65&&r.d.depth===110,'incorrect cumulative depth');
      check(A.res.filter(r=>r.it.stepParentId).length===4,'missing pairs');
      const old=S.place[child.id+'#0'].x;S.place[parent.id+'#0'].x+=5;refresh();
      check(S.place[child.id+'#0'].x===old+5,'lower pocket did not follow');
      const height=child.h;child.h=250;refresh();check(A.errors>0,'depth violation accepted');child.h=height;
      const dims=[child.l,child.w];child.l=parent.l;child.w=parent.w;refresh();check(A.errors>0,'support ledge violation accepted');[child.l,child.w]=dims;refresh();
      const ref=child.stepParentId;child.stepParentId=child.id;refresh();check(A.errors>0,'cycle accepted');child.stepParentId=ref;refresh();
      const qty=parent.qty;parent.qty=2;refresh();check(A.errors>0,'ambiguous parent accepted');parent.qty=qty;refresh();
      check(!A.errors,'restored demo invalid');
      const mesh=build3(null);check(mesh.p.every(Number.isFinite),'nonfinite mesh');
      const g=A.res.find(x=>x.it===child).g.pocket,pg=A.res.find(x=>x.it===parent).g.pocket,c=curCase();
      const ox=(c.out.l-c.l)/2+S.params.fit,oy=(c.out.w-c.w)/2+S.params.fit,z=Math.max(4,(c.out.h-c.h)/2)+c.body-65;
      const covered=(x,y)=>{for(let i=0;i<mesh.p.length;i+=9){const a=mesh.p.slice(i,i+3),b=mesh.p.slice(i+3,i+6),c=mesh.p.slice(i+6,i+9);if([a,b,c].some(p=>Math.abs(p[2]-z)>1e-5))continue;const cross=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);const ds=[cross(a,b),cross(b,c),cross(c,a)];if(ds.every(d=>d>1e-6)||ds.every(d=>d< -1e-6))return true;}return false;};
      check(!covered(ox+g.x+g.w*.47,oy+g.y+g.h*.43),'upper floor closes lower pocket');
      check(covered(ox+pg.x+6.1,oy+pg.y+pg.h*.43),'support ledge is missing');
      check(!mesh.ranges.some(r=>r.key===parent.id+'#0'),'reveal still contains upper item');
      S.stepReveal=false;check(build3(null).ranges.some(r=>r.key===parent.id+'#0'),'assembled lacks upper item');S.stepReveal=true;
      const nums=numbering(A),order=orderInfo(),data=JSON.parse(orderJSON(A,nums,order,quote(A)));
      check(data.steppedPockets.length===4&&data.steppedPockets[0].startDepth>0,'export loses relationships');
      check(dxfFor('body',A,nums).includes('STEPPED POCKET'),'DXF loses start depth');
      relayout();check(!A.errors,'autopacking broke pairs');check(S.items.filter(i=>i.stepParentId).every(i=>S.place[i.id+'#0']),'autopacking lost children');
      selectItem(child.id+'#0');editSteppedPocket();
      return 'PASS: depth, support, cycles, quantity, movement, geometry, visibility, export and packing';
    }"""))
    page.locator('#stepped-dialog select').select_option('')
    page.locator('#stepped-dialog').get_by_role('button',name='Применить',exact=True).click()
    assert page.evaluate('!S.items[1].stepParentId')
    page.evaluate("selectItem(S.items[1].id+'#0');editSteppedPocket()")
    page.locator('#stepped-dialog select').select_option('i1')
    page.locator('#stepped-dialog').get_by_role('button',name='Применить',exact=True).click()
    assert page.evaluate('S.items[1].stepParentId')=='i1'
    page.click('#project-save')
    page.reload()
    page.wait_for_function('typeof A!=="undefined" && A && V3.bjs?.ready')
    assert page.evaluate('A.errors')==0
    assert page.evaluate('S.items[1].stepParentId')=='i1'
    page.screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/stepped-demo.png')
    page.click('#fs3')
    page.locator('#v3objects summary').click()
    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/stepped-3d.png')
    page.click('#fs3')
    page.evaluate("S.caseId='7030';S.tiers=[{id:'test-tier',name:'Test',thickness:140,bottom:10,gap:0}];S.activeTier='test-tier';tierChanged();tierMenu('test-tier',20,20)")
    page.locator('#ctx').get_by_role('button',name='Дублировать ярус',exact=True).click()
    assert page.evaluate('S.tiers.length')==2
    assert page.evaluate('S.items.filter(i=>i.stepParentId).every(i=>i.tierId===stepParent(i).tierId)')
    assert page.evaluate('A.errors')==0
    assert not errors,errors
    print('PASS: attach / detach UI, save and reload, tier duplication preserves relationships, no JS errors')
    browser.close()
