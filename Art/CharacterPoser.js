// CharacterPoser.js — simple posing for Mixamo-rigged characters (Xbot / Ybot child versions, or any Mixamo skeleton).
//
//   import { CharacterPoser } from './CharacterPoser.js';
//   const gltf = await new GLTFLoader().loadAsync('Xbot_child.glb');
//   scene.add(gltf.scene);
//   const poser = new CharacterPoser(gltf.scene, gltf.animations);   // create it right after loading, before any animation plays
//   poser.apply('wave', { duration: 0.3 });                           // blend into a pose
//   // every frame:  poser.update(dt);
//
// Pose rotations are in degrees and use the same convention as the pose clips: X is applied first, then Y, then Z,
// each in the parent bone's frame (three.js Euler order 'ZYX'), on top of the bone's rest rotation.
import { Quaternion, Euler, MathUtils } from 'three';

const short = (name) => name.replace(/^mixamorig:?/, '');   // 'mixamorig:Hips' and GLTFLoader's 'mixamorigHips' -> 'Hips'
const smooth = (t) => t * t * (3 - 2 * t);

export class CharacterPoser {
  /**
   * @param {THREE.Object3D} root       gltf.scene (or any object containing the skeleton)
   * @param {THREE.AnimationClip[]} clips  gltf.animations; every clip named 'pose_*' becomes a pose
   * @param {object} [library]          optional parsed poses.json (works on any Mixamo-rigged character)
   */
  constructor(root, clips = [], library = null) {
    this.root = root;
    this.bones = new Map();
    root.traverse((o) => { if (o.isBone) this.bones.set(short(o.name), o); });
    if (!this.bones.size) throw new Error('CharacterPoser: no bones found');
    this.hips = this.bones.get('Hips') ?? null;

    // rest state, captured now (so create the poser before animations move the bones)
    this.rest = new Map();
    this.restPositions = new Map();
    for (const [n, b] of this.bones) {
      this.rest.set(n, b.quaternion.clone());
      this.restPositions.set(n, b.position.clone());
    }
    this.restHipsY = this.hips ? this.hips.position.y : 0;

    this.poses = new Map();               // name -> { rotations: Map(bone -> Quaternion), hipsScale }
    this._clips = new Map();              // name -> AnimationClip (for mixer-based playback)
    for (const clip of clips) if (clip.name.startsWith('pose_')) this._readClip(clip);
    if (library) this.addLibrary(library);

    this._from = null; this._to = null; this._t = 1; this._dur = 0;   // blend state
  }

