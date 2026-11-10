import * as THREE from 'three';

export class LayerMaterial {
    constructor(baseMaterial = null) {
        this.layers = [];
        this.baseMaterial = baseMaterial;
        this.mesh = null;
        this.threeMaterial = baseMaterial || new THREE.MeshPhysicalMaterial();
        this._dirty = true;
    }

    addLayer(type, properties = {}) {
        const id = 'layer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const layer = {
            id: id,
            type: type,
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            properties: { ...properties }
        };
        this.layers.push(layer);
        this._dirty = true;
        return layer;
    }

    removeLayer(id) {
        this.layers = this.layers.filter(l => l.id !== id);
        this._dirty = true;
        this._applyLayers();
    }

    updateLayer(id, updates) {
        const layer = this.layers.find(l => l.id === id);
        if (!layer) return;
        Object.assign(layer, updates);
        this._dirty = true;
        this._applyLayers();
    }

    reorderLayers(newOrder) {
        this.layers = newOrder;
        this._dirty = true;
        this._applyLayers();
    }

    getMaterial() {
        if (this._dirty) {
            this._applyLayers();
        }
        return this.threeMaterial;
    }

    _applyLayers() {
        if (!this.threeMaterial) return;
        
        const visibleLayers = this.layers.filter(l => l.visible);
        if (visibleLayers.length === 0) return;

        const baseLayer = visibleLayers.find(l => l.type === 'color') || visibleLayers[0];
        const otherLayers = visibleLayers.filter(l => l !== baseLayer);

        if (baseLayer && baseLayer.type === 'color') {
            const props = baseLayer.properties;
            this.threeMaterial.color.set(props.color || 0xffffff);
            this.threeMaterial.opacity = baseLayer.opacity;
            this.threeMaterial.transparent = baseLayer.opacity < 1;
        }

        otherLayers.forEach(layer => {
            const props = layer.properties;
            const factor = layer.opacity;

            switch (layer.type) {
                case 'color':
                    if (props.color !== undefined) {
                        this._blendColor(this.threeMaterial.color, new THREE.Color(props.color), factor, layer.blendMode);
                    }
                    break;
                case 'roughness':
                    if (props.roughness !== undefined) {
                        this.threeMaterial.roughness = this._blendValue(
                            this.threeMaterial.roughness, props.roughness, factor, layer.blendMode
                        );
                    }
                    break;
                case 'metalness':
                    if (props.metalness !== undefined) {
                        this.threeMaterial.metalness = this._blendValue(
                            this.threeMaterial.metalness, props.metalness, factor, layer.blendMode
                        );
                    }
                    break;
                case 'clearcoat':
                    if (props.clearcoat !== undefined) {
                        this.threeMaterial.clearcoat = this._blendValue(
                            this.threeMaterial.clearcoat || 0, props.clearcoat, factor, layer.blendMode
                        );
                    }
                    break;
                case 'transmission':
                    if (props.transmission !== undefined) {
                        this.threeMaterial.transmission = this._blendValue(
                            this.threeMaterial.transmission || 0, props.transmission, factor, layer.blendMode
                        );
                    }
                    break;
                case 'sheen':
                    if (props.sheen !== undefined) {
                        this.threeMaterial.sheen = this._blendValue(
                            this.threeMaterial.sheen || 0, props.sheen, factor, layer.blendMode
                        );
                    }
                    break;
                case 'displacement':
                    if (props.displacementMap) {
                        this.threeMaterial.displacementMap = props.displacementMap;
                        this.threeMaterial.displacementScale = this._blendValue(
                            this.threeMaterial.displacementScale || 0, props.displacementScale || 0, factor, layer.blendMode
                        );
                    }
                    break;
                case 'outline':
                    if (props.outlineEnabled && this.mesh) {
                        const outlineColor = props.outlineColor || 0x000000;
                        const outlineThickness = props.outlineThickness || 0.02;
                        this._applyOutline(outlineColor, outlineThickness);
                    } else if (this.mesh) {
                        this._removeOutline();
                    }
                    break;
                case 'glass':
                    if (props.transmission !== undefined) {
                        this.threeMaterial.transmission = this._blendValue(
                            this.threeMaterial.transmission || 0, props.transmission, factor, layer.blendMode
                        );
                        this.threeMaterial.ior = props.ior || 1.5;
                        this.threeMaterial.thickness = props.thickness || 0.5;
                    }
                    break;
            }
        });

        this.threeMaterial.needsUpdate = true;
        this._dirty = false;
    }

    _blendValue(base, target, factor, blendMode) {
        if (blendMode === 'add') return base + target * factor;
        if (blendMode === 'multiply') return base * (1 - factor) + base * target * factor;
        if (blendMode === 'screen') return base * (1-factor) + (1-(1-base)*(1-target)) * factor;
        if (blendMode === 'overlay') {
            const value = base < 0.5 ? 2*base*target : 1-2*(1-base)*(1-target);
            return base * (1-factor) + value * factor;
        }
        return base * (1 - factor) + target * factor;
    }

    _blendColor(base, target, factor, blendMode) {
        base.setRGB(
            this._blendValue(base.r, target.r, factor, blendMode),
            this._blendValue(base.g, target.g, factor, blendMode),
            this._blendValue(base.b, target.b, factor, blendMode)
        );
    }

    _applyOutline(color, thickness) {
        if (!this.mesh) return;
        const existing = this.mesh.getObjectByName('outline');
        if (existing) {
            existing.geometry.dispose();
            existing.material.dispose();
            this.mesh.remove(existing);
        }
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.6,
            depthTest: true,
            depthWrite: true
        });
        const outlineMesh = new THREE.Mesh(this.mesh.geometry, outlineMaterial);
        outlineMesh.name = 'outline';
        outlineMesh.renderOrder = 0;
        const s = 1 + thickness;
        outlineMesh.scale.set(s, s, s);
        outlineMesh.visible = true;
        this.mesh.add(outlineMesh);
    }

    _removeOutline() {
        if (!this.mesh) return;
        const existing = this.mesh.getObjectByName('outline');
        if (existing) {
            existing.geometry.dispose();
            existing.material.dispose();
            this.mesh.remove(existing);
        }
    }

    setMesh(mesh) {
        this.mesh = mesh;
        this._applyLayers();
    }

    getLayers() {
        return this.layers;
    }

    dispose() {
        this._removeOutline();
        if (this.threeMaterial) {
            this.threeMaterial.dispose();
        }
        this.layers = [];
    }
}

