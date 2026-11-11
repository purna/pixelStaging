import * as THREE from 'three';

/**
 * SceneManager - manages multiple named scenes for staging
 * Each scene has its own objects, cameras, lighting, and settings
 */
export class SceneManager {
    constructor(app) {
        this.app = app;
        this.scenes = new Map(); // name -> scene data
        this.currentSceneName = 'Main';
        this.sceneIdCounter = 1;
        
        // Initialize with default scene
        this.createScene('Main', true);
    }

    createScene(name, makeCurrent = false) {
        if (this.scenes.has(name)) {
            // Auto-generate unique name
            let counter = 1;
            let newName = `${name} ${counter}`;
            while (this.scenes.has(newName)) {
                counter++;
                newName = `${name} ${counter}`;
            }
            name = newName;
        }

        const sceneData = {
            id: 'scene_' + Math.random().toString(36).slice(2, 9),
            name,
            objects: [],
            // A scene always starts with its own non-deletable camera.
            cameraRigs: [this.makeDefaultCamera()],
            shots: [],
            settings: {
                backgroundColor: '#2a2a4e',
                fog: { enabled: true, color: '#2a2a4e', near: 30, far: 100 },
                ambientLight: { enabled: true, color: '#ffffff', intensity: 0.6 },
                directionalLight: { enabled: true, color: '#ffffff', intensity: 1.2, position: [10, 10, 5] }
            },
            createdAt: Date.now()
        };

        this.scenes.set(name, sceneData);
        
        if (makeCurrent || this.scenes.size === 1) {
            this.switchToScene(name);
        }
        
        this.app.ui?.showNotification(`Scene "${name}" created`, 'success');
        this.refreshUI();
        
        return sceneData;
    }

    deleteScene(name) {
        if (this.scenes.size <= 1) {
            this.app.ui?.showNotification('Cannot delete the only scene', 'error');
            return false;
        }
        
        if (!this.scenes.has(name)) return false;
        
        const wasCurrent = this.currentSceneName === name;
        this.scenes.delete(name);
        
        if (wasCurrent) {
            // Switch to first available scene
            const firstScene = this.scenes.keys().next().value;
            this.switchToScene(firstScene);
        }
        
        this.app.ui?.showNotification(`Scene "${name}" deleted`, 'info');
        this.refreshUI();
        return true;
    }

    duplicateScene(name) {
        const source = this.scenes.get(name);
        if (!source) return null;
        
        const newName = `${name} (copy)`;
        const newScene = this.createScene(newName, false);
        
        // Copy objects (we'll just reference them for now, deep copy would be more complex)
        newScene.settings = JSON.parse(JSON.stringify(source.settings));
        
        this.refreshUI();
        return newScene;
    }

    switchToScene(name) {
        const sceneData = this.scenes.get(name);
        if (!sceneData) return false;
        
        // Save current scene state before switching
        if (this.currentSceneName && this.scenes.has(this.currentSceneName)) {
            this.saveCurrentSceneState();
        }
        
        this.currentSceneName = name;
        this.loadSceneState(sceneData);
        
        this.app.ui?.showNotification(`Switched to scene "${name}"`, 'info');
        this.refreshUI();
        return true;
    }

    makeDefaultCamera() {
        return {
            id: 'default_camera',
            name: 'Camera',
            isDefault: true,
            position: [10, 8, 10],
            target: [0, 1.5, 0],
            rotation: null,
            lens: { focalLength: 50, sensor: 'fullFrame' },
            aspect: '16:9',
            color: 0x00e5ff
        };
    }

