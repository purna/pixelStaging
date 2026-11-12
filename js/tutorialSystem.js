/**
 * Tutorial System
 *
 * Handles the display and interaction of tutorial steps.
 * Steps can include a live `demo` so the tour shows a feature in action
 * instead of only describing it.
 */

import * as THREE from 'three';

const TUTORIAL_SEEN_KEY = 'pixelstaging-tutorial-seen';
const TUTORIAL_AUTOSTART_KEY = 'pixelstaging-tutorial-autostart';

class TutorialSystem {
    constructor(app) {
        this.app = app;
        this.config = app.tutorialConfig;
        this.currentTutorialStep = null;
        this.tutorialElement = null;
        this.overlayElement = null;
        this.isInitialized = false;
        this.demoState = null;
    }

    init() {
        // Create tutorial elements
        this.createTutorialElements();

        // Add tutorial toggle to settings
        this.addTutorialSetting();

        // Initialize event listeners
        this.setupEventListeners();

        // Add resize handler
        window.addEventListener('resize', () => this.handleResize());

        // Auto-start tutorial if enabled in settings
        // Auto-start the short tour on the first visit only; the ? button and Settings replay it.
        setTimeout(() => {
            try {
                const enableTutorialsCheckbox = document.getElementById('settings-enable-tutorials');
                const autoStartCheckbox = document.getElementById('settings-tutorial-auto-start');
                const appDefault = this.app.APP_DEFAULTS?.ui?.tutorialAutoStart ?? true;
                const autoStart = autoStartCheckbox ? autoStartCheckbox.checked : appDefault;
                const welcomeOpen = document.getElementById('welcome-modal')?.classList.contains('open');
                if (enableTutorialsCheckbox && enableTutorialsCheckbox.checked && autoStart && !welcomeOpen && !this.hasSeenTutorial()) {
                    this.startTutorial('quick');
                }
            } catch (error) {
                console.warn('Tutorial auto-start failed:', error);
            }
        }, 1000); // Small delay to allow UI to fully initialize

        this.isInitialized = true;
    }

    createTutorialElements() {
        // Create overlay
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'tutorial-overlay';
        document.body.appendChild(this.overlayElement);

        // Create tutorial container
        this.tutorialElement = document.createElement('div');
        this.tutorialElement.id = 'tutorial-container';
        document.body.appendChild(this.tutorialElement);

        // Add tutorial content structure
        this.tutorialElement.innerHTML = `
            <div id="tutorial-header">
                <h3 id="tutorial-heading"></h3>
                <button id="tutorial-close">×</button>
            </div>
            <div id="tutorial-content"></div>
            <div id="tutorial-demo"></div>
            <div id="tutorial-controls">
                <div id="tutorial-buttons">
                    <button id="tutorial-prev" class="tutorial-btn" style="display: none;">Previous</button>
                    <button id="tutorial-next" class="tutorial-btn">Next</button>
                </div>
                <div id="tutorial-progress-dots"></div>
            </div>
        `;
    }

