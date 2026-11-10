/**
 * A-Frame Exporter Module
 * Converts Three.js scene objects to A-Frame HTML format
 */

export class AFrameExporter {
    constructor(app) {
        this.app = app;
    }

    /**
     * Convert a Three.js color to A-Frame hex string
     */
    colorToHex(color) {
        if (typeof color === 'number') {
            return '#' + color.toString(16).padStart(6, '0');
        }
        if (color && color.getHexString) {
            return '#' + color.getHexString();
        }
        return '#ffffff';
    }

    /**
     * Convert radians to degrees
     */
    radToDeg(rad) {
        return (rad * 180 / Math.PI).toFixed(2);
    }

    /**
     * Get A-Frame primitive name from Three.js shape type
     */
    getAFramePrimitive(shapeType) {
        const primitiveMap = {
            'box': 'a-box',
            'sphere': 'a-sphere',
            'cone': 'a-cone',
            'cylinder': 'a-cylinder',
            'plane': 'a-plane',
            'torus': 'a-torus',
            'tetrahedron': 'a-tetrahedron',
            'octahedron': 'a-octahedron',
            'dodecahedron': 'a-dodecahedron',
            'icosahedron': 'a-icosahedron',
            'torusknot': 'a-torus-knot'
        };
        return primitiveMap[shapeType] || 'a-entity';
    }

    /**
     * Generate A-Frame attributes for a shape
     */
    generateShapeAttributes(obj) {
        const attrs = [];
        const pos = obj.position;
        const rot = obj.rotation;
        const scale = obj.scale;

        // Position
        attrs.push(`position="${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}"`);

        // Rotation (convert from radians to degrees)
        attrs.push(`rotation="${this.radToDeg(rot.x)} ${this.radToDeg(rot.y)} ${this.radToDeg(rot.z)}"`);

        // Scale
        if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
            attrs.push(`scale="${scale.x.toFixed(2)} ${scale.y.toFixed(2)} ${scale.z.toFixed(2)}"`);
        }

        // Color
        if (obj.material && obj.material.color) {
            attrs.push(`color="${this.colorToHex(obj.material.color)}"`);
        }

        // Material properties
        if (obj.material) {
            if (obj.material.metalness !== undefined) {
                attrs.push(`metalness="${obj.material.metalness.toFixed(2)}"`);
            }
            if (obj.material.roughness !== undefined) {
                attrs.push(`roughness="${obj.material.roughness.toFixed(2)}"`);
            }
        }

        // A-Frame specific properties from userData
        if (obj.userData.aframe) {
            const aframeData = obj.userData.aframe;
            if (aframeData.src) {
                attrs.push(`src="${aframeData.src}"`);
            }
            if (aframeData.shadow) {
                attrs.push(`shadow="cast: ${aframeData.shadow.cast || false}; receive: ${aframeData.shadow.receive || false}"`);
            }
            if (aframeData.animation) {
                attrs.push(`animation="${aframeData.animation}"`);
            }
            // Custom attributes
            if (aframeData.customAttrs) {
                Object.entries(aframeData.customAttrs).forEach(([key, value]) => {
                    attrs.push(`${key}="${value}"`);
                });
            }
        }

