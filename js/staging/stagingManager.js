import * as THREE from 'three';
import { StagingFactory, STAGING_PRESETS } from './stagingFactory.js';
import { AddObjectCommand } from '../historyManager.js';

/**
 * StagingManager — the blocking workflow: place figures, props and
 * architecture from the preset library, with chair-aware seating.
 */
export class StagingManager {
    constructor(app) {
        this.app = app;
        this.factory = new StagingFactory(app);
    }

    /** All presets for UI panels: [{ kind, presetId, label }] */
    static listPresets() {
        const out = [];
        for (const [kind, registry] of Object.entries(STAGING_PRESETS)) {
            for (const [presetId, preset] of Object.entries(registry)) {
                out.push({ kind, presetId, label: preset.label });
            }
        }
        return out;
    }

    /**
     * Create and place a staging object at a world position (default origin).
     * @returns the created object or null
     */
    place(kind, presetId, { position = null, params = {}, colorOverride = null } = {}) {
        const object = this.factory.create(kind, presetId, params, colorOverride);
        if (!object) return null;

        if (position) object.position.copy(position);

        // Chair-aware seating: dropping a seated figure near a chair snaps
        // it to the seat point and copies the chair's yaw.
        if (kind === 'figure' && presetId === 'figure-seated') {
            if (this._snapToChair(object, position)) {
                // snapped: skip the history entry for now, position resolved
            }
        }

        const command = new AddObjectCommand(this.app, object);
        this.app.historyManager.executeCommand(command);
        return object;
    }

    /**
     * Snap a seated figure onto the nearest chair under/within range.
     * Seat metadata: { height, yaw, offset } on the chair group.
     */
    _snapToChair(figure, dropPosition) {
        const searchCenter = dropPosition || figure.position;
        const radius = 1.2; // metres
        let best = null, bestDist = Infinity;

        for (const candidate of this.app.objects) {
            if (!candidate.userData || candidate.userData.type !== 'staging') continue;
            const st = candidate.userData.staging;
            if (!st || st.kind !== 'prop') continue;
            const seat = StagingFactory.getSeatMetadata(candidate);
            if (!seat) continue;
            const d = candidate.position.distanceTo(searchCenter);
            // Consider only chairs near the drop point (or all chairs if no drop point)
            if (dropPosition && d > radius) continue;
            if (d < bestDist) { bestDist = d; best = { candidate, seat }; }
        }
        if (!best) return false;

        const { candidate, seat } = best;
        const offset = seat.offset || [0, 0, 0];
        const yaw = candidate.rotation.y + (seat.yaw || 0);
        const rotated = new THREE.Vector3(offset[0], offset[1], offset[2])
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), candidate.rotation.y);
        figure.position.copy(candidate.position).add(rotated);
        figure.position.y = seat.height;
        figure.rotation.y = yaw;
        figure.userData.seatedOn = candidate.userData.staging?.id || candidate.uuid;
        return true;
    }

    /** Re-apply chair snap for an already-selected seated figure ("sit" action). */
    sitSelected() {
        const sel = this.app.selectedObject;
        if (!sel || !sel.userData?.staging) return false;
        const st = sel.userData.staging;
        if (st.kind !== 'figure' || !st.presetId.startsWith('figure-seated')) return false;
        return this._snapToChair(sel, sel.position);
    }

    /** Convenience: add a preset button entry point used by the UI. */
    addFromUI(kind, presetId) {
        // Drop slightly in front of the editing camera's focus (origin by default)
        const placed = this.place(kind, presetId, {});
        if (placed && this.app.ui?.showNotification) {
            this.app.ui.showNotification(`Placed ${placed.name}`, 'success');
        }
        return placed;
    }
}
