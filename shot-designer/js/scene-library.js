/**
 * SCENE LIBRARY
 * --------------
 * Loads 3D scenes from the `scenes/` folder and swaps them into a THREE.Scene
 * at runtime, driven by a listbox.
 *
 * Discovery follows the repo convention (see __Template/data/manifest.json):
 * a `manifest.json` lists the available scenes, and each entry points at a file
 * in the same folder.
 *
 * Two scene file types are supported:
 *
 *   "type": "module"   an ES module exporting `build(group)`. Procedural
 *                      scenes live here. Optionally returns { update(t) }.
 *   "type": "json"     a three.js serialised Object3D, i.e. what the tool's
 *                      "Scene 3D JSON" export button produces.
 *
 * A `build()` / parsed scene may set `background` and `fog` on the returned
 * group; both are copied onto the target scene when present.
 *
 * Usage:
 *   const lib = new SceneLibrary({ scene: S, camera: C, select: #scn });
 *   await lib.init();          // fetch manifest, fill listbox, load default
 *   lib.update(t);             // call once per frame (forwards to the scene)
 */

import THREE from './three.js';

const FALLBACK_LIGHT = () => {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(20, 40, 20);
    return [hemi, dir];
};

export class SceneLibrary {
    /** Label for the leading "nothing chosen yet" option in the listbox. */
    static PLACEHOLDER = '> Select Scene';

    /**
     * @param {object}   opts
     * @param {THREE.Scene} opts.scene        scene to populate
     * @param {THREE.Camera} [opts.camera]    camera to frame on load
     * @param {THREE.WebGLRenderer} [opts.renderer] enables shadow maps for
     *        scenes that declare `shadows: true`
     * @param {string}   [opts.manifestUrl]   default 'scenes/manifest.json'
     * @param {string}   [opts.baseUrl]       folder holding the scene files
     * @param {HTMLSelectElement} [opts.select] listbox to populate
     * @param {HTMLButtonElement} [opts.loadButton] when given, the listbox only
     *        arms the button and the scene loads on click. Without it, the
     *        listbox loads on change.
     * @param {Array<THREE.Object3D>} [opts.keep] objects preserved across swaps
     *        (e.g. the app's orbit/path helper group)
     */
    constructor(opts) {
        this.scene = opts.scene;
        this.camera = opts.camera || null;
        this.renderer = opts.renderer || null;
        this.manifestUrl = opts.manifestUrl || 'scenes/manifest.json';
        this.baseUrl = opts.baseUrl || this.manifestUrl.replace(/[^/]*$/, '');
        this.select = opts.select || null;
        this.loadButton = opts.loadButton || null;
        this.keep = new Set(opts.keep || []);

        this.entries = [];
        this.current = null;   // { id, update?, background?, fog? }
        this.framing = null;   // { center: Vector3, distance: number }
    }

    /** Fetch the manifest, fill the listbox, then load the default scene. */
    async init() {
        const res = await fetch(new URL(this.manifestUrl, document.baseURI), { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Could not read ${this.manifestUrl} (HTTP ${res.status}). Serve the tool over http:// — file:// blocks fetch().`);
        }
        const manifest = await res.json();
        this.entries = Array.isArray(manifest.scenes) ? manifest.scenes : [];

        if (this.select) this.#renderOptions();

        // Only auto-load when the manifest names a default. With "default": null
        // the listbox stays on the "> Select Scene" hint and waits for a choice.
        const wanted = manifest.default && this.entries.some(s => s.id === manifest.default)
            ? manifest.default
            : null;
        if (wanted) await this.load(wanted);
        return this;
    }

    #renderOptions() {
        this.select.innerHTML = '';

        // Leading hint so it is obvious the listbox picks the 3D scene.
        // Disabled: it is a label, not a loadable choice.
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = SceneLibrary.PLACEHOLDER;
        placeholder.disabled = true;
        placeholder.selected = true;
        this.select.appendChild(placeholder);

        for (const entry of this.entries) {
            const opt = document.createElement('option');
            opt.value = entry.id;
            opt.textContent = entry.name || entry.id;
            this.select.appendChild(opt);
        }

        // The listbox never loads on its own — it only arms the Load button, so
        // a stray change cannot swap the scene out from under the user.
        this.select.onchange = () => this.#syncLoadButton();

        this.select.disabled = this.entries.length < 1;
        this.#syncLoadButton();
        if (this.loadButton) {
            this.loadButton.onclick = () => this.loadSelected();
        }
    }

