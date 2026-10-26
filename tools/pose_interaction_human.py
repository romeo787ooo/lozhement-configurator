"""Bake four handle-specific poses and a neutral comparison pose into the CC0 GLB.
Run with Blender --background --python this-file -- /path/to/interaction-human.blend.
"""
import bpy,bmesh,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion

bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
rig=bpy.data.objects['Human180']
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# This outfit fully covers the lower body. Remove the remaining hidden skin
# around calves/ankles so it cannot emerge through trousers during deep bends.
body=bpy.data.objects['Human'];bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<.8],context='VERTS')
bm.to_mesh(body.data);bm.free()
# Shoes are rigid: calf weights in the stock asset otherwise pull the soles
# below the floor when the knees bend for the low side handle.
shoes=next(o for o in meshes if o.name.endswith('shoes02'))
bm=bmesh.new();bm.from_mesh(shoes.data)
# The stock shoes include a tall inner cuff hidden under straight trousers.
# Trim that hidden cuff for bent-knee poses; keep the actual shoe and sole.
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>.125],context='VERTS')
bm.to_mesh(shoes.data);bm.free()
shoes.vertex_groups.clear()
for suffix,positive in [('l',True),('r',False)]:
    group=shoes.vertex_groups.new(name='foot_'+suffix)
    group.add([v.index for v in shoes.data.vertices if (v.co.x>0)==positive],1.0,'REPLACE')
