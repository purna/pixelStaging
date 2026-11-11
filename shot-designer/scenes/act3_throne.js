/**
 * Act 3 – Before the Throne
 * Pharaoh's hall: lapis columns, a patterned plum wall and clerestory light shafts frame the gold throne.
 * Moses and Aaron stand on the limestone floor; the staff has become a serpent between them and the dais.
 * Palette: lapis blue, royal plum, limestone, hammered gold.
 * Hero prop (3D): the serpent-staff (plus the blood vial on its table).  Texture keys: hammered_gold, desert_sand, bulrush_basket.
 */

import { THREE, createScene, person, column, flame, crowd } from './moses-kit.js';

const LAPIS = 0x22388a, PLUM = 0x5a2a5a, LIME = 0xb0a488, GOLD = 0xe0b040;

export function build(group) {
    const W = createScene(group, { seed: 303, bg: 0x1c1432, fogNear: 60, fogFar: 210 });
    const goldM = W.mat(GOLD, { metal: 0.55, rough: 0.4 });

    /* ── light: high clerestory key, warm throne glow ── */
    W.lights({ sky: 0xa8b0e0, gnd: 0x5a4060, hemi: 0.75, sun: 0xffe0b0, sunI: 1.0, sunPos: [-24, 55, 22] });
    W.point(0xffc860, 1.5, 70, 0, 14, -24);
    W.stars(40, 150, [0xc8c8f0, 0xffe0b0], 0.7);

    /* ── floor, carpet, dais ── */
    W.add(group, W.G('box', 150, 0.6, 110), W.mat(LIME), [0, -0.3, 0], { name: 'floor' });
    for (let x = -70; x <= 70; x += 10) for (let z = -50; z <= 50; z += 10) if (((x + z) / 10) % 2 === 0) W.add(group, W.G('box', 9.6, 0.04, 9.6), W.mat(0xa09478), [x, 0.03, z]);
    W.add(group, W.G('box', 11, 0.08, 62), W.mat(LAPIS), [0, 0.06, -4], { name: 'carpet' });
    W.add(group, W.G('box', 11.8, 0.1, 0.5), goldM, [0, 0.09, 26]);
    [-5.6, 5.6].forEach(x => W.add(group, W.G('box', 0.35, 0.1, 62), goldM, [x, 0.09, -4]));

    const dais = W.grp(group, [0, 0, -30], { name: 'dais' });
    for (let i = 0; i < 4; i++) W.add(dais, W.G('box', 34 - i * 5, 0.9, 16 - i * 2.4), W.mat(i % 2 ? 0xc4b89a : LIME), [0, 0.45 + i * 0.9, i * -0.8]);
    W.add(dais, W.G('box', 10, 0.1, 13), W.mat(LAPIS), [0, 3.65, 0.8]);

    /* ── the throne ── */
    const th = W.grp(dais, [0, 3.6, -3], { name: 'throne' });
    W.add(th, W.G('box', 6.2, 2.2, 5), goldM, [0, 1.1, 0]);                           // seat block
    W.add(th, W.G('box', 5.4, 0.3, 4.2), W.mat(LAPIS), [0, 2.3, 0.2]);                // cushion
    W.add(th, W.G('box', 6.2, 9, 0.8), goldM, [0, 6, -2.4]);                          // back
    W.add(th, W.G('box', 4.2, 6, 0.2), W.mat(LAPIS), [0, 6, -1.94]);                  // lapis inlay
    W.add(th, W.G('cone', 3.2, 2.6, 4), goldM, [0, 11.8, -2.4], { r: [0, Math.PI / 4, 0], s: [1, 1, 0.25] });  // pediment
    W.add(th, W.G('sph', 0.9, 6, 5), W.basic(0xfff0a0), [0, 13.6, -2.3]);             // sun disc
    [-3.4, 3.4].forEach(x => { W.add(th, W.G('box', 0.7, 2.4, 4.6), goldM, [x, 2.2, 0]); W.add(th, W.G('cone', 0.45, 1.2, 4), goldM, [x, 3.8, 1.9]); });
    W.add(th, W.G('box', 4.6, 0.8, 1.6), goldM, [0, 0.4, 3.6]);                       // footstool
    W.point(0xffd070, 0.8, 30, 0, 9, 0);
    W.backdrop(th);      // tall throne back is kept out of camera-framing bounds

    person(W, dais, [0, 3.9, -2.7], {      // Pharaoh, enthroned
        name: 'pharaoh', robe: 0xf0e8d0, sash: GOLD, collar: GOLD, head: 'nemes', wrap: LAPIS, wrapTrim: GOLD, s: 1.3, skin: 0xb8804c,
        armL: [-0.9, -0.5], armR: [-0.9, 0.5]
    });
    [-0.95, 0.95].forEach(x => W.add(th, W.G('box', 1.5, 1.0, 2.4), W.mat(0xf0e8d0), [x, 2.45, 1.7]));   // knees
    W.add(th, W.G('cyl', 0.07, 0.07, 3.4, 5), goldM, [-1.6, 4.9, 1.8], { r: [0.25, 0, 0.15] });    // crook
    W.add(th, W.G('cyl', 0.07, 0.07, 3.4, 5), W.mat(LAPIS), [1.6, 4.9, 1.8], { r: [0.25, 0, -0.15] });  // flail

    /* ── back wall, patterned ── */
    const wall = W.grp(group, [0, 0, -48], { name: 'back_wall' });
    W.add(wall, W.G('box', 150, 34, 3), W.mat(PLUM), [0, 17, 0]);
    [4, 12, 20, 28].forEach((y, i) => W.add(wall, W.G('box', 150, 1.2, 3.2), i % 2 ? goldM : W.mat(LAPIS), [0, y, 0.2]));
    for (let i = 0; i < 70; i++) {
        const x = -72 + i * 2.1;
        W.add(wall, W.G('box', 0.7, 2.6, 0.3), W.mat(i % 3 ? 0xc8a040 : 0x8a7ac0), [x, 8 + W.pick([0, 8, 16, 24]), 1.8]);
    }
    W.backdrop(wall);
    [-46, 46].forEach(x => W.backdrop(W.add(group, W.G('box', 3, 34, 110), W.mat(PLUM), [x * 1.6, 17, 0], { name: 'side_wall' })));

    /* ── columns, banners, light shafts ── */
    const cols = W.grp(group, [0, 0, 0], { name: 'columns' });
    [-34, -18, 18, 34].forEach(x => [-30, -14, 2, 18, 34].forEach(z => {
        if (Math.abs(x) < 20 && z < -20) return;
        column(W, cols, x, 0, z, 17, 1.7, x < 0 ? LAPIS : 0x2a3e94, { band: GOLD, cap: GOLD, base: LIME, lotus: GOLD, seg: 8 });
    }));
    W.backdrop(cols);
    const banners = W.grp(group, [0, 0, 0], { name: 'banners' });
    [-18, 18].forEach(x => [-14, 18].forEach(z => {
        W.add(banners, W.G('box', 3.6, 10, 0.2), W.mat(0x7a2a6a), [x + (x < 0 ? 2.8 : -2.8), 11, z]);
        W.add(banners, W.G('box', 3.8, 0.5, 0.3), goldM, [x + (x < 0 ? 2.8 : -2.8), 16.2, z]);
    }));
    W.backdrop(banners);
    const shafts = W.grp(group, [0, 0, 0], { name: 'light_shafts' });
    [[-22, -14], [-6, -24], [14, -10], [26, 6]].forEach(([x, z]) => W.add(shafts, W.G('box', 4, 44, 6), W.basic(0xffe8b0, 0.09), [x, 20, z], { r: [0, 0, 0.35] }));
    W.backdrop(shafts);

    /* ── courtiers on the dais sides ── */
    crowd(W, group, -21, -24, 7, 10, 7, [0x7a4a8a, 0xe0d8c0, 0x2a3e94, 0x5a2a5a], { y: () => 2.7, s: 1.05, packs: 0, staves: 0.3 });
    crowd(W, group, 21, -24, 7, 10, 7, [0x7a4a8a, 0xe0d8c0, 0x2a3e94, 0x5a2a5a], { y: () => 2.7, s: 1.05, packs: 0, staves: 0.3 });
    crowd(W, group, -36, -4, 5, 6, 14, [0xe0d8c0, 0xc8b890], { s: 1.0, packs: 0, staves: 0.5, ry: 1.1 });
    crowd(W, group, 36, -4, 5, 6, 14, [0xe0d8c0, 0xc8b890], { s: 1.0, packs: 0, staves: 0.5, ry: -1.1 });

    /* ── braziers ── */
    [-11, 11].forEach(x => {
        const b = W.grp(group, [x, 0, -14], { name: 'brazier' });
        W.add(b, W.G('cyl', 0.2, 0.3, 4, 5), goldM, [0, 2, 0]);
        W.add(b, W.G('cyl', 1.6, 0.9, 1.2, 8), goldM, [0, 4.4, 0]);
        flame(W, b, 0, 4.9, 0, 1.3);
        W.point(0xff9a40, 1.0, 26, x, 8, -14, 0.2);
    });

    /* ── Moses & Aaron, seen three-quarter from behind ── */
    person(W, group, [-4.2, 0, 6], {
        name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xc8c0b0, beard: 'long', ry: Math.PI - 0.4, s: 1.3,
        armR: [-1.25, 0.2], skin: 0xc08450
    });
    person(W, group, [4.4, 0, 6.4], {
        name: 'aaron', robe: 0xeee6d2, sash: LAPIS, collar: 0x2a4aa0, head: 'wrap', wrap: 0xf0ecdc, wrapTrim: GOLD, ry: Math.PI + 0.4, s: 1.3, skin: 0xb98653,
        armL: [-0.5, -0.45]
    });

    /* ── the serpent-staff (hero prop): a coil with a raised, hooded head ── */
    const serp = W.grp(group, [0, 0, -1], { name: 'serpent_staff', s: 0.95 });
    const green = W.mat(0x4a6a2a), belly = W.mat(0xb8a060), hoodM = W.mat(0x5a7a30);
    const coil = [], neck = [];
    const aEnd = 4.2 * Math.PI, rEnd = 1.3;
    for (let i = 0; i < 16; i++) {
        const t = i / 15, a = t * aEnd, r = 2.9 - 1.6 * t;
        coil.push(W.add(serp, W.G('sph', 1, 6, 4), i % 3 ? green : belly, [Math.cos(a) * r, 0.55 + t * 0.45, Math.sin(a) * r], { s: [0.75, 0.62, 0.75] }));
    }
    for (let j = 0; j < 6; j++) {
        const u = j / 5;
        neck.push(W.add(serp, W.G('sph', 1, 6, 4), j % 2 ? green : belly, [Math.cos(aEnd) * rEnd * (1 - u), 1.2 + u * 3.0, Math.sin(aEnd) * rEnd * (1 - u)], { s: [0.68 - u * 0.12, 0.6, 0.68 - u * 0.12] }));
    }
    const head = W.grp(serp, [0, 4.5, 0]);
    W.add(head, W.G('sph', 1, 7, 5), hoodM, [0, -0.1, -0.1], { s: [1.05, 0.85, 0.3] });                 // spread hood
    W.add(head, W.G('sph', 0.45, 6, 5), green, [0, 0.6, 0.35], { s: [1, 0.8, 1.3] });               // head
    [-0.17, 0.17].forEach(x => W.add(head, W.G('sph', 0.08, 4, 3), W.basic(0xffd040), [x, 0.75, 0.75]));
    W.anim(t => {
        neck.forEach((m, j) => { const u = j / 5; m.position.x = Math.cos(aEnd) * rEnd * (1 - u) + Math.sin(t * 0.9 + u * 2.4) * 0.35 * u; });
        head.position.x = Math.sin(t * 0.9 + 2.4) * 0.35;
        head.rotation.y = Math.sin(t * 0.6) * 0.25;
        head.position.y = 4.5 + Math.sin(t * 1.4) * 0.1;
    });
    W.add(group, W.G('cyl', 0.1, 0.12, 5, 5), W.mat(0x5a3818), [-7.4, 0.15, 9], { r: [0, 0, Math.PI / 2] });   // a spare rod on the floor

    /* ── sign table: blood vial, seal, basket of reeds ── */
    const table = W.grp(group, [-14, 0, 2], { name: 'sign_table' });
    W.add(table, W.G('box', 5, 0.4, 3), W.mat(0xe8dcc0), [0, 2.4, 0]);
    [[-2, -1.1], [2, -1.1], [-2, 1.1], [2, 1.1]].forEach(([x, z]) => W.add(table, W.G('cyl', 0.2, 0.25, 2.4, 5), goldM, [x, 1.2, z]));
    W.add(table, W.G('cyl', 0.45, 0.6, 1.3, 6), W.mat(0x8a1a1a, { emissive: 0x5a0a0a, ei: 0.7, rough: 0.3 }), [-1.2, 3.25, 0]);
    W.add(table, W.G('cyl', 0.2, 0.2, 0.6, 5), W.mat(0x6a1010), [-1.2, 4.1, 0]);
    W.add(table, W.G('cyl', 0.35, 0.35, 0.9, 6), goldM, [0.5, 3.05, 0.2], { r: [0, 0, Math.PI / 2] });      // cylinder seal
    W.add(table, W.G('sph', 0.8, 6, 4), W.mat(0x9a7a3a), [1.7, 3.0, -0.1], { s: [1, 0.6, 1] });              // little bulrush basket

    return W.finish();
}

export default { build };
