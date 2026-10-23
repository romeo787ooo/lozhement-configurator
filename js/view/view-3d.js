"use strict";
// 3D-просмотр на WebGL без внешних библиотек.

// ---------- 3D-просмотр (WebGL без внешних библиотек) ----------
const V3 = { on: true, gl: null, yaw: -1.2, pitch: 0.6, dist: 600, tgt: [0, 0, 0], lid: 100, n: 0, caseId: null, labels: true, hide: { shell: false, lid: false, items: new Set() }, sec: { ax: -1, pos: 50, flip: false }, lo: [0, 0, 0], hi: [1, 1, 1], slo: [0, 0, 0], shi: [1, 1, 1], ranges: [], lab: [], mp: [] };
const RED3 = "#e03131", lit3 = (c, k) => c.map(v => v + (1 - v) * k);
const FOAM3 = { "ppe-black": "#2e3338", "ppe-grey": "#8b929a", "ppe-2c": "#2e3338" };
const PAL3 = ["#e8590c", "#2f9e44", "#1c7ed6", "#f08c00", "#ae3ec9", "#0c8599", "#d6336c", "#74b816"];
const rgb3 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
function polyOf(segs) {
  const p = [];
  for (const s of segs) {
    if (s.t === "L") p.push([s.x1, s.y1]);
    else if (s.t === "A") { const n = Math.max(2, Math.ceil((s.a1 - s.a0) / 10)); for (let i = 0; i < n; i++) { const a = (s.a0 + (s.a1 - s.a0) * i / n) * Math.PI / 180; p.push([s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)]); } }
    else for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * Math.PI; p.push([s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)]); }
  }
  return p;
}
function mesh3() {
  const m = { p: [], n: [], c: [], T: null, col: [1, 1, 1] };
  m.v = (x, y, z) => m.T ? m.T(x, y, z) : [x, y, z];
  m.tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(k => k / l);
    for (const q of [a, b, c]) { m.p.push(q[0], q[1], q[2]); m.n.push(n[0], n[1], n[2]); m.c.push(m.col[0], m.col[1], m.col[2]); }
  };
  m.quad = (a, b, c, d) => { m.tri(a, b, c); m.tri(a, c, d); };
  return m;
}
// ширина многоугольника по горизонтали на высоте y (формы выпуклы по y: прямоугольники, круги, прямоугольник с выемкой)
function span3(poly, y) {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[1] - y) * (b[1] - y) <= 0) {
      const dy = b[1] - a[1];
      if (Math.abs(dy) < 1e-9) { lo = Math.min(lo, a[0], b[0]); hi = Math.max(hi, a[0], b[0]); }
      else { const x = a[0] + (b[0] - a[0]) * (y - a[1]) / dy; lo = Math.min(lo, x); hi = Math.max(hi, x); }
    }
  }
  return [lo, hi];
}
// горизонтальная грань: внешний контур минус отверстия, полосами по y
// Split only at actual vertex heights. Keep the same boundary edges across
// each strip, including zero-width tips and multiple concave intervals.
function fill3(m, outer, holes, z) {
  const rings = [outer, ...holes];
  const ys = [...new Set(rings.flatMap(r => r.map(p => p[1])))].sort((a,b) => a-b);
  for (let j=0;j+1<ys.length;j++) {
    const ya=ys[j], yb=ys[j+1], ym=(ya+yb)/2;
    if (yb-ya<1e-10) continue;
    const events=[];
    rings.forEach((ring, ri) => {
      const edges=[];
      ring.forEach((a,i) => {
        const b=ring[(i+1)%ring.length];
        if (Math.min(a[1],b[1])<ym && ym<Math.max(a[1],b[1])) {
          const x=y=>a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);
          edges.push({x, mid:x(ym)});
        }
      });
      edges.sort((a,b)=>a.mid-b.mid);
      for(let i=0;i+1<edges.length;i+=2) {
        events.push({...edges[i], ri, delta:1}, {...edges[i+1], ri, delta:-1});
      }
    });
    events.sort((a,b)=>a.mid-b.mid);
    let outerCount=0, holeCount=0, left=null;
    for (const e of events) {
      const before=outerCount>0 && holeCount===0;
      if(e.ri===0) outerCount+=e.delta; else holeCount+=e.delta;
      const after=outerCount>0 && holeCount===0;
      if(!before && after) left=e;
      if(before && !after && left) {
        m.quad(m.v(left.x(ya),ya,z),m.v(e.x(ya),ya,z),
               m.v(e.x(yb),yb,z),m.v(left.x(yb),yb,z));
        left=null;
      }
    }
  }
}
function wall3(m, poly, z0, z1) {
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; m.quad(m.v(a[0], a[1], z0), m.v(b[0], b[1], z0), m.v(b[0], b[1], z1), m.v(a[0], a[1], z1)); }
}
function box3(m, x0, y0, x1, y1, z0, z1) {
  const v = m.v, A_ = v(x0, y0, z0), B = v(x1, y0, z0), C = v(x1, y1, z0), D = v(x0, y1, z0), E = v(x0, y0, z1), F_ = v(x1, y0, z1), G = v(x1, y1, z1), H = v(x0, y1, z1);
  m.quad(A_, B, C, D); m.quad(E, F_, G, H); m.quad(A_, B, F_, E); m.quad(B, C, G, F_); m.quad(C, D, H, G); m.quad(D, A_, E, H);
}
function cyl3(m, cx, cy, r, z0, z1) {
  const pts = []; for (let i = 0; i < 32; i++) { const a = i / 32 * 2 * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  wall3(m, pts, z0, z1);
  for (let i = 0; i < 32; i++) { const a = pts[i], b = pts[(i + 1) % 32]; m.tri(m.v(cx, cy, z1), m.v(a[0], a[1], z1), m.v(b[0], b[1], z1)); }
}
const shiftP = (p, dx, dy) => p.map(v => [v[0] + dx, v[1] + dy]);

function build3(caseMesh) {
  const c = A.c, P = A.P, F = A.F, m = mesh3(), mat = S.material, sel = S.selected;
  m.ranges = []; m.lab = [];
  const cm = caseMesh === undefined ? getCaseMesh(S.caseId) : caseMesh, Lo = c.out.l, Wo = cm ? cm.d.W : c.out.w, flP = Math.max(4, (c.out.h - c.h) / 2), flB = cm ? -cm.d.ymin_b - c.body : flP, flL = cm ? cm.d.ymax_l - c.lid : flP, wx = (Lo - c.l) / 2, wy = (Wo - c.w) / 2, ox = wx + P.fit, oy = wy + P.fit;
  const base = rgb3(FOAM3[mat]), topC = mat === "ppe-2c" ? rgb3("#2f5fd0") : base, shellC = rgb3(caseColor());
  const outerF = shiftP(polyOf(rrSegs({ x: 0, y: 0, w: F.L, h: F.W }, P.cornerR, null)), ox, oy);
  const rO = Math.min(28, Wo * 0.08), trayO = polyOf(rrSegs({ x: 0, y: 0, w: Lo, h: Wo }, rO, null)), trayI = polyOf(rrSegs({ x: wx, y: wy, w: c.l, h: c.w }, Math.min(14, c.w * 0.05), null));
  const hb = flB + c.body, yax = cm ? Wo - cm.d.ax.off : Wo, zax = cm ? hb + cm.d.ax.y : hb, palOf = it => rgb3(PAL3[Math.max(0, S.items.indexOf(it)) % PAL3.length]);
  m.hinge = [0, yax, zax];
  m.lidStart = m.lidEnd = 0; m.lidLabels = [];
  const itemMesh = (r, col, draw, anchor) => {
    const it = r.it, a0 = m.p.length / 3, hot = sel === r.key;
    m.col = hot ? lit3(col, 0.5) : col; draw();
    m.ranges.push({ key: r.key, a: a0, b: m.p.length / 3 });
    m.lab.push({ key: r.key, text: it.name + (it.qty > 1 ? " · " + (r.n + 1) : ""), p: anchor, bad: r.level === "err", hot });
  };
  for (const zone of ["body", "lid"]) {
    if (zone === "lid" && V3.hide.lid) continue;
    if (zone === "lid") m.lidStart = m.p.length / 3;
    const labelStart = m.lab.length;
    const flz = zone === "lid" ? flL : flB, depth = zone === "lid" ? c.lid : c.body, ht = flz + depth;
    if (zone === "lid") {
      const phi = V3.lid * Math.PI / 180, s = Math.sin(phi), co = Math.cos(phi);
      m.T = (x, y, z) => { const dy = Wo - y - yax, dz = hb + ht - z - zax; return [x, yax + dy * co + dz * s, zax - dy * s + dz * co]; };
    } else m.T = null;
    const z0 = V3.hide.shell ? 0 : flz, top = z0 + depth;
    if (!V3.hide.shell && !cm) {
      m.col = shellC; fill3(m, trayO, [], 0); wall3(m, trayO, 0, ht); fill3(m, trayO, [trayI], ht); wall3(m, trayI, flz, ht); fill3(m, trayI, [], flz);
    }
    const pk = [];
    for (const r of A.res) if (r.g && r.zone === zone && r.d.depth > 0) pk.push({ r, poly: shiftP(polyOf(pocketSegs(r.it, r.g, P)), ox, oy), depth: r.d.depth });
    if (zone === "lid") for (const g of A.ghosts) if (g.depth > 0) pk.push({ poly: shiftP(polyOf(g.it.shape === "cyl" ? [{ t: "C", cx: g.rect.x + g.rect.w / 2, cy: g.rect.y + g.rect.h / 2, r: g.rect.w / 2 }] : rrSegs(g.rect, P.toolR, null)), ox, oy), depth: g.depth });
    const tb = Math.min(5, depth), wallSplit = (poly, za, zb) => {
      if (mat === "ppe-2c" && za < zb - tb) { m.col = base; wall3(m, poly, za, zb - tb); m.col = topC; wall3(m, poly, zb - tb, zb); }
      else { m.col = mat === "ppe-2c" ? topC : base; wall3(m, poly, za, zb); }
    };
    fitFoam3(m, !V3.hide.shell && cm ? cm.d : null, zone, top, () => {
      m.col = base; fill3(m, outerF, [], z0); wallSplit(outerF, z0, top);
      m.col = topC; fill3(m, outerF, pk.map(p => p.poly), top);
      for (const p of pk) { wallSplit(p.poly, top - p.depth, top); m.col = base; fill3(m, p.poly, [], top - p.depth); }
    });
    for (const p of pk) {
      if (!p.r || p.r.d.err || V3.hide.items.has(p.r.it.id)) continue;
      const it = p.r.it, g = p.r.g.pocket, zb = top - p.depth, k = P.clear, cx = ox + g.x + g.w / 2, cy = oy + g.y + g.h / 2;
      const col = p.r.level === "err" ? rgb3(RED3) : palOf(it);
      itemMesh(p.r, col, () => {
        if (Array.isArray(it.customShape) && it.customShape.length>=3) {
          const q=p.poly.map(v=>[cx+(v[0]-cx)*(g.w-2*k)/g.w,cy+(v[1]-cy)*(g.h-2*k)/g.h]);
          wall3(m,q,zb,zb+it.h); fill3(m,q,[],zb); fill3(m,q,[],zb+it.h);
        } else if(it.shape==="cyl") cyl3(m,cx,cy,it.l/2,zb,zb+it.h);
        else box3(m,ox+g.x+k,oy+g.y+k,ox+g.x+g.w-k,oy+g.y+g.h-k,zb,zb+it.h);
      }, m.v(cx, cy, zb + it.h));
    }
    if (zone === "lid") {
      m.lidEnd = m.p.length / 3;
      m.lidLabels = m.lab.slice(labelStart).map(label => ({label, point:label.p.slice()}));
    }
  }
  { const phi = V3.lid * Math.PI / 180, s = Math.sin(phi), co = Math.cos(phi);
    m.mesh = cm ? { cm, lidU: [1, 0, 0, 0, 0, co, -s, 0, 0, s, co, 0, 0, yax - yax * co - zax * s, zax + yax * s - zax * co, 1], lidR: [1, 0, 0, 0, co, -s, 0, s, co] } : null; }
  m.caseEnd = m.p.length;
  // предметы, которые не вместились в кейс: красным справа от кейса
  m.T = null; let yc = 0; const xo = Lo + 70, out = [];
  for (const r of A.res) {
    if ((r.g && !r.d.err) || V3.hide.items.has(r.it.id)) continue;
    const it = r.it, d1 = it.shape === "cyl" ? it.l : it.w;
    itemMesh(r, rgb3(RED3), () => it.shape === "cyl" ? cyl3(m, xo + it.l / 2, yc + it.l / 2, it.l / 2, 0, it.h) : box3(m, xo, yc, xo + it.l, yc + d1, 0, it.h), [xo + it.l / 2, yc + d1 / 2, it.h]);
    m.lab[m.lab.length - 1].text = "✕ " + m.lab[m.lab.length - 1].text; out.push(it.name);
    yc += d1 + 25;
  }
  m.out = [...new Set(out)];
  return m;
}

const VS3 = "attribute vec3 p,n,c;uniform mat4 M,U;uniform mat3 R;varying vec3 vn,vc,vp;void main(){vec4 w=U*vec4(p,1.);gl_Position=M*w;vn=R*n;vc=c;vp=w.xyz;}";
const FS3 = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec3 vn,vc,vp;uniform vec4 K;void main(){if(dot(vp,K.xyz)>K.w)discard;vec3 n=normalize(vn);float k=.34+.46*abs(dot(n,normalize(vec3(.35,-.55,.75))))+.2*abs(dot(n,normalize(vec3(-.6,.3,.4))));gl_FragColor=vec4(vc*k,1.);}";
function initGL3() {
  if (V3.gl !== null) return !!V3.gl;
  const cv = $("gl3d"), gl = cv.getContext("webgl", { antialias: true });
  if (!gl) { V3.gl = false; return false; }
  const sh = (t, s) => {
    const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(o) || "неизвестная ошибка шейдера";
      console.error("Ошибка шейдера 3D:", message); gl.deleteShader(o);
      throw new Error("Не удалось запустить 3D-визуализатор: " + message);
    }
    return o;
  };
  let pr;
  try {
    pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS3)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS3)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || "не удалось связать шейдеры");
  } catch (err) {
    V3.gl = false; $("v3n").textContent = err.message || "Не удалось запустить 3D-визуализатор.";
    console.error(err); return false;
  }
  gl.useProgram(pr);
  V3.gl = gl; V3.pr = pr; V3.bufs = {};
  V3.al = {}; for (const a of ["p", "n", "c"]) { V3.bufs[a] = gl.createBuffer(); V3.al[a] = gl.getAttribLocation(pr, a); }
  V3.uloc = gl.getUniformLocation(pr, "U"); V3.rloc = gl.getUniformLocation(pr, "R"); V3.u32 = gl.getExtension("OES_element_index_uint");
  V3.loc = gl.getUniformLocation(pr, "M"); V3.kloc = gl.getUniformLocation(pr, "K");
  const ptr = new Map(); let pinch = 0;
  let down = null;
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; down = ptr.size === 1 ? { x: e.clientX, y: e.clientY, moved: false } : null; });
  const up = e => {
    if (down && ptr.size === 1 && !down.moved && e.type === "pointerup") { const r = cv.getBoundingClientRect(), key = pick3(e.clientX - r.left, e.clientY - r.top); selectItem(key); if (key) { const d = document.querySelector('.item[data-id="' + key.split("#")[0] + '"]'); if (d) d.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }
    ptr.delete(e.pointerId); down = null;
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointermove", e => {
    if (!ptr.has(e.pointerId)) return;
    const o = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) down.moved = true;
    if (ptr.size === 1) { V3.yaw -= (e.clientX - o[0]) * 0.008; V3.pitch = Math.max(-1.55, Math.min(1.55, V3.pitch + (e.clientY - o[1]) * 0.008)); }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) V3.dist = Math.max(60, Math.min(5000, V3.dist * pinch / d)); pinch = d; }
    draw3();
  });
  cv.addEventListener("wheel", e => { e.preventDefault(); V3.dist = Math.max(60, Math.min(5000, V3.dist * Math.exp(e.deltaY * 0.001))); draw3(); }, { passive: false });
  new ResizeObserver(() => V3.on && draw3()).observe(cv);
  return true;
}
function bounds3(p) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  V3.lo = lo; V3.hi = hi;
}
function fitCam3() {
  if (!babylonBounds3()) bounds3(V3.mp); const lo = V3.lo, hi = V3.hi;
  V3.tgt = lo.map((v, k) => (v + hi[k]) / 2); V3.dist = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1.9;
}
const EYE3 = on => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>' + (on ? "" : '<path d="M3 3l18 18"/>') + '</svg>';
function renderRows3() {
  const box = $("v3l"); box.textContent = "";
  const row = (name, color, vis, onEye, onName, hot) => {
    const d = document.createElement("div"); d.className = "v3r" + (hot ? " sel" : "");
    const sw = document.createElement("i"); sw.style.background = color; d.appendChild(sw);
    const n = document.createElement("button"); n.type = "button"; n.className = "nm"; n.textContent = name; if (onName) n.onclick = onName; else n.disabled = true; d.appendChild(n);
    const e = document.createElement("button"); e.type = "button"; e.className = "eye"; e.setAttribute("aria-pressed", String(vis)); e.setAttribute("aria-label", (vis ? "Скрыть: " : "Показать: ") + name); e.innerHTML = EYE3(vis); e.onclick = onEye; d.appendChild(e);
    box.appendChild(d);
  };
  const tg = f => () => { f(); render3D(); };
  row("Кейс (корпус и крышка)", caseColor(), !V3.hide.shell, tg(() => { V3.hide.shell = !V3.hide.shell; }));
  row("Крышка (вместе с ложементом)", "#6b757e", !V3.hide.lid, tg(() => { V3.hide.lid = !V3.hide.lid; }));
  const bad = new Set(A.res.filter(r => !r.g || r.d.err).map(r => r.it.id));
  for (const it of S.items) row(it.name + (it.qty > 1 ? " × " + it.qty : "") + (bad.has(it.id) ? " (не вмещается)" : ""), bad.has(it.id) ? RED3 : PAL3[S.items.indexOf(it) % PAL3.length], !V3.hide.items.has(it.id),
    tg(() => { V3.hide.items.has(it.id) ? V3.hide.items.delete(it.id) : V3.hide.items.add(it.id); }), () => selectItem(it.id + "#0"), !!S.selected && S.selected.startsWith(it.id + "#"));
}
function renderLabels3() {
  const box = $("v3lab"); box.textContent = "";
  V3.labEls = V3.lab.map(l => { const d = document.createElement("div"); d.textContent = l.text; d.className = (l.bad ? "bad " : "") + (l.hot ? "hot" : ""); box.appendChild(d); return d; });
}
async function initBabylon3D() {
  if (V3.bjs?.pending || V3.bjs?.ready) return;
  const b=V3.bjs={pending:true};
  let engine;
  try {
    const canvas=$("gl3d");
    if(await BABYLON.WebGPUEngine.IsSupportedAsync) {
      engine=new BABYLON.WebGPUEngine(canvas,{antialias:true});
      await engine.initAsync();
    } else engine=new BABYLON.Engine(canvas,true);
    const scene=new BABYLON.Scene(engine);
    scene.useRightHandedSystem=true;
    scene.clearColor=new BABYLON.Color4(.08,.1,.12,1);
    const camera=new BABYLON.ArcRotateCamera("camera",0,1,1000,BABYLON.Vector3.Zero(),scene);
    camera.upVector=new BABYLON.Vector3(0,0,1);
    camera.minZ=.5; camera.maxZ=20000; camera.lowerRadiusLimit=30;
    // Scale wheel movement with distance: scene coordinates are millimetres.
    camera.wheelDeltaPercentage=0.01;
    camera.attachControl(canvas,false);
    const light=new BABYLON.HemisphericLight("light",new BABYLON.Vector3(.3,-.4,1),scene);
    light.intensity=.95; light.groundColor=new BABYLON.Color3(.35,.35,.35);
    const material=new BABYLON.StandardMaterial("scene-material",scene);
    material.diffuseColor=BABYLON.Color3.White();
    material.specularColor=BABYLON.Color3.Black();
    material.backFaceCulling=false;
    Object.assign(b,{pending:false,ready:true,engine,scene,camera,material});
    b.resize=new ResizeObserver(()=>engine.resize()); b.resize.observe(canvas);
    scene.onPointerObservable.add(info=>{
      if(info.type===BABYLON.PointerEventTypes.POINTERPICK && info.pickInfo?.hit) {
        const key=info.pickInfo.pickedMesh?.metadata?.key;
        if(key) selectItem(key);
      }
    });
    engine.runRenderLoop(()=>{if(V3.on){
      if(typeof SCALE3!=="undefined" && SCALE3.active && SCALE3.scene) SCALE3.scene.render();
      else {updateBabylon3D();scene.render();}
    }});
    renderBabylon3D();
  } catch(e) {
    engine?.dispose(); Object.assign(b,{pending:false,ready:false,failed:true});
    $("v3n").textContent="Ошибка запуска 3D: "+e.message;
    console.error(e);
  }
}
function babylonMesh3(name, positions, normals, colors, indices, key) {
  const b=V3.bjs, mesh=new BABYLON.Mesh(name,b.scene), data=new BABYLON.VertexData();
  data.positions=positions; data.normals=normals; data.colors=colors;
  data.indices=indices || Array.from({length:positions.length/3},(_,i)=>i);
  data.applyToMesh(mesh); mesh.material=b.material;
  mesh.metadata={key}; mesh.isPickable=!!key;
  return mesh;
}
function renderBabylon3D() {
  const b=V3.bjs; if(!b?.ready || !A) return;
  if(typeof SCALE3!=="undefined" && SCALE3.active){updateScaleCase3();return;}
  try {
    const d=typeof CASE_MESH!=="undefined" && CASE_MESH[S.caseId];
    const m=build3(d?{d}:null);
    b.scene.meshes.slice().forEach(mesh=>mesh.dispose());
    b.lidPivot?.dispose();
    b.lidPivot = new BABYLON.TransformNode("lid-hinge",b.scene);
    b.lidPivot.position = BABYLON.Vector3.FromArray(m.hinge);
    b.lidAngle = V3.lid; b.lidLabels = m.lidLabels; b.hinge = m.hinge;
    const attachLid = mesh => {
      mesh.parent = b.lidPivot;
      mesh.position = BABYLON.Vector3.FromArray(m.hinge).negate();
    };
    const addRange=(start,end,key)=>{
      if(end<=start)return;
      for(const cut of [m.lidStart,m.lidEnd]) {
        if(start<cut && cut<end){addRange(start,cut,key);addRange(cut,end,key);return;}
      }
      const colors=[];
      for(let i=start*3;i<end*3;i+=3) colors.push(m.c[i],m.c[i+1],m.c[i+2],1);
      const mesh=babylonMesh3(key||"foam",m.p.slice(start*3,end*3),m.n.slice(start*3,end*3),colors,null,key);
      if(start>=m.lidStart && end<=m.lidEnd)attachLid(mesh);
    };
    let cursor=0;
    for(const r of m.ranges){addRange(cursor,r.a);addRange(r.a,r.b,r.key);cursor=r.b;}
    addRange(cursor,m.p.length/3);
    if(d && !V3.hide.shell) {
      const hinge=d.hinge>0?d.zmax:d.zmin;
      for(const name of ["base","lid"]) {
        if(name==="lid" && V3.hide.lid)continue;
        const part=d[name], q=new Uint16Array(b64buf(part.v)), pos=[], colors=[];
        const col=rgb3(caseColor()), U=name==="lid"?m.mesh.lidU:null, black=new Set(part.blackVertices||[]);
        for(let i=0;i<q.length;i+=3) {
          const X=part.o[0]+q[i]*d.s,Y=part.o[1]+q[i+1]*d.s,Z=part.o[2]+q[i+2]*d.s;
          const x=X+d.L/2,y=d.W-Math.abs(Z-hinge),z=Y-d.ymin_b;
          pos.push(...(U?[U[0]*x+U[4]*y+U[8]*z+U[12],U[1]*x+U[5]*y+U[9]*z+U[13],U[2]*x+U[6]*y+U[10]*z+U[14]]:[x,y,z]));
          colors.push(...(black.has(i/3)?[.025,.025,.025]:col),1);
        }
        const idx=part.w16?new Uint16Array(b64buf(part.i)):new Uint32Array(b64buf(part.i)), normals=[];
        BABYLON.VertexData.ComputeNormals(pos,idx,normals,{useRightHandedSystem:true});
        const mesh=babylonMesh3(name,pos,normals,colors,idx);mesh.metadata.occludesLabels=true;
        if(name==="lid")attachLid(mesh);
      }
    }
    V3.mp=m.p; V3.lab=m.lab; V3.ranges=m.ranges;
    bounds3(m.p); V3.slo=V3.lo.slice(); V3.shi=V3.hi.slice();
    if(b.caseId!==S.caseId){b.caseId=S.caseId;fitCam3();syncBabylonCamera3();}
    renderRows3();renderLabels3();
    $("v3tag").textContent="Babylon.js · "+(b.engine instanceof BABYLON.WebGPUEngine?"WebGPU":"WebGL");
    $("v3n").textContent=m.out.length?"Не вмещаются: "+m.out.join(", "):"Вращение: мышью. Масштаб: колесо. Нажмите на предмет для выделения.";
    b.engine.resize();
  } catch(e){$("v3n").textContent="Ошибка построения 3D: "+e.message;console.error(e);}
}
function babylonBounds3() {
  const b=V3.bjs;
  if(!b?.ready || !b.scene.meshes.length)return false;
  const points=[];
  for(const mesh of b.scene.meshes) {
    mesh.computeWorldMatrix(true);
    for(const p of mesh.getBoundingInfo().boundingBox.vectorsWorld)points.push(p.x,p.y,p.z);
  }
  bounds3(points);
  return true;
}
function moveLid3() {
  const b=V3.bjs;
  if(!b?.ready || !b.lidPivot || (typeof SCALE3!=="undefined" && SCALE3.active)) {
    render3D(); return;
  }
  const angle=(V3.lid-b.lidAngle)*Math.PI/180, co=Math.cos(angle), s=Math.sin(angle);
  b.lidPivot.rotation.x=-angle;
  const [,hy,hz]=b.hinge;
  for(const {label,point:p} of b.lidLabels) {
    const y=p[1]-hy,z=p[2]-hz;
    label.p=[p[0],hy+y*co+z*s,hz-y*s+z*co];
  }
  babylonBounds3(); V3.slo=V3.lo.slice(); V3.shi=V3.hi.slice();
}
function syncBabylonCamera3() {
  const b=V3.bjs;if(!b?.ready)return;
  const t=V3.tgt, cp=Math.cos(V3.pitch);
  b.camera.setTarget(BABYLON.Vector3.FromArray(t));
  b.camera.setPosition(new BABYLON.Vector3(t[0]+V3.dist*cp*Math.cos(V3.yaw),t[1]+V3.dist*cp*Math.sin(V3.yaw),t[2]+V3.dist*Math.sin(V3.pitch)));
}
function updateBabylon3D() {
  const b=V3.bjs;if(!b?.ready)return;
  const sc=V3.sec, v=sc.ax>=0?V3.slo[sc.ax]+(V3.shi[sc.ax]-V3.slo[sc.ax])*sc.pos/100:0;
  const n=[0,0,0];if(sc.ax>=0)n[sc.ax]=sc.flip?-1:1;
  b.scene.clipPlane=sc.ax>=0?new BABYLON.Plane(...n,sc.flip?v:-v):null;
  const cv=$("gl3d"), viewport=b.camera.viewport.toGlobal(cv.clientWidth,cv.clientHeight);
  // Do no picking while navigating or while labels are disabled. Spread
  // occlusion checks across frames after the camera settles, then cache them.
  const hideLabels=()=>{for(const el of V3.labEls||[])if(el.style.display!=="none")el.style.display="none";};
  if(!V3.labels){hideLabels();b.labelProbe=null;return;}
  const signature=[...b.camera.position.asArray(),...b.camera.getTarget().asArray(),V3.lid,sc.ax,sc.pos,sc.flip,cv.clientWidth,cv.clientHeight,b.scene.meshes.map(m=>m.uniqueId).join(',')].join('|');
  const now=performance.now();
  if(!b.labelProbe || b.labelProbe.signature!==signature || b.labelProbe.labels!==V3.lab){
    b.labelProbe={signature,labels:V3.lab,changedAt:now,index:0,blocked:new Set()};
    hideLabels();return;
  }
  const probe=b.labelProbe;
  if(now-probe.changedAt<180)return;
  if(probe.index<V3.lab.length){
    const l=V3.lab[probe.index++],origin=b.camera.globalPosition;
    const delta=BABYLON.Vector3.FromArray(l.p).subtract(origin),distance=delta.length();
    if(distance>1){
      const ray=new BABYLON.Ray(origin,delta.scale(1/distance),distance-1);
      const hit=b.scene.pickWithRay(ray,m=>m.isEnabled()&&m.isVisible&&(m.metadata?.occludesLabels||(!m.metadata?.key&&m.name==='foam')),true);
      if(hit?.hit)probe.blocked.add(l.key);
    }
  }
  V3.lab.forEach((l,i)=>{
    const el=V3.labEls?.[i];if(!el)return;
    const q=BABYLON.Vector3.Project(BABYLON.Vector3.FromArray(l.p),BABYLON.Matrix.Identity(),b.scene.getTransformMatrix(),viewport);
    const hidden=i>=probe.index || probe.blocked.has(l.key) || q.z<0 || q.z>1 || (sc.ax>=0 && (sc.flip?l.p[sc.ax]<v:l.p[sc.ax]>v));
    const display=hidden?"none":"",left=q.x+"px",top=q.y+"px";
    if(el.style.display!==display)el.style.display=display;
    if(!hidden){if(el.style.left!==left)el.style.left=left;if(el.style.top!==top)el.style.top=top;}
  });
}
function render3D() {
  if (window.BABYLON && BABYLON.WebGPUEngine && !(V3.bjs && V3.bjs.failed)) { if (!V3.bjs || !V3.bjs.ready) { initBabylon3D(); return; } renderBabylon3D(); return; }
  if (!A || !initGL3()) return;
  let m;
  try { m = build3(); }
  catch (err) {
    $("v3n").textContent = "Ошибка построения 3D-модели: " + (err && err.message ? err.message : String(err));
    console.error("Ошибка построения 3D-модели", err); return;
  }
  const gl = V3.gl;
  for (const a of ["p", "n", "c"]) { gl.bindBuffer(gl.ARRAY_BUFFER, V3.bufs[a]); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m[a]), gl.STATIC_DRAW); }
  V3.n = m.p.length / 3; V3.mp = m.p; V3.ranges = m.ranges; V3.lab = m.lab; V3.mesh = m.mesh; if (m.mesh) { const q = m.mesh.cm.d; V3.mp = m.p; } bounds3(m.p.slice(0, m.caseEnd)); if (m.mesh) { const d = m.mesh.cm.d; V3.lo = [0, 0, 0]; V3.hi = [d.L, d.W, d.ymax_l - d.ymin_b]; } V3.slo = V3.lo; V3.shi = V3.hi; bounds3(m.p);
  if (m.mesh) { const d = m.mesh.cm.d; for (let k = 0; k < 3; k++) { V3.lo[k] = Math.min(V3.lo[k], V3.slo[k]); V3.hi[k] = Math.max(V3.hi[k], V3.shi[k]); } }
  if (V3.caseId !== S.caseId) { V3.caseId = S.caseId; fitCam3(); }
  renderRows3(); renderLabels3(); $("v3tag").textContent = m.mesh ? "точная модель кейса" : "упрощённая модель корпуса";
  $("v3n").textContent = m.out.length ? "Не вмещаются в кейс (красные, справа от кейса): " + m.out.join(", ") + "." : "Вращение: потяните мышью или пальцем. Масштаб: колесо или щипок. Клик по предмету выделяет его в списке и на плане.";
  draw3();
}
function pick3(px, py) {
  const C = V3.cam, cv = $("gl3d"); if (!C) return null;
  const x = (2 * px / cv.clientWidth - 1) * C.tf * C.asp, y = (1 - 2 * py / cv.clientHeight) * C.tf;
  const d = [0, 1, 2].map(k => C.f[k] + C.s[k] * x + C.u[k] * y), p = V3.mp; let best = 1e18, key = null;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const rg of V3.ranges) for (let i = rg.a; i < rg.b; i += 3) {
    const v0 = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], v1 = [p[i * 3 + 3], p[i * 3 + 4], p[i * 3 + 5]], v2 = [p[i * 3 + 6], p[i * 3 + 7], p[i * 3 + 8]];
    const e1 = sub(v1, v0), e2 = sub(v2, v0), h = crs(d, e2), a = dot(e1, h); if (Math.abs(a) < 1e-9) continue;
    const s = sub(C.eye, v0), u = dot(s, h) / a; if (u < 0 || u > 1) continue;
    const q = crs(s, e1), v = dot(d, q) / a; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / a; if (t > 0 && t < best) { best = t; key = rg.key; }
  }
  return key;
}
function draw3() {
  if(V3.bjs?.ready){updateBabylon3D();return;}
  const gl = V3.gl, cv = $("gl3d"); if (!gl || !V3.on) return;
  const dpr = window.devicePixelRatio || 1, w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#dde2e6";
  const [r, g, b] = /^#/.test(bg) ? rgb3(bg.length === 4 ? "#" + [...bg.slice(1)].map(x => x + x).join("") : bg) : [0.87, 0.89, 0.9];
  gl.viewport(0, 0, w, h); gl.clearColor(r, g, b, 1); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const t = V3.tgt, cp = Math.cos(V3.pitch), eye = [t[0] + V3.dist * cp * Math.cos(V3.yaw), t[1] + V3.dist * cp * Math.sin(V3.yaw), t[2] + V3.dist * Math.sin(V3.pitch)];
  let f = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]]; const fl_ = Math.hypot(...f); f = f.map(v => v / fl_);
  let s = [f[1], -f[0], 0]; const sl = Math.hypot(...s) || 1; s = s.map(v => v / sl);
  const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
  const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  const fo = 1 / Math.tan(0.3), nr = V3.dist * 0.05, fr = V3.dist * 8, asp = w / h;
  const Pm = [fo / asp, 0, 0, 0, 0, fo, 0, 0, 0, 0, (fr + nr) / (nr - fr), -1, 0, 0, 2 * fr * nr / (nr - fr), 0];
  const M = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let v = 0; for (let k = 0; k < 4; k++) v += Pm[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = v; }
  V3.cam = { eye, f, s, u, asp, tf: Math.tan(0.3) }; V3.M = M;
  const sc = V3.sec; let K = [0, 0, 0, 1];
  if (sc.ax >= 0) { const v = V3.slo[sc.ax] + (V3.shi[sc.ax] - V3.slo[sc.ax]) * sc.pos / 100, e = [0, 0, 0, 0]; e[sc.ax] = sc.flip ? -1 : 1; K = [e[0], e[1], e[2], sc.flip ? -v : v]; }
  gl.uniform4fv(V3.kloc, K); gl.uniformMatrix4fv(V3.loc, false, M);
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  gl.uniformMatrix4fv(V3.uloc, false, I4); gl.uniformMatrix3fv(V3.rloc, false, I3);
  for (const a of ["p", "n", "c"]) { gl.bindBuffer(gl.ARRAY_BUFFER, V3.bufs[a]); gl.enableVertexAttribArray(V3.al[a]); gl.vertexAttribPointer(V3.al[a], 3, gl.FLOAT, false, 0, 0); }
  gl.drawArrays(gl.TRIANGLES, 0, V3.n);
  const sm = V3.mesh;
  if (sm && !V3.hide.shell) {
    gl.disableVertexAttribArray(V3.al.c); gl.vertexAttrib3f(V3.al.c, ...rgb3(caseColor()));
    const drawS = (part, U, Rm) => {
      gl.uniformMatrix4fv(V3.uloc, false, U); gl.uniformMatrix3fv(V3.rloc, false, Rm);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.pb); gl.enableVertexAttribArray(V3.al.p); gl.vertexAttribPointer(V3.al.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.nb); gl.enableVertexAttribArray(V3.al.n); gl.vertexAttribPointer(V3.al.n, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.ib); gl.drawElements(gl.TRIANGLES, part.cnt, part.w16 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, 0);
    };
    drawS(sm.cm.base, I4, I3);
    if (!V3.hide.lid) drawS(sm.cm.lid, sm.lidU, sm.lidR);
  }
  const cw = cv.clientWidth, ch = cv.clientHeight;
  V3.lab.forEach((l, i) => {
    const el = V3.labEls && V3.labEls[i]; if (!el) return;
    const p = l.p, x = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], y = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], wv = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    const hid = !V3.labels || wv <= 0 || (sc.ax >= 0 && (sc.flip ? p[sc.ax] < V3.slo[sc.ax] + (V3.shi[sc.ax] - V3.slo[sc.ax]) * sc.pos / 100 : p[sc.ax] > V3.slo[sc.ax] + (V3.shi[sc.ax] - V3.slo[sc.ax]) * sc.pos / 100));
    el.style.display = hid ? "none" : ""; if (hid) return;
    el.style.left = ((x / wv * 0.5 + 0.5) * cw).toFixed(1) + "px"; el.style.top = ((1 - (y / wv * 0.5 + 0.5)) * ch).toFixed(1) + "px";
  });
}
function setView3(on) {
  V3.on = on;
  if (on) { if (!initGL3()) { $("v3n").textContent = "Браузер не поддерживает WebGL: 3D-просмотр недоступен."; return; } render3D(); }
}
function initView3() {
  initColors3();
  $("v3t").onchange = e => { V3.labels = e.target.checked; draw3(); };
  $("v3a").oninput = e => { V3.lid = +e.target.value; $("v3av").textContent = V3.lid + "°"; moveLid3(); };
  const secUp = () => { V3.sec.ax = +$("v3x").value; V3.sec.pos = +$("v3xp").value; $("v3xp").disabled = $("v3xf").disabled = V3.sec.ax < 0; draw3(); };
  $("v3x").onchange = secUp; $("v3xp").oninput = secUp; $("v3xf").onclick = () => { V3.sec.flip = !V3.sec.flip; secUp(); }; secUp();
  const setLid = a => { V3.lid = a; $("v3a").value = a; $("v3av").textContent = a + "°"; };
  const pre = { iso: [-1.2, 0.6, 100], top: [-Math.PI / 2, 1.55, 100], front: [-Math.PI / 2, 0.12, 100], bottom: [-1.2, -1.2, 0] };
  document.querySelectorAll("#v3p button").forEach(b => b.onclick = () => { const p = pre[b.dataset.p]; V3.yaw = p[0]; V3.pitch = p[1]; setLid(p[2]); moveLid3(); fitCam3(); syncBabylonCamera3(); draw3(); });
}
