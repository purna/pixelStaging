import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { D2R, clamp, lerp, lerpArray, EASING, getEasing, cubicBezierEasing } from './easing.js';
import { getMoveSpec, getMoveDefaultDuration, ALL_MOVES, SHOT_CATEGORIES } from './shotMoves.js';

const V3 = THREE.Vector3;
const Y = new V3(0, 1, 0);

export class ShotManager {
    constructor(app) {
        this.app = app;
        this.shots = [];
        this.currentTime = 0;
        this.playing = false;
        this.playbackRate = 1;
        this.loop = false;
        this.selectedShotIndex = 0;
        this.editingFrame = 'start'; // 'start' or 'end'
        this.viewMode = 'frame'; // 'frame' or 'explore'
        this.dragMode = 'translate'; // 'translate' or 'rotate'
        this.ui = null;
        this.timelineUI = null;
        this.isScrubbing = false;
        this.previewActive = false;
        this.showPath = false;
        this._transitionOverlay = null;
        this._moveScale = 1;
        this._moveScaleAt = 0;
        
        // Framing camera controls (OrbitControls during frame editing)
        this.framingControls = null;
        
        // Framing state (for custom start/end frames)
        this.framingState = {
            position: new V3(),
            quaternion: new THREE.Quaternion(),
            target: new V3(),
            fov: 55
        };
        this.framingRig = null;
        
        // Camera path preview line
        this.pathLine = null;
        this.pathMarkers = [];
        
        // Shot transition data (for future transition effects)
        this.transitions = [];
    }

    get duration() {
        return this.shots.reduce((t, s) => t + s.duration, 0);
    }

    get selectedShot() {
        return this.shots[this.selectedShotIndex] || null;
    }

    createShot(cameraId, options = {}) {
        const cameras = this.app.staging?.cameras;
        if (!cameraId) cameraId = cameras?.defaultRig?.id || cameras?.ensureDefaultRig?.()?.id;
        const moveName = options.move || 'Dolly Shot';
        const moveSpec = getMoveSpec(moveName);
        const defaultDuration = getMoveDefaultDuration(moveName);
        
        const shot = {
            id: 'shot_' + Math.random().toString(36).slice(2, 8),
            cameraId,
            name: options.name || `Shot ${this.shots.length + 1}`,
            move: moveName,
            spec: { ...moveSpec },
            duration: options.duration || defaultDuration,
            speed: options.speed || 1,
            easing: options.easing || moveSpec.e || 'io',
            startFrame: options.startFrame || null, // { position, quaternion, fov }
            endFrame: options.endFrame || null,     // { position, quaternion, fov }
            blurStart: options.blurStart || 0,
            blurEnd: options.blurEnd || 0,
            transition: options.transition || null,
            curve: options.curve || null // custom bezier curve
        };
        
        this.shots.push(shot);
        this.selectedShotIndex = this.shots.length - 1;
        this.previewActive = false;
        this.refreshUI();
        return shot;
    }

    removeShot(shotId) {
        const i = this.shots.findIndex(s => s.id === shotId);
        if (i > -1) {
            this.shots.splice(i, 1);
            this.selectedShotIndex = Math.min(this.selectedShotIndex, this.shots.length - 1);
            this.refreshUI();
        }
    }

    moveShot(shotId, direction) {
        const i = this.shots.findIndex(s => s.id === shotId);
        const j = i + direction;
        if (i === -1 || j < 0 || j >= this.shots.length) return;
        [this.shots[i], this.shots[j]] = [this.shots[j], this.shots[i]];
        this.selectedShotIndex = j;
        this.refreshUI();
    }

    duplicateShot(shotId) {
        const i = this.shots.findIndex(s => s.id === shotId);
        if (i === -1) return;
        const copy = JSON.parse(JSON.stringify(this.shots[i]));
        copy.id = 'shot_' + Math.random().toString(36).slice(2, 8);
        copy.name = copy.name + ' (copy)';
        this.shots.splice(i + 1, 0, copy);
        this.selectedShotIndex = i + 1;
        this.refreshUI();
    }

    getActiveShot(t = this.currentTime) {
        let elapsed = 0;
        for (let i = 0; i < this.shots.length; i++) {
            const shot = this.shots[i];
            if (t < elapsed + shot.duration) {
                return { shot, localT: t - elapsed, shotIndex: i };
            }
            elapsed += shot.duration;
        }
        if (this.shots.length > 0) {
            const last = this.shots[this.shots.length - 1];
            return { shot: last, localT: last.duration, shotIndex: this.shots.length - 1 };
        }
        return null;
    }

    getShotAtTime(t) {
        let elapsed = 0;
        for (let i = 0; i < this.shots.length; i++) {
            const shot = this.shots[i];
            if (t < elapsed + shot.duration) {
                return { shot, localT: t - elapsed, shotIndex: i };
            }
            elapsed += shot.duration;
        }
        return null;
    }

    play() {
        this.playAll();
    }

    playAll() {
        if (this.shots.length === 0) return;
        this._playStart = 0;
        this._playEnd = this.duration;
        this.currentTime = 0;
        this.playing = true;
        this.previewActive = true;
        this.refreshUI();
    }

    playShot(index = this.selectedShotIndex) {
        const shot = this.shots[index];
        if (!shot) return;
        this.selectedShotIndex = index;
        this._playStart = this.getShotStartTime(index);
        this._playEnd = this._playStart + shot.duration;
        this.currentTime = this._playStart;
        this.playing = true;
        this.previewActive = true;
        this.refreshUI();
    }

    stop() {
        this.playing = false;
        this.previewActive = false;
        this.currentTime = 0;
        this._playStart = 0;
        this._playEnd = this.duration;
        this.clearPreviewBlur();
        this.clearTransitionOverlay();
        this.updatePathPreview();
        this.refreshUI();
    }

    pause() {
        this.playing = false;
        this.refreshUI();
    }

    toggle() {
        this.playing ? this.pause() : this.playAll();
    }

    seek(t) {
        this.currentTime = clamp(t, 0, this.duration);
        this.previewActive = true;
        if (this.ui) this.ui.updateScrubber();
        this.updatePathPreview();
    }

