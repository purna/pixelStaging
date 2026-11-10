import * as THREE from 'three';

/**
 * Staging primitives — simple blocking-volume shapes.
 * Every preset returns a THREE.Object3D whose origin sits on the floor
 * (y = 0 at the base), so floor-snapping works uniformly.
 */

function mat(color, { roughness = 0.85, metalness = 0.0 } = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export const primitivePresets = {
    cube: {
        label: 'Cube',
        defaultColor: 0x9aa0a6,
        params: { size: 1 },
        create(params, material) {
            const s = params.size ?? 1;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), material);
            mesh.position.y = s / 2;
            return wrap(mesh);
        }
    },
    plane: {
        label: 'Platform Plane',
        defaultColor: 0x8d99ae,
        params: { width: 2, depth: 2, height: 0.1 },
        create(params, material) {
            const w = params.width ?? 2, d = params.depth ?? 2, h = params.height ?? 0.1;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.y = h / 2;
            mesh.castShadow = false;
            return wrap(mesh);
        }
    },
    cylinder: {
        label: 'Cylinder',
        defaultColor: 0x9aa0a6,
        params: { radius: 0.5, height: 1.5 },
        create(params, material) {
            const r = params.radius ?? 0.5, h = params.height ?? 1.5;
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), material);
            mesh.position.y = h / 2;
            return wrap(mesh);
        }
    },
    cone: {
        label: 'Cone',
        defaultColor: 0x9aa0a6,
        params: { radius: 0.5, height: 1.5 },
        create(params, material) {
            const r = params.radius ?? 0.5, h = params.height ?? 1.5;
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 32), material);
            mesh.position.y = h / 2;
            return wrap(mesh);
        }
    },
    sphere: {
        label: 'Sphere',
        defaultColor: 0x9aa0a6,
        params: { radius: 0.5 },
        create(params, material) {
            const r = params.radius ?? 0.5;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material);
            mesh.position.y = r;
            return wrap(mesh);
        }
    },
    torus: {
        label: 'Torus',
        defaultColor: 0x9aa0a6,
        params: { radius: 0.5, tube: 0.15 },
        create(params, material) {
            const r = params.radius ?? 0.5, t = params.tube ?? 0.15;
            const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 40), material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = t;
            return wrap(mesh);
        }
    },
    stairs: {
        label: 'Stairs',
        defaultColor: 0xb0b7bd,
        params: { steps: 6, stepHeight: 0.18, stepDepth: 0.3, width: 1.2 },
        create(params, material) {
            const steps = params.steps ?? 6;
            const sh = params.stepHeight ?? 0.18;
            const sd = params.stepDepth ?? 0.3;
            const w = params.width ?? 1.2;
            const group = new THREE.Group();
            for (let i = 0; i < steps; i++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(w, sh * (i + 1), sd), material);
                step.position.set(0, (sh * (i + 1)) / 2, -i * sd - sd / 2);
                step.castShadow = true;
                step.receiveShadow = true;
                group.add(step);
            }
            group.position.y = 0;
            return group;
        }
    },
    ramp: {
        label: 'Ramp',
        defaultColor: 0xb0b7bd,
        params: { width: 1.2, height: 1, depth: 2 },
        create(params, material) {
            const w = params.width ?? 1.2, h = params.height ?? 1, d = params.depth ?? 2;
            // Wedge: extruded right triangle, extruded across the width
            const shape = new THREE.Shape();
            shape.moveTo(-d / 2, 0);
            shape.lineTo(d / 2, 0);
            shape.lineTo(d / 2, h);
            shape.lineTo(-d / 2, 0);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
            geo.rotateY(Math.PI / 2);
            geo.translate(0, 0, -w / 2);
            const mesh = new THREE.Mesh(geo, material);
            return wrap(mesh);
        }
    },
    platform: {
        label: 'Platform / Dais',
        defaultColor: 0x6d7a86,
        params: { width: 2, depth: 2, height: 0.4 },
        create(params, material) {
            const w = params.width ?? 2, d = params.depth ?? 2, h = params.height ?? 0.4;
            const group = new THREE.Group();
            const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), material);
            top.position.y = h - 0.04;
            const skirt = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h - 0.08, d * 0.96), material);
            skirt.position.y = (h - 0.08) / 2;
            skirt.material = material;
            group.add(top, skirt);
            group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return group;
        }
    }
};

function wrap(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export { mat as stagingMaterial };
