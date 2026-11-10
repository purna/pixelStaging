import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Icons } from './icons.js';

export class CameraManager {
    constructor(app) {
        this.app = app;
        this.currentCameraType = 'perspective'; // 'perspective' or 'isometric'
        this.perspectiveCamera = null;
        this.orthographicCamera = null;
        this.init();
    }

    init() {
        // Defer initialization until app is ready
        if (this.app.renderer && this.app.renderer.domElement) {
            this.setupCameras();
        }
    }

    setupCameras() {
        // Create both camera types
        this.createPerspectiveCamera();
        this.createOrthographicCamera();

        // Set perspective as default
        this.switchToPerspective();

        // Initialize orbit controls with the default camera
        this.app.orbit = new OrbitControls(this.app.camera, this.app.renderer.domElement);
        this.app.orbit.enableDamping = true;
        this.app.orbit.dampingFactor = 0.05;

        // Add camera toggle button to UI
        this.addCameraToggleUI();

        // Set initial zoom controls visibility
        this.updateZoomControlsVisibility();
    }

    createPerspectiveCamera() {
        this.perspectiveCamera = new THREE.PerspectiveCamera(
            60,
            this.app.renderer.domElement.width / this.app.renderer.domElement.height,
            0.1,
            1000
        );
        this.perspectiveCamera.position.set(10, 8, 10);
        this.perspectiveCamera.lookAt(0, 0, 0);
    }

    createOrthographicCamera() {
        const aspect = this.app.renderer.domElement.width / this.app.renderer.domElement.height;
        const frustumSize = 20;
        this.orthographicCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        
        // Position for true isometric view (45-degree angle from all axes)
        this.orthographicCamera.position.set(15, 15, 15);
        this.orthographicCamera.lookAt(0, 0, 0);
        this.orthographicCamera.up.set(0, 1, 0);
    }

