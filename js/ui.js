import * as THREE from 'three';
import { LAYER_PRESETS } from './layerMaterial.js';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb } from './colorUtils.js';
import { getMoveSpec } from './staging/shots/shotMoves.js';

export class UI {
    constructor(app) {
        this.app = app;
        this.propsContent = document.getElementById('props-content');
        this.hierarchyList = document.getElementById('hierarchy-list');
        this.layersList = this.hierarchyList;
        this.canvasContainer = document.getElementById('canvas-container');

        // Modal Elements
        this.modal = document.getElementById('ai-modal');
        this.promptInput = document.getElementById('ai-prompt-input');
        this.btnGenerate = document.getElementById('btn-ai-generate');
        this.btnCancel = document.getElementById('btn-ai-cancel');
        this.spinner = document.getElementById('ai-spinner');
        this.modalTitle = document.getElementById('modal-title-text');
        this.modalDesc = document.getElementById('modal-desc');

        // Settings Modal (using unified settings modal)
        this.settingsModal = document.getElementById('unified-settings-modal');
        this.settingsInitialized = false;

        // Scene Settings Modal
        this.sceneSettingsModal = document.getElementById('scene-settings-modal');
        this.sceneSettingsInitialized = false;

        // Asset Management System
        this.assets = {
            materials: [],
            textures: [],
            colors: [],
            images: [],
            media: [],
            audio: [],
            paletteGroups: [
                { name: 'Default', colors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'], collapsed: false },
                { name: 'StageCut', colors: ['#00ff41', '#ff006e', '#00d9ff', '#ffd700', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'], collapsed: false },
            ],
            activePaletteGroup: 0
        };
        try {
            const savedAssets = JSON.parse(localStorage.getItem('pixel3d-assets') || '{}');
            Object.keys(this.assets).forEach(category => {
                if (Array.isArray(savedAssets[category])) this.assets[category] = savedAssets[category];
                else if (savedAssets[category] !== undefined) this.assets[category] = savedAssets[category];
            });
        } catch (error) {
            console.warn('Could not load saved assets:', error);
        }
        this.assetIdCounter = 1;

        this.currentAIMode = 'scene';
    }

    init() {
        this.activeSubmenu = null; // Track currently open submenu
        const initializers = [
            ['event listeners', () => this.setupEventListeners()],
            ['saved settings', () => this.loadSettings()],
            ['panel tabs', () => this.setupPanelTabs()],
            ['floating camera controls', () => this.setupFloatingCameraControls()],
            ['camera nudge', () => this.setupCameraNudge()],
            ['scene list', () => this.setupSceneList()],
            ['color editor', () => this.setupColorEditor()],
            ['hierarchy', () => this.renderHierarchyPanel()],
            ['assets', () => this.renderAssetsPanel('colors')]
        ];

        initializers.forEach(([name, initialize]) => {
            try {
                initialize();
            } catch (error) {
                console.error(`Could not initialize UI ${name}:`, error);
            }
        });
    }

    setupEventListeners() {
        // Toolbar Clicks
        document.getElementById('tools-container').addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;

            // Handle Settings
            if (btn.id === 'tool-settings') {
                this.openSettingsModal();
                return;
            }

            // Handle AI Tool specifically
            if (btn.id === 'tool-ai-scene') {
                this.openAIModal('scene');
                return;
            }

            // Handle Animation Tool
            if (btn.id === 'tool-animate') {
                // Camera timeline - use enhanced ShotManager
                if (this.app.staging && this.app.staging.shotManager) {
                    this.app.staging.shotManager.toggleUI();
                    return;
                }
                // Fallback to legacy ShotBoard
                if (this.app.staging && this.app.staging.shots) {
                    this.app.staging.shots.toggleUI();
                    return;
                }
            }

            // Handle menu parent buttons - toggle submenu
            if (btn.classList.contains('menu-parent')) {
                this.toggleSubmenu(btn);
                return;
            }

            // Show panel if hidden when clicking action buttons
            const panel = document.getElementById('right-panel');
            if (panel && panel.classList.contains('hidden') && btn.dataset.action) {
                this.togglePropertiesPanel();
            }

            if (!btn.dataset.action) return;

            // Close any open submenus when performing an action
            this.closeAllSubmenus();

            // Remove active class from all tools
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');

            const action = btn.dataset.action;
            const type = btn.dataset.type;
            if (this.app[action]) {
                this.app[action](type);
            }
        });

        // Undo/Redo buttons
        document.getElementById('undoBtn').addEventListener('click', () => {
            if (this.app.undo) this.app.undo();
        });
        document.getElementById('redoBtn').addEventListener('click', () => {
            if (this.app.redo) this.app.redo();
        });

        // Main action buttons
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (this.app.clearScene) this.app.clearScene();
        });
        document.getElementById('btn-save').addEventListener('click', () => {
            if (this.app.fileManager) {
                this.app.fileManager.saveToBrowser();
                this.showNotification('Scene saved to browser!', 'success');
            }
        });
        document.getElementById('btn-export').addEventListener('click', async () => {
            if (this.app.fileManager) {
                await this.app.fileManager.saveScene();
            }
        });
        document.getElementById('btn-load').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            if (this.app.fileManager && e.target.files[0])
                this.app.fileManager.loadScene(e);
        });
        // Panel toggle button
        const panelToggle = document.getElementById('panel-toggle');
        if (panelToggle) {
            panelToggle.addEventListener('click', () => this.togglePropertiesPanel());
        }

        // Mode buttons
        document.getElementById('mode-hand').addEventListener('click', () => {
            if (this.app.setTransformMode) this.app.setTransformMode('hand');
        });
        document.getElementById('mode-translate').addEventListener('click', () => {
            if (this.app.setTransformMode) this.app.setTransformMode('translate');
        });
        document.getElementById('mode-rotate').addEventListener('click', () => {
            if (this.app.setTransformMode) this.app.setTransformMode('rotate');
        });
        document.getElementById('mode-scale').addEventListener('click', () => {
            if (this.app.setTransformMode) this.app.setTransformMode('scale');
        });

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.zoomCamera(1.2); // Zoom in
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.zoomCamera(0.8); // Zoom out
        });

        document.getElementById('zoom-slider').addEventListener('input', (e) => {
            const zoomLevel = parseFloat(e.target.value);
            this.setCameraZoom(zoomLevel);
        });

        // AI modal buttons
        this.btnGenerate.addEventListener('click', () => this.handleAIGenerate());
        this.btnCancel.addEventListener('click', () => this.closeAIModal());

        // AI modal close on overlay click
        document.getElementById('ai-modal').addEventListener('click', (e) => {
            if (e.target.id === 'ai-modal') this.closeAIModal();
        });

        // Close submenus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tools-panel')) {
                this.closeAllSubmenus();
            }
        });

        // Materials toolbar button
        document.getElementById('tool-materials')?.addEventListener('click', () => {
            this.scrollToSection('section-scene');
        });

        // Scene settings toolbar button - now opens scene panel in right menu
        document.getElementById('tool-scene-settings')?.addEventListener('click', () => {
            this.scrollToSection('section-scene');
        });

        // Particles toolbar button
        document.getElementById('tool-particles')?.addEventListener('click', () => {
            this.scrollToSection('section-scene');
        });

        // Physics toolbar button
        document.getElementById('tool-physics')?.addEventListener('click', () => {
            this.scrollToSection('section-scene');
        });

        // Settings toolbar button - now opens unified settings
        document.getElementById('tool-settings')?.addEventListener('click', () => {
            this.openUnifiedSettingsModal('general');
        });

        // Overlay toggle toolbar button
        document.getElementById('tool-toggle-overlays')?.addEventListener('click', () => {
            this.toggleAllOverlays();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Handle undo/redo shortcuts first
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (this.app.undo) this.app.undo();
                        return;
                    case 'y':
                        e.preventDefault();
                        if (this.app.redo) this.app.redo();
                        return;
                }
            }

            // Handle overlay toggle shortcut (Ctrl+Shift+O)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'o':
                        e.preventDefault();
                        this.toggleAllOverlays();
                        return;
                }
            }

            const key = e.key.toLowerCase();
            switch (key) {
                case 'q':
                    document.getElementById('tool-select').click();
                    break;
                case 'g':
                    document.getElementById('mode-translate').click();
                    break;
                case 'r':
                    document.getElementById('mode-rotate').click();
                    break;
                case 'h':
                    document.getElementById('mode-hand').click();
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (this.app.fileManager) {
                            this.app.fileManager.saveToBrowser();
                            this.showNotification('Scene saved to browser!', 'success');
                        }
                    } else {
                        document.getElementById('mode-scale').click();
                    }
                    break;
                case 'c':
                    if (this.app.clearScene) this.app.clearScene();
                    break;
                case 'escape':
                    if (this.app.deselect) this.app.deselect();
                    break;
                case 'o':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        document.getElementById('btn-load').click();
                    }
                    break;
                case 'x':
                    if (this.app.selectedObject && this.app.deleteSelected) {
                        this.app.deleteSelected();
                        this.showNotification('Object deleted!', 'success');
                    } else {
                        this.showNotification('No object selected to delete', 'info');
                    }
                    break;
            }
        });

        // Collapsible sections - support accordion mode within Scene panel
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);
                if (!content) return;

                const isScenePanel = header.closest('#section-scene');
                const isOpen = !content.classList.contains('hidden');

                if (isScenePanel && isOpen) {
                    // In accordion mode within Scene panel: only collapse, don't open another
                    header.classList.add('collapsed');
                    content.classList.add('hidden');
                } else if (isScenePanel && !isOpen) {
                    // Accordion: collapse all siblings, then open this one
                    const section = header.closest('#section-scene');
                    if (section) {
                        section.querySelectorAll('.collapsible-header').forEach(otherHeader => {
                            if (otherHeader !== header) {
                                otherHeader.classList.add('collapsed');
                                const otherId = otherHeader.dataset.target;
                                const otherContent = document.getElementById(otherId);
                                if (otherContent) otherContent.classList.add('hidden');
                            }
                        });
                    }
                    header.classList.remove('collapsed');
                    content.classList.remove('hidden');
                } else {
                    // Non-Scene-panel sections: toggle independently
                    header.classList.toggle('collapsed');
                    content.classList.toggle('hidden');
                }
            });
        });

        // Scene panel expand/collapse all buttons
        document.getElementById('scene-expand-all')?.addEventListener('click', () => {
            const section = document.getElementById('section-scene');
            if (!section) return;
            section.querySelectorAll('.collapsible-header').forEach(header => {
                header.classList.remove('collapsed');
                const content = document.getElementById(header.dataset.target);
                if (content) content.classList.remove('hidden');
            });
        });
        document.getElementById('scene-collapse-all')?.addEventListener('click', () => {
            const section = document.getElementById('section-scene');
            if (!section) return;
            section.querySelectorAll('.collapsible-header').forEach(header => {
                header.classList.add('collapsed');
                const content = document.getElementById(header.dataset.target);
                if (content) content.classList.add('hidden');
            });
        });

        // Right panel tabs
        document.querySelectorAll('.right-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.right-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const target = document.getElementById(`tab-${tab.dataset.rightTab}`);
                if (target) target.classList.add('active');

                if (tab.dataset.rightTab === 'assets') {
                    this.renderAssetsPanel('colors');
                } else if (tab.dataset.rightTab === 'hierarchy') {
                    this.renderHierarchyPanel();
                } else if (tab.dataset.rightTab === 'camera') {
                    this.setupCameraTab();
                } else if (tab.dataset.rightTab === 'shot-designer') {
                    this.setupShotDesignerTab();
                }
            });
        });

        // Asset tabs (inside right panel)
        document.querySelectorAll('#tab-assets .asset-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#tab-assets .asset-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderAssetsPanel(tab.dataset.assetTab);
            });
        });

        // Asset search (for colors tab)
        const assetSearch = document.getElementById('asset-search-input');
        if (assetSearch) {
            assetSearch.addEventListener('input', (e) => {
                const activeTab = document.querySelector('#tab-assets .asset-tab.active');
                this.renderAssetsPanel(activeTab?.dataset.assetTab || 'colors', e.target.value);
            });
        }

        // Palette controls (Colors tab)
        this.setupPaletteControls();
        
        // Polyfork 3D Models controls
        this.setupPolyforkControls();

        // Asset modal event listeners
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalType = btn.dataset.closeModal;
                const typeMap = {
                    'material-asset-modal': 'materials',
                    'texture-asset-modal': 'textures',
                    'color-asset-modal': 'colors',
                    'image-asset-modal': 'images',
                    'video-asset-modal': 'media',
                    'audio-asset-modal': 'audio'
                };
                const type = typeMap[modalType];
                if (type) this.closeAssetModal(type);
            });
        });

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-overlay');
                const modalType = modal?.id;
                const typeMap = {
                    'material-asset-modal': 'materials',
                    'texture-asset-modal': 'textures',
                    'color-asset-modal': 'colors',
                    'image-asset-modal': 'images',
                    'video-asset-modal': 'media',
                    'audio-asset-modal': 'audio'
                };
                const type = typeMap[modalType];
                if (type) this.closeAssetModal(type);
            });
        });

        // Save buttons
        const saveBtnMap = {
            'material-asset-save': 'materials',
            'texture-asset-save': 'textures',
            'color-asset-save': 'colors',
            'image-asset-save': 'images',
            'video-asset-save': 'media',
            'audio-asset-save': 'audio'
        };

        Object.entries(saveBtnMap).forEach(([btnId, type]) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.saveAsset(type));
            }
        });

        // Apply material to selection
        const applyBtn = document.getElementById('material-asset-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.saveAsset('materials');
                if (this.app.materialsManager) {
                    const modal = document.getElementById('material-asset-modal');
                    const editingId = modal.dataset.editingAssetId;
                    const asset = editingId ? this.getAsset('materials', editingId) : null;
                    if (asset) {
                        this.app.materialsManager.applyMaterialToSelected(asset);
                    }
                }
            });
        }

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modalType = overlay.id;
                    const typeMap = {
                        'material-asset-modal': 'materials',
                        'texture-asset-modal': 'textures',
                        'color-asset-modal': 'colors',
                        'image-asset-modal': 'images',
                        'video-asset-modal': 'media',
                        'audio-asset-modal': 'audio'
                    };
                    const type = typeMap[modalType];
                    if (type) this.closeAssetModal(type);
                }
            });
        });

        // Scene settings panel event listeners (right panel Scene tab)
        this.setupSceneSettingsListeners();
    }

    setupSceneSettingsListeners() {
        // Ambient light
        const ambientLight = document.getElementById('scene-ambient-light');
        if (ambientLight) {
            ambientLight.addEventListener('change', (e) => {
                this.app.setAmbientLight(e.target.checked);
            });
        }

        const ambientIntensity = document.getElementById('ambient-intensity');
        if (ambientIntensity) {
            ambientIntensity.addEventListener('input', (e) => {
                this.app.setAmbientIntensity?.(parseFloat(e.target.value));
            });
        }

        const ambientColor = document.getElementById('ambient-color');
        if (ambientColor) {
            ambientColor.addEventListener('input', (e) => {
                this.app.setAmbientColor?.(e.target.value);
            });
        }

        // Bloom
        const bloomEffect = document.getElementById('scene-bloom-effect');
        if (bloomEffect) {
            bloomEffect.addEventListener('change', (e) => {
                this.app.setBloom?.(e.target.checked);
            });
        }

        const bloomStrength = document.getElementById('bloom-strength');
        if (bloomStrength) {
            bloomStrength.addEventListener('input', (e) => {
                this.app.setBloomStrength?.(parseFloat(e.target.value));
            });
        }

        // Fog
        const fogEnabled = document.getElementById('fog-enabled');
        if (fogEnabled) {
            fogEnabled.addEventListener('change', (e) => {
                const color = document.getElementById('fog-color')?.value || '#1a1a2e';
                const near = parseFloat(document.getElementById('fog-near')?.value || '30');
                const far = parseFloat(document.getElementById('fog-far')?.value || '100');
                this.app.setFog(e.target.checked, color, near, far);
            });
        }

        const fogColor = document.getElementById('fog-color');
        if (fogColor) {
            fogColor.addEventListener('input', (e) => {
                const enabled = document.getElementById('fog-enabled')?.checked || false;
                const near = parseFloat(document.getElementById('fog-near')?.value || '30');
                const far = parseFloat(document.getElementById('fog-far')?.value || '100');
                this.app.setFog(enabled, e.target.value, near, far);
            });
        }

        const fogNear = document.getElementById('fog-near');
        if (fogNear) {
            fogNear.addEventListener('input', (e) => {
                const enabled = document.getElementById('fog-enabled')?.checked || false;
                const color = document.getElementById('fog-color')?.value || '#1a1a2e';
                const far = parseFloat(document.getElementById('fog-far')?.value || '100');
                this.app.setFog(enabled, color, parseFloat(e.target.value), far);
            });
        }

        const fogFar = document.getElementById('fog-far');
        if (fogFar) {
            fogFar.addEventListener('input', (e) => {
                const enabled = document.getElementById('fog-enabled')?.checked || false;
                const color = document.getElementById('fog-color')?.value || '#1a1a2e';
                const near = parseFloat(document.getElementById('fog-near')?.value || '30');
                this.app.setFog(enabled, color, near, parseFloat(e.target.value));
            });
        }

        // Sky
        const skyColor = document.getElementById('sky-color');
        if (skyColor) {
            skyColor.addEventListener('input', (e) => {
                const useGradient = document.getElementById('sky-gradient')?.checked ?? true;
                if (useGradient) {
                    this.app.setGradientBackground?.(e.target.value, document.getElementById('sky-color-bottom')?.value || '#0f0f1b');
                } else {
                    this.app.setBackgroundColor(e.target.value);
                }
            });
        }

        const skyBottom = document.getElementById('sky-color-bottom');
        if (skyBottom) {
            skyBottom.addEventListener('input', (e) => {
                const useGradient = document.getElementById('sky-gradient')?.checked ?? true;
                if (useGradient) {
                    this.app.setGradientBackground?.(
                        document.getElementById('sky-color')?.value || '#2a2a4e',
                        e.target.value
                    );
                }
            });
        }

        const skyGradient = document.getElementById('sky-gradient');
        if (skyGradient) {
            skyGradient.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.app.setGradientBackground?.(document.getElementById('sky-color')?.value || '#2a2a4e', document.getElementById('sky-color-bottom')?.value || '#0f0f1b');
                } else {
                    this.app.setBackgroundColor(document.getElementById('sky-color')?.value || '#2a2a4e');
                }
            });
        }
    }

    setupPaletteControls() {
        // Save current color to palette
        const saveColorBtn = document.getElementById('saveColorBtn');
        if (saveColorBtn) {
            saveColorBtn.addEventListener('click', () => {
                const color = document.getElementById('colorPicker')?.value || '#00ff41';
                this.saveColorToPalette(color);
                this.showNotification('Color saved to palette!', 'success');
            });
        }

        // Import palette from Coolors URL
        const importPaletteUrlBtn = document.getElementById('importPaletteUrlBtn');
        if (importPaletteUrlBtn) {
            importPaletteUrlBtn.addEventListener('click', () => {
                const url = prompt('Enter Coolors URL (e.g., https://coolors.co/daffed-9bf3f0-473198-4a0d67-adfc92):');
                if (url) {
                    this.importPaletteFromUrl(url.trim());
                    this.showNotification('Palette imported!', 'success');
                }
            });
        }

        // Add new palette group
        const addPaletteGroupBtn = document.getElementById('addPaletteGroupBtn');
        if (addPaletteGroupBtn) {
            addPaletteGroupBtn.addEventListener('click', () => {
                const name = prompt('Enter palette group name:', `Palette ${this.assets.colors.length + 1}`);
                if (name) {
                    this.addPaletteGroup(name);
                }
            });
        }

        // Color picker sync
        const colorPicker = document.getElementById('colorPicker');
        const colorHex = document.getElementById('colorHex');
        if (colorPicker && colorHex) {
            colorPicker.addEventListener('input', (e) => {
                colorHex.value = e.target.value;
                this.app.applyColorToSelected?.(e.target.value);
            });
            colorHex.addEventListener('input', (e) => {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    colorPicker.value = e.target.value;
                    this.app.applyColorToSelected?.(e.target.value);
                }
            });
        }
    }

    async setupPolyforkControls() {
        // Initialize polyfork importer if not exists
        if (!this.app.polyforkImporter) {
            const { PolyforkImporter } = await import('./staging/assets/polyforkImporter.js');
            this.app.polyforkImporter = new PolyforkImporter(this.app);
        }

        const searchInput = document.getElementById('polyfork-search');
        const loadMoreBtn = document.getElementById('polyfork-load-more');
        const resultsContainer = document.getElementById('polyfork-results');

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchPolyforkModels(e.target.value);
                }, 300);
            });
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMorePolyforkModels());
        }

        // Load lazily when the 3D Models tab is opened, not on app startup.
    }

    async searchPolyforkModels(query) {
        const importer = this.app.polyforkImporter;
        if (!importer) return;

        const resultsContainer = document.getElementById('polyfork-results');
        const loadingEl = document.getElementById('polyfork-loading');
        const loadMoreBtn = document.getElementById('polyfork-load-more');

        if (loadingEl) loadingEl.style.display = 'flex';
        if (resultsContainer) resultsContainer.innerHTML = '';

        try {
            const models = await importer.searchModels(query);
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (loadMoreBtn) loadMoreBtn.style.display = importer.hasMore ? 'block' : 'none';

            if (models.length === 0) {
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="polyfork-empty">No free models found. Try a different search.</div>';
                }
                return;
            }

            if (resultsContainer) {
                models.forEach(model => {
                    const card = PolyforkImporter.createModelCard(model, async (selectedModel) => {
                        this.showNotification(`Importing ${selectedModel.name}...`, 'info');
                        const object = await importer.importModel(selectedModel.id);
                        if (object) {
                            this.app.addToScene(object);
                            this.app.selectObject(object);
                            this.showNotification(`Imported ${selectedModel.name}`, 'success');
                        }
                    });
                    resultsContainer.appendChild(card);
                });
            }
        } catch (error) {
            if (loadingEl) loadingEl.style.display = 'none';
            console.error('Polyfork search error:', error);
            this.showNotification('Failed to search models', 'error');
        }
    }

    async loadMorePolyforkModels() {
        const importer = this.app.polyforkImporter;
        if (!importer) return;

        const loadingEl = document.getElementById('polyfork-loading');
        const loadMoreBtn = document.getElementById('polyfork-load-more');
        const resultsContainer = document.getElementById('polyfork-results');

        if (loadingEl) loadingEl.style.display = 'flex';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';

        try {
            const models = await importer.loadMore();
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (loadMoreBtn) loadMoreBtn.style.display = importer.hasMore ? 'block' : 'none';

            if (resultsContainer) {
                models.forEach(model => {
                    const card = PolyforkImporter.createModelCard(model, async (selectedModel) => {
                        this.showNotification(`Importing ${selectedModel.name}...`, 'info');
                        const object = await importer.importModel(selectedModel.id);
                        if (object) {
                            this.app.addToScene(object);
                            this.app.selectObject(object);
                            this.showNotification(`Imported ${selectedModel.name}`, 'success');
                        }
                    });
                    resultsContainer.appendChild(card);
                });
            }
        } catch (error) {
            if (loadingEl) loadingEl.style.display = 'none';
            console.error('Polyfork load more error:', error);
            this.showNotification('Failed to load more models', 'error');
        }
    }
    enableDragAdjust(input) {
        if (!input || input.type !== 'number') return;

        let startX = 0;
        let startValue = 0;
        let isDragging = false;

        const getStep = () => {
            const step = parseFloat(input.step);
            return step > 0 ? step : 0.1;
        };

        input.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startValue = parseFloat(input.value) || 0;
            input.style.cursor = 'ew-resize';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging || input !== document.activeElement) return;
            e.preventDefault();

            const deltaX = e.clientX - startX;
            const step = getStep();
            const sensitivity = step * 0.1;
            const newValue = startValue + deltaX * sensitivity;

            input.value = newValue.toFixed(2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                input.style.cursor = '';
            }
        });
    }

    enableDragAdjustForContainer(container) {
        if (!container) return;
        container.querySelectorAll('input[type="number"]').forEach(input => {
            this.enableDragAdjust(input);
        });
    }

    // --- SETTINGS MODAL ---
    openSettingsModal() {
        // Redirect to unified settings modal
        this.openUnifiedSettingsModal('general');
    }

    closeSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.classList.remove('open');
        }
    }

    // Toggle all overlays (grid, axes, helpers)
    toggleAllOverlays() {
        // Get current state of grid visibility
        let gridVisible = false;
        let axesVisible = false;

        this.app.scene.traverse(obj => {
            if (obj.type === 'GridHelper') gridVisible = obj.visible;
            if (obj.type === 'AxesHelper') axesVisible = obj.visible;
        });

        // Determine if we should show or hide all overlays
        const shouldShow = !gridVisible || !axesVisible;

        // Toggle grid
        if (this.app.setGridVisible) this.app.setGridVisible(shouldShow);

        // Toggle axes
        if (this.app.setAxesVisible) this.app.setAxesVisible(shouldShow);

        // Toggle other helpers (light helpers, etc.)
        this.app.scene.traverse(obj => {
            if (obj.type === 'LightHelper' || obj.type === 'CameraHelper' ||
                obj.type === 'DirectionalLightHelper' || obj.type === 'PointLightHelper' ||
                obj.type === 'SpotLightHelper' || obj.type === 'HemisphereLightHelper' ||
                obj.type.includes('LightHelper')) {
                obj.visible = shouldShow;
            }
        });

        // Update button active state
        const overlayBtn = document.getElementById('tool-toggle-overlays');
        if (overlayBtn) {
            if (shouldShow) {
                overlayBtn.classList.add('active');
                overlayBtn.querySelector('i').className = 'fas fa-eye';
            } else {
                overlayBtn.classList.remove('active');
                overlayBtn.querySelector('i').className = 'fas fa-eye-slash';
            }
        }

        // Show notification
        const action = shouldShow ? 'shown' : 'hidden';
        this.showNotification(`All overlays ${action}`, 'success');
    }

    // --- SCENE SETTINGS MODAL ---
    openSceneSettingsModal() {
        if (!this.sceneSettingsInitialized) {
            this.initSceneSettingsModal();
            this.sceneSettingsInitialized = true;
        }
        this.loadSceneSettingsToUI();
        this.sceneSettingsModal.classList.add('open');
    }

    closeSceneSettingsModal() {
        this.sceneSettingsModal.classList.remove('open');
    }

    initSceneSettingsModal() {
        // Initialize scene settings modal
        this.sceneSettingsModal = document.getElementById('scene-settings-modal');

        // Close button
        const closeBtn = document.getElementById('btn-scene-settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSceneSettingsModal());
        }

        // Reset button
        const resetBtn = document.getElementById('btn-scene-settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSceneSettings();
            });
        }

        // Apply button
        const applyBtn = document.getElementById('btn-scene-settings-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applySceneSettings();
                this.closeSceneSettingsModal();
            });
        }

        // Resolution dropdown change handler
        const resolutionDropdown = document.getElementById('setting-export-resolution');
        if (resolutionDropdown) {
            resolutionDropdown.addEventListener('change', (e) => {
                const customGroup = document.getElementById('custom-resolution-group');
                if (e.target.value === 'custom') {
                    customGroup.style.display = 'block';
                } else {
                    customGroup.style.display = 'none';
                }
            });
        }

        // Close on overlay click
        this.sceneSettingsModal.addEventListener('click', (e) => {
            if (e.target.id === 'scene-settings-modal') this.closeSceneSettingsModal();
        });
    }

    resetSceneSettings() {
        // Reset to default values from config or use hardcoded defaults
        const defaults = (typeof APP_DEFAULTS !== 'undefined' && APP_DEFAULTS.sceneDefaults)
            ? APP_DEFAULTS.sceneDefaults
            : {
                backgroundEnabled: true,
                backgroundColor: '#1a1a2e',
                backgroundGradient: false,
                gradientTop: '#1a1a2e',
                gradientBottom: '#0f0f1b',
                fogEnabled: false,
                fogColor: '#1a1a2e',
                fogNear: 20,
                fogFar: 100,
                fogMatchBg: false,
                ambientLight: true,
                ambientColor: '#ffffff',
                exportTransparent: false,
                exportResolution: '1920x1080',
                customWidth: 1920,
                customHeight: 1080
            };

        // Apply defaults to UI
        document.getElementById('setting-background-enabled').checked = defaults.backgroundEnabled;
        document.getElementById('setting-background-color').value = defaults.backgroundColor;
        document.getElementById('setting-background-gradient').checked = defaults.backgroundGradient || false;
        document.getElementById('setting-gradient-top').value = defaults.gradientTop || '#1a1a2e';
        document.getElementById('setting-gradient-bottom').value = defaults.gradientBottom || '#0f0f1b';
        document.getElementById('setting-fog-enabled').checked = defaults.fogEnabled || false;
        document.getElementById('setting-fog-color').value = defaults.fogColor || '#1a1a2e';
        document.getElementById('setting-fog-near').value = defaults.fogNear || 20;
        document.getElementById('setting-fog-far').value = defaults.fogFar || 100;
        document.getElementById('setting-fog-match-bg').checked = defaults.fogMatchBg || false;
        document.getElementById('setting-ambient-light').checked = defaults.ambientLight;
        document.getElementById('setting-ambient-color').value = defaults.ambientColor;
        document.getElementById('setting-export-transparent').checked = defaults.exportTransparent;
        document.getElementById('setting-export-resolution').value = defaults.exportResolution;
        document.getElementById('setting-custom-width').value = defaults.customWidth;
        document.getElementById('setting-custom-height').value = defaults.customHeight;

        // Update slider value displays
        const fogNearValue = document.getElementById('fog-near-value');
        const fogFarValue = document.getElementById('fog-far-value');
        if (fogNearValue) fogNearValue.textContent = defaults.fogNear || 20;
        if (fogFarValue) fogFarValue.textContent = defaults.fogFar || 100;

        // Hide custom resolution group if not custom
        document.getElementById('custom-resolution-group').style.display = 'none';

        // Apply defaults to canvas scene
        if (this.app.setBackgroundColor) {
            this.app.setBackgroundColor(defaults.backgroundColor);
        }

        if (this.app.setFog) {
            this.app.setFog(false, defaults.fogColor, defaults.fogNear, defaults.fogFar);
        }

        this.showNotification('Scene settings reset to defaults!', 'success');
    }

    loadSceneSettingsToUI() {
        const saved = localStorage.getItem('pixel3d-scene-settings');
        if (saved) {
            const settings = JSON.parse(saved);

            // Set UI values
            const bgEnabledEl = document.getElementById('setting-background-enabled');
            const bgColorEl = document.getElementById('setting-background-color');
            const bgGradientEl = document.getElementById('setting-background-gradient');
            const gradientTopEl = document.getElementById('setting-gradient-top');
            const gradientBottomEl = document.getElementById('setting-gradient-bottom');
            const fogEnabledEl = document.getElementById('setting-fog-enabled');
            const fogColorEl = document.getElementById('setting-fog-color');
            const fogNearEl = document.getElementById('setting-fog-near');
            const fogFarEl = document.getElementById('setting-fog-far');
            const fogMatchBgEl = document.getElementById('setting-fog-match-bg');
            const fogNearValue = document.getElementById('fog-near-value');
            const fogFarValue = document.getElementById('fog-far-value');
            const ambientEl = document.getElementById('setting-ambient-light');
            const ambientColorEl = document.getElementById('setting-ambient-color');
            const transparentEl = document.getElementById('setting-export-transparent');
            const resolutionEl = document.getElementById('setting-export-resolution');
            const customWidthEl = document.getElementById('setting-custom-width');
            const customHeightEl = document.getElementById('setting-custom-height');

            if (bgEnabledEl) bgEnabledEl.checked = settings.backgroundEnabled !== false;
            if (bgColorEl) bgColorEl.value = settings.backgroundColor || '#1a1a2e';
            if (bgGradientEl) bgGradientEl.checked = settings.backgroundGradient || false;
            if (gradientTopEl) gradientTopEl.value = settings.gradientTop || '#1a1a2e';
            if (gradientBottomEl) gradientBottomEl.value = settings.gradientBottom || '#0f0f1b';
            if (fogEnabledEl) fogEnabledEl.checked = settings.fogEnabled || false;
            if (fogColorEl) fogColorEl.value = settings.fogColor || '#1a1a2e';
            if (fogNearEl) fogNearEl.value = settings.fogNear || 20;
            if (fogFarEl) fogFarEl.value = settings.fogFar || 100;
            if (fogMatchBgEl) fogMatchBgEl.checked = settings.fogMatchBg || false;
            if (fogNearValue) fogNearValue.textContent = settings.fogNear || 20;
            if (fogFarValue) fogFarValue.textContent = settings.fogFar || 100;
            if (ambientEl) ambientEl.checked = settings.ambientLight !== false;
            if (ambientColorEl) ambientColorEl.value = settings.ambientColor || '#ffffff';
            if (transparentEl) transparentEl.checked = settings.exportTransparent !== false;
            if (resolutionEl) resolutionEl.value = settings.exportResolution || '1920x1080';
            if (customWidthEl) customWidthEl.value = settings.customWidth || 1920;
            if (customHeightEl) customHeightEl.value = settings.customHeight || 1080;

            // Update custom resolution group visibility
            const customGroup = document.getElementById('custom-resolution-group');
            if (customGroup && resolutionEl) {
                customGroup.style.display = resolutionEl.value === 'custom' ? 'block' : 'none';
            }
        }
    }

    applySceneSettings() {
        const settings = {
            backgroundEnabled: document.getElementById('setting-background-enabled')?.checked ?? true,
            backgroundColor: document.getElementById('setting-background-color')?.value ?? '#1a1a2e',
            backgroundGradient: document.getElementById('setting-background-gradient')?.checked ?? false,
            gradientTop: document.getElementById('setting-gradient-top')?.value ?? '#1a1a2e',
            gradientBottom: document.getElementById('setting-gradient-bottom')?.value ?? '#0f0f1b',
            fogEnabled: document.getElementById('setting-fog-enabled')?.checked ?? false,
            fogColor: document.getElementById('setting-fog-color')?.value ?? '#1a1a2e',
            fogNear: parseInt(document.getElementById('setting-fog-near')?.value ?? 30),
            fogFar: parseInt(document.getElementById('setting-fog-far')?.value ?? 100),
            fogMatchBg: document.getElementById('setting-fog-match-bg')?.checked ?? false,
            ambientLight: document.getElementById('setting-ambient-light')?.checked ?? true,
            ambientColor: document.getElementById('setting-ambient-color')?.value ?? '#ffffff',
            exportTransparent: document.getElementById('setting-export-transparent')?.checked ?? false,
            exportResolution: document.getElementById('setting-export-resolution')?.value ?? '1920x1080',
            customWidth: parseInt(document.getElementById('setting-custom-width')?.value ?? 1920),
            customHeight: parseInt(document.getElementById('setting-custom-height')?.value ?? 1080),
            exportIncludeLights: document.getElementById('export-include-lights')?.checked ?? true
        };

        // Save settings
        localStorage.setItem('pixel3d-scene-settings', JSON.stringify(settings));

        // Apply background settings
        if (settings.backgroundGradient) {
            if (this.app.setGradientBackground) {
                this.app.setGradientBackground(settings.gradientTop, settings.gradientBottom);
            }
        } else if (this.app.setBackgroundColor) {
            this.app.setBackgroundColor(settings.backgroundEnabled ? settings.backgroundColor : null);
        }

        // Apply fog settings
        const fogColor = settings.fogMatchBg ? settings.backgroundColor : settings.fogColor;
        if (this.app.setFog) {
            this.app.setFog(settings.fogEnabled, fogColor, settings.fogNear, settings.fogFar);
        }

        // Apply ambient light
        if (this.app.setAmbientLight) {
            this.app.setAmbientLight(settings.ambientLight, settings.ambientColor);
        }

        // Store export settings for later use (including the new light flag)
        window.exportSettings = {
            transparent: settings.exportTransparent,
            resolution: settings.exportResolution,
            customWidth: settings.customWidth,
            customHeight: settings.customHeight,
            includeLights: settings.exportIncludeLights
        };

        this.showNotification('Scene settings applied successfully!', 'success');
    }

    scrollToSection(sectionId) {
        const panel = document.getElementById('right-panel');
        if (panel && panel.classList.contains('hidden')) {
            this.togglePropertiesPanel();
        }

        const section = document.getElementById(sectionId);
        if (!section) return;

        const panelScroll = panel.querySelector('.right-panel-scroll');
        if (!panelScroll) return;

        const panelRect = panel.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        const offset = sectionRect.top - panelRect.top + panelScroll.scrollTop - 10;

        panelScroll.scrollTo({
            top: offset,
            behavior: 'smooth'
        });

        // Initialize section content if needed
        if (sectionId === 'section-materials' && this.app.materialsManager) {
            this.app.materialsManager.renderMaterialsSection();
        } else if (sectionId === 'section-scene') {
            this.initSceneExport();
        } else if (sectionId === 'section-aframe') {
            this.initAFrameExport();
        } else if (sectionId === 'section-particles') {
            this.initParticleSystems();
        } else if (sectionId === 'section-physics') {
            this.initPhysicsControls();
        }

        // Enable drag-to-adjust for number inputs in this section
        this.enableDragAdjustForContainer(section);
    }

    setupPanelTabs() {
        // Add event listeners for panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                // Remove active class from all tabs and content
                document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel-tab-content').forEach(content => content.classList.remove('active'));

                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.querySelector(`.panel-tab-content[data-tab-content="${tabId}"]`).classList.add('active');

                // Update layer manager if switching to scene objects tab
                if (tabId === 'scene-objects' && this.app.layerManager) {
                    this.app.layerManager.render();
                }
            });
        });
    }

    renderHierarchyPanel() {
        const container = document.getElementById('hierarchy-list');
        if (!container) return;

        container.innerHTML = '';

        if (!this.app.layerManager) return;

        // Use layer manager to render into the new hierarchy container
        const originalContainer = this.app.layerManager.container;
        this.app.layerManager.container = container;
        this.app.layerManager.render();
        this.app.layerManager.container = originalContainer;
    }

    generateMaterialPreview(colorHex, metalness = 0.2, roughness = 0.3, opacity = 1, clearcoat = 0, transmission = 0, sheen = 0, alpha = 1, size = 96, layers = null) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        let r = 136, g = 136, b = 136;
        if (typeof colorHex === 'string' && colorHex) {
            if (colorHex.startsWith('#')) {
                const hex = colorHex.replace('#', '');
                if (hex.length === 3) {
                    r = parseInt(hex[0] + hex[0], 16);
                    g = parseInt(hex[1] + hex[1], 16);
                    b = parseInt(hex[2] + hex[2], 16);
                } else if (hex.length >= 6) {
                    r = parseInt(hex.substr(0, 2), 16);
                    g = parseInt(hex.substr(2, 2), 16);
                    b = parseInt(hex.substr(4, 2), 16);
                }
            } else {
                const match = colorHex.match(/[\d.]+/g);
                if (match && match.length >= 3) {
                    r = parseInt(match[0], 10);
                    g = parseInt(match[1], 10);
                    b = parseInt(match[2], 10);
                }
            }
        }

        const clamp = (v) => Math.max(0, Math.min(255, v));
        const normalize = (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
        };
        const normalizeOpacity = (value) => {
            const number = Number(value);
            if (!Number.isFinite(number)) return 1;
            const normalized = number > 1 ? number / 100 : number;
            return Math.max(0, Math.min(1, normalized));
        };
        const metal = normalize(metalness);
        const rough = normalize(roughness);
        const opacityLevel = normalizeOpacity(opacity);
        const coat = normalize(clearcoat);
        const transmit = normalize(transmission);
        const sheenLevel = normalize(sheen);
        const alphaLevel = normalize(alpha);
        const effectiveAlpha = opacityLevel * alphaLevel;

        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.36;

        const sphere = document.createElement('canvas');
        sphere.width = sphere.height = size;
        const sctx = sphere.getContext('2d');

        let baseColor = `rgb(${r}, ${g}, ${b})`;

        if (layers && layers.length > 0) {
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = layerCanvas.height = 256;
            const lctx = layerCanvas.getContext('2d');
            lctx.fillStyle = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
            lctx.fillRect(0, 0, 256, 256);
            const composite = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen', overlay: 'overlay' };

            const drawLayer = (layer) => {
                if (layer.enabled === false) return;
                lctx.save();
                lctx.globalAlpha = (layer.opacity ?? 100) / 100;
                lctx.globalCompositeOperation = composite[layer.blendMode] || 'source-over';
                const lsize = Math.max(1, Number(layer.scale) || 8);
                if (layer.type === 'color') {
                    lctx.fillStyle = layer.color || '#888888'; lctx.fillRect(0, 0, 256, 256);
                } else if (layer.type === 'gradient' || layer.type === 'rainbow') {
                    const angle = (Number(layer.angle) || 0) * Math.PI / 180;
                    const dx = Math.cos(angle) * 128, dy = Math.sin(angle) * 128;
                    const gradient = lctx.createLinearGradient(128 - dx, 128 - dy, 128 + dx, 128 + dy);
                    if (layer.type === 'rainbow') {
                        ['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000'].forEach((color, index, all) => gradient.addColorStop(index / (all.length - 1), color));
                    } else {
                        gradient.addColorStop(0, layer.colorA || '#111827'); gradient.addColorStop(1, layer.colorB || '#8b5cf6');
                    }
                    lctx.fillStyle = gradient; lctx.fillRect(0, 0, 256, 256);
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
                    noiseContext.putImageData(image, 0, 0); lctx.drawImage(noiseCanvas, 0, 0);
                } else if (layer.type === 'pattern' || layer.type === 'duct') {
                    lctx.fillStyle = layer.colorB || '#eeeeee'; lctx.fillRect(0, 0, 256, 256); lctx.fillStyle = layer.colorA || '#111111';
                    const pattern = layer.type === 'duct' ? 'stripes' : (layer.pattern || 'checker');
                    for (let y=0; y<256; y+=lsize) for (let x=0; x<256; x+=lsize) {
                        if (pattern === 'dots') { lctx.beginPath(); lctx.arc(x+lsize/2,y+lsize/2,lsize/4,0,Math.PI*2); lctx.fill(); }
                        else if (pattern === 'stripes') { if ((x/lsize)%2===0) lctx.fillRect(x,0,lsize,256); }
                        else if (((x+y)/lsize)%2===0) lctx.fillRect(x,y,lsize,lsize);
                    }
                } else if (layer.type === 'image' && layer.url) {
                    const img = new Image(); img.crossOrigin = 'anonymous';
                    img.src = layer.url;
                }
                lctx.restore();
            };

            for (const layer of layers) {
                if (layer.enabled !== false) {
                    drawLayer(layer);
                }
            }

            const pattern = sctx.createPattern(layerCanvas, 'no-repeat');
            if (pattern) {
                sctx.fillStyle = pattern;
                sctx.fillRect(0, 0, size, size);
            } else {
                const baseGrad = sctx.createRadialGradient(
                    cx - radius * 0.45, cy - radius * 0.45, radius * 0.08,
                    cx, cy, radius
                );
                const lightBoost = 1 + (1 - rough) * 0.35;
                const darkFactor = 0.25 + rough * 0.35;
                baseGrad.addColorStop(0, `rgb(${clamp(r * lightBoost)}, ${clamp(g * lightBoost)}, ${clamp(b * lightBoost)})`);
                baseGrad.addColorStop(0.55, `rgb(${r}, ${g}, ${b})`);
                baseGrad.addColorStop(1, `rgb(${clamp(r * darkFactor)}, ${clamp(g * darkFactor)}, ${clamp(b * darkFactor)})`);
                sctx.beginPath();
                sctx.arc(cx, cy, radius, 0, Math.PI * 2);
                sctx.fillStyle = baseGrad;
                sctx.fill();
            }
        } else {
            const baseGrad = sctx.createRadialGradient(
                cx - radius * 0.45, cy - radius * 0.45, radius * 0.08,
                cx, cy, radius
            );
            const lightBoost = 1 + (1 - rough) * 0.35;
            const darkFactor = 0.25 + rough * 0.35;
            baseGrad.addColorStop(0, `rgb(${clamp(r * lightBoost)}, ${clamp(g * lightBoost)}, ${clamp(b * lightBoost)})`);
            baseGrad.addColorStop(0.55, `rgb(${r}, ${g}, ${b})`);
            baseGrad.addColorStop(1, `rgb(${clamp(r * darkFactor)}, ${clamp(g * darkFactor)}, ${clamp(b * darkFactor)})`);
            sctx.beginPath();
            sctx.arc(cx, cy, radius, 0, Math.PI * 2);
            sctx.fillStyle = baseGrad;
            sctx.fill();
        }

        const specStrength = Math.min(1, (1 - rough * 0.85) * (0.3 + metal * 0.7) + coat * 0.25);
        const specRadius = radius * (0.16 + rough * 0.42 - coat * 0.04);
        const specX = cx - radius * 0.38;
        const specY = cy - radius * 0.42;
        const specGrad = sctx.createRadialGradient(specX, specY, 0, specX, specY, specRadius);
        const specR = clamp(200 + (r - 200) * metal * 0.5);
        const specG = clamp(200 + (g - 200) * metal * 0.5);
        const specB = clamp(200 + (b - 200) * metal * 0.5);
        specGrad.addColorStop(0, `rgba(${specR}, ${specG}, ${specB}, ${specStrength})`);
        specGrad.addColorStop(1, `rgba(${specR}, ${specG}, ${specB}, 0)`);
        sctx.beginPath();
        sctx.arc(cx, cy, radius, 0, Math.PI * 2);
        sctx.save();
        sctx.clip();
        sctx.fillStyle = specGrad;
        sctx.fillRect(0, 0, size, size);
        sctx.restore();

        if (coat > 0) {
            const coatGrad = sctx.createRadialGradient(specX + radius * 0.16, specY + radius * 0.12, 0, specX + radius * 0.16, specY + radius * 0.12, radius * (0.18 + rough * 0.12));
            coatGrad.addColorStop(0, `rgba(255,255,255,${0.35 * coat * (1 - rough * 0.45)})`);
            coatGrad.addColorStop(1, 'rgba(255,255,255,0)');
            sctx.beginPath();
            sctx.arc(cx, cy, radius, 0, Math.PI * 2);
            sctx.save();
            sctx.clip();
            sctx.fillStyle = coatGrad;
            sctx.fillRect(0, 0, size, size);
            sctx.restore();
        }

        if (transmit > 0) {
            const glassGrad = sctx.createRadialGradient(cx - radius * 0.28, cy - radius * 0.3, 0, cx, cy, radius);
            glassGrad.addColorStop(0, `rgba(255,255,255,${0.35 * transmit})`);
            glassGrad.addColorStop(0.55, `rgba(255,255,255,${0.08 * transmit})`);
            glassGrad.addColorStop(1, `rgba(255,255,255,${0.18 * transmit})`);
            sctx.beginPath();
            sctx.arc(cx, cy, radius, 0, Math.PI * 2);
            sctx.save();
            sctx.clip();
            sctx.fillStyle = glassGrad;
            sctx.fillRect(0, 0, size, size);
            sctx.restore();
        }

        if (sheenLevel > 0) {
            const sheenGrad = sctx.createRadialGradient(cx, cy, radius * 0.58, cx, cy, radius);
            sheenGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
            sheenGrad.addColorStop(0.82, `rgba(${r}, ${g}, ${b}, ${0.18 * sheenLevel})`);
            sheenGrad.addColorStop(1, `rgba(${clamp(r * 1.35)}, ${clamp(g * 1.35)}, ${clamp(b * 1.35)}, ${0.28 * sheenLevel})`);
            sctx.beginPath();
            sctx.arc(cx, cy, radius, 0, Math.PI * 2);
            sctx.save();
            sctx.clip();
            sctx.fillStyle = sheenGrad;
            sctx.fillRect(0, 0, size, size);
            sctx.restore();
        }

        const rimGrad = sctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
        rimGrad.addColorStop(0, 'rgba(255,255,255,0)');
        rimGrad.addColorStop(0.85, `rgba(255,255,255,${0.05 + (1 - rough) * 0.12})`);
        rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
        sctx.beginPath();
        sctx.arc(cx, cy, radius, 0, Math.PI * 2);
        sctx.save();
        sctx.clip();
        sctx.fillStyle = rimGrad;
        sctx.fillRect(0, 0, size, size);
        sctx.restore();

        const square = size / 4;
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a35' : '#1c1c24';
                ctx.fillRect(x * square, y * square, square, square);
            }
        }

        ctx.save();
        ctx.globalAlpha = effectiveAlpha;
        ctx.drawImage(sphere, 0, 0);
        ctx.restore();

        return canvas.toDataURL('image/png');
    }

    renderComponentsPanel() {
        const container = document.getElementById('assets-list');
        if (!container) return;

        const particlePresets = ['fire', 'smoke', 'sparkle', 'rain', 'snow', 'explosion'];

        container.innerHTML = `
            <div class="component-section">
                <div class="component-section-header">
                    <i class="fas fa-cube"></i> Components
                </div>

                <!-- Particle Component -->
                <div class="component-card" data-component="particle">
                    <div class="component-card-header">
                        <span class="component-card-title">Particle System</span>
                        <button class="component-toggle" data-component="particle">▼</button>
                    </div>
                    <div class="component-card-content">
                        <div class="property-group">
                            <label class="property-label">Preset</label>
                            <select id="particle-preset-select" class="property-select">
                                ${particlePresets.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-sm" id="btn-add-particle" style="width: 100%;">Add Particle System</button>
                    </div>
                </div>

                <!-- Rigid Body Component -->
                <div class="component-card" data-component="rigidbody">
                    <div class="component-card-header">
                        <span class="component-card-title">Rigid Body</span>
                        <button class="component-toggle" data-component="rigidbody">▼</button>
                    </div>
                    <div class="component-card-content">
                        <div class="property-group">
                            <label class="property-label">Body Type</label>
                            <select id="physics-body-type" class="property-select">
                                <option value="2">Dynamic</option>
                                <option value="0">Static</option>
                                <option value="1">Kinematic</option>
                            </select>
                        </div>
                        <div class="property-group">
                            <label class="property-label">Mass: <span id="physics-mass-value">1.0</span></label>
                            <input type="range" id="physics-mass" min="0" max="10" step="0.1" value="1">
                        </div>
                        <button class="btn btn-sm" id="btn-apply-physics" style="width: 100%;">Add Physics Body</button>
                    </div>
                </div>

                <!-- Collider Component -->
                <div class="component-card" data-component="collider">
                    <div class="component-card-header">
                        <span class="component-card-title">Collider</span>
                        <button class="component-toggle" data-component="collider">▼</button>
                    </div>
                    <div class="component-card-content">
                        <div class="property-group">
                            <label class="property-label">Shape</label>
                            <select id="collider-shape" class="property-select">
                                <option value="auto">Auto (from geometry)</option>
                                <option value="box">Box</option>
                                <option value="sphere">Sphere</option>
                                <option value="cylinder">Cylinder</option>
                            </select>
                        </div>
                        <div class="property-group">
                            <label class="property-label">Is Trigger (Sensor)</label>
                            <input type="checkbox" id="collider-sensor" checked>
                        </div>
                        <div class="property-group">
                            <label class="property-label">Friction: <span id="collider-friction-value">0.5</span></label>
                            <input type="range" id="collider-friction" min="0" max="1" step="0.01" value="0.5">
                        </div>
                        <button class="btn btn-sm" id="btn-apply-collider" style="width: 100%;">Add Collider</button>
                    </div>
                </div>
            </div>
        `;

        this.setupComponentToggles();
        this.setupComponentButtons();
    }

    setupComponentToggles() {
        const toggles = document.querySelectorAll('.component-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const compId = toggle.getAttribute('data-component');
                const card = toggle.closest('.component-card');
                const content = card.querySelector('.component-card-content');
                if (content.classList.contains('collapsed')) {
                    content.classList.remove('collapsed');
                    toggle.textContent = '▼';
                } else {
                    content.classList.add('collapsed');
                    toggle.textContent = '▶';
                }
            });
        });
    }

    setupComponentButtons() {
        const addParticleBtn = document.getElementById('btn-add-particle');
        if (addParticleBtn) {
            addParticleBtn.addEventListener('click', () => {
                this.addParticleToSelected();
            });
        }

        const massSlider = document.getElementById('physics-mass');
        const massValue = document.getElementById('physics-mass-value');
        if (massSlider && massValue) {
            massSlider.addEventListener('input', () => {
                massValue.textContent = parseFloat(massSlider.value).toFixed(1);
            });
        }

        const applyPhysicsBtn = document.getElementById('btn-apply-physics');
        if (applyPhysicsBtn) {
            applyPhysicsBtn.addEventListener('click', () => {
                this.applyPhysicsToObject();
            });
        }

        const frictionSlider = document.getElementById('collider-friction');
        const frictionValue = document.getElementById('collider-friction-value');
        if (frictionSlider && frictionValue) {
            frictionSlider.addEventListener('input', () => {
                frictionValue.textContent = parseFloat(frictionSlider.value).toFixed(2);
            });
        }

        const applyColliderBtn = document.getElementById('btn-apply-collider');
        if (applyColliderBtn) {
            applyColliderBtn.addEventListener('click', () => {
                this.applyColliderToObject();
            });
        }
    }

    addParticleToSelected() {
        if (!this.app.particleManager || !this.app.selectedObject) {
            this.showNotification('Please select an object first', 'warning');
            return;
        }
        const presetSelect = document.getElementById('particle-preset-select');
        const preset = presetSelect?.value ?? 'fire';
        this.app.particleManager.addParticleToObject(this.app.selectedObject, preset);
        this.showNotification(`${preset} particles added`, 'success');
    }

    applyColliderToObject() {
        if (!this.app.selectedObject) {
            this.showNotification('Please select an object first', 'warning');
            return;
        }
        const mesh = this.app.selectedObject;
        const shapeSelect = document.getElementById('collider-shape');
        const sensorCheckbox = document.getElementById('collider-sensor');

        const shape = shapeSelect?.value ?? 'auto';
        const isSensor = sensorCheckbox?.checked ?? false;

        if (!mesh.userData.components) {
            mesh.userData.components = {};
        }

        mesh.userData.components.collider = {
            shape: shape,
            sensor: isSensor,
            offset: [0, 0, 0],
            size: null
        };

        this.showNotification(`Collider added: ${shape}`, 'success');
    }

    renderAssetsPanel(tab = 'colors', searchQuery = '') {
        // Handle new tab structure
        const colorsContent = document.getElementById('asset-colors');
        const modelsContent = document.getElementById('asset-models');
        const assetsList = document.getElementById('assets-list');

        // Show/hide appropriate content
        if (colorsContent) colorsContent.style.display = tab === 'colors' ? 'flex' : 'none';
        if (modelsContent) modelsContent.style.display = tab === 'models' ? 'flex' : 'none';
        if (assetsList) assetsList.style.display = 'none'; // Hide old assets list

        if (tab === 'colors') {
            this.renderPalette();
        } else if (tab === 'models') {
            // Trigger polyfork search on first visit
            if (this.app.polyforkImporter && this.app.polyforkImporter.models.length === 0) {
                this.searchPolyforkModels('');
            }
        }
    }

    setupCameraNudge() {
        const panel = document.getElementById('camera-nudge');
        if (!panel) return;

        panel.querySelectorAll('[data-cam-action]').forEach(button => {
            button.addEventListener('click', () => this.applyCameraNudge(button.dataset.camAction));
        });

        document.getElementById('camera-nudge-set-frame')?.addEventListener('click', () => {
            const sm = this.app.staging?.shotManager;
            if (!sm?.framingControls || !sm.framingRig) {
                this.showNotification('Click a start or end keyframe on the timeline first', 'info');
                return;
            }
            sm.commitFraming(sm.editingFrame);
            this.setupShotDesignerTab();
        });

        document.getElementById('camera-nudge-cancel-frame')?.addEventListener('click', () => {
            const sm = this.app.staging?.shotManager;
            if (sm?.framingControls) {
                sm.cancelFraming();
                this.setupShotDesignerTab();
            }
        });
    }

    applyCameraNudge(action) {
        const shotManager = this.app.staging?.shotManager;
        const framing = shotManager?.framingControls && shotManager.framingRig
            ? {
                camera: shotManager.framingRig.camera,
                target: shotManager.framingControls.target,
                controls: shotManager.framingControls
            }
            : null;

        const camera = framing?.camera || this.app.camera;
        const target = framing?.target || this.app.orbit?.target;
        if (!camera || !target) return;

        const step = 0.45;
        const angle = THREE.MathUtils.degToRad(5);
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);

        switch (action) {
            case 'left':
                camera.position.addScaledVector(right, -step);
                target.addScaledVector(right, -step);
                break;
            case 'right':
                camera.position.addScaledVector(right, step);
                target.addScaledVector(right, step);
                break;
            case 'up':
                camera.position.addScaledVector(up, step);
                target.addScaledVector(up, step);
                break;
            case 'down':
                camera.position.addScaledVector(up, -step);
                target.addScaledVector(up, -step);
                break;
            case 'push':
                camera.position.addScaledVector(forward, step);
                break;
            case 'pull':
                camera.position.addScaledVector(forward, -step);
                break;
            case 'rot-left':
            case 'rot-right': {
                const offset = camera.position.clone().sub(target);
                offset.applyAxisAngle(worldUp, action === 'rot-left' ? angle : -angle);
                camera.position.copy(target).add(offset);
                break;
            }
            case 'rot-up':
            case 'rot-down': {
                const offset = camera.position.clone().sub(target);
                offset.applyAxisAngle(right, action === 'rot-up' ? -angle : angle);
                camera.position.copy(target).add(offset);
                break;
            }
        }

        camera.lookAt(target);
        camera.updateMatrixWorld(true);

        if (framing?.controls) {
            framing.controls.update();
        } else if (this.app.orbit) {
            this.app.orbit.target.copy(target);
            this.app.orbit.update();
        }
    }

    setupSceneList() {
        const scenes = this.app.staging?.scenes;
        if (!scenes) return;

        const createBtn = document.getElementById('scene-create');
        const saveBtn = document.getElementById('scene-save');
        const deleteBtn = document.getElementById('scene-delete');
        const nameInput = document.getElementById('scene-new-name');

        if (createBtn && !createBtn.dataset.wired) {
            createBtn.dataset.wired = 'true';
            createBtn.addEventListener('click', () => {
                const name = (nameInput?.value || '').trim() || `Scene ${scenes.getSceneNames().length + 1}`;
                scenes.createScene(name, true);
                scenes.persistScenes();
                if (nameInput) nameInput.value = '';
                this.showNotification(`Scene "${name}" saved`, 'success');
            });
        }

        if (saveBtn && !saveBtn.dataset.wired) {
            saveBtn.dataset.wired = 'true';
            saveBtn.addEventListener('click', () => {
                scenes.persistScenes();
                this.showNotification(`Saved scene "${scenes.currentSceneName}"`, 'success');
            });
        }

        if (deleteBtn && !deleteBtn.dataset.wired) {
            deleteBtn.dataset.wired = 'true';
            deleteBtn.addEventListener('click', () => {
                if (scenes.deleteScene(scenes.currentSceneName)) scenes.persistScenes();
            });
        }

        const notesInput = document.getElementById('scene-notes');
        if (notesInput && !notesInput.dataset.wired) {
            notesInput.dataset.wired = 'true';
            notesInput.addEventListener('input', () => scenes.setSceneNotes(notesInput.value));
            notesInput.addEventListener('change', () => scenes.persistScenes());
        }

        const titleInput = document.getElementById('scene-title');
        if (titleInput && !titleInput.dataset.wired) {
            titleInput.dataset.wired = 'true';
            titleInput.addEventListener('change', () => {
                const next = titleInput.value.trim();
                if (next && next !== scenes.currentSceneName) {
                    scenes.renameScene(scenes.currentSceneName, next);
                    scenes.persistScenes();
                    this.renderSceneList();
                }
            });
        }

        this.renderSceneList();
    }

    renderSceneList() {
        const list = document.getElementById('scene-list');
        const scenes = this.app.staging?.scenes;
        if (!list || !scenes) return;

        const titleInput = document.getElementById('scene-title');
        const notesInput = document.getElementById('scene-notes');
        if (titleInput && document.activeElement !== titleInput) titleInput.value = scenes.currentSceneName;
        if (notesInput && document.activeElement !== notesInput) notesInput.value = scenes.getSceneNotes();

        list.innerHTML = scenes.getSceneNames().map(name => `
            <div class="scene-list-item ${name === scenes.currentSceneName ? 'active' : ''}" data-scene-name="${name}">
                <span>${name}</span>
                <small>${name === scenes.currentSceneName ? 'current' : ''}</small>
            </div>
        `).join('');

        list.querySelectorAll('.scene-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.sceneName;
                if (name && name !== scenes.currentSceneName) {
                    scenes.switchToScene(name);
                    scenes.persistScenes();
                }
            });
        });
    }

    openPoseEditor(model) {
        const char = this.app.characterManager?.findCharacter?.(model);
        if (!char?.poser) {
            this.showNotification('Pose editor is unavailable for this character', 'error');
            return;
        }

        const modal = document.getElementById('pose-editor-modal');
        const boneSelect = document.getElementById('pose-bone-select');
        const nameInput = document.getElementById('pose-custom-name');
        if (!modal || !boneSelect) return;

        this.poseEditor = {
            model: char.model,
            poser: char.poser,
            boneName: null,
            values: new Map()
        };

        const bones = [...char.poser.bones.keys()].sort();
        boneSelect.innerHTML = bones.map(name => `<option value="${name}">${name}</option>`).join('');
        nameInput.value = '';
        modal.classList.add('open');
        modal.style.display = 'flex';
        this.app.beginPoseEditing?.(char.model);
        this.app.setPoseControlMode?.('rotate');

        document.getElementById('pose-mode-rotate').classList.add('active');
        document.getElementById('pose-mode-translate').classList.remove('active');
        document.getElementById('pose-mode-rotate').onclick = () => {
            this.app.setPoseControlMode?.('rotate');
            document.getElementById('pose-mode-rotate').classList.add('active');
            document.getElementById('pose-mode-translate').classList.remove('active');
        };
        document.getElementById('pose-mode-translate').onclick = () => {
            this.app.setPoseControlMode?.('translate');
            document.getElementById('pose-mode-translate').classList.add('active');
            document.getElementById('pose-mode-rotate').classList.remove('active');
        };

        const selectBone = (name) => {
            this.poseEditor.boneName = name;
            const bone = char.poser.bones.get(name);
            const rest = char.poser.rest.get(name);
            const delta = bone.quaternion.clone().multiply(rest.clone().invert());
            const euler = new THREE.Euler().setFromQuaternion(delta, 'ZYX');
            const values = {
                x: Math.round(THREE.MathUtils.radToDeg(euler.x)),
                y: Math.round(THREE.MathUtils.radToDeg(euler.y)),
                z: Math.round(THREE.MathUtils.radToDeg(euler.z))
            };
            this.poseEditor.values.set(name, values);
            document.getElementById('pose-bone-x').value = values.x;
            document.getElementById('pose-bone-y').value = values.y;
            document.getElementById('pose-bone-z').value = values.z;
            document.getElementById('pose-bone-x-val').textContent = `${values.x}°`;
            document.getElementById('pose-bone-y-val').textContent = `${values.y}°`;
            document.getElementById('pose-bone-z-val').textContent = `${values.z}°`;
            this.app.selectPoseBone?.(name);
        };

        boneSelect.onchange = () => selectBone(boneSelect.value);

        const applyBone = () => {
            if (!this.poseEditor?.boneName) return;
            const values = {
                x: parseFloat(document.getElementById('pose-bone-x').value),
                y: parseFloat(document.getElementById('pose-bone-y').value),
                z: parseFloat(document.getElementById('pose-bone-z').value)
            };
            this.poseEditor.values.set(this.poseEditor.boneName, values);
            document.getElementById('pose-bone-x-val').textContent = `${Math.round(values.x)}°`;
            document.getElementById('pose-bone-y-val').textContent = `${Math.round(values.y)}°`;
            document.getElementById('pose-bone-z-val').textContent = `${Math.round(values.z)}°`;
            this.poseEditor.poser.setBone(this.poseEditor.boneName, values.x, values.y, values.z);
        };

        ['pose-bone-x', 'pose-bone-y', 'pose-bone-z'].forEach(id => {
            document.getElementById(id).oninput = applyBone;
        });

        document.getElementById('pose-editor-reset-bone').onclick = () => {
            if (!this.poseEditor?.boneName) return;
            const values = { x: 0, y: 0, z: 0 };
            this.poseEditor.values.set(this.poseEditor.boneName, values);
            document.getElementById('pose-bone-x').value = 0;
            document.getElementById('pose-bone-y').value = 0;
            document.getElementById('pose-bone-z').value = 0;
            document.getElementById('pose-bone-x-val').textContent = '0°';
            document.getElementById('pose-bone-y-val').textContent = '0°';
            document.getElementById('pose-bone-z-val').textContent = '0°';
            this.poseEditor.poser.resetBone(this.poseEditor.boneName);
        };

        document.getElementById('pose-editor-save').onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                this.showNotification('Give the pose a name first', 'error');
                return;
            }
            const key = this.app.characterManager.saveCustomPose(this.poseEditor.model, name);
            if (!key) {
                this.showNotification('Could not save pose', 'error');
                return;
            }
            this.showNotification(`Pose “${name}” saved`, 'success');
            this.closePoseEditor();
            this.renderPropertiesPanel(this.app.selectedObject);
        };

        document.getElementById('pose-editor-close').onclick = () => this.closePoseEditor();
        document.getElementById('pose-editor-cancel').onclick = () => this.closePoseEditor();
        modal.onclick = (event) => {
            if (event.target === modal) this.closePoseEditor();
        };

        selectBone(bones[0]);
    }

    closePoseEditor() {
        const modal = document.getElementById('pose-editor-modal');
        if (modal) {
            modal.classList.remove('open');
            modal.style.display = 'none';
        }
        this.poseEditor = null;
        this.app.endPoseEditing?.();
    }

    syncPoseEditorFromBone(bone) {
        if (!this.poseEditor || !bone || !this.poseEditor.poser) return;
        const shortName = String(bone.name).replace(/^mixamorig:?/, '');
        const boneSelect = document.getElementById('pose-bone-select');
        if (boneSelect && [...boneSelect.options].some(option => option.value === shortName)) {
            boneSelect.value = shortName;
        }
        this.poseEditor.boneName = shortName;
        const rest = this.poseEditor.poser.rest.get(shortName);
        if (!rest) return;
        const delta = bone.quaternion.clone().multiply(rest.clone().invert());
        const euler = new THREE.Euler().setFromQuaternion(delta, 'ZYX');
        const values = {
            x: Math.round(THREE.MathUtils.radToDeg(euler.x)),
            y: Math.round(THREE.MathUtils.radToDeg(euler.y)),
            z: Math.round(THREE.MathUtils.radToDeg(euler.z))
        };
        this.poseEditor.values.set(shortName, values);
        document.getElementById('pose-bone-x').value = values.x;
        document.getElementById('pose-bone-y').value = values.y;
        document.getElementById('pose-bone-z').value = values.z;
        document.getElementById('pose-bone-x-val').textContent = `${values.x}°`;
        document.getElementById('pose-bone-y-val').textContent = `${values.y}°`;
        document.getElementById('pose-bone-z-val').textContent = `${values.z}°`;
    }

    setupCameraTab() {
        // Initialize camera rig controls in the right panel
        const cameras = this.app.staging?.cameras;
        if (!cameras) return;

        // Populate lens preset selector
        const lensSelect = document.getElementById('camera-lens-preset');
        if (lensSelect && lensSelect.options.length === 0) {
            lensSelect.innerHTML = '12,16,24,35,50,85,135'.split(',').map(f => `<option value="${f}">${f}mm</option>`).join('');
            lensSelect.addEventListener('change', (e) => {
                const rig = cameras.selectedRig || cameras.rigs[0];
                if (rig) cameras.setLens(rig, parseFloat(e.target.value), null);
            });
        }

        // Populate sensor preset selector
        const sensorSelect = document.getElementById('camera-sensor-preset');
        if (sensorSelect && sensorSelect.options.length === 0) {
            sensorSelect.innerHTML = Object.entries({fullFrame: 'Full Frame', super35: 'Super 35', mft: 'MFT'}).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
            sensorSelect.addEventListener('change', (e) => {
                const rig = cameras.selectedRig || cameras.rigs[0];
                if (rig) cameras.setLens(rig, null, e.target.value);
            });
        }

        // Populate aspect ratio selector
        const aspectSelect = document.getElementById('camera-aspect-preset');
        if (aspectSelect && aspectSelect.options.length === 0) {
            aspectSelect.innerHTML = Object.entries({'16:9': '16:9 (1.78)', '2.39:1': '2.39:1', '1.85:1': '1.85:1', '4:3': '4:3 (1.33)', '1:1': '1:1'}).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
            aspectSelect.addEventListener('change', (e) => {
                const rig = cameras.selectedRig || cameras.rigs[0];
                if (rig) cameras.setAspect(rig, e.target.value);
            });
        }

        // Wire up camera toolbar buttons
        const addBtn = document.getElementById('tool-add-camera-rig');
        if (addBtn && !addBtn.dataset.wired) {
            addBtn.dataset.wired = 'true';
            addBtn.addEventListener('click', () => {
                const rig = cameras.addRig();
                this._openCameraRigId = rig?.id || null;
                this.refreshCameraRigList();
            });
        }

        const viewBtn = document.getElementById('tool-view-camera');
        if (viewBtn && !viewBtn.dataset.wired) {
            viewBtn.dataset.wired = 'true';
            viewBtn.addEventListener('click', () => cameras.cycleViewThrough());
        }

        const frameBtn = document.getElementById('tool-frame-camera');
        if (frameBtn && !frameBtn.dataset.wired) {
            frameBtn.dataset.wired = 'true';
            frameBtn.addEventListener('click', () => cameras.frameCameraFromView());
        }

        const deleteBtn = document.getElementById('tool-delete-camera');
        if (deleteBtn && !deleteBtn.dataset.wired) {
            deleteBtn.dataset.wired = 'true';
            deleteBtn.addEventListener('click', () => cameras.deleteSelectedRig());
        }

        const guidesBtn = document.getElementById('tool-toggle-camera-guides');
        if (guidesBtn && !guidesBtn.dataset.wired) {
            guidesBtn.dataset.wired = 'true';
            guidesBtn.addEventListener('click', () => {
                this.app.cameraGuidesEnabled = !this.app.cameraGuidesEnabled;
                guidesBtn.classList.toggle('active', this.app.cameraGuidesEnabled);
                const guides = document.getElementById('camera-guides');
                if (guides && !this.app.cameraGuidesEnabled) guides.classList.add('hidden');
                this.showNotification(`Camera guides ${this.app.cameraGuidesEnabled ? 'on' : 'off'}`, 'info');
            });
        }

        // Shot timeline toggle
        const timelineBtn = document.getElementById('tool-toggle-shot-timeline');
        if (timelineBtn && !timelineBtn.dataset.wired) {
            timelineBtn.dataset.wired = 'true';
            timelineBtn.addEventListener('click', () => this.app.staging.shotManager.toggleUI());
        }

        // Refresh camera rig list
        this.refreshCameraRigList();
    }

    refreshCameraRigList() {
        const cameras = this.app.staging?.cameras;
        if (!cameras) return;

        const listDiv = document.getElementById('camera-rig-list');
        if (!listDiv) return;

        if (cameras.rigs.length === 0) {
            listDiv.innerHTML = '<div class="camera-rig-empty">No virtual cameras. Click + to add.</div>';
            return;
        }

        const selectedId = cameras.selectedRig?.id || cameras.defaultRig?.id || cameras.rigs[0].id;
        if (!this._openCameraRigId) this._openCameraRigId = selectedId;
        if (!cameras.get(this._openCameraRigId)) this._openCameraRigId = selectedId;

        listDiv.innerHTML = '';

        cameras.rigs.forEach(rig => {
            const open = this._openCameraRigId === rig.id;
            const selected = selectedId === rig.id;
            const color = '#' + rig.color.toString(16).padStart(6, '0');

            const item = document.createElement('div');
            item.className = `camera-rig-accordion${open ? ' open' : ''}${selected ? ' selected' : ''}`;
            item.dataset.rigId = rig.id;

            const header = document.createElement('div');
            header.className = 'camera-rig-accordion-header';
            header.innerHTML = `
                <span class="camera-rig-color" style="background:${color}"></span>
                <span class="camera-rig-name">${rig.name}${rig.isDefault ? ' (default)' : ''}</span>
                <span class="camera-rig-summary">${rig.lens.focalLength}mm ${rig.lens.sensor} · ${rig.aspect}</span>
                <span class="camera-rig-chevron">${open ? '▾' : '▸'}</span>
            `;
            header.onclick = () => {
                this.app.selectObject(rig.group);
                this._openCameraRigId = open ? this._openCameraRigId : rig.id;
                if (open) this._openCameraRigId = null;
                this.refreshCameraRigList();
            };
            item.appendChild(header);

            if (open) {
                const body = document.createElement('div');
                body.className = 'camera-rig-accordion-body';

                const lensRow = document.createElement('label');
                lensRow.className = 'camera-rig-field';
                lensRow.innerHTML = '<span>Lens</span>';
                const lens = document.createElement('select');
                lens.className = 'camera-preset-select';
                lens.innerHTML = [12, 16, 24, 35, 50, 85, 135].map(value =>
                    `<option value="${value}"${value === rig.lens.focalLength ? ' selected' : ''}>${value}mm</option>`
                ).join('');
                lens.onchange = () => {
                    cameras.setLens(rig, parseFloat(lens.value), null);
                    this.refreshCameraRigList();
                };
                lensRow.appendChild(lens);

                const sensorRow = document.createElement('label');
                sensorRow.className = 'camera-rig-field';
                sensorRow.innerHTML = '<span>Sensor</span>';
                const sensor = document.createElement('select');
                sensor.className = 'camera-preset-select';
                sensor.innerHTML = Object.entries({ fullFrame: 'Full Frame', super35: 'Super 35', mft: 'MFT' })
                    .map(([value, label]) => `<option value="${value}"${value === rig.lens.sensor ? ' selected' : ''}>${label}</option>`).join('');
                sensor.onchange = () => {
                    cameras.setLens(rig, null, sensor.value);
                    this.refreshCameraRigList();
                };
                sensorRow.appendChild(sensor);

                const aspectRow = document.createElement('label');
                aspectRow.className = 'camera-rig-field';
                aspectRow.innerHTML = '<span>Aspect</span>';
                const aspect = document.createElement('select');
                aspect.className = 'camera-preset-select';
                aspect.innerHTML = Object.keys({ '16:9': 1, '2.39:1': 1, '1.85:1': 1, '4:3': 1, '1:1': 1 })
                    .map(value => `<option value="${value}"${value === rig.aspect ? ' selected' : ''}>${value}</option>`).join('');
                aspect.onchange = () => {
                    cameras.setAspect(rig, aspect.value);
                    this.refreshCameraRigList();
                };
                aspectRow.appendChild(aspect);

                const nameRow = document.createElement('label');
                nameRow.className = 'camera-rig-field';
                nameRow.innerHTML = '<span>Name</span>';
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'camera-name-input';
                nameInput.value = rig.name;
                nameInput.placeholder = 'Camera name';
                const saveName = () => {
                    const next = nameInput.value.trim();
                    if (!next) {
                        nameInput.value = rig.name;
                        return;
                    }
                    rig.name = next;
                    rig.group.name = `Camera ${next}`;
                    this.app.staging.shotManager.refreshUI();
                    this.renderShotDesignerList?.();
                    this.refreshCameraRigList();
                };
                nameInput.addEventListener('change', saveName);
                nameInput.addEventListener('blur', saveName);
                nameInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') nameInput.blur();
                });
                nameRow.appendChild(nameInput);

                body.append(nameRow, lensRow, sensorRow, aspectRow);

                if (!rig.isDefault) {
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.textContent = 'Delete camera';
                    remove.className = 'camera-delete-btn';
                    remove.onclick = () => {
                        cameras.removeRig(rig.id);
                        this._openCameraRigId = cameras.defaultRig?.id || null;
                        this.refreshCameraRigList();
                    };
                    body.appendChild(remove);
                }

                item.appendChild(body);
            }

            listDiv.appendChild(item);
        });
    }

    // =============================================
    // FLOATING CAMERA CONTROLS
    // =============================================

    setupFloatingCameraControls() {
        const cameras = this.app.staging?.cameras;
        if (!cameras) return;

        const lensSelect = document.getElementById('floating-camera-lens');
        const sensorSelect = document.getElementById('floating-camera-sensor');
        const aspectSelect = document.getElementById('floating-camera-aspect');
        const closeBtn = document.getElementById('floating-camera-close');
        const viewBtn = document.getElementById('floating-camera-view');
        const frameBtn = document.getElementById('floating-camera-frame');
        const deleteBtn = document.getElementById('floating-camera-delete');

        // Populate lens presets
        if (lensSelect) {
            lensSelect.innerHTML = '';
            for (const f of [12, 16, 24, 35, 50, 85, 135]) {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f + 'mm';
                lensSelect.appendChild(opt);
            }
            lensSelect.onchange = (e) => {
                const rig = cameras.selectedRig;
                if (rig) cameras.setLens(rig, parseFloat(e.target.value), null);
            };
        }

        // Populate sensor presets
        if (sensorSelect) {
            sensorSelect.innerHTML = '';
            for (const [key, val] of Object.entries({ fullFrame: 'Full Frame', super35: 'Super 35', mft: 'MFT' })) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = val;
                sensorSelect.appendChild(opt);
            }
            sensorSelect.onchange = (e) => {
                const rig = cameras.selectedRig;
                if (rig) cameras.setLens(rig, null, e.target.value);
            };
        }

        // Populate aspect presets
        if (aspectSelect) {
            aspectSelect.innerHTML = '';
            for (const [key, val] of Object.entries({ '16:9': '16:9', '2.39:1': '2.39:1', '1.85:1': '1.85:1', '4:3': '4:3', '1:1': '1:1' })) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key;
                aspectSelect.appendChild(opt);
            }
            aspectSelect.onchange = (e) => {
                const rig = cameras.selectedRig;
                if (rig) cameras.setAspect(rig, e.target.value);
            };
        }

        // Close button
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('floating-camera-controls').classList.add('hidden');
            };
        }

        // View through camera
        if (viewBtn) {
            viewBtn.onclick = () => {
                cameras.viewingRigId = cameras.selectedRig?.id || null;
                if (this.app.orbit) this.app.orbit.enabled = !cameras.viewingRigId;
                this.refreshCameraRigList();
                this.updateFloatingCameraControls(cameras.selectedRig);
            };
        }

        // Frame camera from view
        if (frameBtn) {
            frameBtn.onclick = () => {
                cameras.frameCameraFromView();
                this.refreshCameraRigList();
            };
        }

        // Delete camera
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                cameras.deleteSelectedRig();
                document.getElementById('floating-camera-controls').classList.add('hidden');
                this.refreshCameraRigList();
            };
        }

        // Move mode buttons
        const orbitBtn = document.getElementById('floating-move-orbit');
        const panBtn = document.getElementById('floating-move-pan');
        let moveMode = 'orbit';
        const setMoveMode = (mode) => {
            moveMode = mode;
            if (orbitBtn) orbitBtn.classList.toggle('active', mode === 'orbit');
            if (panBtn) panBtn.classList.toggle('active', mode === 'pan');
            if (this.app.staging?.shotManager?.framingControls) {
                const fc = this.app.staging.shotManager.framingControls;
                fc.enableRotate = mode === 'orbit';
                fc.enablePan = mode === 'pan';
            }
        };
        if (orbitBtn) orbitBtn.onclick = () => setMoveMode('orbit');
        if (panBtn) panBtn.onclick = () => setMoveMode('pan');
    }

    updateFloatingCameraControls(rig) {
        const lensSelect = document.getElementById('floating-camera-lens');
        const sensorSelect = document.getElementById('floating-camera-sensor');
        const aspectSelect = document.getElementById('floating-camera-aspect');
        const viewBtn = document.getElementById('floating-camera-view');

        if (!rig) return;

        if (lensSelect && document.activeElement !== lensSelect) {
            lensSelect.value = rig.lens.focalLength;
        }
        if (sensorSelect && document.activeElement !== sensorSelect) {
            sensorSelect.value = rig.lens.sensor;
        }
        if (aspectSelect && document.activeElement !== aspectSelect) {
            aspectSelect.value = rig.aspect;
        }
        if (viewBtn) {
            const isViewing = this.app.staging.cameras.viewingRigId === rig.id;
            viewBtn.textContent = isViewing ? 'Exit View' : 'View';
            viewBtn.classList.toggle('active', isViewing);
        }
    }

    // =============================================
    // SHOT DESIGNER TAB
    // =============================================

    setupShotDesignerTab() {
        const shotManager = this.app.staging?.shotManager;
        const cameras = this.app.staging?.cameras;
        const cameraSelect = document.getElementById('sd-camera-select');
        const shotsList = document.getElementById('sd-shots-list');
        const details = document.getElementById('sd-shot-details');
        const emptyState = document.getElementById('sd-empty');

        if (!shotManager || !cameras || !cameraSelect || !shotsList) return;
        if (details) details.style.display = 'none';

        cameraSelect.innerHTML = '<option value="">-- Select Camera --</option>';
        cameras.rigs.forEach(rig => {
            const option = document.createElement('option');
            option.value = rig.id;
            option.textContent = rig.isDefault ? 'Default Camera' : `Cam ${rig.name}`;
            cameraSelect.appendChild(option);
        });
        cameraSelect.value = shotManager.selectedShot?.cameraId || cameras.defaultRig?.id || '';

        const addBtn = document.getElementById('sd-add-shot');
        if (addBtn) addBtn.onclick = () => {
            const rig = cameraSelect.value ? cameras.get(cameraSelect.value) : (cameras.defaultRig || cameras.ensureDefaultRig());
            if (!rig) return this.showNotification('No camera available', 'error');
            shotManager.createShot(rig.id);
            this._shotDesignerOpenIndex = shotManager.selectedShotIndex;
            this.renderShotDesignerList();
        };

        const playBtn = document.getElementById('sd-play');
        const pauseBtn = document.getElementById('sd-pause');
        if (playBtn) playBtn.onclick = () => {
            shotManager.play();
            playBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
        };
        if (pauseBtn) pauseBtn.onclick = () => {
            shotManager.pause();
            pauseBtn.style.display = 'none';
            if (playBtn) playBtn.style.display = 'inline-block';
        };

        const refreshBtn = document.getElementById('sd-refresh');
        if (refreshBtn) refreshBtn.onclick = () => this.renderShotDesignerList();

        const timelineBtn = document.getElementById('sd-timeline');
        if (timelineBtn) timelineBtn.onclick = () => shotManager.toggleUI();

        const exportBtn = document.getElementById('sd-export-pdf');
        if (exportBtn) exportBtn.onclick = () => this.app.exportStoryboardPDF?.();
        const reportBtn = document.getElementById('sd-report');
        if (reportBtn) reportBtn.onclick = () => this.app.openStoryboardReport?.();

        if (emptyState) emptyState.style.display = 'none';
        if (shotManager.selectedShotIndex != null) this._shotDesignerOpenIndex = shotManager.selectedShotIndex;
        this.renderShotDesignerList();
    }

    renderShotDesignerList() {
        const shotManager = this.app.staging?.shotManager;
        const cameras = this.app.staging?.cameras;
        const list = document.getElementById('sd-shots-list');
        if (!list || !shotManager || !cameras) return;

        if (!shotManager.shots.length) {
            list.innerHTML = '<div class="shot-designer-empty">No shots yet. Click + to add the first shot.</div>';
            return;
        }

        if (this._shotDesignerOpenIndex == null) this._shotDesignerOpenIndex = shotManager.selectedShotIndex;
        list.innerHTML = '';

        shotManager.shots.forEach((shot, index) => {
            const rig = cameras.get(shot.cameraId);
            const color = rig?.color ? '#' + rig.color.toString(16).padStart(6, '0') : '#f3b63f';
            const open = this._shotDesignerOpenIndex === index;
            const selected = shotManager.selectedShotIndex === index;

            const item = document.createElement('div');
            item.className = `sd-shot-item${open ? ' open' : ''}${selected ? ' selected' : ''}`;

            const header = document.createElement('div');
            header.className = 'sd-shot-header';
            header.innerHTML = `
                <span class="sd-shot-number">${index + 1}</span>
                <span class="sd-shot-heading">
                    <b>${shot.move || shot.name}</b>
                    <small>${shot.duration.toFixed(1)}s · ×${shot.speed} · ${shot.startFrame ? 'custom start' : 'auto start'} · ${shot.endFrame ? 'custom end' : 'auto end'}</small>
                </span>
                <span class="sd-shot-actions">
                    <button type="button" data-shot-action="up" title="Move earlier">▲</button>
                    <button type="button" data-shot-action="down" title="Move later">▼</button>
                    <button type="button" data-shot-action="duplicate" title="Duplicate">⧉</button>
                    <button type="button" data-shot-action="delete" title="Delete">✕</button>
                </span>
            `;
            header.addEventListener('click', (event) => {
                if (event.target.closest('[data-shot-action]')) return;
                shotManager.selectedShotIndex = index;
                this._shotDesignerOpenIndex = open ? null : index;
                shotManager.currentTime = shotManager.getShotStartTime(index);
                shotManager.previewActive = false;
                shotManager.clearPreviewBlur();
                this.renderShotDesignerList();
                this.app.updateKeyframeGizmos?.();
            });
            header.querySelectorAll('[data-shot-action]').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const action = button.dataset.shotAction;
                    if (action === 'up') shotManager.moveShot(shot.id, -1);
                    if (action === 'down') shotManager.moveShot(shot.id, 1);
                    if (action === 'duplicate') shotManager.duplicateShot(shot.id);
                    if (action === 'delete') {
                        shotManager.removeShot(shot.id);
                        this._shotDesignerOpenIndex = null;
                    }
                    this.renderShotDesignerList();
                });
            });
            item.appendChild(header);

            if (open) item.appendChild(this.buildShotEditor(shot, index));
            list.appendChild(item);
        });
    }

    buildShotEditor(shot, index) {
        const shotManager = this.app.staging.shotManager;
        const cameras = this.app.staging.cameras;
        const body = document.createElement('div');
        body.className = 'sd-shot-body';

        const row = (label, input, className = '') => {
            const el = document.createElement('div');
            el.className = `sd-field ${className}`;
            const span = document.createElement('span');
            span.textContent = label;
            el.append(span, input);
            return el;
        };

        const rangeRow = (label, value, min, max, step, formatter, onInput) => {
            const wrap = document.createElement('span');
            wrap.className = 'sd-range-wrap';
            const input = document.createElement('input');
            input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
            const output = document.createElement('b');
            output.className = 'sd-value';
            output.textContent = formatter(value);
            input.oninput = () => {
                output.textContent = formatter(parseFloat(input.value));
                onInput(parseFloat(input.value));
            };
            wrap.append(input, output);
            return row(label, wrap);
        };

        const cameraSelect = document.createElement('select');
        cameraSelect.className = 'shot-designer-select';
        cameraSelect.innerHTML = cameras.rigs.map(cam => `<option value="${cam.id}"${cam.id === shot.cameraId ? ' selected' : ''}>${cam.isDefault ? 'Default Camera' : `Cam ${cam.name}`}</option>`).join('');
        cameraSelect.onchange = () => { shot.cameraId = cameraSelect.value; this.renderShotDesignerList(); };

        const moveSelect = document.createElement('select');
        moveSelect.className = 'shot-designer-select';
        moveSelect.innerHTML = shotManager.getMoveOptions(shot.move);
        moveSelect.onchange = () => {
            shot.move = moveSelect.value;
            shot.spec = { ...getMoveSpec(shot.move) };
            if (shot.spec.d) shot.duration = shot.spec.d;
            this.renderShotDesignerList();
        };

        const durationRow = rangeRow('Length', shot.duration, 0.5, 30, 0.5, v => `${v.toFixed(1)}s`, v => { shot.duration = v; });

        const speedWrap = document.createElement('span');
        speedWrap.className = 'sd-speed-control';
        const minus = document.createElement('button'); minus.textContent = '−';
        const speedValue = document.createElement('b'); speedValue.textContent = `×${shot.speed}`;
        const plus = document.createElement('button'); plus.textContent = '+';
        minus.onclick = () => { shot.speed = Math.max(0.05, Math.round((shot.speed - 0.25) * 100) / 100); speedValue.textContent = `×${shot.speed}`; };
        plus.onclick = () => { shot.speed = Math.min(8, Math.round((shot.speed + 0.25) * 100) / 100); speedValue.textContent = `×${shot.speed}`; };
        speedWrap.append(minus, speedValue, plus);

        body.append(
            row('Camera', cameraSelect),
            row('Camera move', moveSelect),
            durationRow,
            row('Speed', speedWrap)
        );

        // Framing block, matching the Shot Designer reference.
        const framing = document.createElement('fieldset');
        framing.className = 'sd-fieldset sd-framing';
        framing.innerHTML = '<legend>Framing</legend>';

        const segmented = (items, active, onSelect) => {
            const seg = document.createElement('div');
            seg.className = 'sd-segmented';
            items.forEach(([label, value]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.className = value === active ? 'active' : '';
                button.onclick = () => { onSelect(value); this.renderShotDesignerList(); };
                seg.appendChild(button);
            });
            return seg;
        };

        framing.appendChild(segmented(
            [['Start frame', 'start'], ['End frame', 'end']],
            shotManager.editingFrame,
            value => {
                shotManager.selectedShotIndex = index;
                shotManager.editingFrame = value;
                shotManager.jumpToFrame(shot, value);
            }
        ));

        framing.appendChild(segmented(
            [['Frame view', 'frame'], ['Explore scene', 'explore']],
            shotManager.viewMode,
            value => {
                shotManager.viewMode = value;
                if (value === 'explore') {
                    shotManager.previewActive = false;
                    shotManager.clearTransitionOverlay();
                }
            }
        ));

        framing.appendChild(segmented(
            [['Drag moves', 'translate'], ['Drag rotates', 'rotate']],
            shotManager.dragMode,
            value => { shotManager.dragMode = value; }
        ));

        const fov = shot.spec?.f?.[0] ?? 55;
        framing.appendChild(rangeRow('Zoom', fov, 15, 120, 1, v => String(Math.round(v)), value => {
            shot.spec.f = [value, value];
        }));

        const customRow = document.createElement('div');
        customRow.className = 'sd-custom-row';
        const customLabel = document.createElement('b');
        customLabel.textContent = shot.startFrame || shot.endFrame ? 'Custom framing' : 'Auto framing';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Reset';
        reset.onclick = () => {
            shot.startFrame = null;
            shot.endFrame = null;
            this.renderShotDesignerList();
            this.app.updateKeyframeGizmos?.();
        };
        customRow.append(customLabel, reset);
        framing.appendChild(customRow);
        body.appendChild(framing);

        // Focus block.
        const focus = document.createElement('fieldset');
        focus.className = 'sd-fieldset';
        const focusLegend = document.createElement('legend');
        focusLegend.textContent = 'Focus';
        focus.append(
            focusLegend,
            rangeRow('Blur at start', shot.blurStart || 0, 0, 20, 0.5, v => String(v), v => { shot.blurStart = v; }),
            rangeRow('Blur at end', shot.blurEnd || 0, 0, 20, 0.5, v => String(v), v => { shot.blurEnd = v; })
        );
        body.appendChild(focus);

        // Transition block (to next shot).
        const transitionField = document.createElement('fieldset');
        transitionField.className = 'sd-fieldset';
        transitionField.innerHTML = '<legend>Transition to next shot</legend>';
        const transition = shot.transition || { type: 'none', length: 1, color: '#000000', opacity: 1, ease: 2 };
        const transitionType = document.createElement('select');
        transitionType.className = 'shot-designer-select';
        transitionType.innerHTML = [
            ['none', 'Cut / none'], ['dip', 'Dip to colour'], ['fade', 'Fade through colour']
        ].map(([v, label]) => `<option value="${v}"${transition.type === v ? ' selected' : ''}>${label}</option>`).join('');
        transitionType.onchange = () => {
            shot.transition = transitionType.value === 'none' ? null : { ...transition, type: transitionType.value };
            this.renderShotDesignerList();
        };
        transitionField.appendChild(row('Type', transitionType));
        if (transition.type !== 'none') {
            transitionField.appendChild(rangeRow('Length', transition.length || 1, 0.25, 4, 0.25, v => `${v}s`, v => { shot.transition.length = v; }));
            const color = document.createElement('input');
            color.type = 'color';
            color.value = transition.color || '#000000';
            color.oninput = () => { shot.transition.color = color.value; };
            transitionField.appendChild(row('Colour', color));
            transitionField.appendChild(rangeRow('Opacity', transition.opacity ?? 1, 0, 1, 0.05, v => v.toFixed(2), v => { shot.transition.opacity = v; }));
            transitionField.appendChild(rangeRow('Ease', transition.ease ?? 2, 1, 4, 1, v => String(v), v => { shot.transition.ease = v; }));
        }
        body.appendChild(transitionField);

        // Advanced / animation curve block.
        const advanced = document.createElement('fieldset');
        advanced.className = 'sd-fieldset';
        const advancedLegend = document.createElement('legend');
        advancedLegend.textContent = 'Advanced';
        advanced.appendChild(advancedLegend);
        const curveButton = document.createElement('button');
        curveButton.type = 'button';
        curveButton.className = 'sd-curve-toggle';
        const curveOpen = this._openCurveShotId === shot.id;
        curveButton.textContent = `Animation curve ${curveOpen ? '▴' : '▾'}`;
        curveButton.onclick = () => {
            this._openCurveShotId = curveOpen ? null : shot.id;
            this.renderShotDesignerList();
        };
        advanced.appendChild(curveButton);
        if (curveOpen) advanced.appendChild(this.buildCurveEditor(shot));
        body.appendChild(advanced);

        const notes = document.createElement('textarea');
        notes.className = 'sd-notes';
        notes.rows = 3;
        notes.placeholder = 'Camera notes, lens, movement, performance notes…';
        notes.value = shot.notes || '';
        notes.oninput = () => { shot.notes = notes.value; };
        body.appendChild(row('Notes', notes, 'sd-notes-row'));

        return body;
    }

    buildCurveEditor(shot) {
        const wrap = document.createElement('div');
        wrap.className = 'sd-curve-editor';

        const currentCurve = () => {
            if (Array.isArray(shot.curve)) return shot.curve;
            const presets = {
                lin: [0, 0, 1, 1],
                io: [0.42, 0, 0.58, 1],
                in: [0.42, 0, 1, 1],
                out: [0, 0, 0.58, 1],
                ramp: [0.7, 0, 0.3, 1]
            };
            return [...(presets[shot.easing] || presets.io)];
        };

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 260 160');
        svg.setAttribute('class', 'sd-curve-svg');

        const plot = { left: 24, top: 20, width: 200, height: 112 };
        const xToPx = x => plot.left + x * plot.width;
        const yToPx = y => plot.top + (1 - y) * plot.height;
        const pxToX = x => (x - plot.left) / plot.width;
        const pxToY = y => 1 - (y - plot.top) / plot.height;

        const reference = document.createElementNS(svgNS, 'line');
        reference.setAttribute('x1', plot.left); reference.setAttribute('y1', yToPx(0));
        reference.setAttribute('x2', plot.left + plot.width); reference.setAttribute('y2', yToPx(1));
        reference.setAttribute('stroke', 'rgba(255,255,255,0.25)');
        reference.setAttribute('stroke-dasharray', '4 4');
        svg.appendChild(reference);

        const frame = document.createElementNS(svgNS, 'rect');
        frame.setAttribute('x', plot.left); frame.setAttribute('y', plot.top);
        frame.setAttribute('width', plot.width); frame.setAttribute('height', plot.height);
        frame.setAttribute('fill', 'none');
        frame.setAttribute('stroke', 'rgba(255,255,255,0.28)');
        svg.appendChild(frame);

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#f3b63f');
        path.setAttribute('stroke-width', '2.5');
        svg.appendChild(path);

        const handleA = document.createElementNS(svgNS, 'circle');
        const handleB = document.createElementNS(svgNS, 'circle');
        [handleA, handleB].forEach(node => {
            node.setAttribute('r', '7');
            node.setAttribute('fill', '#f3b63f');
            node.setAttribute('cursor', 'grab');
            svg.appendChild(node);
        });

        const labels = [
            ['progress ↑', 4, 14, 'start'],
            ['time →', 224, 152, 'end']
        ];
        labels.forEach(([text, x, y, anchor]) => {
            const label = document.createElementNS(svgNS, 'text');
            label.textContent = text;
            label.setAttribute('x', x); label.setAttribute('y', y);
            label.setAttribute('fill', '#9d8b6c');
            label.setAttribute('font-size', '9');
            label.setAttribute('text-anchor', anchor);
            svg.appendChild(label);
        });

        const draw = () => {
            const curve = currentCurve();
            const [x1, y1, x2, y2] = curve;
            path.setAttribute('d', `M ${xToPx(0)} ${yToPx(0)} C ${xToPx(x1)} ${yToPx(y1)} ${xToPx(x2)} ${yToPx(y2)} ${xToPx(1)} ${yToPx(1)}`);
            handleA.setAttribute('cx', xToPx(x1)); handleA.setAttribute('cy', yToPx(y1));
            handleB.setAttribute('cx', xToPx(x2)); handleB.setAttribute('cy', yToPx(y2));
            handleA.dataset.control = '0'; handleB.dataset.control = '2';
        };
        draw();

        let dragging = null;
        const point = event => {
            const rect = svg.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 260;
            const y = ((event.clientY - rect.top) / rect.height) * 160;
            return { x: Math.min(1, Math.max(0, pxToX(x))), y: Math.min(1.5, Math.max(-0.5, pxToY(y))) };
        };
        const down = control => event => {
            event.preventDefault();
            dragging = control;
            if (!Array.isArray(shot.curve)) shot.curve = currentCurve();
            svg.setPointerCapture?.(event.pointerId);
        };
        handleA.addEventListener('pointerdown', down(0));
        handleB.addEventListener('pointerdown', down(2));
        svg.addEventListener('pointermove', event => {
            if (dragging == null || !Array.isArray(shot.curve)) return;
            const p = point(event);
            shot.curve[dragging] = p.x;
            shot.curve[dragging + 1] = p.y;
            draw();
        });
        const stop = () => { dragging = null; };
        svg.addEventListener('pointerup', stop);
        svg.addEventListener('pointercancel', stop);

        wrap.appendChild(svg);

        const presets = document.createElement('div');
        presets.className = 'sd-curve-presets';
        [
            ['Linear', [0, 0, 1, 1]],
            ['Ease', [0.42, 0, 0.58, 1]],
            ['In', [0.42, 0, 1, 1]],
            ['Out', [0, 0, 0.58, 1]],
            ['In-Out', [0.42, 0, 0.58, 1]],
            ['Overshoot', [0.34, 1.56, 0.64, 1]]
        ].forEach(([label, curve]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.onclick = () => {
                shot.curve = [...curve];
                draw();
                this.renderShotDesignerList();
            };
            presets.appendChild(button);
        });
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Reset';
        reset.onclick = () => {
            shot.curve = null;
            this.renderShotDesignerList();
        };
        presets.appendChild(reset);
        wrap.appendChild(presets);

        const hint = document.createElement('small');
        hint.className = 'sd-help';
        hint.textContent = Array.isArray(shot.curve)
            ? 'Drag the handles. Progress above 1 or below 0 creates overshoot.'
            : 'Using the move default easing. Drag a handle to create a custom curve.';
        wrap.appendChild(hint);

        return wrap;
    }

    // PALETTE MANAGEMENT (from pixelArt)
    // =============================================

    renderPalette() {
        const container = document.getElementById('palette-container');
        if (!container) return;

        container.innerHTML = '';

        // Initialize palette groups if not exist
        if (!this.assets.paletteGroups || this.assets.paletteGroups.length === 0) {
            this.assets.paletteGroups = [
                { name: 'Default', colors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'], collapsed: false },
                { name: 'StageCut', colors: ['#00ff41', '#ff006e', '#00d9ff', '#ffd700', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'], collapsed: false },
            ];
        }

        this.assets.paletteGroups.forEach((group, groupIndex) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = `palette-group ${group.collapsed ? 'collapsed' : ''}`;
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'palette-group-header';
            groupHeader.innerHTML = `
                <span class="palette-group-toggle">${group.collapsed ? '▶' : '▼'}</span>
                <span class="palette-group-name">${group.name}</span>
                <button class="palette-group-delete" data-group="${groupIndex}" title="Delete group">&times;</button>
            `;

            const toggle = groupHeader.querySelector('.palette-group-toggle');
            const deleteBtn = groupHeader.querySelector('.palette-group-delete');

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                group.collapsed = !group.collapsed;
                this.renderPalette();
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.assets.paletteGroups.length <= 1) return;
                if (confirm(`Delete group "${group.name}"?`)) {
                    this.assets.paletteGroups.splice(groupIndex, 1);
                    this.saveAssets();
                    this.renderPalette();
                }
            });

            groupHeader.addEventListener('click', () => {
                // Select this group
                this.assets.activePaletteGroup = groupIndex;
                this.renderPalette();
            });

            groupContainer.appendChild(groupHeader);

            const colorsContainer = document.createElement('div');
            colorsContainer.className = 'palette-group-colors';

            group.colors.forEach((color, colorIndex) => {
                const swatch = document.createElement('div');
                swatch.className = 'swatch';
                swatch.style.backgroundColor = color;
                swatch.title = color;
                
                const isActive = this.app?.selectedObject?.userData?.color === color || 
                                 (groupIndex === this.assets.activePaletteGroup && color === document.getElementById('colorPicker')?.value);
                if (isActive) swatch.classList.add('active');
                if (groupIndex === this.assets.activePaletteGroup) swatch.classList.add('active-group');

                swatch.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.setPaletteColor(color);
                });

                // Right-click to remove
                swatch.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`Remove ${color} from ${group.name}?`)) {
                        group.colors.splice(colorIndex, 1);
                        this.saveAssets();
                        this.renderPalette();
                    }
                });

                colorsContainer.appendChild(swatch);
            });

            groupContainer.appendChild(colorsContainer);
            container.appendChild(groupContainer);
        });
    }

    setPaletteColor(hex) {
        const colorPicker = document.getElementById('colorPicker');
        const colorHex = document.getElementById('colorHex');
        
        if (colorPicker) colorPicker.value = hex;
        if (colorHex) colorHex.value = hex;
        
        // Apply to selected object
        this.app.applyColorToSelected?.(hex);
        
        // Re-render to update active state
        this.renderPalette();
    }

    saveColorToPalette(hex) {
        if (!this.assets.paletteGroups || this.assets.paletteGroups.length === 0) {
            this.assets.paletteGroups = [{ name: 'Default', colors: [], collapsed: false }];
        }
        
        const group = this.assets.paletteGroups[this.assets.activePaletteGroup || 0];
        if (!group.colors.includes(hex)) {
            group.colors.unshift(hex);
            // Limit to 20 colors per group
            if (group.colors.length > 20) group.colors.pop();
            this.saveAssets();
            this.renderPalette();
        }
    }

    importPaletteFromUrl(url) {
        const coolorsRegex = /(?:coolors\.co\/)([a-fA-F0-9]{6}(?:-[a-fA-F0-9]{6})+)/;
        const match = url.match(coolorsRegex);
        if (!match) {
            this.showNotification('Invalid Coolors URL', 'error');
            return;
        }

        const hexCodes = match[1].split('-').map(h => '#' + h.toUpperCase());
        
        const groupName = prompt('Enter a name for this palette group:', 'Imported Palette');
        if (!groupName) return;

        const newGroup = {
            name: groupName,
            colors: hexCodes,
            collapsed: false
        };

        this.assets.paletteGroups.push(newGroup);
        this.assets.activePaletteGroup = this.assets.paletteGroups.length - 1;
        this.saveAssets();
        this.renderPalette();
        
        // Set first color as active
        if (hexCodes.length > 0) this.setPaletteColor(hexCodes[0]);
    }

    addPaletteGroup(name) {
        const newGroup = {
            name: name,
            colors: [],
            collapsed: false
        };
        this.assets.paletteGroups.push(newGroup);
        this.assets.activePaletteGroup = this.assets.paletteGroups.length - 1;
        this.saveAssets();
        this.renderPalette();
    }

    saveAssets() {
        try {
            localStorage.setItem('pixel3d-assets', JSON.stringify(this.assets));
        } catch (error) {
            console.warn('Could not save assets:', error);
        }
    }

    // --- ASSET MANAGEMENT ---
    syncPresetMaterialAssets() {
        for (const material of this.app.materialsManager?.materials || []) {
            const stableId = material.sourceAssetId || `preset-${material.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const existing = this.assets.materials.find(asset => asset.id === stableId);
            material.sourceAssetId = stableId;
            if (existing) { existing.materialId = material.id; continue; }
            const color = `#${material.color.toString(16).padStart(6, '0')}`;
            this.assets.materials.push({
                id: stableId, materialId: material.id, preset: stableId.startsWith('preset-'),
                type: 'materials', name: material.name, color,
                metalness: material.metalness, roughness: material.roughness, opacity: (material.opacity ?? 1) * 100,
                clearcoat: material.clearcoat || 0, transmission: material.transmission || 0, sheen: material.sheen || 0,
                layers: (material.textureLayers || []).map(layer => ({ ...layer })),
                preview: this.generateMaterialPreview(color, material.metalness, material.roughness, material.opacity ?? 1, material.clearcoat || 0, material.transmission || 0, material.sheen || 0, 1, 96, (material.textureLayers || []).map(layer => ({ ...layer })))
            });
        }
        for (const asset of this.assets.materials) this.app.materialsManager?.compileAssetMaterial(asset);
        this.saveAssetLibrary();
    }

    generateAssetId() {
        return `asset-${this.assetIdCounter++}-${Date.now()}`;
    }

    addAsset(type, data) {
        const category = type;
        const asset = {
            id: this.generateAssetId(),
            name: data.name || `New ${type.slice(0, -1)}`,
            type: type,
            ...data
        };
        this.assets[category].push(asset);
        this.saveAssetLibrary();
        this.renderAssetsPanel(category);
        return asset;
    }

    updateAsset(type, id, data) {
        const category = type;
        const index = this.assets[category].findIndex(a => a.id === id);
        if (index !== -1) {
            this.assets[category][index] = { ...this.assets[category][index], ...data };
            this.saveAssetLibrary();
            this.renderAssetsPanel(category);
            return this.assets[category][index];
        }
        return null;
    }

    deleteAsset(type, id) {
        const category = type;
        this.assets[category] = this.assets[category].filter(a => a.id !== id);
        this.saveAssetLibrary();
        this.renderAssetsPanel(category);
    }

    getAsset(type, id) {
        const category = type;
        return this.assets[category].find(a => a.id === id);
    }

    saveAssetLibrary() {
        try {
            localStorage.setItem('pixel3d-assets', JSON.stringify(this.assets));
        } catch (error) {
            this.showNotification('Asset library is too large to save in this browser', 'warning');
        }
    }

    syncLightAsset(obj) {
        const lightObj = obj.children[0];
        if (!lightObj || !obj.userData.lightType) return;

        const existing = this.assets.colors.find(a => a.lightUuid === obj.uuid);
        const data = {
            name: obj.userData.name || `${obj.userData.lightType} light`,
            hex: '#' + lightObj.color.getHexString(),
            intensity: lightObj.intensity,
            castShadow: lightObj.castShadow,
            lightUuid: obj.uuid
        };

        if (existing) {
            this.updateAsset('colors', existing.id, data);
        } else {
            this.addAsset('colors', data);
        }
    }

    openAssetModal(type, assetId = null) {
        const modalMap = {
            materials: 'material-asset-modal',
            textures: 'texture-asset-modal',
            colors: 'color-asset-modal',
            images: 'image-asset-modal',
            media: 'video-asset-modal',
            audio: 'audio-asset-modal'
        };

        const modalId = modalMap[type];
        if (!modalId) return;

        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Get asset data if editing
        const asset = assetId ? this.getAsset(type, assetId) : null;

        // Reset form fields
        this.resetAssetModal(type, assetId);

        // Initialize material color picker
        if (type === 'materials') {
            const colorPicker = document.getElementById('material-color-picker');
            const preview = document.getElementById('material-preview-color');
            const updateMaterialPreview = () => {
                if (!preview) return;
                const color = colorPicker?.value || '#888888';
                const metalness = parseFloat(document.getElementById('material-metalness')?.value ?? 0.2);
                const roughness = parseFloat(document.getElementById('material-roughness')?.value ?? 0.3);
                const opacity = parseFloat(document.getElementById('material-opacity')?.value ?? 100);
                const alpha = parseFloat(document.getElementById('material-alpha')?.value ?? 1);
                const clearcoat = parseFloat(document.getElementById('material-clearcoat')?.value ?? 0);
                const transmission = parseFloat(document.getElementById('material-transmission')?.value ?? 0);
                const sheen = parseFloat(document.getElementById('material-sheen')?.value ?? 0);
                const layers = this.collectMaterialTextureLayers();
                preview.style.backgroundImage = `url('${this.generateMaterialPreview(color, metalness, roughness, opacity, clearcoat, transmission, sheen, alpha, 96, layers)}')`;
                preview.style.backgroundColor = color;
            };
            this.updateMaterialPreview = updateMaterialPreview;
            if (colorPicker && preview) {
                const rgbToHex = (rgb) => {
                    const match = rgb.match(/\d+/g);
                    if (!match || match.length < 3) return '#888888';
                    return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                };
                const currentColor = preview.style.backgroundColor || 'rgb(136, 136, 136)';
                colorPicker.value = rgbToHex(currentColor);
                colorPicker.addEventListener('input', () => {
                    updateMaterialPreview();
                });
            }

            // Initialize compact color picker
            this.initMaterialColorPicker(asset);

            const lightingSlider = document.getElementById('material-lighting');
            const lightingValue = document.getElementById('material-lighting-value');
            if (lightingSlider && lightingValue) {
                lightingSlider.value = asset?.lighting || 0;
                lightingValue.textContent = asset?.lighting || 0;
                lightingSlider.addEventListener('input', (e) => {
                    lightingValue.textContent = e.target.value;
                    updateMaterialPreview();
                });
            }

            const opacitySlider = document.getElementById('material-opacity');
            const opacityValue = document.getElementById('material-opacity-value');
            if (opacitySlider && opacityValue) {
                opacitySlider.value = asset?.opacity || 100;
                opacityValue.textContent = asset?.opacity || 100;
                opacitySlider.addEventListener('input', (e) => {
                    opacityValue.textContent = e.target.value;
                    updateMaterialPreview();
                });
            }

            const alphaInput = document.getElementById('material-alpha');
            if (alphaInput) {
                alphaInput.addEventListener('input', () => {
                    updateMaterialPreview();
                });
            }

            const depthSelect = document.getElementById('material-depth');
            if (depthSelect) {
                depthSelect.value = asset?.depth || 'none';
                depthSelect.onchange = () => {
                    if (depthSelect.value === 'none') return;
                    const layers = this.collectMaterialTextureLayers();
                    layers.push(this.defaultTextureLayer(depthSelect.value));
                    this.renderMaterialTextureLayers(layers);
                    updateMaterialPreview();
                    depthSelect.value = 'none';
                };
            }

            const materialLayers = asset?.layers?.length > 0 ? asset.layers : [{ type: 'color', color: this._materialColorState ? rgbToHex(hslToRgb({ h: this._materialColorState.h, s: this._materialColorState.s, l: this._materialColorState.l })) : '#888888', opacity: 100, enabled: true, blendMode: 'normal' }];
            this.renderMaterialTextureLayers(materialLayers);
            updateMaterialPreview();

            const materialValues = {
                metalness: asset?.metalness ?? 0.2, roughness: asset?.roughness ?? 0.3,
                clearcoat: asset?.clearcoat ?? 0, transmission: asset?.transmission ?? 0, sheen: asset?.sheen ?? 0
            };
            Object.entries(materialValues).forEach(([key, value]) => {
                const input = document.getElementById(`material-${key}`);
                const output = document.getElementById(`material-${key}-value`);
                if (input) input.value = value;
                if (output) output.textContent = Number(value).toFixed(2);
                if (input) input.oninput = () => {
                    if (output) output.textContent = Number(input.value).toFixed(2);
                    updateMaterialPreview();
                };
            });
        }

        if (type === 'textures') this.initTextureAssetEditor(asset);

        // Initialize color editor
        if (type === 'colors') {
            this.initColorEditor(asset);
        }

        // Add layer button for materials
        if (type === 'materials') {
            const addLayerBtn = document.getElementById('add-material-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.onclick = () => {
                    const layers = this.collectMaterialTextureLayers();
                    layers.push(this.defaultTextureLayer('color'));
                    this.renderMaterialTextureLayers(layers);
                };
            }
            const presetButtons = modal.querySelectorAll('.preset-btn');
            if (presetButtons.length) {
                presetButtons.forEach(btn => {
                    btn.onclick = () => this.applyMaterialPreset(btn.dataset.preset);
                });
            }
        }

        // Show modal
        modal.classList.add('open');

        // Store current editing asset id
        modal.dataset.editingAssetId = assetId || '';
        modal.dataset.editingAssetType = type;
    }

    closeAssetModal(type) {
        const modalMap = {
            materials: 'material-asset-modal',
            textures: 'texture-asset-modal',
            colors: 'color-asset-modal',
            images: 'image-asset-modal',
            media: 'video-asset-modal',
            audio: 'audio-asset-modal'
        };

        const modalId = modalMap[type];
        if (!modalId) return;

        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            delete modal.dataset.editingAssetId;
            delete modal.dataset.editingAssetType;
        }
    }

    initColorEditor(asset) {
        let hsl = { h: 0, s: 0, l: 50 };
        let a = 1;

        if (asset) {
            if (asset.hsl) {
                hsl = { ...asset.hsl };
            } else if (asset.hex) {
                const rgb = hexToRgb(asset.hex);
                hsl = rgbToHsl(rgb);
            }
            a = asset.alpha ?? 1;
        }

        this._colorEditorState = { ...hsl, a };
        this.updateColorEditorUI();
        this.setupColorFormatSelector();
    }

    initMaterialColorPicker(asset) {
        let hsl = { h: 0, s: 0, l: 50 };
        let a = 1;

        if (asset) {
            const color = asset.color || '#888888';
            const rgb = hexToRgb(color);
            hsl = rgbToHsl(rgb);
            a = asset.alpha ?? 1;
        }

        this._materialColorState = { ...hsl, a };
        this.updateMaterialColorPickerUI();
        this.setupMaterialColorPicker();
    }

    setupMaterialColorPicker() {
        this.setupMaterialSLPicker();
        this.setupMaterialColorSlider('material-hue-slider', 0, 360, (v) => {
            this._materialColorState.h = v;
            this.updateMaterialColorPickerUI();
        });
        this.setupMaterialColorSlider('material-saturation-slider', 0, 100, (v) => {
            this._materialColorState.s = v;
            this.updateMaterialColorPickerUI();
        });
        this.setupMaterialColorSlider('material-lightness-slider', 0, 100, (v) => {
            this._materialColorState.l = v;
            this.updateMaterialColorPickerUI();
        });
    }

    updateMaterialColorPickerUI() {
        const state = this._materialColorState;
        if (!state) return;

        const rgb = hslToRgb({ h: state.h, s: state.s, l: state.l });
        const hex = rgbToHex(rgb);

        const slPicker = document.getElementById('material-color-sl-picker');
        if (slPicker) {
            const hueColor = `hsl(${state.h}, 100%, 50%)`;
            slPicker.style.background = `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, transparent),
                linear-gradient(to right, ${hueColor}, #888)
            `;
        }

        const slThumb = slPicker?.querySelector('.color-sl-thumb');
        if (slThumb) {
            slThumb.style.left = `${state.s}%`;
            slThumb.style.top = `${100 - state.l}%`;
        }

        const preview = document.getElementById('material-color-preview-swatch');
        if (preview) {
            preview.style.backgroundColor = `rgba(${Math.round(rgb.r*255)}, ${Math.round(rgb.g*255)}, ${Math.round(rgb.b*255)}, ${state.a})`;
        }

        const hueSlider = document.getElementById('material-hue-slider');
        const hueThumb = hueSlider?.querySelector('.slider-thumb');
        if (hueThumb) {
            hueThumb.style.left = `${(state.h / 360) * 100}%`;
        }
        const hueValue = document.getElementById('material-hue-value');
        if (hueValue) hueValue.value = Math.round(state.h);

        const satSlider = document.getElementById('material-saturation-slider');
        const satThumb = satSlider?.querySelector('.slider-thumb');
        if (satThumb) {
            satThumb.style.left = `${state.s}%`;
        }
        const satValue = document.getElementById('material-saturation-value');
        if (satValue) satValue.value = Math.round(state.s);

        const lightSlider = document.getElementById('material-lightness-slider');
        const lightThumb = lightSlider?.querySelector('.slider-thumb');
        if (lightThumb) {
            lightThumb.style.left = `${state.l}%`;
        }
        const lightValue = document.getElementById('material-lightness-value');
        if (lightValue) lightValue.value = Math.round(state.l);

        // Sync hidden native color input
        const colorPicker = document.getElementById('material-color-picker');
        if (colorPicker) {
            colorPicker.value = hex;
        }

        // Keep the base colour layer in step with the sliders (otherwise it paints over the preview)
        const baseLayer = [...document.querySelectorAll('#material-asset-items .material-texture-layer')].find(el => el.querySelector('.layer-select')?.value === 'color');
        const layerColor = baseLayer?.querySelector('[data-prop="color"]');
        if (layerColor && layerColor.value !== hex) {
            layerColor.value = hex;
            layerColor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            this.updateMaterialPreview?.();
        }
    }

    setupMaterialSLPicker() {
        const picker = document.getElementById('material-color-sl-picker');
        if (!picker || picker._slPickerSetup) return;
        picker._slPickerSetup = true;

        let isDragging = false;

        const updateFromEvent = (e) => {
            const rect = picker.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            this._materialColorState.s = x * 100;
            this._materialColorState.l = (1 - y) * 100;
            this.updateMaterialColorPickerUI();
        };

        picker.style.touchAction = 'none';
        picker.addEventListener('pointerdown', (e) => {
            isDragging = true;
            e.preventDefault();
            try { picker.setPointerCapture(e.pointerId); } catch (_) {}
            updateFromEvent(e);
        });
        picker.addEventListener('pointermove', (e) => { if (isDragging) updateFromEvent(e); });
        const endDrag = () => { isDragging = false; };
        picker.addEventListener('pointerup', endDrag);
        picker.addEventListener('pointercancel', endDrag);
    }

    setupMaterialColorSlider(id, min, max, onChange) {
        const slider = document.getElementById(id);
        if (!slider) return;

        const track = slider.querySelector('.slider-track');
        const thumb = slider.querySelector('.slider-thumb');
        if (!track || !thumb) return;

        const setValue = (value) => {
            value = Math.max(min, Math.min(max, value));
            const percent = (value - min) / (max - min) * 100;
            thumb.style.left = `${percent}%`;
            onChange(value);
        };

        const updateFromEvent = (e) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const value = min + x * (max - min);
            setValue(value);
        };

        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            e.preventDefault();
            updateFromEvent(e);
        };

        const onMouseMove = (e) => {
            if (isDragging) updateFromEvent(e);
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        slider.style.touchAction = 'none';
        ['mousedown', 'pointerdown'].forEach(evt => {
            slider.addEventListener(evt, startDrag);
        });
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        slider.addEventListener('pointermove', onMouseMove);
        slider.addEventListener('pointerup', onMouseUp);
        slider.addEventListener('pointercancel', onMouseUp);

        const valueInput = document.getElementById(id.replace('-slider', '-value'));
        if (valueInput) {
            valueInput.addEventListener('input', () => {
                const value = parseFloat(valueInput.value);
                if (!isNaN(value)) setValue(value);
            });
        }
    }

    setupColorEditor() {
        this.setupSLPicker();
        this.setupColorSlider('hue-slider', 0, 360, (v) => {
            this._colorEditorState.h = v;
            this.updateColorEditorUI();
        });
        this.setupColorSlider('saturation-slider', 0, 100, (v) => {
            this._colorEditorState.s = v;
            this.updateColorEditorUI();
        });
        this.setupColorSlider('transparency-slider', 0, 100, (v) => {
            this._colorEditorState.a = v / 100;
            this.updateColorEditorUI();
        });

        this.setupColorValueInputs();
        this.setupColorEyedropper();
    }

    updateColorEditorUI() {
        const state = this._colorEditorState;
        if (!state) return;

        const rgb = hslToRgb({ h: state.h, s: state.s, l: state.l });

        const slPicker = document.getElementById('color-sl-picker');
        if (slPicker) {
            const hueColor = `hsl(${state.h}, 100%, 50%)`;
            slPicker.style.background = `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, transparent),
                linear-gradient(to right, ${hueColor}, #888)
            `;
        }

        const slThumb = slPicker?.querySelector('.color-sl-thumb');
        if (slThumb) {
            slThumb.style.left = `${state.s}%`;
            slThumb.style.top = `${100 - state.l}%`;
        }

        const preview = document.getElementById('color-preview-swatch');
        if (preview) {
            preview.style.backgroundColor = `rgba(${Math.round(rgb.r*255)}, ${Math.round(rgb.g*255)}, ${Math.round(rgb.b*255)}, ${state.a})`;
        }

        const hueSlider = document.getElementById('hue-slider');
        const hueThumb = hueSlider?.querySelector('.slider-thumb');
        if (hueThumb) {
            hueThumb.style.left = `${(state.h / 360) * 100}%`;
        }
        const hueValue = document.getElementById('hue-value');
        if (hueValue) hueValue.value = Math.round(state.h);

        const satSlider = document.getElementById('saturation-slider');
        const satThumb = satSlider?.querySelector('.slider-thumb');
        if (satThumb) {
            satThumb.style.left = `${state.s}%`;
        }
        const satValue = document.getElementById('saturation-value');
        if (satValue) satValue.value = Math.round(state.s);

        const transSlider = document.getElementById('transparency-slider');
        const transThumb = transSlider?.querySelector('.slider-thumb');
        if (transThumb) {
            transThumb.style.left = `${state.a * 100}%`;
        }
        const transValue = document.getElementById('transparency-value');
        if (transValue) transValue.value = Math.round(state.a * 100);

        this.updateColorFormatInputs();
    }

    getColorEditorState() {
        return this._colorEditorState;
    }

    setupSLPicker() {
        const picker = document.getElementById('color-sl-picker');
        if (!picker || picker._slPickerSetup) return;
        picker._slPickerSetup = true;

        let isDragging = false;

        const updateFromEvent = (e) => {
            const rect = picker.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            this._colorEditorState.s = x * 100;
            this._colorEditorState.l = (1 - y) * 100;
            this.updateColorEditorUI();
        };

        picker.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateFromEvent(e);
        });

        const onMouseMove = (e) => {
            if (isDragging) updateFromEvent(e);
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setupColorSlider(sliderId, min, max, onChange) {
        const slider = document.getElementById(sliderId);
        if (!slider || slider._sliderSetup) return;
        slider._sliderSetup = true;

        const thumb = slider.querySelector('.slider-thumb');

        let isDragging = false;

        const updateFromEvent = (e) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const value = min + x * (max - min);
            onChange(value);
            if (thumb) {
                thumb.style.left = `${x * 100}%`;
            }
        };

        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateFromEvent(e);
        });

        const onMouseMove = (e) => {
            if (isDragging) updateFromEvent(e);
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setupColorValueInputs() {
        if (this._colorValueInputsSetup) return;
        this._colorValueInputsSetup = true;

        const hueValue = document.getElementById('hue-value');
        if (hueValue) {
            hueValue.addEventListener('input', (e) => {
                this._colorEditorState.h = Math.max(0, Math.min(360, parseFloat(e.target.value) || 0));
                this.updateColorEditorUI();
            });
        }

        const satValue = document.getElementById('saturation-value');
        if (satValue) {
            satValue.addEventListener('input', (e) => {
                this._colorEditorState.s = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                this.updateColorEditorUI();
            });
        }

        const transValue = document.getElementById('transparency-value');
        if (transValue) {
            transValue.addEventListener('input', (e) => {
                const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                this._colorEditorState.a = val / 100;
                this.updateColorEditorUI();
            });
        }
    }

    setupColorFormatSelector() {
        if (this._colorFormatSelectorSetup) return;
        this._colorFormatSelectorSetup = true;

        const formatSelect = document.getElementById('color-format-select');
        const formatInputs = document.getElementById('color-format-inputs');
        if (!formatSelect || !formatInputs) return;

        const renderFormatInputs = () => {
            const format = formatSelect.value;
            const state = this._colorEditorState;
            if (!state) return;
            const rgb = hslToRgb({ h: state.h, s: state.s, l: state.l });

            let html = '';
            switch (format) {
                case 'hex':
                    html = `<input type="text" class="color-format-input" id="fmt-hex" value="${rgbToHex(rgb)}" maxlength="7">`;
                    break;
                case 'rgb':
                    html = `
                        <input type="number" class="color-format-input" id="fmt-r" value="${Math.round(rgb.r*255)}" min="0" max="255">
                        <input type="number" class="color-format-input" id="fmt-g" value="${Math.round(rgb.g*255)}" min="0" max="255">
                        <input type="number" class="color-format-input" id="fmt-b" value="${Math.round(rgb.b*255)}" min="0" max="255">
                    `;
                    break;
                case 'css':
                    html = `<input type="text" class="color-format-input" id="fmt-css" value="rgb(${Math.round(rgb.r*255)}, ${Math.round(rgb.g*255)}, ${Math.round(rgb.b*255)})">`;
                    break;
                case 'hsl':
                    html = `
                        <input type="number" class="color-format-input" id="fmt-h" value="${Math.round(state.h)}" min="0" max="360">
                        <input type="number" class="color-format-input" id="fmt-s" value="${Math.round(state.s)}" min="0" max="100">
                        <input type="number" class="color-format-input" id="fmt-l" value="${Math.round(state.l)}" min="0" max="100">
                    `;
                    break;
                case 'hsb': {
                    const hsv = rgbToHsv(rgb);
                    html = `
                        <input type="number" class="color-format-input" id="fmt-h" value="${Math.round(hsv.h)}" min="0" max="360">
                        <input type="number" class="color-format-input" id="fmt-s" value="${Math.round(hsv.s)}" min="0" max="100">
                        <input type="number" class="color-format-input" id="fmt-v" value="${Math.round(hsv.v)}" min="0" max="100">
                    `;
                    break;
                }
            }
            formatInputs.innerHTML = html;

            setTimeout(() => {
                if (format === 'hex') {
                    const hexInput = document.getElementById('fmt-hex');
                    if (hexInput) {
                        hexInput.addEventListener('input', (e) => {
                            const val = e.target.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                const rgb2 = hexToRgb(val);
                                const hsl2 = rgbToHsl(rgb2);
                                this._colorEditorState.h = hsl2.h;
                                this._colorEditorState.s = hsl2.s;
                                this._colorEditorState.l = hsl2.l;
                                this.updateColorEditorUI();
                            }
                        });
                    }
                } else if (format === 'rgb') {
                    ['r', 'g', 'b'].forEach(channel => {
                        const input = document.getElementById(`fmt-${channel}`);
                        if (input) {
                            input.addEventListener('input', (e) => {
                                const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                                const rgb2 = { ...hslToRgb({ h: state.h, s: state.s, l: state.l }), [channel]: val / 255 };
                                const hsl2 = rgbToHsl(rgb2);
                                this._colorEditorState.h = hsl2.h;
                                this._colorEditorState.s = hsl2.s;
                                this._colorEditorState.l = hsl2.l;
                                this.updateColorEditorUI();
                            });
                        }
                    });
                } else if (format === 'css') {
                    const cssInput = document.getElementById('fmt-css');
                    if (cssInput) {
                        cssInput.addEventListener('input', (e) => {
                            const val = e.target.value;
                            const match = val.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
                            if (match) {
                                const rgb2 = { r: parseInt(match[1])/255, g: parseInt(match[2])/255, b: parseInt(match[3])/255 };
                                const hsl2 = rgbToHsl(rgb2);
                                this._colorEditorState.h = hsl2.h;
                                this._colorEditorState.s = hsl2.s;
                                this._colorEditorState.l = hsl2.l;
                                this.updateColorEditorUI();
                            }
                        });
                    }
                } else if (format === 'hsl') {
                    ['h', 's', 'l'].forEach(channel => {
                        const input = document.getElementById(`fmt-${channel}`);
                        if (input) {
                            input.addEventListener('input', (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (channel === 'h') this._colorEditorState.h = Math.max(0, Math.min(360, val));
                                if (channel === 's') this._colorEditorState.s = Math.max(0, Math.min(100, val));
                                if (channel === 'l') this._colorEditorState.l = Math.max(0, Math.min(100, val));
                                this.updateColorEditorUI();
                            });
                        }
                    });
                } else if (format === 'hsb') {
                    ['h', 's', 'v'].forEach(channel => {
                        const input = document.getElementById(`fmt-${channel}`);
                        if (input) {
                            input.addEventListener('input', (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const hsv = rgbToHsv(hslToRgb({ h: state.h, s: state.s, l: state.l }));
                                if (channel === 'h') hsv.h = Math.max(0, Math.min(360, val));
                                if (channel === 's') hsv.s = Math.max(0, Math.min(100, val));
                                if (channel === 'v') hsv.v = Math.max(0, Math.min(100, val));
                                const rgb2 = hsvToRgb(hsv);
                                const hsl2 = rgbToHsl(rgb2);
                                this._colorEditorState.h = hsl2.h;
                                this._colorEditorState.s = hsl2.s;
                                this._colorEditorState.l = hsl2.l;
                                this.updateColorEditorUI();
                            });
                        }
                    });
                }
            }, 0);
        };

        formatSelect.addEventListener('change', renderFormatInputs);
        renderFormatInputs();
    }

    setupColorEyedropper() {
        if (this._colorEyedropperSetup) return;
        this._colorEyedropperSetup = true;

        const btn = document.getElementById('color-eyedropper-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'color';
            const state = this._colorEditorState;
            const rgb = hslToRgb({ h: state.h, s: state.s, l: state.l });
            input.value = rgbToHex(rgb);
            input.style.position = 'fixed';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            document.body.appendChild(input);
            input.click();

            input.addEventListener('input', (e) => {
                const rgb2 = hexToRgb(e.target.value);
                const hsl2 = rgbToHsl(rgb2);
                this._colorEditorState.h = hsl2.h;
                this._colorEditorState.s = hsl2.s;
                this._colorEditorState.l = hsl2.l;
                this.updateColorEditorUI();
            });

            input.addEventListener('blur', () => {
                input.remove();
            });
        });
    }

    updateColorFormatInputs() {
        const formatSelect = document.getElementById('color-format-select');
        const formatInputs = document.getElementById('color-format-inputs');
        if (!formatSelect || !formatInputs) return;

        const format = formatSelect.value;
        const state = this._colorEditorState;
        if (!state) return;
        const rgb = hslToRgb({ h: state.h, s: state.s, l: state.l });

        switch (format) {
            case 'hex': {
                const hexInput = document.getElementById('fmt-hex');
                if (hexInput) hexInput.value = rgbToHex(rgb);
                break;
            }
            case 'rgb': {
                const rInput = document.getElementById('fmt-r');
                const gInput = document.getElementById('fmt-g');
                const bInput = document.getElementById('fmt-b');
                if (rInput) rInput.value = Math.round(rgb.r * 255);
                if (gInput) gInput.value = Math.round(rgb.g * 255);
                if (bInput) bInput.value = Math.round(rgb.b * 255);
                break;
            }
            case 'css': {
                const cssInput = document.getElementById('fmt-css');
                if (cssInput) cssInput.value = `rgb(${Math.round(rgb.r*255)}, ${Math.round(rgb.g*255)}, ${Math.round(rgb.b*255)})`;
                break;
            }
            case 'hsl': {
                const hInput = document.getElementById('fmt-h');
                const sInput = document.getElementById('fmt-s');
                const lInput = document.getElementById('fmt-l');
                if (hInput) hInput.value = Math.round(state.h);
                if (sInput) sInput.value = Math.round(state.s);
                if (lInput) lInput.value = Math.round(state.l);
                break;
            }
            case 'hsb': {
                const hsv = rgbToHsv(rgb);
                const hInput = document.getElementById('fmt-h');
                const sInput = document.getElementById('fmt-s');
                const vInput = document.getElementById('fmt-v');
                if (hInput) hInput.value = Math.round(hsv.h);
                if (sInput) sInput.value = Math.round(hsv.s);
                if (vInput) vInput.value = Math.round(hsv.v);
                break;
            }
        }
    }

    resetAssetModal(type, assetId = null) {
        if (type === 'materials') {
            const nameInput = document.getElementById('material-asset-name');
            const alphaInput = document.getElementById('material-alpha');
            const itemsContainer = document.getElementById('material-asset-items');
            const lightingSlider = document.getElementById('material-lighting');
            const lightingValue = document.getElementById('material-lighting-value');
            const opacitySlider = document.getElementById('material-opacity');
            const opacityValue = document.getElementById('material-opacity-value');
            const depthSelect = document.getElementById('material-depth');
            const colorPicker = document.getElementById('material-color-picker');
            const metalnessInput = document.getElementById('material-metalness');
            const metalnessValue = document.getElementById('material-metalness-value');
            const roughnessInput = document.getElementById('material-roughness');
            const roughnessValue = document.getElementById('material-roughness-value');
            const clearcoatInput = document.getElementById('material-clearcoat');
            const clearcoatValue = document.getElementById('material-clearcoat-value');
            const transmissionInput = document.getElementById('material-transmission');
            const transmissionValue = document.getElementById('material-transmission-value');
            const sheenInput = document.getElementById('material-sheen');
            const sheenValue = document.getElementById('material-sheen-value');
            if (nameInput) nameInput.value = '';
            if (alphaInput) alphaInput.value = '1';
            if (colorPicker) colorPicker.value = '#888888';
            if (metalnessInput) metalnessInput.value = '0.2';
            if (metalnessValue) metalnessValue.textContent = '0.20';
            if (roughnessInput) roughnessInput.value = '0.3';
            if (roughnessValue) roughnessValue.textContent = '0.30';
            if (clearcoatInput) clearcoatInput.value = '0';
            if (clearcoatValue) clearcoatValue.textContent = '0.00';
            if (transmissionInput) transmissionInput.value = '0';
            if (transmissionValue) transmissionValue.textContent = '0.00';
            if (sheenInput) sheenInput.value = '0';
            if (sheenValue) sheenValue.textContent = '0.00';
            if (itemsContainer) {
                itemsContainer.innerHTML = '';
                const color = colorPicker?.value || '#888888';
                this.renderMaterialTextureLayers([{ type: 'color', color: color, opacity: 100, enabled: true, blendMode: 'normal' }]);
            }
            if (lightingSlider) {
                lightingSlider.value = '0';
                if (lightingValue) lightingValue.textContent = '0';
            }
            if (opacitySlider) {
                opacitySlider.value = '100';
                if (opacityValue) opacityValue.textContent = '100';
            }
            if (depthSelect) depthSelect.value = 'none';
            const preview = document.getElementById('material-preview-color');
            if (preview) {
                preview.style.backgroundImage = `url('${this.generateMaterialPreview('#888888', 0.2, 0.3, 1, 0, 0, 0, 1)}')`;
                preview.style.backgroundColor = '#888888';
            }
        } else if (type === 'textures') {
            const name = document.getElementById('texture-asset-name');
            if (name) name.value = '';
        } else if (type === 'colors') {
            const nameInput = document.getElementById('color-asset-name');
            const hueValue = document.getElementById('hue-value');
            const saturationValue = document.getElementById('saturation-value');
            const transparencyValue = document.getElementById('transparency-value');
            const formatSelect = document.getElementById('color-format-select');
            const formatInputs = document.getElementById('color-format-inputs');
            const preview = document.getElementById('color-preview-swatch');
            if (nameInput) nameInput.value = '';
            if (hueValue) hueValue.value = '0';
            if (saturationValue) saturationValue.value = '0';
            if (transparencyValue) transparencyValue.value = '100';
            if (formatSelect) formatSelect.value = 'hex';
            if (formatInputs) formatInputs.innerHTML = '';
            if (preview) preview.style.backgroundColor = '#808080';
            this._colorEditorState = { h: 0, s: 0, l: 50, a: 1 };
            this.updateColorEditorUI();
        } else if (type === 'images') {
            const nameInput = document.getElementById('image-asset-name');
            const preview = document.getElementById('image-preview');
            const urlInput = document.getElementById('image-asset-url');
            if (nameInput) nameInput.value = '';
            if (preview) {
                preview.classList.add('broken');
                preview.src = '';
                preview.onerror = () => { preview.classList.add('broken'); };
                preview.onload = () => { preview.classList.remove('broken'); };
            }
            if (urlInput) urlInput.value = '';
        } else if (type === 'media') {
            const nameInput = document.getElementById('video-asset-name');
            const preview = document.getElementById('video-preview');
            const urlInput = document.getElementById('video-asset-url');
            if (nameInput) nameInput.value = '';
            if (preview) {
                preview.classList.add('broken');
                preview.src = '';
                preview.onerror = () => { preview.classList.add('broken'); };
                preview.onload = () => { preview.classList.remove('broken'); };
            }
            if (urlInput) urlInput.value = '';
        } else if (type === 'audio') {
            const nameInput = document.getElementById('audio-asset-name');
            const fileName = document.getElementById('audio-file-name');
            const urlInput = document.getElementById('audio-asset-url');
            if (nameInput) nameInput.value = '';
            if (fileName) fileName.textContent = 'success.mp3';
            if (urlInput) urlInput.value = '';
        }

        // If editing existing asset, populate form
        if (assetId) {
            const asset = this.getAsset(type, assetId);
            if (!asset) return;

            if (type === 'materials') {
                const nameInput = document.getElementById('material-asset-name');
                if (nameInput) nameInput.value = asset.name || '';
                const preview = document.getElementById('material-preview-color');
                if (preview && asset.color) {
                    preview.style.backgroundImage = `url('${this.generateMaterialPreview(
                        asset.color,
                        asset.metalness ?? 0.2,
                        asset.roughness ?? 0.3,
                        asset.opacity ?? 100,
                        asset.clearcoat ?? 0,
                        asset.transmission ?? 0,
                        asset.sheen ?? 0,
                        asset.alpha ?? 1,
                        96,
                        asset.layers || []
                    )}')`;
                    preview.style.backgroundColor = asset.color;
                }
                const lightingSlider = document.getElementById('material-lighting');
                const lightingValue = document.getElementById('material-lighting-value');
                if (lightingSlider) {
                    lightingSlider.value = asset.lighting || 0;
                    if (lightingValue) lightingValue.textContent = asset.lighting || 0;
                }
                const opacitySlider = document.getElementById('material-opacity');
                const opacityValue = document.getElementById('material-opacity-value');
                if (opacitySlider) {
                    opacitySlider.value = asset.opacity || 100;
                    if (opacityValue) opacityValue.textContent = asset.opacity || 100;
                }
                const depthSelect = document.getElementById('material-depth');
                if (depthSelect) depthSelect.value = asset.depth || 'none';

                // Render existing layers
                this.renderMaterialTextureLayers(asset.layers || []);
            } else if (type === 'colors') {
                const nameInput = document.getElementById('color-asset-name');
                if (nameInput) nameInput.value = asset.name || '';
                let hsl = { h: 0, s: 0, l: 50 };
                if (asset.hex) {
                    const rgb = hexToRgb(asset.hex);
                    hsl = rgbToHsl(rgb);
                }
                if (asset.hsl) {
                    hsl = asset.hsl;
                }
                const colorState = { ...hsl, a: asset.alpha ?? 1 };
                this._colorEditorState = colorState;
                this.updateColorEditorUI();
            } else if (type === 'images') {
                const nameInput = document.getElementById('image-asset-name');
                const preview = document.getElementById('image-preview');
                const urlInput = document.getElementById('image-asset-url');
                if (nameInput) nameInput.value = asset.name || '';
                if (preview) {
                    preview.onerror = () => { preview.classList.add('broken'); };
                    preview.onload = () => { preview.classList.remove('broken'); };
                    if (asset.url) {
                        preview.src = asset.url;
                    } else {
                        preview.classList.add('broken');
                        preview.src = '';
                    }
                }
                if (urlInput) urlInput.value = asset.url || '';
            } else if (type === 'media') {
                const nameInput = document.getElementById('video-asset-name');
                const preview = document.getElementById('video-preview');
                const urlInput = document.getElementById('video-asset-url');
                if (nameInput) nameInput.value = asset.name || '';
                if (preview) {
                    preview.onerror = () => { preview.classList.add('broken'); };
                    preview.onload = () => { preview.classList.remove('broken'); };
                    if (asset.url) {
                        preview.src = asset.url;
                    } else {
                        preview.classList.add('broken');
                        preview.src = '';
                    }
                }
                if (urlInput) urlInput.value = asset.url || '';
            } else if (type === 'audio') {
                const nameInput = document.getElementById('audio-asset-name');
                const fileName = document.getElementById('audio-file-name');
                const urlInput = document.getElementById('audio-asset-url');
                if (nameInput) nameInput.value = asset.name || '';
                if (fileName && asset.fileName) fileName.textContent = asset.fileName;
                if (urlInput) urlInput.value = asset.url || '';
            }
        }
    }

    saveAsset(type) {
        const modalMap = {
            materials: 'material-asset-modal',
            textures: 'texture-asset-modal',
            colors: 'color-asset-modal',
            images: 'image-asset-modal',
            media: 'video-asset-modal',
            audio: 'audio-asset-modal'
        };

        const modalId = modalMap[type];
        if (!modalId) return;

        const modal = document.getElementById(modalId);
        if (!modal) return;

        const editingId = modal.dataset.editingAssetId;
        const editingType = modal.dataset.editingAssetType;

        let data = {};

        if (type === 'materials') {
            const nameInput = document.getElementById('material-asset-name');
            const preview = document.getElementById('material-preview-color');
            const lightingSlider = document.getElementById('material-lighting');
            const opacitySlider = document.getElementById('material-opacity');
            const depthSelect = document.getElementById('material-depth');
            data.name = nameInput ? nameInput.value.trim() : 'New Material';
            if (preview) data.color = preview.style.backgroundColor || '#888888';
            data.alpha = parseFloat(document.getElementById('material-alpha')?.value || 1);
            data.lighting = lightingSlider ? parseInt(lightingSlider.value) : 0;
            data.opacity = opacitySlider ? parseInt(opacitySlider.value) : 100;
            data.depth = depthSelect ? depthSelect.value : 'none';
            data.metalness = parseFloat(document.getElementById('material-metalness')?.value ?? 0.2);
            data.roughness = parseFloat(document.getElementById('material-roughness')?.value ?? 0.3);
            data.clearcoat = parseFloat(document.getElementById('material-clearcoat')?.value ?? 0);
            data.transmission = parseFloat(document.getElementById('material-transmission')?.value ?? 0);
            data.sheen = parseFloat(document.getElementById('material-sheen')?.value ?? 0);

            const layersContainer = document.getElementById('material-asset-items');
            let layers = [];
            if (layersContainer) {
                layers = this.collectMaterialTextureLayers();
                data.layers = layers;
            }

            data.preview = this.generateMaterialPreview(
                data.color,
                data.metalness,
                data.roughness,
                data.opacity / 100,
                data.clearcoat,
                data.transmission,
                data.sheen,
                data.alpha,
                96,
                layers
            );
        } else if (type === 'textures') {
            const layer = this.readTextureAssetEditor();
            data.name = document.getElementById('texture-asset-name')?.value.trim() || `${layer.type} Texture`;
            data.layer = layer;
            data.preview = document.getElementById('texture-asset-preview')?.toDataURL('image/png') || '';
        } else if (type === 'colors') {
            const nameInput = document.getElementById('color-asset-name');
            const preview = document.getElementById('color-preview-swatch');
            data.name = nameInput ? nameInput.value.trim() : 'New Color';
            const colorState = this.getColorEditorState();
            if (colorState) {
                data.hex = rgbToHex(hslToRgb({ h: colorState.h, s: colorState.s, l: colorState.l }));
                data.alpha = colorState.a;
                data.hsl = { h: colorState.h, s: colorState.s, l: colorState.l };
            } else {
                data.hex = preview ? preview.style.backgroundColor || '#808080' : '#808080';
                data.alpha = 1;
            }
        } else if (type === 'images') {
            const nameInput = document.getElementById('image-asset-name');
            const preview = document.getElementById('image-preview');
            const urlInput = document.getElementById('image-asset-url');
            data.name = nameInput ? nameInput.value.trim() : 'New Image';
            data.url = urlInput ? urlInput.value.trim() : (preview?.src || '');
        } else if (type === 'media') {
            const nameInput = document.getElementById('video-asset-name');
            const preview = document.getElementById('video-preview');
            const urlInput = document.getElementById('video-asset-url');
            data.name = nameInput ? nameInput.value.trim() : 'New Video';
            data.url = urlInput ? urlInput.value.trim() : (preview?.src || '');
        } else if (type === 'audio') {
            const nameInput = document.getElementById('audio-asset-name');
            const fileName = document.getElementById('audio-file-name');
            const urlInput = document.getElementById('audio-asset-url');
            data.name = nameInput ? nameInput.value.trim() : 'New Audio';
            data.fileName = fileName ? fileName.textContent : '';
            data.url = urlInput ? urlInput.value.trim() : '';
        }

        let savedAsset = null;
        if (editingId) {
            savedAsset = this.updateAsset(editingType, editingId, data);
        } else {
            savedAsset = this.addAsset(type, data);
        }

        if (type === 'materials' && savedAsset) this.app.materialsManager?.compileAssetMaterial(savedAsset);

        this.closeAssetModal(type);
    }

    initTextureAssetEditor(asset = null) {
        const typeSelect = document.getElementById('texture-asset-type');
        const nameInput = document.getElementById('texture-asset-name');
        if (!typeSelect) return;
        typeSelect.innerHTML = this.textureLayerTypes().map(type => `<option value="${type}">${type[0].toUpperCase() + type.slice(1)}</option>`).join('');
        let layer = asset?.layer ? { ...this.defaultTextureLayer(asset.layer.type || 'gradient'), ...asset.layer } : this.defaultTextureLayer('gradient');
        if (nameInput) nameInput.value = asset?.name || '';
        const render = () => {
            const panel = document.getElementById('texture-asset-properties');
            if (!panel) return;
            panel.innerHTML = this.textureLayerFields(layer);
            panel.querySelectorAll('input,select').forEach(control => {
                const eventType = control.tagName === 'SELECT' ? 'change' : 'input';
                control.addEventListener(eventType, () => {
                    layer = this.readTextureAssetEditor();
                    this.renderTextureAssetPreview(layer);
                });
            });
            const pattern = panel.querySelector('[data-prop="pattern"]');
            if (pattern) pattern.value = layer.pattern;
            this.renderTextureAssetPreview(layer);
        };
        typeSelect.value = layer.type;
        typeSelect.onchange = () => { layer = this.defaultTextureLayer(typeSelect.value); render(); };
        render();
    }

    readTextureAssetEditor() {
        const type = document.getElementById('texture-asset-type')?.value || 'color';
        const layer = this.defaultTextureLayer(type);
        document.querySelectorAll('#texture-asset-properties [data-prop]').forEach(control => {
            let val;
            if (control.type === 'checkbox') {
                val = control.checked;
            } else if (control.type === 'number' || control.type === 'range') {
                val = parseFloat(control.value);
                if (isNaN(val)) val = layer[control.dataset.prop];
            } else {
                val = control.value;
            }
            layer[control.dataset.prop] = val;
        });
        return layer;
    }

    renderTextureAssetPreview(layer, canvas = document.getElementById('texture-asset-preview')) {
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const type = layer.type || 'color';
        const fill = color => { ctx.fillStyle = color; ctx.fillRect(0, 0, width, height); };
        const checkerboard = () => {
            const size = Math.max(8, Math.round(width / 8));
            for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
                ctx.fillStyle = ((x / size + y / size) % 2) ? '#1f2430' : '#303746';
                ctx.fillRect(x, y, size, size);
            }
        };
        const angledGradient = (colors, angle = 0) => {
            const radians = Number(angle || 0) * Math.PI / 180;
            const cx = width / 2, cy = height / 2;
            const radius = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
            const dx = Math.cos(radians) * radius / 2, dy = Math.sin(radians) * radius / 2;
            const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
            colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
            fill(gradient);
        };
        const drawSourcePlaceholder = (label, base = '#252b38') => {
            checkerboard();
            ctx.fillStyle = base;
            ctx.globalAlpha = 0.82;
            ctx.fillRect(width * 0.14, height * 0.26, width * 0.72, height * 0.48);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#e5e7eb';
            ctx.font = `600 ${Math.max(10, width / 13)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, width / 2, height / 2);
        };

        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 100) / 100));

        if (type === 'color') {
            fill(layer.color || '#888888');
        } else if (type === 'lighting') {
            const strength = Math.max(0, Math.min(1, Number(layer.strength ?? 50) / 100));
            const gradient = ctx.createRadialGradient(width * .35, height * .3, 0, width * .5, height * .5, width * .72);
            gradient.addColorStop(0, `rgba(255,255,255,${0.65 + strength * .35})`);
            gradient.addColorStop(.45, '#758099');
            gradient.addColorStop(1, `rgb(${18 - strength * 10},${21 - strength * 10},${29 - strength * 10})`);
            fill(gradient);
        } else if (type === 'depth') {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#050505'); fill(gradient);
            ctx.strokeStyle = 'rgba(110,231,255,.55)'; ctx.lineWidth = Math.max(1, width / 96);
            for (let i = 1; i < 5; i++) ctx.strokeRect(width * i / 12, height * i / 12, width * (1 - i / 6), height * (1 - i / 6));
        } else if (type === 'gradient') {
            angledGradient([layer.colorA || '#111827', layer.colorB || '#8b5cf6'], layer.angle);
        } else if (type === 'rainbow') {
            const saturation = Number(layer.saturation ?? 100);
            const lightness = Math.max(10, Number(layer.brightness ?? 100) / 2);
            angledGradient([0,60,120,180,240,300,360].map(h => `hsl(${h} ${saturation}% ${lightness}%)`), layer.angle);
        } else if (type === 'noise') {
            fill(layer.colorB || '#eeeeee');
            const size = Math.max(1, Number(layer.scale || 8));
            let seed = (Number(layer.seed) || 1) >>> 0;
            const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
            for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
                const mix = random(); ctx.globalAlpha = .35 + mix * .65; ctx.fillStyle = mix > .5 ? (layer.colorA || '#111') : (layer.colorB || '#eee'); ctx.fillRect(x, y, size, size);
            }
            ctx.globalAlpha = 1;
        } else if (type === 'pattern') {
            const size = Math.max(3, Number(layer.scale || 8)); fill(layer.colorB || '#eee'); ctx.fillStyle = layer.colorA || '#111';
            for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
                if (layer.pattern === 'dots') { ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * .28, 0, Math.PI * 2); ctx.fill(); }
                else if (layer.pattern === 'stripes') { if ((x / size) % 2 === 0) ctx.fillRect(x, 0, size, height); }
                else if ((x / size + y / size) % 2 === 0) ctx.fillRect(x, y, size, size);
            }
        } else if (type === 'duct') {
            fill(layer.colorB || '#9ca3af');
            const spacing = Math.max(8, Number(layer.spacing || 24)); const pipe = Math.max(2, Number(layer.width || 8));
            ctx.strokeStyle = layer.colorA || '#374151'; ctx.lineWidth = pipe; ctx.lineCap = 'round';
            for (let y = spacing / 2; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(-pipe, y); ctx.lineTo(width * .32, y); ctx.arc(width * .32, y + spacing * .3, spacing * .3, -Math.PI / 2, 0); ctx.lineTo(width + pipe, y + spacing * .3); ctx.stroke(); }
            ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, pipe * .2); for (let y = spacing / 2; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y - pipe * .2); ctx.lineTo(width, y - pipe * .2); ctx.stroke(); }
        } else if (type === 'fresnel') {
            fill('#111827'); const power = Math.max(.1, Number(layer.power || 3));
            const gradient = ctx.createRadialGradient(width/2, height/2, width * .1, width/2, height/2, width * .52);
            gradient.addColorStop(0, '#111827'); gradient.addColorStop(Math.max(.2, 1 - 1 / power), '#1f2937'); gradient.addColorStop(1, layer.color || '#fff'); fill(gradient);
        } else if (type === 'cavity') {
            fill('#777f8c'); const radius = Math.max(3, Number(layer.radius || 1) * width / 12); const strength = Math.max(0, Number(layer.strength || 1));
            ctx.lineWidth = Math.max(1, width / 64); for (let y = radius; y < height; y += radius * 2) for (let x = radius; x < width; x += radius * 2) { const g=ctx.createRadialGradient(x,y,0,x,y,radius); g.addColorStop(0,`rgba(0,0,0,${Math.min(.85,.35*strength)})`);g.addColorStop(.65,'rgba(0,0,0,.08)');g.addColorStop(1,'rgba(255,255,255,.3)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill(); }
        } else if (type === 'toon') {
            const steps = Math.max(2, Number(layer.steps || 4)); for (let i=0;i<steps;i++) { ctx.fillStyle=`hsl(265 70% ${18 + i * 64 / Math.max(1,steps-1)}%)`; ctx.fillRect(i * width / steps, 0, width / steps + 1, height); }
        } else if (type === 'outline') {
            fill('#d7dce5'); const thickness=Math.max(2,Number(layer.thickness || .02)*width*5); ctx.strokeStyle=layer.color || '#000';ctx.lineWidth=thickness;ctx.fillStyle='#8b5cf6';ctx.beginPath();ctx.arc(width/2,height/2,width*.3,0,Math.PI*2);ctx.fill();ctx.stroke();
        } else if (type === 'glass') {
            checkerboard(); const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(.38,'rgba(125,211,252,.12)');gradient.addColorStop(.72,'rgba(255,255,255,.38)');gradient.addColorStop(1,'rgba(56,189,248,.12)');ctx.fillStyle=gradient;ctx.fillRect(width*.12,height*.12,width*.76,height*.76);ctx.strokeStyle='rgba(224,242,254,.9)';ctx.lineWidth=Math.max(2,width/64);ctx.strokeRect(width*.12,height*.12,width*.76,height*.76);
        } else if (type === 'reflection') {
            const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,'#080b12');gradient.addColorStop(.25,'#dbeafe');gradient.addColorStop(.38,'#334155');gradient.addColorStop(.62,'#f8fafc');gradient.addColorStop(.72,'#475569');gradient.addColorStop(1,'#05070b');fill(gradient);ctx.fillStyle=`rgba(96,165,250,${Math.min(.4,Number(layer.intensity||1)*.15)})`;ctx.fillRect(0,0,width,height);
        } else if (type === 'normal' && !layer.url) {
            fill('#8080ff'); const gradient=ctx.createRadialGradient(width*.4,height*.35,0,width/2,height/2,width*.55);gradient.addColorStop(0,'#b7b7ff');gradient.addColorStop(.5,'#8080ff');gradient.addColorStop(1,'#4747c7');fill(gradient);
        } else if (type === 'displace' && !layer.url) {
            const gradient=ctx.createRadialGradient(width*.42,height*.38,0,width/2,height/2,width*.65);gradient.addColorStop(0,'#fff');gradient.addColorStop(.35,'#aab0ba');gradient.addColorStop(.7,'#4b5563');gradient.addColorStop(1,'#050505');fill(gradient);
        } else if ((type === 'image' || type === 'normal' || type === 'displace') && layer.url) {
            drawSourcePlaceholder('Loading…'); const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => { ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,Number(layer.opacity??100)/100));ctx.drawImage(image,0,0,width,height);ctx.restore(); }; image.onerror = () => drawSourcePlaceholder('Image unavailable'); image.src = layer.url;
        } else if (type === 'video') {
            drawSourcePlaceholder(layer.url ? 'Video preview' : 'Add video URL', '#111827'); ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(width*.44,height*.38);ctx.lineTo(width*.44,height*.62);ctx.lineTo(width*.63,height*.5);ctx.closePath();ctx.fill();
        } else {
            drawSourcePlaceholder(type === 'image' ? 'Add image URL' : type.toUpperCase());
        }
        ctx.restore();
    }

    textureLayerTypes() {
        return ['color', 'lighting', 'depth', 'image', 'video', 'normal', 'gradient', 'noise', 'fresnel', 'cavity', 'duct', 'rainbow', 'toon', 'outline', 'glass', 'reflection', 'displace', 'pattern'];
    }

    defaultTextureLayer(type) {
        const defaults = {
            color: { color: '#888888' }, lighting: { strength: 50 }, depth: { near: 0, far: 10 },
            image: { url: '', repeatX: 1, repeatY: 1, rotation: 0 }, video: { url: '', autoplay: true, loop: true, playbackRate: 1 },
            normal: { url: '', strength: 1 }, gradient: { colorA: '#111827', colorB: '#8b5cf6', angle: 0 },
            noise: { colorA: '#111111', colorB: '#eeeeee', scale: 8, seed: 1 }, fresnel: { color: '#ffffff', power: 3, bias: 0.1 },
            cavity: { strength: 1, radius: 1 }, duct: { colorA: '#374151', colorB: '#9ca3af', width: 8, spacing: 24 },
            rainbow: { saturation: 100, brightness: 100, angle: 0 }, toon: { steps: 4 }, outline: { color: '#000000', thickness: 0.02 },
            glass: { transmission: 0.9, ior: 1.5, thickness: 0.5, roughness: 0.1 }, reflection: { intensity: 1, metalness: 1, roughness: 0.1 },
            displace: { url: '', scale: 0.1, bias: 0 }, pattern: { pattern: 'checker', colorA: '#111111', colorB: '#eeeeee', scale: 8 }
        };
        return { type, enabled: true, opacity: 100, blendMode: 'normal', ...(defaults[type] || {}) };
    }

    textureLayerFields(layer) {
        const field = (content) => `<div class="layer-property-field">${content}</div>`;
        const input = (label, key, type = 'number', attrs = '') => field(`<label><span>${label}</span><input data-prop="${key}" type="${type}" value="${layer[key] ?? ''}" ${attrs}></label>`);
        const color = (label, key) => input(label, key, 'color');
        const checkbox = (label, key) => field(`<label class="layer-property-checkbox"><input data-prop="${key}" type="checkbox" ${layer[key] ? 'checked' : ''}><span>${label}</span></label>`);
        const fields = {
            color: () => color('Colour', 'color'), lighting: () => input('Strength', 'strength', 'range', 'min="0" max="100"'),
            depth: () => input('Near', 'near', 'number', 'step="0.1"') + input('Far', 'far', 'number', 'step="0.1"'),
            image: () => input('Image URL', 'url', 'url') + input('Repeat X', 'repeatX', 'number', 'min="0.1" step="0.1"') + input('Repeat Y', 'repeatY', 'number', 'min="0.1" step="0.1"') + input('Rotation', 'rotation', 'number'),
            video: () => input('Video URL', 'url', 'url') + input('Speed', 'playbackRate', 'number', 'min="0.1" max="4" step="0.1"') + checkbox('Autoplay', 'autoplay') + checkbox('Loop', 'loop'),
            normal: () => input('Normal URL', 'url', 'url') + input('Strength', 'strength', 'range', 'min="0" max="2" step="0.01"'),
            gradient: () => color('Start', 'colorA') + color('End', 'colorB') + input('Angle', 'angle'),
            noise: () => color('Dark', 'colorA') + color('Light', 'colorB') + input('Scale', 'scale', 'number', 'min="1"') + input('Seed', 'seed'),
            fresnel: () => color('Edge', 'color') + input('Power', 'power', 'range', 'min="0.1" max="10" step="0.1"') + input('Bias', 'bias', 'range', 'min="0" max="1" step="0.01"'),
            cavity: () => input('Strength', 'strength', 'range', 'min="0" max="2" step="0.01"') + input('Radius', 'radius', 'number', 'min="0.1" step="0.1"'),
            duct: () => color('Pipe', 'colorA') + color('Gap', 'colorB') + input('Width', 'width', 'number', 'min="1"') + input('Spacing', 'spacing', 'number', 'min="2"'),
            rainbow: () => input('Saturation', 'saturation', 'range', 'min="0" max="100"') + input('Brightness', 'brightness', 'range', 'min="0" max="100"') + input('Angle', 'angle'),
            toon: () => input('Steps', 'steps', 'number', 'min="2" max="12"'), outline: () => color('Colour', 'color') + input('Thickness', 'thickness', 'range', 'min="0.005" max="0.2" step="0.005"'),
            glass: () => input('Transmission', 'transmission', 'range', 'min="0" max="1" step="0.01"') + input('IOR', 'ior', 'range', 'min="1" max="2.5" step="0.01"') + input('Thickness', 'thickness', 'number', 'min="0" step="0.1"') + input('Roughness', 'roughness', 'range', 'min="0" max="1" step="0.01"'),
            reflection: () => input('Intensity', 'intensity', 'range', 'min="0" max="3" step="0.01"') + input('Metalness', 'metalness', 'range', 'min="0" max="1" step="0.01"') + input('Roughness', 'roughness', 'range', 'min="0" max="1" step="0.01"'),
            displace: () => input('Height URL', 'url', 'url') + input('Scale', 'scale', 'number', 'step="0.01"') + input('Bias', 'bias', 'number', 'step="0.01"'),
            pattern: () => field(`<label><span>Pattern</span><select data-prop="pattern"><option value="checker">Checker</option><option value="stripes">Stripes</option><option value="dots">Dots</option></select></label>`) + color('Colour A', 'colorA') + color('Colour B', 'colorB') + input('Scale', 'scale', 'number', 'min="1"')
        };
        return (fields[layer.type] || (() => ''))();
    }

    collectMaterialTextureLayers() {
        return [...document.querySelectorAll('#material-asset-items .material-texture-layer')].map(layerEl => {
            const layer = { type: layerEl.querySelector('.layer-select')?.value || 'color', enabled: layerEl.querySelector('.layer-enabled')?.checked !== false, opacity: parseFloat(layerEl.querySelector('.layer-opacity')?.value || 100), blendMode: layerEl.querySelector('.layer-blend-mode')?.value || 'normal', _expanded: !layerEl.classList.contains('collapsed') };
            const textureAssetSelect = layerEl.querySelector('.layer-texture-asset');
            if (textureAssetSelect && textureAssetSelect.value) layer.textureAssetId = textureAssetSelect.value;
            const defaults = this.defaultTextureLayer(layer.type);
            layerEl.querySelectorAll('[data-prop]').forEach(control => {
                let val;
                if (control.type === 'checkbox') {
                    val = control.checked;
                } else if (control.type === 'number' || control.type === 'range') {
                    val = parseFloat(control.value);
                    if (isNaN(val)) val = defaults[control.dataset.prop];
                } else {
                    val = control.value;
                }
                layer[control.dataset.prop] = val;
            });
            return layer;
        });
    }

    materialPresets() {
        const toHexStr = color => typeof color === 'string' && color.startsWith('#') ? color : '#' + String(color ?? 0xffffff).toString(16).padStart(6, '0');
        return {
            glass: {
                color: '#88ccff', metalness: 0.05, roughness: 0.05, clearcoat: 0,
                transmission: 0.9, sheen: 0, opacity: 100,
                layers: [
                    { type: 'color', color: '#88ccff', opacity: 100 },
                    { type: 'glass', opacity: 100, transmission: 0.9, ior: 1.5, thickness: 0.5, roughness: 0.05 }
                ]
            },
            metal: {
                color: '#c0c0c0', metalness: 1, roughness: 0.2, clearcoat: 0,
                transmission: 0, sheen: 0, opacity: 100,
                layers: [
                    { type: 'color', color: '#c0c0c0', opacity: 100 },
                    { type: 'reflection', opacity: 100, intensity: 1, metalness: 1, roughness: 0.2 }
                ]
            },
            plastic: {
                color: '#ff5555', metalness: 0, roughness: 0.4, clearcoat: 0.5,
                transmission: 0, sheen: 0, opacity: 100,
                layers: [
                    { type: 'color', color: '#ff5555', opacity: 100 },
                    { type: 'noise', opacity: 25, blendMode: 'overlay', colorA: '#ff5555', colorB: '#cc4444', scale: 16, seed: 42 }
                ]
            },
            fabric: {
                color: '#8b5a2b', metalness: 0, roughness: 0.8, clearcoat: 0,
                transmission: 0, sheen: 0.6, opacity: 100,
                layers: [
                    { type: 'color', color: '#8b5a2b', opacity: 100 },
                    { type: 'noise', opacity: 35, blendMode: 'multiply', colorA: '#654321', colorB: '#8b5a2b', scale: 12, seed: 7 }
                ]
            },
            outline: {
                color: '#000000', metalness: 0, roughness: 0.5, clearcoat: 0,
                transmission: 0, sheen: 0, opacity: 100,
                layers: [
                    { type: 'color', color: '#000000', opacity: 100 },
                    { type: 'outline', opacity: 100, color: '#000000', thickness: 0.02 }
                ]
            },
            default: {
                color: '#888888', metalness: 0.2, roughness: 0.3, clearcoat: 0,
                transmission: 0, sheen: 0, opacity: 100, layers: []
            }
        };
    }

    applyMaterialPreset(presetName) {
        const preset = this.materialPresets()[presetName];
        if (!preset) return;
        const colorPicker = document.getElementById('material-color-picker');
        if (colorPicker) colorPicker.value = preset.color;
        const setSlider = (id, value) => {
            const input = document.getElementById(id);
            const output = document.getElementById(id + '-value');
            if (input) input.value = value;
            if (output) output.textContent = Number(value).toFixed(2);
        };
        setSlider('material-metalness', preset.metalness);
        setSlider('material-roughness', preset.roughness);
        setSlider('material-clearcoat', preset.clearcoat);
        setSlider('material-transmission', preset.transmission);
        setSlider('material-sheen', preset.sheen);
        const opacityInput = document.getElementById('material-opacity');
        const opacityValue = document.getElementById('material-opacity-value');
        if (opacityInput) opacityInput.value = preset.opacity;
        if (opacityValue) opacityValue.textContent = preset.opacity;
        const lightingSlider = document.getElementById('material-lighting');
        const lightingValue = document.getElementById('material-lighting-value');
        if (lightingSlider) lightingSlider.value = 0;
        if (lightingValue) lightingValue.textContent = 0;
        this.renderMaterialTextureLayers((preset.layers || []).map(l => ({
            ...this.defaultTextureLayer(l.type || 'color'), ...l, enabled: l.enabled !== false
        })));
        this.updateMaterialPreview?.();
    }

    renderMaterialTextureLayers(layers = []) {
        const container = document.getElementById('material-asset-items');
        if (!container) return;
        container.innerHTML = '';
        layers.forEach((rawLayer, index) => {
            const layer = { ...this.defaultTextureLayer(rawLayer.type || 'color'), ...rawLayer };
            const layerEl = document.createElement('div');
            layerEl.className = 'material-texture-layer';
            layerEl.draggable = true;
            layerEl.dataset.layerIndex = index;
            if (layer._expanded === false) layerEl.classList.add('collapsed');
             const textureOptions = (this.assets.textures || []).map(texture => `<option value="${texture.id}" ${layer.textureAssetId === texture.id ? 'selected' : ''}>${texture.name}</option>`).join('');
            const isExpanded = layer._expanded !== false;
            layerEl.innerHTML = `
                <div class="material-layer-header" data-layer-index="${index}">
                    <div class="layer-drag-handle" title="Drag to reorder"><i class="fas fa-grip-lines"></i></div>
                    <label class="layer-toggle">
                        <input class="layer-enabled" type="checkbox" ${layer.enabled ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                    <span class="layer-index-badge">${index + 1}</span>
                    <select class="layer-select" aria-label="Layer type">${this.textureLayerTypes().map(type => `<option value="${type}" ${type === layer.type ? 'selected' : ''}>${type[0].toUpperCase() + type.slice(1)}</option>`).join('')}</select>
                    <select class="layer-blend-mode" aria-label="Blend mode"><option value="normal">Normal</option><option value="add">Add</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select>
                    <label class="layer-opacity-control">
                        <span>Opacity</span>
                        <input class="layer-opacity" type="range" min="0" max="100" value="${layer.opacity}">
                        <output>${Number(layer.opacity ?? 100).toFixed(0)}%</output>
                    </label>
                    <button class="layer-toggle-expand" aria-label="${isExpanded ? 'Collapse' : 'Expand'} layer" title="${isExpanded ? 'Collapse' : 'Expand'} layer">
                        <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                    </button>
                    <div class="layer-actions">
                        <button class="layer-save-texture" title="Save layer as reusable texture"><i class="fas fa-save"></i> Save</button>
                        <button class="layer-close" title="Remove layer" aria-label="Remove layer" ${layers.length <= 1 ? 'disabled' : ''}><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="material-layer-body ${isExpanded ? 'expanded' : 'collapsed'}" style="${isExpanded ? '' : 'display:none;'}">
                    <div class="layer-preview-frame">
                        <canvas class="layer-preview-canvas" width="64" height="64" aria-label="Layer preview"></canvas>
                    </div>
                    <div class="layer-fields">
                        <select class="layer-texture-asset" aria-label="Reusable texture"><option value="">Use reusable texture…</option>${textureOptions}</select>
                        <div class="layer-properties">${this.textureLayerFields(layer)}</div>
                    </div>
                </div>
            `;
            layerEl.querySelector('.layer-blend-mode').value = layer.blendMode;
            const pattern = layerEl.querySelector('[data-prop="pattern"]');
            if (pattern) pattern.value = layer.pattern;
            const opacityInput = layerEl.querySelector('.layer-opacity');
            const opacityOutput = layerEl.querySelector('.layer-opacity-control output');
            opacityInput.addEventListener('input', () => { opacityOutput.textContent = `${opacityInput.value}%`; });

            const updateLayerPreview = () => {
                const current = this.collectMaterialTextureLayers()[index];
                this.renderTextureAssetPreview(current, layerEl.querySelector('.layer-preview-canvas'));
                this.updateMaterialPreview?.();
            };
            layerEl.querySelectorAll('[data-prop], .layer-opacity').forEach(control => {
                control.addEventListener('input', updateLayerPreview);
            });

            layerEl.querySelector('.layer-select').addEventListener('change', event => { const current = this.collectMaterialTextureLayers(); current[index] = this.defaultTextureLayer(event.target.value); this.renderMaterialTextureLayers(current); this.updateMaterialPreview?.(); });
            layerEl.querySelector('.layer-close').addEventListener('click', () => {
                const current = this.collectMaterialTextureLayers();
                if (current.length <= 1) {
                    this.showNotification('Cannot remove the last layer', 'warning');
                    return;
                }
                current.splice(index, 1);
                this.renderMaterialTextureLayers(current);
                this.updateMaterialPreview?.();
            });

            // Drag and drop reordering - only from drag handle
            layerEl.addEventListener('dragstart', (e) => {
                if (!e.target.closest('.layer-drag-handle')) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                layerEl.classList.add('dragging');
            });
            layerEl.addEventListener('dragend', () => {
                layerEl.classList.remove('dragging');
                document.querySelectorAll('.material-texture-layer').forEach(el => el.classList.remove('drag-over'));
            });
            layerEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                layerEl.classList.add('drag-over');
            });
            layerEl.addEventListener('dragleave', () => {
                layerEl.classList.remove('drag-over');
            });
            layerEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    const current = this.collectMaterialTextureLayers();
                    const [moved] = current.splice(fromIndex, 1);
                    current.splice(toIndex, 0, moved);
                    this.renderMaterialTextureLayers(current);
                    this.updateMaterialPreview?.();
                }
            });

            // Toggle expand/collapse (accordion: only one layer expanded at a time)
            layerEl.querySelector('.layer-toggle-expand').addEventListener('click', (e) => {
                e.stopPropagation();
                const current = this.collectMaterialTextureLayers();
                const wasExpanded = current[index]._expanded !== false;
                if (wasExpanded) {
                    current[index]._expanded = false;
                } else {
                    current.forEach((layer, i) => {
                        if (i !== index) layer._expanded = false;
                    });
                    current[index]._expanded = true;
                }
                this.renderMaterialTextureLayers(current);
                this.updateMaterialPreview?.();
            });

            // Enable/disable checkbox
            layerEl.querySelector('.layer-enabled').addEventListener('change', (e) => {
                const current = this.collectMaterialTextureLayers();
                current[index].enabled = e.target.checked;
                this.renderMaterialTextureLayers(current);
                this.updateMaterialPreview?.();
            });

            // Blend mode change
            layerEl.querySelector('.layer-blend-mode').addEventListener('change', (e) => {
                const current = this.collectMaterialTextureLayers();
                current[index].blendMode = e.target.value;
                this.renderMaterialTextureLayers(current);
                this.updateMaterialPreview?.();
            });

            layerEl.querySelector('.layer-save-texture').addEventListener('click', () => {
                const current = this.collectMaterialTextureLayers()[index];
                const preview = document.createElement('canvas'); preview.width = preview.height = 256;
                this.renderTextureAssetPreview(current, preview); const dataUrl = preview.toDataURL('image/png');
                this.addAsset('textures', { name: `${current.type[0].toUpperCase()+current.type.slice(1)} Texture`, layer: current, preview: dataUrl });
                this.showNotification('Texture saved for reuse', 'success');
                this.renderMaterialTextureLayers(this.collectMaterialTextureLayers());
                this.updateMaterialPreview?.();
            });
            layerEl.querySelector('.layer-texture-asset').addEventListener('change', event => {
                const texture = this.getAsset('textures', event.target.value); if (!texture?.layer) return;
                const current = this.collectMaterialTextureLayers(); current[index] = { ...texture.layer, textureAssetId: texture.id }; this.renderMaterialTextureLayers(current); this.updateMaterialPreview?.();
            });
            container.appendChild(layerEl);
            this.renderTextureAssetPreview(layer, layerEl.querySelector('.layer-preview-canvas'));
        });
    }

    initSettingsModal() {
        // This method is now handled by initUnifiedSettingsModal()
        // Redirect to the unified settings initialization
        if (!this.unifiedSettingsInitialized) {
            this.initUnifiedSettingsModal();
            this.unifiedSettingsInitialized = true;
        }
    }

    toggleSubmenu(btn) {
        const submenu = btn.querySelector('.tool-submenu');
        if (!submenu) return;

        const isOpen = submenu.style.display === 'grid';
        this.closeAllSubmenus();

        if (!isOpen) {
            // Calculate vertical position based on button in viewport
            const btnRect = btn.getBoundingClientRect();
            const topOffset = btnRect.top + btnRect.height / 2 - 24; // Center align roughly

            submenu.style.display = 'grid';
            submenu.style.top = `${topOffset}px`;
            submenu.style.setProperty('--submenu-top', `${topOffset}px`); // For CSS custom prop if needed

            this.activeSubmenu = submenu;
        }
    }
    handleSubmenuClick(e) {
        e.stopPropagation(); // Prevent event bubbling to toolbar handler
        const btn = e.currentTarget;

        // Show panel if hidden
        const panel = document.getElementById('right-panel');
        if (panel && panel.classList.contains('hidden')) {
            this.togglePropertiesPanel();
        }

        // Close submenu
        this.closeAllSubmenus();

        // Remove active class from all tools
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        // Add to clicked
        btn.classList.add('active');

        const action = btn.dataset.action;
        const type = btn.dataset.type;
        if (this.app[action]) {
            this.app[action](type);
        }
    }

    closeAllSubmenus() {
        document.querySelectorAll('.tool-submenu').forEach(menu => {
            menu.style.display = 'none';
        });
        this.activeSubmenu = null;
    }

     togglePropertiesPanel() {
         const panel = document.getElementById('right-panel');
         const toggle = document.getElementById('panel-toggle');
         const workspace = document.querySelector('.workspace');

         if (!panel) return;

         const icon = toggle ? toggle.querySelector('i') : null;

         if (panel.classList.contains('hidden')) {
             // Show panel
             panel.classList.remove('hidden');
             if (toggle) toggle.classList.remove('panel-hidden');
             if (workspace) workspace.classList.remove('panel-hidden');
             if (icon) icon.className = 'fas fa-chevron-right';
             if (toggle) toggle.title = 'Hide Panel';

             // Reset to default view when showing panel
             this.resetPanelToDefault();
         } else {
             // Hide panel
             panel.classList.add('hidden');
             if (toggle) toggle.classList.add('panel-hidden');
             if (workspace) workspace.classList.add('panel-hidden');
             if (icon) icon.className = 'fas fa-chevron-left';
             if (toggle) toggle.title = 'Show Panel';
         }

         // The flex layout changes the canvas container width. Resize the
         // renderer after the panel/toggle transition so the scene fills the
         // newly available area instead of leaving an uncovered black strip.
         window.setTimeout(() => this.app.onWindowResize?.(), 320);
     }

     toggleAnimationPanel() {
         const panel = document.getElementById('anim-panel');
         if (!panel) return;
         panel.classList.toggle('collapsed');
         const toggle = document.getElementById('tool-animate');
         if (toggle) {
             const icon = toggle.querySelector('i');
             if (icon) {
                 if (panel.classList.contains('collapsed')) {
                     icon.className = 'fas fa-play';
                     toggle.title = 'Show Animation Timeline';
                 } else {
                     icon.className = 'fas fa-play';
                     toggle.title = 'Hide Animation Timeline';
                 }
             }
         }
         // Trigger resize to update 3D renderer
         setTimeout(() => {
             if (this.app.onWindowResize) {
                 this.app.onWindowResize();
             }
         }, 300);
     }

     resetPanelToDefault() {
         const panelScroll = document.querySelector('#right-panel .right-panel-scroll');
         if (panelScroll) {
             panelScroll.scrollTo({ top: 0, behavior: 'smooth' });
         }
     }

    loadSettings() {
        const saved = localStorage.getItem('pixel3d-settings');
        if (saved) {
            let settings;
            try {
                settings = JSON.parse(saved);
            } catch (error) {
                console.warn('Ignoring invalid saved settings:', error);
                localStorage.removeItem('pixel3d-settings');
                return;
            }
            // Apply settings to app
            if (this.app.setGridVisible) this.app.setGridVisible(settings.grid);
            if (this.app.setAxesVisible) this.app.setAxesVisible(settings.axes);
            if (this.app.setSnapEnabled) this.app.setSnapEnabled(settings.snap);
            if (this.app.setCameraSpeed) this.app.setCameraSpeed(settings.cameraSpeed);
            // Apply tooltips
            window.tooltipsEnabled = settings.tooltips !== false;
            // Apply autosave
            if (this.app.fileManager && this.app.fileManager.setAutosaveEnabled) {
                this.app.fileManager.setAutosaveEnabled(settings.autosave !== false);
                if (this.app.fileManager.setAutosaveInterval) {
                    this.app.fileManager.setAutosaveInterval(settings.autosaveInterval || 5);
                }
            }
        }
    }

    loadSettingsToUI() {
        const saved = localStorage.getItem('pixel3d-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            // Set UI values
            const gridEl = document.getElementById('setting-grid');
            const axesEl = document.getElementById('setting-axes');
            const snapEl = document.getElementById('setting-snap');
            const tooltipsEl = document.getElementById('setting-tooltips');
            const speedEl = document.getElementById('setting-camera-speed');
            const speedValueEl = document.getElementById('camera-speed-value');
            const autosaveEl = document.getElementById('setting-autosave');
            const autosaveIntervalEl = document.getElementById('setting-autosave-interval');
            const autosaveIntervalValueEl = document.getElementById('autosave-interval-value');
    
            if (gridEl) gridEl.checked = settings.grid !== false;
            if (axesEl) axesEl.checked = settings.axes !== false;
            if (snapEl) snapEl.checked = settings.snap !== false;
            if (tooltipsEl) tooltipsEl.checked = settings.tooltips !== false;
            if (speedEl) {
                speedEl.value = settings.cameraSpeed || 1;
                if (speedValueEl) speedValueEl.textContent = settings.cameraSpeed || 1;
            }
            if (autosaveEl) autosaveEl.checked = settings.autosave !== false;
            if (autosaveIntervalEl) {
                autosaveIntervalEl.value = settings.autosaveInterval || 5;
                if (autosaveIntervalValueEl) autosaveIntervalValueEl.textContent = settings.autosaveInterval || 5;
            }
        }

        // Load export format
        const savedFormat = localStorage.getItem('pixel3d-export-format');
        const formatEl = document.getElementById('setting-export-format');
        if (formatEl) {
            formatEl.value = savedFormat || 'json';
        }
    }


    saveSettings() {
        const settings = {
            grid: document.getElementById('setting-grid').checked,
            axes: document.getElementById('setting-axes').checked,
            snap: document.getElementById('setting-snap').checked,
            tooltips: document.getElementById('setting-tooltips').checked,
            cameraSpeed: parseFloat(document.getElementById('setting-camera-speed').value),
            autosave: document.getElementById('setting-autosave').checked,
            autosaveInterval: parseInt(document.getElementById('setting-autosave-interval').value)
        };

        // Save general settings
        localStorage.setItem('pixel3d-settings', JSON.stringify(settings));

        // Apply
        if (this.app.setGridVisible) this.app.setGridVisible(settings.grid);
        if (this.app.setAxesVisible) this.app.setAxesVisible(settings.axes);
        if (this.app.setSnapEnabled) this.app.setSnapEnabled(settings.snap);
        if (this.app.setCameraSpeed) this.app.setCameraSpeed(settings.cameraSpeed);

        // Tooltip global variable update
        window.tooltipsEnabled = settings.tooltips;

        // Save export settings
        const exportFormat = document.getElementById('setting-export-format');
        if (exportFormat && this.app.fileManager) {
            this.app.fileManager.setExportFormat(exportFormat.value);
            localStorage.setItem('pixel3d-export-format', exportFormat.value);
        }

        this.showNotification('Settings saved successfully!', 'success');
    }

    resetSettings() {
        // Use config defaults
        const defaults = {
            grid: true,
            axes: true,
            snap: true,
            tooltips: true,
            cameraSpeed: 1,
            autosave: false,
            autosaveInterval: 5
        };

        // If config is available, use its defaults
        if (typeof APP_DEFAULTS !== 'undefined') {
            defaults.grid = APP_DEFAULTS.ui.gridVisible;
            defaults.axes = APP_DEFAULTS.ui.axesVisible;
            defaults.snap = APP_DEFAULTS.ui.snapEnabled;
            defaults.tooltips = APP_DEFAULTS.ui.tooltipsEnabled;
            defaults.cameraSpeed = APP_DEFAULTS.ui.cameraSpeed;
            defaults.autosave = APP_DEFAULTS.ui.autosaveEnabled;
            defaults.autosaveInterval = APP_DEFAULTS.ui.autosaveInterval;
        }

        // Save reset
        localStorage.setItem('pixel3d-settings', JSON.stringify(defaults));

        // Apply immediately
        if (this.app.setGridVisible) this.app.setGridVisible(true);
        if (this.app.setAxesVisible) this.app.setAxesVisible(true);
        if (this.app.setSnapEnabled) this.app.setSnapEnabled(true);
        if (this.app.setCameraSpeed) this.app.setCameraSpeed(1);

        window.tooltipsEnabled = true;
        // Apply autosave
        if (this.app.fileManager && this.app.fileManager.setAutosaveEnabled) {
            this.app.fileManager.setAutosaveEnabled(false);
            if (this.app.fileManager.setAutosaveInterval) {
                this.app.fileManager.setAutosaveInterval(5);
            }
        }

        // Update UI elements visually
        this.loadSettingsToUI();

        this.showNotification('Settings reset to defaults!', 'success');
    }

    // --- AI MODAL LOGIC ---
    openAIModal(mode) {
        this.currentAIMode = mode;
        this.promptInput.value = '';
        this.modal.classList.add('open');
        this.promptInput.focus();

        if (mode === 'scene') {
            this.modalTitle.textContent = "Magic Scene Generator";
            this.modalDesc.textContent = "Describe a full scene layout.";
            this.promptInput.placeholder = "e.g. A futuristic city with tall blue cylinders and neon cones...";
        } else {
            this.modalTitle.textContent = "Material Assistant";
            this.modalDesc.textContent = "Describe the material or mood for the color.";
            this.promptInput.placeholder = "e.g. Molten lava, Rusty metal, Cyberpunk pink...";
        }
    }

    closeAIModal() {
        this.modal.classList.remove('open');
        this.spinner.classList.remove('active');
        this.btnGenerate.disabled = false;
        this.btnCancel.disabled = false;
    }

    async handleAIGenerate() {
        const text = this.promptInput.value.trim();
        if (!text) return;

        this.spinner.classList.add('active');
        this.btnGenerate.disabled = true;
        this.btnCancel.disabled = true;

        try {
            if (this.currentAIMode === 'scene') {
                const sceneData = await this.app.gemini.generateScene(text);
                // Use FileManager to load the data structure
                this.app.fileManager.loadData(sceneData);
                const usedFallback = this.app.gemini.activeProvider === 'openrouter'
                    && this.app.gemini.lastUsedModel !== this.app.gemini.settings.openrouter.model.trim();
                this.showNotification(usedFallback ? `Selected model unavailable; generated with ${this.app.gemini.lastUsedModel}.` : 'Scene generated by AI!', 'success');
            } else if (this.currentAIMode === 'material') {
                const colorHex = await this.app.gemini.generateMaterialColor(text);
                if (this.app.selectedObject) {
                    this.app.applyColorToSelected(colorHex);
                    const usedFallback = this.app.gemini.activeProvider === 'openrouter'
                        && this.app.gemini.lastUsedModel !== this.app.gemini.settings.openrouter.model.trim();
                    this.showNotification(usedFallback ? `Material applied using ${this.app.gemini.lastUsedModel}.` : 'Material color applied!', 'success');
                }
            }
            this.closeAIModal();
        } catch (err) {
            console.error(err);
            this.showNotification(err?.message || 'AI generation failed.', 'error');
            this.spinner.classList.remove('active');
            this.btnGenerate.disabled = false;
            this.btnCancel.disabled = false;
        }
    }

    // --- PROPERTIES PANEL ---
    updateUI(selectedObject) {
        // Delegate Layer List Rendering to LayerManager
        if (this.app.layerManager) {
            this.app.layerManager.render();
        }

        // Update hierarchy panel
        this.renderHierarchyPanel();

        // Show/hide the floating selection info box
        const infoBox = document.getElementById('selection-info');
        if (infoBox) {
            const showInfo = !!selectedObject && this.app.controlMode === 'scene';
            infoBox.classList.toggle('hidden', !showInfo);
        }

        // Camera controls live inside the Camera tab accordion now.
        document.getElementById('floating-camera-controls')?.classList.add('hidden');

        // Always render the properties panel first to create the inputs
        this.renderPropertiesPanel(selectedObject);

        if (!selectedObject) {
            return;
        }

        // Now update the input values (inputs exist after renderPropertiesPanel)
        const pos = selectedObject.position;
        const rot = selectedObject.rotation;
        const scale = selectedObject.scale;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = val.toFixed(2);
        };

        setVal('pos-x', pos.x);
        setVal('pos-y', pos.y);
        setVal('pos-z', pos.z);

        setVal('rot-x', rot.x);
        setVal('rot-y', rot.y);
        setVal('rot-z', rot.z);

        setVal('scl-x', scale.x);
        setVal('scl-y', scale.y);
        setVal('scl-z', scale.z);
    }

    renderPropertiesPanel(selectedObject) {
        this.propsContent.innerHTML = '';

        if (!selectedObject) {
            this.propsContent.innerHTML = '<div class="empty-state"> <p>Click on an object to edit properties</p><br> <p>Right click to deselect an object</p></div>';
            return;
        }

        const obj = selectedObject;
        let title = "Object";
        const isLight = obj.userData.type === 'light';
        const isShape = obj.userData.type === 'shape';
        const isShape2D = obj.userData.type === 'shape2d';
        const isText = isShape2D && obj.userData.shapeType === 'text';
        let isFigurePart = false;
        const isFigure = obj.userData.type === 'figure';
        const isStaging = obj.userData.type === 'staging';
        let characterRoot = obj.userData.type === 'character' ? obj : null;
        if (!characterRoot) {
            let cursor = obj;
            while (cursor && cursor !== this.app.scene) {
                if (cursor.userData?.type === 'character') { characterRoot = cursor; break; }
                cursor = cursor.parent;
            }
        }
        const isCharacter = !!characterRoot;
        const characterModel = characterRoot || obj;

        // Determine Title based on name override or type
        if (isCharacter) {
            title = characterModel.userData.characterType?.includes('child') ? 'Child Character' : '3D Character';
        } else if (obj.userData.name) {
            title = obj.userData.name;
            if (obj.userData.name.includes('Joint')) isFigurePart = true;
        } else if (obj.userData.type === 'shape') {
            title = obj.userData.shapeType.toUpperCase();
        } else if (obj.userData.type === 'shape2d') {
            title = obj.userData.shapeType.toUpperCase() + ' (2D)';
        } else if (obj.userData.type === 'light') {
            title = obj.userData.lightType.toUpperCase() + " LIGHT";
        } else if (obj.userData.type === 'figure') {
            title = obj.userData.gender.toUpperCase() + " FIGURE";
        } else if (isStaging) {
            const staging = obj.userData.staging;
            if (staging) {
                title = staging.kind.charAt(0).toUpperCase() + staging.kind.slice(1) + ': ' + (staging.presetId || 'Unknown');
            } else {
                title = 'Staging Object';
            }
        }

        // Header
        const header = document.createElement('div');
        header.className = 'property-group';
        header.innerHTML = `<div style="font-weight:bold; color:var(--accent-primary); border-bottom:1px solid #333; padding-bottom:5px;">${title}</div>`;
        this.propsContent.appendChild(header);

        // JOINT CONTROLS
        if (isFigurePart) {
            const jointGroup = document.createElement('div');
            jointGroup.className = 'property-group';
            jointGroup.innerHTML = `<div class="property-label">Joint Controls</div><div style="font-size:0.8rem; color:#94a3b8;">Use the transform tools (G/R/S) to pose this joint. Select parent/child joints for full control.</div>`;
            this.propsContent.appendChild(jointGroup);
        }

        // Helper: Create Input
        const createInput = (label, id, value, onChange) => {
            const div = document.createElement('div');
            div.className = 'input-group';
            div.innerHTML = `<span>${label}</span><input type="number" id="${id}" value="${value.toFixed(2)}" step="0.1">`;
            const input = div.querySelector('input');
            input.addEventListener('input', (e) => onChange(parseFloat(e.target.value)));
            this.enableDragAdjust(input);
            return div;
        };

        // Helper: Create Vector3 Input Row
        const createVec3Row = (label, prefix, vec, onChangeObj) => {
            const row = document.createElement('div');
            row.className = 'input-row';
            row.style.gap = '4px';
            const labelSpan = document.createElement('span');
            labelSpan.style.fontSize = '0.65rem';
            labelSpan.style.color = 'var(--text-secondary)';
            labelSpan.style.width = '50px';
            labelSpan.textContent = label;
            row.appendChild(labelSpan);
            row.appendChild(createInput('X', `${prefix}-x`, vec.x, (v) => { vec.x = v; onChangeObj(); }));
            row.appendChild(createInput('Y', `${prefix}-y`, vec.y, (v) => { vec.y = v; onChangeObj(); }));
            row.appendChild(createInput('Z', `${prefix}-z`, vec.z, (v) => { vec.z = v; onChangeObj(); }));
            return row;
        };

        // FIGURE CONTROLS
        if (isFigure) {
            const figureGroup = document.createElement('div');
            figureGroup.className = 'property-group';
            figureGroup.innerHTML = `<div class="property-label">Figure Controls</div>`;

            const figureControls = document.createElement('div');
            figureControls.className = 'figure-controls';

            // Gender Switch
            const genderSwitch = document.createElement('div');
            genderSwitch.className = 'gender-switch';
            genderSwitch.innerHTML = `
                <button class="gender-btn ${obj.userData.gender === 'male' ? 'active' : ''}" data-gender="male">
                    <i class="fas fa-male"></i> Male
                </button>
                <button class="gender-btn ${obj.userData.gender === 'female' ? 'active' : ''}" data-gender="female">
                    <i class="fas fa-female"></i> Female
                </button>
            `;

            genderSwitch.querySelectorAll('.gender-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const newGender = e.currentTarget.dataset.gender;
                    if (newGender !== obj.userData.gender) {
                        this.app.changeFigureGender(obj, newGender);
                    }
                });
            });

            figureControls.appendChild(genderSwitch);
            figureGroup.appendChild(figureControls);
            this.propsContent.appendChild(figureGroup);
        }

        // CHARACTER POSE CONTROLS
        if (isCharacter) {
            const poses = this.app.characterManager?.listPoses?.(characterModel) || [];
            if (poses.length) {
                const poseGroup = document.createElement('div');
                poseGroup.className = 'property-group character-pose-group';
                poseGroup.innerHTML = '<div class="property-label">Pose</div>';

                const row = document.createElement('div');
                row.className = 'input-row';

                const select = document.createElement('select');
                select.className = 'character-pose-select';
                select.innerHTML = poses.map(pose => {
                    const label = pose.startsWith('custom:')
                        ? `★ ${pose.slice(7)}`
                        : pose.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return `<option value="${pose}"${characterModel.userData.currentPose === pose ? ' selected' : ''}>${label}</option>`;
                }).join('');
                select.onchange = () => {
                    this.app.characterManager.setPose(characterModel, select.value);
                };

                const reset = document.createElement('button');
                reset.type = 'button';
                reset.className = 'character-pose-reset';
                reset.textContent = 'Reset';
                reset.title = 'Return to T-pose';
                reset.onclick = () => {
                    this.app.characterManager.resetPose(characterModel);
                    select.value = 't_pose';
                };

                row.appendChild(select);
                poseGroup.appendChild(row);

                const poseActions = document.createElement('div');
                poseActions.className = 'character-pose-actions';
                const editPose = document.createElement('button');
                editPose.type = 'button';
                editPose.className = 'character-pose-edit';
                editPose.textContent = 'Edit pose…';
                editPose.onclick = () => this.openPoseEditor(characterModel);
                poseActions.append(editPose, reset);
                poseGroup.appendChild(poseActions);

                this.propsContent.appendChild(poseGroup);
            }
        }

        // TRANSFORM CONTROLS - grouped to save vertical space
        const transformGroup = document.createElement('div');
        transformGroup.className = 'property-group';
        transformGroup.innerHTML = `<div class="property-label">Transform</div>`;

        transformGroup.appendChild(createVec3Row('Position', 'pos', obj.position, () => { }));
        transformGroup.appendChild(createVec3Row('Rotation', 'rot', obj.rotation, () => { }));
        transformGroup.appendChild(createVec3Row('Scale', 'scl', obj.scale, () => { }));

        this.propsContent.appendChild(transformGroup);

        if (isShape2D) {
            try {
                this.add2DProperties(obj);
                if (isText) this.addTextControls(obj);
            } catch (error) {
                console.error('Unable to render 2D properties:', error);
                this.showNotification(`2D properties error: ${error.message}`, 'error');
            }
            return;
        }

        // COLOR (Shapes, Staging & Figure Parts)
        let targetMesh = null;
        if (isShape) targetMesh = obj;
        if (isFigurePart) {
            // Find the mesh inside the group (limbs are groups with mesh children)
            targetMesh = obj.children.find(c => c.isMesh);
        } else if (obj.userData.type === 'figure') {
            // Try to color pelvis as proxy for figure
            targetMesh = obj.children.find(c => c.userData.name === 'Pelvis');
        } else if (isStaging) {
            // For staging objects, find the first mesh
            obj.traverse(c => {
                if (c.isMesh && !targetMesh) targetMesh = c;
            });
        }

        if (targetMesh && targetMesh.material) {
            const materialSlots = this.app.materialsManager?.getMaterialSlots(targetMesh) || [targetMesh.material];
            const activeSlot = Math.min(targetMesh.userData.activeMaterialSlot || 0, materialSlots.length - 1);
            const activeMaterial = materialSlots[activeSlot];
            // Add Materials Selector (pass targetMesh to show assigned material)
            this.addMaterialsSelector(obj, targetMesh, activeMaterial);

            const colorGroup = document.createElement('div');
            colorGroup.className = 'property-group';

            const lblRow = document.createElement('div');
            lblRow.style.display = 'flex';
            lblRow.style.justifyContent = 'space-between';
            lblRow.innerHTML = `<div class="property-label">Color</div>`;
            colorGroup.appendChild(lblRow);

            const colInput = document.createElement('input');
            colInput.type = 'color';
            colInput.id = 'prop-color-picker'; // ID for easier targeting
            colInput.value = '#' + activeMaterial.color.getHexString();
            colInput.addEventListener('input', (e) => {
                const hex = e.target.value;
                if (isText && this.app.factory && this.app.factory.updateTextLabel) {
                    activeMaterial.color.set(hex);
                    this.app.factory.updateTextLabel(obj, obj.userData.text || 'Text', obj.userData.fontFamily);
                } else if (obj.userData.type === 'figure') {
                    obj.traverse(c => { if (c.isMesh) c.material.color.set(hex); });
                } else if (isStaging) {
                    // For staging objects, color all meshes with the default color
                    obj.traverse(c => {
                        if (c.isMesh && c.material && c.material.color) {
                            const materials = Array.isArray(c.material) ? c.material : [c.material];
                            materials.forEach(m => {
                                if (m.color && m.color.getHex() === activeMaterial.color.getHex()) {
                                    m.color.set(hex);
                                }
                            });
                        }
                    });
                } else {
                    activeMaterial.color.set(hex);
                }
            });
            colorGroup.appendChild(colInput);
            this.propsContent.appendChild(colorGroup);

            // Add per-object physics controls
            this.addPhysicsControls(obj);

            // CAMERA RIG PROPERTIES
            if (obj.userData.rigRef) {
                this.addCameraRigControls(obj.userData.rigRef);
            }
        }

        // LIGHT PROPERTIES
        if (isLight) {
            const lightObj = obj.children[0];
            const lightType = obj.userData.lightType;

            // Color
            const lColGroup = document.createElement('div');
            lColGroup.className = 'property-group';
            lColGroup.innerHTML = `<div class="property-label">Light Color</div>`;
            const lColInput = document.createElement('input');
            lColInput.type = 'color';
            lColInput.value = '#' + lightObj.color.getHexString();
            lColInput.addEventListener('input', (e) => {
                lightObj.color.set(e.target.value);
                this.syncLightAsset(obj);
            });
            lColGroup.appendChild(lColInput);
            this.propsContent.appendChild(lColGroup);

            // Intensity (number input + slider)
            const intGroup = document.createElement('div');
            intGroup.className = 'property-group';
            intGroup.innerHTML = `<div class="property-label">Intensity</div>`;
            const intRow = document.createElement('div');
            intRow.className = 'input-row';
            intRow.style.gap = '8px';

            const intInput = document.createElement('input');
            intInput.type = 'number';
            intInput.min = '0';
            intInput.max = '100';
            intInput.value = lightObj.intensity;
            intInput.style.width = '70px';
            intInput.style.flex = 'none';
            intInput.addEventListener('input', (e) => {
                lightObj.intensity = parseFloat(e.target.value);
                intSlider.value = e.target.value;
                this.syncLightAsset(obj);
            });

            const intSlider = document.createElement('input');
            intSlider.type = 'range';
            intSlider.min = '0';
            intSlider.max = '100';
            intSlider.value = lightObj.intensity;
            intSlider.style.flex = '1';
            intSlider.addEventListener('input', (e) => {
                intInput.value = e.target.value;
                lightObj.intensity = parseFloat(e.target.value);
                this.syncLightAsset(obj);
            });

            intRow.appendChild(intInput);
            intRow.appendChild(intSlider);
            intGroup.appendChild(intRow);
            this.propsContent.appendChild(intGroup);

            // Shadows toggle
            const shadowGroup = document.createElement('div');
            shadowGroup.className = 'property-group';
            shadowGroup.innerHTML = `<div class="property-label">Shadows</div>`;
            const shadowRow = document.createElement('div');
            shadowRow.className = 'input-row';
            shadowRow.style.gap = '8px';

            const yesRadio = document.createElement('input');
            yesRadio.type = 'radio';
            yesRadio.name = 'light-shadows';
            yesRadio.id = 'light-shadows-yes';
            yesRadio.checked = lightObj.castShadow === true;
            yesRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    lightObj.castShadow = true;
                    if (lightObj.shadow) lightObj.shadow.needsUpdate = true;
                }
                this.syncLightAsset(obj);
            });

            const yesLabel = document.createElement('label');
            yesLabel.htmlFor = 'light-shadows-yes';
            yesLabel.textContent = 'Yes';
            yesLabel.style.fontSize = '0.75rem';
            yesLabel.style.color = 'var(--text-secondary)';

            const noRadio = document.createElement('input');
            noRadio.type = 'radio';
            noRadio.name = 'light-shadows';
            noRadio.id = 'light-shadows-no';
            noRadio.checked = lightObj.castShadow !== true;
            noRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    lightObj.castShadow = false;
                }
                this.syncLightAsset(obj);
            });

            const noLabel = document.createElement('label');
            noLabel.htmlFor = 'light-shadows-no';
            noLabel.textContent = 'No';
            noLabel.style.fontSize = '0.75rem';
            noLabel.style.color = 'var(--text-secondary)';

            shadowRow.appendChild(yesRadio);
            shadowRow.appendChild(yesLabel);
            shadowRow.appendChild(noRadio);
            shadowRow.appendChild(noLabel);
            shadowGroup.appendChild(shadowRow);
            this.propsContent.appendChild(shadowGroup);

            // Spot/Directional specific properties
            if (lightType === 'spot' || lightType === 'directional') {
                // Resolution
                const resGroup = document.createElement('div');
                resGroup.className = 'property-group';
                resGroup.innerHTML = `<div class="property-label">Resolution</div>`;
                const resSelect = document.createElement('select');
                resSelect.style.width = '100%';
                resSelect.style.background = 'var(--bg-light)';
                resSelect.style.border = '1px solid var(--border-color)';
                resSelect.style.borderRadius = '4px';
                resSelect.style.padding = '6px 10px';
                resSelect.style.fontSize = '0.8rem';
                resSelect.style.color = 'var(--text-primary)';
                resSelect.style.fontFamily = 'inherit';

                const resolutions = [
                    { value: '256', label: 'Low (256)' },
                    { value: '512', label: 'Medium (512)' },
                    { value: '1024', label: 'High (1024)' },
                    { value: '2048', label: 'Ultra (2048)' },
                ];

                const currentRes = lightObj.shadow?.map?.size?.width || 1024;
                resolutions.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (parseInt(opt.value) === currentRes) option.selected = true;
                    resSelect.appendChild(option);
                });

                resSelect.addEventListener('change', (e) => {
                    const size = parseInt(e.target.value);
                    if (lightObj.shadow && lightObj.shadow.map) {
                        lightObj.shadow.mapSize.set(size, size);
                        lightObj.shadow.needsUpdate = true;
                    }
                    this.syncLightAsset(obj);
                });

                resGroup.appendChild(resSelect);
                this.propsContent.appendChild(resGroup);

                // Size
                const sizeGroup = document.createElement('div');
                sizeGroup.className = 'property-group';
                sizeGroup.innerHTML = `<div class="property-label">Size</div>`;
                const sizeRow = document.createElement('div');
                sizeRow.className = 'input-row';
                sizeRow.style.gap = '8px';

                const sizeInput = document.createElement('input');
                sizeInput.type = 'number';
                sizeInput.min = '100';
                sizeInput.max = '10000';
                sizeInput.value = lightObj.shadow?.radius || 1;
                sizeInput.style.width = '70px';
                sizeInput.style.flex = 'none';
                sizeInput.addEventListener('input', (e) => {
                    if (lightObj.shadow) lightObj.shadow.radius = parseFloat(e.target.value);
                    sizeSlider.value = e.target.value;
                    this.syncLightAsset(obj);
                });

                const sizeSlider = document.createElement('input');
                sizeSlider.type = 'range';
                sizeSlider.min = '100';
                sizeSlider.max = '10000';
                sizeSlider.value = lightObj.shadow?.radius || 1;
                sizeSlider.style.flex = '1';
                sizeSlider.addEventListener('input', (e) => {
                    sizeInput.value = e.target.value;
                    if (lightObj.shadow) lightObj.shadow.radius = parseFloat(e.target.value);
                    this.syncLightAsset(obj);
                });

                sizeRow.appendChild(sizeInput);
                sizeRow.appendChild(sizeSlider);
                sizeGroup.appendChild(sizeRow);
                this.propsContent.appendChild(sizeGroup);

                // Blur / Shadow Radius
                const blurGroup = document.createElement('div');
                blurGroup.className = 'property-group';
                blurGroup.innerHTML = `<div class="property-label">Blur / Shadow Radius</div>`;
                const blurRow = document.createElement('div');
                blurRow.className = 'input-row';
                blurRow.style.gap = '8px';

                const blurInput = document.createElement('input');
                blurInput.type = 'number';
                blurInput.min = '0';
                blurInput.max = '10';
                blurInput.step = '0.1';
                blurInput.value = lightObj.shadow?.blurSamples || 0;
                blurInput.style.width = '70px';
                blurInput.style.flex = 'none';
                blurInput.addEventListener('input', (e) => {
                    if (lightObj.shadow) lightObj.shadow.blurSamples = parseFloat(e.target.value);
                    blurSlider.value = e.target.value;
                    this.syncLightAsset(obj);
                });

                const blurSlider = document.createElement('input');
                blurSlider.type = 'range';
                blurSlider.min = '0';
                blurSlider.max = '10';
                blurSlider.step = '0.1';
                blurSlider.value = lightObj.shadow?.blurSamples || 0;
                blurSlider.style.flex = '1';
                blurSlider.addEventListener('input', (e) => {
                    blurInput.value = e.target.value;
                    if (lightObj.shadow) lightObj.shadow.blurSamples = parseFloat(e.target.value);
                    this.syncLightAsset(obj);
                });

                blurRow.appendChild(blurInput);
                blurRow.appendChild(blurSlider);
                blurGroup.appendChild(blurRow);
                this.propsContent.appendChild(blurGroup);

                // Penumbra
                const penumbraGroup = document.createElement('div');
                penumbraGroup.className = 'property-group';
                penumbraGroup.innerHTML = `<div class="property-label">Penumbra</div>`;
                const penumbraRow = document.createElement('div');
                penumbraRow.className = 'input-row';
                penumbraRow.style.gap = '8px';

                const penumbraInput = document.createElement('input');
                penumbraInput.type = 'number';
                penumbraInput.min = '0';
                penumbraInput.max = '10';
                penumbraInput.step = '0.1';
                penumbraInput.value = lightObj.penumbra || 0;
                penumbraInput.style.width = '70px';
                penumbraInput.style.flex = 'none';
                penumbraInput.addEventListener('input', (e) => {
                    lightObj.penumbra = parseFloat(e.target.value);
                    penumbraSlider.value = e.target.value;
                    this.syncLightAsset(obj);
                });

                const penumbraSlider = document.createElement('input');
                penumbraSlider.type = 'range';
                penumbraSlider.min = '0';
                penumbraSlider.max = '10';
                penumbraSlider.step = '0.1';
                penumbraSlider.value = lightObj.penumbra || 0;
                penumbraSlider.style.flex = '1';
                penumbraSlider.addEventListener('input', (e) => {
                    penumbraInput.value = e.target.value;
                    lightObj.penumbra = parseFloat(e.target.value);
                    this.syncLightAsset(obj);
                });

                penumbraRow.appendChild(penumbraInput);
                penumbraRow.appendChild(penumbraSlider);
                penumbraGroup.appendChild(penumbraRow);
                this.propsContent.appendChild(penumbraGroup);
            }

            // Point/Spot specific: Distance
            if (lightType === 'point' || lightType === 'spot') {
                const distGroup = document.createElement('div');
                distGroup.className = 'property-group';
                distGroup.innerHTML = `<div class="property-label">Distance</div>`;
                const distInput = document.createElement('input');
                distInput.type = 'number';
                distInput.min = '0';
                distInput.value = lightObj.distance;
                distInput.addEventListener('input', (e) => {
                    lightObj.distance = parseFloat(e.target.value);
                    this.syncLightAsset(obj);
                });
                distGroup.appendChild(distInput);
                this.propsContent.appendChild(distGroup);
            }
        }

        // A-FRAME PROPERTIES (for shapes)
        if (isShape && obj.userData.aframe) {
            this.addAFrameProperties(obj);
        }

    }

    add2DProperties(obj) {
        const slots = this.app.materialsManager?.getMaterialSlots(obj) || [obj.material];
        const activeSlot = Math.min(obj.userData.activeMaterialSlot || 0, slots.length - 1);
        const material = slots[activeSlot];
        if (!material) return;

        this.addMaterialsSelector(obj, obj, material);

        const group = document.createElement('div');
        group.className = 'property-group';
        group.innerHTML = '<div class="property-label">2D Appearance</div>';

        const materialRow = document.createElement('div');
        materialRow.className = 'input-row';
        materialRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Material:</span>';
        const select = document.createElement('select');
        select.id = 'prop-2d-material';
        select.style.cssText = 'flex:1;background:var(--bg-light);border:1px solid var(--border-color);border-radius:4px;padding:5px 8px;color:var(--text-primary)';
        const ownOption = document.createElement('option');
        ownOption.value = '';
        ownOption.textContent = obj.userData.materialName || 'Current material';
        select.appendChild(ownOption);
        this.app.materialsManager?.materials.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
        select.addEventListener('change', e => {
            const definition = this.app.materialsManager?.materials.find(item => item.id === e.target.value);
            if (!definition) return;
            this.app.materialsManager.applyMaterialToSelected(definition);
            this.renderPropertiesPanel(obj);
        });
        materialRow.appendChild(select);
        group.appendChild(materialRow);

        const colorRow = document.createElement('div');
        colorRow.className = 'input-row';
        colorRow.style.marginTop = '8px';
        colorRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Colour:</span>';
        const color = document.createElement('input');
        color.type = 'color';
        color.id = 'prop-color-picker';
        color.value = '#' + material.color.getHexString();
        color.addEventListener('input', e => { material.color.set(e.target.value); });
        colorRow.appendChild(color);
        group.appendChild(colorRow);

        const opacityRow = document.createElement('div');
        opacityRow.className = 'input-row';
        opacityRow.style.marginTop = '8px';
        opacityRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Opacity:</span>';
        const opacity = document.createElement('input');
        opacity.type = 'range';
        opacity.min = '0'; opacity.max = '1'; opacity.step = '0.01';
        opacity.value = material.opacity ?? 1;
        opacity.style.flex = '1';
        const opacityValue = document.createElement('span');
        opacityValue.style.cssText = 'width:34px;text-align:right;font-size:.7rem';
        opacityValue.textContent = Number(opacity.value).toFixed(2);
        opacity.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            material.opacity = value;
            material.transparent = value < 1 || !!material.map || !!material.alphaMap;
            material.needsUpdate = true;
            opacityValue.textContent = value.toFixed(2);
        });
        opacityRow.append(opacity, opacityValue);
        group.appendChild(opacityRow);

        this.propsContent.appendChild(group);
        this.addPhysicsControls(obj);
    }

    // Add PBR Material Properties (Metallic and Roughness)
    // Add Outline Controls to Properties Panel
    addOutlineControls(obj, targetMesh) {
        const outlineGroup = document.createElement('div');
        outlineGroup.className = 'property-group';
        outlineGroup.innerHTML = `<div class="property-label">Outline</div>`;
        const outlineRow = document.createElement('div');
        outlineRow.className = 'input-row';
        outlineRow.style.marginBottom = '4px';

        const outlineToggle = document.createElement('input');
        outlineToggle.type = 'checkbox';
        outlineToggle.id = 'prop-outline-toggle';
        outlineToggle.checked = !!targetMesh.getObjectByName('outline');
        outlineToggle.style.marginRight = '8px';
        outlineToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.app.addOutlineToObject(targetMesh, 0x000000, 0.02);
            } else {
                const existingOutline = targetMesh.getObjectByName('outline');
                if (existingOutline) {
                    existingOutline.geometry.dispose();
                    existingOutline.material.dispose();
                    targetMesh.remove(existingOutline);
                }
            }
        });

        const outlineLabel = document.createElement('span');
        outlineLabel.style.fontSize = '0.65rem';
        outlineLabel.style.color = 'var(--text-secondary)';
        outlineLabel.textContent = 'Enable Outline';

        const outlineColor = document.createElement('input');
        outlineColor.type = 'color';
        outlineColor.id = 'prop-outline-color';
        outlineColor.value = '#000000';
        outlineColor.style.marginLeft = '8px';
        outlineColor.addEventListener('input', (e) => {
            const existingOutline = targetMesh.getObjectByName('outline');
            if (existingOutline && existingOutline.material) {
                existingOutline.material.color.set(e.target.value);
            }
        });

        const outlineThickness = document.createElement('input');
        outlineThickness.type = 'range';
        outlineThickness.id = 'prop-outline-thickness';
        outlineThickness.min = '0.005';
        outlineThickness.max = '0.2';
        outlineThickness.step = '0.005';
        outlineThickness.value = '0.02';
        outlineThickness.style.marginLeft = '8px';
        outlineThickness.style.flex = '1';
        outlineThickness.addEventListener('input', (e) => {
            const existingOutline = targetMesh.getObjectByName('outline');
            if (existingOutline) {
                const s = 1 + parseFloat(e.target.value);
                existingOutline.scale.set(s, s, s);
            }
        });

        outlineRow.appendChild(outlineToggle);
        outlineRow.appendChild(outlineLabel);
        outlineRow.appendChild(outlineColor);
        outlineRow.appendChild(outlineThickness);
        outlineGroup.appendChild(outlineRow);

        this.propsContent.appendChild(outlineGroup);
    }

    // Add Camera Rig Controls to Properties Panel
    addCameraRigControls(rig) {
        const group = document.createElement('div');
        group.className = 'property-group';
        group.innerHTML = `<div class="property-label">Camera Rig: ${rig.name}</div>`;

        // Lens preset selector
        const lensRow = document.createElement('div');
        lensRow.className = 'input-row';
        lensRow.style.marginBottom = '8px';
        lensRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Lens:</span>';
        const lensSelect = document.createElement('select');
        lensSelect.id = 'camera-lens-preset';
        lensSelect.style.cssText = 'flex:1;background:var(--bg-light);border:1px solid var(--border-color);border-radius:4px;padding:5px 8px;color:var(--text-primary);font-size:.75rem';
        lensSelect.innerHTML = '12,16,24,35,50,85,135'.split(',').map(f => `<option value="${f}"${f == rig.lens.focalLength ? ' selected' : ''}>${f}mm</option>`).join('');
        lensSelect.addEventListener('change', (e) => {
            this.app.staging.cameras.setLens(rig, parseFloat(e.target.value), null);
        });
        lensRow.appendChild(lensSelect);
        group.appendChild(lensRow);

        // Sensor preset selector
        const sensorRow = document.createElement('div');
        sensorRow.className = 'input-row';
        sensorRow.style.marginBottom = '8px';
        sensorRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Sensor:</span>';
        const sensorSelect = document.createElement('select');
        sensorSelect.id = 'camera-sensor-preset';
        sensorSelect.style.cssText = 'flex:1;background:var(--bg-light);border:1px solid var(--border-color);border-radius:4px;padding:5px 8px;color:var(--text-primary);font-size:.75rem';
        sensorSelect.innerHTML = Object.entries({fullFrame: 'Full Frame', super35: 'Super 35', mft: 'MFT'}).map(([k, v]) => `<option value="${k}"${k == rig.lens.sensor ? ' selected' : ''}>${v}</option>`).join('');
        sensorSelect.addEventListener('change', (e) => {
            this.app.staging.cameras.setLens(rig, null, e.target.value);
        });
        sensorRow.appendChild(sensorSelect);
        group.appendChild(sensorRow);

        // Aspect ratio selector
        const aspectRow = document.createElement('div');
        aspectRow.className = 'input-row';
        aspectRow.style.marginBottom = '8px';
        aspectRow.innerHTML = '<span style="width:70px;font-size:.75rem;color:var(--text-secondary)">Aspect:</span>';
        const aspectSelect = document.createElement('select');
        aspectSelect.id = 'camera-aspect-preset';
        aspectSelect.style.cssText = 'flex:1;background:var(--bg-light);border:1px solid var(--border-color);border-radius:4px;padding:5px 8px;color:var(--text-primary);font-size:.75rem';
        aspectSelect.innerHTML = Object.entries({'16:9': '16:9 (1.78)', '2.39:1': '2.39:1', '1.85:1': '1.85:1', '4:3': '4:3 (1.33)', '1:1': '1:1'}).map(([k, v]) => `<option value="${k}"${k == rig.aspect ? ' selected' : ''}>${v}</option>`).join('');
        aspectSelect.addEventListener('change', (e) => {
            this.app.staging.cameras.setAspect(rig, e.target.value);
        });
        aspectRow.appendChild(aspectSelect);
        group.appendChild(aspectRow);

        // Action buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'input-row';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '8px';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn primary';
        viewBtn.style.flex = '1';
        viewBtn.style.fontSize = '0.75rem';
        viewBtn.textContent = this.app.staging.cameras.viewingRigId === rig.id ? 'Exit View' : 'View Through';
        viewBtn.onclick = () => {
            if (this.app.staging.cameras.viewingRigId === rig.id) {
                this.app.staging.cameras.cycleViewThrough(); // Exit to layout
            } else {
                this.app.staging.cameras.viewingRigId = rig.id;
                if (this.app.orbit) this.app.orbit.enabled = false;
                this.app.ui?.showNotification(`Viewing through Camera ${rig.name}`, 'info');
            }
            this.renderPropertiesPanel(this.app.selectedObject);
        };
        btnRow.appendChild(viewBtn);

        const frameBtn = document.createElement('button');
        frameBtn.className = 'btn';
        frameBtn.style.flex = '1';
        frameBtn.style.fontSize = '0.75rem';
        frameBtn.textContent = 'Frame from View';
        frameBtn.onclick = () => {
            this.app.staging.cameras.setFromCurrentView(rig);
            this.app.ui?.showNotification(`Camera ${rig.name} framed from current view`, 'success');
        };
        btnRow.appendChild(frameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.style.flex = '1';
        deleteBtn.style.fontSize = '0.75rem';
        deleteBtn.style.color = '#f66';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            if (confirm(`Delete Camera ${rig.name}?`)) {
                this.app.staging.cameras.removeRig(rig.id);
            }
        };
        btnRow.appendChild(deleteBtn);

        group.appendChild(btnRow);

        this.propsContent.appendChild(group);
    }

    // Add per-object Physics Controls to Properties Panel
    addPhysicsControls(obj) {
        if (!this.app.physicsManager) return;

        const physicsGroup = document.createElement('div');
        physicsGroup.className = 'property-group';
        physicsGroup.innerHTML = `<div class="property-label" style="color: var(--accent-tertiary);"><i class="fas fa-atom" style="margin-right: 6px;"></i>Physics</div>`;

        // Enable/disable physics for this object
        const enableRow = document.createElement('div');
        enableRow.className = 'input-row';
        enableRow.style.marginBottom = '8px';

        const enableToggle = document.createElement('input');
        enableToggle.type = 'checkbox';
        enableToggle.id = 'prop-physics-enabled';
        enableToggle.checked = obj.userData.physicsEnabled || false;
        enableToggle.style.marginRight = '8px';

        const enableLabel = document.createElement('span');
        enableLabel.style.fontSize = '0.75rem';
        enableLabel.style.color = 'var(--text-secondary)';
        enableLabel.textContent = 'Enable Physics';

        enableToggle.addEventListener('change', (e) => {
            obj.userData.physicsEnabled = e.target.checked;
            if (e.target.checked) {
                this.app.physicsManager.addMesh(obj, {
                    mass: obj.userData.physicsMass ?? 1,
                    bodyType: obj.userData.physicsBodyType ?? 2,
                    friction: obj.userData.physicsFriction ?? 0.3,
                    restitution: obj.userData.physicsRestitution ?? 0.2,
                    linearDamping: obj.userData.physicsLinearDamping ?? 0.01,
                    angularDamping: obj.userData.physicsAngularDamping ?? 0.01
                });
            } else {
                this.app.physicsManager.removeMesh(obj);
            }
        });

        enableRow.appendChild(enableToggle);
        enableRow.appendChild(enableLabel);
        physicsGroup.appendChild(enableRow);

        // Body type selector
        const bodyTypeRow = document.createElement('div');
        bodyTypeRow.className = 'input-row';
        bodyTypeRow.style.marginBottom = '8px';

        const bodyTypeLabel = document.createElement('span');
        bodyTypeLabel.style.fontSize = '0.75rem';
        bodyTypeLabel.style.color = 'var(--text-secondary)';
        bodyTypeLabel.style.width = '60px';
        bodyTypeLabel.textContent = 'Body:';
        bodyTypeRow.appendChild(bodyTypeLabel);

        const bodyTypeSelect = document.createElement('select');
        bodyTypeSelect.id = 'prop-physics-body-type';
        bodyTypeSelect.style.flex = '1';
        bodyTypeSelect.style.background = 'var(--bg-light)';
        bodyTypeSelect.style.border = '1px solid var(--border-color)';
        bodyTypeSelect.style.borderRadius = '4px';
        bodyTypeSelect.style.padding = '4px 8px';
        bodyTypeSelect.style.fontSize = '0.75rem';
        bodyTypeSelect.style.color = 'var(--text-primary)';

        const bodyTypes = [
            { value: '2', label: 'Dynamic' },
            { value: '1', label: 'Static' },
            { value: '4', label: 'Kinematic' }
        ];

        bodyTypes.forEach(bt => {
            const option = document.createElement('option');
            option.value = bt.value;
            option.textContent = bt.label;
            if ((obj.userData.physicsBodyType || 2) == bt.value) {
                option.selected = true;
            }
            bodyTypeSelect.appendChild(option);
        });

        bodyTypeSelect.addEventListener('change', (e) => {
            const bodyType = parseInt(e.target.value);
            obj.userData.physicsBodyType = bodyType;
            if (this.app.physicsManager.getBodyForMesh(obj)) {
                this.app.physicsManager.setBodyType(obj, bodyType);
            }
        });

        bodyTypeRow.appendChild(bodyTypeSelect);
        physicsGroup.appendChild(bodyTypeRow);

        // Mass slider
        const massRow = document.createElement('div');
        massRow.className = 'input-row';
        massRow.style.marginBottom = '4px';

        const massLabel = document.createElement('span');
        massLabel.style.fontSize = '0.75rem';
        massLabel.style.color = 'var(--text-secondary)';
        massLabel.style.width = '60px';
        massLabel.textContent = 'Mass:';
        massRow.appendChild(massLabel);

        const massSlider = document.createElement('input');
        massSlider.type = 'range';
        massSlider.id = 'prop-physics-mass';
        massSlider.min = '0.1';
        massSlider.max = '50';
        massSlider.step = '0.1';
        massSlider.value = obj.userData.physicsMass || 1;
        massSlider.style.flex = '1';

        const massValue = document.createElement('span');
        massValue.id = 'prop-physics-mass-value';
        massValue.style.fontSize = '0.7rem';
        massValue.style.color = 'var(--text-primary)';
        massValue.style.width = '30px';
        massValue.style.textAlign = 'right';
        massValue.textContent = (obj.userData.physicsMass || 1).toFixed(1);

        massSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            massValue.textContent = value.toFixed(1);
            obj.userData.physicsMass = value;
            const body = this.app.physicsManager.getBodyForMesh(obj);
            if (body) {
                body.userData.originalMass = value;
                if (body.type !== 1) {
                    body.mass = value;
                    body.updateMassProperties();
                }
            }
        });

        massRow.appendChild(massLabel);
        massRow.appendChild(massSlider);
        massRow.appendChild(massValue);
        physicsGroup.appendChild(massRow);

        const addPhysicsSlider = (label, key, min, max, step, fallback, applyValue) => {
            const row = document.createElement('div');
            row.className = 'input-row';
            row.style.marginBottom = '4px';

            const text = document.createElement('span');
            text.style.fontSize = '0.75rem';
            text.style.color = 'var(--text-secondary)';
            text.style.width = '60px';
            text.textContent = `${label}:`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = String(min);
            slider.max = String(max);
            slider.step = String(step);
            slider.value = String(obj.userData[key] ?? fallback);
            slider.style.flex = '1';

            const valueText = document.createElement('span');
            valueText.style.fontSize = '0.7rem';
            valueText.style.color = 'var(--text-primary)';
            valueText.style.width = '34px';
            valueText.style.textAlign = 'right';
            valueText.textContent = Number(slider.value).toFixed(2);

            slider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                obj.userData[key] = value;
                valueText.textContent = value.toFixed(2);
                const body = this.app.physicsManager.getBodyForMesh(obj);
                if (body) applyValue(body, value);
            });

            row.appendChild(text);
            row.appendChild(slider);
            row.appendChild(valueText);
            physicsGroup.appendChild(row);
        };

        addPhysicsSlider('Friction', 'physicsFriction', 0, 1, 0.01, 0.3, (body, value) => {
            if (!body.material) body.material = {};
            body.material.friction = value;
        });
        addPhysicsSlider('Bounce', 'physicsRestitution', 0, 1, 0.01, 0.2, (body, value) => {
            if (!body.material) body.material = {};
            body.material.restitution = value;
        });
        addPhysicsSlider('Move drag', 'physicsLinearDamping', 0, 1, 0.01, 0.01, (body, value) => {
            body.linearDamping = value;
        });
        addPhysicsSlider('Spin drag', 'physicsAngularDamping', 0, 1, 0.01, 0.01, (body, value) => {
            body.angularDamping = value;
        });

        this.propsContent.appendChild(physicsGroup);
    }

    // Add 2D Text Controls to Properties Panel
    addTextControls(obj) {
        if (!obj || obj.userData.type !== 'shape2d' || obj.userData.shapeType !== 'text') return;

        const textGroup = document.createElement('div');
        textGroup.className = 'property-group';
        textGroup.innerHTML = `<div class="property-label" style="color: var(--accent-secondary);"><i class="fas fa-font" style="margin-right: 6px;"></i>Text Properties</div>`;

        // Text content
        const textRow = document.createElement('div');
        textRow.className = 'input-row';
        textRow.style.marginBottom = '8px';

        const textLabel = document.createElement('span');
        textLabel.style.fontSize = '0.75rem';
        textLabel.style.color = 'var(--text-secondary)';
        textLabel.style.width = '60px';
        textLabel.textContent = 'Text:';
        textRow.appendChild(textLabel);

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = obj.userData.text || 'Text';
        textInput.style.flex = '1';
        textInput.style.background = 'var(--bg-light)';
        textInput.style.border = '1px solid var(--border-color)';
        textInput.style.borderRadius = '4px';
        textInput.style.padding = '4px 8px';
        textInput.style.fontSize = '0.75rem';
        textInput.style.color = 'var(--text-primary)';
        textInput.addEventListener('input', (e) => {
            obj.userData.text = e.target.value;
            if (this.app.factory && this.app.factory.updateTextLabel) {
                this.app.factory.updateTextLabel(obj, e.target.value, obj.userData.fontFamily);
            }
        });
        textRow.appendChild(textInput);
        textGroup.appendChild(textRow);

        // Font family
        const fontRow = document.createElement('div');
        fontRow.className = 'input-row';
        fontRow.style.marginBottom = '4px';

        const fontLabel = document.createElement('span');
        fontLabel.style.fontSize = '0.75rem';
        fontLabel.style.color = 'var(--text-secondary)';
        fontLabel.style.width = '60px';
        fontLabel.textContent = 'Font:';
        fontRow.appendChild(fontLabel);

        const fontSelect = document.createElement('select');
        fontSelect.style.flex = '1';
        fontSelect.style.background = 'var(--bg-light)';
        fontSelect.style.border = '1px solid var(--border-color)';
        fontSelect.style.borderRadius = '4px';
        fontSelect.style.padding = '4px 8px';
        fontSelect.style.fontSize = '0.75rem';
        fontSelect.style.color = 'var(--text-primary)';

        const fonts = [
            'Inter, sans-serif',
            'Roboto, sans-serif',
            'Open Sans, sans-serif',
            'Montserrat, sans-serif',
            'Poppins, sans-serif',
            'Lato, sans-serif',
            'Oswald, sans-serif',
            'Raleway, sans-serif',
            'Noto Sans, sans-serif',
            'Ubuntu, sans-serif',
            'Merriweather, serif',
            'Playfair Display, serif',
            'Fira Code, monospace',
            'Bebas Neue, sans-serif',
            'Pacifico, cursive',
            'Press Start 2P, cursive'
        ];

        fonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font.split(',')[0];
            if (obj.userData.fontFamily === font || (!obj.userData.fontFamily && font === 'Inter, sans-serif')) {
                option.selected = true;
            }
            fontSelect.appendChild(option);
        });

        fontSelect.addEventListener('change', async (e) => {
            obj.userData.fontFamily = e.target.value;
            await this.loadGoogleFont(e.target.value);
            if (this.app.factory && this.app.factory.updateTextLabel) {
                this.app.factory.updateTextLabel(obj, obj.userData.text || 'Text', e.target.value);
            }
        });
        fontRow.appendChild(fontSelect);
        textGroup.appendChild(fontRow);

        this.propsContent.appendChild(textGroup);
    }

    async loadGoogleFont(fontFamily) {
        const family = fontFamily.split(',')[0].trim();
        if (!family || family === 'Inter') return;
        const id = `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;700&display=swap`;
            document.head.appendChild(link);
        }
        if (document.fonts?.load) {
            try { await document.fonts.load(`700 80px "${family}"`); } catch (_) { /* use browser fallback */ }
        }
    }

    // Add A-Frame Properties to Properties Panel
    addAFrameProperties(obj) {
        if (!obj.userData.aframe) {
            obj.userData.aframe = {
                src: '',
                shadow: { cast: true, receive: true },
                animation: '',
                customAttrs: {}
            };
        }

        const aframeData = obj.userData.aframe;

        // Create A-Frame properties group
        const aframeGroup = document.createElement('div');
        aframeGroup.className = 'property-group';
        aframeGroup.innerHTML = `<div class="property-label" style="color: var(--accent-tertiary);"><i class="fas fa-vr-cardboard" style="margin-right: 6px;"></i>A-Frame Properties</div>`;

        // Source/Asset URL
        const srcRow = document.createElement('div');
        srcRow.className = 'input-row';
        srcRow.style.marginBottom = '8px';
        srcRow.innerHTML = `
            <span style="font-size: 0.65rem; color: var(--text-secondary); width: 60px;">Asset URL:</span>
            <input type="text" id="aframe-src" value="${aframeData.src || ''}" 
                placeholder="#asset-id or URL"
                style="flex: 1; background: var(--bg-light); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.7rem; color: var(--text-primary);">
        `;
        srcRow.querySelector('input').addEventListener('input', (e) => {
            aframeData.src = e.target.value;
        });
        aframeGroup.appendChild(srcRow);

        // Shadow settings
        const shadowRow = document.createElement('div');
        shadowRow.className = 'input-row';
        shadowRow.style.marginBottom = '8px';
        shadowRow.innerHTML = `
            <label style="font-size: 0.65rem; color: var(--text-secondary); display: flex; align-items: center; margin-right: 12px;">
                <input type="checkbox" id="aframe-shadow-cast" ${aframeData.shadow?.cast ? 'checked' : ''} style="margin-right: 4px;">
                Cast Shadow
            </label>
            <label style="font-size: 0.65rem; color: var(--text-secondary); display: flex; align-items: center;">
                <input type="checkbox" id="aframe-shadow-receive" ${aframeData.shadow?.receive ? 'checked' : ''} style="margin-right: 4px;">
                Receive Shadow
            </label>
        `;
        shadowRow.querySelector('#aframe-shadow-cast').addEventListener('change', (e) => {
            if (!aframeData.shadow) aframeData.shadow = {};
            aframeData.shadow.cast = e.target.checked;
        });
        shadowRow.querySelector('#aframe-shadow-receive').addEventListener('change', (e) => {
            if (!aframeData.shadow) aframeData.shadow = {};
            aframeData.shadow.receive = e.target.checked;
        });
        aframeGroup.appendChild(shadowRow);

        // Animation
        const animRow = document.createElement('div');
        animRow.className = 'input-row';
        animRow.style.marginBottom = '8px';
        animRow.innerHTML = `
            <span style="font-size: 0.65rem; color: var(--text-secondary); width: 60px;">Animation:</span>
            <input type="text" id="aframe-animation" value="${aframeData.animation || ''}" 
                placeholder="property: rotation; to: 0 360 0; loop: true"
                style="flex: 1; background: var(--bg-light); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.7rem; color: var(--text-primary);">
        `;
        animRow.querySelector('input').addEventListener('input', (e) => {
            aframeData.animation = e.target.value;
        });
        aframeGroup.appendChild(animRow);

        // Quick animation presets
        const presetsRow = document.createElement('div');
        presetsRow.className = 'input-row';
        presetsRow.style.marginBottom = '4px';
        presetsRow.innerHTML = `
            <span style="font-size: 0.6rem; color: var(--text-secondary);">Presets:</span>
            <button class="btn" style="font-size: 0.6rem; padding: 2px 6px; margin-left: 4px;" data-preset="rotate">Rotate</button>
            <button class="btn" style="font-size: 0.6rem; padding: 2px 6px; margin-left: 4px;" data-preset="bounce">Bounce</button>
            <button class="btn" style="font-size: 0.6rem; padding: 2px 6px; margin-left: 4px;" data-preset="pulse">Pulse</button>
        `;
        presetsRow.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                const animInput = document.getElementById('aframe-animation');
                let animValue = '';
                switch (preset) {
                    case 'rotate':
                        animValue = 'property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear';
                        break;
                    case 'bounce':
                        animValue = 'property: position; dir: alternate; dur: 1000; easing: easeInOutQuad; loop: true; to: 0 2 0';
                        break;
                    case 'pulse':
                        animValue = 'property: scale; dir: alternate; dur: 500; easing: easeInOutSine; loop: true; to: 1.2 1.2 1.2';
                        break;
                }
                if (animInput) {
                    animInput.value = animValue;
                    aframeData.animation = animValue;
                }
            });
        });
        aframeGroup.appendChild(presetsRow);

        this.propsContent.appendChild(aframeGroup);
    }

    // Add Materials Selector to Properties Panel
    addMaterialsSelector(obj, targetMesh, currentMaterial = null) {
        if (!this.app.materialsManager) return;

        const materialsGroup = document.createElement('div');
        materialsGroup.className = 'property-group';

        // Create materials selector header
        const selectorHeader = document.createElement('div');
        selectorHeader.style.display = 'flex';
        selectorHeader.style.justifyContent = 'space-between';
        selectorHeader.style.alignItems = 'center';
        selectorHeader.style.marginBottom = '6px';

        const selectorLabel = document.createElement('div');
        selectorLabel.className = 'property-label';
        selectorLabel.textContent = 'Material';
        selectorHeader.appendChild(selectorLabel);

        // Add create new material button
        const createMaterialBtn = document.createElement('button');
        createMaterialBtn.className = 'btn folder-btn';
        createMaterialBtn.style.fontSize = '0.6rem';
        createMaterialBtn.style.padding = '2px 4px';
        createMaterialBtn.innerHTML = '<i class="fas fa-plus" style="font-size: 0.7rem;"></i>';
        createMaterialBtn.title = 'Create New Material';
        createMaterialBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.materialsManager.createNewMaterial();
        });
        selectorHeader.appendChild(createMaterialBtn);

        materialsGroup.appendChild(selectorHeader);

        const slots = this.app.materialsManager.getMaterialSlots(targetMesh);
        const activeSlot = Math.min(targetMesh.userData.activeMaterialSlot || 0, slots.length - 1);
        const slotRow = document.createElement('div');
        slotRow.className = 'input-row';
        slotRow.style.cssText = 'gap:6px;margin-bottom:8px;';

        const slotSelect = document.createElement('select');
        slotSelect.title = 'Material slot';
        slotSelect.style.cssText = 'flex:1;background:var(--bg-light);border:1px solid var(--border-color);border-radius:4px;padding:5px;color:var(--text-primary);';
        slots.forEach((slot, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `Slot ${index + 1}: ${slot.name || 'Material'}`;
            option.selected = index === activeSlot;
            slotSelect.appendChild(option);
        });
        slotSelect.addEventListener('change', event => {
            targetMesh.userData.activeMaterialSlot = parseInt(event.target.value);
            this.renderPropertiesPanel(obj);
        });

        const addSlotBtn = document.createElement('button');
        addSlotBtn.className = 'btn';
        addSlotBtn.textContent = '+';
        addSlotBtn.title = 'Add material slot';
        addSlotBtn.addEventListener('click', () => {
            this.app.materialsManager.addMaterialSlot(targetMesh);
            this.renderPropertiesPanel(obj);
        });

        const removeSlotBtn = document.createElement('button');
        removeSlotBtn.className = 'btn';
        removeSlotBtn.textContent = '−';
        removeSlotBtn.title = 'Remove active material slot';
        removeSlotBtn.disabled = slots.length <= 1;
        removeSlotBtn.addEventListener('click', () => {
            this.app.materialsManager.removeMaterialSlot(targetMesh, targetMesh.userData.activeMaterialSlot || 0);
            this.renderPropertiesPanel(obj);
        });

        slotRow.append(slotSelect, addSlotBtn, removeSlotBtn);
        materialsGroup.appendChild(slotRow);

        // Create custom materials dropdown wrapper
        const dropdownWrapper = document.createElement('div');
        dropdownWrapper.className = 'material-dropdown-wrapper';

        // Find currently assigned material by matching color/metalness/roughness
        let assignedMaterial = null;
        if (currentMaterial) {
            assignedMaterial = this.app.materialsManager.materials.find(m => 
                m.color === currentMaterial.color.getHex() &&
                m.metalness === currentMaterial.metalness &&
                m.roughness === currentMaterial.roughness
            );
        }

        // Create the visible dropdown button with assigned material text
        const dropdownButton = document.createElement('div');
        dropdownButton.className = 'material-selector';
        const initialText = assignedMaterial 
            ? `${assignedMaterial.name} (M:${assignedMaterial.metalness.toFixed(1)}, R:${assignedMaterial.roughness.toFixed(1)}, O:${(assignedMaterial.opacity !== undefined ? assignedMaterial.opacity : 1).toFixed(1)})`
            : 'Select a material...';
        dropdownButton.innerHTML = `
            <span class="selected-material-text">${initialText}</span>
            <svg class="dropdown-arrow" fill="white" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5z"/>
            </svg>
        `;

        // Create the dropdown list (hidden by default)
        const dropdownList = document.createElement('div');
        dropdownList.className = 'material-dropdown-list';

        // Add default item
        const defaultItem = document.createElement('div');
        defaultItem.className = 'material-dropdown-item';
        defaultItem.innerHTML = `
            <div class="material-color-swatch" style="background-color: transparent; border: 1px dashed var(--border-color);"></div>
            <span class="material-option-text">Select a material...</span>
        `;
        defaultItem.addEventListener('click', () => {
            dropdownButton.querySelector('.selected-material-text').textContent = 'Select a material...';
            dropdownList.classList.remove('show');
            dropdownWrapper.classList.remove('open');
            dropdownList.querySelectorAll('.material-dropdown-item').forEach(item => item.classList.remove('selected'));
        });
        dropdownList.appendChild(defaultItem);

        // Add materials from materials manager
        this.app.materialsManager.materials.forEach(material => {
            // Convert hex color to CSS format
            const colorHex = material.color ? '#' + material.color.toString(16).padStart(6, '0') : '#ffffff';
            const itemText = `${material.name} (M:${material.metalness.toFixed(1)}, R:${material.roughness.toFixed(1)}, O:${(material.opacity !== undefined ? material.opacity : 1).toFixed(1)})`;

            const dropdownItem = document.createElement('div');
            dropdownItem.className = 'material-dropdown-item';
            if (assignedMaterial && material.id === assignedMaterial.id) {
                dropdownItem.classList.add('selected');
            }
            dropdownItem.dataset.materialId = material.id;
            dropdownItem.innerHTML = `
                <div class="material-color-swatch" style="background-color: ${colorHex}; border: 1px solid var(--border-color);"></div>
                <span class="material-option-text">${itemText}</span>
            `;

            dropdownItem.addEventListener('click', () => {
                // Remove selected class from all items
                dropdownList.querySelectorAll('.material-dropdown-item').forEach(item => {
                    item.classList.remove('selected');
                });

                // Add selected class to clicked item
                dropdownItem.classList.add('selected');

                dropdownButton.querySelector('.selected-material-text').textContent = dropdownItem.querySelector('.material-option-text').textContent;
                dropdownList.classList.remove('show');
                dropdownWrapper.classList.remove('open');

                // Apply the selected material
                const clickedMaterialId = dropdownItem.dataset.materialId;
                const clickedMaterial = this.app.materialsManager.materials.find(m => m.id === clickedMaterialId);
                if (clickedMaterial) {
                    this.app.materialsManager.applyMaterialToSelected(clickedMaterial);
                }
            });

            dropdownList.appendChild(dropdownItem);
        });

        // Add click handler to toggle dropdown
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownList.classList.contains('show');
            if (isOpen) {
                dropdownList.classList.remove('show');
                dropdownWrapper.classList.remove('open');
            } else {
                dropdownList.classList.add('show');
                dropdownWrapper.classList.add('open');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownWrapper.contains(e.target)) {
                dropdownList.classList.remove('show');
                dropdownWrapper.classList.remove('open');
            }
        });

        dropdownWrapper.appendChild(dropdownButton);
        dropdownWrapper.appendChild(dropdownList);
        materialsGroup.appendChild(dropdownWrapper);
        this.propsContent.appendChild(materialsGroup);
    }

    // Method to update material properties UI when a material is selected
    updateMaterialPropertiesUI(material, targetMesh, slotIndex = null) {
        if (!material || !targetMesh) return;
        const materialSlots = this.app.materialsManager?.getMaterialSlots(targetMesh) || [targetMesh.material];
        const editedMaterial = materialSlots[slotIndex ?? targetMesh.userData.activeMaterialSlot ?? 0] || materialSlots[0];

        // Update color picker
        const colorPicker = document.getElementById('prop-color-picker');
        if (colorPicker) {
            colorPicker.value = '#' + material.color.toString(16).padStart(6, '0');
        }

        // Update metallic slider using specific ID
        const metallicInput = document.getElementById('prop-metallic-slider');
        if (metallicInput) {
            metallicInput.value = material.metalness;
        }

        // Update roughness slider using specific ID
        const roughnessInput = document.getElementById('prop-roughness-slider');
        if (roughnessInput) {
            roughnessInput.value = material.roughness;
        }

        // Update opacity slider using specific ID
        const opacityInput = document.getElementById('prop-opacity-slider');
        if (opacityInput) {
            opacityInput.value = material.opacity !== undefined ? material.opacity : 1;
        }

        // Update clearcoat slider using specific ID
        const clearcoatInput = document.getElementById('prop-clearcoat-slider');
        if (clearcoatInput) {
            clearcoatInput.value = material.clearcoat || 0;
        }

        // Update transmission slider using specific ID
        const transmissionInput = document.getElementById('prop-transmission-slider');
        if (transmissionInput) {
            transmissionInput.value = material.transmission || 0;
        }

        // Update sheen slider using specific ID
        const sheenInput = document.getElementById('prop-sheen-slider');
        if (sheenInput) {
            sheenInput.value = material.sheen || 0;
        }

        // Update outline toggle
        const outlineToggle = document.getElementById('prop-outline-toggle');
        if (outlineToggle) {
            outlineToggle.checked = material.outlineEnabled || false;
        }

        // Update outline color
        const outlineColorInput = document.getElementById('prop-outline-color');
        if (outlineColorInput) {
            outlineColorInput.value = '#' + (material.outlineColor || 0x000000).toString(16).padStart(6, '0');
        }

        // Update outline thickness
        const outlineThicknessInput = document.getElementById('prop-outline-thickness');
        if (outlineThicknessInput) {
            outlineThicknessInput.value = material.outlineThickness || 0.02;
        }

        // Update the actual material properties on the mesh
        editedMaterial.color.setHex(material.color);
        editedMaterial.metalness = material.metalness;
        editedMaterial.roughness = material.roughness;
        editedMaterial.opacity = material.opacity !== undefined ? material.opacity : 1;
        editedMaterial.transparent = editedMaterial.opacity < 1 || !!editedMaterial.alphaMap;
        editedMaterial.clearcoat = material.clearcoat || 0;
        editedMaterial.transmission = material.transmission || 0;
        editedMaterial.sheen = material.sheen || 0;
        editedMaterial.sheenRoughness = material.sheenRoughness || 0.5;
        
        // Apply texture maps if available
        if (material.maps) {
            editedMaterial.map = material.maps.albedo || null;
            editedMaterial.normalMap = material.maps.normal || null;
            editedMaterial.roughnessMap = material.maps.roughnessMap || null;
            editedMaterial.metalnessMap = material.maps.metalnessMap || null;
            editedMaterial.aoMap = material.maps.aoMap || null;
            editedMaterial.displacementMap = material.maps.displacementMap || null;
            editedMaterial.alphaMap = material.maps.alphaMap || null;
            editedMaterial.emissiveMap = material.maps.emissiveMap || null;
            editedMaterial.displacementScale = material.displacementScale || 0;
            editedMaterial.needsUpdate = true;
        }

        // Outline
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
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.textContent = message;

        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = '#fff';
        notification.style.fontSize = '12px';
        notification.style.fontWeight = 'bold';
        notification.style.zIndex = '10000';
        notification.style.border = '1px solid rgba(255,255,255,0.2)';
        notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        notification.style.transition = 'all 0.3s ease';
        notification.style.transform = 'translateY(-20px)';
        notification.style.opacity = '0';

        const colors = { success: '#00ff41', error: '#ff006e', info: '#00d9ff' };
        notification.style.backgroundColor = '#1a1a2e';
        notification.style.borderLeft = `4px solid ${colors[type] || colors.info}`;

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- SCENE PANEL FUNCTIONALITY ---
    initSceneExport() {
        // Initialize export button
        const exportBtn = document.getElementById('btn-export-png');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSceneAsPNG();
            });
        }

        // Initialize camera border toggle
        const borderToggle = document.getElementById('show-camera-border');
        if (borderToggle) {
            borderToggle.addEventListener('change', (e) => {
                this.toggleCameraBorder(e.target.checked);
            });
        }

        // Initialize canvas size controls
        const resolutionDropdown = document.getElementById('export-resolution');
        if (resolutionDropdown) {
            resolutionDropdown.addEventListener('change', () => this.updateCameraBorderFromDropdown());
        }

        // Initialize camera border visualization
        this.updateCameraBorder();

        // Make camera border preview draggable
        this.makeCameraBorderDraggable();
    }

    // --- A-FRAME EXPORT FUNCTIONALITY ---
    initAFrameExport() {
        // Refresh preview button
        const refreshBtn = document.getElementById('btn-refresh-aframe');
        if (refreshBtn && !refreshBtn.hasAttribute('data-initialized')) {
            refreshBtn.setAttribute('data-initialized', 'true');
            refreshBtn.addEventListener('click', () => {
                this.refreshAFramePreview();
            });
        }

        // Download button
        const downloadBtn = document.getElementById('btn-download-aframe');
        if (downloadBtn && !downloadBtn.hasAttribute('data-initialized')) {
            downloadBtn.setAttribute('data-initialized', 'true');
            downloadBtn.addEventListener('click', () => {
                this.downloadAFrameHTML();
            });
        }

        // Copy button
        const copyBtn = document.getElementById('btn-copy-aframe');
        if (copyBtn && !copyBtn.hasAttribute('data-initialized')) {
            copyBtn.setAttribute('data-initialized', 'true');
            copyBtn.addEventListener('click', () => {
                this.copyAFrameToClipboard();
            });
        }

        // Initial preview refresh
        this.refreshAFramePreview();
    }

    refreshAFramePreview() {
        if (!this.app.aframeExporter) {
            this.showNotification('A-Frame exporter not available', 'error');
            return;
        }

        const options = this.getAFrameExportOptions();
        const html = this.app.aframeExporter.generateHTML(options);
        
        const preview = document.getElementById('aframe-html-preview');
        if (preview) {
            preview.value = html;
        }
    }

    getAFrameExportOptions() {
        return {
            title: document.getElementById('aframe-scene-title')?.value || 'Pixel 3D - A-Frame Export',
            includeInspector: document.getElementById('aframe-include-inspector')?.checked ?? true,
            includeStats: document.getElementById('aframe-include-stats')?.checked ?? false,
            backgroundColor: '#2a2a4e'
        };
    }

    downloadAFrameHTML() {
        if (!this.app.aframeExporter) {
            this.showNotification('A-Frame exporter not available', 'error');
            return;
        }

        const options = this.getAFrameExportOptions();
        const title = options.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        this.app.aframeExporter.downloadHTML(`${title}.html`, options);
        this.showNotification('A-Frame HTML downloaded!', 'success');
    }

    async copyAFrameToClipboard() {
        if (!this.app.aframeExporter) {
            this.showNotification('A-Frame exporter not available', 'error');
            return;
        }

        const options = this.getAFrameExportOptions();
        const success = await this.app.aframeExporter.copyToClipboard(options);
        
        if (success) {
            this.showNotification('A-Frame HTML copied to clipboard!', 'success');
        } else {
            this.showNotification('Failed to copy to clipboard', 'error');
        }
    }


    makeCameraBorderDraggable() {
        const preview = document.getElementById('camera-border-preview');
        if (!preview) return;

        let isDragging = false;
        let startX, startY;
        let initialX, initialY;

        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '10px';
        dragHandle.style.right = '10px';
        dragHandle.style.width = '24px';
        dragHandle.style.height = '24px';
        dragHandle.style.background = 'var(--bg-medium)';
        dragHandle.style.border = '1px solid var(--border-color)';
        dragHandle.style.borderRadius = '4px';
        dragHandle.style.cursor = 'move';
        dragHandle.style.display = 'flex';
        dragHandle.style.alignItems = 'center';
        dragHandle.style.justifyContent = 'center';
        dragHandle.style.fontSize = '0.8rem';
        dragHandle.style.color = 'var(--text-secondary)';
        dragHandle.innerHTML = '📷';
        dragHandle.title = 'Drag to position camera border';
        preview.appendChild(dragHandle);

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.left = '0';
        resizeHandle.style.width = '16px';
        resizeHandle.style.height = '16px';
        resizeHandle.style.background = 'var(--bg-medium)';
        resizeHandle.style.border = '1px solid var(--border-color)';
        resizeHandle.style.borderRadius = '0 0 4px 0';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.transform = 'translate(-50%, 50%)';
        resizeHandle.title = 'Drag to resize camera border';
        preview.appendChild(resizeHandle);

        // Add resize functionality
        let isResizing = false;
        let resizeStartX, resizeStartY;
        let resizeStartWidth, resizeStartHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = preview.offsetWidth;
            startHeight = preview.offsetHeight;

            // Add resizing class
            preview.style.opacity = '0.8';
            preview.style.cursor = 'nwse-resize';
            preview.style.userSelect = 'none';

            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Calculate new dimensions while maintaining aspect ratio
            const aspectRatio = startWidth / startHeight;
            let newWidth = startWidth + dx;
            let newHeight = newWidth / aspectRatio;

            // Apply minimum size constraints
            const minSize = 50;
            newWidth = Math.max(minSize, newWidth);
            newHeight = Math.max(minSize * aspectRatio, newHeight);

            // Apply new dimensions
            preview.style.width = `${newWidth}px`;
            preview.style.height = `${newHeight}px`;

            // Update the canvas size inputs to match the new dimensions
            const widthInput = document.getElementById('export-width');
            const heightInput = document.getElementById('export-height');
            if (widthInput && heightInput) {
                widthInput.value = Math.round(newWidth);
                heightInput.value = Math.round(newHeight);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                preview.style.opacity = '1';
                preview.style.cursor = 'move';

                // Update the camera border preview content
                const width = preview.offsetWidth;
                const height = preview.offsetHeight;
                const aspectRatio = width / height;

                preview.innerHTML = `
                    <div style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">
                        <div>Camera Border Preview</div>
                        <div style="margin-top: 8px; font-size: 0.7rem;">${Math.round(width)} × ${Math.round(height)}</div>
                        <div style="margin-top: 4px; font-size: 0.6rem;">Aspect Ratio: ${aspectRatio.toFixed(2)}</div>
                    </div>
                `;

                // Re-add drag and resize handles
                this.makeCameraBorderDraggable();
            }
        });

        // Mouse down event
        preview.addEventListener('mousedown', (e) => {
            if (e.target === dragHandle || e.target === preview) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                // Get current position
                const rect = preview.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;

                // Add dragging class
                preview.style.opacity = '0.8';
                preview.style.cursor = 'grabbing';
                preview.style.userSelect = 'none';
                preview.style.pointerEvents = 'none';

                e.preventDefault();
            }
        });

        // Mouse move event
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Calculate new position
            let newX = initialX + dx;
            let newY = initialY + dy;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Get preview dimensions
            const previewWidth = preview.offsetWidth;
            const previewHeight = preview.offsetHeight;

            // Constrain to viewport
            newX = Math.max(0, Math.min(newX, viewportWidth - previewWidth));
            newY = Math.max(0, Math.min(newY, viewportHeight - previewHeight));

            // Apply position
            preview.style.position = 'fixed';
            preview.style.left = `${newX}px`;
            preview.style.top = `${newY}px`;
            preview.style.zIndex = '10000';
        });

        // Mouse up event
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                preview.style.opacity = '1';
                preview.style.cursor = 'move';
                preview.style.userSelect = '';
                preview.style.pointerEvents = '';

                // Store position for persistence
                const position = {
                    x: parseFloat(preview.style.left) || 0,
                    y: parseFloat(preview.style.top) || 0
                };
                localStorage.setItem('cameraBorderPosition', JSON.stringify(position));
            }
        });

        // Load saved position
        const savedPosition = localStorage.getItem('cameraBorderPosition');
        if (savedPosition) {
            const pos = JSON.parse(savedPosition);
            preview.style.position = 'fixed';
            preview.style.left = `${pos.x}px`;
            preview.style.top = `${pos.y}px`;
            preview.style.zIndex = '10000';
        }
    }

    exportSceneAsPNG() {
        const width = parseInt(document.getElementById('export-width').value);
        const height = parseInt(document.getElementById('export-height').value);

        // Ensure renderer has preserveDrawingBuffer enabled
        if (this.app.renderer) {
            // Save current canvas size
            const originalWidth = this.app.renderer.domElement.width;
            const originalHeight = this.app.renderer.domElement.height;

            // Set renderer to export size and render
            this.app.renderer.setSize(width, height);
            this.app.renderer.render(this.app.scene, this.app.camera);

            // Get the canvas element and extract PNG data
            const canvas = this.app.renderer.domElement;
            const pngData = canvas.toDataURL('image/png');

            // Create download link
            const link = document.createElement('a');
            link.href = pngData;
            link.download = 'scene-export.png';
            link.click();

            // Restore original canvas size
            this.app.renderer.setSize(originalWidth, originalHeight);

            this.showNotification('Scene exported as PNG!', 'success');
        } else {
            this.showNotification('Error: Renderer not available', 'error');
        }
        
    }
    
    // Camera zoom methods
    zoomCamera(factor) {
        if (this.app.camera) {
            // Get current zoom level from slider
            const slider = document.getElementById('zoom-slider');
            let currentZoom = slider ? parseFloat(slider.value) : 50;

            // Apply zoom factor
            currentZoom *= factor;

            // Constrain to valid range
            currentZoom = Math.max(1, Math.min(100, currentZoom));

            // Update slider
            if (slider) {
                slider.value = currentZoom;
            }

            // Apply zoom to camera
            this.setCameraZoom(currentZoom);
        }
    }

    setCameraZoom(zoomLevel) {
        if (this.app.camera && this.app.cameraManager) {
            // Convert zoom level to camera position
            const zoomFactor = zoomLevel / 50; // 50 = neutral zoom
            this.app.cameraManager.setCameraZoom(zoomFactor);

            // Update the zoom display if needed
            this.updateZoomDisplay(zoomLevel);
        }
    }

    updateZoomDisplay(zoomLevel) {
        // You could add visual feedback here if needed
        
    }
    

    toggleCameraBorder(show) {
        const preview = document.getElementById('camera-border-preview');
        if (preview) {
            if (show) {
                preview.style.display = 'flex';
                this.updateCameraBorder();
            } else {
                preview.style.display = 'none';
            }
        }
    }

    updateCameraBorder() {
        const width = parseInt(document.getElementById('export-width')?.value || 1920);
        const height = parseInt(document.getElementById('export-height')?.value || 1080);
        const preview = document.getElementById('camera-border-preview');

        if (preview) {
            // Update preview dimensions
            const aspectRatio = width / height;
            const maxWidth = preview.parentElement.clientWidth;
            const maxHeight = 200;

            let displayWidth, displayHeight;
            if (aspectRatio > 1) {
                displayWidth = maxWidth;
                displayHeight = maxWidth / aspectRatio;
            } else {
                displayHeight = maxHeight;
                displayWidth = maxHeight * aspectRatio;
            }

            preview.style.width = `${displayWidth}px`;
            preview.style.height = `${displayHeight}px`;

            // Update preview content
            preview.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">
                    <div>Camera Border Preview</div>
                    <div style="margin-top: 8px; font-size: 0.7rem;">${width} × ${height}</div>
                    <div style="margin-top: 4px; font-size: 0.6rem;">Aspect Ratio: ${aspectRatio.toFixed(2)}</div>
                </div>
            `;

            // Re-add drag handle
            this.makeCameraBorderDraggable();
        }
    }

    updateCameraBorderFromDropdown() {
        const resolutionDropdown = document.getElementById('export-resolution');
        if (!resolutionDropdown) return;

        const selectedValue = resolutionDropdown.value;
        let width, height;

        if (selectedValue === 'custom') {
            // Show custom inputs if they exist
            const customGroup = document.getElementById('custom-resolution-group');
            if (customGroup) {
                customGroup.style.display = 'block';
            }
            // Use default values or existing custom values
            width = parseInt(document.getElementById('export-width')?.value || 1920);
            height = parseInt(document.getElementById('export-height')?.value || 1080);
        } else {
            // Hide custom inputs if they exist
            const customGroup = document.getElementById('custom-resolution-group');
            if (customGroup) {
                customGroup.style.display = 'none';
            }

            // Parse the selected resolution
            const parts = selectedValue.split('x');
            width = parseInt(parts[0]);
            height = parseInt(parts[1]);
        }

        // Update the camera border preview
        this.updateCameraBorderWithDimensions(width, height);
    }

    updateCameraBorderWithDimensions(width, height) {
        const preview = document.getElementById('camera-border-preview');

        if (preview) {
            // Update preview dimensions
            const aspectRatio = width / height;
            const maxWidth = preview.parentElement.clientWidth;
            const maxHeight = 200;

            let displayWidth, displayHeight;
            if (aspectRatio > 1) {
                displayWidth = maxWidth;
                displayHeight = maxWidth / aspectRatio;
            } else {
                displayHeight = maxHeight;
                displayWidth = maxHeight * aspectRatio;
            }

            preview.style.width = `${displayWidth}px`;
            preview.style.height = `${displayHeight}px`;

            // Update preview content
            preview.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">
                    <div>Camera Border Preview</div>
                    <div style="margin-top: 8px; font-size: 0.7rem;">${width} × ${height}</div>
                    <div style="margin-top: 4px; font-size: 0.6rem;">Aspect Ratio: ${aspectRatio.toFixed(2)}</div>
                </div>
            `;

            // Re-add drag handle
            this.makeCameraBorderDraggable();
        }
    }

    // --- UNIFIED SETTINGS MODAL ---
    openUnifiedSettingsModal(initialTab = 'general') {
        if (!this.unifiedSettingsInitialized) {
            this.initUnifiedSettingsModal();
            this.unifiedSettingsInitialized = true;
        }

        // Switch to the requested tab
        this.loadAISettingsToUI();
        this.switchSettingsTab(initialTab);

        this.unifiedSettingsModal.classList.add('open');
    }

    closeUnifiedSettingsModal() {
        this.unifiedSettingsModal.classList.remove('open');
    }

    initUnifiedSettingsModal() {
        // Initialize unified settings modal
        this.unifiedSettingsModal = document.getElementById('unified-settings-modal');

        // Close button
        const closeBtn = document.getElementById('btn-settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeUnifiedSettingsModal());
        }

        // Reset button
        const resetBtn = document.getElementById('btn-settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // Save button
        const saveBtn = document.getElementById('btn-settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                this.saveAISettingsFromUI();
                this.closeUnifiedSettingsModal();
            });
        }

        // Tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSettingsTab(tab.dataset.tab);
            });
        });

        const aiProvider = document.getElementById('ai-provider');
        if (aiProvider) {
            aiProvider.addEventListener('change', () => this.updateAIProviderFields(aiProvider.value));
        }

        document.getElementById('ai-openrouter-load-free-models')?.addEventListener('click', () => {
            this.loadOpenRouterFreeModels();
        });
        document.getElementById('ai-openrouter-free-models')?.addEventListener('change', (event) => {
            if (event.target.value) document.getElementById('ai-openrouter-model').value = event.target.value;
        });

        // Resolution dropdown change handler
        const resolutionDropdown = document.getElementById('setting-export-resolution');
        if (resolutionDropdown) {
            resolutionDropdown.addEventListener('change', (e) => {
                const customGroup = document.getElementById('custom-resolution-group');
                if (e.target.value === 'custom') {
                    customGroup.style.display = 'block';
                } else {
                    customGroup.style.display = 'none';
                }
            });
        }

        // Tutorial settings - wire up the start tutorial button in the tutorial tab
        const tutorialStartBtn = document.getElementById('startTutorialBtn');
        if (tutorialStartBtn) {
            tutorialStartBtn.addEventListener('click', () => {
                if (this.app.tutorialSystem) {
                    this.app.tutorialSystem.startTutorial('main');
                    this.closeUnifiedSettingsModal();
                }
            });
        }

        // Fog slider value displays
        const fogNearSlider = document.getElementById('setting-fog-near');
        const fogNearValue = document.getElementById('fog-near-value');
        if (fogNearSlider && fogNearValue) {
            fogNearSlider.addEventListener('input', () => {
                fogNearValue.textContent = fogNearSlider.value;
            });
        }

        const fogFarSlider = document.getElementById('setting-fog-far');
        const fogFarValue = document.getElementById('fog-far-value');
        if (fogFarSlider && fogFarValue) {
            fogFarSlider.addEventListener('input', () => {
                fogFarValue.textContent = fogFarSlider.value;
            });
        }

        // Close on overlay click
        this.unifiedSettingsModal.addEventListener('click', (e) => {
            if (e.target.id === 'unified-settings-modal') this.closeUnifiedSettingsModal();
        });
    }

    switchSettingsTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Add active class to selected tab and content
        const activeTab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
        const activeContent = document.querySelector(`.settings-tab-content[data-tab-content="${tabName}"]`);

        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    loadAISettingsToUI() {
        const settings = this.app.gemini?.settings;
        if (!settings) return;
        const providerEl = document.getElementById('ai-provider');
        if (providerEl) providerEl.value = settings.provider;
        for (const provider of ['gemini', 'openai', 'claude', 'openrouter']) {
            const keyEl = document.getElementById(`ai-${provider}-key`);
            const modelEl = document.getElementById(`ai-${provider}-model`);
            if (keyEl) keyEl.value = settings[provider]?.apiKey || '';
            if (modelEl) modelEl.value = settings[provider]?.model || '';
        }
        const fallbackEnabledEl = document.getElementById('ai-openrouter-fallback-enabled');
        if (fallbackEnabledEl) fallbackEnabledEl.checked = settings.openrouterFallbackEnabled === true;
        this.updateAIProviderFields(settings.provider);
    }

    updateAIProviderFields(provider) {
        document.querySelectorAll('.ai-provider-fields').forEach(fields => {
            fields.hidden = fields.dataset.providerFields !== provider;
        });
    }

    async loadOpenRouterFreeModels() {
        const button = document.getElementById('ai-openrouter-load-free-models');
        const select = document.getElementById('ai-openrouter-free-models');
        const status = document.getElementById('ai-openrouter-model-status');
        if (!button || !select || !status) return;

        button.disabled = true;
        status.textContent = 'Loading the public OpenRouter model list…';
        try {
            const freeModels = await this.app.gemini.getOpenRouterFreeModels();

            select.replaceChildren(new Option('Choose a free model…', ''));
            freeModels.forEach(model => {
                const label = model.name ? `${model.id} — ${model.name}` : model.id;
                select.add(new Option(label, model.id));
            });
            select.hidden = freeModels.length === 0;
            status.textContent = freeModels.length
                ? `${freeModels.length} free models found. Select one to fill the model field.`
                : 'No models with zero prompt and completion prices were returned.';
        } catch (error) {
            select.hidden = true;
            status.textContent = `Could not load OpenRouter models: ${error.message}`;
        } finally {
            button.disabled = false;
        }
    }

    saveAISettingsFromUI() {
        if (!this.app.gemini) return;
        const settings = {
            provider: document.getElementById('ai-provider')?.value || 'gemini',
            openrouterFallbackEnabled: document.getElementById('ai-openrouter-fallback-enabled')?.checked === true
        };
        for (const provider of ['gemini', 'openai', 'claude', 'openrouter']) {
            settings[provider] = {
                apiKey: document.getElementById(`ai-${provider}-key`)?.value.trim() || '',
                model: document.getElementById(`ai-${provider}-model`)?.value.trim() || ''
            };
        }
        try {
            this.app.gemini.saveSettings(settings);
            this.showNotification('AI provider settings saved in this browser.', 'success');
        } catch (error) {
            console.error('Could not save AI settings:', error);
            this.showNotification('Could not save AI settings. Browser storage may be unavailable.', 'error');
        }
    }

    // --- PARTICLE SYSTEMS FUNCTIONALITY ---
    initParticleSystems() {
        const addBtn = document.getElementById('btn-add-particle');
        if (addBtn && !addBtn.hasAttribute('data-initialized')) {
            addBtn.setAttribute('data-initialized', 'true');
            addBtn.addEventListener('click', () => {
                this.addParticleToObject();
            });
        }
        this.refreshParticleEmittersList();
    }

    addParticleToObject() {
        if (!this.app.particleManager) return;
        if (!this.app.selectedObject) {
            this.showNotification('Please select an object first', 'warning');
            return;
        }

        const presetSelect = document.getElementById('particle-preset-select');
        const preset = presetSelect?.value ?? 'fire';

        const component = this.app.particleManager.addParticleToObject(this.app.selectedObject, preset);
        this.refreshParticleEmittersList();
        this.showNotification(`${preset} particles added to selected object!`, 'success');
    }

    refreshParticleEmittersList() {
        const list = document.getElementById('particle-emitters-list');
        if (!list || !this.app.particleManager) return;

        const components = this.app.particleManager.getComponents();

        if (components.length === 0) {
            list.innerHTML = '<div class="empty-state">No particle systems</div>';
            return;
        }

        list.innerHTML = components.map((comp, i) => `
            <div class="emitter-item" data-uuid="${comp.uuid}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; margin-bottom: 4px; background: var(--bg-light); border-radius: 4px;">
                <span style="font-size: 0.75rem; color: var(--text-primary);">${i + 1}. ${comp.name}</span>
                <div style="display: flex; gap: 4px;">
                    <button class="btn icon-only btn-play-particle" data-uuid="${comp.uuid}" style="padding: 4px 8px;" title="Play">
                        <i class="fas fa-play" style="font-size: 0.6rem;"></i>
                    </button>
                    <button class="btn icon-only btn-stop-particle" data-uuid="${comp.uuid}" style="padding: 4px 8px;" title="Stop">
                        <i class="fas fa-stop" style="font-size: 0.6rem;"></i>
                    </button>
                    <button class="btn icon-only btn-remove-particle" data-uuid="${comp.uuid}" style="padding: 4px 8px;" title="Remove">
                        <i class="fas fa-trash" style="font-size: 0.6rem;"></i>
                    </button>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.btn-play-particle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const uuid = btn.dataset.uuid;
                this.app.particleManager.play(uuid);
            });
        });

        list.querySelectorAll('.btn-stop-particle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const uuid = btn.dataset.uuid;
                this.app.particleManager.stop(uuid);
            });
        });

        list.querySelectorAll('.btn-remove-particle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const uuid = btn.dataset.uuid;
                const comp = this.app.particleManager._getParticleComponent(uuid);
                if (comp) {
                    comp.dispose();
                    this.app.particleManager.removeComponent(comp);
                }
                this.refreshParticleEmittersList();
                this.showNotification('Particle system removed', 'info');
            });
        });
    }

    // --- PHYSICS FUNCTIONALITY ---
    initPhysicsControls() {
        const enabledToggle = document.getElementById('physics-enabled');
        if (enabledToggle && !enabledToggle.hasAttribute('data-initialized')) {
            enabledToggle.setAttribute('data-initialized', 'true');
            enabledToggle.addEventListener('change', (e) => {
                this.app.physicsManager.setEnabled(e.target.checked);
                this.showNotification(e.target.checked ? 'Physics enabled' : 'Physics disabled', 'info');
            });
        }

        const gravityX = document.getElementById('physics-gravity-x');
        const gravityY = document.getElementById('physics-gravity-y');
        const gravityZ = document.getElementById('physics-gravity-z');

        [gravityX, gravityY, gravityZ].forEach(input => {
            if (input && !input.hasAttribute('data-initialized')) {
                input.setAttribute('data-initialized', 'true');
                input.addEventListener('change', () => {
                    const x = parseFloat(gravityX?.value ?? 0);
                    const y = parseFloat(gravityY?.value ?? -9.81);
                    const z = parseFloat(gravityZ?.value ?? 0);
                    this.app.physicsManager.setGravity(x, y, z);
                });
            }
        });

        const massSlider = document.getElementById('physics-mass');
        const massValue = document.getElementById('physics-mass-value');
        if (massSlider && !massSlider.hasAttribute('data-initialized')) {
            massSlider.setAttribute('data-initialized', 'true');
            massSlider.addEventListener('input', (e) => {
                if (massValue) massValue.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }

        const applyBtn = document.getElementById('btn-apply-physics');
        if (applyBtn && !applyBtn.hasAttribute('data-initialized')) {
            applyBtn.setAttribute('data-initialized', 'true');
            applyBtn.addEventListener('click', () => {
                this.applyPhysicsToObject();
            });
        }

        const resetBtn = document.getElementById('btn-reset-physics');
        if (resetBtn && !resetBtn.hasAttribute('data-initialized')) {
            resetBtn.setAttribute('data-initialized', 'true');
            resetBtn.addEventListener('click', () => {
                this.app.physicsManager.reset();
                this.showNotification('Physics simulation reset', 'info');
            });
        }
    }

    applyPhysicsToObject() {
        if (!this.app.selectedObject || !this.app.physicsManager) {
            this.showNotification('Please select an object first', 'warning');
            return;
        }

        const mesh = this.app.selectedObject;
        const bodyTypeSelect = document.getElementById('physics-body-type');
        const massSlider = document.getElementById('physics-mass');

        const bodyType = parseInt(bodyTypeSelect?.value ?? 2);
        const mass = parseFloat(massSlider?.value ?? 1);

        this.app.physicsManager.removeMesh(mesh);

        this.app.physicsManager.addMesh(mesh, {
            mass: mass,
            bodyType: bodyType
        });

        this.showNotification(`Physics applied: ${bodyType === 2 ? 'Dynamic' : 'Static'}, Mass: ${mass}kg`, 'success');
    }
}
