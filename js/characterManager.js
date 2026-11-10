import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CharacterManager {
    constructor(app) {
        this.app = app;
        this.characters = [];
        this.loader = new GLTFLoader();
        
        // Models from Three.js examples (Mixamo Xbot/Ybot)
        this.models = {
            'xbot': './Art/Xbot.glb',
            'ybot': './Art/Ybot.glb'
        };
    }

    addCharacter(type = 'xbot') {
        const url = this.models[type] || this.models['xbot'];
        
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

                    // 2. Setup Animation Mixer
                    const mixer = new THREE.AnimationMixer(model);
                    const animations = gltf.animations;
                    const actions = {};

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
                        actions: actions
                    };

                    const charData = {
                        model: model,
                        mixer: mixer,
                        actions: actions,
                        state: 'idle'
                    };

                    this.characters.push(charData);
                    
                    document.body.style.cursor = 'default';
                    
                    // Show notification if UI is available
                    if (this.app.ui && this.app.ui.showNotification) {
                        const gender = type === 'xbot' ? 'Female' : 'Male';
                        this.app.ui.showNotification(`${gender} character loaded!`, 'success');
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
            if (char.mixer) {
                char.mixer.update(delta);
            }
        }
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