    switchToPerspective() {
        if (this.app.camera === this.perspectiveCamera) return;

        this.app.camera = this.perspectiveCamera;
        this.currentCameraType = 'perspective';

        // Update orbit controls
        if (this.app.orbit) {
            this.app.orbit.object = this.perspectiveCamera;
        }

        // Update TransformControls camera
        if (this.app.transformControl) {
            this.app.transformControl.camera = this.perspectiveCamera;
        }

        // Update camera aspect ratio
        this.perspectiveCamera.aspect = this.app.renderer.domElement.width / this.app.renderer.domElement.height;
        this.perspectiveCamera.updateProjectionMatrix();

        this.app.ui.showNotification('Switched to Perspective Camera', 'success');

        // Update camera type display
        this.updateCameraTypeDisplay();
        this.updateCameraSelectionDisplay();
        this.updateZoomControlsVisibility();

        // Close popout menu
        const popoutMenu = document.getElementById('camera-popout-menu');
        if (popoutMenu) {
            popoutMenu.style.display = 'none';
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }

    switchToOrthographic() {
        if (this.app.camera === this.orthographicCamera) return;

        this.app.camera = this.orthographicCamera;
        this.currentCameraType = 'isometric';

        // Update orbit controls
        if (this.app.orbit) {
            this.app.orbit.object = this.orthographicCamera;
        }

        // Update TransformControls camera
        if (this.app.transformControl) {
            this.app.transformControl.camera = this.orthographicCamera;
        }

        // Update camera aspect ratio
        const aspect = this.app.renderer.domElement.width / this.app.renderer.domElement.height;
        const frustumSize = 20;
        this.orthographicCamera.left = frustumSize * aspect / -2;
        this.orthographicCamera.right = frustumSize * aspect / 2;
        this.orthographicCamera.top = frustumSize / 2;
        this.orthographicCamera.bottom = frustumSize / -2;
        this.orthographicCamera.updateProjectionMatrix();

        this.app.ui.showNotification('Switched to Isometric Camera', 'success');

        // Update camera type display
        this.updateCameraTypeDisplay();
        this.updateCameraSelectionDisplay();
        this.updateZoomControlsVisibility();

        // Close popout menu
        const popoutMenu = document.getElementById('camera-popout-menu');
        if (popoutMenu) {
            popoutMenu.style.display = 'none';
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }

    toggleCamera() {
        if (this.currentCameraType === 'perspective') {
            this.switchToOrthographic();
        } else {
            this.switchToPerspective();
        }
    }

    // Handle window resize for both cameras
    onWindowResize() {
        // Update perspective camera aspect ratio
        if (this.perspectiveCamera) {
            this.perspectiveCamera.aspect = this.app.renderer.domElement.width / this.app.renderer.domElement.height;
            this.perspectiveCamera.updateProjectionMatrix();
        }

        // Update orthographic camera frustum
        if (this.orthographicCamera) {
            const aspect = this.app.renderer.domElement.width / this.app.renderer.domElement.height;
            const frustumSize = 20;
            this.orthographicCamera.left = frustumSize * aspect / -2;
            this.orthographicCamera.right = frustumSize * aspect / 2;
            this.orthographicCamera.top = frustumSize / 2;
            this.orthographicCamera.bottom = frustumSize / -2;
            this.orthographicCamera.updateProjectionMatrix();
        }
    }

    // Enable/disable camera movement
    setCameraEnabled(enabled) {
        if (this.app.orbit) {
            this.app.orbit.enabled = enabled;
        }
    }

    addCameraToggleUI() {
        // Add camera toggle button to the dedicated container
        const container = document.getElementById('camera-controls-container');
        if (!container) return;

        // Create camera controls group
        const cameraGroup = document.createElement('div');
        cameraGroup.className = 'camera-controls-group';

        // Camera toggle button with icon
        const cameraToggleBtn = document.createElement('div');
        cameraToggleBtn.className = 'tool-btn camera-toggle-btn';
        cameraToggleBtn.id = 'tool-toggle-camera';
        cameraToggleBtn.innerHTML = `<span class="icon-svg">${Icons.camera}</span>`;
        cameraToggleBtn.title = 'Toggle Camera Type';
        cameraToggleBtn.dataset.tooltip = '**Camera Toggle**\nClick to switch between Perspective and Isometric cameras';

        // Add click handler to toggle popout menu
        cameraToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCameraPopout(cameraToggleBtn);
        });

        // Create popout menu
        const cameraPopout = document.createElement('div');
        cameraPopout.className = 'camera-popout-menu';
        cameraPopout.id = 'camera-popout-menu';

        // Perspective camera option
        const perspectiveOption = document.createElement('div');
        perspectiveOption.className = 'camera-option perspective-option';
        perspectiveOption.dataset.cameraType = 'perspective';
        perspectiveOption.innerHTML = `
            <span class="icon-svg">${Icons.perspective}</span>
            <span class="camera-option-label">Perspective</span>
            <span class="icon-svg camera-option-check" style="display: none;">${Icons.check}</span>
        `;
        perspectiveOption.title = 'Perspective Camera - Realistic 3D view with depth';
        perspectiveOption.dataset.tooltip = '**Perspective Camera**\nRealistic 3D view with depth perception\nObjects appear smaller with distance';

        // Isometric camera option
        const isometricOption = document.createElement('div');
        isometricOption.className = 'camera-option isometric-option';
        isometricOption.dataset.cameraType = 'isometric';
        isometricOption.innerHTML = `
            <span class="icon-svg">${Icons.box}</span>
            <span class="camera-option-label">Isometric</span>
            <span class="icon-svg camera-option-check" style="display: none;">${Icons.check}</span>
        `;
        isometricOption.title = 'Isometric Camera - 2D-like view without perspective';
        isometricOption.dataset.tooltip = '**Isometric Camera**\n2D-like view without perspective distortion\nEqual scaling on all axes';

        // Add click handlers
        perspectiveOption.addEventListener('click', () => this.switchToPerspective());
        isometricOption.addEventListener('click', () => this.switchToOrthographic());

        // Add options to popout
        cameraPopout.appendChild(perspectiveOption);
        cameraPopout.appendChild(isometricOption);

        // Add elements to group
        cameraGroup.appendChild(cameraToggleBtn);
        cameraGroup.appendChild(cameraPopout);
        container.appendChild(cameraGroup);

        // Add CSS for camera controls
        this.addCameraControlsCSS();

        // Update initial selection
        this.updateCameraSelectionDisplay();
    }
    
    // Update camera type display
    updateCameraTypeDisplay() {
        const display = document.getElementById('camera-type-display');
        if (display) {
            display.textContent = this.currentCameraType === 'perspective' ? 'Perspective' : 'Isometric';
            display.className = `camera-type-value ${this.currentCameraType}`;
        }
    }

    // Update camera selection display in popout menu
    updateCameraSelectionDisplay() {
        const perspectiveOption = document.querySelector('.perspective-option');
        const isometricOption = document.querySelector('.isometric-option');

        if (perspectiveOption && isometricOption) {
            // Hide all checkmarks first
            perspectiveOption.querySelector('.camera-option-check').style.display = 'none';
            isometricOption.querySelector('.camera-option-check').style.display = 'none';

            // Show checkmark for current camera type
            if (this.currentCameraType === 'perspective') {
                perspectiveOption.querySelector('.camera-option-check').style.display = 'inline';
                perspectiveOption.classList.add('selected');
                isometricOption.classList.remove('selected');
            } else {
                isometricOption.querySelector('.camera-option-check').style.display = 'inline';
                isometricOption.classList.add('selected');
                perspectiveOption.classList.remove('selected');
            }
        }
    }

