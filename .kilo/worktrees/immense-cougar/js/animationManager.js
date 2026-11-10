/**
 * animationManager.js — Pixel 3D Pro Staging Studio
 *
 * Per-object keyframe animation engine with:
 *   • position, rotation, scale tracks (vec3 interpolation)
 *   • color track (RGB interpolation, applied to mesh.material.color)
 *   • 12 easing curves
 *   • full serialisation / deserialisation
 *
 * Zero external dependencies.
 */

// ─── Easing library ───────────────────────────────────────────────────────────

export const Easing = {
    linear:          t => t,
    easeInQuad:      t => t * t,
    easeOutQuad:     t => t * (2 - t),
    easeInOutQuad:   t => t < .5 ? 2*t*t : -1+(4-2*t)*t,
    easeInCubic:     t => t*t*t,
    easeOutCubic:    t => (--t)*t*t + 1,
    easeInOutCubic:  t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
    easeInBack:      t => t*t*(2.70158*t - 1.70158),
    easeOutBack:     t => { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); },
    easeOutBounce:   t => {
        const n=7.5625, d=2.75;
        if(t < 1/d)   return n*t*t;
        if(t < 2/d)   return n*(t-=1.5/d)*t + .75;
        if(t < 2.5/d) return n*(t-=2.25/d)*t + .9375;
        return              n*(t-=2.625/d)*t + .984375;
    },
    easeInBounce:    t => 1 - Easing.easeOutBounce(1 - t),
    spring:          t => 1 - Math.cos(t*Math.PI*(0.5+2.5*t))*Math.pow(1-t, 2.2),
};
export const EASING_OPTIONS = Object.keys(Easing);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyEase(easeName, t) {
    return (Easing[easeName] || Easing.linear)(Math.max(0, Math.min(1, t)));
}

// ─── AnimationClip ────────────────────────────────────────────────────────────

/**
 * Holds all keyframe data for one scene object.
 *
 * Tracks:
 *   position  → [{time, value:{x,y,z}, easing}]
 *   rotation  → [{time, value:{x,y,z}, easing}]
 *   scale     → [{time, value:{x,y,z}, easing}]
 *   color     → [{time, value:{r,g,b}, easing}]  (r/g/b in 0-1)
 */
export class AnimationClip {
    constructor(objectId, data = {}) {
        this.objectId = objectId;
        this.duration = data.duration || 3;
        this.tracks   = { position: [], rotation: [], scale: [], color: [] };

        if (data.tracks) {
            for (const [prop, kfs] of Object.entries(data.tracks)) {
                if (this.tracks[prop]) {
                    this.tracks[prop] = kfs.map(k => ({ ...k, value: { ...k.value } }));
                }
            }
        }
    }

    // ── Keyframe CRUD ─────────────────────────────────────────────────────────

    setKeyframe(prop, time, value, easing = 'easeInOutQuad') {
        if (!this.tracks[prop]) return;
        time = Math.round(time * 100) / 100;
        const idx = this.tracks[prop].findIndex(k => Math.abs(k.time - time) < 0.005);
        const kf  = { time, value: { ...value }, easing };
        if (idx >= 0) this.tracks[prop][idx] = kf;
        else {
            this.tracks[prop].push(kf);
            this.tracks[prop].sort((a, b) => a.time - b.time);
        }
        if (time > this.duration) this.duration = Math.ceil(time * 10) / 10;
    }

    deleteKeyframe(prop, time) {
        if (!this.tracks[prop]) return;
        this.tracks[prop] = this.tracks[prop].filter(k => Math.abs(k.time - time) >= 0.005);
    }

    moveKeyframe(prop, fromTime, toTime) {
        const track = this.tracks[prop];
        if (!track) return null;
        const keyframe = track.find(k => Math.abs(k.time - fromTime) < 0.005);
        if (!keyframe) return null;
        const nextTime = Math.max(0, Math.min(this.duration, Math.round(toTime * 100) / 100));
        if (track.some(k => k !== keyframe && Math.abs(k.time - nextTime) < 0.005)) return keyframe.time;
        keyframe.time = nextTime;
        track.sort((a, b) => a.time - b.time);
        return nextTime;
    }