    saveCurrentSceneState() {
        if (!this.currentSceneName || !this.app.scene) return;
        
        const sceneData = this.scenes.get(this.currentSceneName);
        if (!sceneData) return;
        
        // Save a restorable snapshot of the scene contents.
        const snapshot = this.app.fileManager?.serializeCurrentScene?.();
        sceneData.objects = snapshot?.objects || [];
        sceneData.animations = snapshot?.animations || { clips: {} };
        
        // Save camera rigs
        if (this.app.staging?.cameras) {
            sceneData.cameraRigs = this.app.staging.cameras.rigs.map(rig => ({
                id: rig.id,
                name: rig.name,
                isDefault: !!rig.isDefault,
                position: rig.group.position.toArray(),
                target: rig.target?.toArray?.() || [0, 1.5, 0],
                rotation: rig.group.rotation.toArray(),
                lens: { ...rig.lens },
                aspect: rig.aspect,
                color: rig.color
            }));
            // Keep the invariant even if the live list was temporarily empty.
            if (!sceneData.cameraRigs.some(r => r.isDefault)) {
                sceneData.cameraRigs.unshift(this.makeDefaultCamera());
            }
        }
        
        // Save shots
        if (this.app.staging?.shotManager) {
            sceneData.shots = this.app.staging.shotManager.shots.map(s => ({ ...s }));
        }
    }

