# StageCut — User Guide

The basic workflow: **build the set → block the action → light it → set cameras → cut the scene → play & export.**

## 1. Build the set

1. Open the **Architecture** tab in the left library panel.
2. Drag a **Floor** into the viewport (or click-drag to size it).
3. Drag **Wall** pieces onto the floor. They snap to the grid; use corner and T-junction pieces to close a room.
   - Wall pieces come pre-cut with **door** or **window** openings — pick the piece you need.
   - Use a **cutaway backer** wall where the camera looks "through" a wall that won't be shot.
4. Add a **ceiling** only if a shot needs it (it can block the editing camera — toggle visibility).

## 2. Block the action

1. From the **Figures** tab, drag a **standing figure** and a **seated figure** into the scene.
2. Move with the gizmo; rotate with Y-snap (15°/45°/90°). All objects snap to the floor.
3. To seat a figure: drop it on or near a chair — it snaps to the seat point and aligns with the chair. Or select the figure and click **Sit → pick chair**.
4. Scale presets: adult / child. Heights follow real-world scale (adult ≈ 1.75 m standing, ≈ 1.1 m seated eye height).
5. Add **props** (chairs, tables, sofa, lamp…) the same way. Colour overrides in the inspector.

## 3. Light it

- Add lights from the **Lighting** tab: sun (directional), practicals (point), spots.
- Or apply a **lighting preset** (Day interior, Night practicals, Low-key…).
- Practical lamps get a visible glow indicator so coverage reads correctly.

## 4. Set the cameras

1. In the **Cameras** panel, click **Add Camera** — or use a preset (Wide / Medium / Close).
2. Position each camera like any object, or use **View through camera** to frame it directly (then "lock framing from current view").
3. Set lens (12–135 mm), sensor, aspect ratio. Each camera has its own colour; frustums show in the viewport in Layout mode.
4. Toggle overlays: thirds, safe action, letterbox mask, camera label.

## 5. Cut the scene

1. In the bottom **Shot Strip**, click **Add Shot**. Pick a camera and a duration.
2. Repeat for each setup, e.g.:

   | Shot | Camera | In–Out | Cut |
   | --- | --- | --- | --- |
   | 1 | Wide | 0:00–0:04 | — |
   | 2 | A | 0:04–0:09 | Hard |
   | 3 | B | 0:09–0:12 | Hard |
   | 4 | A (close) | 0:12–0:15 | Dissolve |

3. Reorder shots by drag-and-drop; thumbnails are captured from each camera automatically.
4. Press **▶ Play Scene** — the viewport plays through the shots, cutting between cameras, with a camera label + timecode overlay. Scrub with the timeline; cut types: hard, dissolve, fade.

## 6. Views

- **Layout** — orbit freely, edit everything, see all frustums.
- **Plan** — top-down orthographic floor plan with camera coverage cones.
- **Camera** — look through one selected camera with framing overlays.
- **Playback** — the cut sequence, minimal UI.

## 7. Save & export

- **Autosave** runs continuously; projects live in your browser (IndexedDB).
- **Export** → project JSON (backup/transfer), per-shot PNG stills, shot-list CSV, GLB scene export.

## 8. Import extra props

- **Library → Import**: upload a local `.glb`/`.gltf`, or paste a URL from poly.pizza / polyfork.dev / polyhaven.com (fetched via the import service, subject to their licenses — attribution is stored with your project).