    updateKeyframeEasing(prop, time, easing) {
        const kf = this.tracks[prop]?.find(k => Math.abs(k.time - time) < 0.005);
        if (kf) kf.easing = easing;
    }

    getKeyframes(prop) { return this.tracks[prop] || []; }

    hasAnyKeyframes() {
        return Object.values(this.tracks).some(kfs => kfs.length > 0);
    }

    // ── Interpolation ─────────────────────────────────────────────────────────

    /**
     * Compute interpolated state for all tracks at `time` and apply to `target`.
     * For the color track, target must have a findMaterial() result OR we use
     * the passed-in materialRef.
     */
    applyTo(target, time, materialRef = null) {
        // ── Vec3 tracks ──
        for (const prop of ['position', 'rotation', 'scale']) {
            const kfs = this.tracks[prop];
            if (!kfs.length || !target[prop]) continue;
            const v = this._interpVec3(kfs, time);
            if (v) { target[prop].x = v.x; target[prop].y = v.y; target[prop].z = v.z; }
        }

        // ── Color track ──
        const colorKfs = this.tracks.color;
        if (colorKfs.length) {
            const mat = materialRef || AnimationClip._findMaterial(target);
            if (mat) {
                const c = this._interpRgb(colorKfs, time);
                if (c) mat.color.setRGB(c.r, c.g, c.b);
            }
        }
    }

    _interpVec3(kfs, time) {
        if (!kfs.length) return null;
        if (kfs.length === 1) return { ...kfs[0].value };

        let before = null, after = null;
        for (const kf of kfs) {
            if (kf.time <= time) before = kf;
            if (kf.time >= time && !after) after = kf;
        }
        if (!before) return { ...kfs[0].value };
        if (!after)  return { ...kfs[kfs.length-1].value };
        if (before === after) return { ...before.value };

        const rawT = (time - before.time) / (after.time - before.time);
        const t    = applyEase(after.easing, rawT);
        const lerp = (a, b) => a + (b - a) * t;
        return {
            x: lerp(before.value.x, after.value.x),
            y: lerp(before.value.y, after.value.y),
            z: lerp(before.value.z, after.value.z),
        };
    }

    _interpRgb(kfs, time) {
        if (!kfs.length) return null;
        if (kfs.length === 1) return { ...kfs[0].value };

        let before = null, after = null;
        for (const kf of kfs) {
            if (kf.time <= time) before = kf;
            if (kf.time >= time && !after) after = kf;
        }
        if (!before) return { ...kfs[0].value };
        if (!after)  return { ...kfs[kfs.length-1].value };
        if (before === after) return { ...before.value };

        const rawT = (time - before.time) / (after.time - before.time);
        const t    = applyEase(after.easing, rawT);
        const lerp = (a, b) => a + (b - a) * t;
        return {
            r: lerp(before.value.r, after.value.r),
            g: lerp(before.value.g, after.value.g),
            b: lerp(before.value.b, after.value.b),
        };
    }

    /** Find the first usable material on a THREE object (handles Groups). */
    static _findMaterial(obj) {
        if (obj.isMesh && obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            return materials[Math.min(obj.userData?.activeMaterialSlot || 0, materials.length - 1)];
        }
        let mat = null;
        obj.traverse(o => {
            if (mat || !o.isMesh || !o.material) return;
            const materials = Array.isArray(o.material) ? o.material : [o.material];
            mat = materials[Math.min(o.userData?.activeMaterialSlot || 0, materials.length - 1)];
        });
        return mat;
    }

    // ── Serialisation ─────────────────────────────────────────────────────────

    toJSON() {
        return { objectId: this.objectId, duration: this.duration, tracks: this.tracks };
    }

    static fromJSON(data) {
        return new AnimationClip(data.objectId, data);
    }
}

// ─── AnimationManager ─────────────────────────────────────────────────────────

export class AnimationManager {
    constructor(app) {
        this.app    = app;
        /** @type {Map<string, AnimationClip>} */
        this.clips  = new Map();

        this._time    = 0;
        this._playing = false;
        this._loop    = false;
        this._speed   = 1;
        this._lastNow = null;
        this._raf     = null;

        // UI callbacks (set by AnimationUI)
        this.onTick = null; // (time:number) => void
        this.onEnd  = null; // () => void

        this._tick = this._tick.bind(this);
    }

