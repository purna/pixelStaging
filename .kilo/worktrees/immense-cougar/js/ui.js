import * as THREE from 'three';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb } from './colorUtils.js';

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
            audio: []
        };
        try {
            const savedAssets = JSON.parse(localStorage.getItem('pixel3d-assets') || '{}');
            Object.keys(this.assets).forEach(category => {
                if (Array.isArray(savedAssets[category])) this.assets[category] = savedAssets[category];
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
            ['color editor', () => this.setupColorEditor()],
            ['hierarchy', () => this.renderHierarchyPanel()],
            ['assets', () => this.renderAssetsPanel('components')]
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
                this.toggleAnimationPanel();
                return;
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

        // A-Frame export toolbar button
        document.getElementById('tool-aframe-export')?.addEventListener('click', () => {
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

        // Collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);
                if (content) {
                    header.classList.toggle('collapsed');
                    content.classList.toggle('hidden');
                }
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
                    this.renderAssetsPanel('components');
                } else if (tab.dataset.rightTab === 'hierarchy') {
                    this.renderHierarchyPanel();
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

        // Asset search
        const assetSearch = document.getElementById('asset-search-input');
        if (assetSearch) {
            assetSearch.addEventListener('input', (e) => {
                const activeTab = document.querySelector('#tab-assets .asset-tab.active');
                this.renderAssetsPanel(activeTab?.dataset.assetTab || 'components', e.target.value);
            });
        }

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
    }

    // --- DRAG-TO-ADJUST NUMBER INPUTS ---
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
        const defaults = (typeof APP_DEFAULTS !== 'undefined' && APP_DEFAULTS.scene)
            ? APP_DEFAULTS.scene
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

    renderAssetsPanel(tab = 'components', searchQuery = '') {
        const container = document.getElementById('assets-list');
        if (!container) return;

        container.innerHTML = '';

        // Components are Unity-style behaviours. None are defined yet.
        if (tab === 'components') {
            container.innerHTML = '<div class="empty-state"><p>No components have been defined yet.</p><br><p>Components will add reusable behaviours to scene objects.</p></div>';
            return;
        }

        if (tab === 'materials') this.syncPresetMaterialAssets();

        // For managed asset categories (materials, colors, images, media, audio)
        // Add button at top
        const addBtn = document.createElement('div');
        addBtn.className = 'asset-add-btn';
        addBtn.innerHTML = `<i class="fas fa-plus"></i> Add ${tab.slice(0, -1)}`;
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAssetModal(tab);
        });
        container.appendChild(addBtn);

        const query = searchQuery.toLowerCase().trim();

        // Get assets from management system
        let assets = this.assets[tab] || [];

        // Filter by search query
        const filtered = query ? assets.filter(item => item.name.toLowerCase().includes(query)) : assets;

        filtered.forEach(item => {
            const el = document.createElement('div');
            el.className = 'asset-item';

            let iconHtml = '';
            if (tab === 'colors') {
                iconHtml = `<div class="asset-item-icon" style="background-color: ${item.hex || '#888888'};"></div>`;
            } else if (tab === 'materials') {
                iconHtml = item.preview
                    ? `<div class="asset-item-icon material-asset-preview-icon" style="background-image:url('${item.preview}');background-size:cover"></div>`
                    : `<div class="asset-item-icon" style="background-color: ${item.color || '#888888'};"></div>`;
            } else if (tab === 'textures') {
                if (!item.preview && item.layer) {
                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = previewCanvas.height = 96;
                    this.renderTextureAssetPreview(item.layer, previewCanvas);
                    item.preview = previewCanvas.toDataURL('image/png');
                }
                iconHtml = item.preview ? `<div class="asset-item-icon" style="background-image:url('${item.preview}');background-size:cover"></div>` : `<div class="asset-item-icon"><i class="fas fa-border-all"></i></div>`;
            } else if (tab === 'images') {
                iconHtml = `<div class="asset-item-icon"><i class="fas fa-image"></i></div>`;
            } else if (tab === 'media') {
                iconHtml = `<div class="asset-item-icon"><i class="fas fa-video"></i></div>`;
            } else if (tab === 'audio') {
                iconHtml = `<div class="asset-item-icon"><i class="fas fa-volume-up"></i></div>`;
            } else {
                const iconClass = item.icon || 'fa-cube';
                iconHtml = `<div class="asset-item-icon"><i class="fas ${iconClass}"></i></div>`;
            }

            el.innerHTML = `
                ${iconHtml}
                <div class="asset-item-details">
                    <div class="asset-item-name" data-asset-id="${item.id}" data-asset-tab="${tab}">${item.name}</div>
                    ${(tab === 'textures' && item.layer?.type) ? `<div class="asset-item-url">${item.layer.type}</div>` : ''}
                    ${(tab === 'images' || tab === 'media' || tab === 'audio') && item.url ? `<div class="asset-item-url">${item.url}</div>` : ''}
                </div>
                <button class="asset-item-delete" data-asset-id="${item.id}" data-asset-tab="${tab}" title="Delete">&times;</button>
            `;

            // Name editing on click
            const nameEl = el.querySelector('.asset-item-name');
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                nameEl.contentEditable = true;
                nameEl.classList.add('editing');
                nameEl.focus();
                // Select all text
                const range = document.createRange();
                range.selectNodeContents(nameEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                const finishEdit = () => {
                    nameEl.contentEditable = false;
                    nameEl.classList.remove('editing');
                    const newName = nameEl.textContent.trim();
                    if (newName) {
                        this.updateAsset(tab, item.id, { name: newName });
                    } else {
                        nameEl.textContent = item.name;
                    }
                    nameEl.removeEventListener('blur', finishEdit);
                    nameEl.removeEventListener('keydown', handleKey);
                };

                const handleKey = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        finishEdit();
                    } else if (e.key === 'Escape') {
                        nameEl.textContent = item.name;
                        finishEdit();
                    }
                };

                nameEl.addEventListener('blur', finishEdit);
                nameEl.addEventListener('keydown', handleKey);
            });

            // Open edit modal on item click (but not on name edit or delete)
            el.addEventListener('click', (e) => {
                if (e.target === nameEl && nameEl.isContentEditable) return;
                if (e.target.closest('.asset-item-delete')) return;
                this.openAssetModal(tab, item.id);
            });

            // Delete button
            const deleteBtn = el.querySelector('.asset-item-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteAsset(tab, item.id);
            });

            container.appendChild(el);
        });
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

            const lightingSlider = document.getElementById('material-lighting');
            const lightingValue = document.getElementById('material-lighting-value');
            if (lightingSlider && lightingValue) {
                lightingSlider.value = asset?.lighting || 0;
                lightingValue.textContent = asset?.lighting || 0;
                lightingSlider.addEventListener('input', (e) => {
                    lightingValue.textContent = e.target.value;
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

            this.renderMaterialTextureLayers(asset?.layers || []);
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
            if (itemsContainer) itemsContainer.innerHTML = '';
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
            if (preview) preview.src = '';
            if (urlInput) urlInput.value = '';
        } else if (type === 'media') {
            const nameInput = document.getElementById('video-asset-name');
            const preview = document.getElementById('video-preview');
            const urlInput = document.getElementById('video-asset-url');
            if (nameInput) nameInput.value = '';
            if (preview) preview.src = '';
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
                if (preview && asset.url) preview.src = asset.url;
                if (urlInput) urlInput.value = asset.url || '';
            } else if (type === 'media') {
                const nameInput = document.getElementById('video-asset-name');
                const preview = document.getElementById('video-preview');
                const urlInput = document.getElementById('video-asset-url');
                if (nameInput) nameInput.value = asset.name || '';
                if (preview && asset.url) preview.src = asset.url;
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
        let layer = asset?.layer ? { ...asset.layer } : this.defaultTextureLayer('gradient');
        if (nameInput) nameInput.value = asset?.name || '';
        const render = () => {
            const panel = document.getElementById('texture-asset-properties');
            if (!panel) return;
            panel.innerHTML = this.textureLayerFields(layer);
            panel.querySelectorAll('input,select').forEach(control => control.addEventListener('input', () => {
                layer = this.readTextureAssetEditor();
                this.renderTextureAssetPreview(layer);
            }));
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
            layer[control.dataset.prop] = control.type === 'checkbox' ? control.checked : ((control.type === 'number' || control.type === 'range') ? parseFloat(control.value) : control.value);
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
            const layer = { type: layerEl.querySelector('.layer-select')?.value || 'color', enabled: layerEl.querySelector('.layer-enabled')?.checked !== false, opacity: parseFloat(layerEl.querySelector('.layer-opacity')?.value || 100), blendMode: layerEl.querySelector('.layer-blend-mode')?.value || 'normal' };
            layerEl.querySelectorAll('[data-prop]').forEach(control => { layer[control.dataset.prop] = control.type === 'checkbox' ? control.checked : ((control.type === 'number' || control.type === 'range') ? parseFloat(control.value) : control.value); });
            return layer;
        });
    }

    materialPresets() {
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
            const textureOptions = (this.assets.textures || []).map(texture => `<option value="${texture.id}">${texture.name}</option>`).join('');
            const positionOptions = layers.map((_, position) => `<option value="${position}" ${position === index ? 'selected' : ''}>${position + 1}</option>`).join('');
            layerEl.innerHTML = `
                <div class="material-layer-header">
                    <label class="layer-toggle">
                        <input class="layer-enabled" type="checkbox" ${layer.enabled ? 'checked' : ''}>
                        <span>Enabled</span>
                    </label>
                    <select class="layer-select" aria-label="Layer type">${this.textureLayerTypes().map(type => `<option value="${type}" ${type === layer.type ? 'selected' : ''}>${type[0].toUpperCase() + type.slice(1)}</option>`).join('')}</select>
                    <select class="layer-blend-mode" aria-label="Blend mode"><option value="normal">Normal</option><option value="add">Add</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select>
                    <label class="layer-opacity-control">
                        <span>Opacity</span>
                        <input class="layer-opacity" type="range" min="0" max="100" value="${layer.opacity}">
                        <output>${Number(layer.opacity ?? 100).toFixed(0)}%</output>
                    </label>
                    <select class="layer-position" aria-label="Layer position">${positionOptions}</select>
                    <div class="layer-actions">
                        <button class="layer-up" title="Move layer up" aria-label="Move layer up"><i class="fas fa-chevron-up"></i></button>
                        <button class="layer-down" title="Move layer down" aria-label="Move layer down"><i class="fas fa-chevron-down"></i></button>
                        <button class="layer-save-texture" title="Save layer as reusable texture"><i class="fas fa-save"></i> Save</button>
                        <button class="layer-close" title="Remove layer" aria-label="Remove layer"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="material-layer-body">
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
            };
            layerEl.querySelectorAll('[data-prop], .layer-opacity').forEach(control => {
                control.addEventListener('input', updateLayerPreview);
            });

            layerEl.querySelector('.layer-select').addEventListener('change', event => { const current = this.collectMaterialTextureLayers(); current[index] = this.defaultTextureLayer(event.target.value); this.renderMaterialTextureLayers(current); this.updateMaterialPreview?.(); });
            layerEl.querySelector('.layer-close').addEventListener('click', () => { const current = this.collectMaterialTextureLayers(); current.splice(index, 1); this.renderMaterialTextureLayers(current); this.updateMaterialPreview?.(); });
            layerEl.querySelector('.layer-up').disabled = index === 0;
            layerEl.querySelector('.layer-down').disabled = index === layers.length - 1;
            layerEl.querySelector('.layer-up').onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const previous = layerEl.previousElementSibling;
                if (previous) previous.before(layerEl);
                this.renderMaterialTextureLayers(this.collectMaterialTextureLayers());
                this.updateMaterialPreview?.();
            };
            layerEl.querySelector('.layer-down').onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const next = layerEl.nextElementSibling;
                if (next) next.after(layerEl);
                this.renderMaterialTextureLayers(this.collectMaterialTextureLayers());
                this.updateMaterialPreview?.();
            };
            layerEl.querySelector('.layer-position').addEventListener('change', event => {
                const current = this.collectMaterialTextureLayers();
                const [moved] = current.splice(index, 1);
                current.splice(parseInt(event.target.value), 0, moved);
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
                this.showNotification('Scene generated by AI!', 'success');
            } else if (this.currentAIMode === 'material') {
                const colorHex = await this.app.gemini.generateMaterialColor(text);
                if (this.app.selectedObject) {
                    this.app.applyColorToSelected(colorHex);
                    this.showNotification('Material color applied!', 'success');
                }
            }
            this.closeAIModal();
        } catch (err) {
            console.error(err);
            this.showNotification('AI Generation failed. See console for details.', 'error');
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
            if (selectedObject) {
                infoBox.classList.remove('hidden');
            } else {
                infoBox.classList.add('hidden');
            }
        }

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

        // Determine Title based on name override or type
        if (obj.userData.name) {
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

        // Helper: Create Vector3 Inputs
        const createVec3 = (label, prefix, vec, onChangeObj) => {
            const group = document.createElement('div');
            group.className = 'property-group';
            group.innerHTML = `<div class="property-label">${label}</div>`;
            const row = document.createElement('div');
            row.className = 'input-row';

            row.appendChild(createInput('X', `${prefix}-x`, vec.x, (v) => { vec.x = v; onChangeObj(); }));
            row.appendChild(createInput('Y', `${prefix}-y`, vec.y, (v) => { vec.y = v; onChangeObj(); }));
            row.appendChild(createInput('Z', `${prefix}-z`, vec.z, (v) => { vec.z = v; onChangeObj(); }));

            group.appendChild(row);
            this.propsContent.appendChild(group);
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

        // TRANSFORM CONTROLS
        createVec3('Position', 'pos', obj.position, () => { });
        createVec3('Rotation', 'rot', obj.rotation, () => { });
        createVec3('Scale', 'scl', obj.scale, () => { });

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

        // COLOR (Shapes & Figure Parts)
        let targetMesh = null;
        if (isShape) targetMesh = obj;
        if (isFigurePart) {
            // Find the mesh inside the group (limbs are groups with mesh children)
            targetMesh = obj.children.find(c => c.isMesh);
        } else if (obj.userData.type === 'figure') {
            // Try to color pelvis as proxy for figure
            targetMesh = obj.children.find(c => c.userData.name === 'Pelvis');
        }

        if (targetMesh && targetMesh.material) {
            const materialSlots = this.app.materialsManager?.getMaterialSlots(targetMesh) || [targetMesh.material];
            const activeSlot = Math.min(targetMesh.userData.activeMaterialSlot || 0, materialSlots.length - 1);
            const activeMaterial = materialSlots[activeSlot];
            // Add Materials Selector (pass targetMesh to show assigned material)
            this.addMaterialsSelector(obj, targetMesh, activeMaterial);

            const colorGroup = document.createElement('div');
            colorGroup.className = 'property-group';

            // Flex container for label + AI button
            const lblRow = document.createElement('div');
            lblRow.style.display = 'flex';
            lblRow.style.justifyContent = 'space-between';
            lblRow.innerHTML = `<div class="property-label">Color</div> <i class="fas fa-wand-magic-sparkles" style="font-size:0.7rem; cursor:pointer; color:#a855f7;" title="AI Material Assistant"></i>`;

            // Add click listener for AI button
            lblRow.querySelector('i').addEventListener('click', () => {
                this.openAIModal('material');
            });
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
                } else {
                    activeMaterial.color.set(hex);
                }
            });
            colorGroup.appendChild(colInput);
            this.propsContent.appendChild(colorGroup);

            // Add PBR Material Properties (Metallic and Roughness)
            this.addMaterialProperties(obj, targetMesh, activeMaterial);

            // Add per-object physics controls
            this.addPhysicsControls(obj);
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
    addMaterialProperties(obj, targetMesh, activeMaterial = null) {
        const editedMaterial = activeMaterial || (Array.isArray(targetMesh.material)
            ? targetMesh.material[targetMesh.userData.activeMaterialSlot || 0]
            : targetMesh.material);
        // Create material properties group
        const materialGroup = document.createElement('div');
        materialGroup.className = 'property-group';
        materialGroup.innerHTML = `<div class="property-label">Material Properties (PBR)</div>`;

        // Metallic property
        const metallicRow = document.createElement('div');
        metallicRow.className = 'input-row';
        metallicRow.style.marginBottom = '4px';

        const metallicLabel = document.createElement('span');
        metallicLabel.style.fontSize = '0.65rem';
        metallicLabel.style.color = 'var(--text-secondary)';
        metallicLabel.style.width = '60px';
        metallicLabel.textContent = 'Metallic:';
        metallicRow.appendChild(metallicLabel);

        const metallicInput = document.createElement('input');
        metallicInput.type = 'range';
        metallicInput.id = 'prop-metallic-slider';
        metallicInput.min = '0';
        metallicInput.max = '1';
        metallicInput.step = '0.01';
        metallicInput.style.flex = '1';

        // Add value display for metallic
        const metallicValue = document.createElement('span');
        metallicValue.id = 'prop-metallic-value';
        metallicValue.style.fontSize = '0.65rem';
        metallicValue.style.color = 'var(--text-primary)';
        metallicValue.style.width = '30px';
        metallicValue.style.textAlign = 'right';
        metallicValue.textContent = (editedMaterial.metalness !== undefined ? editedMaterial.metalness : 0).toFixed(2);
        metallicRow.appendChild(metallicValue);

        // Add info button for metallic
        const metallicInfo = document.createElement('i');
        metallicInfo.className = 'fas fa-info-circle material-info-btn';
        metallicInfo.title = 'Metallic: Controls how metallic the surface appears (0 = non-metal, 1 = fully metallic). Affects reflectivity and edge sharpness.';
        metallicInfo.style.marginLeft = '4px';
        metallicInfo.style.cursor = 'help';
        metallicInfo.style.color = 'var(--text-secondary)';
        metallicInfo.style.fontSize = '0.7rem';
        metallicRow.appendChild(metallicInfo);

        // Initialize metallic value (default to 0 if not set)
        metallicInput.value = editedMaterial.metalness !== undefined
            ? editedMaterial.metalness
            : 0;

        metallicInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            metallicValue.textContent = value.toFixed(2);
            if (obj.userData.type === 'figure') {
                // Apply to whole figure
                obj.traverse(c => {
                    if (c.isMesh && c.material) {
                        c.material.metalness = value;
                    }
                });
            } else {
                editedMaterial.metalness = value;
            }
        });

        metallicRow.appendChild(metallicInput);
        materialGroup.appendChild(metallicRow);

        // Roughness property
        const roughnessRow = document.createElement('div');
        roughnessRow.className = 'input-row';

        const roughnessLabel = document.createElement('span');
        roughnessLabel.style.fontSize = '0.65rem';
        roughnessLabel.style.color = 'var(--text-secondary)';
        roughnessLabel.style.width = '60px';
        roughnessLabel.textContent = 'Roughness:';
        roughnessRow.appendChild(roughnessLabel);

        const roughnessInput = document.createElement('input');
        roughnessInput.type = 'range';
        roughnessInput.id = 'prop-roughness-slider';
        roughnessInput.min = '0';
        roughnessInput.max = '1';
        roughnessInput.step = '0.01';
        roughnessInput.style.flex = '1';

        // Add value display for roughness
        const roughnessValue = document.createElement('span');
        roughnessValue.id = 'prop-roughness-value';
        roughnessValue.style.fontSize = '0.65rem';
        roughnessValue.style.color = 'var(--text-primary)';
        roughnessValue.style.width = '30px';
        roughnessValue.style.textAlign = 'right';
        roughnessValue.textContent = (editedMaterial.roughness !== undefined ? editedMaterial.roughness : 0.5).toFixed(2);
        roughnessRow.appendChild(roughnessValue);

        // Add info button for roughness
        const roughnessInfo = document.createElement('i');
        roughnessInfo.className = 'fas fa-info-circle material-info-btn';
        roughnessInfo.title = 'Roughness: Controls surface smoothness (0 = perfectly smooth/mirror-like, 1 = very rough). Affects how light scatters across the surface.';
        roughnessInfo.style.marginLeft = '4px';
        roughnessInfo.style.cursor = 'help';
        roughnessInfo.style.color = 'var(--text-secondary)';
        roughnessInfo.style.fontSize = '0.7rem';
        roughnessRow.appendChild(roughnessInfo);

        // Initialize roughness value (default to 0.5 if not set)
        roughnessInput.value = editedMaterial.roughness !== undefined
            ? editedMaterial.roughness
            : 0.5;

        roughnessInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            roughnessValue.textContent = value.toFixed(2);
            if (obj.userData.type === 'figure') {
                // Apply to whole figure
                obj.traverse(c => {
                    if (c.isMesh && c.material) {
                        c.material.roughness = value;
                    }
                });
            } else {
                editedMaterial.roughness = value;
            }
        });

        roughnessRow.appendChild(roughnessInput);
        materialGroup.appendChild(roughnessRow);

        // Opacity property
        const opacityRow = document.createElement('div');
        opacityRow.className = 'input-row';

        const opacityLabel = document.createElement('span');
        opacityLabel.style.fontSize = '0.65rem';
        opacityLabel.style.color = 'var(--text-secondary)';
        opacityLabel.style.width = '60px';
        opacityLabel.textContent = 'Opacity:';
        opacityRow.appendChild(opacityLabel);

        const opacityInput = document.createElement('input');
        opacityInput.type = 'range';
        opacityInput.id = 'prop-opacity-slider';
        opacityInput.min = '0';
        opacityInput.max = '1';
        opacityInput.step = '0.01';
        opacityInput.style.flex = '1';

        // Add value display for opacity
        const opacityValue = document.createElement('span');
        opacityValue.id = 'prop-opacity-value';
        opacityValue.style.fontSize = '0.65rem';
        opacityValue.style.color = 'var(--text-primary)';
        opacityValue.style.width = '30px';
        opacityValue.style.textAlign = 'right';
        opacityValue.textContent = (editedMaterial.opacity !== undefined ? editedMaterial.opacity : 1).toFixed(2);
        opacityRow.appendChild(opacityValue);

        // Initialize opacity value (default to 1 if not set)
        opacityInput.value = editedMaterial.opacity !== undefined
            ? editedMaterial.opacity
            : 1;

        opacityInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            opacityValue.textContent = value.toFixed(2);
            if (obj.userData.type === 'figure') {
                // Apply to whole figure
                obj.traverse(c => {
                    if (c.isMesh && c.material) {
                        c.material.opacity = value;
                        c.material.transparent = value < 1;
                    }
                });
            } else {
                editedMaterial.opacity = value;
                editedMaterial.transparent = value < 1 || !!editedMaterial.alphaMap;
            }
        });

        opacityRow.appendChild(opacityInput);
        materialGroup.appendChild(opacityRow);

        const addPbrSlider = (label, id, value, min, max, step, onChange) => {
            const row = document.createElement('div');
            row.className = 'input-row';
            row.style.marginBottom = '4px';

            const labelSpan = document.createElement('span');
            labelSpan.style.fontSize = '0.65rem';
            labelSpan.style.color = 'var(--text-secondary)';
            labelSpan.style.width = '60px';
            labelSpan.textContent = label;
            row.appendChild(labelSpan);

            const input = document.createElement('input');
            input.type = 'range';
            input.id = id;
            input.min = String(min);
            input.max = String(max);
            input.step = String(step);
            input.style.flex = '1';

            const valueSpan = document.createElement('span');
            valueSpan.id = id + '-value';
            valueSpan.style.fontSize = '0.65rem';
            valueSpan.style.color = 'var(--text-primary)';
            valueSpan.style.width = '30px';
            valueSpan.style.textAlign = 'right';
            valueSpan.textContent = Number(value).toFixed(2);

            input.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                valueSpan.textContent = v.toFixed(2);
                onChange(v);
            });

            input.value = Number(value);

            row.appendChild(valueSpan);
            row.appendChild(input);
            materialGroup.appendChild(row);
        };

        const mat = editedMaterial;
        addPbrSlider('Clearcoat:', 'prop-clearcoat-slider', mat.clearcoat || 0, 0, 1, 0.01, (v) => {
            if (obj.userData.type === 'figure') {
                obj.traverse(c => { if (c.isMesh && c.material) c.material.clearcoat = v; });
            } else {
                editedMaterial.clearcoat = v;
            }
        });
        addPbrSlider('Transmission:', 'prop-transmission-slider', mat.transmission || 0, 0, 1, 0.01, (v) => {
            if (obj.userData.type === 'figure') {
                obj.traverse(c => { if (c.isMesh && c.material) c.material.transmission = v; });
            } else {
                editedMaterial.transmission = v;
            }
        });
        addPbrSlider('Sheen:', 'prop-sheen-slider', mat.sheen || 0, 0, 1, 0.01, (v) => {
            if (obj.userData.type === 'figure') {
                obj.traverse(c => { if (c.isMesh && c.material) c.material.sheen = v; });
            } else {
                editedMaterial.sheen = v;
            }
        });

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
        materialGroup.appendChild(outlineGroup);

        this.propsContent.appendChild(materialGroup);
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
                this.closeUnifiedSettingsModal();
            });
        }

        // Tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSettingsTab(tab.dataset.tab);
            });
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
