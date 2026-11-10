# StageCut — Data Model

Serialised as project JSON. All positions in **metres**, rotations in **radians** (UI may display degrees).

```ts
type Project = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  units: 'm' | 'ft'            // display unit; storage is always metres
  scenes: Scene[]
}

type Scene = {
  id: string
  name: string
  world: World
  objects: StagingObject[]
  cameras: CameraRig[]
  lights: LightObject[]
  shots: Shot[]
  playback: { fps: number; currentTime: number }
}

type World = {
  floor: { size: [number, number]; color: string } | null
  grid: { visible: boolean; spacing: number }
  bounds: { min: [number,number,number]; max: [number,number,number] }
}

type Transform = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}
```

## StagingObject

Every placed item — primitive, figure, architecture piece, prop, or imported asset.

```ts
type StagingObject = {
  id: string
  name: string
  kind: 'primitive' | 'figure' | 'architecture' | 'prop' | 'imported'
  presetId: string                 // e.g. 'cube', 'figure-standing', 'wall-doorway', 'chair'
  transform: Transform
  visible: boolean
  locked: boolean
  colorOverride?: string
  params?: Record<string, unknown> // preset params: wall length/height, figure pose, seat point…
  metadata: Record<string, unknown>
}
```

Preset parameters by kind:

- **primitive** — dimensions, colour.
- **figure** — `pose: 'standing' | 'seated' | 'walking'`, `scale: 'adult' | 'child'`, `gender?: 'm' | 'f' | 'n'`.
- **architecture** — wall: `length`, `height`, `thickness`, `wallType: 'interior' | 'exterior' | 'backer'`, `opening?: 'door' | 'window' | 'none'`.
- **prop** — `snapTo: 'floor' | 'wall'`, `seat?: { offset: [number,number,number]; yaw: number }` (chairs; consumed by chair-snap for seated figures).

## CameraRig

```ts
type CameraRig = {
  id: string
  name: string                     // 'A', 'B', 'Wide'…
  color: string                    // frustum/gizmo colour
  transform: Transform
  target?: [number, number, number]   // aim point (alternative to rotation)
  lens: {
    focalLength: number            // mm; presets 12–135
    sensor: 'fullFrame' | 'super35' | 'mft' | 'custom'
    sensorWidth: number            // mm
    sensorHeight: number           // mm
  }
  aspect: string                   // '16:9' | '2.39:1' | '1.85:1' | '4:3' | '1:1'
  resolution: [number, number]
  near: number
  far: number
  exposure: number
  overlays: {
    safeAction: boolean
    titleSafe: boolean
    thirds: boolean
    center: boolean
  }
  visibleInViewport: boolean       // show frustum in layout mode
}

type LensSpec = {
  focalLength: number
  sensorWidth: number
  sensorHeight: number
  horizontalFOV: number            // derived
  verticalFOV: number              // derived
}
```

## LightObject

```ts
type LightObject = {
  id: string
  name: string
  kind: 'directional' | 'ambient' | 'hemisphere' | 'point' | 'spot' | 'area'
  transform: Transform
  color: string
  temperatureK?: number            // optional colour-temperature control
  intensity: number
  range?: number                   // point/spot
  angle?: number                   // spot cone
  penumbra?: number
  castShadow: boolean
  showGizmo: boolean
  isPractical: boolean             // mark as in-set practical (lamp in scene)
}
```

## Shot

A shot is one camera active over a time range. Shots are sequential; the shot board may reorder them.

```ts
type Shot = {
  id: string
  name: string                     // 'Shot 1'…
  cameraId: string                 // → CameraRig.id
  startTime: number                // seconds
  endTime: number
  cutType: 'hard' | 'dissolve' | 'fade'
  notes: string
  thumbnailDataUrl?: string
}
```

Derived helpers:

```ts
getActiveShot(shots, t) → Shot | null   // find(s => t >= s.startTime && t < s.endTime)
normalizeTimings(shots) → shots[]       // re-flow start/end after reorder/duration edits
```

## Asset

```ts
type Asset = {
  id: string
  name: string
  source: 'builtin' | 'local' | 'polyPizza' | 'polyFork' | 'polyHaven'
  url?: string                     // original page URL
  fileUrl?: string                 // cached model URL (local blob or proxy cache)
  format: 'glb' | 'gltf'
  license: string
  attribution?: string
  tags: string[]
  category: string
  thumbnailDataUrl?: string
  scaleHint?: number
  snapToFloor: boolean
  castShadow: boolean
}
```

## Persistence

- `indexedDB` stores: `projects` (Project JSON), `assets` (Blob + Asset meta), `thumbnails` (Blob).
- Autosave writes the active project every N seconds and on major actions.
- Export/import = the Project JSON (with asset attribution preserved).
