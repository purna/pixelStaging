/**
 * Tutorial System
 *
 * Handles the display and interaction of tutorial steps
 */

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
