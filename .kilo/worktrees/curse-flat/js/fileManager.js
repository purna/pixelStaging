import * as THREE from 'three';

export class FileManager {
    constructor(app) {
        this.app = app;
        this.autosaveEnabled = false;
        this.autosaveInterval = 5; // minutes
        this.autosaveTimer = null;
        this.exportFormat = localStorage.getItem('pixel3d-export-format') || 'json'; // Load saved format or default
    }

    _textureSource(texture) {
        const image = texture?.image;
        if (!image) return null;
        if (image.currentSrc || image.src) return image.currentSrc || image.src;
        try {
            return typeof image.toDataURL === 'function' ? image.toDataURL('image/png') : null;
        } catch {
            return null;
        }
    }

    _serializeMaterialSlots(obj) {
        const slots = Array.isArray(obj.material) ? obj.material : [obj.material];
        return slots.filter(Boolean).map(material => ({
            name: material.name || 'Material',
            color: `#${material.color?.getHexString?.() || 'ffffff'}`,
            emissive: `#${material.emissive?.getHexString?.() || '000000'}`,
            metalness: material.metalness ?? 0,
            roughness: material.roughness ?? 1,
            opacity: material.opacity ?? 1,
            transparent: !!material.transparent,
            clearcoat: material.clearcoat ?? 0,
            transmission: material.transmission ?? 0,
            sheen: material.sheen ?? 0,
            sheenRoughness: material.sheenRoughness ?? 0.5,
            displacementScale: material.displacementScale ?? 0,
            side: material.side,
            assetId: material.userData?.materialAssetId || null,
            maps: {
                map: this._textureSource(material.map),
                normalMap: this._textureSource(material.normalMap),
                roughnessMap: this._textureSource(material.roughnessMap),
                metalnessMap: this._textureSource(material.metalnessMap),
                aoMap: this._textureSource(material.aoMap),
                displacementMap: this._textureSource(material.displacementMap),
                alphaMap: this._textureSource(material.alphaMap),
                emissiveMap: this._textureSource(material.emissiveMap)
            }
        }));
    }

    _restoreMaterialSlots(obj, slotData) {
        if (!obj?.isMesh || !Array.isArray(slotData) || !slotData.length) return;
        const loader = new THREE.TextureLoader();
        const slots = slotData.map(data => {
            const material = new THREE.MeshPhysicalMaterial({
                name: data.name || 'Material',
                color: data.color || '#ffffff',
                emissive: data.emissive || '#000000',
                metalness: data.metalness ?? 0,
                roughness: data.roughness ?? 1,
                opacity: data.opacity ?? 1,
                transparent: data.transparent || (data.opacity ?? 1) < 1,
                clearcoat: data.clearcoat ?? 0,
                transmission: data.transmission ?? 0,
                sheen: data.sheen ?? 0,
                sheenRoughness: data.sheenRoughness ?? 0.5,
                displacementScale: data.displacementScale ?? 0,
                side: data.side ?? THREE.FrontSide
            });
            material.userData.materialAssetId = data.assetId || null;
            for (const [key, source] of Object.entries(data.maps || {})) {
                if (!source) continue;
                const texture = loader.load(source, () => { material.needsUpdate = true; });
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                material[key] = texture;
            }
            if (material.alphaMap) material.transparent = true;
            return material;
        });
        const oldSlots = Array.isArray(obj.material) ? obj.material : [obj.material];
        oldSlots.forEach(material => material?.dispose?.());
        obj.material = slots.length === 1 ? slots[0] : slots;
        this.app.materialsManager?.rebuildGeometryGroups(obj, slots.length);
        obj.userData.activeMaterialSlot = Math.min(obj.userData.activeMaterialSlot || 0, slots.length - 1);
    }

    setExportFormat(format) {
        this.exportFormat = format;
    }

    getExportFormat() {
        return this.exportFormat;
    }

