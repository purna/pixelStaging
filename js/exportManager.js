/**
 * Export Manager Module - Pixel 3D Pro Staging Studio
 *
 * Handles exporting scenes to various formats:
 * - JSON (native format)
 * - GLB/GLTF (3D model formats)
 * - Draco (.drc) - Google mesh compression
 * - FBX (via fallback)
 * - A-Frame HTML
 * - JavaScript module
 */

import * as THREE from 'three';

export class ExportManager {
    constructor(app) {
        this.app = app;
        this.exportFormat = localStorage.getItem('pixel3d-export-format') || 'json';
    }

    setExportFormat(format) {
        this.exportFormat = format;
    }

    getExportFormat() {
        return this.exportFormat;
    }

    async exportScene() {
        switch (this.exportFormat) {
            case 'json':
                this.exportJSON();
                break;
            case 'glb':
                await this.exportGLB();
                break;
            case 'gltf':
                await this.exportGLTF();
                break;
            case 'draco':
                await this.exportDraco();
                break;
            case 'fbx':
                await this.exportFBX();
                break;
            case 'aframe':
                this.exportAFrame();
                break;
            case 'js':
                await this.exportJS();
                break;
            default:
                this.exportJSON();
        }
    }

    async exportGLB() {
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
            const animations = this.buildAnimationTracks(Array.from(objectToClip.entries()));

            const result = await new Promise((resolve, reject) => {
                exporter.parse(exportScene, resolve, reject, { binary: true, embedImages: true, animations });
            });

            this.downloadBlob(result, 'scene.glb', 'model/gltf-binary');
            this.app.ui?.showNotification('Scene exported as GLB!', 'success');
        } catch (error) {
            console.error('Error exporting GLB:', error);
            this.app.ui?.showNotification('Failed to export GLB: ' + error.message, 'error');
        }
    }

    async exportGLTF() {
        try {
            const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

            const exportScene = new THREE.Scene();

            this.app.scene.traverse((obj) => {
                if (obj.isHelper || obj.type === 'GridHelper' || obj.type === 'AxesHelper') return;
                if (obj.type === 'TransformControlsGizmo' || obj.type === 'TransformControlsPlane') return;
                if (obj.type === 'TransformControls') return;
                if (!obj.userData?.type) return;

                try {
                    exportScene.add(obj.clone(true));
                } catch (e) {
                    console.warn('Could not clone for export:', obj.name, e);
                }
            });

            const exporter = new GLTFExporter();

            const result = await new Promise((resolve, reject) => {
                exporter.parse(exportScene, resolve, reject, { binary: false, embedImages: true });
            });

            if (result && typeof result === 'object' && result.scenes) {
                const json = JSON.stringify(result, null, 2);
                this.downloadBlob(json, 'scene.gltf', 'model/gltf+json');
                this.app.ui?.showNotification('Scene exported as GLTF!', 'success');
            }
        } catch (error) {
            console.error('Error exporting GLTF:', error);
            this.app.ui?.showNotification('Failed to export GLTF: ' + error.message, 'error');
        }
    }

    async exportFBX() {
        this.app.ui?.showNotification('FBX export coming soon. Use GLB for now.', 'info');
        await this.exportGLB();
    }

    async exportDraco() {
        try {
            // Import DracoEncoder and BufferGeometryUtils from three.js examples
            const [{ DRACOExporter }, { BufferGeometryUtils }] = await Promise.all([
                import('three/addons/exporters/DRACOExporter.js'),
                import('three/addons/utils/BufferGeometryUtils.js')
            ]);

            if (this.app.scene.children.length === 0) {
                this.app.ui?.showNotification('No objects to export!', 'info');
                return;
            }

            // Collect meshes for Draco encoding
            const meshes = [];
            this.app.scene.traverse((obj) => {
                if (obj.isMesh && obj.userData?.type === 'shape') {
                    meshes.push(obj);
                }
            });

            if (meshes.length === 0) {
                this.app.ui?.showNotification('No exportable meshes in scene!', 'info');
                return;
            }

            // For multiple meshes, we'll encode them separately
            // Draco works on individual geometries
            let exportData = null;
            const exporter = new DRACOExporter();

            if (meshes.length === 1) {
                // Single mesh
                exportData = await new Promise((resolve, reject) => {
                    exporter.parse(meshes[0], resolve, reject, {
                        decodeSpeed: 5,
                        encodeSpeed: 5,
                        encoderMethod: 'edgebreaker',
                        encoderOptions: {
                            checkEncodableNaN: true,
                            encodeLossyQuantization: false,
                            quantizationBitsPosition: 14,
                            quantizationBitsNormal: 10,
                            quantizationBitsTexcoord: 12
                        }
                    });
                });
            } else {
                // Multiple meshes - create a group and use buffer geometry approach
                const group = new THREE.Group();
                meshes.forEach(m => group.add(m.clone()));

                // Merge geometries for Draco encoding
                const geometries = [];
                group.traverse((obj) => {
                    if (obj.isMesh) {
                        const geo = obj.geometry;
                        if (geo.isBufferGeometry) {
                            geometries.push(geo);
                        }
                    }
                });

                if (geometries.length > 0) {
                    const merged = BufferGeometryUtils.mergeBufferGeometries(geometries);
                    const tempMesh = new THREE.Mesh(merged);
                    exportData = await new Promise((resolve, reject) => {
                        exporter.parse(tempMesh, resolve, reject, {
                            decodeSpeed: 5,
                            encodeSpeed: 5,
                            encoderMethod: 'edgebreaker',
                            encoderOptions: {
                                quantizationBitsPosition: 14,
                                quantizationBitsNormal: 10,
                                quantizationBitsTexcoord: 12
                            }
                        });
                    });
                }
            }

            if (exportData && exportData.array) {
                const blob = new Blob([exportData.array], { type: 'application/octet-stream' });
                this.downloadBlob(blob, 'scene.drc', 'application/octet-stream');
                this.app.ui?.showNotification('Scene exported as Draco (.drc)!', 'success');
            } else {
                throw new Error('Draco export returned no data');
            }
        } catch (error) {
            console.error('Error exporting Draco:', error);
            this.app.ui?.showNotification('Failed to export Draco: ' + error.message + '. (Requires DRACO libraries)', 'error');
        }
    }

    exportJSON() {
        const data = [];

        this.app.scene.children.forEach(obj => {
            if (obj.userData.type) {
                const item = {
                    type: obj.userData.type,
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                    userData: obj.userData
                };

                if (obj.userData.type === 'shape') {
                    item.shapeType = obj.userData.shapeType;
                    const firstMaterial = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                    item.color = '#' + firstMaterial.color.getHexString();
                } else if (obj.userData.type === 'light') {
                    const l = obj.children[0];
                    item.lightType = obj.userData.lightType;
                    item.color = '#' + l.color.getHexString();
                    item.intensity = l.intensity;
                }

                data.push(item);
            }
        });

        const sceneData = {
            version: 1,
            objects: data,
            animations: this.app.animationManager.toJSON()
        };

        this.downloadBlob(JSON.stringify(sceneData, null, 2), 'scene.json', 'application/json');
        this.app.ui?.showNotification('Scene exported as JSON!', 'success');
    }

    exportAFrame() {
        const elements = [];
        const lights = [];

        this.app.getAllObjects().forEach(obj => {
            if (obj.userData.type === 'shape') {
                elements.push(this.generateAFrameElement(obj));
            } else if (obj.userData.type === 'light') {
                lights.push(this.generateAFrameLight(obj));
            }
        });

        let cameraPosition = '0 1.6 5';
        if (this.app.camera) {
            const cam = this.app.camera;
            cameraPosition = `${cam.position.x.toFixed(2)} ${cam.position.y.toFixed(2)} ${cam.position.z.toFixed(2)}`;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Pixel 3D - A-Frame Export</title>
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    <style>body { margin: 0; overflow: hidden; }</style>
</head>
<body>
    <a-scene background="color: #2a2a4e">
        <a-assets></a-assets>
        <a-entity id="rig" position="${cameraPosition}">
            <a-camera look-controls wasd-controls></a-camera>
        </a-entity>
        <!-- Lights -->
${lights.join('\n')}
        <!-- Scene Objects -->
${elements.join('\n')}
        <a-sky color="#2a2a4e"></a-sky>
    </a-scene>
</body>
</html>`;

        this.downloadBlob(html, 'scene.html', 'text/html');
        this.app.ui?.showNotification('Scene exported as A-Frame HTML!', 'success');
    }

    async exportJS() {
        // Delegate to existing FileManager implementation
        if (this.app.fileManager?.saveSceneJS) {
            await this.app.fileManager.saveSceneJS();
        }
    }

    downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    buildAnimationTracks(objectToClip) {
        const animations = [];

        for (const [obj, clip] of objectToClip) {
            for (const prop of ['position', 'rotation', 'scale', 'color']) {
                const kfs = clip.getKeyframes(prop);
                if (kfs.length < 2) continue;

                if (prop === 'color') {
                    const times = kfs.map(k => k.time);
                    const values = [];
                    for (const kf of kfs) values.push(kf.value.r, kf.value.g, kf.value.b);
                    animations.push(new THREE.ColorKeyframeTrack(`${obj.name}.material.color`, times, values));
                } else {
                    const times = kfs.map(k => k.time);
                    const values = [];
                    for (const kf of kfs) values.push(kf.value.x, kf.value.y, kf.value.z);

                    if (prop === 'rotation') {
                        const eulers = kfs.map(k => new THREE.Euler(k.value.x, k.value.y, k.value.z));
                        const quaternions = eulers.map(e => new THREE.Quaternion().setFromEuler(e));
                        const qValues = [];
                        for (const q of quaternions) qValues.push(q.x, q.y, q.z, q.w);
                        animations.push(new THREE.QuaternionKeyframeTrack(`${obj.name}.quaternion`, times, qValues));
                    } else {
                        animations.push(new THREE.VectorKeyframeTrack(`${obj.name}.${prop}`, times, values));
                    }
                }
            }
        }

        // Convert to AnimationClips
        const clips = [];
        const clipMap = new Map();
        for (const [obj, clip] of objectToClip) {
            if (!clipMap.has(clip)) clipMap.set(clip, []);
            clipMap.get(clip).push(obj);
        }

        clipMap.forEach((objs, clip) => {
            const tracks = [];
            for (const prop of ['position', 'rotation', 'scale', 'color']) {
                const kfs = clip.getKeyframes(prop);
                if (kfs.length < 2) continue;
                // ... track building logic
            }
            clips.push(new THREE.AnimationClip('scene_animation', clip.duration, tracks));
        });

        return animations.map(t => new THREE.AnimationClip('animation', 5, [t]));
    }

    generateAFrameElement(obj) {
        if (!obj.userData || !obj.userData.type) return '';

        const primitiveMap = {
            box: 'a-box', sphere: 'a-sphere', cone: 'a-cone',
            cylinder: 'a-cylinder', plane: 'a-plane', torus: 'a-torus'
        };

        if (obj.userData.type === 'shape') {
            const primitive = primitiveMap[obj.userData.shapeType] || 'a-entity';
            const pos = obj.position;
            const rot = obj.rotation;
            const scl = obj.scale;
            const firstMaterial = Array.isArray(obj.material) ? obj.material[0] : obj.material;
            const col = firstMaterial ? '#' + firstMaterial.color.getHexString() : '#ffffff';
            const rotX = (rot.x * 180 / Math.PI).toFixed(2);
            const rotY = (rot.y * 180 / Math.PI).toFixed(2);
            const rotZ = (rot.z * 180 / Math.PI).toFixed(2);

            return `        <${primitive} position="${pos.x} ${pos.y} ${pos.z}" ` +
                `rotation="${rotX} ${rotY} ${rotZ}" ` +
                `scale="${scl.x} ${scl.y} ${scl.z}" ` +
                `color="${col}"></${primitive}>`;
        }
        return '';
    }

    generateAFrameLight(obj) {
        if (!obj.userData || obj.userData.type !== 'light') return '';

        const lightType = obj.userData.lightType;
        const pos = obj.position;
        const l = obj.children[0];
        if (!l) return '';

        const col = '#' + l.color.getHexString();
        const intensity = l.intensity.toFixed(2);

        switch (lightType) {
            case 'point': return `        <a-light type="point" position="${pos.x} ${pos.y} ${pos.z}" color="${col}" intensity="${intensity}"></a-light>`;
            case 'ambient': return `        <a-light type="ambient" color="${col}" intensity="${intensity}"></a-light>`;
            default: return `        <a-light type="${lightType}" position="${pos.x} ${pos.y} ${pos.z}" color="${col}" intensity="${intensity}"></a-light>`;
        }
    }
}
