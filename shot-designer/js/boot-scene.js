/**
 * Scene bootstrap
 * ---------------
 * Wires the scene library to the running app without assuming anything about
 * how the rest of the tool is structured. The app calls attach() once it has
 * a THREE.Scene, and forwards frame times to update().
 *
 *   import './boot-scene.js';                       // once, in the app entry
 *   window.sdScenes.attach({ scene: S, camera: C, keep: [aux] });
 *   window.sdScenes.update(elapsedSeconds);         // inside the render loop
 *
 * Listens for 'sd:scene' on window to react to scene changes.
 */

import { SceneLibrary } from './scene-library.js';

let library = null;

const select = document.getElementById('scn');
const loadButton = document.getElementById('scnload');
const note = document.getElementById('scne');

function report(message, isError = false) {
    if (!note) return;
    note.textContent = message;
    note.style.color = isError ? '#e57373' : '';
}

async function attach({ scene, camera, renderer, keep, manifestUrl } = {}) {
    if (!scene) throw new Error('attach() needs a THREE.Scene');
    if (library) return library;

    library = new SceneLibrary({
        scene,
        camera,
        renderer,
        keep,
        manifestUrl,
        select,
        loadButton
    });

    try {
        await library.init();
        const count = library.entries.length;
        const loaded = library.current?.id;
        report(loaded
            ? `Loaded: ${loaded}`
            : (count ? 'Choose a scene, then press Load' : 'No scenes listed in the manifest'));
        if (loadButton && count) loadButton.title = 'Load the selected scene';
    } catch (e) {
        console.error('[scene-library]', e);
        if (select) select.disabled = true;
        report(e.message || String(e), true);
    }
    return library;
}

window.sdScenes = {
    attach,
    get library() {
        return library;
    },
    /** Forward elapsed seconds to the active scene's update() hook. */
    update(t) {
        library?.update(t);
    }
};
