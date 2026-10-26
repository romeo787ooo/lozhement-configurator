"""Extract only the verified contents from user-supplied assemblies, in mm.
Usage: python tools/export_item_samples.py battery-assembly.STEP cylinder-assembly.STEP
"""
import sys, struct, json
from pathlib import Path
import numpy as np
from inspect_step import read_parts
from convert_4035 import triangles

out=Path(__file__).resolve().parents[1]/'assets/items'
out.mkdir(exist_ok=True)
manifest=[]
for source,index,count,name in [(sys.argv[1],46,48,'battery'),(sys.argv[2],16,19,'cylinder')]:
    parts=read_parts(source)
    if len(parts)!=count:raise ValueError('Unexpected assembly; verify part indices')
    names,shape,bounds=parts[index]
    v,f=triangles(shape);v-=v.min(axis=0)
    v,inverse=np.unique(np.round(v,5),axis=0,return_inverse=True);f=inverse[f]
    if name=='battery':
        lines=['# User supplied battery; millimetres']
        lines.extend('v %.5f %.5f %.5f'%tuple(p) for p in v)
        lines.extend('f %d %d %d'%tuple(t+1) for t in f)
        (out/(name+'.obj')).write_text('\n'.join(lines),encoding='utf-8')
    else:
        data=bytearray(b'User supplied cylinder; millimetres'.ljust(80,b'\0'))+struct.pack('<I',len(f))
        for t in f:data+=struct.pack('<12fH',0,0,0,*v[t].flatten(),0)
        (out/(name+'.stl')).write_bytes(data)
    manifest.append(dict(file=name+('.obj' if name=='battery' else '.stl'),source=Path(source).name,part=index,triangles=len(f),dimensions=v.max(0).tolist()))
    print(name,len(f),v.max(0),flush=True)
(out/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
