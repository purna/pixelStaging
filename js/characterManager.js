import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterPoser } from '../Art/CharacterPoser.js';

export class CharacterManager {
    constructor(app) {
        this.app = app;
        this.characters = [];
        this.loader = new GLTFLoader();
        this.poseLibrary = null;
        this._poseLibraryPromise = null;
        this.customPoses = this.loadCustomPoses();
        
        // Models from Three.js examples (Mixamo Xbot/Ybot)
        this.models = {
            'xbot': './Art/Xbot.glb',
            'ybot': './Art/Ybot.glb',
            'xbot_child': './Art/Xbot_child.glb',
            'ybot_child': './Art/Ybot_child.glb'
        };
    }

    loadCustomPoses() {
        try {
            return JSON.parse(localStorage.getItem('pixel3d-custom-poses') || '{}');
        } catch (error) {
            return {};
        }
    }

    persistCustomPoses() {
        localStorage.setItem('pixel3d-custom-poses', JSON.stringify(this.customPoses));
    }

    async loadPoseLibrary() {
        if (this.poseLibrary) return this.poseLibrary;
        if (!this._poseLibraryPromise) {
            this._poseLibraryPromise = fetch('./Art/poses.json')
                .then(response => response.ok ? response.json() : null)
                .then(data => { this.poseLibrary = data; return data; })
                .catch(error => { console.warn('Could not load pose library:', error); return null; });
        }
        return this._poseLibraryPromise;
    }

    async addCharacter(type = 'xbot') {
        const url = this.models[type] || this.models['xbot'];
        const poseLibrary = await this.loadPoseLibrary();
        
        // Show loading state
        document.body.style.cursor = 'wait';

        return new Promise((resolve, reject) => {
            this.loader.load(url, (gltf) => {
                try {
                    const model = gltf.scene;
                    
                    // 1. Setup Shadows & Position
                    model.traverse((object) => {
                        if (object.isMesh) {
                            object.castShadow = true;
                        }
                    });
                    model.position.set(0, 0, 0);

                    // 2. Setup Animation Mixer and poser
                    const mixer = new THREE.AnimationMixer(model);
                    const animations = gltf.animations;
                    const actions = {};
                    let poser = null;
                    try {
                        poser = new CharacterPoser(model, animations, poseLibrary);
                    } catch (error) {
                        console.warn('Pose system unavailable for this character:', error);
                    }

                    // 3. Find specific clips (Idle, Walk, Run)
                    // Mixamo files usually have them in specific indices or names
                    const idleClip = animations.find(a => a.name.toLowerCase().includes('idle')) || animations[0];
                    const runClip = animations.find(a => a.name.toLowerCase().includes('run')) || animations[1];
                    const walkClip = animations.find(a => a.name.toLowerCase().includes('walk')) || animations[3];

                    // 4. Create Actions
                    if (idleClip) {
                        const action = mixer.clipAction(idleClip);
                        action.enabled = true;
                        action.setEffectiveWeight(1); // Start idle
                        action.play();
                        actions['idle'] = action;
                    }
                    if (walkClip) {
                        const action = mixer.clipAction(walkClip);
                        action.enabled = true;
                        action.setEffectiveWeight(0);
                        action.play();
                        actions['walk'] = action;
                    }
                    if (runClip) {
                        const action = mixer.clipAction(runClip);
                        action.enabled = true;
                        action.setEffectiveWeight(0);
                        action.play();
                        actions['run'] = action;
                    }

                    // 5. Store Data
                    model.userData = {
                        type: 'character',
                        characterType: type,
                        id: Date.now(),
                        manager: this,
                        mixer: mixer,
                        actions: actions,
                        poser: poser
                    };

                    const charData = {
                        model: model,
                        mixer: mixer,
                        actions: actions,
                        poser: poser,
                        state: 'idle',
                        pose: null
                    };

                    this.characters.push(charData);
                    
                    document.body.style.cursor = 'default';
                    
                    // Show notification if UI is available
                    if (this.app.ui && this.app.ui.showNotification) {
                        const labels = {
                            xbot: 'Female',
                            ybot: 'Male',
                            xbot_child: 'Child Female',
                            ybot_child: 'Child Male'
                        };
                        this.app.ui.showNotification(`${labels[type] || 'Character'} loaded!`, 'success');
                    }
                    
                    resolve(model);
                    
                } catch (error) {
                    reject(error);
                }

            }, undefined, (e) => {
                console.error('Error loading character:', e);
                document.body.style.cursor = 'default';
                
                // Show error notification if UI is available
                if (this.app.ui && this.app.ui.showNotification) {
                    this.app.ui.showNotification('Failed to load character', 'error');
                }
                
                reject(e);
            });
        });
    }

