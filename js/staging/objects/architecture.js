import * as THREE from 'three';

/**
 * Staging architecture — pre-built wall pieces with pre-cut openings
 * (no CSG, per the architecture doc). Units in metres.
 * Wall origin: centre of the base, running along the X axis.
 */

export const architecturePresets = {
    floor: {
        label: 'Floor',
        defaultColor: 0x7a6f5f,
        params: { width: 10, depth: 10 },
        create(params, material) {
            const w = params.width ?? 10, d = params.depth ?? 10;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), material);
            mesh.position.y = 0.025;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            return mesh;
        }
    },
    'wall-straight': {
        label: 'Wall (straight)',
        defaultColor: 0xcfc6b8,
        params: { length: 4, height: 2.7, thickness: 0.15 },
        create: (p, m) => wall(p, m)
    },
    'wall-corner': {
        label: 'Wall (corner)',
        defaultColor: 0xcfc6b8,
        params: { length: 2, height: 2.7, thickness: 0.15 },
        create: (p, m) => {
            const g = new THREE.Group();
            const wp = { ...p };
            g.add(wall(wp, m));
            const arm = wall(wp, m);
            arm.rotation.y = -Math.PI / 2;
            arm.position.x = p.length / 2 - p.thickness / 2;
            arm.position.z = p.length / 2 - p.thickness / 2;
            g.add(arm);
            return g;
        }
    },
    'wall-t': {
        label: 'Wall (T-junction)',
        defaultColor: 0xcfc6b8,
        params: { length: 4, height: 2.7, thickness: 0.15 },
        create: (p, m) => {
            const g = new THREE.Group();
            g.add(wall(p, m));
            const stem = wall(p, m);
            stem.rotation.y = Math.PI / 2;
            stem.position.x = 0;
            g.add(stem);
            return g;
        }
    },
    'wall-doorway': {
        label: 'Wall (door opening)',
        defaultColor: 0xcfc6b8,
        params: { length: 4, height: 2.7, thickness: 0.15, doorWidth: 1.0, doorHeight: 2.1 },
        create: (p, m) => wallWithOpening(p, m, p.doorWidth ?? 1.0, p.doorHeight ?? 2.1, 0)
    },
    'wall-window': {
        label: 'Wall (window opening)',
        defaultColor: 0xcfc6b8,
        params: { length: 4, height: 2.7, thickness: 0.15, winWidth: 1.4, winHeight: 1.2, winSill: 0.9 },
        create: (p, m) => wallWithOpening(p, m, p.winWidth ?? 1.4, p.winHeight ?? 1.2, p.winSill ?? 0.9)
    },
    'wall-backer': {
        label: 'Cutaway backer wall',
        defaultColor: 0xb8b0a2,
        params: { length: 4, height: 2.7, thickness: 0.05 },
        create: (p, m) => {
            // One-sided filming wall: thin panel, no back face detail
            return wall({ ...p, thickness: p.thickness ?? 0.05 }, m);
        }
    },
    door: {
        label: 'Door',
        defaultColor: 0x8b5a2b,
        params: { width: 0.95, height: 2.05, thickness: 0.05 },
        create(params, material) {
            const w = params.width ?? 0.95, h = params.height ?? 2.05, t = params.thickness ?? 0.05;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), material);
            mesh.position.y = h / 2;
            return mesh;
        }
    },
    window: {
        label: 'Window frame',
        defaultColor: 0x9ec9e2,
        params: { width: 1.4, height: 1.2, thickness: 0.05 },
        create(params, material) {
            const w = params.width ?? 1.4, h = params.height ?? 1.2, t = params.thickness ?? 0.05;
            const g = new THREE.Group();
            const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), material);
            frame.position.y = h / 2;
            frame.material = new THREE.MeshStandardMaterial({ color: 0x6b5a3f, roughness: 0.8 });
            const glass = new THREE.Mesh(
                new THREE.PlaneGeometry(w * 0.9, h * 0.9),
                new THREE.MeshStandardMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.35, roughness: 0.1 })
            );
            glass.position.y = h / 2;
            glass.position.z = t / 2 + 0.001;
            g.add(frame, glass);
            return g;
        }
    },
    ceiling: {
        label: 'Ceiling',
        defaultColor: 0xe8e4dc,
        params: { width: 10, depth: 10, height: 2.7 },
        create(params, material) {
            const w = params.width ?? 10, d = params.depth ?? 10, h = params.height ?? 2.7;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), material);
            mesh.position.y = h;
            mesh.castShadow = false;
            return mesh;
        }
    },
    railing: {
        label: 'Railing',
        defaultColor: 0x5c6670,
        params: { length: 2, height: 1.0 },
        create(params, material) {
            const l = params.length ?? 2, h = params.height ?? 1.0;
            const g = new THREE.Group();
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, l, 8), material);
            top.rotation.z = Math.PI / 2;
            top.position.y = h;
            [-1, 1].forEach(s => {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), material);
                post.position.set(s * (l / 2 - 0.05), h / 2, 0);
                g.add(post);
            });
            for (let i = 1; i < 5; i++) {
                const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h - 0.1, 6), material);
                baluster.position.set(-l / 2 + (l / 5) * i, (h - 0.1) / 2, 0);
                g.add(baluster);
            }
            g.add(top);
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    stairs: {
        label: 'Stairs',
        defaultColor: 0xb0b7bd,
        params: { steps: 6, stepHeight: 0.18, stepDepth: 0.3, width: 1.2 },
        create: (p, m) => {
            const steps = p.steps ?? 6;
            const sh = p.stepHeight ?? 0.18;
            const sd = p.stepDepth ?? 0.3;
            const w = p.width ?? 1.2;
            const group = new THREE.Group();
            for (let i = 0; i < steps; i++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(w, sh * (i + 1), sd), m);
                step.position.set(0, (sh * (i + 1)) / 2, -i * sd - sd / 2);
                step.castShadow = true;
                step.receiveShadow = true;
                group.add(step);
            }
            group.position.y = 0;
            return group;
        }
    }
};

function wall(p, m) {
    const l = p.length ?? 4, h = p.height ?? 2.7, t = p.thickness ?? 0.15;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(l, h, t), m);
    mesh.position.y = h / 2;
    return mesh;
}

/** Wall with a rectangular opening cut as panels (left, right, above). */
function wallWithOpening(p, m, openingW, openingH, sill) {
    const l = p.length ?? 4, h = p.height ?? 2.7, t = p.thickness ?? 0.15;
    const g = new THREE.Group();
    const ow = Math.min(openingW, l * 0.8);
    const sideLen = (l - ow) / 2;
    const left = new THREE.Mesh(new THREE.BoxGeometry(sideLen, h, t), m);
    left.position.set(-(ow / 2 + sideLen / 2), h / 2, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(sideLen, h, t), m);
    right.position.set(ow / 2 + sideLen / 2, h / 2, 0);
    const aboveH = h - sill - openingH;
    let above = null;
    if (aboveH > 0.01) {
        above = new THREE.Mesh(new THREE.BoxGeometry(ow, aboveH, t), m);
        above.position.set(0, sill + openingH + aboveH / 2, 0);
    }
    [left, right, above].forEach(x => {
        if (x) { x.castShadow = true; x.receiveShadow = true; g.add(x); }
    });
    return g;
}
