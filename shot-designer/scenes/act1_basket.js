/**
 * Act 1 – The Child in the River
 * Moonlit Nile reeds at the water's edge: the pitch-coated basket rests in a reed clump while Miriam
 * watches from the near bank; Pharaoh's daughter and her attendants wait at the far-bank steps below
 * the palace. Palette: deep indigo, river teal, foam blue, wet silver.
 * Hero prop (3D): the basket.  Texture keys: nile_reeds, egypt_mud_brick, bulrush_basket.
 */

import { THREE, createScene, person, palm, reeds, rock, column } from './moses-kit.js';

const INDIGO = 0x0f1a3a;

export function build(group) {
    const W = createScene(group, { seed: 101, bg: INDIGO, fogNear: 55, fogFar: 200 });

    /* ── light: low, raking moonlight from the left ── */
    W.lights({ sky: 0x6080b8, gnd: 0x3a4a5c, hemi: 0.9, sun: 0xb4d4ec, sunI: 1.0, sunPos: [-55, 14, 22] });
    W.point(0xffc070, 1.2, 40, 14, 6, -22);      // warm lamps at the far-bank steps

    /* ── sky ── */
    W.disc([-55, 40, -150], 7, 0xdce8f0);
    W.disc([-55, 40, -160], 12, 0x7a9cc8, 0.22);
    W.stars(110, 150, [0xdce8f0, 0xbfd4f0, 0xfff0c8], 0.9);
    const clouds = W.grp(group, [0, 0, 0], { name: 'cloud_bank' });
    [[-70, 34, -125, 26], [-20, 40, -135, 30], [35, 32, -120, 24], [80, 38, -130, 28], [-105, 42, -140, 22]].forEach(([x, y, z, s]) => {
        W.add(clouds, W.G('ico', 1, 1), W.mat(0x2a3868, { opacity: 0.85 }), [x, y, z], { s: [s, s * 0.28, s * 0.5] });
    });
    W.backdrop(clouds);

    /* ── banks ── */
    const near = W.ground(240, 50, 0, 33, 0x8a7a60, { amp: 0.5, j: 0.3, flat: 26, fz: 28, seg: 30, y: 0 });
    const far = W.ground(240, 50, 0, -35, 0x5a6e42, { amp: 0.6, j: 0.3, flat: 26, fz: -28, seg: 30, y: 0 });
    // wet shoreline strips
    W.add(group, W.G('box', 240, 0.3, 4), W.mat(0x3c3a34), [0, -0.05, 9.6]);
    W.add(group, W.G('box', 240, 0.3, 4), W.mat(0x3c3a34), [0, -0.05, -11.6]);

    /* ── river ── */
    const waterGeo = new THREE.PlaneGeometry(240, 22, 60, 11);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, W.mat(0x1f7487, { rough: 0.3, metal: 0.25 }));
    water.position.set(0, -0.3, -1);
    water.name = 'river';
    group.add(water);
    const wBase = Array.from(waterGeo.attributes.position.array);
    W.anim(t => {
        const p = waterGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            p.setY(i, Math.sin(wBase[i * 3] * 0.3 + t * 1.1) * 0.1 + Math.cos(wBase[i * 3 + 2] * 0.7 + t * 0.9) * 0.08);
        }
        p.needsUpdate = true;
    });
    // silver moon-glints on the water
    for (let i = 0; i < 22; i++) {
        W.add(group, W.G('box', 0.7 + W.r() * 1.3, 0.03, 0.1), W.basic(0xdce8f0, 0.5), [-30 + W.r() * 26, -0.12, -9 + W.r() * 16]);
    }

    /* ── reeds: near-bank fringe, far-bank fringe, the basket thicket ── */
    for (let x = -100; x <= 100; x += 9) {
        reeds(W, group, x + W.rr(-2, 2), 9.3 + W.rr(-0.6, 0.8), 8, 7, { h: 3.6, heads: 0.5 });
        reeds(W, group, x + W.rr(-2, 2), -11 + W.rr(-0.8, 0.6), 7, 7, { h: 3.4, heads: 0.4 });
    }
    // thicket framing the basket (foreground, left + right)
    reeds(W, group, -8.5, 4.8, 16, 6, { h: 5.6, heads: 0.7 });
    reeds(W, group, 8.4, 3.6, 24, 6, { h: 5.2, heads: 0.7 });
    reeds(W, group, 3.2, 8.6, 18, 8, { h: 4.4, heads: 0.6 });
    reeds(W, group, -16, 5, 18, 8, { h: 4.6, heads: 0.6 });
    // tall papyrus tufts at the very front (foreground frame)
    [[-14, 17], [-9, 21], [12, 19], [18, 15]].forEach(([x, z]) => reeds(W, group, x, z, 12, 4, { h: 7, heads: 0.8, cols: [0x5f8a3a, 0x7aa040] }));

    // lily pads
    [[-2.2, 3.2], [4.4, 6], [-0.5, 7.2], [6.8, 0.6], [-7.5, -0.5], [9.5, 2.5]].forEach(([x, z]) => {
        W.add(group, W.G('cyl', 0.9, 0.9, 0.06, 8), W.mat(0x3f7a3a), [x, -0.18, z], { s: [1, 1, 0.9 + W.r() * 0.3] });
        if (W.r() < 0.5) W.add(group, W.G('cone', 0.22, 0.4, 5), W.mat(0xf0c8d8), [x + 0.3, -0.05, z], { r: [0, 0, 0] });
    });
    // foam flecks
    for (let i = 0; i < 40; i++) W.add(group, W.G('oct', 0.22), W.mat(0xbfe4f0, { opacity: 0.85 }), [W.rr(-22, 22), -0.15, W.rr(-9, 8)], { s: [1 + W.r(), 0.5, 1 + W.r()] });

    /* ── the basket (hero prop) ── */
    const basket = W.grp(group, [1.4, -0.12, 0.6], { name: 'basket', r: [0, 0.35, 0] });
    const inner = W.grp(basket, [0, 0, 0]);
    W.add(inner, W.G('sph', 1, 8, 5), W.mat(0x9a7a3a), [0, 0.15, 0], { s: [1.9, 0.72, 1.25] });
    W.add(inner, W.G('sph', 1, 8, 5), W.mat(0x2e2214), [0, 0.42, 0], { s: [1.72, 0.3, 1.1] });           // pitch-dark interior
    W.add(inner, W.G('tor', 1, 0.15, 5, 14), W.mat(0x3a2a18), [0, 0.56, 0], { r: [Math.PI / 2, 0, 0], s: [1.78, 1.12, 1] });  // pitched rim
    for (let i = 0; i < 5; i++) W.add(inner, W.G('tor', 1.75 - Math.abs(i - 2) * 0.12, 0.05, 4, 16), W.mat(0x6a5020), [0, 0.0 + i * 0.1, 0], { r: [Math.PI / 2, 0, 0], s: [1, 0.66, 1] });  // woven bands
    W.add(inner, W.G('sph', 0.75, 7, 5), W.mat(0xf0e6cf), [0.1, 0.62, 0], { s: [1.4, 0.7, 0.9] });        // swaddle
    W.add(inner, W.G('sph', 0.38, 6, 5), W.mat(0xd8a070), [-0.75, 0.78, 0.05]);                           // little head
    W.add(inner, W.G('sph', 0.4, 6, 4), W.mat(0x2a1a10), [-0.78, 0.9, 0.03], { s: [1, 0.5, 1] });
    W.anim(t => { inner.rotation.z = Math.sin(t * 1.3) * 0.045; inner.rotation.x = Math.cos(t * 1.0) * 0.03; inner.position.y = Math.sin(t * 1.6) * 0.04; });

    /* ── Miriam on the near bank, peering through the reeds ── */
    person(W, group, [-3.2, 0, 11.6], {
        name: 'miriam', robe: 0xc89a4a, sash: 0x2f7a7a, head: 'wrap', wrap: 0x3a9a9a, wrapTrim: 0xe0b040, ry: 0.9, s: 1.15,
        armR: [-1.05, 0.25], skin: 0xd09060, bend: 0.1
    });
    reeds(W, group, -5.0, 13.4, 8, 3.0, { h: 3.6, heads: 0.6 });   // reeds she's parting

    /* ── submerged crocodile (the danger, low in the water) ── */
    const croc = W.grp(group, [-11, -0.45, -3.5], { name: 'crocodile', r: [0, 0.3, 0] });
    const cmat = W.mat(0x16241c);
    W.add(croc, W.G('box', 5.6, 0.7, 1.4), cmat, [0, 0, 0]);
    W.add(croc, W.G('box', 2.2, 0.45, 0.9), cmat, [3.6, -0.05, 0]);
    W.add(croc, W.G('cone', 0.55, 4.2, 4), cmat, [-4.6, 0, 0], { r: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 7; i++) W.add(croc, W.G('cone', 0.16, 0.36, 4), cmat, [-1.8 + i * 0.6, 0.45, 0]);
    W.add(croc, W.G('sph', 0.2, 4, 3), W.mat(0xffd860, { emissive: 0xffb020, ei: 0.8 }), [3.2, 0.42, 0.34]);
    W.add(croc, W.G('sph', 0.2, 4, 3), W.mat(0xffd860, { emissive: 0xffb020, ei: 0.8 }), [3.2, 0.42, -0.34]);
    W.anim(t => { croc.position.x = -11 + Math.sin(t * 0.25) * 1.2; croc.position.y = -0.45 + Math.sin(t * 0.8) * 0.04; });

    /* ── far bank: steps, Pharaoh's daughter, attendants ── */
    const steps = W.grp(group, [14, 0, -13.6], { name: 'palace_steps' });
    for (let i = 0; i < 4; i++) W.add(steps, W.G('box', 11 - i * 1.2, 0.5, 1.4), W.mat(0xb89a68), [0, 0.2 + i * 0.5, -i * 1.3]);
    [-5, 5].forEach(x => W.add(steps, W.G('box', 1.2, 1.4, 6), W.mat(0xa08558), [x, 0.9, -3]));
    // lamp posts with warm glow
    [-4.6, 4.6].forEach(x => {
        W.add(steps, W.G('cyl', 0.12, 0.16, 3.2, 5), W.mat(0x3a2a1c), [x, 3.0, -4.2]);
        W.add(steps, W.G('ico', 0.45, 0), W.basic(0xffc860), [x, 4.8, -4.2]);
    });
    person(W, group, [13.2, 0.6, -10.6], {
        name: 'pharaohs_daughter', robe: 0xf2ecdc, sash: 0xe0b040, collar: 0xe0b040, head: 'hair', hair: 0x14100c, ry: -0.9, s: 1.15, skin: 0xd8a070,
        armL: [-0.3, -0.25]
    });
    person(W, group, [16.4, 0.6, -10.2], { name: 'attendant', robe: 0xe8dcc0, sash: 0x2f9a9a, head: 'wrap', wrap: 0xf0e8d0, wrapTrim: 0x2f9a9a, ry: -0.7, s: 1.05, skin: 0xb8804c });
    person(W, group, [10.4, 0.6, -10.6], { name: 'attendant', robe: 0xe8dcc0, sash: 0xc4462b, head: 'hair', hair: 0x14100c, ry: -1.1, s: 1.05, skin: 0xc08450 });

    /* ── far-bank palace (backdrop) ── */
    const palace = W.grp(group, [-20, 0, -40], { name: 'palace', s: 1.25 });
    const stone = 0xd8c08c, trim = 0x2a8f94, red = 0xb4402a, gold = 0xe3a72f;
    W.add(palace, W.G('box', 34, 1, 14), W.mat(0xc8ac78), [0, 0.1, 0]);
    W.add(palace, W.G('box', 30, 4.2, 9), W.mat(stone), [0, 2.7, -1.5]);
    W.add(palace, W.G('box', 30.4, 0.4, 9.4), W.mat(trim), [0, 4.9, -1.5]);
    W.add(palace, W.G('box', 30.6, 0.25, 9.6), W.mat(red), [0, 5.25, -1.5]);
    W.add(palace, W.G('box', 10, 2.2, 6), W.mat(stone), [0, 6.4, -2.5]);
    W.add(palace, W.G('box', 10.4, 0.3, 6.4), W.mat(gold, { metal: 0.4 }), [0, 7.6, -2.5]);
    [-5, 5].forEach(x => {
        W.add(palace, W.G('cyl', 2.4, 3.6, 11, 4), W.mat(stone), [x, 6.2, 4], { r: [0, Math.PI / 4, 0], s: [1, 1, 0.7] });
        W.add(palace, W.G('box', 4.4, 0.4, 3.4), W.mat(gold, { metal: 0.4 }), [x, 11.9, 4]);
    });
    W.add(palace, W.G('box', 6, 2.2, 3), W.mat(0x2a1e14), [0, 1.9, 4.2]);
    for (let i = -6; i <= 6; i++) if (Math.abs(i) > 1) W.add(palace, W.G('box', 0.9, 1.0, 0.12), W.basic(0xffc860, 0.9), [i * 2.2, 3.0, 3.0]);
    W.backdrop(palace);

    /* ── palms, mud-brick walls, rocks ── */
    for (let i = 0; i < 18; i++) palm(W, group, -95 + i * 11 + W.rr(-3, 3), 0, -15 - W.r() * 5, 0.9 + W.r() * 0.5, { leafA: 0x2e5a34, leafB: 0x3a7040 });
    [[-34, 26], [26, 30], [40, 22], [-48, 20]].forEach(([x, z]) => palm(W, group, x, 0, z, 1.35 + W.r() * 0.3, { leafA: 0x2e5a34, leafB: 0x3a7040 }));

    const wall = W.grp(group, [-30, 0, 18], { name: 'mud_brick_wall', r: [0, 0.25, 0] });
    const brick = [0x9a7048, 0xa47c50, 0x8c6640];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
        if (row === 2 && i % 2) continue;
        W.add(wall, W.G('box', 1.7, 0.9, 1.3), W.mat(W.pick(brick)), [i * 1.76 - 7 + (row % 2) * 0.85, 0.45 + row * 0.92, 0]);
    }
    rock(W, group, 20, 0, 13, 1.4, 0x6a5e4c);
    rock(W, group, 24, 0, 16, 1.0, 0x5e5342);
    rock(W, group, -20, 0, 14, 1.1, 0x6a5e4c);

    return W.finish();
}

export default { build };