    addTutorialSetting() {
        // The tutorial settings are already in the HTML, so we just need to wire up the event listeners
        const enableTutorialsCheckbox = document.getElementById('settings-enable-tutorials');
        const startTutorialBtn = document.getElementById('startTutorialBtn');
        const autoStartCheckbox = document.getElementById('settings-tutorial-auto-start');

        if (enableTutorialsCheckbox) {
            // Set default to enabled (checked)
            enableTutorialsCheckbox.checked = true;
            this.app.tutorialConfig.tutorials.main.enabled = true;

            enableTutorialsCheckbox.addEventListener('change', (e) => {
                this.app.tutorialConfig.tutorials.main.enabled = e.target.checked;
                if (!e.target.checked && this.config.isTutorialActive()) {
                    this.hideTutorial();
                }
            });
        }

        if (autoStartCheckbox) {
            let defaultValue = this.app.APP_DEFAULTS?.ui?.tutorialAutoStart ?? true;
            try {
                const stored = localStorage.getItem(TUTORIAL_AUTOSTART_KEY);
                if (stored !== null) defaultValue = stored === '1';
            } catch (e) { /* storage unavailable */ }
            autoStartCheckbox.checked = defaultValue;
            autoStartCheckbox.addEventListener('change', (e) => {
                this.tutorialAutoStart = e.target.checked;
                try { localStorage.setItem(TUTORIAL_AUTOSTART_KEY, e.target.checked ? '1' : '0'); } catch (err) { /* ignore */ }
                if (this.app.APP_DEFAULTS?.ui) {
                    this.app.APP_DEFAULTS.ui.tutorialAutoStart = e.target.checked;
                }
            });
        }

        // Settings > Tutorial > Start Tutorial runs the full tour.
        if (startTutorialBtn) {
            startTutorialBtn.addEventListener('click', () => {
                document.getElementById('unified-settings-modal')?.classList.remove('open');
                this.startTutorial('main', { force: true });
            });
        }

        // Header "?" button runs the short quick-start tour.
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                if (this.app.ui?.openWelcomeModal) {
                    this.app.ui.openWelcomeModal();
                } else {
                    this.startTutorial('quick', { force: true });
                }
            });
        }
    }

    setupEventListeners() {
        // Tutorial control buttons
        const closeBtn = document.getElementById('tutorial-close');
        const nextBtn = document.getElementById('tutorial-next');
        const skipBtn = document.getElementById('tutorial-skip');
        const prevBtn = document.getElementById('tutorial-prev');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideTutorial());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());
        if (skipBtn) skipBtn.addEventListener('click', () => this.hideTutorial());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevStep());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.config.isTutorialActive()) return;

            // Escape to close tutorial
            if (e.key === 'Escape') {
                this.hideTutorial();
            }
            // Right arrow for next
            else if (e.key === 'ArrowRight') {
                this.nextStep();
            }
            // Left arrow for previous
            else if (e.key === 'ArrowLeft') {
                this.prevStep();
            }
        });
    }

    hasSeenTutorial() {
        try { return localStorage.getItem(TUTORIAL_SEEN_KEY) === '1'; } catch (e) { return false; }
    }

    markTutorialSeen() {
        try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch (e) { /* ignore */ }
    }

    startTutorial(tutorialId, { force = false } = {}) {
        // Check if tutorials are enabled (an explicit click on ? or Start Tutorial always works)
        const enableTutorialsCheckbox = document.getElementById('settings-enable-tutorials');
        if (!force && enableTutorialsCheckbox && !enableTutorialsCheckbox.checked) {
            if (this.app.notifications) {
                this.app.notifications.showNotification('Tutorials are disabled in settings', 'info');
            }
            return;
        }

        this.config.startTutorial(tutorialId);
        this.showCurrentStep();
    }

    showCurrentStep() {
        const step = this.config.getCurrentStep();
        if (!step) {
            this.hideTutorial();
            return;
        }

        // Clear any demo from the previous step before changing tabs/selection.
        this.stopDemo();

        // Bring the relevant tab/section into view before positioning the tour.
        if (step.controlMode && this.app.setControlMode) {
            this.app.setControlMode(step.controlMode);
        }
        if (step.openTab) {
            document.querySelector(`.right-tab[data-right-tab="${step.openTab}"]`)?.click();
        }
        if (step.openSection) {
            const header = document.querySelector(`.collapsible-header[data-target="${step.openSection}"]`);
            const content = document.getElementById(step.openSection);
            if (header && content?.classList.contains('hidden')) header.click();
        }

        this.currentTutorialStep = step;

        // Position tutorial based on step configuration
        const usedFallback = this.positionTutorial(step);

        // Update content
        const headingElement = document.getElementById('tutorial-heading');
        const contentElement = document.getElementById('tutorial-content');
        if (headingElement) headingElement.textContent = step.heading;
        if (contentElement) contentElement.textContent = step.content;

        // Show/hide previous button
        const prevBtn = document.getElementById('tutorial-prev');
        if (prevBtn) {
            prevBtn.style.display = this.config.currentStep > 0 ? 'inline-block' : 'none';
        }

        // Show tutorial
        this.tutorialElement.style.display = 'block';
        this.overlayElement.style.display = 'block';

        // Update progress dots
        this.updateProgressDots();

        // Highlight target element if it exists
        this.highlightTargetElement(step.elementId);

        // Add directional arrow based on arrowPosition config
        // If the target was missing/hidden we centred the box, so don't point an arrow at nothing.
        this.addDirectionalArrow(usedFallback ? 'center' : (step.arrowPosition || step.position), step.arrowPositionOverride);

        // Show the feature in action.
        this.startDemo(step);
    }

    /**
     * Run the live demo attached to a tutorial step.
     * Demos are deliberately temporary: camera movement stops when the step
     * changes, and demo objects are removed from the scene.
     */
    startDemo(step) {
        const demoEl = document.getElementById('tutorial-demo');
        if (!demoEl) return;
        demoEl.innerHTML = '';
        if (!step.demo) return;

        if (step.demo === 'camera') {
            demoEl.innerHTML = `
                <div class="tutorial-demo-title"><span class="tutorial-demo-dot"></span> Watch the camera move</div>
                <div class="tutorial-demo-keys">
                    <span class="tutorial-key">W</span><span class="tutorial-key">A</span>
                    <span class="tutorial-key">S</span><span class="tutorial-key">D</span>
                    <span class="tutorial-demo-key-label">move</span>
                    <span class="tutorial-key">Q</span><span class="tutorial-key">E</span>
                    <span class="tutorial-demo-key-label">rotate</span>
                </div>
                <div class="tutorial-demo-hint">Try it now while this step is open.</div>
            `;
            this.startCameraDemo();
        } else if (step.demo === 'snap') {
            demoEl.innerHTML = `
                <div class="tutorial-demo-title"><span class="tutorial-demo-dot"></span> Snap in action</div>
                <div class="tutorial-demo-hint">The moving block locks onto the target surface. Hold <b>Alt</b> while dragging to bypass snapping.</div>
            `;
            this.startSnapDemo();
        } else if (step.demo === 'move') {
            demoEl.innerHTML = `
                <div class="tutorial-demo-title"><span class="tutorial-demo-dot"></span> Try the gizmo</div>
                <div class="tutorial-demo-hint">The actor is selected. Drag an arrow to move it, then press <b>R</b> to rotate or <b>S</b> to scale.</div>
            `;
            this.selectDemoObject();
        }
    }

    startCameraDemo() {
        const camera = this.app.camera;
        const target = this.app.orbit?.target;
        if (!camera || !target || this.app.controlMode !== 'camera') return;

        const startOffset = camera.position.clone().sub(target);
        const started = performance.now();
        const duration = 4200;
        const state = { kind: 'camera', raf: 0 };
        this.demoState = state;

        // As soon as the user starts interacting, hand control back to them.
        const cancelOnInteraction = () => {
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = 0;
        };
        const cleanupListeners = () => {
            window.removeEventListener('pointerdown', cancelOnInteraction);
            window.removeEventListener('keydown', cancelOnInteraction);
        };
        state.cleanup = cleanupListeners;
        window.addEventListener('pointerdown', cancelOnInteraction);
        window.addEventListener('keydown', cancelOnInteraction);

        const tick = (now) => {
            if (this.demoState !== state) return;
            const t = Math.min(1, (now - started) / duration);
            // Ease in/out so the demonstration starts and ends gently.
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const offset = startOffset.clone().applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                eased * Math.PI * 0.32
            );
            camera.position.copy(target).add(offset);
            camera.lookAt(target);
            camera.updateMatrixWorld(true);
            if (this.app.orbit) {
                this.app.orbit.target.copy(target);
                this.app.orbit.update();
            }
            if (t < 1) state.raf = requestAnimationFrame(tick);
            else cleanupListeners();
        };
        state.raf = requestAnimationFrame(tick);
    }

    startSnapDemo() {
        const scene = this.app.scene;
        if (!scene) return;

        const group = new THREE.Group();
        group.userData.isTutorialDemo = true;
        group.userData.name = 'Tutorial snapping demo';

        const targetBlock = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x00d9ff, roughness: 0.45, metalness: 0.1 })
        );
        targetBlock.position.set(3.2, 0.5, 0.2);
        const movingBlock = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ff41, roughness: 0.45, metalness: 0.1 })
        );
        movingBlock.position.set(3.2, 0.5, 3.4);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(targetBlock.geometry),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 })
        );
        targetBlock.add(edges);
        const movingEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(movingBlock.geometry),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 })
        );
        movingBlock.add(movingEdges);

        group.add(targetBlock, movingBlock);
        scene.add(group);

        const startZ = movingBlock.position.z;
        const snappedZ = 1.2; // Faces flush: target front is z=0.7, block is 1 unit deep.
        const started = performance.now();
        const state = { kind: 'snap', group, raf: 0 };
        this.demoState = state;

        const tick = (now) => {
            if (this.demoState !== state) return;
            const cycle = ((now - started) % 3600) / 3600;
            // Slide in, hold at the snap point, then reset.
            let t;
            if (cycle < 0.55) t = Math.min(1, cycle / 0.35);
            else if (cycle < 0.8) t = 1;
            else t = Math.max(0, 1 - (cycle - 0.8) / 0.2);
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            movingBlock.position.z = startZ + (snappedZ - startZ) * eased;
            group.children.forEach(child => {
                if (child.material) child.material.emissive?.setHex(cycle > 0.38 && cycle < 0.8 ? 0x0a3a1a : 0x000000);
            });
            state.raf = requestAnimationFrame(tick);
        };
        state.raf = requestAnimationFrame(tick);
    }

    selectDemoObject() {
        const objects = this.app.objects || [];
        const demo = objects.find(obj => obj.userData?.staging?.kind === 'figure')
            || objects.find(obj => obj.userData?.type === 'figure')
            || objects.find(obj => obj.userData?.type === 'character')
            || objects.find(obj => obj.userData?.type === 'shape');
        if (!demo || !this.app.selectObject) return;
        demo.userData._tutorialDemoSelected = true;
        this.app.selectObject(demo);
        this.app.orbit?.update?.();
    }

    stopDemo() {
        const state = this.demoState;
        if (state) {
            state.cleanup?.();
            if (state.raf) cancelAnimationFrame(state.raf);
            if (state.group) {
                this.app.scene?.remove(state.group);
                state.group.traverse((child) => {
                    child.geometry?.dispose?.();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose?.());
                    else child.material?.dispose?.();
                });
            }
            this.demoState = null;
        }
        const demoEl = document.getElementById('tutorial-demo');
        if (demoEl) demoEl.innerHTML = '';
    }

    positionTutorial(step) {
        const targetElement = document.getElementById(step.elementId);
        if (!this.tutorialElement) return false;

        const targetRect = targetElement ? targetElement.getBoundingClientRect() : null;
        const tutorialRect = this.tutorialElement.getBoundingClientRect();

        // Target missing, or hidden (display:none gives a 0x0 rect): centre the box instead of
        // leaving it wherever it was, so a step never points at an invisible element.
        if (!targetRect || (targetRect.width === 0 && targetRect.height === 0)) {
            this.tutorialElement.style.top = Math.max(10, window.innerHeight / 2 - tutorialRect.height / 2) + 'px';
            this.tutorialElement.style.left = Math.max(10, window.innerWidth / 2 - tutorialRect.width / 2) + 'px';
            return true;
        }

        // Get margin override from config or use default
        const margin = step.marginOverride ? parseInt(step.marginOverride) : 10;
        let top, left;

        switch(step.position) {
            case 'top':
                top = targetRect.top - tutorialRect.height - margin;
                left = targetRect.left + (targetRect.width / 2) - (tutorialRect.width / 2);
                break;

            case 'bottom':
                top = targetRect.bottom + margin;
                left = targetRect.left + (targetRect.width / 2) - (tutorialRect.width / 2);
                break;

            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tutorialRect.height / 2);
                left = targetRect.left - tutorialRect.width - margin;
                break;

            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tutorialRect.height / 2);
                left = targetRect.right + margin;
                break;

            case 'center':
                top = window.innerHeight / 2 - tutorialRect.height / 2;
                left = window.innerWidth / 2 - tutorialRect.width / 2;
                break;

            default:
                // Default to right position
                top = targetRect.top + (targetRect.height / 2) - (tutorialRect.height / 2);
                left = targetRect.right + margin;
        }

        // Ensure tutorial stays within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - tutorialRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - tutorialRect.width - 10));

        this.tutorialElement.style.top = top + 'px';
        this.tutorialElement.style.left = left + 'px';
        return false;
    }

    highlightTargetElement(elementId) {
        // Remove any existing highlights
        const existingHighlights = document.querySelectorAll('.tutorial-highlight');
        existingHighlights.forEach(el => el.classList.remove('tutorial-highlight'));

        // Add highlight to target element
        const targetElement = document.getElementById(elementId);
        if (targetElement) {
            targetElement.classList.add('tutorial-highlight');

            // Add highlight style if not already present
            if (!document.getElementById('tutorial-highlight-style')) {
                const style = document.createElement('style');
                style.id = 'tutorial-highlight-style';
                style.textContent = `
                    .tutorial-highlight {
                        position: relative;
                        z-index: 9999;
                    }
                    .tutorial-highlight::after {
                        content: '';
                        position: absolute;
                        top: -4px;
                        left: -4px;
                        right: -4px;
                        bottom: -4px;
                        border: 2px solid var(--accent-primary);
                        border-radius: 6px;
                        pointer-events: none;
                        animation: pulse 2s infinite;
                        z-index: -1;
                    }
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0.4); }
                        70% { box-shadow: 0 0 0 10px rgba(0, 255, 65, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    nextStep() {
        const nextStep = this.config.nextStep();
        if (nextStep) {
            this.showCurrentStep();
        } else {
            // Tutorial complete
            this.hideTutorial();
            if (this.app.notifications) {
                this.app.notifications.showNotification('Tutorial completed!', 'success');
            }
        }
    }

    prevStep() {
        const prevStep = this.config.prevStep();
        if (prevStep) {
            this.showCurrentStep();
        }
    }

    hideTutorial() {
        this.stopDemo();
        // Closing, skipping or finishing all count as "seen" so the tour doesn't reappear on every load.
        if (this.config.isTutorialActive()) this.markTutorialSeen();
        this.tutorialElement.style.display = 'none';
        this.overlayElement.style.display = 'none';
        this.config.stopTutorial();

        // Remove highlights
        const existingHighlights = document.querySelectorAll('.tutorial-highlight');
        existingHighlights.forEach(el => el.classList.remove('tutorial-highlight'));

        // Remove directional arrow
        const existingArrow = document.querySelector('.tutorial-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }
    }

    // Update progress dots to show current step
    updateProgressDots() {
        const dotsContainer = document.getElementById('tutorial-progress-dots');
        if (!dotsContainer) return;

        // Clear existing dots
        dotsContainer.innerHTML = '';

        // Get current tutorial and steps
        const tutorial = this.config.getTutorial(this.config.currentTutorial);
        if (!tutorial || !tutorial.steps || tutorial.steps.length === 0) return;

        // Create dots for each step
        tutorial.steps.forEach((step, index) => {
            const dot = document.createElement('div');
            dot.className = 'tutorial-progress-dot';
            if (index === this.config.currentStep) {
                dot.classList.add('active');
            }
            dotsContainer.appendChild(dot);
        });
    }

    // Add directional arrow to tutorial box
    addDirectionalArrow(position, arrowPositionOverride) {
        // Remove any existing arrow
        const existingArrow = document.querySelector('.tutorial-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }

        // Don't add arrow for center position
        if (position === 'center') return;

        // Create arrow element
        const arrow = document.createElement('div');
        arrow.className = `tutorial-arrow ${position}`;

        // Add position override class if specified
        if (arrowPositionOverride && arrowPositionOverride !== 'center') {
            arrow.classList.add(arrowPositionOverride);
        }

        // Add to tutorial container
        this.tutorialElement.appendChild(arrow);
    }

    // Handle window resize
    handleResize() {
        if (this.config.isTutorialActive() && this.currentTutorialStep) {
            this.positionTutorial(this.currentTutorialStep);
        }
    }
}

// Export for ES6 modules
export { TutorialSystem };
