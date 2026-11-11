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
        this.defaultRigId = null;
        // Camera controls are now in the right panel Camera tab
        // setTimeout(() => this.buildUI(), 100);
    }

    /** Every scene must have a camera that cannot be deleted. */
    ensureDefaultRig() {
        const existing = this.rigs.find(r => r.isDefault);
        if (existing) {
            this.defaultRigId = existing.id;
            return existing;
        }

        const rig = this.addRig('Camera', new THREE.Vector3(8, 6.5, 12), {
            isDefault: true,
            target: new THREE.Vector3(0, 1.2, -1),
            lens: { focalLength: 35, sensor: 'fullFrame' },
            aspect: '16:9'
        });
        this.defaultRigId = rig.id;
        return rig;
    }

    get defaultRig() {
        return this.rigs.find(r => r.isDefault) || null;
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
    addRig(name = null, position = null, options = {}) {
        const id = options.id || 'rig_' + Math.random().toString(36).slice(2, 9);
        const isDefault = options.isDefault === true;
        const color = options.color ?? RIG_COLORS[this.rigs.length % RIG_COLORS.length];
        const letter = options.letter || String.fromCharCode(65 + this.rigs.length);

        const group = new THREE.Group();
        group.name = options.name || (isDefault ? 'Camera' : `Camera ${name || letter}`);
        group.position.copy(position || new THREE.Vector3(10, 8, 10));

        // The group is the camera body. The aim target is kept separately so
        // orbit moves never move the camera to its own look-at point.
        const target = new THREE.Vector3().copy(options.target || new THREE.Vector3(0, 1.5, 0));
        if (options.rotation) {
            group.rotation.fromArray(options.rotation);
        } else {
            group.lookAt(target);
        }

        const lens = options.lens ? { ...options.lens } : { focalLength: 50, sensor: 'fullFrame' };
        const aspect = options.aspect || '16:9';
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

        // Camera rigs are data/aim helpers for shots, not visible set pieces.
        // Keeping the body hidden prevents it filling the view when zooming.
        group.visible = false;
        this.app.scene.add(group);
        this.app.objects.push(group);

        const rig = {
            id,
            name: options.name || name || (isDefault ? 'Camera' : letter),
            color,
            group,
            camera,
            target,
            frustum,
            lens,
            aspect,
            previewCamera: null,
            visibleInViewport: true,
            isDefault,
            deletable: !isDefault
        };
        group.userData.rigRef = rig;
        this.rigs.push(rig);
        if (isDefault) this.defaultRigId = id;
        this.updateRigFrustum(rig);
        this.refreshUI();
        return rig;
    }

    removeRig(rigId) {
        const rig = this.get(rigId);
        if (!rig) return false;
        if (rig.isDefault || rig.id === this.defaultRigId) {
            this.app.ui?.showNotification?.('The default scene camera cannot be deleted', 'error');
            return false;
        }
        return this._removeRigForce(rigId);
    }

    /** Internal removal used when rebuilding a scene's camera set. */
    _removeRigForce(rigId) {
        const idx = this.rigs.findIndex(r => r.id === rigId);
        if (idx === -1) return false;
        const rig = this.rigs[idx];
        if (this.viewingRigId === rigId) this.viewingRigId = null;
        this.app.scene.remove(rig.group);
        const oi = this.app.objects.indexOf(rig.group);
        if (oi > -1) this.app.objects.splice(oi, 1);
        this.rigs.splice(idx, 1);
        if (this.defaultRigId === rigId) this.defaultRigId = null;
        this.refreshUI();
        return true;
    }

    /** Remove every rig (used when loading a different scene). */
    clearRigs() {
        for (const rig of [...this.rigs]) this._removeRigForce(rig.id);
        this.viewingRigId = null;
        this.defaultRigId = null;
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
        rig.target.set(target.x, target.y, target.z);
        rig.group.lookAt(rig.target);
        rig.camera.updateMatrixWorld(true);
    }

    /** Copy the current editing-camera view into a rig ("lock framing"). */
    setFromCurrentView(rig) {
        const cam = this.app.camera;
        rig.group.position.copy(cam.position);
        rig.group.quaternion.copy(cam.quaternion);
        rig.camera.updateMatrixWorld(true);

        const orbitTarget = this.app.orbit?.target;
        if (orbitTarget) {
            rig.target.copy(orbitTarget);
        } else {
            const direction = new THREE.Vector3();
            cam.getWorldDirection(direction);
            rig.target.copy(cam.position).addScaledVector(direction, 10);
        }
        this.updateRigFrustum(rig);
    }

    /** The camera used for rendering: viewing rig or null (editing camera). */
    getRenderCamera() {
        if (!this.viewingRigId) return null;
        const rig = this.get(this.viewingRigId);
        if (!rig) return null;
        rig.camera.updateMatrixWorld(true);
        return rig.camera;
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
            // Rig visuals are editor-only helpers and are intentionally hidden.
            rig.group.visible = false;
            rig.frustum.setVisible(false);
        }
    }

    /** Build UI for camera rig controls - now handled by right panel Camera tab. */
    buildUI() {
        // Camera controls are now in the right panel Camera tab
        // This method is kept for compatibility but does nothing
        if (this.app.ui?.refreshCameraRigList) {
            this.app.ui.refreshCameraRigList();
        }
    }

    /** Refresh the camera rig list display. */
    refreshUI() {
        if (this.app.ui?.refreshCameraRigList) {
            this.app.ui.refreshCameraRigList();
            return;
        }

        const listDiv = document.getElementById('camera-rig-list');
        if (!listDiv) return;
        listDiv.innerHTML = this.rigs.length
            ? this.rigs.map(rig => `<div class="camera-rig-item" data-rig-id="${rig.id}">${rig.name}</div>`).join('')
            : '<div class="camera-rig-empty">No cameras.</div>';
    }

    /** Delete the currently selected rig. */
    deleteSelectedRig() {
        const rig = this.selectedRig;
        if (!rig) {
            if (this.app.ui?.showNotification) this.app.ui.showNotification('Select a camera to delete', 'error');
            return;
        }
        if (rig.isDefault) {
            if (this.app.ui?.showNotification) this.app.ui.showNotification('The default scene camera cannot be deleted', 'error');
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