export const LAYER_PRESETS = {
    'glass': [
        { type: 'color', properties: { color: 0x88ccff }, opacity: 1 },
        { type: 'glass', properties: { transmission: 0.9, ior: 1.5, thickness: 0.5 }, opacity: 1, blendMode: 'normal' }
    ],
    'metal': [
        { type: 'color', properties: { color: 0xcccccc }, opacity: 1 },
        { type: 'metalness', properties: { metalness: 1 }, opacity: 1 },
        { type: 'roughness', properties: { roughness: 0.3 }, opacity: 1 }
    ],
    'plastic': [
        { type: 'color', properties: { color: 0xff4444 }, opacity: 1 },
        { type: 'clearcoat', properties: { clearcoat: 0.5 }, opacity: 1 }
    ],
    'fabric': [
        { type: 'color', properties: { color: 0x443333 }, opacity: 1 },
        { type: 'sheen', properties: { sheen: 0.5 }, opacity: 1 },
        { type: 'roughness', properties: { roughness: 0.8 }, opacity: 1 }
    ],
    'outline': [
        { type: 'color', properties: { color: 0x000000 }, opacity: 1 },
        { type: 'outline', properties: { outlineEnabled: true, outlineColor: 0x000000, outlineThickness: 0.02 }, opacity: 1 }
    ]
};
