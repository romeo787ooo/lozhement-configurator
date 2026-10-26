"""Compact composition tree / inspector checks in an isolated browser."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1600,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5500/projects.html')
    page.locator('.card').filter(has_text='Демо · Ступенчатые карманы').locator('.open').click()
    page.wait_for_function('typeof A!=="undefined" && A')
    page.evaluate("V3.on=false;openStep('s-items');renderItems()")
    assert page.locator('#tree [data-node="case"]').count()==0
    assert page.locator('#tree .tree-eye').count()==0
    assert page.locator('#tree .tree-list input').count()==0
    assert page.locator('#tree [data-item-id="i1"] .tw').count()==1
    page.locator('#tree [data-item-id="i1"] .tw').click()
    child=page.locator('#tree [data-item-id="i2"]')
    assert child.locator('.tw').count()==0
    assert child.get_attribute('draggable')=='false'
    assert child.locator('xpath=../../..').locator(':scope > .tn').get_attribute('data-item-id')=='i1'
    page.locator('#s-items').screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/compact-tree.png')
    page.evaluate("document.documentElement.dataset.theme='dark'")
    page.locator('#s-items').screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/compact-tree-dark.png')
    page.evaluate("document.documentElement.dataset.theme='light'")
    child.locator('.tl').click()
    assert page.locator('#item-inspector').is_visible()
    assert page.locator('#item-inspector .inspector-heading strong').inner_text()=='Питание станции'
    positions=page.evaluate('JSON.stringify(S.place)')
    page.locator('#tree [data-item-id="i2"] .tl').focus()
    page.keyboard.press('ArrowDown')
    assert page.evaluate('JSON.stringify(S.place)')==positions, 'tree navigation moved a pocket'
    page.locator('#item-inspector summary').click()
    page.locator('#item-inspector [aria-label="Название"]').fill('Аккумулятор станции')
    assert page.evaluate('S.items[1].name')=='Аккумулятор станции'
    assert page.locator('#item-inspector [aria-label="Название"]').evaluate('(e)=>e===document.activeElement')
    page.locator('#tree input[type=search]').fill('Аккумулятор')
    assert page.locator('#tree [data-item-id]').count()==2
    assert page.locator('#tree [data-item-id="i1"]').is_visible()
    page.locator('#tree input[type=search]').fill('Нет такого предмета')
    assert page.locator('#tree .tree-list').inner_text().find('Ничего не найдено')>=0
    page.locator('#tree input[type=search]').fill('')
    page.evaluate("S.items[1].qty=2;refresh();setOpen('body',false);renderTree()")
    assert page.locator('#tree [data-zone="body"] .tree-issue').count()==1
    page.evaluate("S.items[1].qty=1;refresh();setOpen('body',true);renderTree()")
    # Narrow column switches to an inspector with a clear way back.
    page.evaluate("document.querySelector('.layout').style.setProperty('--wl','320px');treeInspectorOpen=true;renderTree()")
    assert page.locator('#tree .inspector-back').is_visible()
    assert not page.locator('#tree .tree-list').is_visible()
    page.locator('#tree .inspector-back').click()
    assert page.locator('#tree .tree-list').is_visible()
    page.locator('#tree [data-item-id="i1"] .tl').click()
    page.locator('#s-items').screenshot(path='C:/Users/SBoguslavskiy/AppData/Local/Temp/compact-inspector-narrow.png')
    assert page.evaluate("document.getElementById('tree').scrollWidth<=document.getElementById('tree').clientWidth+1")
    # Add and select an item via the new compact toolbar.
    page.locator('#tree .inspector-back').click()
    page.locator('#tree .composition-toolbar button').click()
    page.locator('#tree-add-dialog').get_by_role('button',name='Добавить',exact=True).click()
    assert page.evaluate('S.items.length')==10
    assert page.evaluate('S.selected.startsWith(S.items.at(-1).id)')
    assert not errors,errors
    print('PASS: compact hierarchy, stepped nesting, search, issue counts, editing/focus, narrow inspector and adding items')
    browser.close()
