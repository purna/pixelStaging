"""
Procedural door-opening wall for Blender.

Run from Blender's Text Editor or:
  blender --background --python Art/procedural/door_opening.py

Adjust the settings below, run, then save the generated .blend.
"""
import bpy
import math

# ---- settings -------------------------------------------------------------
LENGTH = 6.0
HEIGHT = 2.7
THICKNESS = 0.15
COUNT = 1
DOOR_WIDTH = 1.0
DOOR_HEIGHT = 2.1
SPACING = 0.7
OUTPUT = "//door_opening.blend"
# ---------------------------------------------------------------------------

# Clean scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

collection = bpy.context.collection
material = bpy.data.materials.get("WallMaterial") or bpy.data.materials.new("WallMaterial")
material.diffuse_color = (0.81, 0.78, 0.72, 1.0)


def box(name, width, height, center_x, center_y):
    if width <= 0.001 or height <= 0.001:
        return
    bpy.ops.mesh.primitive_cube_add(size=1, location=(center_x, 0, center_y))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, THICKNESS, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)


def build_door_wall():
    count = max(1, int(COUNT))
    width_total = count * DOOR_WIDTH
    remaining = max(0.0, LENGTH - width_total)
    gap = min(SPACING, remaining / (count + 1))
    start = -LENGTH / 2 + gap
    cuts = []
    cursor = start
    for _ in range(count):
        cuts.append((cursor, cursor + DOOR_WIDTH))
        cursor += DOOR_WIDTH + gap

    wall_cursor = -LENGTH / 2
    for index, (left, right) in enumerate(cuts):
        panel_width = left - wall_cursor
        box(f"WallPanel_{index}", panel_width, HEIGHT, wall_cursor + panel_width / 2, HEIGHT / 2)
        top_height = HEIGHT - DOOR_HEIGHT
        box(f"DoorHeader_{index}", DOOR_WIDTH, top_height, left + DOOR_WIDTH / 2, DOOR_HEIGHT + top_height / 2)
        wall_cursor = right
    panel_width = LENGTH / 2 - wall_cursor
    box("WallPanel_End", panel_width, HEIGHT, wall_cursor + panel_width / 2, HEIGHT / 2)


build_door_wall()

# Save the generated file next to this script.
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(OUTPUT))
