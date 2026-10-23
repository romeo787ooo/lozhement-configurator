"""Convert the supplied 4035 assembly to the existing browser mesh format.

Requires cadquery-ocp==7.8.1.1.post1 and numpy.
Usage: python tools/convert_4035.py input.STEP
The source file is never modified.
"""
import base64
import json
import sys
from pathlib import Path
import numpy as np
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.TopLoc import TopLoc_Location
from inspect_step import read_parts
from foam_cavity import cavity_grid


def triangles(shape):
    BRepMesh_IncrementalMesh(shape, 0.3, False, 0.35, True)
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    vertices, faces = [], []
    while exp.More():
        face = TopoDS.Face_s(exp.Current())
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is not None:
            offset = len(vertices)
            for i in range(1, tri.NbNodes() + 1):
                p = tri.Node(i).Transformed(loc.Transformation())
                # Source Z points down. Renderer format: X length, Y up, Z width.
                vertices.append([p.X(), -p.Z(), p.Y()])
            for i in range(1, tri.NbTriangles() + 1):
                ids = list(tri.Triangle(i).Get())
                if face.Orientation() == TopAbs_REVERSED:
                    ids.reverse()
                faces.append([offset + n - 1 for n in ids])
        exp.Next()
    return np.asarray(vertices), np.asarray(faces)


def main(path):
    parts = read_parts(path)
    if len(parts) != 19:
        raise ValueError("Unexpected assembly: review part selection before conversion")
    # Verified by assembly names, hierarchy and bounds in this supplied STEP.
    excluded = {0: "lid insert", 15: "base insert", 16: "cylinder"}
    lid_parts = {7, 11, 17}  # Upper latch mounts and lid shell.
    grouped = {"base": [], "lid": []}
    manifest = []
    for i, (names, shape, bounds) in enumerate(parts):
        group = "excluded" if i in excluded else "lid" if i in lid_parts else "base"
        manifest.append(dict(index=i, names=names, group=group,
                             reason=excluded.get(i), bounds=list(bounds)))
        if group != "excluded":
            grouped[group].append(triangles(shape))
    result = {}
    arrays = {}
    cavities = {}
    step = 0.01
    for group, meshes in grouped.items():
        verts, faces, count = [], [], 0
        for v, f in meshes:
            verts.append(v)
            faces.append(f + count)
            count += len(v)
        v = np.concatenate(verts)
        f = np.concatenate(faces)
        v, inverse = np.unique(np.round(v, 5), axis=0, return_inverse=True)
        f = inverse[f]
        cavities["body" if group == "base" else "lid"] = cavity_grid(v, f, -1 if group == "base" else 1)
        origin = v.min(axis=0)
        quant = np.rint((v - origin) / step)
        if quant.max() > 65535:
            raise ValueError("Quantization overflow")
        small = len(v) <= 65535
        arrays[group] = v
        result[group] = dict(o=origin.tolist(), w16=small,
                             v=base64.b64encode(quant.astype("<u2").tobytes()).decode(),
                             i=base64.b64encode(f.astype("<u2" if small else "<u4").tobytes()).decode())
        print(group, "vertices", len(v), "triangles", len(f), "bounds", v.min(0), v.max(0))
    all_v = np.concatenate(list(arrays.values()))
    lo, hi = all_v.min(0), all_v.max(0)
    result.update(L=float(hi[0]-lo[0]), W=float(hi[2]-lo[2]), s=step,
                  cavity=cavities,
                  ymin_b=float(arrays["base"][:, 1].min()),
                  ymax_l=float(arrays["lid"][:, 1].max()),
                  zmin=float(lo[2]), zmax=float(hi[2]), hinge=1,
                  ax=dict(off=float(hi[2]-171.75), y=0))
    out = Path(__file__).resolve().parents[1]
    (out/"js/data/case-mesh-4035.js").write_text(
        '"use strict";\n// Derived from user-supplied STEP; inserts and cylinder excluded.\n'
        'CASE_MESH["4035"] = '+json.dumps(result, separators=(",", ":"))+';\n', encoding="utf-8")
    (out/"tools/4035-parts.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