    async saveScene() {
        const format = this.exportFormat || 'json';

        if (format === 'json') {
            this.saveSceneJSON();
        } else if (format === 'js') {
            this.saveSceneJS();
        } else if (format === 'glb') {
            await this.saveSceneGLB();
        } else if (format === 'gltf') {
            if (this.app.exportManager) {
                await this.app.exportManager.exportGLTF();
            } else {
                await this.saveSceneGLB();
            }
        } else if (format === 'draco') {
            if (this.app.exportManager) {
                await this.app.exportManager.exportDraco();
            } else {
                this.saveSceneJSON();
            }
        } else if (format === 'aframe') {
            if (this.app.exportManager) {
                this.app.exportManager.exportAFrame();
            } else {
                this.saveSceneJSON();
            }
        } else if (format === 'fbx') {
            await this.saveSceneFBX();
        } else {
            this.saveSceneJSON(); // Fallback to JSON
        }
    }

    saveSceneJSON() {
        // Helper to serialize an object
        const processObj = (obj) => {
            // Only process objects with our specific types
            if (obj.userData.type) {
                const item = {
                    type: obj.userData.type,
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                    userData: obj.userData
                };

                if (obj.userData.type === 'shape' || obj.userData.type === 'shape2d') {
                    item.shapeType = obj.userData.shapeType;
                    const firstMaterial = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                    item.color = '#' + firstMaterial.color.getHexString();
                    item.materialSlots = this._serializeMaterialSlots(obj);
                } else if (obj.userData.type === 'light') {
                    const l = obj.children[0];
                    item.lightType = obj.userData.lightType;
                    item.color = '#' + l.color.getHexString();
                    item.intensity = l.intensity;
                } else if (obj.userData.type === 'figure') {
                    item.gender = obj.userData.gender;
                    // Save posing data (rotation of limbs)
                    item.joints = {};
                    obj.traverse(child => {
                        if (child.userData.name && child.userData.name.includes('Joint')) {
                            item.joints[child.userData.name] = {
                                x: child.rotation.x,
                                y: child.rotation.y,
                                z: child.rotation.z
                            };
                        }
                    });
                }
                data.push(item);
            }
        };

        // Traverse only direct children of scene to find our managed roots
        const data = [];
        this.app.scene.children.forEach(child => {
            processObj(child);
        });

        // Include animation data
        const sceneData = {
            version: 1,
            objects: data,
            animations: this.app.animationManager.toJSON()
        };

        const blob = new Blob([JSON.stringify(sceneData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        a.click();

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async saveSceneGLB() {
        try {
            const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

            if (this.app.scene.children.length === 0) {
                this.app.ui?.showNotification('No objects to export!', 'info');
                return;
            }

            const exportScene = new THREE.Scene();
            const objectToClip = new Map();

            this.app.scene.traverse((obj) => {
                if (obj.isHelper || obj.type === 'GridHelper' || obj.type === 'AxesHelper') return;
                if (obj.type === 'TransformControlsGizmo' || obj.type === 'TransformControlsPlane') return;
                if (obj.type === 'TransformControls') return;
                if (obj.type === 'AmbientLight' && !obj.userData?.type) return;
                if (obj.type === 'DirectionalLight' && !obj.userData?.type) return;
                if (!obj.userData?.type) return;

                try {
                    const cloned = obj.clone(true);
                    exportScene.add(cloned);

                    const objectId = obj.userData?.id || obj.uuid;
                    const clip = this.app.animationManager.getClip(objectId);
                    if (clip) objectToClip.set(cloned, clip);
                } catch (e) {
                    console.warn('Could not clone for export:', obj.name, e);
                }
            });

            if (exportScene.children.length === 0) {
                this.app.ui?.showNotification('No exportable objects in scene!', 'info');
                return;
            }

            const exporter = new GLTFExporter();
            const animations = [];

            for (const [obj, clip] of objectToClip.entries()) {
                for (const prop of ['position', 'rotation', 'scale', 'color']) {
                    const kfs = clip.getKeyframes(prop);
                    if (kfs.length < 2) continue;

                    if (prop === 'color') {
                        const times = kfs.map(k => k.time);
                        const values = [];
                        for (const kf of kfs) {
                            values.push(kf.value.r, kf.value.g, kf.value.b);
                        }
                        const track = new THREE.ColorKeyframeTrack(`${obj.name}.material.color`, times, values);
                        animations.push(new THREE.AnimationClip(`${obj.name}_color`, clip.duration, [track]));
                    } else {
                        const times = kfs.map(k => k.time);
                        const values = [];
                        for (const kf of kfs) {
                            values.push(kf.value.x, kf.value.y, kf.value.z);
                        }

                        const TrackClass = prop === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
                        if (prop === 'rotation') {
                            const eulers = kfs.map(k => new THREE.Euler(k.value.x, k.value.y, k.value.z));
                            const quaternions = eulers.map(e => new THREE.Quaternion().setFromEuler(e));
                            const qValues = [];
                            for (const q of quaternions) {
                                qValues.push(q.x, q.y, q.z, q.w);
                            }
                            const track = new THREE.QuaternionKeyframeTrack(`${obj.name}.quaternion`, times, qValues);
                            animations.push(new THREE.AnimationClip(`${obj.name}_${prop}`, clip.duration, [track]));
                        } else {
                            const track = new TrackClass(`${obj.name}.${prop}`, times, values);
                            animations.push(new THREE.AnimationClip(`${obj.name}_${prop}`, clip.duration, [track]));
                        }
                    }
                }
            }

            const result = await new Promise((resolve, reject) => {
                exporter.parse(
                    exportScene,
                    resolve,
                    reject,
                    { binary: true, embedImages: true, animations }
                );
            });

            if (result instanceof ArrayBuffer) {
                const blob = new Blob([new Uint8Array(result)], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.glb';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.app.ui?.showNotification('Scene exported as GLB!', 'success');
            } else if (result && typeof result === 'object' && result.scenes) {
                const json = JSON.stringify(result, null, 2);
                const blob = new Blob([json], { type: 'model/gltf+json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.gltf';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.app.ui?.showNotification('Scene exported as GLTF!', 'info');
            } else {
                console.error('Export returned unexpected result:', result);
                this.app.ui?.showNotification('Export failed', 'error');
            }
        } catch (error) {
            console.error('Error exporting GLB:', error);
            this.app.ui?.showNotification('Failed to export GLB: ' + error.message, 'error');
        }
    }

    async saveSceneFBX() {
        try {
            // Import FBXExporter dynamically (using three-fbx-exporter or similar)
            // Note: FBX export requires additional libraries. This is a placeholder.
            // We'll use a simple approach with the official FBX exporter if available

            // Since FBXExporter is not part of standard Three.js, we'll show a message
            // In a real implementation, you would integrate a library like three-fbx-exporter
            this.app.ui?.showNotification('FBX export coming soon. Use JSON or GLB for now.', 'info');

            // Fallback to GLB with a note - must await async function
            await this.saveSceneGLB();
        } catch (error) {
            console.error('Error exporting FBX:', error);
            this.app.ui?.showNotification('FBX export not available. Falling back to GLB.', 'error');
            await this.saveSceneGLB();
        }
    }

    saveSceneJS() {
        const includeLights = window.exportSettings?.includeLights ?? true;

        const meshes = [];
        const lights = [];
        this.app.scene.traverse((obj) => {
            if (obj.userData?.type === 'light') {
                lights.push(obj);
            } else if (obj.isMesh && obj.userData?.type === 'shape') {
                meshes.push(obj);
            }
        });

        if (meshes.length === 0) {
            this.app.ui?.showNotification('No shapes to export!', 'info');
            return;
        }

        // ── Collect meshes into named groups ──────────────────────────────────
        const groups = [];

        // a) Direct scene children
        const directChildren = meshes.filter(m => m.parent === this.app.scene);
        if (directChildren.length > 0) {
            groups.push({ group: null, children: directChildren });
        }

        // b) Per-parent groups (only if 2+ meshes share a parent)
        const parentMap = new Map();
        const collected = new Set(meshes);
        meshes.forEach(m => {
            if (m.parent !== this.app.scene) {
                if (!parentMap.has(m.parent)) parentMap.set(m.parent, []);
                parentMap.get(m.parent).push(m);
            }
        });
        parentMap.forEach((children, parent) => {
            if (children.length >= 2) {
                parent.traverse(child => {
                    if (child.isMesh && !collected.has(child)) {
                        collected.add(child);
                    }
                });
                if (children.length >= 2) {
                    groups.push({ group: parent, children });
                }
            }
        });

        // c) Fallback for stragglers
        const leftover = meshes.filter(m => !collected.has(m));
        if (leftover.length > 0) {
            groups.push({ group: null, children: leftover });
        }

        // ── Build per-group init functions ───────────────────────────────────
        const sceneFuncs = [];

        groups.forEach(({ children }, gIdx) => {
            const indent = '    ';
            const funcName = `initScene${gIdx + 1}`;
            const lines = [];

            lines.push(`window.${funcName} = function(group) {`);

            // Collect unique materials
            const seenMats = new Map();
            const matDecls = [];
            const usedNames = new Set();

            const pushMat = (hexInt, nameHint, opacity = 1) => {
                const u = hexInt.toString(16).toUpperCase();
                const key = u.padStart(6, '0');
                if (seenMats.has(key)) return seenMats.get(key);
                let id = nameHint && nameHint.length > 0
                    ? nameHint
                    : (semanticColorName(hexInt) || `mat_${key}`);
                if (usedNames.has(id)) {
                    let counter = 2;
                    while (usedNames.has(`${id}${counter}`)) counter++;
                    id = `${id}${counter}`;
                }
                const jsColor = '0x' + key;
                usedNames.add(id);
                seenMats.set(key, id);
                matDecls.push(`${indent}const ${id} = new THREE.MeshPhongMaterial({ color: ${jsColor}, transparent: true, opacity: ${opacity} });`);
                return id;
            };

            // First pass: collect all materials by calling pushMat for each child
            children.forEach(child => {
                const hexColor = getColor(child);
                const matNameHint = (child.material && child.material.name && child.material.name.length > 0)
                    ? child.material.name
                    : (child.userData.materialName || semanticColorName(hexColor) || '');
                const childOpacity = child.material ? child.material.opacity : 1;
                if (hexColor) pushMat(hexColor, matNameHint, childOpacity);
            });

            // Group name
            let groupName = '';
            if (children.length === 1) {
                const st = (children[0].userData.shapeType || '');
                groupName = st.charAt(0).toUpperCase() + st.slice(1);
            } else if (children.length >= 2) {
                const names = [children[0].userData.shapeType || '', children[1].userData?.shapeType || ''];
                groupName = Array.from(new Set(names.filter(Boolean))).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
            }
            if (!groupName) groupName = 'Mesh';

            lines.push(`    // ${groupName}`);

            // Output material declarations
            matDecls.forEach(d => lines.push(d));
            if (matDecls.length > 0) lines.push('');

            // Build each child mesh
            children.forEach((child, i) => {
                const hexColor = getColor(child);

                const geoType = child.geometry.type.replace('Geometry', '');
                let varName = `${geoType.toLowerCase()}_`;
                if (i === 0) varName += groupName.toLowerCase();
                else varName += `${groupName.toLowerCase()}${i}`;

                const pos = child.position, rot = child.rotation, scl = child.scale;
                const px = pos.x.toFixed(2).replace(/\.?0+$/, '') || '0';
                const py = pos.y.toFixed(2).replace(/\.?0+$/, '') || '0';
                const pz = pos.z.toFixed(2).replace(/\.?0+$/, '') || '0';

                const rx = ((rot.x * 180) / Math.PI).toFixed(2).replace(/\.?0+$/, '') || '0';
                const ry = ((rot.y * 180) / Math.PI).toFixed(2).replace(/\.?0+$/, '') || '0';
                const rz = ((rot.z * 180) / Math.PI).toFixed(2).replace(/\.?0+$/, '') || '0';

                const sx = scl.x.toFixed(2).replace(/\.?0+$/, '') || '1';
                const sy = scl.y.toFixed(2).replace(/\.?0+$/, '') || '1';
                const sz = scl.z.toFixed(2).replace(/\.?0+$/, '') || '1';

                const rotParts = [];
                if (parseFloat(rx) !== 0) rotParts.push(`rotation.x = ${rx} * Math.PI / 180;`);
                if (parseFloat(ry) !== 0) rotParts.push(`rotation.y = ${ry} * Math.PI / 180;`);
                if (parseFloat(rz) !== 0) rotParts.push(`rotation.z = ${rz} * Math.PI / 180;`);

                const matNameHint = (child.material && child.material.name && child.material.name.length > 0)
                    ? child.material.name
                    : (child.userData.materialName || semanticColorName(hexColor) || '');

                const childOpacity = child.material ? child.material.opacity : 1;
                const matId = hexColor ? pushMat(hexColor, matNameHint, childOpacity) : 'new THREE.MeshPhongMaterial({ color: 0x808080 })';

                const geoArgs = geometryArgs(child);
                const geoNew = `new THREE.${child.geometry.type}(${geoArgs})`;

                lines.push(`    const ${varName} = new THREE.Mesh(${geoNew}, ${matId});`);
                lines.push(`    ${varName}.position.set(${px}, ${py}, ${pz});`);
                rotParts.forEach(r => lines.push(`    ${r}`));
                lines.push(`    ${varName}.scale.set(${sx}, ${sy}, ${sz});`);
                lines.push(`    group.add(${varName});`);
                if (i < children.length - 1) lines.push('');
            });

            lines.push('};');
            lines.push('');
            sceneFuncs.push(lines.join('\n'));
        });

        // ── Emit scene-root lights ─────────────────────────────
        if (includeLights) {
            const sceneRootLights = this.app.scene.children.filter(c => c.userData?.type === 'light');
            if (sceneRootLights.length > 0) {
                const rootLightLines = [];
                rootLightLines.push('window.initSceneLights = function(group) {');
                sceneRootLights.forEach((lg) => {
                    const lt = lg.userData.lightType || 'point';
                    const jsType = lt.charAt(0).toUpperCase() + lt.slice(1) + 'Light';
                    const c = lg.children[0];
                    if (!c) return;
                    const colHex = c.color ? c.color.getHex() : 0xffffff;
                    const colStr = '0x' + colHex.toString(16).toUpperCase().padStart(6, '0');
                    const p = lg.position;
                    const px = p.x.toFixed(2).replace(/\.?0+$/, '') || '0';
                    const py = p.y.toFixed(2).replace(/\.?0+$/, '') || '0';
                    const pz = p.z.toFixed(2).replace(/\.?0+$/, '') || '0';
                    const inten = c.intensity ?? 1;
                    const lName = `l${lt.charAt(0).toUpperCase() + lt.slice(1)}`;
                    rootLightLines.push(`    const ${lName} = new THREE.${jsType}(${colStr}, ${inten});`);
                    rootLightLines.push(`    ${lName}.position.set(${px}, ${py}, ${pz});`);
                    rootLightLines.push(`    group.add(${lName});`);
                });
                rootLightLines.push('};');
                rootLightLines.push('');
                sceneFuncs.push(rootLightLines.join('\n'));
            }
        }

        const HEADER = `// ------------------------------------------------------------
// Pixel 3D — exported scene functions
//
// Inside your own Three.js app create a Group and pass it to
// any of the functions below.  They add new meshes (and their
// materials) to the group; the scene graph itself is yours to
// render as you wish.
//
//   window.initScene1(group);      // add the first scene to group
//   window.initScene2(group);      // add the second scene to group
//   window.initSceneLights(group); // add the scene lights to group
//   window.initAllScenes(group);   // add ALL scenes (calls initScene1, initScene2, etc. for you)
// ------------------------------------------------------------\n\n`;

        let allScenesSrc = HEADER;
        sceneFuncs.forEach(src => { allScenesSrc += src + '\n'; });

        let yPriorCombined = 'window.initAllScenes = function(group) {\n';
        sceneFuncs.forEach(src => {
            const funcNameMatch = src.match(/window\.(initScene\d+)\s*=/);
            if (funcNameMatch) {
                yPriorCombined += `    ${funcNameMatch[1]}(group);\n`;
            }
        });
        yPriorCombined += '};';

        allScenesSrc += yPriorCombined + '\n';

        const animData = this.app.animationManager.toJSON();
        if (animData.clips && Object.keys(animData.clips).length > 0) {
            allScenesSrc += '\n// ── Animation Data ─────────────────────────────────────────────\n';
            allScenesSrc += 'window.sceneAnimations = ' + JSON.stringify(animData, null, 2) + ';\n';
        }

        const blob = new Blob([allScenesSrc], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.js';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.app.ui?.showNotification('Scene exported as JS!', 'success');
    }

    saveToBrowser() {
        const data = [];

        // Helper to serialize an object
        const processObj = (obj) => {
            // Only process objects with our specific types
            if (obj.userData.type) {
                const item = {
                    type: obj.userData.type,
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                    userData: obj.userData
                };

                if (obj.userData.type === 'shape' || obj.userData.type === 'shape2d') {
                    item.shapeType = obj.userData.shapeType;
                    const firstMaterial = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                    item.color = '#' + firstMaterial.color.getHexString();
                    item.materialSlots = this._serializeMaterialSlots(obj);
                } else if (obj.userData.type === 'light') {
                    const l = obj.children[0];
                    item.lightType = obj.userData.lightType;
                    item.color = '#' + l.color.getHexString();
                    item.intensity = l.intensity;
                } else if (obj.userData.type === 'figure') {
                    item.gender = obj.userData.gender;
                    // Save posing data (rotation of limbs)
                    item.joints = {};
                    obj.traverse(child => {
                        if (child.userData.name && child.userData.name.includes('Joint')) {
                            item.joints[child.userData.name] = {
                                x: child.rotation.x,
                                y: child.rotation.y,
                                z: child.rotation.z
                            };
                        }
                    });
                }
                data.push(item);
            }
        };

        // Traverse only direct children of scene to find our managed roots
        this.app.scene.children.forEach(child => {
            processObj(child);
        });

        // Save to localStorage
        localStorage.setItem('pixel3d-scene', JSON.stringify({
            version: 1,
            objects: data,
            animations: this.app.animationManager.toJSON()
        }));
        this.saveFolderStructure();
    }

    // Save folder structure
    saveFolderStructure() {
        if (!this.app.layerManager) return;

        const folderData = this.app.layerManager.folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            expanded: folder.expanded,
            objects: folder.objects.map(obj => obj.id || Math.random().toString(36).substr(2, 9))
        }));

        localStorage.setItem('pixel3d-folders', JSON.stringify(folderData));
    }

    // Load folder structure
    loadFolderStructure() {
        if (!this.app.layerManager) return;

        const saved = localStorage.getItem('pixel3d-folders');
        if (saved) {
            try {
                const folderData = JSON.parse(saved);
                this.app.layerManager.folders = folderData.map(folder => ({
                    id: folder.id,
                    name: folder.name,
                    expanded: folder.expanded || true,
                    objects: []
                }));
                this.app.layerManager.render();
            } catch (err) {
                console.error("Failed to load folder structure:", err);
            }
        }
    }

    // Autosave methods
    setAutosaveEnabled(enabled) {
        this.autosaveEnabled = enabled;
        if (enabled) {
            this.startAutosave();
        } else {
            this.stopAutosave();
        }
    }

    setAutosaveInterval(minutes) {
        this.autosaveInterval = minutes;
        if (this.autosaveEnabled) {
            this.startAutosave(); // Restart with new interval
        }
    }

    startAutosave() {
        this.stopAutosave(); // Clear any existing timer
        this.autosaveTimer = setInterval(() => {
            this.saveToBrowser();
            if (this.app.ui && this.app.ui.showNotification) {
                this.app.ui.showNotification('Scene autosaved!', 'success');
            }
        }, this.autosaveInterval * 60 * 1000); // Convert minutes to milliseconds
    }

    stopAutosave() {
        if (this.autosaveTimer) {
            clearInterval(this.autosaveTimer);
            this.autosaveTimer = null;
        }
    }

    loadScene(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadData(data); // Refactored to separate method so AI can call it
            } catch (err) {
                console.error("Failed to load scene:", err);
                // Note: FileManager doesn't have access to UI, so alerts are still used here
                alert("Error loading scene file");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    }

    // New helper that accepts raw data (used by File Input AND Gemini AI)
    loadData(data) {
        // Loading replaces the document and should not create undo entries for
        // either the previous scene or each reconstructed object.
        this.app._clearSceneNow();

        // Handle both old format (array of objects) and new format (object with objects and animations)
        let objectsData = [];
        let animationData = null;

        if (Array.isArray(data)) {
            // Old format: direct array of scene objects
            objectsData = data;
        } else if (data && typeof data === 'object') {
            // New format: { objects: [...], animations: {...} }
            objectsData = data.objects || [];
            animationData = data.animations;
        } else {
            // Fallback: treat as empty
            objectsData = [];
        }

        let loadedCount = 0;
        objectsData.forEach(item => {
            let newObj = null;

            if (item.type === 'shape') {
                this.app.addShape(item.shapeType);
                newObj = this.app.selectedObject;
                if (newObj && item.color) newObj.material.color.set(item.color);
            }
            else if (item.type === 'shape2d') {
                this.app.addShape2D(item.shapeType);
                newObj = this.app.selectedObject;
                if (newObj && item.color) newObj.material.color.set(item.color);
                if (newObj && item.shapeType === 'text') {
                    const text = item.userData?.text || 'Text';
                    const font = item.userData?.fontFamily || 'Inter, sans-serif';
                    this.app.factory.updateTextLabel(newObj, text, font);
                }
            }
            else if (item.type === 'light') {
                this.app.addLight(item.lightType);
                newObj = this.app.selectedObject;
                if (newObj) {
                    newObj.children[0].color.set(item.color);
                    newObj.children[0].intensity = item.intensity;
                }
            }
            else if (item.type === 'figure') {
                this.app.addFigure(item.gender);
                newObj = this.app.selectedObject;

                // Restore posing
                if (item.joints) {
                    newObj.traverse(child => {
                        if (child.userData.name && item.joints[child.userData.name]) {
                            const rot = item.joints[child.userData.name];
                            child.rotation.set(rot.x, rot.y, rot.z);
                        }
                    });
                }
            }

            if (newObj) {
                if (item.userData) newObj.userData = { ...newObj.userData, ...item.userData };
                if (item.position) newObj.position.set(item.position.x, item.position.y, item.position.z);
                if (item.rotation) newObj.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
                if (item.scale) newObj.scale.set(item.scale.x, item.scale.y, item.scale.z);
                if (item.materialSlots) this._restoreMaterialSlots(newObj, item.materialSlots);
                if (newObj.userData.physicsEnabled && newObj.geometry) {
                    this.app.physicsManager?.addMesh(newObj, {
                        mass: newObj.userData.physicsMass ?? 1,
                        bodyType: newObj.userData.physicsBodyType ?? 2,
                        friction: newObj.userData.physicsFriction ?? 0.3,
                        restitution: newObj.userData.physicsRestitution ?? 0.2,
                        linearDamping: newObj.userData.physicsLinearDamping ?? 0.01,
                        angularDamping: newObj.userData.physicsAngularDamping ?? 0.01
                    });
                }
                loadedCount++;
            }
        });

        // Load animation data if present
        if (animationData) {
            this.app.animationManager.fromJSON(animationData);
        }
        this.app.animationUI?.refresh();

        this.app.deselect(); // Clear selection after loading

        // Show notification via UI (if available)
        if (this.app.ui && this.app.ui.showNotification) {
            this.app.ui.showNotification(`Scene loaded! (${loadedCount} objects)`, 'success');
        }

        // Load folder structure and restore object organization
        this.loadFolderStructure();
        this.restoreObjectsToFolders();
        this.app.historyManager?.clearHistory();
    }

    // Restore objects to their folders after loading
    restoreObjectsToFolders() {
        if (!this.app.layerManager) return;

        const saved = localStorage.getItem('pixel3d-folders');
        if (!saved) return;

        try {
            const folderData = JSON.parse(saved);

            // Create a map of object IDs to actual objects
            const objectMap = {};
            this.app.getAllObjects().forEach(obj => {
                const objId = obj.id || Math.random().toString(36).substr(2, 9);
                objectMap[objId] = obj;
            });

            // Restore objects to their folders
            folderData.forEach(folder => {
                const existingFolder = this.app.layerManager.folders.find(f => f.id === folder.id);
                if (existingFolder) {
                    folder.objects.forEach(objId => {
                        const obj = objectMap[objId];
                        if (obj) {
                            // Remove from main objects array if it exists there
                            const idx = this.app.objects.indexOf(obj);
                            if (idx > -1) {
                                this.app.objects.splice(idx, 1);
                            }
                            // Add to folder
                            existingFolder.objects.push(obj);
                        }
                    });
                }
            });

            // Refresh the UI
            if (this.app.layerManager) {
                this.app.layerManager.render();
            }
        } catch (err) {
            console.error("Failed to restore objects to folders:", err);
        }
    }
}

// ── Geometry helpers for JS export ──────────────────────────────────────────

// Map a hex colour to a short, readable material name.
function semanticColorName(hexInt) {
    const h = hexInt >>> 0;
    const r = (h >> 16) & 0xFF;
    const g = (h >> 8) & 0xFF;
    const b = h & 0xFF;

    // Grey / near-white / near-black (achromatic)
    if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) {
        if (r > 220) return 'Mat_white';
        if (r < 55) return 'Mat_dark';
        return 'Mat_grey';
    }

    // Colour-target windows
    const match = [
        { hi: 0x8C6F4A, lo: 0x7E5C38, n: 'Mat_wood' },
        { hi: 0x8B5E2F, lo: 0x7A4F25, n: 'Mat_wood' },
        { hi: 0x5C3A1A, lo: 0x4E2E10, n: 'Mat_dark' },
        { hi: 0xA0522D, lo: 0x8B4513, n: 'Mat_brown' },
        { hi: 0x008080, lo: 0x007070, n: 'Mat_teal' },
        { hi: 0x20B2AA, lo: 0x17A098, n: 'Mat_teal' },
        { hi: 0xFF1493, lo: 0xD5008A, n: 'Mat_magenta' },
        { hi: 0x4682B4, lo: 0x306090, n: 'Mat_steel' },
        { hi: 0x00FF41, lo: 0x00D938, n: 'Mat_neon' },
        { hi: 0xFFD700, lo: 0xD4AA00, n: 'Mat_gold' },
        { hi: 0xFF4444, lo: 0xCC2020, n: 'Mat_red' },
        { hi: 0x9932CC, lo: 0x8B2BBA, n: 'Mat_purple' },
    ];

    for (const m of match) {
        if (r >= ((m.lo >> 16) & 0xFF) && r <= ((m.hi >> 16) & 0xFF) &&
            g >= ((m.lo >> 8) & 0xFF) && g <= ((m.hi >> 8) & 0xFF) &&
            b >= (m.lo & 0xFF) && b <= (m.hi & 0xFF)) {
            return m.n;
        }
    }
    return '';
}

function getColor(mesh) {
    const c = mesh.material?.color;
    if (c instanceof THREE.Color) return c.getHex();
    if (typeof c === 'number') return c >>> 0;
    if (typeof c === 'string') return parseInt(c, 16);
    return 0x808080;
}

function geometryArgs(geo) {
    const t = geo.type;
    if (t === 'BoxGeometry') {
        const w = geo.parameters.width, h = geo.parameters.height, d = geo.parameters.depth;
        return `${numStr(w)}, ${numStr(h)}, ${numStr(d)}`;
    }
    if (t === 'SphereGeometry') {
        const r = geo.parameters.radius, ws = geo.parameters.widthSegments, hs = geo.parameters.heightSegments;
        return `${numStr(r)}, ${ws}, ${hs}`;
    }
    if (t === 'ConeGeometry') {
        const r = geo.parameters.radius, h = geo.parameters.height, rs = geo.parameters.radialSegments;
        return `${numStr(r)}, ${numStr(h)}, ${rs}`;
    }
    if (t === 'CylinderGeometry') {
        const rt = geo.parameters.radiusTop, rb = geo.parameters.radiusBottom, h = geo.parameters.height, segs = geo.parameters.radialSegments;
        return `${numStr(rt)}, ${numStr(rb)}, ${numStr(h)}, ${segs}`;
    }
    if (t === 'PlaneGeometry') {
        return `${numStr(geo.parameters.width)}, ${numStr(geo.parameters.height)}`;
    }
    if (t === 'TorusGeometry') {
        return `${numStr(geo.parameters.radius)}, ${numStr(geo.parameters.tube)}, ${geo.parameters.radialSegments}, ${geo.parameters.tubularSegments}`;
    }
    if (t === 'TetrahedronGeometry' || t === 'OctahedronGeometry' || t === 'DodecahedronGeometry' || t === 'IcosahedronGeometry') {
        return `${numStr(geo.parameters.radius)}, ${geo.parameters.detail ?? 0}`;
    }
    if (t === 'TorusKnotGeometry') {
        return `${numStr(geo.parameters.radius)}, ${numStr(geo.parameters.tube)}, ${geo.parameters.tubularSegments}, ${geo.parameters.radialSegments}`;
    }
    return '';
}

function numStr(v) {
    if (typeof v === 'number' && !isFinite(v)) return '1';
    if (Math.abs(v) < 1e-10) return '0';
    return parseFloat(v.toPrecision(10)).toString();
}
