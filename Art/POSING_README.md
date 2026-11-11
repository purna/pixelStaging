# Child Xbot / Ybot – posing system

12 pose presets: `t_pose` (rest), `a_pose`, `stand`, `wave`, `point`, `cheer`, `hands_on_hips`, `sit`, `crouch`, `kneel`, `pray`, `sad`.
See `pose_sheet.png` for front and side views of each.

## Files
| File | What it is |
|---|---|
| `Xbot_child.glb`, `Ybot_child.glb` | Characters with the poses stored as single-frame animation clips named `pose_<name>` (next to the original 7 animations) |
| `Xbot_child.blend`, `Ybot_child.blend` | Same poses as Pose Library assets (actions named `pose_<name>`, with thumbnails), plus the 7 animations |
| `CharacterPoser.js` | Three.js helper: apply a pose, blend between poses, pose single bones, save/load custom poses |
| `poses.json` | The same poses as portable data. Works on any Mixamo-rigged character (e.g. the adult bots) |

## Three.js
```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterPoser } from './CharacterPoser.js';

const gltf = await new GLTFLoader().loadAsync('Xbot_child.glb');
scene.add(gltf.scene);
const poser = new CharacterPoser(gltf.scene, gltf.animations); // create it right after loading

poser.list();                                   // ['t_pose','a_pose','stand', ...]
poser.apply('wave', { duration: 0.3 });         // blend into a pose (0 = instant)
// in your render loop:
poser.update(delta);

poser.setBone('Head', 20, 0, 0);                // degrees: X first, then Y, then Z, on top of rest
const mine = poser.getPose();                   // plain JSON -> save it
poser.applyPose(mine, { duration: 0.2 });       // ...and restore it later
poser.reset();                                  // back to the T-pose

// Other characters with a Mixamo skeleton: new CharacterPoser(root, [], await (await fetch('poses.json')).json())
// Prefer an AnimationMixer? poser.playClip(mixer, 'sit') crossfades to the pose clip and holds it.
```
Bones are driven directly, so stop any playing `AnimationMixer` actions before using `apply()`.

## Blender
Pose Mode on the armature, then open an Asset Browser editor, set the library to **Current File** and pick a `pose_*` action
(right-click > Apply Pose / Blend Pose). To add your own: pose the bones, then Pose Library > Create Pose Asset.
