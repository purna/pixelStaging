export class LayerManager {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('hierarchy-list');
        this.folders = []; // Array to store folder objects
        this.dragSource = null; // Track dragged item
        this.dragType = null; // 'object' or 'foxlder'
        this.dragTarget = null; // Track drop target for reordering
        this.initFolderUI();
    }

    // Initialize folder management UI
    initFolderUI() {
        // Add folder controls to the panel header
        const panelHeader = document.querySelector('.panel-header');
        if (panelHeader) {
            const folderControls = document.createElement('div');
            folderControls.className = 'folder-controls';
            folderControls.innerHTML = `
                <button class="btn folder-btn" id="add-folder-btn" title="Add Folder">
                    <i class="fas fa-folder-plus"></i>
                </button>
                <button class="btn folder-btn" id="expand-all-btn" title="Expand All">
                    <i class="fas fa-expand-arrows-alt"></i>
                </button>
                <button class="btn folder-btn" id="collapse-all-btn" title="Collapse All">
                    <i class="fas fa-compress-arrows-alt"></i>
                </button>
            `;
            panelHeader.appendChild(folderControls);

            // Add event listeners
            document.getElementById('add-folder-btn')?.addEventListener('click', () => this.addFolder());
            document.getElementById('expand-all-btn')?.addEventListener('click', () => this.expandCollapseAll(true));
            document.getElementById('collapse-all-btn')?.addEventListener('click', () => this.expandCollapseAll(false));
        }
    }

    // Add a new folder
    addFolder(name = 'New Folder') {
        const folder = {
            id: 'folder-' + Date.now(),
            name: name,
            objects: [],
            expanded: true
        };
        this.folders.push(folder);
        this.render();
    }

    // Expand or collapse all folders
    expandCollapseAll(expand) {
        this.folders.forEach(folder => {
            folder.expanded = expand;
        });
        this.render();
    }

    // Add object to a folder
    addObjectToFolder(folderId, object) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            folder.objects.push(object);
            // Remove from main objects array if it exists there
            const idx = this.app.objects.indexOf(object);
            if (idx > -1) {
                this.app.objects.splice(idx, 1);
            }
        }
        this.render();
    }

    // Remove object from folder (back to main list)
    removeObjectFromFolder(folderId, object) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            const idx = folder.objects.indexOf(object);
            if (idx > -1) {
                folder.objects.splice(idx, 1);
                // Add back to main objects array
                this.app.objects.push(object);
            }
        }
        this.render();
    }

    // Get all objects (including those in folders)
    getAllObjects() {
        let allObjects = [...this.app.objects];
        this.folders.forEach(folder => {
            allObjects = [...allObjects, ...folder.objects];
        });
        return allObjects;
    }

    // Refresh the list in the properties panel
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        // First render folders
        this.folders.forEach(folder => {
            const folderEl = document.createElement('div');
            folderEl.className = 'folder-item';
            folderEl.dataset.folderId = folder.id;

            folderEl.innerHTML = `
                <div class="folder-header" draggable="true">
                    <i class="fas ${folder.expanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                    <input type="text" class="folder-name" value="${folder.name}">
                    <div class="folder-actions">
                        <i class="fas fa-trash folder-delete-btn" title="Delete Folder"></i>
                        <i class="fas ${folder.expanded ? 'fa-chevron-up' : 'fa-chevron-down'} folder-toggle-btn" title="${folder.expanded ? 'Collapse' : 'Expand'}"></i>
                    </div>
                </div>
                <div class="folder-contents" style="display: ${folder.expanded ? 'block' : 'none'};">
                </div>
            `;

            // Add folder header events
            const header = folderEl.querySelector('.folder-header');
            const toggleBtn = folderEl.querySelector('.folder-toggle-btn');
            const deleteBtn = folderEl.querySelector('.folder-delete-btn');
            const nameInput = folderEl.querySelector('.folder-name');

            // Toggle folder expansion
            header.addEventListener('click', (e) => {
                if (e.target === nameInput || e.target === toggleBtn || e.target === deleteBtn) return;
                folder.expanded = !folder.expanded;
                this.render();
            });

            // Toggle button
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                folder.expanded = !folder.expanded;
                this.render();
            });

            // Delete folder
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFolder(folder.id);
            });

            // Rename folder
            nameInput.addEventListener('change', (e) => {
                folder.name = e.target.value;
            });
            nameInput.addEventListener('click', (e) => e.stopPropagation());

            // Make folder header a drop target
            header.addEventListener('dragover', (e) => this.handleDragOver(e));
            header.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            header.addEventListener('drop', (e) => this.handleDropOnFolder(e, folder.id));

            // Render folder contents
            const contentsEl = folderEl.querySelector('.folder-contents');
            folder.objects.forEach(obj => {
                this.renderObjectInFolder(obj, contentsEl, folder.id);
            });

            this.container.appendChild(folderEl);
        });

        // Then render objects not in folders
        this.app.objects.forEach(obj => {
            this.renderObjectInFolder(obj, this.container, null);
        });

        // Add drag and drop event listeners to the main container
        this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.container.addEventListener('drop', (e) => this.handleDropOnMain(e));
    }

    // Render an object in a specific container (folder or main list)
    renderObjectInFolder(obj, container, folderId) {
        const el = document.createElement('div');
        el.className = 'layer-item';
        el.draggable = true;
        if (this.app.selectedObject === obj) el.classList.add('selected');
        el.dataset.folderId = folderId || 'main';
        el.dataset.objectId = obj.id || Math.random().toString(36).substr(2, 9);

        // --- ICON LOGIC ---
        let iconClass = 'fa-cube'; // Default

        if (obj.userData.type === 'figure') {
            if (obj.userData.gender === 'female') iconClass = 'fa-female';
            else iconClass = 'fa-male';
        }
        else if (obj.userData.type === 'light') {
            switch(obj.userData.lightType) {
                case 'point': iconClass = 'fa-lightbulb'; break;
                case 'spot': iconClass = 'fa-bullseye'; break;
                case 'directional': iconClass = 'fa-sun'; break;
                default: iconClass = 'fa-lightbulb';
            }
        }
        else if (obj.userData.type === 'shape') {
            switch(obj.userData.shapeType) {
                case 'box': iconClass = 'fa-cube'; break;
                case 'sphere': iconClass = 'fa-circle'; break;
                case 'cone': iconClass = 'fa-caret-up'; break;
                case 'cylinder': iconClass = 'fa-database'; break;
                case 'plane': iconClass = 'fa-vector-square'; break;
                case 'torus': iconClass = 'fa-life-ring'; break;
                default: iconClass = 'fa-shapes';
            }
        }
        else if (obj.userData.type === 'shape2d') {
            switch(obj.userData.shapeType) {
                case 'rectangle': iconClass = 'fa-square'; break;
                case 'circle': iconClass = 'fa-circle'; break;
                case 'triangle': iconClass = 'fa-play'; break;
                case 'star': iconClass = 'fa-star'; break;
                case 'heart': iconClass = 'fa-heart'; break;
                case 'text': iconClass = 'fa-font'; break;
                default: iconClass = 'fa-shapes';
            }
        }

        // Determine Name
        let name = obj.userData.name || obj.userData.shapeType || obj.userData.lightType || 'Object';
        if (obj.userData.type === 'figure') name = obj.userData.gender + ' Figure';
        // Title case
        name = name.charAt(0).toUpperCase() + name.slice(1);

        // Create HTML structure - remove up/down arrows, add drag handle
        el.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle" title="Drag to reorder or move to folder"></i>
            <i class="fas ${iconClass} layer-icon"></i>
            <input type="text" class="layer-name" value="${name}">
            <div class="layer-actions">
                ${folderId ? '<i class="fas fa-folder-minus layer-btn remove-from-folder" title="Remove from Folder"></i>' : '<i class="fas fa-folder-plus layer-btn add-to-folder" title="Add to Folder"></i>'}
                <i class="fas fa-trash layer-btn delete" title="Delete"></i>
            </div>
        `;

        // --- EVENTS ---

        // Drag start
        el.addEventListener('dragstart', (e) => {
            this.dragSource = {
                element: el,
                object: obj,
                folderId: folderId,
                originalIndex: folderId
                    ? this.folders.find(f => f.id === folderId).objects.indexOf(obj)
                    : this.app.objects.indexOf(obj)
            };
            this.dragType = 'object';
            e.dataTransfer.setData('text/plain', 'drag-object');
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        });

        // Drag end
        el.addEventListener('dragend', (e) => {
            el.classList.remove('dragging');
            this.dragSource = null;
            this.dragType = null;
            this.dragTarget = null;
        });

        // Drag over for reordering
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.handleDragOver(e);
            this.dragTarget = {
                element: el,
                folderId: folderId,
                index: folderId
                    ? this.folders.find(f => f.id === folderId).objects.indexOf(obj)
                    : this.app.objects.indexOf(obj)
            };
        });

        // Drag leave
        el.addEventListener('dragleave', (e) => {
            this.handleDragLeave(e);
            if (this.dragTarget?.element === el) {
                this.dragTarget = null;
            }
        });

        // Drop on object for reordering
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDragLeave(e);
            if (this.dragSource && this.dragTarget && this.dragSource.object !== this.dragTarget.object) {
                this.handleDropOnObject(e);
            }
        });

        // Select Object (Clicking the row, but not inputs/buttons)
        el.addEventListener('click', (e) => {
            if(e.target.tagName === 'I' || e.target.tagName === 'INPUT') return;
            this.app.selectObject(obj);
        });

        // Rename Object
        const input = el.querySelector('.layer-name');
        input.addEventListener('change', (e) => {
            obj.userData.name = e.target.value;
            // We need to refresh the properties panel title if it's currently selected
            if (this.app.selectedObject === obj) {
                this.app.ui.renderPropertiesPanel(obj);
            }
        });
        input.addEventListener('click', (e) => e.stopPropagation()); // Prevent selection trigger

        // Actions Buttons
        const btns = el.querySelectorAll('.layer-btn');

        // Add to folder / Remove from folder
        const folderBtn = btns[0];
        if (folderId) {
            folderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeObjectFromFolder(folderId, obj);
            });
        } else {
            folderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showFolderSelection(obj);
            });
        }

        // Delete
        btns[1].addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.selectObject(obj);
            this.app.deleteSelected();
        });

        container.appendChild(el);
    }

    // Drag and drop handlers
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Add visual feedback
        if (e.target.classList.contains('folder-header') ||
            e.target.classList.contains('folder-item') ||
            e.target.classList.contains('layer-item') ||
            e.target.classList.contains('layers-container')) {
            e.target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        if (e.target.classList.contains('drag-over')) {
            e.target.classList.remove('drag-over');
        }
    }

    handleDropOnFolder(e, folderId) {
        e.preventDefault();
        e.stopPropagation();

        // Remove drag-over class
        if (e.target.classList.contains('drag-over')) {
            e.target.classList.remove('drag-over');
        }

        if (!this.dragSource || this.dragType !== 'object') return;

        // Move object to this folder
        this.addObjectToFolder(folderId, this.dragSource.object);
    }

    handleDropOnMain(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove drag-over class
        if (e.target.classList.contains('drag-over')) {
            e.target.classList.remove('drag-over');
        }

        if (!this.dragSource || this.dragType !== 'object') return;

        // If dropping on main area and object was in a folder, remove from folder
        if (this.dragSource.folderId && this.dragSource.folderId !== 'main') {
            this.removeObjectFromFolder(this.dragSource.folderId, this.dragSource.object);
        }
    }

    handleDropOnObject(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove drag-over class
        if (e.target.classList.contains('drag-over')) {
            e.target.classList.remove('drag-over');
        }

        if (!this.dragSource || !this.dragTarget) return;

        const sourceObj = this.dragSource.object;
        const targetObj = this.dragTarget.object;

        // Same folder or both in main list
        if (this.dragSource.folderId === this.dragTarget.folderId) {
            this.reorderObjectsInSameContainer(this.dragSource, this.dragTarget);
        }
        // Different containers - move from one to another
        else {
            this.moveObjectBetweenContainers(this.dragSource, this.dragTarget);
        }
    }

    // Reorder objects within the same container (folder or main list)
    reorderObjectsInSameContainer(source, target) {
        const containerId = source.folderId;
        const isFolder = containerId && containerId !== 'main';
        const container = isFolder
            ? this.folders.find(f => f.id === containerId)
            : { objects: this.app.objects };

        if (!container || !container.objects) return;

        // Remove source object
        container.objects.splice(source.originalIndex, 1);

        // Insert at target position
        const insertIndex = target.index > source.originalIndex ? target.index - 1 : target.index;
        container.objects.splice(insertIndex, 0, source.object);

        this.render();
    }

    // Move object between different containers (folder to folder, folder to main, etc.)
    moveObjectBetweenContainers(source, target) {
        const sourceIsFolder = source.folderId && source.folderId !== 'main';
        const targetIsFolder = target.folderId && target.folderId !== 'main';

        // Remove from source container
        if (sourceIsFolder) {
            const sourceFolder = this.folders.find(f => f.id === source.folderId);
            if (sourceFolder) {
                sourceFolder.objects.splice(source.originalIndex, 1);
            }
        } else {
            this.app.objects.splice(source.originalIndex, 1);
        }

        // Add to target container at the target position
        if (targetIsFolder) {
            const targetFolder = this.folders.find(f => f.id === target.folderId);
            if (targetFolder) {
                targetFolder.objects.splice(target.index, 0, source.object);
            }
        } else {
            this.app.objects.splice(target.index, 0, source.object);
        }

        this.render();
    }

    // Show folder selection dialog for adding object to folder
    showFolderSelection(obj) {
        // Create a simple dropdown to select folder
        const existingDropdown = document.getElementById('folder-select-dropdown');
        if (existingDropdown) existingDropdown.remove();

        const dropdown = document.createElement('div');
        dropdown.id = 'folder-select-dropdown';
        dropdown.className = 'folder-select-dropdown';
        dropdown.innerHTML = `
            <div class="dropdown-header">Select Folder</div>
            ${this.folders.map(folder => `
                <div class="dropdown-item" data-folder-id="${folder.id}">${folder.name}</div>
            `).join('')}
            <div class="dropdown-item new-folder-item">+ New Folder</div>
        `;

        // Position near the object
        const objElement = document.querySelector(`.layer-item[data-object-id="${obj.id || ''}"]`);
        if (objElement) {
            const rect = objElement.getBoundingClientRect();
            dropdown.style.position = 'absolute';
            dropdown.style.left = `${rect.right + 10}px`;
            dropdown.style.top = `${rect.top}px`;
            document.body.appendChild(dropdown);

            // Add event listeners
            dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (item.classList.contains('new-folder-item')) {
                        const folderName = prompt('Enter folder name:', 'New Folder');
                        if (folderName) {
                            this.addFolder(folderName);
                            this.addObjectToFolder(this.folders[this.folders.length - 1].id, obj);
                        }
                    } else {
                        const folderId = item.dataset.folderId;
                        this.addObjectToFolder(folderId, obj);
                    }
                    dropdown.remove();
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }
    }

    // Delete a folder
    deleteFolder(folderId) {
        const folderIndex = this.folders.findIndex(f => f.id === folderId);
        if (folderIndex === -1) return;

        // Move all objects from folder back to main list
        const folder = this.folders[folderIndex];
        folder.objects.forEach(obj => {
            this.app.objects.push(obj);
        });

        // Remove folder
        this.folders.splice(folderIndex, 1);
        this.render();
    }

    // Logic to reorder objects in the Scene and the internal Array (for non-folder objects)
    reorderObject(obj, direction) {
        // Direction: 1 = Up (Visual Top), -1 = Down (Visual Bottom)
        const idx = this.app.objects.indexOf(obj);
        if (idx === -1) return;

        const newIdx = idx + direction;

        // Bounds check
        if (newIdx < 0 || newIdx >= this.app.objects.length) return;

        // Swap in our tracking array
        [this.app.objects[idx], this.app.objects[newIdx]] = [this.app.objects[newIdx], this.app.objects[idx]];

        // Update UI
        this.app.ui.updateUI(this.app.selectedObject);
    }
}