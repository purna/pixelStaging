// Default Configuration for Pixel 3D Studio
export const APP_DEFAULTS = {
    // UI Settings
    ui: {
        gridVisible: true,
        axesVisible: true,
        snapEnabled: true,
        tooltipsEnabled: true,
        cameraSpeed: 1.0,
        autosaveEnabled: false,
        autosaveInterval: 5
    },

    // Scene Settings Defaults
    scene: {
        backgroundEnabled: true,
        backgroundColor: '#1a1a2e', // Dark blue-gray background
        ambientLightEnabled: true,
        ambientColor: '#ffffff', // White ambient light
        exportTransparent: false,
        exportResolution: '1920x1080',
        customWidth: 1920,
        customHeight: 1080
    },

    // Default Colors
    colors: {
        background: '#1a1a2e',
        ambientLight: '#ffffff',
        grid: '#6b7280',
        gridCenter: '#4b5563',
        axesX: '#ff4444', // Red for X axis
        axesY: '#44ff44', // Green for Y axis
        axesZ: '#4444ff', // Blue for Z axis
        defaultObject: '#00ff41', // Default object color
        selectedObject: '#00d9ff', // Selected object highlight
        transparentBackground: '#00000000' // Fully transparent for exports
    },

    // Camera Settings
    camera: {
        perspectiveFOV: 60,
        perspectiveNear: 0.1,
        perspectiveFar: 1000,
        orthographicFrustumSize: 20,
        defaultPosition: { x: 10, y: 8, z: 10 },
        isometricPosition: { x: 15, y: 15, z: 15 }
    },

    // Lighting Settings
    lighting: {
        directionalIntensity: 1.2,
        directionalColor: '#ffffff',
        ambientIntensity: 0.6,
        ambientColor: '#ffffff',
        shadowMapSize: 2048,
        shadowCamera: {
            near: 0.5,
            far: 50,
            left: -10,
            right: 10,
            top: 10,
            bottom: -10
        }
    },

    // Export Settings
    export: {
        resolutions: [
            { value: '1920x1080', label: 'Full HD (1920×1080)' },
            { value: '2560x1440', label: '2K (2560×1440)' },
            { value: '3840x2160', label: '4K (3840×2160)' },
            { value: 'custom', label: 'Custom Resolution' }
        ],
        defaultResolution: '1920x1080',
        quality: 0.92, // JPEG quality for exports
        format: 'png', // Default export format
        formats: [
            { value: 'json', label: 'JSON (.json) - Scene data' },
            { value: 'glb', label: 'GLB (.glb) - Binary GLTF' },
            { value: 'fbx', label: 'FBX (.fbx) - Autodesk FBX' }
        ],
        defaultFormat: 'json'
    },

    // Performance Settings
    performance: {
        targetFPS: 60,
        maxPixelRatio: 2,
        shadowMapType: 'PCFSoft'
    },

    // Initialization Timings (ms)
    init: {
        transformControlsDelay: 100,
        uiInitDelay: 200,
        checkboxInitDelay: 500,
        clockStartDelay: 10
    },

    // Scene Defaults
    scene: {
        gridSize: 40,
        gridDivisions: 40,
        axesSize: 10,
        fogNear: 20,
        fogFar: 100,
        backgroundColor: 0x2a2a4e
    },

    // Transform Controls
    transform: {
        gizmoSize: 1.5,
        selectGizmoSize: 1.0,
        orbitPanSpeed: 0.8,
        orbitRotateSpeed: 0.8,
        dampingFactor: 0.07,
        handPanSpeed: 1.0
    },

    // Snap Settings
    snap: {
        enabled: true,
        mode: 'grid',       // 'grid' | 'object' | 'off'
        gridUnit: 1,        // snap to nearest N units on grid
        snapThreshold: 1.5, // max distance to snap to another object face
        edgeThreshold: 0.75 // snapping along X/Z for face-to-face alignment
    }
};