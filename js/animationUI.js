/**
 * animationUI.js — Pixel 3D Pro Staging Studio
 *
 * Full-featured per-object timeline panel with:
 *   • Position / Rotation / Scale / Color tracks
 *   • SVG animation curve rendered between every pair of keyframes
 *   • Multi-keyframe support (unlimited per track)
 *   • Collapsible panel, opens on object select
 *   • Right-click keyframe → easing picker with live curve preview
 *   • Scrubber with playhead needle across all tracks
 *   • Keyboard shortcut K to record keyframe
 *
 * Wire-up (main.js):
 *   import { AnimationManager } from './animationManager.js';
 *   import { AnimationUI }      from './animationUI.js';
 *
 *   // in constructor:
 *   this.animationManager = new AnimationManager(this);
 *   this.animationUI      = new AnimationUI(this);
 *
 *   // in init(), after this.ui.init():
 *   this.animationUI.init();
 *
 *   // in selectObject(obj):
 *   this.animationUI.onObjectSelected(obj);
 *
 *   // in deselect():
 *   this.animationUI.onObjectDeselected();
 */

import { EASING_OPTIONS, Easing } from './animationManager.js';
import { hexToRgb, rgbToHex } from './colorUtils.js';

// Track meta: label, colour, whether it uses colour swatch rendering
const TRACK_DEFS = [
    { prop: 'position', label: 'Position', color: '#3b82f6', isColor: false },
    { prop: 'rotation', label: 'Rotation', color: '#a855f7', isColor: false },
    { prop: 'scale',    label: 'Scale',    color: '#22c55e', isColor: false },
    { prop: 'color',    label: 'Color',    color: '#00ff41', isColor: true  },
];

// ─────────────────────────────────────────────────────────────────────────────

