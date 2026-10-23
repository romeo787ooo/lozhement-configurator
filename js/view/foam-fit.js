"use strict";

// CAD cavity samples use X along the case and Z across it, in millimetres.
function cavityDepth3(grid, x, y) {
  const gx = (x - grid.origin[0]) / grid.step, gy = (y - grid.origin[1]) / grid.step;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  if (ix < 0 || iy < 0 || ix + 1 >= grid.nx || iy + 1 >= grid.ny) return 0;
  const u = gx - ix, v = gy - iy, k = iy * grid.nx + ix, d = grid.depth;
  return (d[k] * (1-u) + d[k+1] * u) * (1-v) +
    (d[k+grid.nx] * (1-u) + d[k+grid.nx+1] * u) * v;
}

// Adapt only foam to the cavity; item dimensions and pocket XY stay unchanged.
// Work in local half coordinates, before the lid hinge transform.
function fitFoam3(m, data, zone, top, draw) {
  const grid = data?.cavity?.[zone];
  if (!grid) { draw(); return; }
  const vertex = m.v, triangle = m.tri;
  const floor = p => top - cavityDepth3(grid, p[0] - data.L/2,
    (zone === "lid" ? data.W-p[1] : p[1]) + data.zmin);
  const emit = (a,b,c) => {
    // Subdivide in XY only: vertical pocket walls retain their depth.
    const edges = [[a,b,c],[b,c,a],[c,a,b]];
    let longest = edges[0], length = 0;
    for (const e of edges) {
      const l = (e[0][0]-e[1][0])**2 + (e[0][1]-e[1][1])**2;
      if (l > length) { length = l; longest = e; }
    }
    // Retain large planar patches; refine only where the cavity bends.
    const fittedZ = p => Math.max(p[2],floor(p));
    const bends = () => {
      if(data.cavityRefinement){
        const center=a.map((v,i)=>(v+b[i]+c[i])/3);
        if(Math.abs(fittedZ(center)-(fittedZ(a)+fittedZ(b)+fittedZ(c))/3)>0.1)return true;
      }
      return edges.some(([p,q]) => {
      const mid = p.map((v,i)=>(v+q[i])/2);
      return Math.abs(fittedZ(mid)-(fittedZ(p)+fittedZ(q))/2) > 0.1;
      });
    };
    if (length > (data.cavityRefinement ? 1 : 9) && !(a[2] >= top && b[2] >= top && c[2] >= top) &&
        (length > 256 || bends())) {
      const [p,q,r] = longest, mid = p.map((v,i)=>(v+q[i])/2);
      emit(p,mid,r); emit(mid,q,r); return;
    }
    const map = p => vertex(p[0],p[1],Math.max(p[2],floor(p)));
    triangle(map(a),map(b),map(c));
  };
  m.v = (x,y,z) => [x,y,z];
  m.tri = emit;
  try { draw(); } finally { m.v = vertex; m.tri = triangle; }
}
