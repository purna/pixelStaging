import * as THREE from 'three';
import { buildFrustumVisual } from './frustumRenderer.js';
import { Icons } from '../../icons.js';

/**
 * CameraRigManager — multiple named virtual movie cameras (per the data model).
 * Each rig owns a THREE.PerspectiveCamera driven by lens + sensor + aspect
 * presets, a colour-coded frustum visual, and a selectable camera-body gizmo.
 * The editing (orbit) camera is never touched — rigs are separate objects.
 */

export const LENS_PRESETS = [12, 16, 24, 35, 50, 85, 135];
export const SENSOR_PRESETS = {
    fullFrame: { label: 'Full Frame', width: 36, height: 24 },
    super35: { label: 'Super 35', width: 24.89, height: 18.66 },
    mft: { label: 'MFT', width: 17.3, height: 13 }
};
export const ASPECT_PRESETS = {
    '16:9': 16 / 9, '2.39:1': 2.39, '1.85:1': 1.85, '4:3': 4 / 3, '1:1': 1
};

const RIG_COLORS = [0x00e5ff, 0xff9f1c, 0xb7ff42, 0xff5ec4, 0x9d6bff, 0x42d9ff];

export class CameraRigManager {
    constructor(app) {
        this.app = app;
        this.rigs = [];
        this.viewingRigId = null;   // null = layout mode (editing camera)
        this.activeIndex = 0;
        // Build UI after a short delay to ensure DOM is ready
        setTimeout(() => this.buildUI(), 100);
    }

    /** Derived vertical FOV (degrees) for a lens spec. */
    static vFov(lens) {
        const sensor = SENSOR_PRESETS[lens.sensor] || SENSOR_PRESETS.fullFrame;
        return THREE.MathUtils.radToDeg(2 * Math.atan(sensor.height / (2 * lens.focalLength)));
    }

    static aspectValue(aspect) {
        return ASPECT_PRESETS[aspect] ?? (16 / 9);
    }