    // ── Clip management ───────────────────────────────────────────────────────

    createClip(objectId, data = {}) {
        const clip = new AnimationClip(objectId, data);
        this.clips.set(objectId, clip);
        return clip;
    }

    getOrCreateClip(objectId) {
        return this.clips.get(objectId) || this.createClip(objectId);
    }

    getClip(objectId)    { return this.clips.get(objectId) || null; }
    removeClip(objectId) { this.clips.delete(objectId); }
    hasClip(objectId)    { return this.clips.has(objectId); }

    get totalDuration() {
        let max = 3;
        for (const clip of this.clips.values()) max = Math.max(max, clip.duration);
        return max;
    }

    // ── Playback ──────────────────────────────────────────────────────────────

    play() {
        if (this._playing) return;
        if (this._time >= this.totalDuration) this._time = 0;
        this._playing = true;
        this._lastNow = performance.now();
        this._raf     = requestAnimationFrame(this._tick);
    }

    pause() {
        this._playing = false;
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }

    stop() { this.pause(); this.seek(0); }

    seek(time) {
        this._time = Math.max(0, Math.min(time, this.totalDuration));
        this._applyAll(this._time);
        if (this.onTick) this.onTick(this._time);
    }

    get currentTime() { return this._time; }
    get isPlaying()   { return this._playing; }

    setSpeed(s) { this._speed = Math.max(0.1, Math.min(s, 4)); }
    setLoop(v)  { this._loop = !!v; }

    _tick(now) {
        if (!this._playing) return;
        const dt  = (now - this._lastNow) / 1000 * this._speed;
        this._lastNow = now;
        this._time   += dt;

        const dur = this.totalDuration;
        if (this._time >= dur) {
            if (this._loop) {
                this._time = this._time % dur;
            } else {
                this._time = dur;
                this._applyAll(this._time);
                if (this.onTick) this.onTick(this._time);
                this.pause();
                if (this.onEnd) this.onEnd();
                return;
            }
        }
        this._applyAll(this._time);
        if (this.onTick) this.onTick(this._time);
        this._raf = requestAnimationFrame(this._tick);
    }

    _applyAll(time) {
        for (const [id, clip] of this.clips.entries()) {
            const target = this._resolve(id);
            if (target) clip.applyTo(target, time);
        }
        if (this.app?.renderer && this.app?.scene && this.app?.camera) {
            this.app.renderer.render(this.app.scene, this.app.camera);
        }
    }

    // ── Object resolution ─────────────────────────────────────────────────────

    _resolve(id) {
        if (!this.app?.scene) return null;
        // Prefer uuid match (fast path)
        let found = this.app.scene.getObjectByProperty('uuid', id);
        if (!found) {
            this.app.scene.traverse(o => {
                if (!found && o.userData?.id === id) found = o;
            });
        }
        return found || null;
    }

    // ── Keyframe recording ────────────────────────────────────────────────────

    /**
     * Record a keyframe from the object's current live state.
     * @param {string} objectId
     * @param {number} time
     * @param {string[]} props  subset of ['position','rotation','scale','color']
     */
    recordKeyframe(objectId, time, props = ['position','rotation','scale','color']) {
        const target = this._resolve(objectId);
        if (!target) return;
        const clip = this.getOrCreateClip(objectId);

        for (const prop of props) {
            if (prop === 'color') {
                const mat = AnimationClip._findMaterial(target);
                if (!mat) continue;
                const c = mat.color;
                clip.setKeyframe('color', time, { r: c.r, g: c.g, b: c.b });
            } else {
                if (!target[prop]) continue;
                clip.setKeyframe(prop, time, {
                    x: target[prop].x,
                    y: target[prop].y,
                    z: target[prop].z,
                });
            }
        }
    }

    deleteKeyframe(objectId, prop, time) {
        this.getClip(objectId)?.deleteKeyframe(prop, time);
    }

    // ── Serialisation ─────────────────────────────────────────────────────────

    toJSON() {
        const out = { clips: {} };
        for (const [id, clip] of this.clips.entries()) {
            out.clips[id] = clip.toJSON();
        }
        return out;
    }

    fromJSON(data) {
        this.clips.clear();
        for (const [id, cd] of Object.entries(data.clips || {})) {
            this.createClip(id, cd);
        }
    }
}