  // ---- loading poses -------------------------------------------------------------------------------------------
  _readClip(clip) {
    const rotations = new Map(); let hipsScale = 1;
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.'); const node = short(tr.name.slice(0, dot)); const prop = tr.name.slice(dot + 1);
      if (prop === 'quaternion') rotations.set(node, new Quaternion().fromArray(tr.values, 0));
      else if (prop === 'position' && node === 'Hips' && this.restHipsY) hipsScale = tr.values[1] / this.restHipsY;
    }
    const name = clip.name.slice(5);
    this.poses.set(name, { rotations, hipsScale }); this._clips.set(name, clip);
  }
  /** Add poses from poses.json (portable library). Does not overwrite poses already read from the file's own clips. */
  addLibrary(lib) {
    for (const [name, p] of Object.entries(lib.poses ?? {})) {
      if (this.poses.has(name)) continue;
      const rotations = new Map();
      for (const [bn, q] of Object.entries(p.rotations)) rotations.set(short(bn), new Quaternion().fromArray(q));
      this.poses.set(name, { rotations, hipsScale: 1 + (p.hipsDrop ?? 0) });
    }
  }
  list() { return [...this.poses.keys()]; }
  has(name) { return this.poses.has(name); }

  /** Add a static pose sampled from an animation clip (walk/run/etc). */
  addPoseFromClip(name, clip, time = null) {
    if (!clip || this.poses.has(name)) return this;
    const sampleTime = time == null ? clip.duration * 0.5 : time;

    for (const [n, b] of this.bones) {
      b.quaternion.copy(this.rest.get(n));
      const p = this.restPositions.get(n);
      if (p) b.position.copy(p);
    }

    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      if (dot === -1) continue;
      const boneName = short(track.name.slice(0, dot));
      const prop = track.name.slice(dot + 1);
      const bone = this.bones.get(boneName);
      if (!bone) continue;

      let index = 0;
      while (index < track.times.length - 1 && track.times[index + 1] <= sampleTime) index++;
      const valueSize = track.getValueSize();
      const offset = index * valueSize;

      if (prop === 'quaternion') bone.quaternion.fromArray(track.values, offset);
      if (prop === 'position' && boneName === 'Hips') bone.position.fromArray(track.values, offset);
    }

    const rotations = new Map();
    for (const [n, b] of this.bones) rotations.set(n, b.quaternion.clone());
    const hipsScale = this.hips && this.restHipsY ? this.hips.position.y / this.restHipsY : 1;
    this.poses.set(name, { rotations, hipsScale });
    this._clips.set(name, clip);

    for (const [n, b] of this.bones) {
      b.quaternion.copy(this.rest.get(n));
      const p = this.restPositions.get(n);
      if (p) b.position.copy(p);
    }
    return this;
  }

  /** Add a pose defined as bone rotation offsets in degrees. */
  addDeltaPose(name, degrees = {}, hipsDrop = 0) {
    if (this.poses.has(name)) return this;
    const rotations = new Map();
    for (const [n] of this.bones) {
      const euler = degrees[n] || [0, 0, 0];
      const delta = new Quaternion().setFromEuler(new Euler(
        MathUtils.degToRad(euler[0] || 0),
        MathUtils.degToRad(euler[1] || 0),
        MathUtils.degToRad(euler[2] || 0),
        'ZYX'
      ));
      rotations.set(n, delta.multiply(this.rest.get(n)));
    }
    this.poses.set(name, { rotations, hipsScale: 1 + hipsDrop });
    return this;
  }

  // ---- applying poses ------------------------------------------------------------------------------------------
  /** Pose the character. duration = seconds to blend from the current pose (0 = instant). Call update(dt) each frame. */
  apply(name, { duration = 0 } = {}) {
    const p = this.poses.get(name);
    if (!p) throw new Error(`CharacterPoser: unknown pose "${name}". Available: ${this.list().join(', ')}`);
    return this._blendTo(this._targetFrom(p), duration);
  }
  /** Back to the rest (T-pose) state. */
  reset({ duration = 0 } = {}) { return this.apply('t_pose', { duration }) ?? this; }

  /** Apply a pose object as returned by getPose(). */
  applyPose(pose, { duration = 0 } = {}) {
    const rotations = new Map(Object.entries(pose.rotations).map(([n, q]) => [short(n), new Quaternion().fromArray(q)]));
    if (pose.positions) {
      for (const [name, pos] of Object.entries(pose.positions)) {
        const bone = this.bones.get(short(name));
        if (bone) bone.position.fromArray(pos);
      }
    }
    return this._blendTo(this._targetFrom({ rotations, hipsScale: pose.hipsScale ?? 1 }), duration);
  }
  /** Current pose as plain JSON (save it, then pass it to applyPose later). */
  getPose() {
    const rotations = {};
    const positions = {};
    for (const [n, b] of this.bones) {
      rotations[n] = b.quaternion.toArray();
      positions[n] = b.position.toArray();
    }
    return { rotations, positions, hipsScale: this.hips && this.restHipsY ? this.hips.position.y / this.restHipsY : 1 };
  }
  /** Pose a single bone in degrees (X first, then Y, then Z, on top of the rest rotation). Instant. */
  setBone(boneName, x = 0, y = 0, z = 0) {
    const b = this.bones.get(short(boneName)); if (!b) throw new Error(`CharacterPoser: no bone "${boneName}"`);
    this._cancel();
    b.quaternion.copy(new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'ZYX')).multiply(this.rest.get(short(boneName))));
    return this;
  }
  /** Lower/raise the hips by a fraction of their rest height (e.g. -0.4 for sitting). Instant. */
  setHipsDrop(fraction) { if (this.hips) { this._cancel(); this.hips.position.y = this.restHipsY * (1 + fraction); } return this; }

  resetBone(name) {
    const key = short(name);
    const bone = this.bones.get(key);
    if (!bone) return this;
    this._cancel();
    bone.quaternion.copy(this.rest.get(key));
    const restPos = this.restPositions.get(key);
    if (restPos) bone.position.copy(restPos);
    return this;
  }

  /** Call every frame with the frame time in seconds. */
  update(dt) {
    if (!this._to || this._t >= 1) return;
    this._t = Math.min(1, this._t + (this._dur > 0 ? dt / this._dur : 1));
    this._write(smooth(this._t));
    if (this._t >= 1) { this._from = this._to = null; }
  }
  get blending() { return !!this._to && this._t < 1; }

  // ---- optional: use the file's own pose clips with an AnimationMixer ------------------------------------------
  /** Crossfade a mixer to a pose clip and hold it. Returns the action. */
  playClip(mixer, name, fade = 0.25) {
    const clip = this._clips.get(name); if (!clip) throw new Error(`No pose clip "${name}" in this file`);
    const a = mixer.clipAction(clip); a.reset(); a.setLoop(2200 /* THREE.LoopOnce */, 1); a.clampWhenFinished = true; a.fadeIn(fade).play();
    return a;
  }

  // ---- internals -----------------------------------------------------------------------------------------------
  _targetFrom(p) {
    const rot = new Map();
    for (const [n] of this.bones) rot.set(n, (p.rotations.get(n) ?? this.rest.get(n)).clone());
    return { rot, hipsY: this.restHipsY * p.hipsScale };
  }
  _blendTo(target, duration) {
    this._from = { rot: new Map([...this.bones].map(([n, b]) => [n, b.quaternion.clone()])), hipsY: this.hips ? this.hips.position.y : 0 };
    this._to = target; this._dur = duration; this._t = 0;
    if (duration <= 0) { this._write(1); this._t = 1; this._from = this._to = null; }
    return this;
  }
  _write(k) {
    for (const [n, b] of this.bones) b.quaternion.slerpQuaternions(this._from.rot.get(n), this._to.rot.get(n), k);
    if (this.hips) this.hips.position.y = this._from.hipsY + (this._to.hipsY - this._from.hipsY) * k;
  }
  _cancel() { this._from = this._to = null; this._t = 1; }
}
