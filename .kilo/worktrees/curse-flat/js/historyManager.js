import * as THREE from 'three';

export class HistoryManager {
    constructor(app) {
        this.app = app;
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50; // Limit history to prevent memory issues
    }

    // Execute a command and add it to history
    async executeCommand(command) {
        // Remove any history after current index (when adding new command after undo)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Execute the command (handle both sync and async)
        let success;
        if (command.execute.constructor.name === 'AsyncFunction') {
            success = await command.execute();
        } else {
            success = command.execute();
        }
        
        if (success !== false) { // Only add to history if execution was successful
            this.history.push(command);
            this.currentIndex++;

            // Limit history size
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.currentIndex--;
            }

            this.updateUndoRedoButtons();
        }

        return success;
    }

    // Undo the last command
    undo() {
        if (this.canUndo()) {
            const command = this.history[this.currentIndex];
            command.undo();
            this.currentIndex--;
            this.updateUndoRedoButtons();
            return true;
        }
        return false;
    }

    // Redo the next command
    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            const command = this.history[this.currentIndex];
            command.execute();
            this.updateUndoRedoButtons();
            return true;
        }
        return false;
    }

    // Check if undo is possible
    canUndo() {
        return this.currentIndex >= 0;
    }

    // Check if redo is possible
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    // Update the visual state of undo/redo buttons
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
            undoBtn.style.opacity = this.canUndo() ? '1' : '0.5';
        }
        
        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
            redoBtn.style.opacity = this.canRedo() ? '1' : '0.5';
        }
    }

    // Clear history (useful when scene is cleared)
    clearHistory() {
        this.history = [];
        this.currentIndex = -1;
        this.updateUndoRedoButtons();
    }

    // Get current history info for debugging
    getHistoryInfo() {
        return {
            totalCommands: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}


// Command classes for different operations

export class AddObjectCommand {
    constructor(app, object) {
        this.app = app;
        this.object = object;
        this.objectId = this.generateObjectId();
    }

    generateObjectId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    execute() {
        if (!this.object) return false;
        
        // Store object ID for identification
        this.object.userData.objectId = this.objectId;
        this.object.userData.commandId = this.generateObjectId();
        
        // Add to scene
        this.app.addToScene(this.object);
        
        // Select the new object
        this.app.selectObject(this.object);
        const objectId = this.object.userData?.id || this.object.uuid;
        if (this.animationData) this.app.animationManager?.createClip(objectId, this.animationData);
        if (this.hadPhysics || this.object.userData?.physicsEnabled) {
            this.app.physicsManager?.addMesh(this.object, physicsOptions(this.object));
        }
        this.app.animationUI?.refresh();
        
        return true;
    }

    undo() {
        if (!this.object) return false;
        
        // Deselect if this object is selected
        if (this.app.selectedObject === this.object) {
            this.app.deselect();
        }
        
        const objectId = this.object.userData?.id || this.object.uuid;
        const clip = this.app.animationManager?.getClip(objectId);
        this.animationData = clip ? clip.toJSON() : null;
        this.hadPhysics = !!this.app.physicsManager?.getBodyForMesh(this.object);
        this.app.physicsManager?.removeMesh(this.object);
        this.app.animationManager?.removeClip(objectId);

        // Remove from scene
        this.app.scene.remove(this.object);
        
        // Remove from objects array
        const idx = this.app.objects.indexOf(this.object);
        if (idx > -1) {
            this.app.objects.splice(idx, 1);
        }
        
        // Update UI
        this.app.ui.updateUI(null);
        this.app.animationUI?.refresh();
        
        return true;
    }
}

export class DeleteObjectCommand {
    constructor(app, object) {
        this.app = app;
        this.object = object;
        this.animationData = undefined;
        this.hadPhysics = false;
        this.folderMemberships = [];
    }

    execute() {
        if (!this.object) return false;

        let root = this.object;
        while (root.parent && root.parent !== this.app.scene) root = root.parent;
        this.object = root;

        const objectId = root.userData?.id || root.uuid;
        if (this.animationData === undefined) {
            const clip = this.app.animationManager?.getClip(objectId);
            this.animationData = clip ? clip.toJSON() : null;
            this.hadPhysics = !!this.app.physicsManager?.getBodyForMesh(root);
            this.folderMemberships = (this.app.layerManager?.folders || [])
                .filter(folder => folder.objects?.includes(root));
        }

        let selected = this.app.selectedObject;
        while (selected?.parent && selected.parent !== this.app.scene) selected = selected.parent;
        if (selected === root) {
            this.app.deselect();
        }

        this.app.physicsManager?.removeMesh(root);
        this.app.animationManager?.removeClip(objectId);
        this.folderMemberships.forEach(folder => {
            folder.objects = folder.objects.filter(object => object !== root);
        });
        this.app.scene.remove(root);
        const idx = this.app.objects.indexOf(root);
        if (idx > -1) this.app.objects.splice(idx, 1);
        this.app.ui.updateUI(null);
        this.app.animationUI?.refresh();
        return true;
    }

    undo() {
        if (!this.object) return false;

        this.app.addToScene(this.object);
        this.folderMemberships.forEach(folder => {
            if (!folder.objects.includes(this.object)) folder.objects.push(this.object);
        });

        const objectId = this.object.userData?.id || this.object.uuid;
        if (this.animationData) {
            this.app.animationManager?.createClip(objectId, this.animationData);
        }
        if (this.hadPhysics || this.object.userData?.physicsEnabled) {
            this.app.physicsManager?.addMesh(this.object, physicsOptions(this.object));
        }
        this.app.selectObject(this.object);
        this.app.animationUI?.refresh();
        return true;
    }
}

export class TransformObjectCommand {
    constructor(app, object, oldTransform, newTransform) {
        this.app = app;
        this.object = object;
        this.oldTransform = oldTransform;
        this.newTransform = newTransform;
    }

    execute() {
        if (!this.object) return false;
        
        this.object.position.set(
            this.newTransform.position.x,
            this.newTransform.position.y,
            this.newTransform.position.z
        );
        this.object.rotation.set(
            this.newTransform.rotation.x,
            this.newTransform.rotation.y,
            this.newTransform.rotation.z
        );
        this.object.scale.set(
            this.newTransform.scale.x,
            this.newTransform.scale.y,
            this.newTransform.scale.z
        );
        
        // Update UI
        this.app.ui.updateUI(this.app.selectedObject);
        
        return true;
    }

    undo() {
        if (!this.object) return false;
        
        this.object.position.set(
            this.oldTransform.position.x,
            this.oldTransform.position.y,
            this.oldTransform.position.z
        );
        this.object.rotation.set(
            this.oldTransform.rotation.x,
            this.oldTransform.rotation.y,
            this.oldTransform.rotation.z
        );
        this.object.scale.set(
            this.oldTransform.scale.x,
            this.oldTransform.scale.y,
            this.oldTransform.scale.z
        );
        
        // Update UI
        this.app.ui.updateUI(this.app.selectedObject);
        
        return true;
    }
}

export class ClearSceneCommand {
    constructor(app) {
        this.app = app;
        this.objects = null;
        this.animationData = null;
        this.physicsObjects = new Set();
        this.folderMemberships = new Map();
    }

    execute() {
        if (!this.objects) {
            this.objects = [...this.app.objects];
            this.animationData = this.app.animationManager?.toJSON() || { clips: {} };
            this.objects.forEach(object => {
                if (this.app.physicsManager?.getBodyForMesh(object)) this.physicsObjects.add(object);
                const folders = (this.app.layerManager?.folders || [])
                    .filter(folder => folder.objects?.includes(object));
                if (folders.length) this.folderMemberships.set(object, folders);
            });
        }
        this.app._clearSceneNow();
        this.app.animationUI?.refresh();
        return true;
    }

    undo() {
        if (!this.objects) return false;
        this.app._clearSceneNow();
        this.objects.forEach(object => {
            this.app.addToScene(object);
            for (const folder of this.folderMemberships.get(object) || []) {
                if (!folder.objects.includes(object)) folder.objects.push(object);
            }
            if (this.physicsObjects.has(object) || object.userData?.physicsEnabled) {
                this.app.physicsManager?.addMesh(object, physicsOptions(object));
            }
        });
        this.app.animationManager?.fromJSON(this.animationData || { clips: {} });
        this.app.animationManager?.seek(0);
        this.app.ui.updateUI(null);
        this.app.animationUI?.refresh();
        return true;
    }
}

function physicsOptions(object) {
    const data = object.userData || {};
    return {
        mass: data.physicsMass ?? 1,
        bodyType: data.physicsBodyType ?? 2,
        friction: data.physicsFriction ?? 0.3,
        restitution: data.physicsRestitution ?? 0.2,
        linearDamping: data.physicsLinearDamping ?? 0.01,
        angularDamping: data.physicsAngularDamping ?? 0.01
    };
}

export class AddCharacterCommand {
    constructor(app, characterType) {
        this.app = app;
        this.characterType = characterType;
        this.characterModel = null;
    }

    async execute() {
        try {
            // Load character through character manager
            const model = await this.app.characterManager.addCharacter(this.characterType);
            this.characterModel = model;
            
            if (model) {
                // Add to scene and select
                this.app.addToScene(model);
                this.app.selectObject(model);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to add character:', error);
            return false;
        }
    }

    undo() {
        if (!this.characterModel) return false;
        
        // Deselect if this object is selected
        if (this.app.selectedObject === this.characterModel) {
            this.app.deselect();
        }
        
        // Remove from scene
        this.app.scene.remove(this.characterModel);
        
        // Remove from objects array
        const idx = this.app.objects.indexOf(this.characterModel);
        if (idx > -1) {
            this.app.objects.splice(idx, 1);
        }
        
        // Remove from character manager
        const charIndex = this.app.characterManager.characters.findIndex(c => c.model === this.characterModel);
        if (charIndex > -1) {
            this.app.characterManager.characters.splice(charIndex, 1);
        }
        
        // Update UI
        this.app.ui.updateUI(null);
        
        return true;
    }
}