export class AnimationUI {
    constructor(app) {
        this.app  = app;
        this.anim = app.animationManager;

        this._activeId    = null;   // objectId of selected object
        this._activeObj   = null;   // THREE object reference
        this._collapsed   = true;
        this._loop        = false;

        // Bind anim callbacks
        this.anim.onTick = t => this._onTick(t);
        this.anim.onEnd  = () => this._onEnd();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────────

    init() {
        this.el = {
            panel:      document.getElementById('anim-panel'),
            header:     document.getElementById('anim-header'),
            body:       document.getElementById('anim-body'),
            objLabel:   document.getElementById('anim-obj-label'),
            collapseBtn:document.getElementById('anim-collapse-btn'),
            playBtn:    document.getElementById('anim-play'),
            stopBtn:    document.getElementById('anim-stop'),
            loopBtn:    document.getElementById('anim-loop'),
            speedSel:   document.getElementById('anim-speed'),
            addObjBtn:  document.getElementById('anim-add-object'),
            addKfBtn:   document.getElementById('anim-add-kf'),
            durationIn: document.getElementById('anim-duration'),
            timeDisp:   document.getElementById('anim-time'),
            scrubTrack: document.getElementById('anim-scrub-track'),
            scrubHead:  document.getElementById('anim-scrub-head'),
            trackArea:  document.getElementById('anim-track-area'),
        };

        if (!this.el.panel) { console.warn('[AnimationUI] #anim-panel not found'); return; }

        this._bindGlobalEvents();
        this.el.panel.style.display = 'none';
        this._setCollapsed(true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Object selection hooks
    // ─────────────────────────────────────────────────────────────────────────

    onObjectSelected(obj) {
        if (!obj) { this.onObjectDeselected(); return; }
        this._activeObj = obj;
        this._activeId  = obj.userData?.id || obj.uuid;

        this.el.panel.style.display = 'flex';
        this._setCollapsed(false);
        if (this.el.objLabel) this.el.objLabel.textContent = this._label(obj);
        this._syncDuration();
        this._renderAll();
        this._moveScrubber(this.anim.currentTime);
        this._updateTimeDisp(this.anim.currentTime);
    }

    onObjectDeselected() {
        this._activeObj = null;
        this._activeId  = null;
        this._setCollapsed(true);
        setTimeout(() => { if (!this._activeId) this.el.panel.style.display = 'none'; }, 280);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Global event bindings
    // ─────────────────────────────────────────────────────────────────────────

    _bindGlobalEvents() {
        // Collapse toggle
        this.el.collapseBtn?.addEventListener('click', e => {
            e.stopPropagation();
            this._setCollapsed(!this._collapsed);
        });

        // Play / Pause
        this.el.playBtn?.addEventListener('click', () => {
            if (this.anim.isPlaying) { this.anim.pause(); this._setPlayIcon(false); }
            else                     { this.anim.play();  this._setPlayIcon(true);  }
        });

        // Stop
        this.el.stopBtn?.addEventListener('click', () => {
            this.anim.stop();
            this._setPlayIcon(false);
            this._moveScrubber(0);
            this._updateTimeDisp(0);
        });

        // Loop
        this.el.loopBtn?.addEventListener('click', () => {
            this._loop = !this._loop;
            this.anim.setLoop(this._loop);
            this.el.loopBtn.classList.toggle('anim-active', this._loop);
        });

        // Speed
        this.el.speedSel?.addEventListener('change', e => {
            this.anim.setSpeed(parseFloat(e.target.value));
        });

        // Duration input
        this.el.durationIn?.addEventListener('change', e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0 && this._activeId) {
                const clip = this.anim.getOrCreateClip(this._activeId);
                clip.duration = v;
                this._renderAll();
            }
        });

        // Add keyframe
        this.el.addObjBtn?.addEventListener('click', () => this._addObjectToTimeline());
        this.el.addKfBtn?.addEventListener('click', () => this._recordKeyframe());

        // Scrubber
        this.el.scrubTrack?.addEventListener('mousedown', e => this._startScrub(e));
        this.el.scrubTrack?.addEventListener('touchstart', e => this._startScrub(e), { passive: true });

        // Keyboard
        document.addEventListener('keydown', e => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'Space' && this.el.panel?.style.display !== 'none') {
                e.preventDefault(); this.el.playBtn?.click();
            }
            if (e.code === 'KeyK') this._recordKeyframe();
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Collapse
    // ─────────────────────────────────────────────────────────────────────────

    _setCollapsed(val) {
        this._collapsed = val;
        const body = this.el.body;
        const btn  = this.el.collapseBtn;
        if (!body) return;
        body.style.maxHeight = val ? '0' : '320px';
        body.style.opacity   = val ? '0' : '1';
        body.style.pointerEvents = val ? 'none' : 'auto';
        const icon = btn?.querySelector('i');
        if (icon) icon.className = val ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Scrubber
    // ─────────────────────────────────────────────────────────────────────────

    _startScrub(e) {
        this._scrubbing = true;
        this._doScrub(e);
        const mm = ev => { if (this._scrubbing) this._doScrub(ev); };
        const mu = () => { this._scrubbing = false; };
        document.addEventListener('mousemove', mm);
        document.addEventListener('mouseup', mu, { once: true });
        document.addEventListener('touchmove', mm, { passive: true });
        document.addEventListener('touchend', mu, { once: true });
    }

    _doScrub(e) {
        const rect = this.el.scrubTrack?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const t  = Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * this.anim.totalDuration;
        this.anim.seek(t);
    }

    _moveScrubber(time) {
        const dur = this.anim.totalDuration;
        const pct = dur > 0 ? Math.max(0, Math.min(100, (time / dur) * 100)) : 0;
        if (this.el.scrubHead) this.el.scrubHead.style.left = `${pct}%`;
        // Needle line across all track lanes
        document.querySelectorAll('.anim-needle').forEach(n => n.style.left = `${pct}%`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tick / End
    // ─────────────────────────────────────────────────────────────────────────

    _onTick(t) {
        this._moveScrubber(t);
        this._updateTimeDisp(t);
        // Keep right-panel inputs live
        if (this._activeObj && this.app.ui?.updateUI) this.app.ui.updateUI(this._activeObj);
    }

    _onEnd() { this._setPlayIcon(false); }

    _updateTimeDisp(t) {
        if (this.el.timeDisp) {
            this.el.timeDisp.textContent = `${t.toFixed(2)}s / ${this.anim.totalDuration.toFixed(2)}s`;
        }
    }

    _setPlayIcon(playing) {
        const icon = this.el.playBtn?.querySelector('i');
        if (icon) icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
    }

    _syncDuration() {
        const clip = this._activeId ? this.anim.getClip(this._activeId) : null;
        if (this.el.durationIn) {
            this.el.durationIn.value = (clip?.duration ?? 3).toFixed(1);
            this.el.durationIn.disabled = !clip;
        }
        if (this.el.addObjBtn) this.el.addObjBtn.hidden = !!clip;
        if (this.el.addKfBtn) this.el.addKfBtn.disabled = !clip;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record keyframe
    // ─────────────────────────────────────────────────────────────────────────

    _addObjectToTimeline() {
        const id = this._activeId;
        if (!id) { this._notify('Select an object first', 'warning'); return; }
        const clip = this.anim.createClip(id, { duration: 3 });
        this.anim.recordKeyframe(id, 0, ['position','rotation','scale','color']);
        this.anim.recordKeyframe(id, 3, ['position','rotation','scale','color']);
        clip.duration = 3;
        this.anim.seek(0);
        this._syncDuration();
        this._renderAll();
        this._notify(`${this._label(this._activeObj)} added as a 3 second clip`, 'success');
    }

    _recordKeyframe() {
        const id = this._activeId;
        if (!id) { this._notify('Select an object first', 'warning'); return; }
        if (!this.anim.hasClip(id)) { this._notify('Add the object to the timeline first', 'warning'); return; }

        this.anim.recordKeyframe(id, this.anim.currentTime, ['position','rotation','scale','color']);

        // Flash
        this.el.addKfBtn?.classList.add('anim-flash');
        setTimeout(() => this.el.addKfBtn?.classList.remove('anim-flash'), 400);

        this._syncDuration();
        this._renderAll();
        this._notify(`Keyframe @ ${this.anim.currentTime.toFixed(2)}s`, 'success');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Full track area render
    // ─────────────────────────────────────────────────────────────────────────

    _renderAll() {
        const area = this.el.trackArea;
        if (!area) return;
        area.innerHTML = '';

        const id   = this._activeId;
        const clip = id ? this.anim.getClip(id) : null;

        if (!clip || !clip.hasAnyKeyframes()) {
            area.innerHTML = `
                <div class="anim-empty">
                    <i class="fas fa-film"></i>
                    <span>${clip ? 'No keyframes — move the object then press <kbd>K</kbd> or click <strong>+ Keyframe</strong>' : 'Click <strong>+ Add Object</strong> to create a 3 second clip'}</span>
                </div>`;
            return;
        }

        const dur = Math.max(clip.duration, 0.1);

        // Ruler
        area.appendChild(this._buildRuler(dur));

        // One row per track
        for (const def of TRACK_DEFS) {
            const row = this._buildTrackRow(id, clip, def, dur);
            area.appendChild(row);
        }

        // Floating needle (positioned over the lanes region via CSS)
        const needle = document.createElement('div');
        needle.className = 'anim-needle';
        const pct = (this.anim.currentTime / this.anim.totalDuration) * 100;
        needle.style.left = `${pct}%`;
        area.appendChild(needle);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ruler
    // ─────────────────────────────────────────────────────────────────────────

    _buildRuler(dur) {
        const ruler = document.createElement('div');
        ruler.className = 'anim-ruler';

        const step = dur <= 3 ? 0.5 : dur <= 10 ? 1 : dur <= 30 ? 2 : 5;
        for (let t = 0; t <= dur + 0.001; t += step) {
            const pct  = (t / dur) * 100;
            const tick = document.createElement('div');
            tick.className = 'anim-ruler-tick' + (Number.isInteger(Math.round(t / step) % 2 === 0 ? t : t + 99) ? '' : '');
            // major every whole second
            const isMaj = Math.abs(t - Math.round(t)) < 0.001;
            tick.classList.add(isMaj ? 'major' : 'minor');
            tick.style.left = `${pct}%`;
            ruler.appendChild(tick);

            if (isMaj) {
                const lbl = document.createElement('span');
                lbl.className = 'anim-ruler-lbl';
                lbl.textContent = `${t.toFixed(0)}s`;
                lbl.style.left = `${pct}%`;
                ruler.appendChild(lbl);
            }
        }
        return ruler;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Track row (label + curve lane + keyframe diamonds)
    // ─────────────────────────────────────────────────────────────────────────

    _buildTrackRow(objectId, clip, def, dur) {
        const kfs = clip.getKeyframes(def.prop);
        const row = document.createElement('div');
        row.className = 'anim-track-row';
        row.dataset.prop = def.prop;

        // ── Label cell ──
        const labelCell = document.createElement('div');
        labelCell.className = 'anim-track-label';
        labelCell.innerHTML = `<span class="anim-track-dot" style="background:${def.color}"></span>${def.label}`;

        // ── Lane cell ──
        const laneCell = document.createElement('div');
        laneCell.className = 'anim-track-lane';

        // SVG curve layer
        const svg = this._buildCurveSvg(kfs, dur, def);
        laneCell.appendChild(svg);

        // Click on empty lane → insert keyframe
        laneCell.addEventListener('click', e => {
            if (e.target.closest('.anim-kf-diamond')) return; // ignore marker clicks
            const rect  = laneCell.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const time  = ratio * dur;
            this._insertKeyframeAt(objectId, clip, def, time);
        });

        // Keyframe diamond markers
        for (const kf of kfs) {
            const diamond = this._buildDiamond(kf, def, dur, objectId, clip);
            laneCell.appendChild(diamond);
        }

        row.appendChild(labelCell);
        row.appendChild(laneCell);
        return row;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SVG Curve between keyframes
    // ─────────────────────────────────────────────────────────────────────────

    _buildCurveSvg(kfs, dur, def) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('anim-curve-svg');
        svg.setAttribute('preserveAspectRatio', 'none');

        if (kfs.length < 2) {
            // Single keyframe: just draw a horizontal dashed line at midpoint
            if (kfs.length === 1) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x = `${(kfs[0].time / dur) * 100}%`;
                line.setAttribute('x1', '0%'); line.setAttribute('y1', '50%');
                line.setAttribute('x2', '100%'); line.setAttribute('y2', '50%');
                line.setAttribute('stroke', def.color);
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '3,4');
                line.setAttribute('opacity', '0.3');
                svg.appendChild(line);
            }
            return svg;
        }

        // Draw a curve segment between every consecutive pair of keyframes
        for (let i = 0; i < kfs.length - 1; i++) {
            const a = kfs[i], b = kfs[i + 1];
            const x1pct = (a.time / dur) * 100;
            const x2pct = (b.time / dur) * 100;

            // Sample the easing curve for this segment
            const SAMPLES = 40;
            const points  = [];
            for (let s = 0; s <= SAMPLES; s++) {
                const rawT   = s / SAMPLES;
                const easeT  = (Easing[b.easing] || Easing.linear)(rawT);
                const xPct   = x1pct + (x2pct - x1pct) * rawT;
                // y: 0 = top (easeT=1), 100 = bottom (easeT=0)
                // Map easeT to a visually readable y in [10%, 90%]
                const yPct   = 90 - easeT * 80;
                points.push(`${xPct.toFixed(2)}%,${yPct.toFixed(2)}%`);
            }

            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', points.join(' '));
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', def.color);
            polyline.setAttribute('stroke-width', '1.5');
            polyline.setAttribute('opacity', '0.7');
            polyline.setAttribute('stroke-linecap', 'round');
            polyline.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(polyline);

            // Filled area under curve
            const areaPoints = [
                `${x1pct.toFixed(2)}%,90%`,
                ...points,
                `${x2pct.toFixed(2)}%,90%`,
            ];
            const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            area.setAttribute('points', areaPoints.join(' '));
            area.setAttribute('fill', def.color);
            area.setAttribute('opacity', '0.08');
            svg.insertBefore(area, polyline);
        }

        // Faint connecting lines outside keyframe range
        const firstX = `${(kfs[0].time / dur) * 100}%`;
        const lastX  = `${(kfs[kfs.length-1].time / dur) * 100}%`;

        if (kfs[0].time > 0) {
            const pre = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            pre.setAttribute('x1','0%'); pre.setAttribute('y1','50%');
            pre.setAttribute('x2', firstX); pre.setAttribute('y2','50%');
            pre.setAttribute('stroke', def.color);
            pre.setAttribute('stroke-width','1');
            pre.setAttribute('stroke-dasharray','3,4');
            pre.setAttribute('opacity','0.25');
            svg.appendChild(pre);
        }
        if (kfs[kfs.length-1].time < dur) {
            const post = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            post.setAttribute('x1', lastX); post.setAttribute('y1','50%');
            post.setAttribute('x2','100%'); post.setAttribute('y2','50%');
            post.setAttribute('stroke', def.color);
            post.setAttribute('stroke-width','1');
            post.setAttribute('stroke-dasharray','3,4');
            post.setAttribute('opacity','0.25');
            svg.appendChild(post);
        }

        return svg;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Keyframe diamond marker
    // ─────────────────────────────────────────────────────────────────────────

    _buildDiamond(kf, def, dur, objectId, clip) {
        const d = document.createElement('div');
        d.className = 'anim-kf-diamond';
        d.style.left = `${(kf.time / dur) * 100}%`;
        d.style.setProperty('--kf-color', def.color);

        // For colour track: show a swatch inside the diamond
        if (def.isColor && kf.value) {
            d.style.setProperty('--kf-swatch', rgbToHex(kf.value));
            d.classList.add('is-color');
        }

        d.title = this._kfTooltip(def.prop, kf);
        d.addEventListener('pointerdown', e => this._startKeyframeDrag(e, d, kf, def, dur, clip));

        // Left-click → seek to this keyframe
        d.addEventListener('click', e => {
            e.stopPropagation();
            this.anim.seek(kf.time);
        });

        // Right-click → easing + delete menu
        d.addEventListener('contextmenu', e => {
            e.preventDefault(); e.stopPropagation();
            this._showKfMenu(e, objectId, clip, def, kf);
        });

        return d;
    }

    _startKeyframeDrag(e, diamond, kf, def, dur, clip) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const lane = diamond.parentElement;
        const startTime = kf.time;
        let moved = false;
        diamond.classList.add('is-dragging');
        const move = ev => {
            const rect = lane.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
            const next = clip.moveKeyframe(def.prop, kf.time, ratio * dur);
            if (next === null) return;
            moved = moved || Math.abs(next - startTime) >= 0.005;
            diamond.style.left = `${(next / dur) * 100}%`;
            diamond.title = this._kfTooltip(def.prop, kf);
            this.anim.seek(next);
        };
        const up = () => {
            document.removeEventListener('pointermove', move);
            diamond.classList.remove('is-dragging');
            if (moved) {
                this._renderAll();
                this._notify(`${def.label} keyframe moved to ${kf.time.toFixed(2)}s`, 'success');
            }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up, { once: true });
    }

    _kfTooltip(prop, kf) {
        if (prop === 'color') {
            return `Color @ ${kf.time.toFixed(2)}s\n${rgbToHex(kf.value)}\nRight-click to edit`;
        }
        const v = kf.value;
        return `${prop} @ ${kf.time.toFixed(2)}s\nx:${v.x.toFixed(2)} y:${v.y.toFixed(2)} z:${v.z.toFixed(2)}\nEasing: ${kf.easing}\nRight-click to edit`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Insert keyframe at clicked position
    // ─────────────────────────────────────────────────────────────────────────

    _insertKeyframeAt(objectId, clip, def, time) {
        const target = this.anim._resolve(objectId);
        if (!target) return;

        if (def.isColor) {
            const mat = target.isMesh ? target.material :
                        (() => { let m = null; target.traverse(o => { if (!m && o.isMesh) m = o.material; }); return m; })();
            if (!mat) return;
            clip.setKeyframe('color', time, { r: mat.color.r, g: mat.color.g, b: mat.color.b });
        } else {
            if (!target[def.prop]) return;
            clip.setKeyframe(def.prop, time, {
                x: target[def.prop].x,
                y: target[def.prop].y,
                z: target[def.prop].z,
            });
        }

        this._syncDuration();
        this._renderAll();
        this._notify(`${def.label} keyframe @ ${time.toFixed(2)}s`, 'success');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Keyframe right-click menu
    // ─────────────────────────────────────────────────────────────────────────

    _showKfMenu(e, objectId, clip, def, kf) {
        document.getElementById('anim-kf-ctx')?.remove();

        const menu = document.createElement('div');
        menu.id    = 'anim-kf-ctx';
        menu.className = 'anim-ctx-menu';
        // Position smartly
        const viewH = window.innerHeight, viewW = window.innerWidth;
        const menuW = 230, menuH = def.isColor ? 340 : 280;
        const left  = Math.min(e.clientX, viewW - menuW - 8);
        const top   = Math.min(e.clientY, viewH - menuH - 8);
        menu.style.cssText = `left:${left}px;top:${top}px`;

        const valueHtml = def.isColor
            ? `<div class="anim-ctx-row">
                 <label>Color</label>
                 <input type="color" id="anim-ctx-color" value="${rgbToHex(kf.value)}">
               </div>`
            : `<div class="anim-ctx-xyz">
                 <div class="anim-ctx-row"><label>X</label><input type="number" id="anim-ctx-x" value="${kf.value.x.toFixed(3)}" step="0.01"></div>
                 <div class="anim-ctx-row"><label>Y</label><input type="number" id="anim-ctx-y" value="${kf.value.y.toFixed(3)}" step="0.01"></div>
                 <div class="anim-ctx-row"><label>Z</label><input type="number" id="anim-ctx-z" value="${kf.value.z.toFixed(3)}" step="0.01"></div>
               </div>`;

        menu.innerHTML = `
            <div class="anim-ctx-head">
                <span class="anim-ctx-dot" style="background:${def.color}"></span>
                <span>${def.label}</span>
                <span class="anim-ctx-time">${kf.time.toFixed(2)}s</span>
            </div>

            <div class="anim-ctx-section">Value</div>
            ${valueHtml}

            <div class="anim-ctx-section">Easing</div>
            <select class="anim-ctx-select" id="anim-ctx-ease">
                ${EASING_OPTIONS.map(o => `<option value="${o}"${o===kf.easing?' selected':''}>${o}</option>`).join('')}
            </select>

            <canvas id="anim-ctx-curve" width="200" height="60" class="anim-ctx-canvas"></canvas>

            <button class="anim-ctx-delete" id="anim-ctx-del">
                <i class="fas fa-trash-alt"></i> Delete Keyframe
            </button>
        `;

        document.body.appendChild(menu);

        // Draw initial curve
        this._drawCurvePreview('anim-ctx-curve', kf.easing, def.color);

        // Easing change → redraw
        menu.querySelector('#anim-ctx-ease').addEventListener('change', ev => {
            clip.updateKeyframeEasing(def.prop, kf.time, ev.target.value);
            kf.easing = ev.target.value;
            this._drawCurvePreview('anim-ctx-curve', ev.target.value, def.color);
            this._renderAll(); // refresh lane curve
        });

        // Value fields
        if (def.isColor) {
            menu.querySelector('#anim-ctx-color').addEventListener('input', ev => {
                const rgb = hexToRgb(ev.target.value);
                kf.value.r = rgb.r; kf.value.g = rgb.g; kf.value.b = rgb.b;
                // Update swatch on diamond immediately
                const diamond = document.querySelector(`.anim-kf-diamond[style*="${((kf.time / Math.max(clip.duration,0.1)) * 100).toFixed(2)}%"]`);
                if (diamond) diamond.style.setProperty('--kf-swatch', ev.target.value);
            });
        } else {
            ['x','y','z'].forEach(axis => {
                menu.querySelector(`#anim-ctx-${axis}`)?.addEventListener('change', ev => {
                    kf.value[axis] = parseFloat(ev.target.value) || 0;
                    this._renderAll();
                });
            });
        }

        // Delete
        menu.querySelector('#anim-ctx-del').addEventListener('click', () => {
            this.anim.deleteKeyframe(objectId, def.prop, kf.time);
            menu.remove();
            this._syncDuration();
            this._renderAll();
        });

        // Close on outside click
        const close = ev => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('mousedown', close);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', close), 40);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Easing curve preview (canvas)
    // ─────────────────────────────────────────────────────────────────────────

    _drawCurvePreview(canvasId, easingName, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const pad = 8;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0d0d18';
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth   = 1;
        for (let i = 1; i < 4; i++) {
            const y = pad + ((H - pad*2) * i / 4);
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
            const x = pad + ((W - pad*2) * i / 4);
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H-pad); ctx.stroke();
        }

        // Baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H-pad); ctx.stroke();

        // Curve
        const fn = Easing[easingName] || Easing.linear;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        const STEPS = 80;
        for (let i = 0; i <= STEPS; i++) {
            const t  = i / STEPS;
            const et = fn(t);
            const x  = pad + t  * (W - pad*2);
            const y  = (H-pad) - et * (H - pad*2);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Start / end dots
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(pad, H-pad, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(W-pad, pad + (1 - fn(1)) * (H - pad*2), 3, 0, Math.PI*2); ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px monospace';
        ctx.fillText(easingName, pad+2, pad+10);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    _label(obj) {
        if (!obj) return '—';
        if (obj.userData?.name)      return obj.userData.name;
        if (obj.userData?.shapeType) return obj.userData.shapeType[0].toUpperCase() + obj.userData.shapeType.slice(1);
        if (obj.userData?.lightType) return obj.userData.lightType.toUpperCase() + ' Light';
        if (obj.userData?.type === 'figure') return (obj.userData.gender || 'Figure').toUpperCase();
        if (obj.isCamera)             return 'Camera';
        return obj.name || 'Object';
    }

    _notify(msg, type = 'info') {
        this.app.ui?.showNotification?.(msg, type);
    }

    /** Public refresh — call when external code mutates a clip */
    refresh() {
        this._syncDuration();
        this._renderAll();
        this._updateTimeDisp(this.anim.currentTime);
    }
}