    update(delta) {
        // Update all mixers (advances animation frames)
        for (const char of this.characters) {
            if (char.mixer) char.mixer.update(delta);
            if (char.poser?.blending) char.poser.update(delta);
        }
    }

    findCharacter(model) {
        let current = model;
        while (current) {
            const match = this.characters.find(c => c.model === current);
            if (match) return match;
            current = current.parent;
        }
        return null;
    }

    setPose(model, poseName, duration = 0.3) {
        const char = this.findCharacter(model);
        if (!char?.poser) return false;

        // Bone posing and AnimationMixer clips fight each other, so stop mixer
        // actions before applying a static pose.
        if (char.mixer) char.mixer.stopAllAction();
        Object.values(char.actions || {}).forEach(action => action.stop?.());

        if (poseName.startsWith('custom:')) {
            const name = poseName.slice(7);
            const characterType = char.model.userData.characterType;
            const custom = this.customPoses[characterType]?.[name];
            if (!custom) return false;
            char.poser.applyPose(custom, { duration });
        } else {
            char.poser.apply(poseName, { duration });
        }

        char.pose = poseName;
        char.state = 'pose';
        char.model.userData.currentPose = poseName;
        return true;
    }

    applyPoseFromEditor(model, name, poseData) {
        const char = this.findCharacter(model);
        if (!char?.poser || !poseData?.rotations) return false;
        const clean = String(name || '').trim() || `Pose ${Date.now()}`;
        const characterType = char.model.userData.characterType || 'character';
        const pose = {
            rotations: poseData.rotations,
            positions: poseData.positions || undefined,
            hipsScale: 1 + (poseData.hipsDrop ?? 0)
        };
        if (!this.customPoses[characterType]) this.customPoses[characterType] = {};
        this.customPoses[characterType][clean] = pose;
        this.persistCustomPoses();

        if (char.mixer) char.mixer.stopAllAction();
        Object.values(char.actions || {}).forEach(action => action.stop?.());
        char.poser.applyPose(pose, { duration: 0.25 });
        const key = `custom:${clean}`;
        char.pose = key;
        char.state = 'pose';
        char.model.userData.currentPose = key;
        return key;
    }

    saveCustomPose(model, name) {
        const char = this.findCharacter(model);
        if (!char?.poser) return null;
        const clean = String(name || '').trim();
        if (!clean) return null;
        const characterType = char.model.userData.characterType || 'character';
        if (!this.customPoses[characterType]) this.customPoses[characterType] = {};
        this.customPoses[characterType][clean] = char.poser.getPose();
        this.persistCustomPoses();
        const key = `custom:${clean}`;
        char.pose = key;
        char.model.userData.currentPose = key;
        return key;
    }

    resetPose(model) {
        const char = this.findCharacter(model);
        if (!char?.poser) return false;
        if (char.mixer) char.mixer.stopAllAction();
        Object.values(char.actions || {}).forEach(action => action.stop?.());
        char.poser.reset({ duration: 0.25 });
        char.pose = 't_pose';
        char.model.userData.currentPose = 't_pose';
        return true;
    }

    listPoses(model) {
        const char = this.findCharacter(model);
        if (!char?.poser) return [];
        const characterType = char.model.userData.characterType || 'character';
        const customs = Object.keys(this.customPoses[characterType] || {}).map(name => `custom:${name}`);
        return [...char.poser.list(), ...customs];
    }

    // --- Blending Logic from character.html ---

    setAnimation(model, targetState) {
        const char = this.characters.find(c => c.model === model);
        if (!char) return;

        const actions = char.actions;
        const endAction = actions[targetState];
        if (!endAction) return;

        // Find currently active action (highest weight)
        let startAction = null;
        let maxWeight = -1;
        
        for (const key in actions) {
            const act = actions[key];
            if (act.getEffectiveWeight() > maxWeight) {
                maxWeight = act.getEffectiveWeight();
                startAction = act;
            }
        }

        // Only transition if different
        if (startAction !== endAction) {
            this.executeCrossFade(startAction, endAction, 1.0); // 1.0s duration
            char.state = targetState;
        }
    }

    executeCrossFade(startAction, endAction, duration) {
        // Ensure the new action is enabled and ready
        if (endAction) {
            this.setWeight(endAction, 1);
            endAction.time = 0;

            if (startAction) {
                // Crossfade: Fade out start, Fade in end
                startAction.crossFadeTo(endAction, duration, true);
            } else {
                // Just fade in
                endAction.fadeIn(duration);
            }
        } else {
            // Just fade out current
            if (startAction) startAction.fadeOut(duration);
        }
    }

    setWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }
}