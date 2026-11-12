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
            // Short first-run tour: just the controls people need to get started.
            'quick': {
                enabled: true,
                steps: [
                    {
                        id: 'quick-welcome',
                        elementId: 'canvas-container',
                        position: 'center',
                        arrowPosition: 'none',
                        heading: 'Welcome to Pixel Staging',
                        content: 'Build a scene, place cameras and plan shots. This one-minute tour covers the basics. Press Esc to close it at any time, and use the ? button in the header to bring it back.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-add',
                        elementId: 'tools-container',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: '1. Add things',
                        content: 'Use the left toolbar to add shapes, characters, lights and staging props (actors, furniture, walls). Hover an icon to see what it does.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-look',
                        elementId: 'canvas-container',
                        controlMode: 'camera',
                        position: 'center',
                        arrowPosition: 'none',
                        heading: '2. Look around',
                        content: 'In Camera mode, drag empty space to orbit, right-drag to pan and scroll to zoom. You can also use W A S D to move the camera and Q E to rotate it. F, Shift+S, B and T jump to front, side, back and top views; Home resets the view.',
                        demo: 'camera',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-move',
                        elementId: 'canvas-container',
                        controlMode: 'scene',
                        position: 'center',
                        arrowPosition: 'none',
                        heading: '3. Move things',
                        content: 'Switch controls with Tab or the Camera/Scene toggle. In Scene mode, click the highlighted actor, then drag the coloured gizmo arrows. G moves, R rotates and S scales. Right-click empty space to deselect.',
                        demo: 'move',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-snap',
                        elementId: 'snap-toggle',
                        position: 'bottom',
                        arrowPosition: 'top',
                        marginOverride: '20px',
                        heading: '4. Snapping',
                        content: 'Objects snap to the grid while you move them. Hold Alt to bypass snapping for one drag, click the magnet to toggle it, or turn off “Snap objects to grid while moving” in Settings > General.',
                        demo: 'snap',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-properties',
                        elementId: 'props-content',
                        openTab: 'object-properties',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: '5. Edit properties',
                        content: 'With an object selected, Properties lets you change its colour, size and position. Spot and directional lights also have an Aim Target so they can point anywhere.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-shots',
                        elementId: 'shot-designer-content',
                        openTab: 'shot-designer',
                        controlMode: 'camera',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: '6. Plan shots',
                        content: 'Add a camera, then use the Shot Designer to add shots, set start and end frames and choose how the camera moves. The timeline at the bottom plays them back.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'quick-export',
                        elementId: 'btn-export',
                        position: 'bottom',
                        arrowPosition: 'top',
                        marginOverride: '25px',
                        heading: '7. Save and export',
                        content: 'Save to Browser keeps your work locally. Export gives you the project file, a storyboard report or PDF, or a GLB 3D model. For the full tour, open Settings > Tutorial.',
                        showNext: true,
                        showSkip: true
                    }
                ]
            },
            'main': {
                enabled: true,
                steps: [
                    {
                        id: 'welcome',
                        elementId: 'canvas-container',
                        position: 'center',
                        arrowPosition: 'none',
                        heading: 'Welcome to Pixel Staging',
                        content: 'This quick tour covers the staging workspace, cameras, shots, palettes and export tools.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'tools',
                        elementId: 'tools-container',
                        position: 'left',
                        arrowPosition: 'right',
                        arrowPositionOverride: 'middle-third',
                        marginOverride: '20px',
                        heading: 'Tool Library',
                        content: 'The left toolbar is grouped into Select, AI, Shapes, Staging, Characters, Lights and Overlays. Staging now groups actors, children, furniture, architecture and primitives.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'hierarchy',
                        elementId: 'hierarchy-list',
                        openTab: 'hierarchy',
                        position: 'right',
                        arrowPosition: 'left',
                        arrowPositionOverride: 'top-third',
                        marginOverride: '60px',
                        heading: 'Hierarchy',
                        content: 'The Hierarchy lists everything in the scene. Click an item to select it and automatically frame it in the viewport.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'properties',
                        elementId: 'props-content',
                        openTab: 'object-properties',
                        position: 'right',
                        arrowPosition: 'left',
                        arrowPositionOverride: 'middle-third',
                        marginOverride: '60px',
                        heading: 'Properties',
                        content: 'Properties shows transform controls, materials, procedural settings for doors/windows/stairs, camera details and character poses.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'scene',
                        elementId: 'scene-section',
                        openTab: 'scene-settings',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: 'Scene Panel',
                        content: 'The Scene panel manages saved scenes, scene notes, lighting, sky colour, ambient shadows and the scene camera.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'camera',
                        elementId: 'camera-panel-section',
                        openTab: 'scene-settings',
                        openSection: 'camera-panel-section',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: 'Camera Panel',
                        content: 'Cameras now live inside the Scene panel. Name cameras, choose lens, sensor and aspect ratio, and add new cameras for different shots.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'navigation',
                        elementId: 'canvas-container',
                        position: 'center',
                        arrowPosition: 'none',
                        heading: 'Scene Navigation',
                        content: 'Switch between Camera and Scene controls with Tab or the Camera/Scene toggle. In Camera mode use W A S D to move and Q E to rotate, or drag empty space to orbit. Right-drag pans and the wheel zooms. F, Shift+S, B and T give front, side, back and top views.',
                        demo: 'camera',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'snapping',
                        elementId: 'snap-toggle',
                        position: 'bottom',
                        arrowPosition: 'top',
                        marginOverride: '20px',
                        heading: 'Snapping While Moving',
                        content: 'When snapping is on, objects lock to the grid and nearby surfaces as you drag. Hold Alt to temporarily bypass it, or turn snapping off with the magnet. The setting lives in Settings > General > “Snap objects to grid while moving”.',
                        demo: 'snap',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'shots',
                        elementId: 'shot-designer-content',
                        openTab: 'shot-designer',
                        controlMode: 'camera',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: 'Shot Designer',
                        content: 'Add shots, choose a camera move, adjust duration, speed, easing and framing. Use Start/End frames, animation curves and transitions between cuts.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'timeline',
                        elementId: 'shot-timeline',
                        controlMode: 'camera',
                        position: 'top',
                        arrowPosition: 'bottom',
                        marginOverride: '20px',
                        heading: 'Shot Timeline',
                        content: 'The timeline shows shots, keyframes and transitions. Use Play shot, Play all, Pause, Loop and Show path. Start/End frames jump the camera to the keyframe view.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'palettes',
                        elementId: 'asset-colors',
                        openTab: 'assets',
                        position: 'left',
                        arrowPosition: 'right',
                        marginOverride: '20px',
                        heading: 'Colour Palettes',
                        content: 'One palette is active at a time. Switching palettes remaps scene colours like-for-like. You can add colours, reorder swatches, rename palettes and delete custom palettes. The Default palette is protected.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'export',
                        elementId: 'btn-export',
                        position: 'bottom',
                        arrowPosition: 'top',
                        marginOverride: '25px',
                        heading: 'Export',
                        content: 'Export opens a modal for a full project file, printable storyboard report, storyboard PDF, or the current 3D scene as GLB.',
                        showNext: true,
                        showSkip: true
                    },
                    {
                        id: 'settings',
                        elementId: 'tool-settings',
                        position: 'right',
                        arrowPosition: 'left',
                        marginOverride: '20px',
                        heading: 'Settings & Shortcuts',
                        content: 'Settings and Keyboard Shortcuts now live at the bottom of the left toolbar. Open the shortcuts modal for the full key reference.',
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