    update(delta) {
        this.updateAlignButton();
        if (this.framingControls) {
            this.framingControls.update(delta);
            if (this.framingRig) {
                this.clearPreviewBlur();
                this.clearTransitionOverlay();
                this.framingRig.camera.updateMatrixWorld(true);
                return this.framingRig.camera;
            }
        }
        if (!this.playing) {
            if (!this.previewActive) {
                this.clearPreviewBlur();
                this.clearTransitionOverlay();
                return null;
            }
            return this.getPreviewCamera();
        }

        this.currentTime += delta * this.playbackRate;
        const rangeStart = Number.isFinite(this._playStart) ? this._playStart : 0;
        const rangeEnd = Number.isFinite(this._playEnd) ? this._playEnd : this.duration;
        if (this.currentTime >= rangeEnd) {
            if (this.loop) {
                const range = Math.max(0.001, rangeEnd - rangeStart);
                this.currentTime = rangeStart + ((this.currentTime - rangeStart) % range);
            } else {
                this.currentTime = rangeEnd;
                this.pause();
            }
        }
        if (this.ui) this.ui.updateScrubber();
        return this.getPreviewCamera();
    }

    getPreviewCamera() {
        const cameras = this.app.staging?.cameras;
        if (!cameras) return null;
        
        const active = this.getActiveShot();
        if (!active) return null;
        
        const rig = cameras.get(active.shot.cameraId);
        if (!rig) return null;

        if (!rig.previewCamera) rig.previewCamera = rig.camera.clone();
        const previewCamera = rig.previewCamera;
        previewCamera.aspect = rig.camera.aspect;
        previewCamera.up.copy(rig.camera.up);

        // Apply shot move to a detached preview camera so the rig itself is not
        // permanently moved by playback.
        const globalTime = this.app?.clock?.getElapsedTime() || 0;
        this.applyShotMove(previewCamera, rig, active.shot, active.localT, globalTime);

        const u = clamp(active.localT / active.shot.duration);
        const blur = lerp([active.shot.blurStart || 0, active.shot.blurEnd || 0], this.getEasingForShot(active.shot)(u));
        if (this.app.renderer?.domElement) {
            this.app.renderer.domElement.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        }
        this.updateTransitionOverlay(active);

        return previewCamera;
    }

    clearPreviewBlur() {
        if (this.app.renderer?.domElement) {
            this.app.renderer.domElement.style.filter = '';
        }
    }

    jumpToFrame(shot, frameType) {
        const cameras = this.app.staging?.cameras;
        const rig = shot ? cameras?.get(shot.cameraId) : null;
        if (!shot || !rig) return;

        const frame = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
        const temp = rig.camera.clone();
        if (frame) {
            temp.position.fromArray(frame.position);
            temp.quaternion.fromArray(frame.quaternion);
            if (Number.isFinite(frame.fov)) temp.fov = frame.fov;
        } else {
            this.applyShotMove(temp, rig, shot, frameType === 'start' ? 0 : shot.duration, 0);
        }

        const camera = this.app.camera;
        camera.position.copy(temp.position);
        camera.quaternion.copy(temp.quaternion);
        if (camera.isPerspectiveCamera) {
            camera.fov = Number.isFinite(temp.fov) ? temp.fov : camera.fov;
            camera.updateProjectionMatrix();
        }
        camera.updateMatrixWorld(true);

        if (this.app.orbit) {
            const target = frame?.target ? new V3().fromArray(frame.target) : rig.target.clone();
            this.app.orbit.target.copy(target);
            this.app.orbit.update();
        }

        this.selectedShotIndex = this.shots.indexOf(shot);
        this.editingFrame = frameType;
        this.viewMode = 'frame';
        this.previewActive = false;
        this.clearPreviewBlur();
        this.clearTransitionOverlay();
        this.app.setControlMode?.('camera');
        this.refreshUI();
    }

    updateAlignButton() {
        const button = document.getElementById('align-frame-btn');
        if (!button) return;
        const visible = !!this.selectedShot && !this.playing && !this.previewActive && !this.framingControls;
        button.classList.toggle('hidden', !visible);
    }

    alignFrameToView() {
        const shot = this.selectedShot;
        if (!shot) return;
        const camera = this.app.camera;
        camera.updateMatrixWorld(true);
        const position = new V3();
        const quaternion = new THREE.Quaternion();
        camera.getWorldPosition(position);
        camera.getWorldQuaternion(quaternion);
        const targetFrame = this.editingFrame === 'end' ? 'endFrame' : 'startFrame';
        shot[targetFrame] = {
            position: position.toArray(),
            quaternion: quaternion.toArray(),
            target: this.app.orbit?.target?.toArray?.() || null,
            fov: camera.fov ?? 55
        };
        this.previewActive = false;
        this.clearPreviewBlur();
        this.refreshUI();
        this.app.ui?.showNotification?.(`${this.editingFrame === 'end' ? 'End' : 'Start'} frame aligned to view`, 'success');
    }

    clearTransitionOverlay() {
        const overlay = this._transitionOverlay || document.getElementById('transition-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.background = '#000';
        }
    }

    updateTransitionOverlay(active) {
        const overlay = this._transitionOverlay || document.getElementById('transition-overlay');
        if (!overlay || !active) return this.clearTransitionOverlay();
        this._transitionOverlay = overlay;

        const index = active.shotIndex;
        const shot = active.shot;
        let alpha = 0;
        let color = '#000000';

        if (shot.transition?.type && shot.transition.type !== 'none' && index < this.shots.length - 1) {
            const length = Math.max(0.01, shot.transition.length || 1);
            if (active.localT > shot.duration - length) {
                alpha = clamp((active.localT - (shot.duration - length)) / length) * (shot.transition.opacity ?? 1);
                color = shot.transition.color || '#000000';
            }
        }

        const previous = index > 0 ? this.shots[index - 1] : null;
        if (previous?.transition?.type && previous.transition.type !== 'none') {
            const length = Math.max(0.01, previous.transition.length || 1);
            if (active.localT < length) {
                alpha = Math.max(alpha, (1 - active.localT / length) * (previous.transition.opacity ?? 1));
                color = previous.transition.color || '#000000';
            }
        }

        overlay.style.background = color;
        overlay.style.opacity = String(clamp(alpha));
    }

