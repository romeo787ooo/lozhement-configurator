"""Repack embedded textures without modifying skeleton, mesh or animations."""
import io,json,struct
from pathlib import Path
from PIL import Image

path=Path(__file__).resolve().parents[1]/'assets/human/interaction/human.glb'
raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
images={im['bufferView']:im for im in doc['images']}
new=bytearray()
for index,view in enumerate(doc['bufferViews']):
    data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    if index in images:
        im=images[index];picture=Image.open(io.BytesIO(data));out=io.BytesIO()
        transparent=any(key in im.get('name','').lower() for key in ['hair','short','eyebrow'])
        if transparent:
            picture.thumbnail((1024,1024));picture.save(out,format='PNG',optimize=True);im['mimeType']='image/png'
        else:
            picture.convert('RGB').save(out,format='JPEG',quality=87,optimize=True);im['mimeType']='image/jpeg'
        data=out.getvalue()
    new.extend(b'\0'*((-len(new))%4));view['byteOffset']=len(new);view['byteLength']=len(data);new.extend(data)
new.extend(b'\0'*((-len(new))%4));doc['buffers'][0]['byteLength']=len(new)
metadata=json.dumps(doc,separators=(',',':')).encode();metadata+=b' '*((-len(metadata))%4)
path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(metadata)+len(new))+struct.pack('<II',len(metadata),0x4e4f534a)+metadata+struct.pack('<II',len(new),0x004e4942)+new)
print('GLB bytes:',len(raw),'->',path.stat().st_size)
