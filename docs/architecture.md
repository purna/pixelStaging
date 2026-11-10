# StageCut — Architecture

## 1. Starting point: the pixel3d template

StageCut is built from [`pixel3d`](../../pixel3d) (`/Users/nigelmorris/Documents/GitHub/pixel3d`), reusing its stack and infrastructure rather than starting from scratch.

### What pixel3d provides (keep / refactor / remove / extend)

| pixel3d module | Decision | Notes |
| --- | --- | --- |
| `three@0.160` rendering, `esbuild` bundling, plain-JS module layout | **Keep** | Proven, minimal toolchain |
| Viewport, orbit/pan/dolly controls, grid & axes helpers, snap-to-grid | **Keep** | Editing camera stays as-is |
| Selection + transform gizmos (move/rotate/scale) | **Keep/extend** | Add rotate-snap presets, Y-lock option |
| `factory.js` (primitive creation) | **Extend** | Add figures, architecture pieces, props; keep simple colour/material overrides |
| `cameraManager.js` | **Refactor** | Becomes virtual movie-camera manager: multiple CameraRigs, frustum rendering, preview mode |
| `historyManager.js` (undo/redo) | **Keep** | Wire to new staging actions |
| `fileManager.js` (save/load JSON, GLB export, PNG export) | **Keep/extend** | Add project schema, shot-list CSV export, autosave via IndexedDB |
| `materialsManager.js`, `layerMaterial.js`, material layers/presets | **Remove/replace** | Single colour-override only |
| `animationManager.js`, `animationUI.js` (keyframes) | **Remove** | No keyframing in MVP; playback timeline is shot-based instead |
| `physicsManager.js` (`cannon-es`), `particleManager.js` (`three.quarks`) | **Remove** | Not needed for staging; drop dependencies |
| `characterManager.js` (Xbot/Ybot GLTF figures) | **Extend** | Basis for standing/seated/child figure presets with pose variants |
| `gemini.js` AI scene generator | **Defer** | Out of MVP; optionally keep behind settings later |
| `ui.js`, `icons.js`, `notifications.js`, `tooltip.js`, `tutorialSystem.js` | **Keep** | Re-skin for staging workflow, new panels |
| `layerManager.js` (folders) | **Keep** | Useful for organising set/actors/cameras |

## 2. Module layout (new `staging/` namespace)

```
js/
  appEntry.js          (existing)
  main.js              (existing; trim to staging workflow)
  staging/
    core/
      sceneManager.js       — scene graph, display modes (draft/layout/preview)
      objectStore.js        — StagingObject list, add/remove/duplicate
      selectionManager.js   — selection, gizmos, snapping
      snapping.js           — grid snap, floor snap, wall snap, chair snap
    cameras/
      cameraManager.js      — CameraRig CRUD, active/preview camera
      frustumRenderer.js    — colour-coded frustum cones + camera gizmos
      lensPresets.js        — focal lengths, sensors, aspect ratios
      framingOverlays.js    — thirds/safe-area/letterbox overlays
    shots/
      shotBoardStore.js    — Shot list, reorder, camera binding
      playbackEngine.js     — getActiveShot(time), render via shot camera
      transitionRenderer.js — hard/dissolve/fade
      frameCapture.js       — thumbnail + per-shot PNG capture
    objects/
      primitives.js         — cube/plane/cylinder/cone/sphere/torus/stairs/ramp
      figures.js            — standing/seated/walking/child presets
      architecture.js       — floor/walls/door/window/ceiling/cutaway
      props.js              — furniture & prop presets
    lighting/
      lightManager.js
      lightPresets.js       — day interior, night practicals, etc.
    assets/
      assetLibrary.js       — built-in + imported asset registry
      glbLoader.js          — local .glb/.gltf upload & drop
      importProxy.js        — client for /api/import (poly.pizza, polyfork, polyhaven)
    storage/
      projectPersistence.js — Project JSON schema, save/load
      indexedDB.js          — autosave, asset blobs, thumbnails
    exports/
      pngExporter.js        — per-camera/shot stills
      csvExporter.js        — shot list
      glbExporter.js        — (inherited from fileManager)
  ui.js                (existing; extended with new panels)
```

## 3. Key architectural decisions

### Editing camera vs movie cameras are separate
The orbit camera is purely an editor tool. Each `CameraRig` owns its own `THREE.PerspectiveCamera` plus a stored transform. Rendering switches between:

- **Layout mode** — render with the editing camera; frustums visible.
- **Camera mode** — render with one rig's camera; aspect mask + overlays.
- **Playback mode** — render with the active shot's rig per timeline; transitions composited.

```js
function renderPlaybackFrame(time) {
  const shot = shotBoardStore.getActiveShot(time);
  const rig  = cameraManager.get(shot.cameraId);
  renderer.render(scene, rig.camera);
}
```

### Dissolve/fade transitions
Render previous and next rig cameras to render targets, composite with an alpha blend quad; fade is a black overlay. Hard cut is an instant camera switch.

### No CSG for wall openings
Walls come as pre-built pieces: straight, corner, T-junction, with-doorway, with-window, cutaway backer. Doors/windows are separate preset objects placed in the openings. A dynamic CSG pass is a later enhancement.

### Chair-aware seating
When a seated figure is dropped (or the "sit" action is used), find the nearest chair under/within range, then set the figure's position to the chair's `seatPoint` (stored in `metadata.seat = { offset, height }`) and copy its yaw rotation.

## 4. Backend (minimal)

Only needed for online asset import. A tiny server (Node/Express or equivalent) exposing:

```
GET  /api/import?url=...      — validate domain allowlist (poly.pizza, polyfork.dev, polyhaven.com), download, cache, return asset URL + metadata
POST /api/assets/download     — persist an asset into the local library
```

Everything else runs fully client-side. Without the backend, the app still works with local GLB upload and the built-in library.

## 5. Rendering performance

- Low-poly preset geometry by default; imported assets flagged for shadow casting individually.
- Display modes: **draft** (flat colours, no shadows), **layout** (simple lighting), **preview** (shadows, better lighting).
- Lazy-load imported assets; thumbnails generated once and cached in IndexedDB.
- Repeated props can use instancing in a later pass.

## 6. State

Plain module-level stores (consistent with pixel3d's style), split by concern: `sceneStore`, `selectionManager`, `cameraManager`, `shotBoardStore`, `playbackEngine`, `assetLibrary`, UI state in `ui.js`. Undo/redo via the existing `historyManager` — every store mutation emits an undoable command.
