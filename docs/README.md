# StageCut — Scene Staging & Shot Planning Tool

StageCut is a browser-based staging tool for **blocking out a movie scene**: lay out the set with walls, doors and windows, place figures (standing/seated) and basic props, then set up **multiple cameras** and build a **shot sequence with cuts between cameras** — all visualised live in a Three.js viewport.

It is deliberately **not a 3D modelling tool**. There is no vertex editing, sculpting or material painting. You place presets, move/rotate/scale them, frame shots, and play back cuts.

## Documentation

| Document | Contents |
| --- | --- |
| [Product Spec](product-spec.md) | Vision, feature set, MVP scope, phases |
| [Architecture](architecture.md) | Template reuse from pixel3d, module layout, data model, storage |
| [User Guide](user-guide.md) | How to build a scene, set cameras, and play cuts (workflow) |
| [Data Model](data-model.md) | Project / Scene / StagingObject / CameraRig / Shot schemas |
| [Roadmap](roadmap.md) | Phase-by-phase implementation checklist and priorities |

## One-minute overview

1. **Build the set** — floor, wall segments, corner walls, door and window pieces.
2. **Block the action** — drop standing and seated figures (adult/child scale), chairs, tables and basic props. Seated figures snap onto chairs.
3. **Light it** — sun, practicals, spots; simple lighting presets (day interior, night lamps, etc.).
4. **Set the cameras** — add cameras A/B/C/Wide, choose focal length and aspect, see each frustum in the viewport.
5. **Cut the scene** — build a shot list (each shot = one camera over a time range), press **Play** and the viewport cuts between cameras. Capture stills per shot.
6. **Save & export** — autosave to the browser, export project JSON, shot thumbnails and a shot-list CSV.

## Built from the pixel3d template

StageCut reuses the proven scaffolding of [pixel3d](https://github.com/…/pixel3d) — Three.js 0.160 + esbuild + plain-JS modules, its viewport/selection/transform/history/UI infrastructure — and replaces the general 3D-modelling features with a staging and shot-planning workflow. See [Architecture](architecture.md).

## Status

Documentation phase — implementation follows the [Roadmap](roadmap.md).
