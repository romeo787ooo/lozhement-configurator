"""Integration check: foam samples must stay inside the selected CAD shell.

Run with the local site on port 5500 and Python playwright + numpy installed.
Uses an isolated Edge context; never changes the user's saved layout.
"""
import base64
import json
import sys
from pathlib import Path
import numpy as np
from playwright.sync_api import sync_playwright


def check(case_id='4035'):
    source = (Path(__file__).resolve().parents[1] / f"js/data/case-mesh-{case_id}.js").read_text()
    data = json.loads(source[source.index("=") + 1:].strip().rstrip(";"))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:5500", wait_until="networkidle")
        page.wait_for_function("V3.bjs?.ready")
        # Модели кейсов подгружаются после запуска интерфейса (loadCaseMeshes).
        page.wait_for_function("id => typeof CASE_MESH !== 'undefined' && !!CASE_MESH[id]", arg=case_id, timeout=120000)
        result = page.evaluate("""id => {
          S.caseId=id; S.items=[]; S.place={}; V3.lid=0; relayout();
          const start=performance.now(), m=build3({d:CASE_MESH[id]});
          const points=[];
          for(let i=0;i<m.caseEnd;i+=Math.max(9,Math.floor(m.caseEnd/9/800)*9)){
            points.push([0,1,2].map(k=>(m.p[i+k]+m.p[i+k+3]+m.p[i+k+6])/3));
          }
          return {points,ms:performance.now()-start,triangles:m.caseEnd/9};
        }""", case_id)
        assert not errors, errors
        browser.close()
    checked = 0
    for group, direction in [("base", -1), ("lid", 1)]:
        part = data[group]
        vertices = np.frombuffer(base64.b64decode(part["v"]), dtype="<u2").reshape(-1, 3) * data["s"] + part["o"]
        indices = np.frombuffer(base64.b64decode(part["i"]), dtype="<u2" if part["w16"] else "<u4").reshape(-1, 3)
        tri = vertices[indices]
        xy = tri[:, :, [0, 2]]
        u, v = xy[:, 1] - xy[:, 0], xy[:, 2] - xy[:, 0]
        det = u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]
        good = abs(det) > 1e-9
        low, high = xy.min(axis=1), xy.max(axis=1)
        for x, y, z in result["points"]:
            depth = direction * (z + data["ymin_b"])
            if depth <= 0.01:
                continue
            point = np.array([x-data["L"]/2, y+data["zmin"]])
            mask = good & (low[:,0] <= point[0]) & (high[:,0] >= point[0]) & (low[:,1] <= point[1]) & (high[:,1] >= point[1])
            q = point - xy[mask, 0]
            uu, vv, dd, tt = u[mask], v[mask], det[mask], tri[mask]
            a = (q[:,0]*vv[:,1]-q[:,1]*vv[:,0])/dd
            b = (uu[:,0]*q[:,1]-uu[:,1]*q[:,0])/dd
            hit = direction*(tt[:,0,1]+a*(tt[:,1,1]-tt[:,0,1])+b*(tt[:,2,1]-tt[:,0,1]))
            hits = hit[(a>=0) & (b>=0) & (a+b<=1) & (hit>=0)]
            assert len(hits), (group, x, y, "outside shell")
            assert depth <= hits.min()+0.3, (group, x, y, depth, hits.min())
            checked += 1
    print(f"PASS: {checked} foam samples inside CAD shell; {result['triangles']} triangles; build {result['ms']:.0f} ms")


if __name__ == "__main__":
    check(sys.argv[1] if len(sys.argv)>1 else '4035')
