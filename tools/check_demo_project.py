"""Verify the shipped multi-tier example in an isolated browser."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5500/projects.html')
    assert page.locator('.card').count()==1
    page.reload()
    assert page.locator('.card').count()==1, 'demo duplicated on reload'
    page.locator('.card .open').click()
    page.wait_for_function('typeof A!=="undefined" && A && V3.bjs?.ready')
    print(page.evaluate("""() => ({errors:A.errors,details:A.res.filter(r=>r.errs.length).map(r=>({name:r.it?.name,errs:r.errs})),height:tierHeight(),items:S.items.length})"""))
    assert page.evaluate('A.errors')==0
    assert page.evaluate('tierHeight()')==254
    assert page.evaluate('S.items.length')==21
    assert page.locator('#tier-scene-mode').input_value()=='exploded'
    assert page.evaluate("S.place['i1#0'].x===S.place['i17#0'].x && S.place['i1#0'].y===S.place['i17#0'].y")
    page.locator('#tier-scene-mode').select_option('assembled')
    page.click('#project-save')
    page.reload()
    page.wait_for_function('typeof A!=="undefined" && A && V3.bjs?.ready')
    assert page.locator('#tier-scene-mode').input_value()=='assembled'
    page.locator('#tier-scene-mode').select_option('exploded')
    page.screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/demo-tiers.png')
    assert not errors, errors
    print('PASS: demo seeded once, 21 items / 3 tiers, overlapping XY on separate tiers, no layout errors, 3D modes persist')
    browser.close()
