"""Convert the verified user STEP assemblies 5040 and 7010 (millimetres).

Usage: python tools/convert_cases.py 5040 input.STEP [--cache DIRECTORY]
Cache is optional and contains BREP leaves and parts.json from inspection.
Never changes the input STEP. Part indices are specific to these assemblies.
"""
import argparse
import base64
import json
from pathlib import Path
import numpy as np
from OCP.BRep import BRep_Builder
from OCP.BRepTools import BRepTools
from OCP.TopoDS import TopoDS_Shape
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SHELL
from inspect_step import read_parts
from convert_4035 import triangles
from foam_cavity import cavity_grid

CONFIG = {
    '5040': dict(count=48, excluded={45:'base insert',46:'battery',47:'lid insert'},
                 lid={21,25,33,35,39}, wheels={43,44}, hinge=243.0),
    '7010': dict(count=21, excluded={19:'base insert',20:'cylinder'},
                 lid={1,3,18}, wheels={7,8}, hinge=266.0),
}


def convert(cid, source, cache=None):
    config=CONFIG[cid]
    if cache:
        parts=[]
        for i,p in enumerate(json.loads((cache/'parts.json').read_text())):
            shape=TopoDS_Shape()
            if not BRepTools.Read_s(shape,str(cache/f'{i}.brep'),BRep_Builder()):
                raise ValueError(f'Cannot load part {i}')
            parts.append((p['names'],shape,p['bounds']))
    else:
        parts=read_parts(source)
    if len(parts)!=config['count']:
        raise ValueError('Unexpected assembly; review component selection')
    grouped={'base':[],'lid':[]};manifest=[]
    for i,(names,shape,bounds) in enumerate(parts):
        reason=config['excluded'].get(i)
        group='excluded' if reason else 'lid' if i in config['lid'] else 'base'
        entry=dict(index=i,names=names,bounds=list(bounds),group=group,reason=reason)
        manifest.append(entry)
        if reason:continue
        if cid=='7010' and i==18:
            # This STEP leaf contains two shells, not solids: insert then case lid.
            shells=[];ex=TopExp_Explorer(shape,TopAbs_SHELL)
            while ex.More():shells.append(ex.Current());ex.Next()
            if len(shells)!=2:raise ValueError('Unexpected lid shell structure')
            shape=shells[1]
            entry['excludedShells']=[0];entry['reason']='lid insert shell removed; outer shell retained'
        v,f=triangles(shape)
        if cid=='5040':v=v[:,[0,2,1]]*np.array([1,1,-1])
        else:v[:,1]-=39  # split at source Z=-39, with Z pointing down
        grouped[group].append((v,f,i in config['wheels']))
        print(cid,i,group,len(f),'triangles',flush=True)
    result={};arrays={};cavities={};step=0.02
    for group,meshes in grouped.items():
        vv=[];ff=[];black=[];count=0
        for v,f,is_black in meshes:
            vv.append(v);ff.append(f+count)
            if is_black:black.extend(range(count,count+len(v)))
            count+=len(v)
        v=np.concatenate(vv);f=np.concatenate(ff)
        v,inverse=np.unique(np.round(v,5),axis=0,return_inverse=True);f=inverse[f]
        arrays[group]=v
        bounds=[v[:,[0,2]].min(0)-2,v[:,[0,2]].max(0)+2]
        cavities['body' if group=='base' else 'lid']=cavity_grid(v,f,-1 if group=='base' else 1,bounds=bounds,
            margin_cells=3 if cid=='7010' else 1)
        origin=v.min(0);quant=np.rint((v-origin)/step)
        if quant.max()>65535:raise ValueError('Quantization overflow')
        small=len(v)<=65535
        result[group]=dict(o=origin.tolist(),w16=small,
            v=base64.b64encode(quant.astype('<u2').tobytes()).decode(),
            i=base64.b64encode(f.astype('<u2' if small else '<u4').tobytes()).decode())
        if black:result[group]['blackVertices']=np.unique(inverse[black]).tolist()
        print(cid,group,len(v),'vertices',len(f),'triangles',flush=True)
    all_v=np.concatenate(list(arrays.values()));lo=all_v.min(0);hi=all_v.max(0)
    # Symmetric X envelope keeps the original cavity datum at the case centre,
    # including asymmetric wheels/handles without moving the foam sideways.
    result.update(L=float(2*np.abs(all_v[:,0]).max()),W=float(hi[2]-lo[2]),s=step,
        cavity=cavities,ymin_b=float(arrays['base'][:,1].min()),
        ymax_l=float(arrays['lid'][:,1].max()),zmin=float(lo[2]),zmax=float(hi[2]),
        hinge=1,ax=dict(off=float(hi[2]-config['hinge']),y=0))
    root=Path(__file__).resolve().parents[1]
    if cid=='7010':result['cavityRefinement']=True
    (root/f'js/data/case-mesh-{cid}.js').write_text(
        '"use strict";\n// User STEP: inserts and contents excluded; wheels black.\n'
        f'CASE_MESH["{cid}"] = '+json.dumps(result,separators=(',',':'))+';\n',encoding='utf-8')
    (root/f'tools/{cid}-parts.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('case',choices=CONFIG);parser.add_argument('source')
    parser.add_argument('--cache',type=Path)
    args=parser.parse_args();convert(args.case,args.source,args.cache)
