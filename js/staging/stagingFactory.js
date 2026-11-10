import * as THREE from 'three';
import { primitivePresets, stagingMaterial } from './objects/primitives.js';
import { figurePresets } from './objects/figures.js';
import { architecturePresets } from './objects/architecture.js';
import { propPresets } from './objects/props.js';

/**
 * StagingFactory — creates StagingObjects from the preset registry.
 * userData.staging carries the serialised data-model fields
 * (kind / presetId / params) so persistence can round-trip projects.
 */

export const STAGING_PRESETS = {
    primitive: primitivePresets,
    figure: figurePresets,
    architecture: architecturePresets,
    prop: propPresets
};

export class StagingFactory {
    constructor(app) {
        this.app = app;
    }

    static generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : 'stg_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    /**
     * @param {'primitive'|'figure'|'architecture'|'prop'} kind
     * @param {string} presetId
     * @param {object} [params]
     * @param {string|number} [colorOverride]
     */
    create(kind, presetId, params = {}, colorOverride = null) {
        const registry = STAGING_PRESETS[kind];
        const preset = registry && registry[presetId];
        if (!preset) {
            console.warn(`Staging: unknown preset ${kind}/${presetId}`);
            return null;
        }
        const merged = { ...preset.params, ...params };
        const color = colorOverride ?? preset.defaultColor;
        const material = stagingMaterial(color);
        const object = preset.create(merged, material);
        if (!object) return null;

        object.traverse(o => {
            if (o.isMesh && o.material === undefined) o.material = material;
        });
        // Colour override: re-tint any mesh still using the shared preset colour
        if (colorOverride != null) {
            object.traverse(o => {
                if (o.isMesh && o.material && o.material.color) {
                    // keep intentionally-different sub-materials (skin, glass) as-is
                    if (o.material.color.getHex() === preset.defaultColor) o.material = material;
                }
            });
        }

        object.name = `${preset.label} ${StagingFactory.generateId().slice(0, 4)}`;
        object.userData.type = 'staging';
        object.userData.name = preset.label;
        object.userData.staging = {
            id: StagingFactory.generateId(),
            kind,
            presetId,
            params: merged,
            colorOverride: colorOverride != null ? '#' + new THREE.Color(color).getHexString() : null
        };
        return object;
    }

    static getSeatMetadata(object) {
        if (!object) return null;
        if (object.userData && object.userData.seat) return object.userData.seat;
        let found = null;
        object.traverse(o => { if (!found && o.userData && o.userData.seat) found = o.userData.seat; });
        return found;
    }
}
