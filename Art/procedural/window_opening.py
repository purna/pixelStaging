"""
Procedural window-opening wall for Blender.

Run from Blender's Text Editor or:
  blender --background --python Art/procedural/window_opening.py
"""
import bpy

# ---- settings -------------------------------------------------------------
LENGTH = 6.0
HEIGHT = 2.7
THICKNESS = 0.15
COUNT = 1
WINDOW_WIDTH = 1.4
WINDOW_HEIGHT = 1.2
SILL_HEIGHT = 0.9
SPACING = 0.7
OUTPUT = "//window_opening.blend"
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

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


def build_window_wall():
    count = max(1, int(COUNT))
    remaining = max(0.0, LENGTH - count * WINDOW_WIDTH)
    gap = min(SPACING, remaining / (count + 1))
    cursor = -LENGTH / 2 + gap
    cuts = []
    for _ in range(count):
        cuts.append((cursor, cursor + WINDOW_WIDTH))
        cursor += WINDOW_WIDTH + gap

    wall_cursor = -LENGTH / 2
    for index, (left, right) in enumerate(cuts):
        panel_width = left - wall_cursor
        box(f"WallPanel_{index}", panel_width, HEIGHT, wall_cursor + panel_width / 2, HEIGHT / 2)
        box(f"WindowSill_{index}", WINDOW_WIDTH, SILL_HEIGHT, left + WINDOW_WIDTH / 2, SILL_HEIGHT / 2)
        top_height = HEIGHT - SILL_HEIGHT - WINDOW_HEIGHT
        box(f"WindowHeader_{index}", WINDOW_WIDTH, top_height, left + WINDOW_WIDTH / 2,
            SILL_HEIGHT + WINDOW_HEIGHT + top_height / 2)
        wall_cursor = right
    panel_width = LENGTH / 2 - wall_cursor
    box("WallPanel_End", panel_width, HEIGHT, wall_cursor + panel_width / 2, HEIGHT / 2)


build_window_wall()
bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(OUTPUT))
