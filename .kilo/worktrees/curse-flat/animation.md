# 3D Animation System Implementation Plan

**Status: NOT IMPLEMENTED** - This is a proposed feature specification.

## Current State vs Specification

### What EXISTS in the Codebase:
- **Character Animations** - `characterManager.js` uses `THREE.AnimationMixer` for Mixamo GLTF characters (idle/walk/run animations)
- **A-Frame Animation Strings** - `aframeExporter.js` supports basic A-Frame animation syntax export (e.g., `property: rotation; to: 0 360 0; loop: true`)

### What DOES NOT EXIST:
- GSAP dependency or any tweening library for keyframe animations
- `AnimationManager` singleton class
- Keyframe-based timeline animation system
- Playback controls (play, pause, seek, speed) for arbitrary objects
- JSON-serializable animation state management

---

## 1. Overview
The goal is to implement a robust keyframe-based animation system for a 3D canvas scene (e.g., using Three.js or a similar WebGL framework). This system will allow users to animate the spatial properties of 3D objects (meshes), lights, and cameras over a specific timeline, with full control over speed and interpolation (easing curves).

## 2. Core Requirements
- **Animatable Properties:** `position` (x, y, z), `rotation` (x, y, z), and `scale` (x, y, z).
- **Target Applicability:** Universal support for all scene nodes, including 3D Objects, Lights, and Cameras.
- **Keyframe System:** Support for explicit keyframes placed at specific timestamps or frames.
- **Playback Control:** Ability to set animation speed, duration, play, pause, and seek.
- **Animation Curves (Easing):** Support for interpolation curves (e.g., linear, ease-in, ease-out, ease-in-out, bezier) to control acceleration and deceleration between keyframes.

## 3. Architecture Design

### 3.1 Data Structure (State Management)
We need a structured, JSON-serializable way to store animation data. This allows animations to be saved, loaded, and easily manipulated by a UI timeline.
Additionally, implement persistent animation state management (e.g., via a **DatabaseManager** module or integrated with `fileManager.js`) to support background auto-saving and manual backup/restore functionality without cluttering the basic UI.

```json
{
  "animations": [
    {
      "id": "anim_001",
      "targetId": "uuid_of_object_light_or_camera",
      "targetType": "Mesh", // 'Mesh', 'Light', or 'Camera'
      "duration": 5.0, // Total animation duration in seconds
      "tracks": [
        {
          "property": "position", // 'position', 'rotation', 'scale'
          "keyframes": [
            { "time": 0.0, "value": { "x": 0, "y": 0, "z": 0 }, "easing": "linear" },
            { "time": 2.5, "value": { "x": 5, "y": 10, "z": 0 }, "easing": "easeInOutQuad" },
            { "time": 5.0, "value": { "x": 10, "y": 0, "z": 0 }, "easing": "easeOutBounce" }
          ]
        }
      ]
    }
  ]
}
```

### 3.2 Animation Engine Selection
Instead of writing a custom interpolator from scratch, leveraging an existing tweening engine is the most stable and feature-rich approach.

- **Option A (GSAP - Recommended):** GreenSock Animation Platform is the industry standard for web animation. It has a built-in timeline, highly optimized performance, and out-of-the-box support for complex easing curves.
- **Option B (Three.js AnimationMixer):** If using Three.js, its native `KeyframeTrack` and `AnimationMixer` are highly optimized for WebGL.
- **Option C (Custom Tween.js):** A lightweight alternative.

**Recommendation:** Use **GSAP** for its superior Timeline API, which makes sequencing, seeking, and applying easing curves trivial.

### 3.3 The Animation Controller
Create a dedicated `AnimationManager` singleton to parse the JSON state, bind it to scene objects, and control playback.

## 4. Implementation Steps (GSAP Approach)

### Step 1: Install Dependencies
```bash
npm install gsap
```

### Step 2: The Animation Manager Class
The manager parses the state and builds a master GSAP timeline.

```javascript
import { gsap } from "gsap";

class AnimationManager {
    constructor(scene) {
        this.scene = scene;
        this.masterTimeline = gsap.timeline({ paused: true });
    }

    loadAnimationData(animationData) {
        this.masterTimeline.clear();
        
        animationData.animations.forEach(anim => {
            const target = this.scene.getObjectById(anim.targetId) || this.scene.getObjectByName(anim.targetId);
            if (!target) return;

            anim.tracks.forEach(track => {
                let prevTime = 0;
                
                track.keyframes.forEach((kf, index) => {
                    if (index === 0) {
                        // Set initial state at timeline start
                        gsap.set(target[track.property], { ...kf.value });
                        prevTime = kf.time;
                        return;
                    }

                    const duration = kf.time - prevTime;
                    
                    // Add tween to timeline starting from the previous keyframe's time
                    this.masterTimeline.to(target[track.property], {
                        ...kf.value,
                        duration: duration,
                        ease: this.mapEasing(kf.easing),
                        onUpdate: () => {
                            // Hook for objects that require explicit updates (e.g., helpers, specific lights)
                        }
                    }, prevTime);

                    prevTime = kf.time;
                });
            });
        });
    }

    mapEasing(easingString) {
        // Map JSON string to GSAP easing functions
        const easeMap = {
            "linear": "none",
            "easeInOutQuad": "power2.inOut",
            "easeOutBounce": "bounce.out"
        };
        return easeMap[easingString] || "none";
    }

    // Playback Controls
    play() { this.masterTimeline.play(); }
    pause() { this.masterTimeline.pause(); }
    seek(time) { this.masterTimeline.seek(time); }
    setSpeed(scale) { this.masterTimeline.timeScale(scale); } // scale = 1 is normal, 2 is double speed
}
```

