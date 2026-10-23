"""Integration check: foam samples must stay inside the actual 4035 shell.

Run with the local site on port 5500 and Python playwright + numpy installed.
Uses an isolated Edge context; never changes the user's saved layout.
"""
import base64
import json
from pathlib import Path
import numpy as np
from playwright.sync_api import sync_playwright


def check():
    source = (Path(__file__).resolve().parents[1] / "js/data/case-mesh-4035.js").read_text()
    data = json.loads(source[source.index("=") + 1:].strip().rstrip(";"))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:5500", wait_until="networkidle")
        page.wait_for_function("V3.bjs?.ready")
        result = page.evaluate("""() => {
          S.caseId='4035'; S.items=[]; S.place={}; V3.lid=0; relayout();
          const start=performance.now(), m=build3({d:CASE_MESH['4035']});
          const points=[];
          for(let i=0;i<m.caseEnd;i+=Math.max(9,Math.floor(m.caseEnd/9/800)*9)){
            points.push([0,1,2].map(k=>(m.p[i+k]+m.p[i+k+3]+m.p[i+k+6])/3));
          }
          return {points,ms:performance.now()-start,triangles:m.caseEnd/9};
        }""")
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
        for x, y, z in result["points"]:
            depth = direction * (z + data["ymin_b"])
            if depth <= 0.01:
                continue
            q = np.array([x-data["L"]/2, y+data["zmin"]]) - xy[:, 0]
            a = np.divide(q[:, 0]*v[:, 1]-q[:, 1]*v[:, 0], det, out=np.zeros_like(det), where=good)
            b = np.divide(u[:, 0]*q[:, 1]-u[:, 1]*q[:, 0], det, out=np.zeros_like(det), where=good)
            hit = direction * (tri[:, 0, 1] + a*(tri[:, 1, 1]-tri[:, 0, 1]) + b*(tri[:, 2, 1]-tri[:, 0, 1]))
            hits = hit[good & (a >= 0) & (b >= 0) & (a+b <= 1) & (hit >= 0)]
            assert len(hits), (group, x, y, "outside shell")
            assert depth <= hits.min()+0.3, (group, x, y, depth, hits.min())
            checked += 1
    print(f"PASS: {checked} foam samples inside CAD shell; {result['triangles']} triangles; build {result['ms']:.0f} ms")


if __name__ == "__main__":
    check()
