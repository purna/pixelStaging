/**
 * Tutorial Configuration System
 *
 * This file defines the tutorial steps configuration and provides
 * an easy-to-use interface for setting up tutorials.
 */

class TutorialConfig {
    constructor() {
        // Default tutorial configuration
        this.tutorials = {
            'main': {
                enabled: true,
                steps: [
                    {
                        id: 'welcome',
                        elementId: 'canvas-container',
                        position: 'center',
                        arrowPosition: 'none', // No arrow for center position
                        arrowPositionOverride: 'center', // Arrow position along the side (center, top-third, middle-third, bottom-third)
                        marginOverride: '0',
                        heading: 'Welcome to Pixel 3D!',
                        content: 'This quick tutorial will guide you through the main features of the 3D Staging Studio.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'tools',
                        elementId: 'tools-container',
                        position: 'left',
                        arrowPosition: 'right', // Arrow is on the right side of the tutorial panel, points right (towards target panel)
                        arrowPositionOverride: 'middle-third', // Arrow positioned in the middle third of the left side
                        marginOverride: '20px', // Additional margin for better spacing
                        heading: 'Tools Panel',
                        content: 'This panel contains all the tools for creating and manipulating 3D objects. You can add shapes, characters, lights, and more.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'layers',
                        elementId: 'hierarchy-list',
                        position: 'right',
                        arrowPosition: 'left',
                        arrowPositionOverride: 'top-third',
                        marginOverride: '60px',
                        heading: 'Hierarchy',
                        content: 'Here you can see all the objects in your scene. Select objects to edit their properties or organize them into groups.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'properties',
                        elementId: 'props-content',
                        position: 'right',
                        arrowPosition: 'left', // Arrow is on the left side of the tutorial panel, points left (away from tutorial panel)
                        arrowPositionOverride: 'middle-third',
                        marginOverride: '60px', // Additional margin for better spacing
                        heading: 'Properties Panel',
                        content: 'When you select an object, its properties appear here. You can adjust position, rotation, scale, color, and other attributes.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'transform',
                        elementId: 'mode-translate',
                        position: 'bottom',
                        arrowPosition: 'top', // Arrow is on the top side of the tutorial panel, points up (towards target panel)
                        marginOverride: '30px', // Margin for transform controls positioning
                        heading: 'Transform Controls',
                        content: 'Use these tools to manipulate objects: Translate (G) to move, Rotate (R) to spin, Scale (S) to resize, and Hand (H) to navigate the scene.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'export',
                        elementId: 'btn-export',
                        position: 'top',
                        arrowPosition: 'bottom', // Arrow is on the bottom side of the tutorial panel, points down (towards target panel)
                        marginOverride: '25px', // Margin for export button positioning
                        heading: 'Export Your Scene',
                        content: 'When you\'re happy with your creation, use the Export button to save your scene as a JSON file or export as PNG image.',
                        showNext: true,
                        showSkip: true
                    }
                ]
            }
        };

        // Current tutorial state
        this.currentTutorial = 'main';
        this.currentStep = 0;
        this.isActive = false;
    }

    /**
     * Add a new tutorial
     * @param {string} tutorialId - Unique identifier for the tutorial
     * @param {Object} config - Tutorial configuration
     */
    addTutorial(tutorialId, config) {
        this.tutorials[tutorialId] = config;
    }

    /**
     * Get tutorial by ID
     * @param {string} tutorialId - Tutorial identifier
     * @returns {Object|null} Tutorial configuration or null if not found
     */
    getTutorial(tutorialId) {
        return this.tutorials[tutorialId] || null;
    }

    /**
     * Get current step in current tutorial
     * @returns {Object|null} Current step or null if no active tutorial
     */
    getCurrentStep() {
        const tutorial = this.getTutorial(this.currentTutorial);
        if (!tutorial || !tutorial.steps || this.currentStep >= tutorial.steps.length) {
            return null;
        }
        return tutorial.steps[this.currentStep];
    }

    /**
     * Move to next step
     * @returns {Object|null} Next step or null if tutorial is complete
     */
    nextStep() {
        const tutorial = this.getTutorial(this.currentTutorial);
        if (!tutorial || !tutorial.steps) return null;

        this.currentStep++;
        if (this.currentStep >= tutorial.steps.length) {
            // Tutorial complete
            return null;
        }
        return this.getCurrentStep();
    }

    /**
     * Move to previous step
     * @returns {Object|null} Previous step or null if at beginning
     */
    prevStep() {
        if (this.currentStep <= 0) return null;
        this.currentStep--;
        return this.getCurrentStep();
    }

    /**
     * Reset tutorial to first step
     */
    resetTutorial() {
        this.currentStep = 0;
    }

    /**
     * Start a specific tutorial
     * @param {string} tutorialId - Tutorial to start
     */
    startTutorial(tutorialId) {
        if (this.tutorials[tutorialId]) {
            this.currentTutorial = tutorialId;
            this.currentStep = 0;
            this.isActive = true;
        }
    }

    /**
     * Stop current tutorial
     */
    stopTutorial() {
        this.isActive = false;
    }

    /**
     * Check if tutorial is active
     * @returns {boolean} True if tutorial is active
     */
    isTutorialActive() {
        return this.isActive;
    }

    /**
     * Get position class for tutorial step
     * @param {string} position - Position value from step config
     * @returns {string} CSS class for positioning
     */
    getPositionClass(position) {
        switch(position) {
            case 'top': return 'tutorial-top';
            case 'bottom': return 'tutorial-bottom';
            case 'left': return 'tutorial-left';
            case 'right': return 'tutorial-right';
            case 'center': return 'tutorial-center';
            default: return 'tutorial-right';
        }
    }
}

// Export for use in other modules
export { TutorialConfig };
const tutorialConfig = new TutorialConfig();