### Step 3: Handling Specific Object Types

#### 1. 3D Objects (Meshes)
- **Position & Scale:** Animate `mesh.position` and `mesh.scale` directly.
- **Rotation:** Three.js uses Euler angles (`mesh.rotation`). Eulers can be tweened easily, though beware of Gimbal lock for highly complex multi-axis rotations.

#### 2. Cameras
- **Position:** Animate `camera.position` normally.
- **Rotation/LookAt:** Animating camera rotation directly can feel unnatural. Instead, animate a "LookAt Target" (a dummy Vector3 or invisible Mesh) and have the camera look at it during the render loop.
  ```javascript
  // In your render loop:
  camera.lookAt(cameraTarget.position);
  ```

#### 3. Lights
- **Positional Lights (Point, Spot, Directional):** Animate `light.position`.
- **Targeted Lights (SpotLight, DirectionalLight):** Similar to cameras, animate the `light.target.position` to sweep the light across the scene.

#### 4. Characters & Inverse Kinematics (IK)
- **Skeletal Animation:** Mixamo GLTF characters (managed by `characterManager.js`) currently use `THREE.AnimationMixer`.
- **IK Posing:** Integrate Inverse Kinematics (IK) to allow users to manipulate joints and end-effectors (e.g., hands, feet) for natural posing. The keyframes should capture these bone transformations for seamless auto-tweening playback.

### Step 4: Easing and Curves
Provide users with standard easing options (Linear, Ease-In, Ease-Out, Ease-In-Out) which map to GSAP's `power1`, `power2`, `sine`, etc. If you need custom bezier curves, GSAP's `CustomEase` plugin can allow users to define paths via control points.

### Step 5: User Interface Integration
To make this work seamlessly with a UI:
1. **Timeline Editor (Bottom Panel):** Build a horizontal timeline UI component positioned at the bottom of the screen (not the right panel) for improved usability and a professional workflow. This will visualize the `animationData` JSON structure.
2. **Keyframe Insertion:** When the user moves an object, read its current Transform properties and insert a new object into the `keyframes` array for the current timeline position.
3. **Playback & Scrubbing:** Bind the UI timeline slider to the `AnimationManager.seek(time)` function. Implement smooth auto-tweening playback controls (Play, Pause, Loop) leveraging `requestAnimationFrame`.
4. **Input Control:** Consider supporting keyboard inputs (e.g., WASD and Arrow Keys) to trigger actions or record continuous keyframes during playback.

## 5. Render Loop Integration
GSAP automatically hooks into `requestAnimationFrame`, so it updates the object values internally. You just need to ensure the scene is rendered *after* GSAP updates.

```javascript
function animate() {
    requestAnimationFrame(animate);
    
    // GSAP updates object.position, rotation, etc. automatically here.
    
    // Put any manual updates here (e.g., Camera LookAt)
    if (cameraTarget) camera.lookAt(cameraTarget.position);
    
    renderer.render(scene, camera);
}
```

## 6. Challenges and Considerations
- **Gimbal Lock:** If rotation interpolations flip unnaturally, you may need to transition from tweening Euler angles to spherical linear interpolation (SLERP) using Quaternions.
- **Relative vs Absolute:** This plan assumes animating properties relative to the object's parent container. 
- **Performance:** Tweening hundreds of individual scene graph properties via JavaScript is fine, but for thousands of objects (like particles), a shader-based approach is required.

---

## 7. Implementation Recommendations

### Priority Order:
1. **Phase 1: GSAP Integration**
   - Add GSAP via CDN or npm install
   - Create basic `AnimationManager` class with the structure in Section 3.3
   - Test with single object keyframe animation

2. **Phase 2: UI Integration**
   - Add horizontal timeline component to the bottom of the screen
   - Create keyframe insertion from object transforms
   - Bind seek() to timeline scrubber

3. **Phase 3: A-Frame Export Compatibility**
   - Map GSAP keyframes to A-Frame animation syntax for export
   - Support both runtime animation and export formats

### Existing Code to Leverage:
- `LayerManager.js` - Pattern for managing animatable objects list
- `historyManager.js` - Pattern for state management and undo/redo
- `fileManager.js` - Pattern for saving/loading JSON state
- Transform controls already capture position/rotation/scale changes

### Integration with A-Frame Animation Feature
The existing A-Frame animation string field (`aframeExporter.js` line 95-96, `ui.js` 1288-1293) provides simple declarative animations for exported scenes. This could be extended to:
- Auto-generate A-Frame animation strings from GSAP keyframe data
- Allow users to set initial keyframes that export as A-Frame format
- Support both in-app preview and export-compatible animations
