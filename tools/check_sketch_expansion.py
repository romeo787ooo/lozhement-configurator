"""Pointer regression: move a corner outside the original contour and save."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel="msedge",headless=True)
    page=browser.new_page(viewport={"width":1500,"height":1200})
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto("http://127.0.0.1:5500",wait_until="networkidle")
    page.wait_for_function("typeof A!=='undefined' && A")
    page.evaluate("""() => {
      V3.on=false; S.caseId='7030';
      S.items=[mkItem({name:'Corner test',shape:'rect',l:100,w:60,h:20},{notch:false,orient:'2',customShape:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]})];
      relayout();S.selected=S.items[0].id+'#0';S.place[S.selected].rot=0;refresh();openSketchEditor();SKETCH.snap=false;
    }""")
    page.locator('#sketch-canvas').scroll_into_view_if_needed()
    coords=page.evaluate("""() => {
      const svg=$('sketch-canvas'),m=svg.getScreenCTM(),q=skToCanvas(SKETCH.points[3]);
      const screen=(x,y)=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const t=p.matrixTransform(m);return {x:t.x,y:t.y};};
      return {start:screen(q.x,q.y),end:screen(q.x-25,q.y-22)};
    }""")
    page.mouse.move(**coords['start']);page.mouse.down();page.mouse.move(**coords['end'],steps=8);page.mouse.up()
    print(page.evaluate("""() => {
      const check=(v,m)=>{if(!v)throw Error(m);};
      check(SKETCH.points[3].x<0&&SKETCH.points[3].y>1,'corner stayed clamped');
      const expanded=skSnapshot(),v=SKETCH.viewport;
      check(v.x<expanded[3].x&&v.y+v.h>expanded[3].y,'canvas did not expand');
      skUndo();check(SKETCH.points[3].x===0&&SKETCH.points[3].y===1,'undo failed');skRedo();
      check(JSON.stringify(SKETCH.points)===JSON.stringify(expanded),'redo failed');
      const expected=expanded.map(p=>[p.x*skWidth(),p.y*skHeight()]);
      const item=S.items[0],key=item.id+'#0',old={...S.place[key]};applySketch();
      check(!sketchIsOpen(),'cannot apply expanded contour');
      const g=geom(item,S.place[key],S.params),segments=pocketSegs(item,g,S.params);
      segments.forEach((s,i)=>check(Math.hypot(s.x1-old.x-expected[i][0],s.y1-old.y-expected[i][1])<.01,'saved contour distorted'));
      openSketchEditor();check(!skValidate(),'reopened invalid');
      $('sketch-width').value=250;$('sketch-height').value=140;skSetDimensions();
      check(Math.abs(Number($('sketch-width').value)-250)<.1,'size clipped');
      check(Math.abs(Number($('sketch-height').value)-140)<.1,'height clipped');
      applySketch();check(Math.abs(pocketSize(item,S.params).pw-250)<.1,'size not saved');
      return 'PASS: corner drag, auto canvas, undo/redo, physical shape and resize';
    }"""))
    assert not errors,errors
    browser.close()