    // Show/hide zoom controls based on camera type
    updateZoomControlsVisibility() {
        const zoomControls = document.querySelector('.zoom-control');
        if (!zoomControls) return;

        if (this.currentCameraType === 'perspective') {
            // Hide zoom controls for perspective camera
            zoomControls.style.display = 'none';
        } else {
            // Show zoom controls for isometric camera
            zoomControls.style.display = 'flex';
        }
    }

    // Toggle camera popout menu visibility
    toggleCameraPopout(cameraToggleBtn) {
        const popoutMenu = document.getElementById('camera-popout-menu');
        if (popoutMenu) {
            const isVisible = popoutMenu.style.display === 'flex';

            if (!isVisible) {
                // Position the popout menu relative to the button
                const btnRect = cameraToggleBtn.getBoundingClientRect();
                const topOffset = btnRect.top + window.scrollY;

                popoutMenu.style.display = 'flex';
                popoutMenu.style.top = `${topOffset}px`;
                popoutMenu.style.setProperty('--submenu-top', `${topOffset}px`);

                // Close popout when clicking outside
                setTimeout(() => {
                    document.addEventListener('click', this.handleOutsideClick);
                }, 100);
            } else {
                popoutMenu.style.display = 'none';
                document.removeEventListener('click', this.handleOutsideClick);
            }
        }
    }

    // Handle clicks outside the popout menu
    handleOutsideClick = (e) => {
        const popoutMenu = document.getElementById('camera-popout-menu');
        const cameraToggleBtn = document.getElementById('tool-toggle-camera');

        if (popoutMenu && !popoutMenu.contains(e.target) && !cameraToggleBtn.contains(e.target)) {
            popoutMenu.style.display = 'none';
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }
    
    // Add CSS styles for camera controls
    addCameraControlsCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .camera-controls-group {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                margin: 4px 0;
                z-index: 100;
            }

            .camera-toggle-btn {
                position: relative;
                width: 40px;
                height: 40px;
                border-radius: 6px;
                background: transparent;
                border: 1px solid transparent;
                color: var(--text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.1rem;
                transition: all 0.2s;
                z-index: 100;
            }

            .camera-toggle-btn:hover {
                background: var(--bg-light);
                color: var(--text-primary);
            }

            .camera-popout-menu {
                display: none;
                position: fixed;
                left: 68px;
                top: var(--submenu-top, 100px);
                background: var(--bg-dark);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 8px;
                flex-direction: column;
                gap: 6px;
                z-index: 10000;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
                min-width: 180px;
                backdrop-filter: blur(10px);
            }

            .camera-popout-menu::before {
                content: '';
                position: absolute;
                left: -6px;
                top: 16px;
                width: 0;
                height: 0;
                border-top: 8px solid transparent;
                border-bottom: 8px solid transparent;
                border-right: 8px solid var(--border-color);
            }

            .camera-option {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: var(--bg-light);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.8rem;
            }

            .camera-option:hover {
                background: var(--bg-medium);
                border-color: var(--accent-primary);
            }

            .camera-option.selected {
                background: rgba(0, 217, 255, 0.1);
                border-color: var(--accent-tertiary);
            }

            .camera-option .icon-svg {
                width: 18px;
                height: 18px;
                flex-shrink: 0;
                color: var(--text-secondary);
            }

            .camera-option .icon-svg svg {
                width: 100%;
                height: 100%;
            }

            .camera-option-label {
                flex: 1;
                color: var(--text-primary);
                font-size: 0.8rem;
            }

            .camera-option-check {
                width: 16px !important;
                height: 16px !important;
                color: var(--accent-primary);
                margin-left: auto;
            }

            .camera-toggle-btn.active {
                background: rgba(0, 217, 255, 0.1);
                color: var(--accent-tertiary);
                border-color: rgba(0, 217, 255, 0.3);
            }

            /* Tooltip styles for camera options */
            .camera-option:hover::after {
                content: attr(data-tooltip);
                position: absolute;
                left: 100%;
                top: 50%;
                transform: translateY(-50%);
                margin-left: 10px;
                background: var(--bg-medium);
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                white-space: pre;
                z-index: 10001;
                pointer-events: none;
                max-width: 250px;
            }
        `;
        document.head.appendChild(style);
    }


    // Camera zoom methods
    setCameraZoom(zoomFactor) {
        // Only apply zoom for isometric (orthographic) camera
        // Perspective camera zoom is disabled to prevent camera positioning issues
        if (this.currentCameraType === 'perspective') {
            // No zoom action for perspective camera
            return;
        }

        // For orthographic camera, we need to adjust the orthographic size
        // Inverse relationship for orthographic zoom
        const orthoSize = 20 / zoomFactor;
        const aspect = this.perspectiveCamera.aspect;

        this.orthographicCamera.left = orthoSize * aspect / -2;
        this.orthographicCamera.right = orthoSize * aspect / 2;
        this.orthographicCamera.top = orthoSize / 2;
        this.orthographicCamera.bottom = orthoSize / -2;
        this.orthographicCamera.updateProjectionMatrix();
    }
}