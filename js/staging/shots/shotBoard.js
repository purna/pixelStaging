import * as THREE from 'three';

/**
 * ShotBoard — camera timeline. Each shot = one movie camera active over a
 * time range with a cut type. Replaces the old keyframe timeline: play /
 * pause / scrub drives which rig's camera renders the viewport.
 */
export class ShotBoard {
    constructor(app) {
        this.app = app;
        this.shots = [];           // { id, cameraId, duration, cutType, name }
        this.currentTime = 0;
        this.playing = false;
        this.playbackRate = 1;
        this.ui = null;            // injected bottom bar
    }

    /** Total timeline length in seconds. */
    get duration() {
        return this.shots.reduce((t, s) => t + s.duration, 0);
    }

    addShot(cameraId, duration = 2, cutType = 'hard') {
        const shot = {
            id: 'shot_' + Math.random().toString(36).slice(2, 8),
            cameraId,
            duration,
            cutType,
            name: `Shot ${this.shots.length + 1}`
        };
        this.shots.push(shot);
        this.refreshUI();
        return shot;
    }

    removeShot(shotId) {
        const i = this.shots.findIndex(s => s.id === shotId);
        if (i > -1) {
            this.shots.splice(i, 1);
            this.refreshUI();
        }
    }

    moveShot(shotId, direction) {
        const i = this.shots.findIndex(s => s.id === shotId);
        const j = i + direction;
        if (i === -1 || j < 0 || j >= this.shots.length) return;
        [this.shots[i], this.shots[j]] = [this.shots[j], this.shots[i]];
        this.refreshUI();
    }

    /** Shot active at time t, plus how far into the shot we are. */
    getActiveShot(t = this.currentTime) {
        let elapsed = 0;
        for (const shot of this.shots) {
            if (t < elapsed + shot.duration) return { shot, localT: t - elapsed };
            elapsed += shot.duration;
        }
        return null;
    }

    play() {
        if (this.shots.length === 0) return;
        this.playing = true;
        if (this.currentTime >= this.duration) this.currentTime = 0;
    }

    pause() {
        this.playing = false;
    }

    toggle() {
        this.playing ? this.pause() : this.play();
        this.refreshUI();
    }

    seek(t) {
        this.currentTime = Math.max(0, Math.min(t, this.duration));
        if (this.ui) this.ui.updateScrubber();
    }

    /** Per-frame update; returns the rig camera to render through (or null). */
    update(delta) {
        if (!this.playing) return this.previewCamera();
        this.currentTime += delta * this.playbackRate;
        if (this.currentTime >= this.duration) {
            this.currentTime = 0;
            this.pause();
        }
        if (this.ui) this.ui.updateScrubber();
        return this.previewCamera();
    }

    /**
     * While a shot is selected on the board (or playing), preview through
     * that shot's camera; null = editing camera.
     */
    previewCamera() {
        const cameras = this.app.staging.cameras;
        const active = this.getActiveShot();
        if (!active) return null;
        const rig = cameras.get(active.shot.cameraId);
        return rig ? rig.camera : null;
    }

    /** Build / rebuild the timeline bottom bar. */
    buildUI() {
        if (this.ui) return;
        const bar = document.getElementById('shot-timeline');
        if (!bar) return;
        bar.style.display = 'none';

        const playBtn = document.getElementById('timeline-play');
        const pauseBtn = document.getElementById('timeline-pause');
        const scrub = document.getElementById('shot-scrub');
        const label = document.getElementById('shot-time-label');
        const addBtn = document.getElementById('timeline-add-shot');
        const loopBtn = document.getElementById('timeline-loop');
        const cardsContainer = document.getElementById('shot-cards');

        this.ui = {
            root: bar,
            playBtn, pauseBtn, scrub, label, addBtn, loopBtn, cardsContainer,
            updateScrubber: () => {
                if (scrub) scrub.value = this.duration ? (this.currentTime / this.duration) * 1000 : 0;
                if (label) {
                    const a = this.getActiveShot();
                    label.textContent = a
                        ? `${a.shot.name} — ${a.shot.duration.toFixed(1)}s — ${a.shot.cutType}   ${this.currentTime.toFixed(1)}/${this.duration.toFixed(1)}s`
                        : `No shots — add camera shots   ${this.duration.toFixed(1)}s`;
                }
                if (playBtn) playBtn.style.display = this.playing ? 'none' : 'inline-block';
                if (pauseBtn) pauseBtn.style.display = this.playing ? 'inline-block' : 'none';
            },
            rebuild: () => this.refreshUI()
        };

        if (playBtn) playBtn.onclick = () => this.toggle();
        if (pauseBtn) pauseBtn.onclick = () => this.toggle();
        if (loopBtn) loopBtn.onclick = () => { this.loop = !this.loop; this.refreshUI(); };
        if (scrub) {
            scrub.oninput = e => this.seek((e.target.value / 1000) * this.duration);
        }
        if (addBtn) {
            addBtn.onclick = () => {
                const cams = this.app.staging.cameras;
                if (cams.rigs.length === 0) {
                    this.app.notifications.show('Add a virtual camera first', 'error');
                    return;
                }
                const rig = cams.rigs[this.shots.length % cams.rigs.length];
                this.addShot(rig.id);
                this.refreshUI();
            };
        }

        this.refreshUI();
    }

    toggleUI() {
        this.buildUI();
        if (!this.ui) return;
        const bar = this.ui.root;
        const show = bar.style.display === 'none';
        bar.style.display = show ? 'flex' : 'none';
        if (show) this.refreshUI();
    }

    refreshUI() {
        if (!this.ui) return;
        const { cardsContainer, loopBtn } = this.ui;
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
            this.shots.forEach((shot, i) => {
                const rig = this.app.staging.cameras.get(shot.cameraId);
                const color = rig ? '#' + rig.color.toString(16).padStart(6, '0') : '#888888';
                const el = document.createElement('div');
                el.style.cssText = `padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.25);background:#1a1a34;cursor:pointer;user-select:none;color:${color};`;
                el.innerHTML = `<b style="color:${color}">CAM ${rig?.name || '?'}</b> ${shot.duration.toFixed(1)}s <small>${shot.cutType}</small>`;
                el.title = 'Click: preview this shot · right-click remove';
                el.onclick = () => {
                    this.app.staging.cameras.viewingRigId = shot.cameraId;
                    if (this.app.orbit) this.app.orbit.enabled = false;
                    this.seek(this.shots.slice(0, i).reduce((t, s) => t + s.duration, 0));
                    this.refreshUI();
                };
                el.oncontextmenu = e => { e.preventDefault(); this.removeShot(shot.id); this.refreshUI(); };
                cardsContainer.appendChild(el);
            });
        }
        if (loopBtn) loopBtn.style.background = this.loop ? '#2e7d32' : 'transparent';
        if (this.ui.updateScrubber) this.ui.updateScrubber();
    }
}
