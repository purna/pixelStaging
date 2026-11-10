import './main.js';
import { Icons } from './icons.js';

function replaceIcon(element, name) {
    if (!element || !Icons[name]) return;
    const span = document.createElement('span');
    span.className = 'icon-svg';
    span.innerHTML = Icons[name];
    element.replaceWith(span);
}

function initializeIcons() {
    document.querySelectorAll('[data-icon]').forEach(element => {
        replaceIcon(element, element.dataset.icon);
    });

    const toolbar = {
        'tool-select': 'select',
        'tool-ai-scene': 'ai',
        'tool-materials': 'materials',
        'tool-animate': 'animation',
        'tool-particles': 'particles',
        'tool-physics': 'physics',
        'tool-scene-settings': 'scene',
        'tool-aframe-export': 'aframe',
        'tool-toggle-overlays': 'overlays',
        'tool-settings': 'settings',
        'mode-hand': 'hand',
        'mode-translate': 'translate',
        'mode-rotate': 'rotate',
        'mode-scale': 'scale',
        'undoBtn': 'undo',
        'redoBtn': 'redo',
        'btn-clear': 'clear',
        'btn-load': 'load',
        'btn-save': 'save',
        'btn-export': 'export'
    };
    Object.entries(toolbar).forEach(([id, name]) => {
        replaceIcon(document.querySelector(`#${id} i`), name);
    });

    const actionIcons = {
        addShape: { box: 'box', sphere: 'sphere', cone: 'cone', cylinder: 'cylinder', plane: 'plane', torus: 'torus', pyramid: 'pyramid', tetrahedron: 'tetrahedron', octahedron: 'octahedron', dodecahedron: 'dodecahedron', icosahedron: 'icosahedron', torusknot: 'torusknot' },
        addShape2D: { rectangle: 'rectangle', circle: 'circle2d', triangle: 'triangle2d', star: 'star', heart: 'heart', text: 'text' },
        addLight: { point: 'pointLight', spot: 'spotLight', directional: 'directionalLight', ambient: 'ambientLight', hemisphere: 'hemisphereLight' }
    };
    Object.entries(actionIcons).forEach(([action, types]) => {
        Object.entries(types).forEach(([type, name]) => {
            replaceIcon(document.querySelector(`[data-action="${action}"][data-type="${type}"] i`), name);
        });
    });

    const menuIcons = [
        ['**Shapes**', 'shapes'],
        ['**2D Shapes**', 'shapes2d'],
        ['**Characters**', 'characters'],
        ['**Lights**', 'lights']
    ];
    menuIcons.forEach(([tooltip, name]) => {
        replaceIcon(document.querySelector(`[data-tooltip^="${tooltip}"] i`), name);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIcons, { once: true });
} else {
    initializeIcons();
}