    ensurePathPreview() {
        if (this.pathLine || !this.app.scene) return;
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: 0xf3b63f, transparent: true, opacity: 0.9 });
        this.pathLine = new THREE.Line(geometry, material);
        this.pathLine.name = 'shot-path-preview';
        this.pathLine.visible = false;
        this.app.scene.add(this.pathLine);

        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xf3b63f });
        this.pathMarkers = [
            new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), markerMaterial),
            new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), markerMaterial)
        ];
        this.pathMarkers.forEach(marker => {
            marker.visible = false;
            this.app.scene.add(marker);
        });
    }

    setShowPath(show) {
        this.showPath = !!show;
        this.updatePathPreview();
    }

    applyShotMove(camera, rig, shot, localT, time) {
        const u = clamp(localT / shot.duration);
        const easingFn = this.getEasingForShot(shot);
        const easedU = easingFn(u);
        
        const spec = shot.spec;
        const hasCustomStart = shot.startFrame;
        const hasCustomEnd = shot.endFrame;
        
        // Base camera position (orbit around target)
        const targetPos = new V3();
        if (hasCustomStart && hasCustomEnd) {
            // Interpolate between custom start and end frames
            const startPos = new V3().fromArray(shot.startFrame.position);
            const endPos = new V3().fromArray(shot.endFrame.position);
            camera.position.lerpVectors(startPos, endPos, easedU);
            
            const startQuat = new THREE.Quaternion().fromArray(shot.startFrame.quaternion);
            const endQuat = new THREE.Quaternion().fromArray(shot.endFrame.quaternion);
            camera.quaternion.slerpQuaternions(startQuat, endQuat, easedU);
            
            camera.fov = lerp([shot.startFrame.fov, shot.endFrame.fov], easedU);
            camera.updateProjectionMatrix();
        } else if (hasCustomStart) {
            // Start from custom frame, apply the preset move relative to it.
            this.applyMoveRelativeToFrame(camera, rig, shot, easedU, 'start', time);
        } else if (hasCustomEnd) {
            // Finish on the custom frame, applying the preset move relative to it.
            this.applyMoveRelativeToFrame(camera, rig, shot, easedU, 'end', time);
        } else {
            // Auto framing - orbit around the rig's aim target.
            this.applyMoveAuto(camera, rig, shot, easedU, time);
        }
        
        camera.updateMatrixWorld(true);
    }

    getEasingForShot(shot) {
        if (Array.isArray(shot?.curve) && shot.curve.length === 4) {
            return (u) => cubicBezierEasing(shot.curve, clamp(u));
        }
        return getEasing(shot?.easing);
    }

    getMoveScale() {
        const now = performance.now();
        if (now - this._moveScaleAt < 500) return this._moveScale;

        const box = new THREE.Box3();
        let hasBounds = false;
        for (const object of this.app.objects || []) {
            if (object.userData?.rigRef) continue;
            box.expandByObject(object);
            hasBounds = true;
        }

        if (hasBounds) {
            const size = box.getSize(new V3());
            const span = Math.max(size.x, size.z, 2);
            this._moveScale = clamp(span / 35, 0.22, 1);
        } else {
            this._moveScale = 0.3;
        }
        this._moveScaleAt = now;
        return this._moveScale;
    }

    applyMoveAuto(camera, rig, shot, u, time) {
        const spec = shot.spec;
        const moveScale = this.getMoveScale();
        const easingFn = this.getEasingForShot(shot);
        
        // Handle phase for in/out easing
        const ph = spec.ph || 0;
        const ua = easingFn(ph === 2 ? clamp(2 * u - 1) : ph === 1 ? clamp(2 * u) : u);
        const ub = easingFn(ph === 2 ? clamp(2 * u) : ph === 1 ? clamp(2 * u - 1) : u);
        const uu = easingFn(u);
        
        // The rig target is the point the camera orbits around.
        const basePos = (rig.target || new V3(0, 1.5, 0)).clone();
        
        // Apply move parameters
        const a = lerpArray(spec.a || [0, 0], ua) * D2R;
        const r = lerpArray(spec.r || [40, 40], ua) * moveScale;
        const rawHeight = lerpArray(spec.h || [7, 7], ub);
        const h = basePos.y + (rawHeight - basePos.y) * moveScale;

        let x = spec.x ? lerpArray(spec.x, uu) * moveScale : 0;
        let v = spec.v ? lerpArray(spec.v, uu) * moveScale : 0;
        
        // Shake/wobble - use actual time for noise
        const s = (spec.s || 0);
        const sf = spec.sf || 9;
        const sd = spec.sd || 0;
        const sa = s * Math.exp(-sd * u);
        
        // sn(t, f, s) = sin(t * f + s)
        const sn = (t, f, s = 0) => Math.sin(t * f + s);
        const nz = (k) => sa * (sn(time, sf, k) + 0.6 * sn(time, sf * 2.3, k * 1.7) + 0.4 * sn(time, sf * 0.43, k * 2.9));
        
        if (spec.wv) x += sn(time, 2.2) * spec.wv * moveScale;
        
        const pos = new V3(
            basePos.x + Math.sin(a) * r + x + nz(1) * 0.25,
            h + v + (spec.bob ? sn(time, spec.bf) * spec.bob * moveScale : 0) + nz(2) * 0.25,
            basePos.z + Math.cos(a) * r
        );
        
        const look = new V3(
            basePos.x + (spec.tr ? 0 : x),
            basePos.y + (spec.tr ? 0 : v),
            basePos.z
        );
        
        let yw = spec.y ? lerpArray(spec.y, uu) : 0;
        let pt = spec.p ? lerpArray(spec.p, uu) : 0;
        let rl = spec.o ? lerpArray(spec.o, uu) : 0;
        
        if (spec.dr) {
            yw += spec.dr * (12 * sn(time, 0.9) + 4 * sn(time, 2.3));
            pt += spec.dr * 6 * sn(time, 1.3);
            rl += spec.dr * 10 * sn(time, 0.7);
        }
        if (spec.wv) rl += Math.cos(2.2 * time) * spec.wv * 1.5;
        
        yw += nz(3) * 8;
        pt += nz(4) * 8;
        rl += nz(5) * 6;
        
        const d = look.sub(pos);
        d.applyAxisAngle(Y, yw * D2R);
        d.applyAxisAngle(new V3().crossVectors(d, Y).normalize(), pt * D2R);
        
        camera.position.copy(pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(pos.clone().add(d));
        camera.rotateZ(rl * D2R);
        
        const f = lerpArray(spec.f || [55, 55], uu);
        if (camera.fov !== f) {
            camera.fov = f;
            camera.updateProjectionMatrix();
        }
    }

    applyMoveRelativeToFrame(camera, rig, shot, u, frameType, time) {
        const frame = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
        if (!frame) return this.applyMoveAuto(camera, rig, shot, u, time);

        // Compute the same preset at the anchor and at the current u, then
        // offset the whole move so the custom frame is preserved.
        const autoAnchor = camera.clone();
        const autoNow = camera.clone();
        this.applyMoveAuto(autoAnchor, rig, shot, frameType === 'start' ? 0 : 1, time);
        this.applyMoveAuto(autoNow, rig, shot, u, time);

        const anchorPos = new V3().fromArray(frame.position);
        const anchorQuat = new THREE.Quaternion().fromArray(frame.quaternion);
        const inverseAnchor = autoAnchor.quaternion.clone().invert();

        camera.position.copy(anchorPos).add(autoNow.position).sub(autoAnchor.position);
        camera.quaternion.copy(anchorQuat).multiply(inverseAnchor).multiply(autoNow.quaternion);
        camera.fov = (frame.fov ?? autoNow.fov) + (autoNow.fov - autoAnchor.fov);
        camera.updateProjectionMatrix();
    }

    setCustomFrame(frameType) {
        const active = this.getActiveShot();
        if (!active) return;
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(active.shot.cameraId);
        if (!rig) return;
        
        rig.camera.updateMatrixWorld(true);
        const worldPosition = new V3();
        const worldQuaternion = new THREE.Quaternion();
        rig.camera.getWorldPosition(worldPosition);
        rig.camera.getWorldQuaternion(worldQuaternion);
        const frame = {
            position: worldPosition.toArray(),
            quaternion: worldQuaternion.toArray(),
            target: rig.target?.toArray?.() || null,
            fov: rig.camera.fov
        };
        
        active.shot[frameType === 'start' ? 'startFrame' : 'endFrame'] = frame;
        this.refreshUI();
        this.app.ui?.showNotification(`${frameType} frame set`, 'success');
    }

    clearCustomFrame(frameType) {
        const shot = this.selectedShot;
        if (!shot) return;
        shot[frameType === 'start' ? 'startFrame' : 'endFrame'] = null;
        this.refreshUI();
    }

    getShotStartTime(shotIndex) {
        let t = 0;
        for (let i = 0; i < shotIndex; i++) {
            t += this.shots[i].duration;
        }
        return t;
    }

    updatePathPreview() {
        this.ensurePathPreview();
        if (!this.pathLine) return;

        if (!this.showPath) {
            this.pathLine.visible = false;
            this.pathMarkers.forEach(marker => marker.visible = false);
            return;
        }

        const active = this.getActiveShot();
        if (!active) {
            this.pathLine.visible = false;
            this.pathMarkers.forEach(marker => marker.visible = false);
            return;
        }
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(active.shot.cameraId);
        if (!rig) return;
        
        const points = [];
        const steps = 40;

        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const tempCamera = rig.camera.clone();
            this.applyShotMove(tempCamera, rig, active.shot, u * active.shot.duration, 0);
            points.push(tempCamera.position.clone());
        }
        
        this.pathLine.geometry.setFromPoints(points);
        
        this.pathLine.visible = true;
        if (this.pathMarkers[0]) {
            this.pathMarkers[0].visible = true;
            this.pathMarkers[0].position.copy(points[0]);
        }
        if (this.pathMarkers[1]) {
            this.pathMarkers[1].visible = true;
            this.pathMarkers[1].position.copy(points[points.length - 1]);
        }
    }

    buildUI() {
        if (this.ui) return;

        const bar = document.getElementById('shot-timeline');
        if (!bar) return;
        bar.style.display = 'none';

        const pauseBtn = document.getElementById('timeline-pause');
        const stopBtn = document.getElementById('timeline-stop');
        const playShotBtn = document.getElementById('timeline-play-shot');
        const playAllBtn = document.getElementById('timeline-play-all');
        const label = document.getElementById('shot-time-label');
        const addBtn = document.getElementById('timeline-add-shot');
        const loopCheck = document.getElementById('timeline-loop');
        const pathCheck = document.getElementById('timeline-show-path');

        const formatTime = (seconds) => {
            const safe = Math.max(0, seconds || 0);
            return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(1).padStart(4, '0')}`;
        };

        this.ui = {
            root: bar,
            pauseBtn,
            label,
            addBtn,
            loopCheck,
            pathCheck,
            updateScrubber: () => {
                if (label) label.textContent = `${formatTime(this.currentTime)} / ${formatTime(this.duration)}`;
                if (pauseBtn) pauseBtn.style.display = this.playing ? 'inline-block' : 'none';
                const indicator = document.getElementById('shot-time-indicator');
                if (indicator) {
                    indicator.style.left = this.duration > 0 ? (this.currentTime / this.duration) * 100 + '%' : '0%';
                }
            }
        };
        this.buildTimelineUI();

        if (stopBtn) stopBtn.onclick = () => this.stop();
        if (playShotBtn) playShotBtn.onclick = () => this.playShot();
        if (playAllBtn) playAllBtn.onclick = () => this.playAll();
        if (pauseBtn) pauseBtn.onclick = () => this.pause();
        if (loopCheck) {
            loopCheck.checked = this.loop;
            loopCheck.onchange = () => { this.loop = loopCheck.checked; };
        }
        if (pathCheck) {
            pathCheck.checked = this.showPath;
            pathCheck.onchange = () => this.setShowPath(pathCheck.checked);
        }
        if (addBtn) addBtn.onclick = () => this.addShotForSelectedCamera();
        document.getElementById('timeline-export-pdf')?.addEventListener('click', () => this.app.exportStoryboardPDF?.());
        document.getElementById('timeline-report')?.addEventListener('click', () => this.app.openStoryboardReport?.());
        document.getElementById('align-frame-btn')?.addEventListener('click', () => this.alignFrameToView());
    }

    buildTimelineUI() {
        if (this.ui.pauseBtn) this.ui.pauseBtn.style.display = this.playing ? 'inline-block' : 'none';
        this.buildTimelineTrack(document.querySelector('.shot-timeline-track'));
    }

    createShotCard(shot, index, currentRig) {
        const isSelected = index === this.selectedShotIndex;
        const rig = this.app.staging?.cameras?.get(shot.cameraId);
        
        const card = document.createElement('div');
        card.className = `shot-card ${isSelected ? 'selected' : ''}`;
        card.dataset.index = index;
        
        const color = rig?.color ? '#' + rig.color.toString(16).padStart(6, '0') : '#888';
        
        card.innerHTML = `
            <div class="shot-card-header">
                <div class="shot-card-title">
                    <span class="shot-card-color-dot" style="background: ${color};"></span>
                    <b style="color: ${color};">CAM ${rig?.name || '?'}</b>
                    <small class="shot-card-name">${shot.name}</small>
                </div>
                <div class="shot-card-actions">
                    <button class="shot-btn shot-btn-sm" data-action="move-up" title="Move earlier">▲</button>
                    <button class="shot-btn shot-btn-sm" data-action="move-down" title="Move later">▼</button>
                    <button class="shot-btn shot-btn-sm" data-action="duplicate" title="Duplicate">⧉</button>
                    <button class="shot-btn shot-btn-sm shot-btn-danger" data-action="delete" title="Delete">✕</button>
                </div>
            </div>
            
            <div class="shot-card-body">
                <div class="shot-field">
                    <label class="shot-field-label">Move:</label>
                    <select class="shot-select" data-prop="move">
                        ${this.getMoveOptions(shot.move)}
                    </select>
                </div>
                
                <div class="shot-field">
                    <label class="shot-field-label" style="width: 50px;">Length:</label>
                    <input type="range" class="shot-range" data-prop="duration" min="0.5" max="30" step="0.5" value="${shot.duration}">
                    <span class="shot-value">${shot.duration.toFixed(1)}s</span>
                </div>
                
                <div class="shot-field">
                    <label class="shot-field-label" style="width: 50px;">Speed:</label>
                    <input type="range" class="shot-range" data-prop="speed" min="0.05" max="8" step="0.05" value="${shot.speed}">
                    <span class="shot-value">×${shot.speed}</span>
                </div>
                
                <div class="shot-field">
                    <label class="shot-field-label" style="width: 50px;">Easing:</label>
                    <select class="shot-select" data-prop="easing">
                        ${['io', 'in', 'out', 'lin', 'ramp'].map(e => `<option value="${e}"${e === shot.easing ? ' selected' : ''}>${e}</option>`).join('')}
                    </select>
                </div>
                
                <div class="shot-field">
                    <label class="shot-field-label" style="width: 50px;">FOV:</label>
                    <input type="range" class="shot-range" data-prop="fov" min="15" max="120" step="1" value="${shot.spec.f || 55}">
                    <span class="shot-value">${Math.round(shot.spec.f || 55)}°</span>
                </div>
                
                <fieldset class="shot-fieldset">
                    <legend>Framing</legend>
                    <div class="framing-btn-group">
                        <button class="shot-btn framing-btn" data-action="edit-start"${shot.startFrame ? '' : ''}>${this.editingFrame === 'start' && this.viewMode === 'frame' ? '⬤' : '○'} Start</button>
                        <button class="shot-btn framing-btn" data-action="edit-end">${this.editingFrame === 'end' && this.viewMode === 'frame' ? '⬤' : '○'} End</button>
                    </div>
                    <div class="framing-btn-group">
                        <button class="shot-btn framing-btn" data-action="view-frame">${this.viewMode === 'frame' ? 'Frame View' : 'Frame'}</button>
                        <button class="shot-btn framing-btn" data-action="view-explore">${this.viewMode === 'explore' ? 'Explore' : 'Explore'}</button>
                    </div>
                    <div class="framing-btn-group">
                        <button class="shot-btn framing-btn" data-action="drag-translate">${this.dragMode === 'translate' ? 'Drag: Move' : 'Move'}</button>
                        <button class="shot-btn framing-btn" data-action="drag-rotate">${this.dragMode === 'rotate' ? 'Drag: Rotate' : 'Rotate'}</button>
                    </div>
                    <div class="framing-btn-group">
                        <button class="shot-btn framing-btn" data-action="reset-start"${!shot.startFrame ? ' disabled' : ''}>Reset Start</button>
                        <button class="shot-btn framing-btn" data-action="reset-end"${!shot.endFrame ? ' disabled' : ''}>Reset End</button>
                    </div>
                    ${this.viewMode === 'frame' ? `
                    <div class="framing-btn-group">
                        <button class="shot-btn framing-btn" data-action="commit-frame">Confirm Frame</button>
                        <button class="shot-btn framing-btn shot-btn-danger" data-action="cancel-frame">Cancel</button>
                    </div>
                    ` : ''}
                </fieldset>
                
                <fieldset class="shot-fieldset">
                    <legend>Blur</legend>
                    <div class="shot-field">
                        <label class="shot-field-label">Start</label>
                        <input type="range" class="shot-range" data-prop="blurStart" min="0" max="20" step="0.5" value="${shot.blurStart}">
                    </div>
                    <div class="shot-field">
                        <label class="shot-field-label">End</label>
                        <input type="range" class="shot-range" data-prop="blurEnd" min="0" max="20" step="0.5" value="${shot.blurEnd}">
                    </div>
                </fieldset>
            </div>
        `;
        
        // Event listeners
        card.querySelectorAll('.shot-btn[data-action]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.handleCardAction(shot, index, btn.dataset.action);
            };
        });
        
        card.querySelectorAll('.shot-select[data-prop]').forEach(sel => {
            sel.onchange = (e) => {
                shot[sel.dataset.prop] = sel.value;
                if (sel.dataset.prop === 'move') {
                    shot.spec = getMoveSpec(shot.move);
                    if (shot.spec.d) shot.duration = shot.spec.d;
                }
                this.refreshUI();
            };
        });
        
        card.querySelectorAll('.shot-range[data-prop]').forEach(range => {
            range.oninput = (e) => {
                const prop = range.dataset.prop;
                const val = parseFloat(range.value);
                if (prop === 'fov') {
                    shot.spec.f = [val, val];
                } else {
                    shot[prop] = val;
                }
                range.nextElementSibling?.textContent && (range.nextElementSibling.textContent = 
                    prop === 'duration' ? `${val.toFixed(1)}s` : 
                    prop === 'speed' ? `×${val}` : val);
                if (prop === 'duration') this.refreshUI();
            };
        });
        
        // Click card to select
        card.onclick = (e) => {
            if (e.target.closest('.shot-btn') || e.target.closest('.shot-select') || e.target.closest('.shot-range')) return;
            this.selectedShotIndex = index;
            this.seek(this.getShotStartTime(index));
            this.refreshUI();
        };
        
        return card;
    }

    getMoveOptions(selected) {
        return SHOT_CATEGORIES.map(([cat, moves]) => 
            `<optgroup label="${cat}">${moves.map(([name]) => `<option value="${name}"${name === selected ? ' selected' : ''}>${name}</option>`).join('')}</optgroup>`
        ).join('');
    }

    handleCardAction(shot, index, action) {
        switch (action) {
            case 'move-up':
                this.moveShot(shot.id, -1);
                break;
            case 'move-down':
                this.moveShot(shot.id, 1);
                break;
            case 'duplicate':
                this.duplicateShot(shot.id);
                break;
            case 'delete':
                if (this.shots.length > 1) this.removeShot(shot.id);
                break;
            case 'edit-start':
                this.editingFrame = 'start';
                this.viewMode = 'frame';
                this.enterFramingMode(shot, 'start');
                this.refreshUI();
                break;
            case 'edit-end':
                this.editingFrame = 'end';
                this.viewMode = 'frame';
                this.enterFramingMode(shot, 'end');
                this.refreshUI();
                break;
            case 'view-frame':
                this.viewMode = 'frame';
                this.refreshUI();
                break;
            case 'view-explore':
                this.viewMode = 'explore';
                if (this.app.orbit) this.app.orbit.enabled = true;
                this.refreshUI();
                break;
            case 'drag-translate':
                this.dragMode = 'translate';
                this.refreshUI();
                break;
            case 'drag-rotate':
                this.dragMode = 'rotate';
                this.refreshUI();
                break;
            case 'reset-start':
                shot.startFrame = null;
                this.refreshUI();
                break;
            case 'reset-end':
                shot.endFrame = null;
                this.refreshUI();
                break;
            case 'commit-frame':
                this.commitFraming(this.editingFrame);
                break;
            case 'cancel-frame':
                this.cancelFraming();
                break;
        }
    }

    enterFramingMode(shot, frameType) {
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(shot.cameraId);
        if (!rig) return;

        // Store the real camera transform and target so Cancel is lossless.
        rig.group.updateMatrixWorld(true);
        this.framingState.position.copy(rig.group.position);
        this.framingState.quaternion.copy(rig.group.quaternion);
        this.framingState.target.copy(rig.target);
        this.framingState.fov = rig.camera.fov;
        this.framingRig = rig;
        this.app.updateKeyframeGizmos?.();
        this.clearPreviewBlur();

        // Detach the real camera while orbiting, otherwise OrbitControls would
        // treat the camera's local child transform as its world position.
        const worldPosition = new V3();
        const worldQuaternion = new THREE.Quaternion();
        rig.group.getWorldPosition(worldPosition);
        rig.group.getWorldQuaternion(worldQuaternion);
        if (rig.camera.parent !== this.app.scene) this.app.scene.add(rig.camera);
        rig.camera.position.copy(worldPosition);
        rig.camera.quaternion.copy(worldQuaternion);
        rig.camera.scale.set(1, 1, 1);
        rig.camera.updateMatrixWorld(true);

        // Disable main orbit controls
        if (this.app.orbit) this.app.orbit.enabled = false;

        if (this.framingControls) this.framingControls.dispose();
        this.framingControls = new OrbitControls(rig.camera, this.app.renderer.domElement);
        this.framingControls.target.copy(rig.target);
        this.framingControls.enableDamping = true;
        this.framingControls.dampingFactor = 0.05;
        this.framingControls.enablePan = true;
        this.framingControls.enableZoom = true;
        this.framingControls.enableRotate = true;
        this.framingControls.minDistance = 0.1;
        this.framingControls.maxDistance = 100;
        this.framingControls.update();

        this.app.ui?.showNotification(`Framing ${frameType} frame. Move camera, then click Confirm or Cancel.`, 'info');
    }

    commitFraming(frameType) {
        const shot = this.selectedShot;
        const rig = this.framingRig;
        if (!shot || !rig) return;

        rig.camera.updateMatrixWorld(true);
        const worldPosition = new V3();
        const worldQuaternion = new THREE.Quaternion();
        rig.camera.getWorldPosition(worldPosition);
        rig.camera.getWorldQuaternion(worldQuaternion);
        const frame = {
            position: worldPosition.toArray(),
            quaternion: worldQuaternion.toArray(),
            target: this.framingControls?.target?.toArray?.() || rig.target.toArray(),
            fov: rig.camera.fov
        };

        shot[frameType === 'start' ? 'startFrame' : 'endFrame'] = frame;

        rig.group.position.copy(worldPosition);
        rig.group.quaternion.copy(worldQuaternion);
        if (this.framingControls?.target) rig.target.copy(this.framingControls.target);

        this.exitFramingMode();
        this.refreshUI();
        this.app.ui?.showNotification(`${frameType} frame saved`, 'success');
    }

    cancelFraming() {
        const rig = this.framingRig;
        if (!rig) return;

        rig.group.position.copy(this.framingState.position);
        rig.group.quaternion.copy(this.framingState.quaternion);
        rig.target.copy(this.framingState.target);
        rig.camera.fov = this.framingState.fov;
        rig.camera.updateProjectionMatrix();

        this.exitFramingMode();
        this.refreshUI();
        this.app.ui?.showNotification('Framing cancelled', 'info');
    }

    exitFramingMode() {
        const rig = this.framingRig;
        if (this.framingControls) {
            this.framingControls.dispose();
            this.framingControls = null;
        }
        if (rig) {
            if (rig.camera.parent === this.app.scene) this.app.scene.remove(rig.camera);
            rig.group.add(rig.camera);
            rig.camera.position.set(0, 0, 0);
            rig.camera.quaternion.identity();
            rig.camera.scale.set(1, 1, 1);
            rig.camera.updateMatrixWorld(true);
            rig.group.updateMatrixWorld(true);
        }
        this.framingRig = null;
        this.clearPreviewBlur();
        this.app.updateKeyframeGizmos?.();
        if (this.app.orbit) this.app.orbit.enabled = this.app.controlMode === 'camera';
    }

    buildTimelineTrack(container) {
        if (!container) return;
        container.innerHTML = '';
        
        const total = this.duration;
        if (total === 0) return;
        
        // Time ruler
        const ruler = document.createElement('div');
        ruler.className = 'shot-timeline-ruler';
        ruler.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; height: 16px; font-size: 8px; color: var(--text-secondary);';
        const step = total > 60 ? 10 : total > 24 ? 5 : total > 10 ? 2 : 1;
        for (let t = 0; t <= total; t += step) {
            const mark = document.createElement('i');
            mark.style.cssText = `position: absolute; left: ${t / total * 100}%; top: 0; width: 1px; height: 8px; background: #444;`;
            ruler.appendChild(mark);
            const label = document.createElement('span');
            label.style.cssText = `position: absolute; left: ${t / total * 100}%; top: 8px; transform: translateX(-50%); white-space: nowrap;`;
            label.textContent = `${t}s`;
            ruler.appendChild(label);
        }
        container.appendChild(ruler);
        
        // Track drag state
        let dragShotIdx = null;
        let dragStartX = 0;
        let dragStartLeft = 0;
        let dragStartDuration = 0;
        let resizeEdge = null; // 'left' | 'right'
        let resizeStartX = 0;
        let resizeStartLeft = 0;
        let resizeStartDuration = 0;
        
        const containerRect = container.getBoundingClientRect();
        
        const getShotIndexAtTime = (t) => {
            let elapsed = 0;
            for (let i = 0; i < this.shots.length; i++) {
                if (t < elapsed + this.shots[i].duration) return i;
                elapsed += this.shots[i].duration;
            }
            return null;
        };
        
        const reorderShots = (fromIdx, toIdx) => {
            if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= this.shots.length || toIdx >= this.shots.length) return;
            const shot = this.shots.splice(fromIdx, 1)[0];
            this.shots.splice(toIdx, 0, shot);
            this.selectedShotIndex = toIdx;
            this.refreshUI();
        };
        
        const adjustDuration = (shotIdx, newDuration) => {
            if (shotIdx < 0 || shotIdx >= this.shots.length) return;
            newDuration = Math.max(0.5, Math.min(30, newDuration));
            const oldDuration = this.shots[shotIdx].duration;
            this.shots[shotIdx].duration = newDuration;
            this.refreshUI();
        };
        
        const onMouseMove = (e) => {
            const x = e.clientX;
            
            if (resizeEdge !== null && dragShotIdx !== null) {
                const dx = x - resizeStartX;
                const dxPct = (dx / containerRect.width) * 100;
                const totalPct = total * (dxPct / 100);
                
                if (resizeEdge === 'left') {
                    const newLeft = Math.max(0, dragStartLeft + totalPct);
                    const newDuration = Math.max(0.5, dragStartDuration - totalPct);
                    const newStartTime = newLeft / 100 * total;
                    
                    // Shift subsequent shots
                    let shift = newStartTime - (dragStartLeft / 100 * total);
                    for (let j = dragShotIdx + 1; j < this.shots.length; j++) {
                        this.shots[j].startTime = (this.shots[j].startTime || 0) + shift;
                    }
                    
                    this.shots[dragShotIdx].duration = newDuration;
                    // Update start times stored on shots
                    let elapsed = 0;
                    for (let j = 0; j < this.shots.length; j++) {
                        this.shots[j]._startTime = elapsed;
                        elapsed += this.shots[j].duration;
                    }
                } else if (resizeEdge === 'right') {
                    const newDuration = Math.max(0.5, dragStartDuration + totalPct);
                    this.shots[dragShotIdx].duration = newDuration;
                    
                    // Shift subsequent shots
                    let shift = newDuration - dragStartDuration;
                    let elapsed = 0;
                    for (let j = 0; j < this.shots.length; j++) {
                        this.shots[j]._startTime = elapsed;
                        elapsed += this.shots[j].duration;
                    }
                }
                this.refreshUI();
                return;
            }
            
            if (dragShotIdx !== null) {
                const dx = x - dragStartX;
                const dxSeconds = (dx / containerRect.width) * total;
                const currentStart = this.shots[dragShotIdx]._startTime || 0;
                const newStart = Math.max(0, currentStart + dxSeconds);
                
                // Find target position
                let targetIdx = dragShotIdx;
                let elapsed = 0;
                for (let j = 0; j < this.shots.length; j++) {
                    if (j === dragShotIdx) continue;
                    const shotStart = this.shots[j]._startTime || 0;
                    const shotDur = this.shots[j].duration;
                    if (newStart >= shotStart && newStart < shotStart + shotDur) {
                        targetIdx = j;
                        break;
                    }
                }
                
                if (targetIdx !== dragShotIdx) {
                    reorderShots(dragShotIdx, targetIdx);
                    dragShotIdx = targetIdx;
                    dragStartX = x;
                    dragStartLeft = (this.shots[targetIdx]._startTime || 0) / total * 100;
                }
            }
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            dragShotIdx = null;
            resizeEdge = null;
            container.classList.remove('drag-over');
            document.querySelectorAll('.shot-timeline-block').forEach(b => b.classList.remove('dragging'));
            this.refreshUI();
        };
        
        container.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('shot-timeline-ruler') || e.target.parentElement?.classList.contains('shot-timeline-ruler')) return;
            if (e.target.classList.contains('shot-time-indicator')) return;
        });
        
        // Shot blocks
        let elapsed = 0;
        this.shots.forEach((shot, i) => {
            const rig = this.app.staging?.cameras?.get(shot.cameraId);
            const color = rig?.color ? '#' + rig.color.toString(16).padStart(6, '0') : '#888';
            const left = (elapsed / total) * 100;
            const width = (shot.duration / total) * 100;
            shot._startTime = elapsed;
            
            const block = document.createElement('div');
            block.className = 'shot-timeline-block';
            block.style.cssText = `
                position: absolute;
                left: ${left}%;
                width: ${width}%;
                top: ${i % 2 === 0 ? '24px' : '74px'};
                height: 42px;
                background: ${color}40;
                border: 1px solid ${color}80;
                border-radius: 3px;
                color: ${color};
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 4px;
                z-index: 2;
            `;
            block.textContent = `${i + 1}: ${shot.move} (${shot.duration.toFixed(1)}s)`;
            block.title = `Shot ${i + 1}: ${shot.move} — ${shot.duration.toFixed(1)}s`;
            block.dataset.shotIndex = i;
            
            // Resize handle - left
            const resizeLeft = document.createElement('div');
            resizeLeft.className = 'shot-timeline-resize shot-timeline-resize-left';
            resizeLeft.dataset.shotIndex = i;
            resizeLeft.dataset.edge = 'left';
            block.appendChild(resizeLeft);
            
            // Resize handle - right
            const resizeRight = document.createElement('div');
            resizeRight.className = 'shot-timeline-resize shot-timeline-resize-right';
            resizeRight.dataset.shotIndex = i;
            resizeRight.dataset.edge = 'right';
            block.appendChild(resizeRight);
            
            // Click to select/preview
            block.onclick = (e) => {
                e.stopPropagation();
                this.selectedShotIndex = i;
                this.seek(elapsed);
                this.refreshUI();
            };
            
            // Drag start (block body)
            block.onmousedown = (e) => {
                e.stopPropagation();
                e.preventDefault();
                dragShotIdx = i;
                dragStartX = e.clientX;
                dragStartLeft = left;
                dragStartDuration = shot.duration;
                block.classList.add('dragging');
                container.classList.add('drag-over');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            
            // Resize start
            const onResizeStart = (e, edge) => {
                e.stopPropagation();
                e.preventDefault();
                dragShotIdx = i;
                resizeEdge = edge;
                resizeStartX = e.clientX;
                resizeStartLeft = left;
                resizeStartDuration = shot.duration;
                block.classList.add('dragging');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            
            resizeLeft.onmousedown = (e) => onResizeStart(e, 'left');
            resizeRight.onmousedown = (e) => onResizeStart(e, 'right');
            
            // Keyframe markers — always visible, custom frames are filled.
            ['start', 'end'].forEach(frameType => {
                const frame = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
                const isCurrent = i === this.selectedShotIndex && this.editingFrame === frameType;
                const kf = document.createElement('i');
                kf.className = 'shot-timeline-kf'
                    + (frame ? ' custom' : '')
                    + (isCurrent ? ' active' : '');
                kf.dataset.shotIndex = i;
                kf.dataset.frameType = frameType;
                kf.style.left = frameType === 'start' ? '0' : '100%';
                kf.title = `${frameType === 'start' ? 'Start' : 'End'} keyframe ${frame ? '(custom)' : '(auto)'} — click to edit`;
                kf.onmousedown = (event) => event.stopPropagation();
                kf.onclick = (event) => {
                    event.stopPropagation();
                    this.selectedShotIndex = i;
                    this.editingFrame = frameType;
                    this.viewMode = 'frame';
                    this.previewActive = false;
                    this.clearPreviewBlur();
                    this.refreshUI();
                    this.jumpToFrame(shot, frameType);
                };
                block.appendChild(kf);
            });
            
            container.appendChild(block);

            if (shot.transition?.type && shot.transition.type !== 'none' && i < this.shots.length - 1) {
                const transition = document.createElement('div');
                transition.className = 'shot-timeline-transition-marker';
                transition.style.left = `${((elapsed + shot.duration) / total) * 100}%`;
                transition.style.top = `${i % 2 === 0 ? '70px' : '116px'}`;
                transition.title = `Transition: ${shot.transition.type} · ${(shot.transition.length || 1).toFixed(2)}s`;
                transition.textContent = '⇄';
                transition.onmousedown = (event) => event.stopPropagation();
                transition.onclick = (event) => {
                    event.stopPropagation();
                    this.selectedShotIndex = i;
                    this.app.ui._shotDesignerOpenIndex = i;
                    this.app.ui.renderShotDesignerList?.();
                    this.refreshUI();
                };
                container.appendChild(transition);
            }

            elapsed += shot.duration;
        });
        
        // Current time indicator
        const indicator = document.getElementById('shot-time-indicator');
        if (indicator) {
            indicator.style.left = total > 0 ? (this.currentTime / total) * 100 + '%' : '0%';
        }
        
        // Click/drag the ruler or empty track to seek.
        container.onmousedown = (e) => {
            if (e.target !== container && !e.target.classList.contains('shot-timeline-ruler') && !e.target.parentElement?.classList.contains('shot-timeline-ruler')) return;
            const rect = container.getBoundingClientRect();
            const time = Math.max(0, Math.min(total, ((e.clientX - rect.left) / rect.width) * total));
            this.seek(time);
        };
    }

    addShotForSelectedCamera() {
        const cameras = this.app.staging?.cameras;
        if (!cameras) return;
        const rig = this.app.selectedObject?.userData?.rigRef
            || cameras.defaultRig
            || cameras.ensureDefaultRig()
            || cameras.rigs[this.shots.length % Math.max(1, cameras.rigs.length)];
        if (!rig) {
            this.app.ui?.showNotification('No camera available', 'error');
            return;
        }
        this.createShot(rig.id);
    }

    mkBtn(text, fn, extra = '') {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = `
            padding: 4px 10px;
            background: #2a2a4e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            color: inherit;
            cursor: pointer;
            font-size: 11px;
            font-family: inherit;
            ${extra}
        `;
        b.onclick = fn;
        return b;
    }

    refreshUI() {
        if (!this.ui) return;
        this.buildTimelineUI();
        this.ui.updateScrubber();
        this.updatePathPreview();
        this.updateAlignButton();
        this.app.updateKeyframeGizmos?.();
    }

    toggleUI() {
        this.buildUI();
        const bar = this.ui.root;
        const show = bar.style.display === 'none';
        bar.style.display = show ? 'flex' : 'none';
        if (show) this.refreshUI();
    }

    exportTimeline() {
        return {
            format: 'pixelstaging-timeline',
            version: 1,
            shots: this.shots.map(s => ({
                id: s.id,
                cameraId: s.cameraId,
                name: s.name,
                move: s.move,
                spec: s.spec,
                duration: s.duration,
                speed: s.speed,
                easing: s.easing,
                startFrame: s.startFrame,
                endFrame: s.endFrame,
                blurStart: s.blurStart,
                blurEnd: s.blurEnd,
                transition: s.transition,
                curve: s.curve
            }))
        };
    }

    importTimeline(data) {
        if (!data?.shots || !Array.isArray(data.shots)) return false;
        this.shots = data.shots;
        this.selectedShotIndex = 0;
        this.currentTime = 0;
        this.playing = false;
        this.refreshUI();
        return true;
    }
}