lo=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
hi=max((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
scale=1.8/(hi-lo);rig.scale=(scale,)*3;rig.location.z=-lo*scale
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=1
pb=rig.pose.bones
# A grasp reference belongs to the palm, not to an arbitrary wrist offset.
frames={}
for side,sign in [('l',1),('r',-1)]:
    bones=rig.data.bones;w=bones['hand_'+side].head_local.copy()
    f=(bones['middle_01_'+side].head_local-w).normalized()
    a=(bones['index_01_'+side].head_local-bones['pinky_01_'+side].head_local).normalized()
    n=(-sign*a.cross(f)).normalized();axis=f.cross(n).normalized()
    length=(bones['middle_01_'+side].head_local-w).length
    offset=f*length*.80+n*.022
    frames[side]=(f,n,axis,offset)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for side in ['l','r']:
    bone=rig.data.edit_bones.new('grip_'+side);bone.parent=rig.data.edit_bones['hand_'+side]
    bone.head=bone.parent.head+frames[side][3];bone.tail=bone.head+frames[side][1]*.015
bpy.ops.object.mode_set(mode='OBJECT');pb=rig.pose.bones

targets={}
def empty(name):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);return obj
for side in ['l','r']:
    targets['arm'+side]=empty('arm'+side)
    for limb,bone,count in [('leg','calf_',2),('thumb','thumb_03_',3)]:
        target=empty(limb+side);targets[limb+side]=target
        c=pb[bone+side].constraints.new('IK');c.target=target;c.chain_count=count;c.use_stretch=False
        pb[bone+side].ik_stretch=0
    for part in ['hand','foot']:
        target=empty(part+side);targets[part+side]=target;target.rotation_mode='QUATERNION'
        c=pb[part+'_'+side].constraints.new('COPY_ROTATION');c.target=target;c.target_space='WORLD';c.owner_space='WORLD'
        target.rotation_quaternion=rig.data.bones[part+'_'+side].matrix_local.to_quaternion()
rest_ankles={s:rig.matrix_world@rig.data.bones['foot_'+s].head_local for s in ['l','r']}
animations={};errors={};wrist_angles={}
for mode in ['one','two','roll','side','compare']:
    for bone in pb:bone.matrix_basis=Matrix.Identity(4)
    pelvis=rig.data.bones['pelvis'].matrix_local.copy()
    if mode=='side':pelvis.translation.z-=.15/scale
    pb['pelvis'].matrix=pelvis
    # Case centers are derived from the CAD handle crossbars (in metres).
    grips={'one':[(.410,0,.970)],'two':[(.24,-.02,.94),(-.410,0,.970)],
           'roll':[(.300,.080,.886524)],'side':[(.300,.080,.767977)],'compare':[(.24,-.02,.94)]}[mode]
    directions={}
    for side,sign in [('l',1),('r',-1)]:
        held=mode!='compare' and (side=='r' if mode=='two' else side=='l')
        grip=Vector(grips[0] if side=='l' else grips[1] if mode=='two' else (-.24,-.02,.94-(.08 if mode=='side' else 0)))
        if mode in ['roll','side'] and held:f=Vector((0,.2,-.9797959));n=Vector((0,.9797959,.2))
        else:f=Vector((sign*.1,0,-.9949874));n=Vector((-sign*.9949874,0,-.1))
        oldf,oldn,axis,offset=frames[side]
        old=Matrix((oldf.cross(oldn),oldf,oldn)).transposed()
        new=Matrix((f.cross(n),f,n)).transposed()
        rotation=new@old.transposed()
        directions[side]=f
        targets['hand'+side].rotation_quaternion=rotation.to_quaternion()@rig.data.bones['hand_'+side].matrix_local.to_quaternion()
        targets['arm'+side].location=grip-(rotation@offset)*scale
        targets['leg'+side].location=rest_ankles[side]
        targets['thumb'+side].location=grip-f*.018+n*.025
        for finger in ['index','middle','ring','pinky']:
            for j,angle in enumerate([.90,1.05,.90] if held else [.12,.18,.12],1):
                bone=pb[f'{finger}_{j:02d}_{side}'];bone.rotation_mode='QUATERNION'
                local_axis=bone.bone.matrix_local.to_3x3().inverted()@axis
                bone.rotation_quaternion=Quaternion(local_axis,angle)
        if not held:pb['thumb_03_'+side].constraints[0].influence=0
        else:pb['thumb_03_'+side].constraints[0].influence=1
    bpy.context.view_layer.update()
    # Solve the elbow on its reach circle. The pair uses mirrored single-hand
    # poses with separate people. Preserve the rig's flexion plane and
    # bone roll, so a reachable wrist cannot produce a backwards elbow.
    for side in ['l','r']:
        upper=pb['upperarm_'+side];lower=pb['lowerarm_'+side]
        shoulder=rig.matrix_world@upper.head;wrist=targets['arm'+side].location.copy()
        delta=wrist-shoulder;distance=delta.length;direction=delta.normalized()
        a=upper.length*scale;b=lower.length*scale
        assert distance<a+b,('Unreachable handle',mode,side,distance,a+b)
        along=(a*a-b*b+distance*distance)/(2*distance)
        center=shoulder+direction*along;radius=math.sqrt(max(0,a*a-along*along))
        # Keep the forearm aligned with the grasp direction.
        preferred=wrist-directions[side]*b-center
        radial=(preferred-direction*preferred.dot(direction)).normalized()
        elbow=center+radial*radius
        rest_u=upper.bone.tail_local-upper.bone.head_local
        rest_l=lower.bone.tail_local-lower.bone.head_local
        rest_normal=rest_u.cross(rest_l).normalized()
        bend_normal=(elbow-shoulder).cross(wrist-elbow).normalized()
        for bone,head,tail in [(upper,shoulder,elbow),(lower,elbow,wrist)]:
            current=rig.matrix_world@bone.matrix
            forward=(tail-head).normalized()
            rest_forward=(bone.bone.tail_local-bone.bone.head_local).normalized()
            source=Matrix((rest_forward.cross(rest_normal),rest_forward,rest_normal)).transposed()
            dest=Matrix((forward.cross(bend_normal),forward,bend_normal)).transposed()
            orientation=(dest@source.transposed()).to_quaternion()@bone.bone.matrix_local.to_quaternion()
            desired=Matrix.LocRotScale(head,orientation,Vector((scale,)*3))
            bone.matrix=rig.matrix_world.inverted()@desired
            bpy.context.view_layer.update()
    errors[mode]=[];wrist_angles[mode]=[]
    for side,sign in [('l',1),('r',-1)]:
        if mode=='compare' or (side=='l' if mode=='two' else side=='r'):continue
        point=rig.matrix_world@pb['grip_'+side].head
        desired=Vector(grips[0 if side=='l' else 1]);errors[mode].append((point-desired).length)
        forearm=(pb['lowerarm_'+side].tail-pb['lowerarm_'+side].head).normalized()
        f=pb['hand_'+side].matrix.to_quaternion()@rig.data.bones['hand_'+side].matrix_local.to_quaternion().inverted()@frames[side][0]
        wrist_angles[mode].append(math.degrees(forearm.angle(f)))
        assert wrist_angles[mode][-1]<30,('Excessive wrist bend',mode,side,wrist_angles[mode][-1])
    animations[mode]={b.name:b.matrix.copy() for b in pb}
for bone in pb:
    for c in list(bone.constraints):bone.constraints.remove(c)
    bone.rotation_mode='QUATERNION'
rig.animation_data_create()
for mode,matrices in animations.items():
    action=bpy.data.actions.new('carry_'+mode);action.use_fake_user=True;rig.animation_data.action=action
    # Two identical keys serialize a static pose reliably across glTF loaders.
    for frame in [0,1]:
        for bone in pb:
            rest=bone.bone.matrix_local
            basis=rest.inverted()@matrices[bone.name] if not bone.parent else rest.inverted()@bone.parent.bone.matrix_local@matrices[bone.parent.name].inverted()@matrices[bone.name]
            bone.matrix_basis=basis
            bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame)
    track=rig.animation_data.nla_tracks.new();track.name=action.name;track.strips.new(action.name,0,action);track.mute=True
rig.animation_data.action=None
for bone in pb:bone.matrix_basis=Matrix.Identity(4)
for obj in targets.values():bpy.data.objects.remove(obj,do_unlink=True)
# Opaque skin/clothes; alpha-cutout hair and brows avoid depth sorting artefacts.
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    for node in mat.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED' and not any(s in mat.name for s in ['short01','eyebrow']):
            for link in list(node.inputs['Alpha'].links):mat.node_tree.links.remove(link)
            node.inputs['Alpha'].default_value=1
out=Path(__file__).resolve().parents[1]/'assets/human/interaction'
bpy.ops.export_scene.gltf(filepath=str(out/'human.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_morph=False,export_force_sampling=True,export_frame_range=True)
(out/'build-info.json').write_text(json.dumps({'height':1.8,'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'gripErrorMeters':errors,'wristAnglesDegrees':wrist_angles,'poses':list(animations)},indent=2))
print('POSE_ERRORS',errors,'WRIST_ANGLES',wrist_angles,flush=True)
