import * as THREE from 'three';

/**
 * Staging props — furniture & set dressing presets, low-poly.
 * Every preset origin sits on the floor; chairs carry seat metadata
 * (seat height + yaw) consumed by chair-snap for seated figures.
 */

export const propPresets = {
    chair: {
        label: 'Chair',
        defaultColor: 0x8b5e34,
        params: { seatHeight: 0.45, width: 0.5, depth: 0.5 },
        create(params, material) {
            const sh = params.seatHeight ?? 0.45;
            const w = params.width ?? 0.5, d = params.depth ?? 0.5;
            const g = new THREE.Group();
            const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), material);
            seat.position.y = sh;
            const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.05), material);
            back.position.set(0, sh + 0.28, -d / 2 + 0.025);
            g.add(seat, back);
            [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, sh, 8), material);
                leg.position.set(sx * (w / 2 - 0.04), sh / 2, sz * (d / 2 - 0.04));
                g.add(leg);
            }));
            g.userData.seat = { height: sh, yaw: 0, offset: [0, 0, 0] };
            g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return g;
        }
    },
    stool: {
        label: 'Stool',
        defaultColor: 0x6e4f2a,
        params: { seatHeight: 0.65 },
        create(params, material) {
            const h = params.seatHeight ?? 0.65;
            const g = new THREE.Group();
            const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), material);
            seat.position.y = h;
            g.add(seat);
            [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h, 8), material);
                leg.position.set(sx * 0.12, h / 2, sz * 0.12);
                g.add(leg);
            }));
            g.userData.seat = { height: h, yaw: 0, offset: [0, 0, 0] };
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    'table-small': {
        label: 'Table (small)',
        defaultColor: 0x9c7b4d,
        params: { width: 1.0, depth: 1.0, height: 0.75 },
        create: (p, m) => table(p, m, p.width ?? 1.0, p.depth ?? 1.0, p.height ?? 0.75)
    },
    'table-large': {
        label: 'Table (large)',
        defaultColor: 0x9c7b4d,
        params: { width: 2.4, depth: 1.0, height: 0.75 },
        create: (p, m) => table(p, m, p.width ?? 2.4, p.depth ?? 1.0, p.height ?? 0.75)
    },
    desk: {
        label: 'Desk',
        defaultColor: 0x7d6544,
        params: { width: 1.6, depth: 0.7, height: 0.74 },
        create: (p, m) => table(p, m, p.width ?? 1.6, p.depth ?? 0.7, p.height ?? 0.74)
    },
    sofa: {
        label: 'Sofa',
        defaultColor: 0x5b7c8d,
        params: { width: 2.0, depth: 0.9, seatHeight: 0.42 },
        create(params, material) {
            const w = params.width ?? 2.0, d = params.depth ?? 0.9, sh = params.seatHeight ?? 0.42;
            const g = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(w, sh, d), material);
            base.position.y = sh / 2;
            const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, 0.2), material);
            back.position.set(0, sh + 0.275, -d / 2 + 0.1);
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, d), material);
            armL.position.set(-w / 2 + 0.1, sh / 2 + 0.1, 0);
            const armR = armL.clone();
            armR.position.x = w / 2 - 0.1;
            g.add(base, back, armL, armR);
            g.userData.seat = { height: sh + 0.03, yaw: 0, offset: [0, 0, 0.05] };
            g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return g;
        }
    },
    bed: {
        label: 'Bed',
        defaultColor: 0xd8d3c8,
        params: { width: 1.4, length: 2.0, height: 0.5 },
        create(params, material) {
            const w = params.width ?? 1.4, l = params.length ?? 2.0, h = params.height ?? 0.5;
            const g = new THREE.Group();
            const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material);
            frame.position.y = h / 2;
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.18, l * 0.96),
                new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 }));
            mattress.position.y = h + 0.09;
            const pillow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.1, 0.4),
                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
            pillow.position.set(0, h + 0.23, -l / 2 + 0.35);
            g.add(frame, mattress, pillow);
            g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return g;
        }
    },
    bookshelf: {
        label: 'Bookshelf',
        defaultColor: 0x6e4f2a,
        params: { width: 1.0, height: 2.0, depth: 0.35 },
        create(params, material) {
            const w = params.width ?? 1.0, h = params.height ?? 2.0, d = params.depth ?? 0.35;
            const g = new THREE.Group();
            const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), material);
            back.position.set(0, h / 2, -d / 2 + 0.015);
            g.add(back);
            const shelves = 5;
            for (let i = 0; i <= shelves; i++) {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), material);
                shelf.position.y = (h / shelves) * i;
                g.add(shelf);
                if (i < shelves) {
                    // A few "books"
                    const bookMat = new THREE.MeshStandardMaterial({
                        color: [0xa03c3c, 0x3c6ea0, 0x3c9a6e, 0xc9a227][i % 4], roughness: 0.9
                    });
                    for (let b = 0; b < 5; b++) {
                        const book = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, d * 0.7), bookMat);
                        book.position.set(-w / 2 + 0.1 + b * 0.12, (h / shelves) * i + 0.15, 0);
                        g.add(book);
                    }
                }
            }
            [-1, 1].forEach(s => {
                const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, d), material);
                side.position.set(s * (w / 2 - 0.015), h / 2, 0);
                g.add(side);
            });
            g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return g;
        }
    },
    dresser: {
        label: 'Dresser',
        defaultColor: 0x7d6544,
        params: { width: 1.2, height: 0.9, depth: 0.5 },
        create(params, material) {
            const w = params.width ?? 1.2, h = params.height ?? 0.9, d = params.depth ?? 0.5;
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            body.position.y = h / 2;
            g.add(body);
            for (let i = 0; i < 3; i++) {
                const drawer = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h / 3 - 0.06, 0.02),
                    new THREE.MeshStandardMaterial({ color: 0x5c4529, roughness: 0.7 }));
                drawer.position.set(0, (h / 3) * i + h / 6, d / 2 + 0.01);
                g.add(drawer);
            }
            g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            return g;
        }
    },
    counter: {
        label: 'Counter',
        defaultColor: 0xa9b4bc,
        params: { width: 2.0, depth: 0.65, height: 0.9 },
        create: (p, m) => table(p, m, p.width ?? 2.0, p.depth ?? 0.65, p.height ?? 0.9)
    },
    tv: {
        label: 'TV',
        defaultColor: 0x1c1c22,
        params: { width: 1.3, height: 0.75 },
        create(params, material) {
            const w = params.width ?? 1.3, h = params.height ?? 0.75;
            const g = new THREE.Group();
            const screen = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.62, 0.05), material);
            screen.position.y = h * 0.62 / 2 + 0.15;
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.15, 12), material);
            stand.position.y = 0.075;
            g.add(screen, stand);
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    'lamp-floor': {
        label: 'Floor lamp',
        defaultColor: 0xd9c07a,
        params: { height: 1.6 },
        create(params, material) {
            const h = params.height ?? 1.6;
            const g = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h - 0.25, 8), material);
            pole.position.y = (h - 0.25) / 2;
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 16), material);
            const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.25, 16, 1, true),
                new THREE.MeshStandardMaterial({ color: 0xf5e9c8, roughness: 0.9, side: THREE.DoubleSide }));
            shade.position.y = h - 0.125;
            g.add(pole, base, shade);
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    'lamp-table': {
        label: 'Table lamp',
        defaultColor: 0xd9c07a,
        params: { height: 0.5 },
        create(params, material) {
            const h = params.height ?? 0.5;
            const g = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.03, 12), material);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.2, 8), material);
            pole.position.y = (h - 0.2) / 2;
            const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 12, 1, true),
                new THREE.MeshStandardMaterial({ color: 0xf5e9c8, roughness: 0.9, side: THREE.DoubleSide }));
            shade.position.y = h - 0.08;
            g.add(base, pole, shade);
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    plant: {
        label: 'Plant',
        defaultColor: 0x3f7d3f,
        params: { height: 1.0 },
        create(params, material) {
            const h = params.height ?? 1.0;
            const g = new THREE.Group();
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.25, 12),
                new THREE.MeshStandardMaterial({ color: 0xb07050, roughness: 0.9 }));
            pot.position.y = 0.125;
            g.add(pot);
            for (let i = 0; i < 6; i++) {
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), material);
                const a = (i / 6) * Math.PI * 2;
                leaf.position.set(Math.cos(a) * 0.12, 0.3 + (i % 3) * h * 0.28, Math.sin(a) * 0.12);
                leaf.scale.set(1, 1.6, 0.5);
                g.add(leaf);
            }
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }
    },
    rug: {
        label: 'Rug',
        defaultColor: 0x9b4a4a,
        params: { width: 2.5, depth: 1.7 },
        create(params, material) {
            const w = params.width ?? 2.5, d = params.depth ?? 1.7;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), material);
            mesh.position.y = 0.006;
            mesh.castShadow = false;
            return mesh;
        }
    },
    crate: {
        label: 'Crate',
        defaultColor: 0x9a7b4f,
        params: { size: 0.5 },
        create(params, material) {
            const s = params.size ?? 0.5;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), material);
            mesh.position.y = s / 2;
            return mesh;
        }
    },
    barrel: {
        label: 'Barrel',
        defaultColor: 0x6e4f2a,
        params: { radius: 0.3, height: 0.9 },
        create(params, material) {
            const r = params.radius ?? 0.3, h = params.height ?? 0.9;
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), material);
            mesh.position.y = h / 2;
            return mesh;
        }
    }
};

function table(p, m, w, d, h) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), m);
    top.position.y = h - 0.02;
    g.add(top);
    const legH = h - 0.04;
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), m);
        leg.position.set(sx * (w / 2 - 0.06), legH / 2, sz * (d / 2 - 0.06));
        g.add(leg);
    }));
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
}
