import * as THREE from 'three';

/**
 * PolyforkImporter - Fetches and imports 3D models from polyfork.dev
 * API Key: pf_360d4e14c09e6de611abe2272410602cb249a026
 * Only free/forever-free items are shown.
 */

const API_KEY = 'pf_360d4e14c09e6de611abe2272410602cb249a026';
const BASE_URL = 'https://api.polyfork.dev/v1';

export class PolyforkImporter {
    constructor(app) {
        this.app = app;
        this.models = [];
        this.currentPage = 1;
        this.hasMore = true;
        this.isLoading = false;
        this.searchQuery = '';
        this.abortController = null;
    }

    /** Search models on polyfork.dev */
    async searchModels(query = '', page = 1, perPage = 20) {
        if (this.isLoading) return [];

        this.isLoading = true;
        this.searchQuery = query;

        if (page === 1) {
            this.models = [];
            this.currentPage = 1;
            this.hasMore = true;
        }

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: perPage.toString(),
                free: 'true',
            });

            if (query) {
                params.set('search', query);
            }

            const url = `${BASE_URL}/models?${params.toString()}`;
            
            this.abortController = new AbortController();
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/json',
                },
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Filter for free/forever-free models
            const freeModels = (data.data || []).filter(model => 
                model.is_free === true || model.price === 0
            );

            this.models.push(...freeModels);
            this.currentPage = page;
            this.hasMore = data.meta?.current_page < data.meta?.last_page;

            return freeModels;
        } catch (error) {
            if (error.name === 'AbortError') return [];
            console.error('Polyfork search error:', error);
            this.app.ui?.showNotification?.(`Failed to search models: ${error.message}`, 'error');
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /** Load more results */
    async loadMore() {
        if (!this.hasMore || this.isLoading) return [];
        return this.searchModels(this.searchQuery, this.currentPage + 1);
    }

    /** Download and import a model by ID */
    async importModel(modelId) {
        try {
            // First get model details to find download URL
            const detailUrl = `${BASE_URL}/models/${modelId}`;
            const detailResponse = await fetch(detailUrl, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/json',
                },
            });

            if (!detailResponse.ok) {
                throw new Error(`Failed to get model details: ${detailResponse.status}`);
            }

            const modelData = await detailResponse.json();
            const model = modelData.data;

            // Find GLB format download
            const glbFile = model.files?.find(f => f.format === 'glb' || f.format === 'gltf');
            if (!glbFile) {
                throw new Error('No GLB/GLTF format available for this model');
            }

            // Download the file
            const downloadResponse = await fetch(glbFile.download_url, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
            });

            if (!downloadResponse.ok) {
                throw new Error(`Failed to download model: ${downloadResponse.status}`);
            }

            const blob = await downloadResponse.blob();
            const url = URL.createObjectURL(blob);

            // Load into Three.js
            const loader = await createGLTFLoader();
            const gltf = await loader.loadAsync(url);
            
            URL.revokeObjectURL(url);

            // Create staging object from imported GLTF
            const group = new THREE.Group();
            group.name = model.name || 'Imported Model';
            
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.side = THREE.DoubleSide;
                    }
                }
            });
            
            group.add(gltf.scene);
            
            // Center the model
            const box = new THREE.Box3().setFromObject(group);
            const center = new THREE.Vector3();
            box.getCenter(center);
            group.position.sub(center);
            group.position.y = -box.min.y; // Sit on floor

            // Add to scene via staging manager
            const object = this.app.staging.factory.create('prop', 'custom', {}, null);
            if (object) {
                // Replace the placeholder with our imported model
                while (object.children.length > 0) {
                    object.remove(object.children[0]);
                }
                object.add(gltf.scene);
                object.userData.staging = {
                    ...object.userData.staging,
                    kind: 'prop',
                    presetId: 'imported',
                    params: { source: 'polyfork', modelId, originalName: model.name },
                    imported: true,
                    polyforkData: {
                        id: model.id,
                        name: model.name,
                        author: model.user?.username,
                        license: model.license,
                        attribution: model.attribution,
                        tags: model.tags,
                    }
                };
                object.name = model.name;
            }

            return object;
        } catch (error) {
            console.error('Polyfork import error:', error);
            this.app.ui?.showNotification?.(`Failed to import model: ${error.message}`, 'error');
            return null;
        }
    }

    /** Cancel any ongoing request */
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isLoading = false;
    }

    /** Build model card HTML */
    static createModelCard(model, onClick) {
        const card = document.createElement('div');
        card.className = 'polyfork-model-card';
        card.dataset.modelId = model.id;

        const thumbnail = model.thumbnails?.[0]?.url || model.thumbnail_url;
        
        card.innerHTML = `
            <div class="polyfork-model-thumb">
                ${thumbnail ? `<img src="${thumbnail}" alt="${model.name}" loading="lazy">` : `<span class="placeholder"><i class="fas fa-cube"></i></span>`}
            </div>
            <div class="polyfork-model-name" title="${model.name}">${model.name}</div>
            ${model.license ? `<span class="polyfork-model-license">${model.license}</span>` : ''}
        `;

        card.addEventListener('click', () => onClick(model));
        return card;
    }
}

// GLTFLoader import helper (uses three.js from CDN)
let GLTFLoaderPromise = null;
function getGLTFLoader() {
    if (!GLTFLoaderPromise) {
        GLTFLoaderPromise = import('three/addons/loaders/GLTFLoader.js')
            .then(m => m.GLTFLoader);
    }
    return GLTFLoaderPromise;
}

async function createGLTFLoader() {
    const Loader = await getGLTFLoader();
    return new Loader();
}