        return attrs.join(' ');
    }

    /**
     * Generate A-Frame light element
     */
    generateLightElement(obj) {
        const lightObj = obj.children[0];
        if (!lightObj) return '';

        const lightType = obj.userData.lightType;
        const pos = obj.position;
        const color = this.colorToHex(lightObj.color);
        const intensity = lightObj.intensity;

        let element = '';
        switch (lightType) {
            case 'point':
                element = `<a-light type="point" position="${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}" color="${color}" intensity="${intensity.toFixed(2)}"></a-light>`;
                break;
            case 'spot':
                element = `<a-light type="spot" position="${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}" color="${color}" intensity="${intensity.toFixed(2)}" angle="${(lightObj.angle * 180 / Math.PI).toFixed(0)}"></a-light>`;
                break;
            case 'directional':
                element = `<a-light type="directional" position="${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}" color="${color}" intensity="${intensity.toFixed(2)}"></a-light>`;
                break;
            case 'ambient':
                element = `<a-light type="ambient" color="${color}" intensity="${intensity.toFixed(2)}"></a-light>`;
                break;
            case 'hemisphere':
                element = `<a-light type="hemisphere" color="${color}" ground-color="#8b4513" intensity="${intensity.toFixed(2)}"></a-light>`;
                break;
        }
        return element;
    }

    /**
     * Generate A-Frame element for a single object
     */
    generateElement(obj, indent = '    ') {
        if (!obj.userData || !obj.userData.type) return '';

        let element = '';

        if (obj.userData.type === 'shape') {
            const primitive = this.getAFramePrimitive(obj.userData.shapeType);
            const attrs = this.generateShapeAttributes(obj);
            element = `${indent}<${primitive} ${attrs}></${primitive}>`;
        } else if (obj.userData.type === 'light') {
            element = `${indent}${this.generateLightElement(obj)}`;
        }

        return element;
    }

    /**
     * Generate complete A-Frame HTML document
     */
    generateHTML(options = {}) {
        const {
            title = 'Pixel 3D - A-Frame Export',
            includeStats = false,
            includeInspector = true,
            backgroundColor = '#2a2a4e',
            embedded = false
        } = options;

        const elements = [];
        const lights = [];

        // Collect all objects from the scene
        const allObjects = this.app.getAllObjects();

        allObjects.forEach(obj => {
            if (obj.userData.type === 'shape') {
                elements.push(this.generateElement(obj));
            } else if (obj.userData.type === 'light') {
                lights.push(this.generateElement(obj));
            }
        });

        // Also check direct scene children for lights
        this.app.scene.children.forEach(child => {
            if (child.userData && child.userData.type === 'light') {
                const lightElement = this.generateElement(child);
                if (lightElement && !lights.includes(lightElement)) {
                    lights.push(lightElement);
                }
            }
        });

        // Generate camera position from current camera
        let cameraPosition = '0 1.6 5';
        if (this.app.camera) {
            const cam = this.app.camera;
            cameraPosition = `${cam.position.x.toFixed(2)} ${cam.position.y.toFixed(2)} ${cam.position.z.toFixed(2)}`;
        }

        // Build the HTML
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta name="description" content="3D Scene exported from Pixel 3D Studio">
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    ${includeStats ? '<script src="https://unpkg.com/aframe-stats-panel/dist/aframe-stats-panel.min.js"></script>' : ''}
    <style>
        body { margin: 0; overflow: hidden; }
    </style>
</head>
<body>
    <a-scene ${embedded ? 'embedded' : ''} ${includeInspector ? '' : 'inspector="url: https://cdn.jsdelivr.net/gh/aframevr/aframe-inspector@master/dist/aframe-inspector.min.js"'} background="color: ${backgroundColor}">
        <!-- Assets -->
        <a-assets>
            <!-- Add your assets here -->
        </a-assets>

        <!-- Camera -->
        <a-entity id="rig" position="${cameraPosition}">
            <a-camera look-controls wasd-controls></a-camera>
        </a-entity>

        <!-- Lights -->
${lights.join('\n')}

        <!-- Scene Objects -->
${elements.join('\n')}

        <!-- Sky/Environment -->
        <a-sky color="${backgroundColor}"></a-sky>

        <!-- Ground (optional) -->
        <!-- <a-plane position="0 0 0" rotation="-90 0 0" width="40" height="40" color="#4a4a4a" shadow="receive: true"></a-plane> -->
    </a-scene>
</body>
</html>`;

        return html;
    }

    /**
     * Generate only the scene content (for embedding)
     */
    generateSceneContent() {
        const elements = [];
        const allObjects = this.app.getAllObjects();

        allObjects.forEach(obj => {
            const element = this.generateElement(obj, '');
            if (element) {
                elements.push(element);
            }
        });

        return elements.join('\n');
    }

    /**
     * Download the generated HTML file
     */
    downloadHTML(filename = 'scene.html', options = {}) {
        const html = this.generateHTML(options);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Copy HTML to clipboard
     */
    async copyToClipboard(options = {}) {
        const html = this.generateHTML(options);
        try {
            await navigator.clipboard.writeText(html);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    }
}
