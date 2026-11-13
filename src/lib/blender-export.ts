import { validateCinemaProject, type CinemaProject } from './cinema-project'

/** Embedded JSON is data, never interpolated Python instructions. No network, render or overwrite. */
export function exportBlenderScript(project: CinemaProject): string {
  const validated = validateCinemaProject(project)
  // Escape Unicode in the inner JSON first. Python then hands intact JSON escapes to json.loads,
  // including surrogate pairs, quotes, newlines and adversarial triple-quote strings.
  const asciiJson = JSON.stringify(validated).replace(/[\u007f-\uffff]/g, char =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
  const literal = JSON.stringify(asciiJson)
  return `# SUTRA — editable camera/timing previsualization, schema 1
# Open in Blender > Scripting > Run Script. A NEW scene is created; existing scenes remain.
# Geometry is generic blocking, not generated from the prompts. Transitions preview as cuts.
# No provider call, network request, rendering, payment, or automatic save occurs.
# Optional CLI: blender -b --python sutra-cinema.blender.py -- --sutra-output NEW_FILE.blend
import argparse
import json
from pathlib import Path
import sys
import bpy
import bmesh
from mathutils import Vector

PROJECT_JSON = ${literal}
PROJECT = json.loads(PROJECT_JSON)

def make_material(name, color, roughness=0.65, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1.0)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return material

def mesh_object(name, kind, location, scale, material, collection):
    mesh = bpy.data.meshes.new(name + '_mesh')
    working = bmesh.new()
    if kind == 'sphere':
        bmesh.ops.create_uvsphere(working, u_segments=20, v_segments=12, radius=1.0)
    elif kind == 'cylinder':
        bmesh.ops.create_cone(working, cap_ends=True, cap_tris=False,
                             segments=20, radius1=1.0, radius2=1.0, depth=2.0)
    else:
        bmesh.ops.create_cube(working, size=2.0)
    working.to_mesh(mesh)
    working.free()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    obj.scale = scale
    mesh.materials.append(material)
    if kind != 'cube':
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    obj['sutra_role'] = 'editable_placeholder'
    return obj

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def mannequin(name, position, material, collection):
    root = bpy.data.objects.new(name, None)
    collection.objects.link(root)
    root.location = position
    root['sutra_role'] = 'character_blocking'
    parts = [
        ('body', 'cylinder', (0, 0, 1.05), (0.26, 0.19, 0.43)),
        ('head', 'sphere', (0, 0, 1.77), (0.20, 0.20, 0.23)),
        ('left_leg', 'cylinder', (-0.14, 0, 0.35), (0.10, 0.10, 0.35)),
        ('right_leg', 'cylinder', (0.14, 0, 0.35), (0.10, 0.10, 0.35)),
        ('left_arm', 'cylinder', (-0.38, 0, 1.04), (0.08, 0.08, 0.35)),
        ('right_arm', 'cylinder', (0.38, 0, 1.04), (0.08, 0.08, 0.35)),
    ]
    for suffix, kind, location, scale in parts:
        part = mesh_object(name + '_' + suffix, kind, location, scale, material, collection)
        part.parent = root
    return root

scene = bpy.data.scenes.new('SUTRA | ' + PROJECT['title'][:48])
scene['sutra_schema_version'] = PROJECT['schemaVersion']
scene['sutra_production_status'] = 'previsualization'
scene['sutra_manifest_json'] = PROJECT_JSON
scene['sutra_fps_numerator'] = PROJECT['fps']['numerator']
scene['sutra_fps_denominator'] = PROJECT['fps']['denominator']
scene['sutra_blender_version'] = bpy.app.version_string
scene['sutra_transition_preview'] = 'cut'
scene['sutra_audio_status'] = 'not_prepared'

blocking = bpy.data.collections.new('SUTRA | Blocking')
cameras = bpy.data.collections.new('SUTRA | Cameras')
lighting = bpy.data.collections.new('SUTRA | Lighting')
for collection in (blocking, cameras, lighting):
    scene.collection.children.link(collection)

floor_mat = make_material('SUTRA | Ground', (0.12, 0.16, 0.19))
building_mat = make_material('SUTRA | Set', (0.24, 0.30, 0.34))
actor_a_mat = make_material('SUTRA | Actor A', (0.12, 0.46, 0.60), roughness=0.42)
actor_b_mat = make_material('SUTRA | Actor B', (0.80, 0.33, 0.13), roughness=0.42)
prop_mat = make_material('SUTRA | Prop', (0.95, 0.67, 0.18), roughness=0.25, metallic=0.2)
mesh_object('Ground', 'cube', (0, 0, -0.12), (18, 18, 0.10), floor_mat, blocking)
for index, (x, y, height) in enumerate([(-5, 6, 3), (-1.5, 7, 5), (3, 7, 4), (7, 5, 6), (-8, 2, 4)]):
    mesh_object('Set_' + str(index + 1), 'cube', (x, y, height / 2), (1.25, 1.0, height / 2), building_mat, blocking)
mannequin('Actor_A', (-0.95, 0, 0), actor_a_mat, blocking)
mannequin('Actor_B', (0.95, 0.3, 0), actor_b_mat, blocking)
mesh_object('Shared_prop', 'cube', (0, -0.15, 0.95), (0.15, 0.15, 0.15), prop_mat, blocking)

world = bpy.data.worlds.new('SUTRA | World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.18, 0.23, 0.30, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
scene.world = world
for name, position, energy, size, color in [
    ('Key', (-4, -4, 7), 1800, 5, (1.0, 0.82, 0.66)),
    ('Fill', (5, -1, 4), 1000, 4, (0.63, 0.78, 1.0)),
    ('Rim', (1, 5, 6), 2200, 3, (1.0, 0.91, 0.74)),
]:
    data = bpy.data.lights.new('SUTRA | ' + name, 'AREA')
    data.energy, data.size, data.color = energy, size, color
    obj = bpy.data.objects.new('SUTRA | ' + name, data)
    lighting.objects.link(obj)
    obj.location = position
    aim(obj, (0, 0, 1))

# Reusable framing examples. These are intentional blocking presets, not prompt interpretation.
presets = [
    ((7.5, -11, 5.5), (0, 0.5, 1.0), 40),
    ((-4.3, -5.5, 2.5), (-0.4, 0.1, 1.1), 50),
    ((0.4, -2.1, 1.4), (0, -0.15, 0.95), 65),
    ((3.8, -4.8, 2.6), (0.3, 0.1, 1.2), 55),
    ((-1.0, -3.4, 2.0), (0.7, 0.2, 1.45), 65),
    ((5.5, -8.0, 10.0), (0, 0.5, 0.9), 35),
]
first_camera = None
for index, shot in enumerate(PROJECT['scenes']):
    position, target, lens = presets[index % len(presets)]
    data = bpy.data.cameras.new('SUTRA | Camera ' + str(index + 1))
    data.lens = lens
    data.clip_start, data.clip_end = 0.05, 300
    camera = bpy.data.objects.new('Plan_%02d' % (index + 1), data)
    cameras.objects.link(camera)
    camera['sutra_scene_id'] = shot['id']
    camera['sutra_visual_prompt'] = shot['visual_prompt']
    camera['sutra_description'] = shot['description']
    camera['sutra_requested_transition'] = shot['transition']
    camera['sutra_preview_transition'] = 'cut'
    camera['sutra_duration_frames'] = shot['timeline']['durationFrames']
    start = shot['timeline']['startFrame'] + 1
    end = shot['timeline']['endFrameExclusive']
    camera.location = position
    aim(camera, target)
    camera.keyframe_insert(data_path='location', frame=start)
    camera.keyframe_insert(data_path='rotation_euler', frame=start)
    if end > start:
        camera.location = Vector(position).lerp(Vector(target), 0.06)
        aim(camera, target)
        camera.keyframe_insert(data_path='location', frame=end)
        camera.keyframe_insert(data_path='rotation_euler', frame=end)
    marker = scene.timeline_markers.new('Plan_%02d | ' % (index + 1) + shot['id'][:32], frame=start)
    marker.camera = camera
    if first_camera is None:
        first_camera = camera

scene.camera = first_camera
scene.frame_start = 1
scene.frame_end = PROJECT['timeline']['totalFrames']
nominal_fps = round(PROJECT['fps']['numerator'] / PROJECT['fps']['denominator'])
scene.render.fps = nominal_fps
scene.render.fps_base = nominal_fps * PROJECT['fps']['denominator'] / PROJECT['fps']['numerator']
width, height = {'16:9': (960, 540), '9:16': (540, 960), '1:1': (720, 720)}[PROJECT['format']]
scene.render.resolution_x, scene.render.resolution_y = width, height
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.device = 'CPU'
# Some Blender distributions omit OpenImageDenoise; this lightweight preview must still render.
scene.cycles.use_denoising = False
scene.cycles.use_preview_denoising = False
scene.view_settings.view_transform = 'AgX'
scene['sutra_color_view'] = scene.view_settings.view_transform
scene.frame_set(1)

manifest = bpy.data.texts.new('SUTRA_PROJECT.json')
manifest.write(json.dumps(PROJECT, ensure_ascii=False, indent=2))
scene['sutra_manifest_text'] = manifest.name
readme = bpy.data.texts.new('SUTRA_README.txt')
readme.write('SUTRA — PREVISUALISATION EDITABLE\\n\\n'
             'Les volumes sont des reperes generiques. Remplace-les par tes decors et personnages.\\n'
             'Les cameras, marqueurs et durees sont editables. Les transitions sont des coupes de previsualisation.\\n'
             'Le manifeste conserve les transitions demandees et les instructions visuelles.\\n'
             'Aucun media, dialogue, musique ou resultat Higgsfield n a ete genere.\\n'
             'Enregistre ce fichier avec Fichier > Enregistrer sous. Chaque execution cree une nouvelle scene.\\n')
scene['sutra_readme_text'] = readme.name
if bpy.context.window is not None:
    bpy.context.window.scene = scene

# Saving is possible only through an explicit CLI argument and refuses any existing file.
if '--' in sys.argv:
    parser = argparse.ArgumentParser(description='Save a new SUTRA previsualization')
    parser.add_argument('--sutra-output')
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if options.sutra_output:
        output = Path(options.sutra_output).expanduser().resolve()
        if output.suffix.lower() != '.blend':
            raise ValueError('The output must use the .blend extension')
        if output.exists():
            raise FileExistsError('Refusing to overwrite an existing Blender file')
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=True)

print('SUTRA_PREVIS ' + json.dumps({
    'scene': scene.name, 'frames': scene.frame_end, 'cameras': len(PROJECT['scenes']),
    'status': 'previsualization', 'blender': bpy.app.version_string,
}))
`
}
