"""Build the CC0 MakeHuman interaction character with Blender 4.3 + MPFB.

blender --background --python tools/build_interaction_human.py -- MPFB_SOURCE ASSETS_DIR
The source asset pack and Blender are build-time tools, not app dependencies.
"""
import sys, json, math
from pathlib import Path
import bpy
from mathutils import Vector

mpfb_source, asset_dir = map(Path,sys.argv[sys.argv.index('--')+1:][:2])
sys.path.insert(0,str(mpfb_source/'src'))
# Source checkout used as a build dependency instead of an installed extension.
bpy.utils.extension_path_user=lambda package, path='', create=False: str(asset_dir.parent/'mpfb-user'/path)
import mpfb
bpy.context.preferences.addons.new().module='mpfb'
mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
from mpfb.services.exportservice import ExportService

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict()
macro.update(gender=1.0,age=.42,muscle=.45,weight=.48)
macro['race']={'caucasian':1.0,'african':0.0,'asian':0.0}
human=HumanService.create_human(macro_detail_dict=macro)
def asset(name):
    found=list(asset_dir.rglob(name))
    assert len(found)==1,(name,found)
    return str(found[0])
HumanService.set_character_skin(asset('middleage_caucasian_male.mhmat'),human,skin_type='GAMEENGINE')
rig=HumanService.add_builtin_rig(human,'game_engine')
rig.name='Human180'
for name,kind in [('low-poly.mhclo','Eyes'),('eyebrow001.mhclo','Eyebrows'),('short01.mhclo','Hair'),('male_casualsuit04.mhclo','Clothes'),('shoes02.mhclo','Clothes')]:
    HumanService.add_mhclo_asset(asset(name),human,asset_type=kind,subdiv_levels=0,material_type='GAMEENGINE',import_subrig=False)
# Bake the selected body proportions and the clothing's hidden-body masks.
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    bpy.context.view_layer.objects.active=obj
    if obj.data.shape_keys:
        bpy.ops.object.shape_key_add(from_mix=True)
        for key in list(obj.data.shape_keys.key_blocks)[:-1]:obj.shape_key_remove(key)
        obj.shape_key_clear()
    for modifier in list(obj.modifiers):
        if modifier.type=='MASK':bpy.ops.object.modifier_apply(modifier=modifier.name)
        elif modifier.type=='SUBSURF':obj.modifiers.remove(modifier)
    for polygon in obj.data.polygons:polygon.use_smooth=True
    for material in obj.data.materials:
        if not material or not material.use_nodes:continue
        for node in material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                node.inputs['Roughness'].default_value=.85
                node.inputs['Metallic'].default_value=0
for image in bpy.data.images:
    if image.size[0]>2048 or image.size[1]>2048:
        ratio=2048/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
    if image.source=='FILE':image.pack()
root=Path(__file__).resolve().parents[1]
out=root/'assets/human/interaction';out.mkdir(parents=True,exist_ok=True)
print('BONES',[(b.name,list(b.head_local),list(b.tail_local)) for b in rig.data.bones],flush=True)
print('MESHES',[(o.name,len(o.data.vertices)) for o in bpy.context.scene.objects if o.type=='MESH'],flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(asset_dir.parent/'interaction-human.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'human.glb'),export_format='GLB',export_animations=False,export_morph=False)
print('EXPORTED',out/'human.glb',flush=True)
