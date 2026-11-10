# StageCut — Roadmap

Priority order reflects the product principle: **camera preview and shot cuts are the differentiator; fast placement is the daily value.**

## Phase 1 — Scene layout foundation (Week 1)
- [ ] Template audit: mark every pixel3d module keep / refactor / remove / extend (see Architecture doc)
- [ ] Remove/defer: keyframe animation, physics, particles, material layers, AI generator
- [ ] Object store + selection + transform gizmos wired to history manager
- [ ] Grid snapping (0.1/0.25/0.5/1 m; rotation 15°/45°/90°) and floor snap
- [ ] Primitives: cube, plane, cylinder, cone, sphere, torus, stairs, platform, ramp
- [ ] Floor preset with drag-to-size
- [ ] Autosave (IndexedDB) + project JSON save/load

## Phase 2 — Figures & props (Week 2)
- [ ] Standing figure (adult), seated figure, child scale — from characterManager assets
- [ ] Chair + table presets
- [ ] Chair-snap for seated figures (seat point + yaw from chair metadata)
- [ ] Object library panel with search; inspector: colour override, lock, hide, duplicate
- [ ] Pose selector: standing / seated / walking

## Phase 3 — Architecture (Week 3)
- [ ] Wall pieces: straight, corner, T-junction; length/height/thickness params
- [ ] Cutaway backer wall; interior/exterior variants
- [ ] Wall pieces with door / window openings; door + window objects
- [ ] Ceiling, stairs, platform, railing
- [ ] Wall-to-wall corner snapping
- [ ] Plan mode: top-down orthographic with camera coverage cones

## Phase 4 — Camera manager (Week 4) ⭐ core
- [ ] CameraRig model; add/duplicate/rename cameras
- [ ] Lens presets (12–135 mm), sensor presets, aspect presets
- [ ] Frustum rendering, colour-coded camera gizmos
- [ ] Camera preview mode with aspect mask + thirds/safe-area/label overlays
- [ ] "View through camera" / "lock framing from current view"
- [ ] Thumbnail capture per camera

## Phase 5 — Shot board & cuts (Week 5) ⭐ core
- [ ] Shot model, shot strip UI, camera binding, duration editing
- [ ] Reorder (drag), auto re-flow of timings
- [ ] Playback engine: getActiveShot(time) → render via rig camera
- [ ] Hard cut / dissolve (render-target blend) / fade
- [ ] Play / pause / scrub, camera label + timecode overlay
- [ ] Export per-shot PNGs + shot-list CSV

## Phase 6 — Lighting & import (Week 6)
- [ ] Light objects: sun, ambient/hemisphere, point, spot; shadows toggle
- [ ] Lighting presets (day interior, night practicals, low-key…)
- [ ] Practical lamp indicators; snap light to ceiling / aim at figure
- [ ] Local `.glb`/`.gltf` upload + drag-and-drop; asset library with tags/thumbnails
- [ ] Import proxy service for poly.pizza / polyfork.dev / polyhaven.com; license + attribution metadata

## Phase 7 — Polish (Week 7)
- [ ] Undo/redo coverage for all staging actions
- [ ] Display modes: draft / layout / preview
- [ ] Export GLB scene, floor-plan image
- [ ] UI labels in film vocabulary; dark viewport theme with bright frustum colours
- [ ] Documentation + tutorial refresh

## Later (post-MVP)
HDRI from Poly Haven · video export (WebM/MP4) · EDL/PDF/storyboard export · Sketchfab import · CSG wall openings · collaboration/cloud sync · AI scene generation (deferred pixel3d feature).
