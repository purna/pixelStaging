# StageCut — Product Specification

## 1. What it is

A browser-based **staging tool for setting out a movie scene**. Users block a scene — set, figures, props, light — then plan coverage with **multiple cameras** and a **shot sequence with cuts**, previewed in real time.

**What it is not:** a 3D creation/modelling tool. No vertex editing, no sculpting, no material authoring, no UV work. Placement-only: move, rotate, scale presets.

## 2. Target users

Director, DP, 1st AD, storyboard artist, film student — anyone who wants to communicate blocking and coverage before shoot day.

## 3. Core principles

- **Shot thinking everywhere.** Every object exists to be read through a camera.
- **Placement, not modelling.** Everything is a preset that can be positioned, rotated, scaled, coloured.
- **Fast > pretty.** Draft-quality visuals, instant feedback, generous presets.
- **Film vocabulary.** UI uses Scene / Shot / Camera / Block / Coverage / Practical / Frame.

## 4. Feature set

### 4.1 Scene viewport
- Orbit / pan / dolly editing camera (separate from movie cameras).
- Ground plane + grid, units in metres (feet display toggle).
- Modes: **Layout** (edit, all frustums visible), **Plan** (top-down orthographic floor plan with camera coverage cones), **Camera** (view through one virtual camera), **Playback** (shot sequence with cuts).
- Selection, move/rotate/scale gizmos, grid snapping (0.1/0.25/0.5/1 m, rotation 15°/45°/90°).

### 4.2 Basic shapes
Cube, plane, cylinder, cone, sphere, torus, staircase, platform/dais, ramp.

### 4.3 Figures
- **Standing figure** (neutral pose), **seated figure**, walking pose, child scale.
- Human-scale presets: adult standing ≈ 1.75 m, seated eye height ≈ 1.1 m, child ≈ 1.2 m.
- **Chair-aware seating:** dropping a seated figure on a chair snaps it to the seat point and aligns to the chair's rotation.
- Height markers / eye-line guides on request.

### 4.4 Architecture
Floor (click-drag to size), wall segment (length/height/thickness, snap-to-grid, corner + T-junction variants), **cutaway backer wall** (one-sided for filming through), doorway, window, ceiling, stairs, platform, railing.
- MVP approach: pre-built wall pieces with pre-cut openings for doors/windows; no CSG.

### 4.5 Light sources
- Types: directional (sun), ambient/hemisphere, point practical, spot, area approximation.
- Controls: colour temperature, intensity, shadows on/off, snap to ceiling, aim-at-figure.
- **Lighting presets:** daylight interior, overcast window, night practicals, low-key thriller, high-key comedy, single warm source.
- Practical indicators (glowing icons at lamp positions).

### 4.6 Basic props (built-in library)
Chair, stool, table (small/large), desk, sofa, bed, bookshelf, dresser, counter, TV, floor/table lamp, plant, rug, crate, box, barrel. Colour overrides; snap-to-floor/wall.

### 4.7 Asset import
- **Local file upload:** `.glb` / `.gltf`, drag-and-drop into the viewport.
- **Online libraries:** [poly.pizza](https://poly.pizza/), [polyfork.dev](https://polyfork.dev/), [polyhaven.com](https://polyhaven.com/) — via URL paste or search; fetched through a lightweight backend proxy (`/api/import?url=…`) to bypass CORS, cached locally.
- Asset metadata stored: source, license, attribution, tags, scale hint, thumbnail.
- License notices: attribution kept with project export; “verify license for production use.”

### 4.8 Camera management (core)
- Multiple named virtual cameras (A, B, C, Wide, Medium, Close…), each with its own colour-coded frustum in the viewport.
- Per camera: position, target/aim point, focal length (12–135 mm presets), sensor size (full frame / Super 35 / MFT), aspect (16:9, 2.39:1, 1.85:1, 4:3, 1:1), near/far clip, exposure.
- Overlays: aspect mask (letterbox), rule of thirds, centre crosshair, action/title safe areas, camera label + lens readout.
- One-click “view through camera”, thumbnail capture, show/hide/solo frustums.

### 4.9 Shot board & cuts (core)
- Shot list strip (bottom panel): each shot = camera + start/end time + cut type + notes + thumbnail.
- Cut types: hard cut, dissolve, fade to black.
- Drag to reorder; assign camera per shot; durations editable.
- **Playback:** viewport follows the active shot's camera, cuts fire on the timeline, camera label/timecode overlay, play/pause/scrub.
- Export: per-shot PNG stills, shot-list CSV.

### 4.10 Persistence
- Local-first: IndexedDB projects, autosave, export/import project JSON.

## 5. MVP scope (first working version)

Viewport with orbit + grid snapping · primitives · standing/seated figures with chair snap · walls/door/window/floor · chair+table props · basic lights · multiple cameras with frustums, lens/aspect presets and preview · shot board with playback cuts and thumbnails · save/load/autosave · PNG export from cameras.

Deferred: online asset import proxy, HDRI, video export, EDL/PDF export, collaboration, walk/lying pose animation.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Scope creep back into a 3D editor | Hard rule: presets + transforms only |
| CORS breaks online asset import | Backend proxy + local-upload fallback + caching |
| Performance with many objects | Low-poly presets, lazy loading, draft display mode, shadow caps |
| Door/window wall openings too complex | Pre-cut wall pieces first, CSG later |
| Cuts feel disconnected from editing | Frustums always visible in layout mode; thumbnails from camera previews |
