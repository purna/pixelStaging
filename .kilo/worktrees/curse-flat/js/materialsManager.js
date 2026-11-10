
import * as THREE from 'three';
import { LayerMaterial, LAYER_PRESETS } from './layerMaterial.js';

export class MaterialsManager {
    constructor(app) {
        this.app = app;
        this.materials = [];
        this.selectedMaterial = null;
        this.container = document.getElementById('materials-content');
        this.materialsSectionContainer = document.getElementById('materials-section');
        this.init();
    }

    init() {
        // Create default materials
        this.createDefaultMaterials();
    }

    createDefaultMaterials() {
        // Create some default materials
        this.createMaterial('Default', 0x00ff41, 0.2, 0.3, 1);
        this.createMaterial('Metallic', 0x888888, 0.8, 0.1, 1);
        this.createMaterial('Rough Plastic', 0xff5555, 0.0, 0.8, 1);
        this.createMaterial('Smooth Plastic', 0x5555ff, 0.0, 0.2, 1);
        this.createMaterial('Gold', 0xffd700, 1.0, 0.1, 1);
        this.createMaterial('Rusty Metal', 0x8b4513, 0.7, 0.6, 1);

        this.render();
    }

    createMaterial(name, color, metalness, roughness, opacity = 1) {
        const id = 'mat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const threeMaterial = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: metalness,
            roughness: roughness,
            opacity: opacity,
            transparent: opacity < 1,
            clearcoat: 0,
            transmission: 0,
            sheen: 0,
            sheenRoughness: 0.5,
            envMapIntensity: 1,
            name: name
        });

        const layerMaterial = new LayerMaterial(threeMaterial);
        layerMaterial.addLayer('color', { color: color });
        layerMaterial.addLayer('roughness', { roughness: roughness });
        layerMaterial.addLayer('metalness', { metalness: metalness });
        if (opacity < 1) {
            layerMaterial.addLayer('opacity', { opacity: opacity });
        }

        const material = {
            id: id,
            name: name,
            color: color,
            metalness: metalness,
            roughness: roughness,
            opacity: opacity,
            clearcoat: 0,
            transmission: 0,
            sheen: 0,
            sheenRoughness: 0.5,
            displacementScale: 0,
            outlineEnabled: false,
            outlineColor: 0x000000,
            outlineThickness: 0.02,
            objectsUsing: [],
            maps: {
                albedo: null,
                normal: null,
                roughnessMap: null,
                metalnessMap: null,
                aoMap: null,
                displacementMap: null,
                alphaMap: null,
                emissiveMap: null
            },
            threeMaterial: threeMaterial,
            layerMaterial: layerMaterial
        };
        this.materials.push(material);
        return material;
    }

    loadTexture(file, material, mapType) {
        return new Promise((resolve, reject) => {
            if (!file || !material) {
                reject(new Error('Missing file or material'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const texture = new THREE.Texture(img);
                    texture.needsUpdate = true;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    
                    if (!material.maps) {
                        material.maps = {};
                    }
                    material.maps[mapType] = texture;
                    
                    if (material.threeMaterial) {
                        switch (mapType) {
                            case 'albedo':
                                material.threeMaterial.map = texture;
                                break;
                            case 'normal':
                                material.threeMaterial.normalMap = texture;
                                break;
                            case 'roughnessMap':
                                material.threeMaterial.roughnessMap = texture;
                                break;
                            case 'metalnessMap':
                                material.threeMaterial.metalnessMap = texture;
                                break;
                            case 'aoMap':
                                material.threeMaterial.aoMap = texture;
                                break;
                            case 'displacementMap':
                                material.threeMaterial.displacementMap = texture;
                                material.threeMaterial.displacementScale = material.displacementScale || 0;
                                break;
                            case 'alphaMap':
                                material.threeMaterial.alphaMap = texture;
                                material.threeMaterial.transparent = true;
                                break;
                            case 'emissiveMap':
                                material.threeMaterial.emissiveMap = texture;
                                material.threeMaterial.emissive.setHex(0xffffff);
                                break;
                        }
                        material.threeMaterial.needsUpdate = true;
                    }
                    
                    resolve(texture);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        // Add create material button
        const createBtn = document.createElement('button');
        createBtn.className = 'btn primary';
        createBtn.style.marginBottom = '10px';
        createBtn.style.width = '100%';
        createBtn.innerHTML = '<i class="fas fa-plus"></i> Create Material';
        createBtn.addEventListener('click', () => this.createNewMaterial());
        this.container.appendChild(createBtn);

        // Render each material
        this.materials.forEach(material => {
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.dataset.materialId = material.id;
            if (this.selectedMaterial === material) {
                materialEl.classList.add('selected');
            }

            materialEl.innerHTML = `
                <div class="material-preview" style="background-color: #${material.color.toString(16).padStart(6, '0')}" title="Used by: ${material.objectsUsing.length} objects"></div>
                <div class="material-info">
                    <input type="text" class="material-name" value="${material.name}">
                    <div class="material-properties">
                        <span class="material-prop">M: ${material.metalness.toFixed(1)}</span>
                        <span class="material-prop">R: ${material.roughness.toFixed(1)}</span>
                        <span class="material-prop">O: ${(material.opacity !== undefined ? material.opacity : 1).toFixed(1)}</span>
                    </div>
                </div>
                <div class="material-actions">
                    <button class="btn apply-material-btn" title="Apply to Selected"><i class="fas fa-check"></i></button>
                    <button class="btn edit-material-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn delete-material-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Add event listeners
            materialEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('material-name') ||
                    e.target.classList.contains('apply-material-btn') ||
                    e.target.classList.contains('edit-material-btn') ||
                    e.target.classList.contains('delete-material-btn')) {
                    return; // Let specific handlers handle these
                }
                this.selectMaterial(material);
            });

            // Material name editing
            const nameInput = materialEl.querySelector('.material-name');
            nameInput.addEventListener('change', (e) => {
                material.name = e.target.value;
            });
            nameInput.addEventListener('click', (e) => e.stopPropagation());

            // Apply material button
            materialEl.querySelector('.apply-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyMaterialToSelected(material);
            });

            // Edit material button
            materialEl.querySelector('.edit-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMaterial(material);
            });

            // Delete material button
            materialEl.querySelector('.delete-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMaterial(material);
            });

            this.container.appendChild(materialEl);
        });
    }

    createNewMaterial() {
        // Use config defaults if available
        const defaults = {
            name: 'New Material',
            color: 0x00ff41,
            metalness: 0.2,
            roughness: 0.3,
            opacity: 1
        };

        // Override with config defaults if available
        if (typeof APP_DEFAULTS !== 'undefined') {
            defaults.name = APP_DEFAULTS.materials.defaultMaterialName;
            defaults.color = parseInt(APP_DEFAULTS.materials.defaultColor.substring(1), 16);
            defaults.metalness = APP_DEFAULTS.materials.defaultMetalness;
            defaults.roughness = APP_DEFAULTS.materials.defaultRoughness;
        }

        // Show edit dialog with defaults
        this.showCreateMaterialDialog(defaults);
    }

    showCreateMaterialDialog(defaults) {
        const dialog = document.createElement('div');
        dialog.className = 'material-edit-dialog';
        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>Create New Material</h3>
                <button class="close-dialog-btn">&times;</button>
            </div>
            <div class="dialog-content">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="new-material-name" value="${defaults.name}">
                </div>
                <div class="form-group">
                    <label>Color:</label>
                    <input type="color" id="new-material-color" value="#${defaults.color.toString(16).padStart(6, '0')}">
                </div>
                <div class="form-group">
                    <label>Metalness: <span id="new-metalness-value">${defaults.metalness.toFixed(2)}</span></label>
                    <input type="range" id="new-material-metalness" min="0" max="1" step="0.01" value="${defaults.metalness}">
                </div>
                <div class="form-group">
                    <label>Roughness: <span id="new-roughness-value">${defaults.roughness.toFixed(2)}</span></label>
                    <input type="range" id="new-material-roughness" min="0" max="1" step="0.01" value="${defaults.roughness}">
                </div>
                <div class="form-group">
                    <label>Opacity: <span id="new-opacity-value">${defaults.opacity.toFixed(2)}</span></label>
                    <input type="range" id="new-material-opacity" min="0" max="1" step="0.01" value="${defaults.opacity}">
                </div>
                <div class="form-group">
                    <label>Clearcoat: <span id="new-clearcoat-value">0.00</span></label>
                    <input type="range" id="new-material-clearcoat" min="0" max="1" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label>Transmission: <span id="new-transmission-value">0.00</span></label>
                    <input type="range" id="new-material-transmission" min="0" max="1" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label>Sheen: <span id="new-sheen-value">0.00</span></label>
                    <input type="range" id="new-material-sheen" min="0" max="1" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label>Displacement Scale: <span id="new-displacement-value">0.00</span></label>
                    <input type="range" id="new-material-displacement" min="0" max="1" step="0.01" value="0">
                </div>
                <div class="texture-maps-section">
                    <label>Texture Maps:</label>
                    <div class="texture-map-row">
                        <label>Albedo:</label>
                        <input type="file" id="new-material-albedo" accept="image/*">
                    </div>
                    <div class="texture-map-row">
                        <label>Normal:</label>
                        <input type="file" id="new-material-normal" accept="image/*">
                    </div>
                    <div class="texture-map-row">
                        <label>Roughness:</label>
                        <input type="file" id="new-material-roughness-map" accept="image/*">
                    </div>
                    <div class="texture-map-row">
                        <label>Metalness:</label>
                        <input type="file" id="new-material-metalness-map" accept="image/*">
                    </div>
                    <div class="texture-map-row">
                        <label>AO:</label>
                        <input type="file" id="new-material-ao-map" accept="image/*">
                    </div>
                </div>
            </div>
            <div class="dialog-actions">
                <button class="btn" id="cancel-create-material">Cancel</button>
                <button class="btn primary" id="save-create-material">Create</button>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.close-dialog-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('#cancel-create-material').addEventListener('click', () => dialog.remove());

        const liveBindings = [
            ['new-material-metalness', 'new-metalness-value'],
            ['new-material-roughness', 'new-roughness-value'],
            ['new-material-opacity', 'new-opacity-value'],
            ['new-material-clearcoat', 'new-clearcoat-value'],
            ['new-material-transmission', 'new-transmission-value'],
            ['new-material-sheen', 'new-sheen-value'],
            ['new-material-displacement', 'new-displacement-value']
        ];

        liveBindings.forEach(([inputId, spanId]) => {
            const input = dialog.querySelector('#' + inputId);
            const span = dialog.querySelector('#' + spanId);
            if (!input || !span) return;
            input.addEventListener('input', () => {
                span.textContent = parseFloat(input.value).toFixed(2);
            });
        });

        dialog.querySelector('#save-create-material').addEventListener('click', async () => {
            const nameInput = dialog.querySelector('#new-material-name');
            const colorInput = dialog.querySelector('#new-material-color');
            const metalnessInput = dialog.querySelector('#new-material-metalness');
            const roughnessInput = dialog.querySelector('#new-material-roughness');
            const opacityInput = dialog.querySelector('#new-material-opacity');

            let colorValue = colorInput.value;
            if (colorValue.startsWith('#')) {
                colorValue = parseInt(colorValue.substring(1), 16);
            }

            const newMaterial = {
                name: nameInput.value,
                color: colorValue,
                metalness: parseFloat(metalnessInput.value),
                roughness: parseFloat(roughnessInput.value),
                opacity: parseFloat(opacityInput.value),
                clearcoat: parseFloat(dialog.querySelector('#new-material-clearcoat').value),
                transmission: parseFloat(dialog.querySelector('#new-material-transmission').value),
                sheen: parseFloat(dialog.querySelector('#new-material-sheen').value),
                sheenRoughness: 0.5,
                displacementScale: parseFloat(dialog.querySelector('#new-material-displacement').value),
                maps: {
                    albedo: null,
                    normal: null,
                    roughnessMap: null,
                    metalnessMap: null,
                    aoMap: null,
                    displacementMap: null
                }
            };

            const albedoFile = dialog.querySelector('#new-material-albedo')?.files[0];
            const normalFile = dialog.querySelector('#new-material-normal')?.files[0];
            const roughnessFile = dialog.querySelector('#new-material-roughness-map')?.files[0];
            const metalnessFile = dialog.querySelector('#new-material-metalness-map')?.files[0];
            const aoFile = dialog.querySelector('#new-material-ao-map')?.files[0];

            try {
                if (albedoFile) {
                    newMaterial.maps.albedo = await this.loadTexture(albedoFile, newMaterial, 'albedo');
                }
                if (normalFile) {
                    newMaterial.maps.normal = await this.loadTexture(normalFile, newMaterial, 'normal');
                }
                if (roughnessFile) {
                    newMaterial.maps.roughnessMap = await this.loadTexture(roughnessFile, newMaterial, 'roughnessMap');
                }
                if (metalnessFile) {
                    newMaterial.maps.metalnessMap = await this.loadTexture(metalnessFile, newMaterial, 'metalnessMap');
                }
                if (aoFile) {
                    newMaterial.maps.aoMap = await this.loadTexture(aoFile, newMaterial, 'aoMap');
                }
            } catch (err) {
                console.error('Failed to load texture:', err);
            }

            this.createMaterial(
                newMaterial.name,
                newMaterial.color,
                newMaterial.metalness,
                newMaterial.roughness,
                newMaterial.opacity
            );

            const createdMaterial = this.materials[this.materials.length - 1];
            if (createdMaterial && newMaterial.maps) {
                createdMaterial.maps = newMaterial.maps;
                createdMaterial.clearcoat = newMaterial.clearcoat;
                createdMaterial.transmission = newMaterial.transmission;
                createdMaterial.sheen = newMaterial.sheen;
                createdMaterial.displacementScale = newMaterial.displacementScale;
                if (createdMaterial.threeMaterial) {
                    createdMaterial.threeMaterial.clearcoat = newMaterial.clearcoat || 0;
                    createdMaterial.threeMaterial.transmission = newMaterial.transmission || 0;
                    createdMaterial.threeMaterial.sheen = newMaterial.sheen || 0;
                    createdMaterial.threeMaterial.displacementScale = newMaterial.displacementScale || 0;
                    createdMaterial.threeMaterial.needsUpdate = true;
                }
            }

            dialog.remove();
            this.render();
            this.app.ui.showNotification('Material created successfully!', 'success');
        });
    }

    selectMaterial(material) {
        this.selectedMaterial = material;
        this.render();
    }

    getMaterialSlots(mesh) {
        if (!mesh?.material) return [];
        return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    }

    buildMaterial(material) {
        const result = material.threeMaterial.clone();
        result.name = material.name || 'Material';
        result.color.setHex(material.color);
        result.metalness = material.metalness;
        result.roughness = material.roughness;
        result.opacity = material.opacity ?? 1;
        result.clearcoat = material.clearcoat || 0;
        result.transmission = material.transmission || 0;
        result.sheen = material.sheen || 0;
        result.sheenRoughness = material.sheenRoughness || 0.5;
        result.map = material.maps?.albedo || null;
        result.normalMap = material.maps?.normal || null;
        result.roughnessMap = material.maps?.roughnessMap || null;
        result.metalnessMap = material.maps?.metalnessMap || null;
        result.aoMap = material.maps?.aoMap || null;
        result.displacementMap = material.maps?.displacementMap || null;
        result.alphaMap = material.maps?.alphaMap || null;
        result.emissiveMap = material.maps?.emissiveMap || null;
        result.displacementScale = material.displacementScale || 0;
        result.transparent = result.opacity < 1 || !!result.alphaMap;
        result.userData = { ...result.userData, materialAssetId: material.id };
        result.needsUpdate = true;
        return result;
    }

    rebuildGeometryGroups(mesh, slotCount) {
        if (!mesh?.geometry || slotCount < 1) return;
        const count = mesh.geometry.index?.count || mesh.geometry.attributes?.position?.count || 0;
        if (!count) return;
        mesh.geometry.clearGroups();
        const triangles = Math.floor(count / 3);
        for (let slot = 0; slot < slotCount; slot++) {
            const start = Math.floor(triangles * slot / slotCount);
            const end = Math.floor(triangles * (slot + 1) / slotCount);
            mesh.geometry.addGroup(start * 3, (end - start) * 3, slot);
        }
    }

    addMaterialSlot(mesh, material = null) {
        const slots = this.getMaterialSlots(mesh);
        if (!slots.length) return -1;
        slots.push(material ? this.buildMaterial(material) : slots[slots.length - 1].clone());
        mesh.material = slots;
        this.rebuildGeometryGroups(mesh, slots.length);
        mesh.userData.activeMaterialSlot = slots.length - 1;
        return slots.length - 1;
    }

    removeMaterialSlot(mesh, slotIndex) {
        const slots = this.getMaterialSlots(mesh);
        if (slots.length <= 1) return false;
        const index = Math.max(0, Math.min(slotIndex, slots.length - 1));
        slots[index]?.dispose?.();
        slots.splice(index, 1);
        mesh.material = slots.length === 1 ? slots[0] : slots;
        this.rebuildGeometryGroups(mesh, slots.length);
        mesh.userData.activeMaterialSlot = Math.min(index, slots.length - 1);
        return true;
    }

    syncMaterialUsers(material) {
        if (!material?.id) return;
        this.app.scene?.traverse(object => {
            if (!object.isMesh || !object.material) return;
            const slots = this.getMaterialSlots(object);
            slots.forEach((slot, index) => {
                if (slot.userData?.materialAssetId !== material.id) return;
                const replacement = this.buildMaterial(material);
                if (object.userData.shapeType === 'text' && index === 0 && slot.map) {
                    replacement.map = slot.map;
                    replacement.transparent = true;
                }
                slot.dispose?.();
                slots[index] = replacement;
            });
            object.material = slots.length === 1 ? slots[0] : slots;
        });
    }

    compileAssetMaterial(asset) {
        if (!asset) return null;
        let material = this.materials.find(item => item.sourceAssetId === asset.id);
        const baseColor = new THREE.Color(asset.color || '#888888');
        if (!material) {
            material = this.createMaterial(asset.name || 'Material', baseColor.getHex(), 0.1, 0.6, (asset.opacity ?? 100) / 100);
            material.sourceAssetId = asset.id;
        }
        material.name = asset.name || material.name;
        material.color = baseColor.getHex();
        material.metalness = asset.metalness ?? material.metalness;
        material.roughness = asset.roughness ?? material.roughness;
        material.opacity = (asset.opacity ?? 100) / 100;
        material.clearcoat = asset.clearcoat ?? material.clearcoat ?? 0;
        material.transmission = asset.transmission ?? material.transmission ?? 0;
        material.sheen = asset.sheen ?? material.sheen ?? 0;
        material.textureLayers = (asset.layers || []).map(layer => ({ ...layer }));

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `#${material.color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, 256, 256);
        const composite = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen', overlay: 'overlay' };
        let hasCanvasLayer = false;
        const videoLayers = [];

        const drawLayer = (layer) => {
            if (layer.enabled === false) return;
            ctx.save();
            ctx.globalAlpha = (layer.opacity ?? 100) / 100;
            ctx.globalCompositeOperation = composite[layer.blendMode] || 'source-over';
            const size = Math.max(1, Number(layer.scale) || 8);
            if (layer.type === 'color') {
                ctx.fillStyle = layer.color || '#888888'; ctx.fillRect(0, 0, 256, 256); hasCanvasLayer = true;
            } else if (layer.type === 'gradient' || layer.type === 'rainbow') {
                const angle = (Number(layer.angle) || 0) * Math.PI / 180;
                const dx = Math.cos(angle) * 128, dy = Math.sin(angle) * 128;
                const gradient = ctx.createLinearGradient(128 - dx, 128 - dy, 128 + dx, 128 + dy);
                if (layer.type === 'rainbow') {
                    ['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000'].forEach((color, index, all) => gradient.addColorStop(index / (all.length - 1), color));
                } else {
                    gradient.addColorStop(0, layer.colorA || '#111827'); gradient.addColorStop(1, layer.colorB || '#8b5cf6');
                }
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256); hasCanvasLayer = true;
            } else if (layer.type === 'noise') {
                const noiseCanvas = document.createElement('canvas'); noiseCanvas.width = noiseCanvas.height = 256;
                const noiseContext = noiseCanvas.getContext('2d');
                const image = noiseContext.createImageData(256, 256);
                const a = new THREE.Color(layer.colorA || '#111111'), b = new THREE.Color(layer.colorB || '#eeeeee');
                let seed = Number(layer.seed) || 1;
                for (let i = 0; i < image.data.length; i += 4) {
                    seed = (seed * 1664525 + 1013904223) % 4294967296; const t = seed / 4294967296;
                    image.data[i] = 255 * (a.r + (b.r-a.r)*t); image.data[i+1] = 255 * (a.g + (b.g-a.g)*t); image.data[i+2] = 255 * (a.b + (b.b-a.b)*t); image.data[i+3] = 255;
                }
                noiseContext.putImageData(image, 0, 0); ctx.drawImage(noiseCanvas, 0, 0); hasCanvasLayer = true;
            } else if (layer.type === 'pattern' || layer.type === 'duct') {
                ctx.fillStyle = layer.colorB || '#eeeeee'; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = layer.colorA || '#111111';
                const pattern = layer.type === 'duct' ? 'stripes' : (layer.pattern || 'checker');
                for (let y=0; y<256; y+=size) for (let x=0; x<256; x+=size) {
                    if (pattern === 'dots') { ctx.beginPath(); ctx.arc(x+size/2,y+size/2,size/4,0,Math.PI*2); ctx.fill(); }
                    else if (pattern === 'stripes') { if ((x/size)%2===0) ctx.fillRect(x,0,size,256); }
                    else if (((x+y)/size)%2===0) ctx.fillRect(x,y,size,size);
                }
                hasCanvasLayer = true;
            } else if (layer.type === 'image' && layer.url) {
                const image = new Image(); image.crossOrigin = 'anonymous';
                const operation = composite[layer.blendMode] || 'source-over';
                const alpha = (layer.opacity ?? 100) / 100;
                image.onload = () => { ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = operation; ctx.drawImage(image, 0, 0, 256, 256); ctx.restore(); material.maps.albedo.needsUpdate = true; this.syncMaterialUsers(material); };
                image.src = layer.url; hasCanvasLayer = true;
            }
            ctx.restore();
        };

        material.maps = material.maps || {};
        for (const layer of material.textureLayers) {
            if (layer.enabled === false) continue;
            drawLayer(layer);
            const factor = (layer.opacity ?? 100) / 100;
            const blend = (base, value) => {
                if (layer.blendMode === 'add') return Math.min(1, base + value * factor);
                if (layer.blendMode === 'multiply') return base * (1 - factor + value * factor);
                if (layer.blendMode === 'screen') return base * (1 - factor) + (1 - (1-base)*(1-value)) * factor;
                if (layer.blendMode === 'overlay') {
                    const overlay = base < 0.5 ? 2*base*value : 1-2*(1-base)*(1-value);
                    return base * (1-factor) + overlay * factor;
                }
                return base*(1-factor)+value*factor;
            };
            if (layer.type === 'lighting') material.threeMaterial.emissiveIntensity = blend(material.threeMaterial.emissiveIntensity || 0, (layer.strength || 0) / 100);
            if (layer.type === 'fresnel') { material.sheen = blend(material.sheen || 0, layer.bias ?? 0.1); material.clearcoat = blend(material.clearcoat || 0, Math.min(1, (layer.power || 3) / 5)); }
            if (layer.type === 'cavity') material.threeMaterial.aoMapIntensity = blend(material.threeMaterial.aoMapIntensity || 1, layer.strength ?? 1);
            if (layer.type === 'toon') { material.threeMaterial.flatShading = true; material.roughness = blend(material.roughness, 0.85); }
            if (layer.type === 'glass') { material.transmission = blend(material.transmission || 0, layer.transmission ?? 0.9); material.threeMaterial.ior = layer.ior ?? 1.5; material.threeMaterial.thickness = layer.thickness ?? 0.5; material.roughness = layer.roughness ?? material.roughness; }
            if (layer.type === 'reflection') { material.metalness = blend(material.metalness, layer.metalness ?? 1); material.roughness = layer.roughness ?? material.roughness; material.threeMaterial.envMapIntensity = layer.intensity ?? 1; }
            if (layer.type === 'outline') { material.outlineEnabled = true; material.outlineColor = new THREE.Color(layer.color || '#000000').getHex(); material.outlineThickness = layer.thickness ?? 0.02; }
            if ((layer.type === 'normal' || layer.type === 'displace') && layer.url) {
                const texture = new THREE.TextureLoader().load(layer.url, () => this.syncMaterialUsers(material));
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                if (layer.type === 'normal') { material.maps.normal = texture; material.threeMaterial.normalScale.setScalar(layer.strength ?? 1); }
                else { material.maps.displacementMap = texture; material.displacementScale = layer.scale ?? 0.1; material.threeMaterial.displacementBias = layer.bias ?? 0; }
            }
            if (layer.type === 'video' && layer.url) {
                const video = document.createElement('video'); video.src = layer.url; video.loop = layer.loop !== false; video.muted = true; video.playsInline = true; video.playbackRate = layer.playbackRate || 1;
                if (layer.autoplay !== false) video.play().catch(() => {});
                videoLayers.push({ video, layer }); hasCanvasLayer = true;
            }
        }
        if (hasCanvasLayer) {
            material.maps.albedo = new THREE.CanvasTexture(canvas);
            material.maps.albedo.colorSpace = THREE.SRGBColorSpace;
        }
        if (videoLayers.length) {
            const staticCanvas = document.createElement('canvas'); staticCanvas.width = staticCanvas.height = 256;
            staticCanvas.getContext('2d').drawImage(canvas, 0, 0);
            if (material._videoFrame) cancelAnimationFrame(material._videoFrame);
            const updateVideos = () => {
                ctx.clearRect(0, 0, 256, 256); ctx.drawImage(staticCanvas, 0, 0);
                for (const { video, layer } of videoLayers) {
                    if (video.readyState < 2) continue;
                    ctx.save(); ctx.globalAlpha = (layer.opacity ?? 100) / 100; ctx.globalCompositeOperation = composite[layer.blendMode] || 'source-over'; ctx.drawImage(video, 0, 0, 256, 256); ctx.restore();
                }
                material.maps.albedo.needsUpdate = true;
                material._videoFrame = requestAnimationFrame(updateVideos);
            };
            updateVideos();
        }
        material.threeMaterial.map = material.maps.albedo || null;
        material.threeMaterial.color.setHex(material.color);
        material.threeMaterial.metalness = material.metalness;
        material.threeMaterial.roughness = material.roughness;
        material.threeMaterial.opacity = material.opacity;
        material.threeMaterial.transparent = material.opacity < 1;
        material.threeMaterial.transmission = material.transmission || 0;
        material.threeMaterial.clearcoat = material.clearcoat || 0;
        material.threeMaterial.sheen = material.sheen || 0;
        material.threeMaterial.needsUpdate = true;
        this.syncMaterialUsers(material);
        this.render();
        return material;
    }

    applyMaterialToSelected(material) {
        if (!this.app.selectedObject) {
            this.app.ui.showNotification('No object selected!', 'error');
            return;
        }

        const obj = this.app.selectedObject;
        let targetMesh = null;

        if (obj.userData.type === 'shape' || obj.userData.type === 'shape2d') {
            targetMesh = obj;
        } else if (obj.userData.name && obj.userData.name.includes('Joint')) {
            targetMesh = obj.children.find(c => c.isMesh);
        } else if (obj.userData.type === 'figure') {
            // Apply to whole figure
            const mat = material.threeMaterial.clone();
            obj.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.dispose();
                    c.material = mat.clone();
                    c.material.color.setHex(material.color);
                    c.material.metalness = material.metalness;
                    c.material.roughness = material.roughness;
                    c.material.opacity = material.opacity !== undefined ? material.opacity : 1;
                    c.material.transparent = (material.opacity !== undefined ? material.opacity : 1) < 1;
                    c.material.clearcoat = material.clearcoat || 0;
                    c.material.transmission = material.transmission || 0;
                    c.material.sheen = material.sheen || 0;
                    c.material.sheenRoughness = material.sheenRoughness || 0.5;
                    c.material.needsUpdate = true;
                    const matName = typeof material.name === 'string' && material.name.length > 0
                        ? material.name
                        : `Mat_${material.color.toString(16).padStart(6, '0')}`;
                    c.material.name = matName;
                    c.userData.materialName = matName;
                    if (material.maps) {
                        c.material.map = material.maps.albedo || null;
                        c.material.normalMap = material.maps.normal || null;
                        c.material.roughnessMap = material.maps.roughnessMap || null;
                        c.material.metalnessMap = material.maps.metalnessMap || null;
                        c.material.aoMap = material.maps.aoMap || null;
                        c.material.displacementMap = material.maps.displacementMap || null;
                        c.material.displacementScale = material.displacementScale || 0;
                        c.material.needsUpdate = true;
                    }
                }
            });
            if (!material.objectsUsing.includes(obj)) {
                material.objectsUsing.push(obj);
            }
            this.app.ui.showNotification(`Applied material to ${obj.userData.name || obj.userData.type}`, 'success');
            if (this.app.ui && this.app.ui.updateMaterialPropertiesUI) {
                this.app.ui.updateMaterialPropertiesUI(material, targetMesh);
            }
            return;
        }

        if (targetMesh && targetMesh.material) {
            const slots = this.getMaterialSlots(targetMesh);
            const slotIndex = Math.max(0, Math.min(targetMesh.userData.activeMaterialSlot || 0, slots.length - 1));
            const newMat = this.buildMaterial(material);
            if (targetMesh.userData.shapeType === 'text' && slots[slotIndex]?.map) {
                newMat.map = slots[slotIndex].map;
                newMat.transparent = true;
                newMat.side = THREE.DoubleSide;
            }
            slots[slotIndex]?.dispose?.();
            slots[slotIndex] = newMat;
            targetMesh.material = slots.length === 1 ? newMat : slots;

            if (material.outlineEnabled) {
                this.app.addOutlineToObject(targetMesh, material.outlineColor, material.outlineThickness);
            } else {
                const existingOutline = targetMesh.getObjectByName('outline');
                if (existingOutline) {
                    existingOutline.geometry.dispose();
                    existingOutline.material.dispose();
                    targetMesh.remove(existingOutline);
                }
            }

            const matName = typeof material.name === 'string' && material.name.length > 0
                ? material.name
                : `Mat_${material.color.toString(16).padStart(6, '0')}`;
            newMat.name = matName;
            targetMesh.userData.materialName = matName;
            targetMesh.userData.materialSlotIds = slots.map(slot => slot.userData?.materialAssetId || null);

            if (!material.objectsUsing.includes(obj)) {
                material.objectsUsing.push(obj);
            }

            this.app.ui.showNotification(`Applied material to ${obj.userData.name || obj.userData.type}`, 'success');
            if (this.app.ui && this.app.ui.updateMaterialPropertiesUI) {
                this.app.ui.updateMaterialPropertiesUI(material, targetMesh, slotIndex);
            }
        }
    }

    editMaterial(material) {
        const dialog = document.createElement('div');
        dialog.className = 'material-edit-dialog';
        const currentMaps = material.maps || {};
        const layerMaterial = material.layerMaterial;

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>Edit Material: ${material.name}</h3>
                <button class="close-dialog-btn">&times;</button>
            </div>
            <div class="dialog-content">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="edit-material-name" value="${material.name}">
                </div>
                <div class="form-group">
                    <label>Color:</label>
                    <input type="color" id="edit-material-color" value="#${material.color.toString(16).padStart(6, '0')}">
                </div>
                <div class="form-group">
                    <label>Metalness: <span id="edit-metalness-value">${material.metalness.toFixed(2)}</span></label>
                    <input type="range" id="edit-material-metalness" min="0" max="1" step="0.01" value="${material.metalness}">
                </div>
                <div class="form-group">
                    <label>Roughness: <span id="edit-roughness-value">${material.roughness.toFixed(2)}</span></label>
                    <input type="range" id="edit-material-roughness" min="0" max="1" step="0.01" value="${material.roughness}">
                </div>
                <div class="form-group">
                    <label>Opacity: <span id="edit-opacity-value">${(material.opacity !== undefined ? material.opacity : 1).toFixed(2)}</span></label>
                    <input type="range" id="edit-material-opacity" min="0" max="1" step="0.01" value="${material.opacity !== undefined ? material.opacity : 1}">
                </div>
                <div class="form-group">
                    <label>Clearcoat: <span id="edit-clearcoat-value">${(material.clearcoat !== undefined ? material.clearcoat : 0).toFixed(2)}</span></label>
                    <input type="range" id="edit-material-clearcoat" min="0" max="1" step="0.01" value="${material.clearcoat !== undefined ? material.clearcoat : 0}">
                </div>
                <div class="form-group">
                    <label>Transmission: <span id="edit-transmission-value">${(material.transmission !== undefined ? material.transmission : 0).toFixed(2)}</span></label>
                    <input type="range" id="edit-material-transmission" min="0" max="1" step="0.01" value="${material.transmission !== undefined ? material.transmission : 0}">
                </div>
                <div class="form-group">
                    <label>Sheen: <span id="edit-sheen-value">${(material.sheen !== undefined ? material.sheen : 0).toFixed(2)}</span></label>
                    <input type="range" id="edit-material-sheen" min="0" max="1" step="0.01" value="${material.sheen !== undefined ? material.sheen : 0}">
                </div>
                <div class="form-group">
                    <label>Displacement Scale: <span id="edit-displacement-value">${(material.displacementScale !== undefined ? material.displacementScale : 0).toFixed(2)}</span></label>
                    <input type="range" id="edit-material-displacement" min="0" max="1" step="0.01" value="${material.displacementScale !== undefined ? material.displacementScale : 0}">
                </div>

                <div class="texture-maps-section">
                    <label>Texture Maps:</label>
                    <div class="texture-map-row">
                        <label>Albedo:</label>
                        <input type="file" id="edit-material-albedo" accept="image/*">
                        ${currentMaps.albedo ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Normal:</label>
                        <input type="file" id="edit-material-normal" accept="image/*">
                        ${currentMaps.normal ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Roughness:</label>
                        <input type="file" id="edit-material-roughness-map" accept="image/*">
                        ${currentMaps.roughnessMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Metalness:</label>
                        <input type="file" id="edit-material-metalness-map" accept="image/*">
                        ${currentMaps.metalnessMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>AO:</label>
                        <input type="file" id="edit-material-ao-map" accept="image/*">
                        ${currentMaps.aoMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Displacement:</label>
                        <input type="file" id="edit-material-displacement-map" accept="image/*">
                        ${currentMaps.displacementMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Alpha:</label>
                        <input type="file" id="edit-material-alpha-map" accept="image/*">
                        ${currentMaps.alphaMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                    <div class="texture-map-row">
                        <label>Emissive:</label>
                        <input type="file" id="edit-material-emissive-map" accept="image/*">
                        ${currentMaps.emissiveMap ? '<span class="texture-loaded">Loaded</span>' : ''}
                    </div>
                </div>

                <div class="layers-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <label style="display: block; font-size: 0.75rem; color: var(--text-primary); margin-bottom: 8px; font-weight: bold;">Material Layers</label>
                    <div id="edit-layers-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;"></div>
                    <div style="display: flex; gap: 8px;">
                        <select id="edit-new-layer-type" style="flex: 1; background: var(--bg-light); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; color: var(--text-primary);">
                            <option value="color">Color</option>
                            <option value="roughness">Roughness</option>
                            <option value="metalness">Metalness</option>
                            <option value="clearcoat">Clearcoat</option>
                            <option value="transmission">Transmission</option>
                            <option value="sheen">Sheen</option>
                            <option value="glass">Glass</option>
                            <option value="outline">Outline</option>
                        </select>
                        <button class="btn" id="edit-add-layer-btn" style="flex: 1; font-size: 0.75rem; padding: 4px 8px;"><i class="fas fa-plus"></i> Add Layer</button>
                    </div>
                </div>
            </div>
            <div class="dialog-actions">
                <button class="btn" id="cancel-edit-material">Cancel</button>
                <button class="btn primary" id="save-edit-material">Save</button>
            </div>
        `;

        document.body.appendChild(dialog);

        const getLiveValues = () => ({
            name: dialog.querySelector('#edit-material-name').value,
            color: dialog.querySelector('#edit-material-color').value,
            metalness: parseFloat(dialog.querySelector('#edit-material-metalness').value),
            roughness: parseFloat(dialog.querySelector('#edit-material-roughness').value),
            opacity: parseFloat(dialog.querySelector('#edit-material-opacity').value),
            clearcoat: parseFloat(dialog.querySelector('#edit-material-clearcoat').value),
            transmission: parseFloat(dialog.querySelector('#edit-material-transmission').value),
            sheen: parseFloat(dialog.querySelector('#edit-material-sheen').value),
            sheenRoughness: 0.5,
            displacementScale: parseFloat(dialog.querySelector('#edit-material-displacement').value)
        });

        const applyLiveUpdate = () => {
            const values = getLiveValues();
            material.name = values.name;
            material.color = parseInt(values.color.substring(1), 16);
            material.metalness = values.metalness;
            material.roughness = values.roughness;
            material.opacity = values.opacity;
            material.clearcoat = values.clearcoat;
            material.transmission = values.transmission;
            material.sheen = values.sheen;
            material.sheenRoughness = values.sheenRoughness;
            material.displacementScale = values.displacementScale;

            if (material.threeMaterial) {
                material.threeMaterial.color.setHex(material.color);
                material.threeMaterial.metalness = material.metalness;
                material.threeMaterial.roughness = material.roughness;
                material.threeMaterial.opacity = material.opacity;
                material.threeMaterial.transparent = material.opacity < 1;
                material.threeMaterial.clearcoat = material.clearcoat || 0;
                material.threeMaterial.transmission = material.transmission || 0;
                material.threeMaterial.sheen = material.sheen || 0;
                material.threeMaterial.sheenRoughness = material.sheenRoughness || 0.5;
                material.threeMaterial.displacementScale = material.displacementScale || 0;
                material.threeMaterial.needsUpdate = true;
            }
        };

        // Live update listeners
        dialog.querySelector('#edit-material-color').addEventListener('input', applyLiveUpdate);
        dialog.querySelector('#edit-material-metalness').addEventListener('input', (e) => {
            document.getElementById('edit-metalness-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-roughness').addEventListener('input', (e) => {
            document.getElementById('edit-roughness-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-opacity').addEventListener('input', (e) => {
            document.getElementById('edit-opacity-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-clearcoat').addEventListener('input', (e) => {
            document.getElementById('edit-clearcoat-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-transmission').addEventListener('input', (e) => {
            document.getElementById('edit-transmission-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-sheen').addEventListener('input', (e) => {
            document.getElementById('edit-sheen-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });
        dialog.querySelector('#edit-material-displacement').addEventListener('input', (e) => {
            document.getElementById('edit-displacement-value').textContent = parseFloat(e.target.value).toFixed(2);
            applyLiveUpdate();
        });

        // Layer rendering
        const renderLayers = () => {
            const list = dialog.querySelector('#edit-layers-list');
            list.innerHTML = '';
            const layers = layerMaterial ? layerMaterial.getLayers() : [];
            if (layers.length === 0) {
                list.innerHTML = '<div style="font-size:0.7rem; color:var(--text-secondary); padding:4px;">No layers</div>';
                return;
            }
            layers.forEach((layer, index) => {
                const row = document.createElement('div');
                row.className = 'material-texture-layer';
                row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--bg-light); border:1px solid var(--border-color); border-radius:4px;';
                row.innerHTML = `
                    <input type="checkbox" ${layer.visible ? 'checked' : ''} data-layer-index="${index}" class="layer-visibility" style="margin:0;">
                    <span style="flex:1; font-size:0.75rem; color:var(--text-primary); text-transform:capitalize;">${layer.type}</span>
                    <select data-layer-index="${index}" class="layer-blend-mode" style="background:var(--bg-dark); border:1px solid var(--border-color); border-radius:4px; padding:2px 6px; font-size:0.7rem; color:var(--text-primary);">
                        <option value="normal" ${layer.blendMode === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="add" ${layer.blendMode === 'add' ? 'selected' : ''}>Add</option>
                        <option value="multiply" ${layer.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
                    </select>
                    <input type="range" min="0" max="1" step="0.01" value="${layer.opacity}" data-layer-index="${index}" class="layer-opacity" style="width:60px; flex:none;" title="Layer opacity">
                    <button class="layer-close" data-layer-index="${index}" title="Remove layer">&times;</button>
                `;
                list.appendChild(row);
            });

            list.querySelectorAll('.layer-visibility').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.layerIndex);
                    layerMaterial.updateLayer(layerMaterial.getLayers()[idx].id, { visible: e.target.checked });
                    applyLiveUpdate();
                });
            });
            list.querySelectorAll('.layer-blend-mode').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.layerIndex);
                    layerMaterial.updateLayer(layerMaterial.getLayers()[idx].id, { blendMode: e.target.value });
                    applyLiveUpdate();
                });
            });
            list.querySelectorAll('.layer-opacity').forEach(slider => {
                slider.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.layerIndex);
                    layerMaterial.updateLayer(layerMaterial.getLayers()[idx].id, { opacity: parseFloat(e.target.value) });
                    applyLiveUpdate();
                });
            });
            list.querySelectorAll('.layer-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.layerIndex);
                    const layerId = layerMaterial.getLayers()[idx].id;
                    layerMaterial.removeLayer(layerId);
                    renderLayers();
                    applyLiveUpdate();
                });
            });
        };

        dialog.querySelector('#edit-add-layer-btn').addEventListener('click', () => {
            const type = dialog.querySelector('#edit-new-layer-type').value;
            const props = {};
            switch (type) {
                case 'color': props.color = material.color; break;
                case 'roughness': props.roughness = material.roughness; break;
                case 'metalness': props.metalness = material.metalness; break;
                case 'clearcoat': props.clearcoat = material.clearcoat || 0; break;
                case 'transmission': props.transmission = material.transmission || 0; break;
                case 'sheen': props.sheen = material.sheen || 0; break;
                case 'glass': props.transmission = 0.9; props.ior = 1.5; props.thickness = 0.5; break;
                case 'outline': props.outlineEnabled = true; props.outlineColor = 0x000000; props.outlineThickness = 0.02; break;
            }
            layerMaterial.addLayer(type, props);
            renderLayers();
            applyLiveUpdate();
        });

        renderLayers();

        dialog.querySelector('.close-dialog-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('#cancel-edit-material').addEventListener('click', () => dialog.remove());
        dialog.querySelector('#save-edit-material').addEventListener('click', async () => {
            const values = getLiveValues();
            material.name = values.name;
            material.color = parseInt(values.color.substring(1), 16);
            material.metalness = values.metalness;
            material.roughness = values.roughness;
            material.opacity = values.opacity;
            material.clearcoat = values.clearcoat;
            material.transmission = values.transmission;
            material.sheen = values.sheen;
            material.sheenRoughness = values.sheenRoughness;
            material.displacementScale = values.displacementScale;

            if (material.threeMaterial) {
                material.threeMaterial.color.setHex(material.color);
                material.threeMaterial.metalness = material.metalness;
                material.threeMaterial.roughness = material.roughness;
                material.threeMaterial.opacity = material.opacity;
                material.threeMaterial.transparent = material.opacity < 1;
                material.threeMaterial.clearcoat = material.clearcoat || 0;
                material.threeMaterial.transmission = material.transmission || 0;
                material.threeMaterial.sheen = material.sheen || 0;
                material.threeMaterial.sheenRoughness = material.sheenRoughness || 0.5;
                material.threeMaterial.displacementScale = material.displacementScale || 0;
                if (material.maps) {
                    material.threeMaterial.map = material.maps.albedo || null;
                    material.threeMaterial.normalMap = material.maps.normal || null;
                    material.threeMaterial.roughnessMap = material.maps.roughnessMap || null;
                    material.threeMaterial.metalnessMap = material.maps.metalnessMap || null;
                    material.threeMaterial.aoMap = material.maps.aoMap || null;
                    material.threeMaterial.displacementMap = material.maps.displacementMap || null;
                }
                material.threeMaterial.needsUpdate = true;
            }

            // Load new texture maps if provided
            const albedoFile = dialog.querySelector('#edit-material-albedo')?.files[0];
            const normalFile = dialog.querySelector('#edit-material-normal')?.files[0];
            const roughnessFile = dialog.querySelector('#edit-material-roughness-map')?.files[0];
            const metalnessFile = dialog.querySelector('#edit-material-metalness-map')?.files[0];
            const aoFile = dialog.querySelector('#edit-material-ao-map')?.files[0];
            const displacementFile = dialog.querySelector('#edit-material-displacement-map')?.files[0];
            const alphaFile = dialog.querySelector('#edit-material-alpha-map')?.files[0];
            const emissiveFile = dialog.querySelector('#edit-material-emissive-map')?.files[0];

            try {
                if (albedoFile) {
                    material.maps.albedo = await this.loadTexture(albedoFile, material, 'albedo');
                }
                if (normalFile) {
                    material.maps.normal = await this.loadTexture(normalFile, material, 'normal');
                }
                if (roughnessFile) {
                    material.maps.roughnessMap = await this.loadTexture(roughnessFile, material, 'roughnessMap');
                }
                if (metalnessFile) {
                    material.maps.metalnessMap = await this.loadTexture(metalnessFile, material, 'metalnessMap');
                }
                if (aoFile) {
                    material.maps.aoMap = await this.loadTexture(aoFile, material, 'aoMap');
                }
                if (displacementFile) material.maps.displacementMap = await this.loadTexture(displacementFile, material, 'displacementMap');
                if (alphaFile) material.maps.alphaMap = await this.loadTexture(alphaFile, material, 'alphaMap');
                if (emissiveFile) material.maps.emissiveMap = await this.loadTexture(emissiveFile, material, 'emissiveMap');
            } catch (err) {
                console.error('Failed to load texture:', err);
            }

            this.syncMaterialUsers(material);

            dialog.remove();
            this.render();
            this.app.ui.showNotification('Material updated successfully!', 'success');
        });
    }

    deleteMaterial(material) {
        if (material.objectsUsing.length > 0) {
            const confirmDelete = confirm(`This material is used by ${material.objectsUsing.length} objects. Delete anyway?`);
            if (!confirmDelete) return;
        }

        const index = this.materials.indexOf(material);
        if (index > -1) {
            this.materials.splice(index, 1);
            if (this.selectedMaterial === material) {
                this.selectedMaterial = null;
            }
            this.render();
        }
    }

    // Render materials for the materials section (full view)
    renderMaterialsSection() {
        if (!this.materialsSectionContainer) return;

        const materialsContent = this.materialsSectionContainer.querySelector('.panel-content');
        if (!materialsContent) return;

        materialsContent.innerHTML = '';

        // Add create material button
        const createBtn = document.createElement('button');
        createBtn.className = 'btn primary';
        createBtn.style.marginBottom = '12px';
        createBtn.style.width = '100%';
        createBtn.innerHTML = '<i class="fas fa-plus"></i> Create Material';
        createBtn.addEventListener('click', () => this.createNewMaterial());
        materialsContent.appendChild(createBtn);

        // Render each material with more details
        this.materials.forEach(material => {
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item-full';
            materialEl.dataset.materialId = material.id;
            if (this.selectedMaterial === material) {
                materialEl.classList.add('selected');
            }

            materialEl.innerHTML = `
                <div class="material-preview-full" style="background-color: #${material.color.toString(16).padStart(6, '0')}" title="Used by: ${material.objectsUsing.length} objects"></div>
                <div class="material-info-full">
                    <input type="text" class="material-name-full" value="${material.name}">
                    <div class="material-properties-full">
                        <span>M: ${material.metalness.toFixed(2)}</span>
                        <span>R: ${material.roughness.toFixed(2)}</span>
                        <span>O: ${(material.opacity !== undefined ? material.opacity : 1).toFixed(2)}</span>
                    </div>
                </div>
                <div class="material-actions-full">
                    <button class="btn apply-material-btn" title="Apply to Selected"><i class="fas fa-check"></i></button>
                    <button class="btn edit-material-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn delete-material-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Add event listeners
            materialEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('material-name-full') ||
                    e.target.classList.contains('apply-material-btn') ||
                    e.target.classList.contains('edit-material-btn') ||
                    e.target.classList.contains('delete-material-btn')) {
                    return; // Let specific handlers handle these
                }
                this.selectMaterial(material);
            });

            // Material name editing
            const nameInput = materialEl.querySelector('.material-name-full');
            nameInput.addEventListener('change', (e) => {
                material.name = e.target.value;
            });
            nameInput.addEventListener('click', (e) => e.stopPropagation());

            // Apply material button
            materialEl.querySelector('.apply-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyMaterialToSelected(material);
            });

            // Edit material button
            materialEl.querySelector('.edit-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editMaterial(material);
            });

            // Delete material button
            materialEl.querySelector('.delete-material-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMaterial(material);
            });

            materialsContent.appendChild(materialEl);
        });
    }
}