    extractMaterials(object) {
        const materials = [];
        object.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.color) {
                        materials.push({
                            color: '#' + mat.color.getHexString(),
                            metalness: mat.metalness,
                            roughness: mat.roughness,
                            opacity: mat.opacity
                        });
                    }
                });
            }
        });
        return materials;
    }

    loadSceneState(sceneData) {
        // During construction the renderer/UI do not exist yet.
        if (!this.app.scene || !this.app.ui) {
            this.refreshUI();
            return;
        }

        // Clear current scene
        this.clearCurrentScene();

        // Rebuild the saved objects, then put the scene's cameras back.
        if (this.app.fileManager && Array.isArray(sceneData.objects)) {
            this.app.fileManager.loadData({
                objects: sceneData.objects,
                animations: sceneData.animations || null
            });
        }
        this.restoreSceneCameras(sceneData);

        // Restore this scene's shot timeline.
        if (this.app.staging?.shotManager) {
            this.app.staging.shotManager.shots = (sceneData.shots || []).map(s => ({ ...s }));
            this.app.staging.shotManager.currentTime = 0;
            this.app.staging.shotManager.previewActive = false;
            this.app.staging.shotManager.refreshUI();
        }
        
        // Apply settings
        this.applySceneSettings(sceneData.settings);
        
        // Note: For full scene restore, we'd need to recreate objects from saved data
        // This is a simplified version - in practice you'd want to serialize/deserialize
        // For now, we just apply settings and let user rebuild
        
        this.app.ui?.renderHierarchyPanel();
    }

    applySceneSettings(settings) {
        // Background
        if (settings.backgroundColor) {
            this.app.setBackgroundColor(settings.backgroundColor);
        }
        
        // Fog
        if (settings.fog?.enabled) {
            this.app.setFog(true, settings.fog.color, settings.fog.near, settings.fog.far);
        } else {
            this.app.setFog(false);
        }
        
        // Lights - these would need to find and update existing lights
        // For now we just store the settings
    }

    restoreSceneCameras(sceneData) {
        const cameras = this.app.staging?.cameras;
        if (!cameras || !this.app.scene) return;

        const saved = Array.isArray(sceneData?.cameraRigs) && sceneData.cameraRigs.length
            ? sceneData.cameraRigs
            : [this.makeDefaultCamera()];

        cameras.clearRigs();
        for (const def of saved) {
            cameras.addRig(def.name, new THREE.Vector3().fromArray(def.position || [4, 1.5, 4]), {
                id: def.id,
                name: def.name,
                isDefault: !!def.isDefault,
                target: def.target,
                rotation: def.rotation,
                lens: def.lens,
                aspect: def.aspect,
                color: def.color
            });
        }
        cameras.ensureDefaultRig();
        cameras.refreshUI();
    }

    clearCurrentScene() {
        // Remove all objects except camera rigs and system objects
        this.app.deselect();
        
        for (const object of [...this.app.objects]) {
            // Keep camera rigs
            if (object.userData?.rigRef) continue;
            
            this.app.scene.remove(object);
            const idx = this.app.objects.indexOf(object);
            if (idx > -1) this.app.objects.splice(idx, 1);
        }
        
        // Clear shots
        if (this.app.staging?.shotManager) {
            this.app.staging.shotManager.shots = [];
            this.app.staging.shotManager.currentTime = 0;
            this.app.staging.shotManager.refreshUI();
        }
    }

    getCurrentScene() {
        return this.scenes.get(this.currentSceneName);
    }

    getSceneNames() {
        return Array.from(this.scenes.keys());
    }

    renameScene(oldName, newName) {
        if (!this.scenes.has(oldName)) return false;
        if (this.scenes.has(newName)) return false;
        
        const sceneData = this.scenes.get(oldName);
        this.scenes.delete(oldName);
        sceneData.name = newName;
        this.scenes.set(newName, sceneData);
        
        if (this.currentSceneName === oldName) {
            this.currentSceneName = newName;
        }
        
        this.refreshUI();
        return true;
    }

    refreshUI() {
        // Trigger UI update for scene list
        if (this.app.ui?.renderSceneList) {
            this.app.ui.renderSceneList();
        }
    }

    exportScenes() {
        this.saveCurrentSceneState();
        const data = {
            format: 'pixelstaging-scenes',
            version: 1,
            currentScene: this.currentSceneName,
            scenes: {}
        };
        
        for (const [name, sceneData] of this.scenes) {
            data.scenes[name] = {
                name: sceneData.name,
                settings: sceneData.settings,
                objects: sceneData.objects || [],
                animations: sceneData.animations || { clips: {} },
                shots: sceneData.shots || [],
                cameraRigs: (sceneData.cameraRigs || []).map(r => ({ ...r })),
                createdAt: sceneData.createdAt
            };
        }
        
        return data;
    }

    importScenes(data) {
        if (!data?.scenes) return false;
        
        this.scenes.clear();
        
        for (const [name, sceneData] of Object.entries(data.scenes)) {
            this.scenes.set(name, {
                id: 'scene_' + Math.random().toString(36).slice(2, 9),
                name: sceneData.name,
                objects: sceneData.objects || [],
                animations: sceneData.animations || { clips: {} },
                cameraRigs: sceneData.cameraRigs || [],
                shots: sceneData.shots || [],
                settings: sceneData.settings || {
                    backgroundColor: '#2a2a4e',
                    fog: { enabled: true, color: '#2a2a4e', near: 30, far: 100 },
                    ambientLight: { enabled: true, color: '#ffffff', intensity: 0.6 },
                    directionalLight: { enabled: true, color: '#ffffff', intensity: 1.2, position: [10, 10, 5] }
                },
                createdAt: sceneData.createdAt || Date.now()
            });
        }
        
        this.currentSceneName = data.currentScene || this.scenes.keys().next().value || 'Main';
        
        if (this.scenes.has(this.currentSceneName)) {
            this.loadSceneState(this.scenes.get(this.currentSceneName));
        }
        
        this.refreshUI();
        return true;
    }

    /** Save every scene to browser storage so it survives a reload. */
    persistScenes() {
        if (!this.currentSceneName) return false;
        this.saveCurrentSceneState();
        try {
            localStorage.setItem('pixel3d-scenes', JSON.stringify(this.exportScenes()));
            return true;
        } catch (error) {
            console.error('Could not save scenes:', error);
            return false;
        }
    }

    /** Restore saved scenes from browser storage if available. */
    restorePersistedScenes() {
        const raw = localStorage.getItem('pixel3d-scenes');
        if (!raw) return false;
        try {
            return this.importScenes(JSON.parse(raw));
        } catch (error) {
            console.error('Could not restore scenes:', error);
            return false;
        }
    }
}