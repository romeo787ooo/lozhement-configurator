"""Record component triangle ranges in the existing 5040 mesh (no model duplication)."""
import sys, json, base64
from pathlib import Path
import numpy as np
from inspect_step import read_parts
from convert_4035 import triangles

root = Path(__file__).resolve().parents[1]
data = json.loads((root/'js/data/case-mesh-5040.js').read_text().split(' = ',1)[1].strip().rstrip(';'))
parts = read_parts(sys.argv[1])
assert len(parts) == 48
base = data['base']
positions = np.frombuffer(base64.b64decode(base['v']),dtype='<u2').reshape(-1,3)*data['s']+base['o']
indices = np.frombuffer(base64.b64decode(base['i']),dtype='<u2' if base['w16'] else '<u4')
ranges = {}
for i, (_, shape, _) in enumerate(parts):
    if i not in {1,7,8,9,13,43,44}: continue
    v, f = triangles(shape)
    v = v[:,[0,2,1]]*np.array([1,1,-1])
    # Parallel CAD tessellation can change triangle counts. Components remain
    # contiguous in the shipped index buffer; locate their complete CAD envelope.
    inside=np.all((positions>=v.min(0)-.03)&(positions<=v.max(0)+.03),axis=1)
    mask=np.all(inside[indices.reshape(-1,3)],axis=1)
    edges=np.diff(np.r_[False,mask,False].astype(int))
    starts=np.flatnonzero(edges==1);ends=np.flatnonzero(edges==-1)
    n=np.argmax(ends-starts); start=int(starts[n]); count=int(ends[n]-start)
    assert abs(count-len(f))/len(f)<.02, (i,'Component mapping requires review')
    ranges[str(i)]=[start*3,count*3]
    print(i,count,'triangles',flush=True)
target=root/'assets/cases/5040-interaction.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps({'indexCount':len(indices),'ranges':ranges},separators=(',',':')))
print('Verified component ranges:',len(ranges))
