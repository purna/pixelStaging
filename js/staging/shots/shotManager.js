import * as THREE from 'three';
import { D2R, clamp, lerp, lerpArray, EASING, getEasing } from './easing.js';
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
        
        // Framing state (for custom start/end frames)
        this.framingState = {
            position: new V3(),
            quaternion: new THREE.Quaternion(),
            fov: 55
        };
        
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
        if (this.shots.length === 0) return;
        this.playing = true;
        if (this.currentTime >= this.duration) this.currentTime = 0;
        this.refreshUI();
    }

    pause() {
        this.playing = false;
        this.refreshUI();
    }

    toggle() {
        this.playing ? this.pause() : this.play();
    }

    seek(t) {
        this.currentTime = clamp(t, 0, this.duration);
        if (this.ui) this.ui.updateScrubber();
        this.updatePathPreview();
    }

    update(delta) {
        if (!this.playing) return this.getPreviewCamera();
        
        this.currentTime += delta * this.playbackRate;
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                this.currentTime %= this.duration;
            } else {
                this.currentTime = this.duration;
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
        
        // Apply shot move to camera - pass the global time for noise functions
        const globalTime = this.app?.clock?.getElapsedTime() || 0;
        this.applyShotMove(rig.camera, rig.group, active.shot, active.localT, globalTime);
        
        return rig.camera;
    }

    applyShotMove(camera, rigGroup, shot, localT, time) {
        const u = clamp(localT / shot.duration);
        const easingFn = getEasing(shot.easing);
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
            // Start from custom frame, apply move relative to it
            this.applyMoveRelativeToFrame(camera, rigGroup, shot, easedU, 'start', time);
        } else if (hasCustomEnd) {
            // End at custom frame, apply move relative to it (reverse)
            this.applyMoveRelativeToFrame(camera, rigGroup, shot, 1 - easedU, 'end', time);
        } else {
            // Auto framing - use rig group as base
            this.applyMoveAuto(camera, rigGroup, shot, easedU, time);
        }
        
        camera.updateMatrixWorld(true);
    }

    applyMoveAuto(camera, rigGroup, shot, u, time) {
        const spec = shot.spec;
        const e = shot.easing === 'lin' ? 'lin' : shot.easing;
        const easingFn = getEasing(e);
        
        // Handle phase for in/out easing
        const ph = spec.ph || 0;
        const ua = easingFn(ph === 2 ? clamp(2 * u - 1) : ph === 1 ? clamp(2 * u) : u);
        const ub = easingFn(ph === 2 ? clamp(2 * u) : ph === 1 ? clamp(2 * u - 1) : u);
        const uu = easingFn(u);
        
        // Base position from rig group
        const basePos = rigGroup.position.clone();
        const baseTarget = basePos.clone();
        
        // Apply move parameters
        const a = lerpArray(spec.a || [0, 0], ua) * D2R;
        const r = lerpArray(spec.r || [40, 40], ua);
        const h = lerpArray(spec.h || [7, 7], ub);
        
        let x = spec.x ? lerpArray(spec.x, uu) : 0;
        let v = spec.v ? lerpArray(spec.v, uu) : 0;
        
        // Shake/wobble - use actual time for noise
        const s = (spec.s || 0);
        const sf = spec.sf || 9;
        const sd = spec.sd || 0;
        const sa = s * Math.exp(-sd * u);
        
        // sn(t, f, s) = sin(t * f + s)
        const sn = (t, f, s = 0) => Math.sin(t * f + s);
        const nz = (k) => sa * (sn(time, sf, k) + 0.6 * sn(time, sf * 2.3, k * 1.7) + 0.4 * sn(time, sf * 0.43, k * 2.9));
        
        if (spec.wv) x += sn(time, 2.2) * spec.wv;
        
        const pos = new V3(
            basePos.x + Math.sin(a) * r + x + nz(1) * 0.25,
            h + v + (spec.bob ? sn(time, spec.bf) * spec.bob : 0) + nz(2) * 0.25,
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

    applyMoveRelativeToFrame(camera, rigGroup, shot, u, frameType, time) {
        // Similar to applyMoveAuto but relative to a custom frame
        const frame = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
        if (!frame) return this.applyMoveAuto(camera, rigGroup, shot, u, time);
        
        const spec = shot.spec;
        const easingFn = getEasing(shot.easing);
        
        // This is a simplified version - in practice you'd want full relative move
        this.applyMoveAuto(camera, rigGroup, shot, u, time);
        
        // Then blend toward the custom frame
        if (frameType === 'end') {
            const targetPos = new V3().fromArray(frame.position);
            const targetQuat = new THREE.Quaternion().fromArray(frame.quaternion);
            camera.position.lerp(targetPos, u * 0.3);
            camera.quaternion.slerp(targetQuat, u * 0.3);
        }
    }

    setCustomFrame(frameType) {
        const active = this.getActiveShot();
        if (!active) return;
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(active.shot.cameraId);
        if (!rig) return;
        
        const frame = {
            position: rig.group.position.toArray(),
            quaternion: rig.group.quaternion.toArray(),
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
        if (!this.pathLine) return;
        
        const active = this.getActiveShot();
        if (!active) return;
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(active.shot.cameraId);
        if (!rig) return;
        
        const points = [];
        const steps = 40;
        
        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const tempCamera = rig.camera.clone();
            const tempGroup = rig.group.clone();
            this.applyShotMove(tempCamera, tempGroup, active.shot, u * active.shot.duration);
            points.push(tempCamera.position.clone());
        }
        
        this.pathLine.geometry.setFromPoints(points);
        
        // Update markers
        if (this.pathMarkers[0]) this.pathMarkers[0].position.copy(points[0]);
        if (this.pathMarkers[1]) this.pathMarkers[1].position.copy(points[points.length - 1]);
    }

    buildUI() {
        if (this.ui) return;
        
        // Create main shot timeline bar
        const bar = document.createElement('div');
        bar.id = 'shot-timeline-bar';
        bar.style.cssText = `
            position: absolute;
            left: 0; right: 0; bottom: 0;
            display: none;
            flex-direction: column;
            background: rgba(15, 15, 30, 0.95);
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            z-index: 50;
            font-size: 11px;
            color: #e8e8f0;
            font-family: 'JetBrains Mono', monospace;
        `;
        document.getElementById('canvas-container').appendChild(bar);
        
        this.ui = { root: bar };
        this.buildTimelineUI();
    }

    buildTimelineUI() {
        const bar = this.ui.root;
        bar.innerHTML = '';
        
        const shot = this.selectedShot;
        if (!shot) {
            bar.innerHTML = '<div style="padding: 12px; text-align: center; color: #888;">No shots. Add a virtual camera first, then click + Shot.</div>';
            return;
        }
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(shot.cameraId);
        
        // Top bar: transport controls
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);';
        
        const playBtn = this.mkBtn(this.playing ? '❚❚' : '▶', () => this.toggle(), 'width: 36px;');
        const timeLabel = document.createElement('span');
        timeLabel.id = 'shot-time-label';
        timeLabel.style.cssText = 'flex: 1; text-align: center; font-variant-numeric: tabular-nums;';
        timeLabel.textContent = `${this.currentTime.toFixed(1)} / ${this.duration.toFixed(1)}s`;
        
        const scrub = document.createElement('input');
        scrub.id = 'shot-scrub';
        scrub.type = 'range';
        scrub.min = 0;
        scrub.max = 1000;
        scrub.value = this.duration ? (this.currentTime / this.duration) * 1000 : 0;
        scrub.style.cssText = 'flex: 2; cursor: pointer;';
        scrub.oninput = (e) => {
            this.isScrubbing = true;
            this.seek((e.target.value / 1000) * this.duration);
        };
        scrub.onchange = () => { this.isScrubbing = false; };
        
        const addShotBtn = this.mkBtn('+ Shot', () => this.addShotForSelectedCamera());
        const loopBtn = this.mkBtn(this.loop ? '🔁' : '➡', () => { this.loop = !this.loop; this.refreshUI(); }, `background: ${this.loop ? '#2e7d32' : 'transparent'};`);
        loopBtn.title = 'Loop playback';
        
        topBar.append(playBtn, timeLabel, scrub, addShotBtn, loopBtn);
        bar.appendChild(topBar);
        
        // Shot cards area
        const cardsContainer = document.createElement('div');
        cardsContainer.id = 'shot-cards';
        cardsContainer.style.cssText = 'display: flex; gap: 8px; padding: 8px 12px; overflow-x: auto; max-height: 280px;';
        bar.appendChild(cardsContainer);
        
        this.shots.forEach((s, i) => {
            const card = this.createShotCard(s, i, rig);
            cardsContainer.appendChild(card);
        });
        
        // Timeline track visualization
        this.buildTimelineTrack(bar);
    }

    createShotCard(shot, index, currentRig) {
        const isSelected = index === this.selectedShotIndex;
        const rig = this.app.staging?.cameras?.get(shot.cameraId);
        
        const card = document.createElement('div');
        card.className = `shot-card ${isSelected ? 'selected' : ''}`;
        card.dataset.index = index;
        card.style.cssText = `
            min-width: 280px;
            max-width: 320px;
            flex-shrink: 0;
            background: ${isSelected ? 'rgba(0, 200, 255, 0.15)' : '#1a1a34'};
            border: 1px solid ${isSelected ? 'rgba(0, 200, 255, 0.5)' : 'rgba(255,255,255,0.15)'};
            border-radius: 8px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;
        
        const color = rig?.color ? '#' + rig.color.toString(16).padStart(6, '0') : '#888';
        
        card.innerHTML = `
            <div class="shot-card-header" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 10px; height: 10px; border-radius: 2px; background: ${color};"></span>
                    <b style="color: ${color};">CAM ${rig?.name || '?'}</b>
                    <small style="color: #888;">${shot.name}</small>
                </div>
                <div style="display: flex; gap: 2px;">
                    <button class="shot-btn" data-action="move-up" title="Move earlier" style="width: 20px; height: 20px; font-size: 10px;">▲</button>
                    <button class="shot-btn" data-action="move-down" title="Move later" style="width: 20px; height: 20px; font-size: 10px;">▼</button>
                    <button class="shot-btn" data-action="duplicate" title="Duplicate" style="width: 20px; height: 20px; font-size: 10px;">⧉</button>
                    <button class="shot-btn" data-action="delete" title="Delete" style="width: 20px; height: 20px; font-size: 10px; color: #f66;">✕</button>
                </div>
            </div>
            
            <div class="shot-card-body" style="display: flex; flex-direction: column; gap: 6px;">
                <div class="shot-field">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #aaa;">
                        Move:
                        <select class="shot-select" data-prop="move" style="flex: 1; background: #0d0d1a; border: 1px solid #333; color: inherit; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                            ${this.getMoveOptions(shot.move)}
                        </select>
                    </label>
                </div>
                
                <div class="shot-field" style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #aaa;">
                    <label style="width: 50px;">Length:</label>
                    <input type="range" class="shot-range" data-prop="duration" min="0.5" max="30" step="0.5" value="${shot.duration}" style="flex: 1;">
                    <span class="shot-value" style="width: 40px; text-align: right; font-variant-numeric: tabular-nums;">${shot.duration.toFixed(1)}s</span>
                </div>
                
                <div class="shot-field" style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #aaa;">
                    <label style="width: 50px;">Speed:</label>
                    <input type="range" class="shot-range" data-prop="speed" min="0.05" max="8" step="0.05" value="${shot.speed}" style="flex: 1;">
                    <span class="shot-value" style="width: 40px; text-align: right; font-variant-numeric: tabular-nums;">×${shot.speed}</span>
                </div>
                
                <div class="shot-field" style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #aaa;">
                    <label style="width: 50px;">Easing:</label>
                    <select class="shot-select" data-prop="easing" style="flex: 1; background: #0d0d1a; border: 1px solid #333; color: inherit; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                        ${['io', 'in', 'out', 'lin', 'ramp'].map(e => `<option value="${e}"${e === shot.easing ? ' selected' : ''}>${e}</option>`).join('')}
                    </select>
                </div>
                
                <div class="shot-field" style="display: flex; align-items: center; gap: 8px; font-size: 10px; color: #aaa;">
                    <label style="width: 50px;">FOV:</label>
                    <input type="range" class="shot-range" data-prop="fov" min="15" max="120" step="1" value="${shot.spec.f || 55}" style="flex: 1;">
                    <span class="shot-value" style="width: 40px; text-align: right; font-variant-numeric: tabular-nums;">${Math.round(shot.spec.f || 55)}°</span>
                </div>
                
                <fieldset style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px; font-size: 10px;">
                    <legend style="color: #aaa; padding: 0 4px;">Framing</legend>
                    <div style="display: flex; gap: 4px; margin-bottom: 6px;">
                        <button class="shot-btn framing-btn" data-action="edit-start" style="flex: 1; padding: 4px; background: ${shot.startFrame ? 'rgba(76, 175, 80, 0.3)' : 'transparent'};">${this.editingFrame === 'start' && this.viewMode === 'frame' ? '⬤' : '○'} Start Frame</button>
                        <button class="shot-btn framing-btn" data-action="edit-end" style="flex: 1; padding: 4px; background: ${shot.endFrame ? 'rgba(76, 175, 80, 0.3)' : 'transparent'};">${this.editingFrame === 'end' && this.viewMode === 'frame' ? '⬤' : '○'} End Frame</button>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="shot-btn framing-btn" data-action="view-frame" style="flex: 1; padding: 4px; background: ${this.viewMode === 'frame' ? 'rgba(0, 200, 255, 0.3)' : 'transparent'};">Frame View</button>
                        <button class="shot-btn framing-btn" data-action="view-explore" style="flex: 1; padding: 4px; background: ${this.viewMode === 'explore' ? 'rgba(0, 200, 255, 0.3)' : 'transparent'};">Explore</button>
                    </div>
                    <div style="display: flex; gap: 4px; margin-top: 4px;">
                        <button class="shot-btn framing-btn" data-action="drag-translate" style="flex: 1; padding: 2px; font-size: 9px; background: ${this.dragMode === 'translate' ? 'rgba(0, 200, 255, 0.3)' : 'transparent'};">Drag: Move</button>
                        <button class="shot-btn framing-btn" data-action="drag-rotate" style="flex: 1; padding: 2px; font-size: 9px; background: ${this.dragMode === 'rotate' ? 'rgba(0, 200, 255, 0.3)' : 'transparent'};">Drag: Rotate</button>
                    </div>
                    <div style="display: flex; gap: 4px; margin-top: 4px;">
                        <button class="shot-btn framing-btn" data-action="reset-start" style="flex: 1; padding: 2px; font-size: 9px;"${!shot.startFrame ? ' disabled' : ''}>Reset Start</button>
                        <button class="shot-btn framing-btn" data-action="reset-end" style="flex: 1; padding: 2px; font-size: 9px;"${!shot.endFrame ? ' disabled' : ''}>Reset End</button>
                    </div>
                </fieldset>
                
                <fieldset style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px; font-size: 10px;">
                    <legend style="color: #aaa; padding: 0 4px;">Blur</legend>
                    <div style="display: flex; gap: 8px; font-size: 10px; color: #aaa;">
                        <label style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                            Start <input type="range" class="shot-range" data-prop="blurStart" min="0" max="20" step="0.5" value="${shot.blurStart}" style="width: 100%;">
                        </label>
                        <label style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                            End <input type="range" class="shot-range" data-prop="blurEnd" min="0" max="20" step="0.5" value="${shot.blurEnd}" style="width: 100%;">
                        </label>
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
        }
    }

    enterFramingMode(shot, frameType) {
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(shot.cameraId);
        if (!rig) return;
        
        // Store current framing state
        this.framingState.position.copy(rig.group.position);
        this.framingState.quaternion.copy(rig.group.quaternion);
        this.framingState.fov = rig.camera.fov;
        
        // Disable orbit controls in frame view
        if (this.app.orbit) this.app.orbit.enabled = false;
        
        this.app.ui?.showNotification(`Adjust view for ${frameType} frame. Click again to confirm.`, 'info');
    }

    commitFraming(frameType) {
        const shot = this.selectedShot;
        if (!shot) return;
        
        const cameras = this.app.staging?.cameras;
        const rig = cameras?.get(shot.cameraId);
        if (!rig) return;
        
        const frame = {
            position: rig.group.position.toArray(),
            quaternion: rig.group.quaternion.toArray(),
            fov: rig.camera.fov
        };
        
        shot[frameType === 'start' ? 'startFrame' : 'endFrame'] = frame;
        this.refreshUI();
        this.app.ui?.showNotification(`${frameType} frame saved`, 'success');
    }

    buildTimelineTrack(container) {
        const track = document.createElement('div');
        track.id = 'shot-timeline-track';
        track.style.cssText = `
            height: 60px;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid rgba(255,255,255,0.05);
            position: relative;
            padding: 4px 12px;
        `;
        
        const total = this.duration;
        if (total === 0) {
            container.appendChild(track);
            return;
        }
        
        // Time ruler
        const ruler = document.createElement('div');
        ruler.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; height: 18px; font-size: 9px; color: #666;';
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
        track.appendChild(ruler);
        
        // Shot blocks
        let elapsed = 0;
        this.shots.forEach((shot, i) => {
            const rig = this.app.staging?.cameras?.get(shot.cameraId);
            const color = rig?.color ? '#' + rig.color.toString(16).padStart(6, '0') : '#888';
            const left = (elapsed / total) * 100;
            const width = (shot.duration / total) * 100;
            
            const block = document.createElement('div');
            block.style.cssText = `
                position: absolute;
                left: ${left}%;
                width: ${width}%;
                top: ${i % 2 === 0 ? '20px' : '38px'};
                height: 16px;
                background: ${color}40;
                border: 1px solid ${color}80;
                border-radius: 3px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
                color: ${color};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 4px;
            `;
            block.textContent = `${i + 1}: ${shot.move} (${shot.duration.toFixed(1)}s)`;
            block.title = `Shot ${i + 1} - Click to preview`;
            block.onclick = () => {
                this.selectedShotIndex = i;
                this.seek(elapsed);
                this.refreshUI();
            };
            
            // Keyframe markers
            ['start', 'end'].forEach(frameType => {
                const frame = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
                if (frame) {
                    const kf = document.createElement('i');
                    kf.style.cssText = `
                        position: absolute;
                        left: ${frameType === 'start' ? '0' : '100%'};
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: ${frameType === 'start' ? '#4caf50' : '#f44336'};
                        border: 2px solid #fff;
                        box-shadow: 0 0 4px ${frameType === 'start' ? '#4caf50' : '#f44336'};
                    `;
                    kf.title = `${frameType} frame`;
                    block.appendChild(kf);
                }
            });
            
            track.appendChild(block);
            elapsed += shot.duration;
        });
        
        // Current time indicator
        const indicator = document.createElement('div');
        indicator.id = 'shot-time-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: ${total > 0 ? (this.currentTime / total) * 100 : 0}%;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #00e5ff;
            box-shadow: 0 0 8px #00e5ff;
            pointer-events: none;
            z-index: 10;
        `;
        track.appendChild(indicator);
        
        // Scrub on track click
        track.onclick = (e) => {
            if (e.target === track || e.target === ruler) {
                const rect = track.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                this.seek(pct * total);
            }
        };
        
        container.appendChild(track);
    }

    addShotForSelectedCamera() {
        const cameras = this.app.staging?.cameras;
        if (!cameras || cameras.rigs.length === 0) {
            this.app.ui?.showNotification('Add a virtual camera first', 'error');
            return;
        }
        // Use the currently selected rig or cycle through rigs
        const rig = this.app.selectedObject?.userData?.rigRef || cameras.rigs[this.shots.length % cameras.rigs.length];
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
        
        // Update time label
        const timeLabel = document.getElementById('shot-time-label');
        if (timeLabel) {
            const active = this.getActiveShot();
            timeLabel.textContent = active
                ? `${active.shot.name} — ${active.shot.duration.toFixed(1)}s — ${active.shot.easing}   ${this.currentTime.toFixed(1)}/${this.duration.toFixed(1)}s`
                : `No shots   ${this.duration.toFixed(1)}s`;
        }
        
        // Update scrubber
        const scrub = document.getElementById('shot-scrub');
        if (scrub && !this.isScrubbing) {
            scrub.value = this.duration ? (this.currentTime / this.duration) * 1000 : 0;
        }
        
        // Update timeline indicator
        const indicator = document.getElementById('shot-time-indicator');
        if (indicator) {
            indicator.style.left = this.duration > 0 ? (this.currentTime / this.duration) * 100 + '%' : '0%';
        }
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