    /** Create a rig; its group's -Z is the look direction. */
    addRig(name = null, position = null) {
        const id = 'rig_' + Math.random().toString(36).slice(2, 9);
        const color = RIG_COLORS[this.rigs.length % RIG_COLORS.length];
        const letter = String.fromCharCode(65 + this.rigs.length);

        const group = new THREE.Group();
        group.name = `Camera ${name || letter}`;
        group.position.copy(position || new THREE.Vector3(4, 1.5, 4));

        const lens = { focalLength: 50, sensor: 'fullFrame' };
        const aspect = '16:9';
        const camera = new THREE.PerspectiveCamera(
            CameraRigManager.vFov(lens), CameraRigManager.aspectValue(aspect), 0.1, 500
        );

        // Camera body gizmo (box + lens barrel)
        const bodyMat = new THREE.MeshBasicMaterial({ color });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.22), bodyMat);
        const lensMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), bodyMat);
        lensMesh.rotation.x = Math.PI / 2;
        lensMesh.position.z = -0.18;
        group.add(body, lensMesh, camera);

        // Frustum visual
        const frustum = buildFrustumVisual(color);
        group.add(frustum.group);

        group.userData.type = 'staging';
        group.userData.staging = { id, kind: 'camera', presetId: 'camera-rig', params: {} };
        group.userData.rig = { id, color };

        this.app.scene.add(group);
        this.app.objects.push(group);

        const rig = { id, name: name || letter, color, group, camera, frustum, lens, aspect, visibleInViewport: true };
        group.userData.rigRef = rig;
        this.rigs.push(rig);
        this.updateRigFrustum(rig);
        this.refreshUI();
        return rig;
    }

    removeRig(rigId) {
        const idx = this.rigs.findIndex(r => r.id === rigId);
        if (idx === -1) return false;
        const rig = this.rigs[idx];
        if (this.viewingRigId === rigId) this.viewingRigId = null;
        this.app.scene.remove(rig.group);
        const oi = this.app.objects.indexOf(rig.group);
        if (oi > -1) this.app.objects.splice(oi, 1);
        this.rigs.splice(idx, 1);
        this.refreshUI();
        return true;
    }

    get(rigId) { return this.rigs.find(r => r.id === rigId) || null; }

    get selectedRig() { return this.app.selectedObject?.userData?.rigRef || null; }

    setLens(rig, focalLength = null, sensor = null) {
        if (focalLength) rig.lens.focalLength = focalLength;
        if (sensor) rig.lens.sensor = sensor;
        rig.camera.fov = CameraRigManager.vFov(rig.lens);
        rig.camera.updateProjectionMatrix();
        this.updateRigFrustum(rig);
    }

    setAspect(rig, aspect) {
        rig.aspect = aspect;
        rig.camera.aspect = CameraRigManager.aspectValue(aspect);
        rig.camera.updateProjectionMatrix();
        this.updateRigFrustum(rig);
    }

    updateRigFrustum(rig) {
        rig.frustum.update(rig.camera.fov, rig.camera.aspect, 2.5);
    }

    aimAt(rig, target) {
        rig.group.lookAt(new THREE.Vector3(target.x, target.y, target.z));
    }

    /** Copy the current editing-camera view into a rig ("lock framing"). */
    setFromCurrentView(rig) {
        const cam = this.app.camera;
        rig.group.position.copy(cam.position);
        rig.group.quaternion.copy(cam.quaternion);
        this.updateRigFrustum(rig);
    }

    /** The camera used for rendering: viewing rig or null (editing camera). */
    getRenderCamera() {
        if (!this.viewingRigId) return null;
        const rig = this.get(this.viewingRigId);
        return rig ? rig.camera : null;
    }

    /** Enter camera view / cycle through rigs / exit back to layout. */
    cycleViewThrough() {
        if (this.rigs.length === 0) return;
        if (this.viewingRigId === null) {
            this.viewingRigId = this.rigs[0].id;
        } else {
            const idx = this.rigs.findIndex(r => r.id === this.viewingRigId);
            this.viewingRigId = (idx === this.rigs.length - 1) ? null : this.rigs[idx + 1].id;
        }
        if (this.app.orbit) this.app.orbit.enabled = (this.viewingRigId === null);
        const label = this.viewingRigId
            ? `Viewing through Camera ${this.get(this.viewingRigId).name}`
            : 'Layout view';
        if (this.app.ui?.showNotification) this.app.ui.showNotification(label, 'info');
        this.refreshUI();
    }

    /**
     * Letterboxed viewport for the viewing rig within the renderer canvas.
     * Returns null in layout mode.
     */
    getRenderViewport(domElement) {
        if (!this.viewingRigId) return null;
        const rig = this.get(this.viewingRigId);
        const aspect = CameraRigManager.aspectValue(rig.aspect);
        const W = domElement.clientWidth, H = domElement.clientHeight;
        let vw, vh;
        if (W / H > aspect) { vh = H; vw = H * aspect; }
        else { vw = W; vh = W / aspect; }
        return { x: (W - vw) / 2, y: (H - vh) / 2, width: vw, height: vh };
    }

    /** Per-frame updates: frustum visibility (hide the rig being viewed). */
    update() {
        for (const rig of this.rigs) {
            rig.frustum.setVisible(rig.visibleInViewport && this.viewingRigId !== rig.id);
        }
    }

    /** Build UI for camera rig controls in the toolbar. */
    buildUI() {
        const container = document.getElementById('camera-controls-container');
        if (!container) return;

        // Clear existing
        container.innerHTML = '';

        // Camera rig group
        const rigGroup = document.createElement('div');
        rigGroup.className = 'camera-rig-controls-group';

        // Add camera rig button
        const addBtn = document.createElement('div');
        addBtn.className = 'tool-btn camera-rig-btn';
        addBtn.id = 'tool-add-camera-rig';
        addBtn.innerHTML = `<span class="icon-svg">${Icons.add}</span>`;
        addBtn.title = 'Add Virtual Camera';
        addBtn.dataset.tooltip = '**Add Virtual Camera**\nCreate a new movie camera for shot planning';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addRig();
        });
        rigGroup.appendChild(addBtn);

        // View through camera / cycle button
        const viewBtn = document.createElement('div');
        viewBtn.className = 'tool-btn camera-rig-btn';
        viewBtn.id = 'tool-view-camera';
        viewBtn.innerHTML = `<span class="icon-svg">${Icons.view}</span>`;
        viewBtn.title = 'View Through Camera';
        viewBtn.dataset.tooltip = '**View Through Camera**\nCycle through virtual cameras (Layout → Cam A → Cam B → … → Layout)';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cycleViewThrough();
        });
        rigGroup.appendChild(viewBtn);

        // Frame camera from current view button
        const frameBtn = document.createElement('div');
        frameBtn.className = 'tool-btn camera-rig-btn';
        frameBtn.id = 'tool-frame-camera';
        frameBtn.innerHTML = `<span class="icon-svg">${Icons.lock}</span>`;
        frameBtn.title = 'Frame Camera from View';
        frameBtn.dataset.tooltip = '**Frame Camera from View**\nLock the selected camera to match the current editor view';
        frameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.frameCameraFromView();
        });
        rigGroup.appendChild(frameBtn);

        // Delete camera button
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'tool-btn camera-rig-btn';
        deleteBtn.id = 'tool-delete-camera';
        deleteBtn.innerHTML = `<span class="icon-svg">${Icons.delete}</span>`;
        deleteBtn.title = 'Delete Camera';
        deleteBtn.dataset.tooltip = '**Delete Camera**\nRemove the selected virtual camera';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteSelectedRig();
        });
        rigGroup.appendChild(deleteBtn);

        // Lens preset selector
        const lensSelect = document.createElement('select');
        lensSelect.id = 'camera-lens-preset';
        lensSelect.className = 'camera-preset-select';
        lensSelect.innerHTML = LENS_PRESETS.map(f => `<option value="${f}">${f}mm</option>`).join('');
        lensSelect.value = '50';
        lensSelect.addEventListener('change', (e) => {
            const rig = this.selectedRig || this.rigs[0];
            if (rig) this.setLens(rig, parseFloat(e.target.value), null);
        });
        rigGroup.appendChild(lensSelect);

        // Sensor preset selector
        const sensorSelect = document.createElement('select');
        sensorSelect.id = 'camera-sensor-preset';
        sensorSelect.className = 'camera-preset-select';
        sensorSelect.innerHTML = Object.entries(SENSOR_PRESETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
        sensorSelect.value = 'fullFrame';
        sensorSelect.addEventListener('change', (e) => {
            const rig = this.selectedRig || this.rigs[0];
            if (rig) this.setLens(rig, null, e.target.value);
        });
        rigGroup.appendChild(sensorSelect);

        // Aspect ratio selector
        const aspectSelect = document.createElement('select');
        aspectSelect.id = 'camera-aspect-preset';
        aspectSelect.className = 'camera-preset-select';
        aspectSelect.innerHTML = Object.entries(ASPECT_PRESETS).map(([k, v]) => `<option value="${k}">${k} (${v.toFixed(2)})</option>`).join('');
        aspectSelect.value = '16:9';
        aspectSelect.addEventListener('change', (e) => {
            const rig = this.selectedRig || this.rigs[0];
            if (rig) this.setAspect(rig, e.target.value);
        });
        rigGroup.appendChild(aspectSelect);

        // Camera list display
        const listDiv = document.createElement('div');
        listDiv.id = 'camera-rig-list';
        listDiv.className = 'camera-rig-list';
        rigGroup.appendChild(listDiv);

        container.appendChild(rigGroup);
        this.refreshUI();
    }

    /** Refresh the camera rig list display. */
    refreshUI() {
        const listDiv = document.getElementById('camera-rig-list');
        if (!listDiv) return;

        if (this.rigs.length === 0) {
            listDiv.innerHTML = '<div class="camera-rig-empty">No virtual cameras. Click + to add.</div>';
            return;
        }

        listDiv.innerHTML = this.rigs.map(rig => `
            <div class="camera-rig-item ${this.viewingRigId === rig.id ? 'active-view' : ''} ${this.selectedRig?.id === rig.id ? 'selected' : ''}" data-rig-id="${rig.id}">
                <span class="camera-rig-color" style="background:#${rig.color.toString(16).padStart(6, '0')}"></span>
                <span class="camera-rig-name">Cam ${rig.name}</span>
                <span class="camera-rig-lens">${rig.lens.focalLength}mm ${rig.lens.sensor}</span>
                <span class="camera-rig-aspect">${rig.aspect}</span>
            </div>
        `).join('');

        // Add click handlers
        listDiv.querySelectorAll('.camera-rig-item').forEach(item => {
            item.addEventListener('click', () => {
                const rigId = item.dataset.rigId;
                const rig = this.get(rigId);
                if (rig) {
                    // Select the rig in the scene
                    this.app.selectObject(rig.group);
                }
            });
            item.addEventListener('dblclick', () => {
                const rigId = item.dataset.rigId;
                this.viewingRigId = rigId;
                if (this.app.orbit) this.app.orbit.enabled = false;
                this.refreshUI();
            });
        });
    }

    /** Delete the currently selected rig. */
    deleteSelectedRig() {
        const rig = this.selectedRig;
        if (!rig) {
            if (this.app.ui?.showNotification) this.app.ui.showNotification('Select a camera to delete', 'error');
            return;
        }
        this.removeRig(rig.id);
    }

    /** Frame the selected rig from current view. */
    frameCameraFromView() {
        const rig = this.selectedRig || this.rigs[0];
        if (!rig) return;
        this.setFromCurrentView(rig);
        if (this.app.ui?.showNotification) this.app.ui.showNotification(`Camera ${rig.name} framed from current view`, 'success');
    }
}
