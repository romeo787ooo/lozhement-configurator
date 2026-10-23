"""Isolated browser checks for the local project cabinet; run with the site on :5500."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:5500/projects.html")
    page.evaluate("Projects.list().forEach(p=>Projects.remove(p.id));render()")
    page.click("#new-project")
    page.fill("#project-title", "Тестовая компоновка")
    page.locator("#project-form button[type=submit]").click()
    ready = 'typeof A!=="undefined" && A && document.getElementById("project-save")'
    page.wait_for_function(ready)
    page.evaluate("""() => {
      S.items=[mkItem({name:'Contour test',shape:'rect',l:100,w:80,h:20})];
      S.tiers=[{id:'tier1',name:'Tier',thickness:60,bottom:10,gap:0}];
      S.items[0].tierId='tier1';relayout();
    }""")
    page.click("#project-save")
    url = page.url
    page.reload()
    page.wait_for_function(ready)
    assert page.evaluate("S.items[0].name") == "Contour test"
    assert page.evaluate("S.tiers[0].id") == "tier1"
    page.click(".project-bar a")
    page.wait_for_selector(".card")
    page.get_by_role("button", name="Копировать", exact=True).click()
    assert page.locator(".card").count() == 2
    page.get_by_role("button", name="Переименовать", exact=True).first.click()
    page.fill("#project-title", "Вторая версия")
    page.locator("#project-form button[type=submit]").click()
    page.fill("#search", "Вторая версия")
    assert page.locator(".card").count() == 1
    with page.expect_download() as download:
        page.get_by_role("button", name="Скачать", exact=True).click()
    page.locator("#import-file").set_input_files(download.value.path())
    page.fill("#search", "")
    page.wait_for_function("document.querySelectorAll('.card').length===3")
    page.screenshot(path="C:/Users/SBoguslavskiy/AppData/Local/Temp/projects-page.png")
    page.goto(url)
    page.wait_for_function(ready)
    page.evaluate("Projects.write({...Projects.read(projectId),name:'Other tab'});S.qty=3")
    assert page.evaluate("persistProject(true)") is False
    assert page.evaluate("Projects.read(projectId).name") == "Other tab"
    assert not errors, errors
    print("PASS: create, save, reload, tiers, duplicate, rename, search, backup import/export, revision conflict; no JS errors")
    browser.close()