    /** Enable the Load button only when the choice differs from what's loaded. */
    #syncLoadButton() {
        if (!this.loadButton) return;
        const chosen = this.select?.value || '';
        this.loadButton.disabled = !chosen || chosen === (this.current?.id || '');
    }

    /** Load whatever the listbox currently has selected. */
    loadSelected() {
        if (this.select?.value) return this.load(this.select.value);
    }

    /** Load a scene by manifest id. Returns the scene handle. */
    async load(id) {
        if (!id) throw new Error('No scene selected.');
        const entry = this.entries.find(s => s.id === id);
        if (!entry) throw new Error(`Unknown scene "${id}"`);

        const root = new THREE.Group();
        root.name = `scene:${id}`;

        let handle = null;
        if ((entry.type || 'module') === 'json') {
            handle = await this.#loadJson(entry, root);
        } else {
            handle = await this.#loadModule(entry, root);
        }

        this.#swap(root, handle);
        this.current = { id, ...(handle || {}) };

        if (this.select && this.select.value !== id) this.select.value = id;
        this.#syncLoadButton();
        window.dispatchEvent(new CustomEvent('sd:scene', {
            detail: { id, name: entry.name, scene: this.current, framing: this.framing }
        }));
        return this.current;
    }

    /** Resolve a scene filename against the scenes folder, absolute to the document. */
    #url(file) {
        return new URL(file, new URL(this.baseUrl, document.baseURI)).href;
    }

    async #loadModule(entry, root) {
        // Note: a relative specifier passed to import() resolves against this
        // module's own URL (/js/), not the document — so resolve it first.
        const mod = await import(/* @vite-ignore */ this.#url(entry.file));
        const build = mod.build || mod.default?.build;
        if (typeof build !== 'function') {
            throw new Error(`${entry.file} must export a build(group) function.`);
        }
        // Scenes get the renderer so they can build an environment map.
        return (await build(root, { renderer: this.renderer })) || null;
    }

    async #loadJson(entry, root) {
        const res = await fetch(this.#url(entry.file), { cache: 'no-store' });
        if (!res.ok) throw new Error(`Could not read ${entry.file} (HTTP ${res.status})`);
        const payload = await res.json();
        // The tool's export writes { format, version, scene: <Object3D JSON> }.
        const data = payload.scene || payload;
        const parsed = new THREE.ObjectLoader().parse(data);
        // Keep the parsed root as-is rather than flattening its children: the
        // root may be a bare Mesh/Object3D with no children of its own, and
        // nesting preserves any transform set on the root.
        root.add(parsed);
        return { background: parsed.background, fog: parsed.fog };
    }

    /** Replace the scene contents, preserving `keep` objects. */
    #swap(root, handle) {
        for (const child of [...this.scene.children]) {
            if (!this.keep.has(child)) this.scene.remove(child);
        }
        root.children.slice().forEach(c => this.scene.add(c));

        // `background: null` is a deliberate "clear it" (the scene draws its own
        // sky dome), so test for the key rather than using ?? which treats null
        // as absent.
        const background = handle && 'background' in handle ? handle.background : root.background;
        const fog = handle && 'fog' in handle ? handle.fog : root.fog;
        if (background !== undefined) this.scene.background = background;
        if (fog !== undefined) this.scene.fog = fog;

        // Scenes wider than the camera's default far plane (sky domes, distant
        // backdrops) declare how much depth range they need.
        if (this.camera && handle?.far && handle.far > this.camera.far) {
            this.camera.far = handle.far;
            this.camera.updateProjectionMatrix();
        }

        // Image-based lighting. Without this, metals have nothing to reflect and
        // render black.
        if (handle && 'environment' in handle) {
            this.scene.environment = handle.environment || null;
        }

        // Imported JSON often carries fully transparent materials from an
        // export; make them visible again.
        this.scene.traverse(o => {
            if (o.material && o.material.transparent && o.material.opacity === 0) {
                o.material.opacity = 1;
            }
        });

        if (!this.#hasLight()) FALLBACK_LIGHT().forEach(l => this.scene.add(l));

        // Scenes that declare `shadows: true` need a shadow map on the renderer.
        if (handle?.shadows && this.renderer) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        this.#frame();
    }

    #hasLight() {
        let found = false;
        this.scene.traverse(o => { if (o.isLight) found = true; });
        return found;
    }

    /** Frame the camera on the scene bounds. */
    #frame() {
        const box = new THREE.Box3();
        for (const child of this.scene.children) {
            if (this.keep.has(child) || child.isLight) continue;
            // Sky domes, suns and distant backdrops opt out so they cannot
            // inflate the bounds and push the camera absurdly far back.
            if (child.userData?.excludeFromBounds) continue;
            box.expandByObject(child);
        }
        if (box.isEmpty()) {
            this.framing = null;
            return;
        }

        const center = box.getCenter(new THREE.Vector3());
        const distance = Math.min(80, Math.max(16, box.getSize(new THREE.Vector3()).length() * 1.2));
        this.framing = { center, distance };

        if (this.camera) {
            this.camera.position.set(
                center.x,
                center.y + distance * 0.32,
                center.z + distance * 0.86
            );
            this.camera.up.set(0, 1, 0);
            this.camera.lookAt(center);
            this.camera.updateProjectionMatrix();
        }
    }

    /** Forward the frame time to the active scene, if it wants it. */
    update(t) {
        this.current?.update?.(t);
    }
}
