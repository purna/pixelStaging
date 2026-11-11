"""
Procedural stairs for Blender.

Run from Blender's Text Editor or:
  blender --background --python Art/procedural/stairs.py
"""
import bpy

# ---- settings -------------------------------------------------------------
STEPS = 6
STEP_HEIGHT = 0.18
STEP_DEPTH = 0.3
WIDTH = 1.2
OUTPUT = "//stairs.blend"
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

material = bpy.data.materials.get("StairMaterial") or bpy.data.materials.new("StairMaterial")
material.diffuse_color = (0.69, 0.72, 0.74, 1.0)

steps = max(1, int(STEPS))
for index in range(steps):
    height = STEP_HEIGHT * (index + 1)
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(0, -index * STEP_DEPTH - STEP_DEPTH / 2, height / 2)
    )
    obj = bpy.context.object
    obj.name = f"Step_{index + 1:02d}"
    obj.scale = (WIDTH, STEP_DEPTH, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)

bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(OUTPUT))
