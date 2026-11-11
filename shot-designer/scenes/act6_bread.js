/**
 * Act 6 – Bread in the Wilderness
 * Morning in the desert camp: pale manna flakes cover the sand, families bend to gather exactly one
 * omer each into baskets and jars, quail cross the sky, and Moses watches with his staff planted.
 * Palette: sandstone, ochre, dry umber, faded turquoise.
 * Hero prop (3D): the gathering basket and omer measure.  Texture keys: desert_sand, stone_tablets, egypt_mud_brick.
 */

import { THREE, createScene, person, rock, tent } from './moses-kit.js';

const SAND = 0xc49a62, UMBER = 0x6a4a2a, TURQ = 0x6aa8a0, OCHRE = 0xc89038;

function basket(W, parent, x, z, s = 1, filled = 0.6, ry = 0) {
    const g = W.grp(parent, [x, 0, z], { s, r: [0, ry, 0], name: 'basket' });
    W.add(g, W.G('cyl', 1.25, 0.9, 1.0, 9), W.mat(0x8a6a34), [0, 0.5, 0]);
    W.add(g, W.G('tor', 1.25, 0.1, 4, 12), W.mat(0x5a4220), [0, 1.0, 0], { r: [Math.PI / 2, 0, 0] });
    if (filled > 0) W.add(g, W.G('cyl', 1.05, 1.05, 0.12, 9), W.mat(0xfff0cc, { emissive: 0x6a5a30, ei: 0.5 }), [0, 0.45 + filled * 0.5, 0]);
    return g;
}

export function build(group) {
    const W = createScene(group, { seed: 606, bg: 0xf0d6a4, fogNear: 60, fogFar: 220 });

    /* ── light: broad hard morning sun ── */
    W.lights({ sky: 0xfff0d0, gnd: 0xa07a48, hemi: 0.62, sun: 0xffe0a8, sunI: 1.0, sunPos: [-35, 42, 16] });
    W.disc([-50, 44, -160], 9, 0xfff6d8);
    W.disc([-50, 44, -168], 20, 0xffe6a8, 0.35);

    /* ── layered ridges and heat haze (backdrop) ── */
    const ridges = W.grp(group, [0, 0, 0], { name: 'ridges' });
    [[-120, -120, 60, 30, 0xb98a5a], [-30, -130, 70, 38, 0xc09060], [70, -125, 64, 32, 0xb98a5a], [130, -135, 60, 28, 0xc09060],
     [-80, -160, 90, 50, 0xd0a878], [40, -165, 100, 54, 0xd4ac7c], [140, -170, 80, 44, 0xd0a878]].forEach(([x, z, r, h, c]) => W.add(ridges, W.G('cone', r, h, 6), W.mat(c), [x, h / 2 - 2, z], { r: [0, x * 0.02, 0] }));
    [-90, -60, -30].forEach((z, i) => W.add(ridges, W.G('box', 420, 5, 0.4), W.basic(0xfff0d0, 0.1 + i * 0.04), [0, 4 + i * 4, z - 30]));
    const pillar = W.add(ridges, W.G('cyl', 3, 4, 60, 7), W.basic(0xffffff, 0.28), [-78, 30, -105], { name: 'pillar_of_cloud' });
    W.backdrop(ridges);

    /* ── ground ── */
    const gr = W.ground(240, 120, 0, 0, SAND, { amp: 0.9, j: 0.3, flat: 30, seg: 40 });
    W.add(group, W.G('cyl', 22, 24, 0.12, 14), W.mat(0xd2aa72), [0, 0.05, 2], { s: [1.5, 1, 1], name: 'gathering_ground' });
    for (let i = 0; i < 26; i++) {
        const x = W.rr(-70, 70), z = W.rr(-38, 38);
        if (Math.hypot(x, z) < 12 && W.r() < 0.6) continue;
        rock(W, group, x, 0.2, z, 0.4 + W.r() * 1.5, W.pick([0xa0784a, 0xb08858, 0x8a6840]));
    }

    /* ── manna on the ground ── */
    const flakeM = W.mat(0xfff6d8, { emissive: 0x7a6a40, ei: 0.6, rough: 0.6 });
    const flakes = [];
    for (let i = 0; i < 260; i++) {
        const a = W.r() * Math.PI * 2, r = Math.sqrt(W.r()) * 30;
        const m = W.add(group, W.G('cyl', 0.22, 0.22, 0.06, 5), flakeM, [Math.cos(a) * r * 1.35, 0.14, 2 + Math.sin(a) * r * 0.75], { s: [0.6 + W.r(), 1, 0.6 + W.r()], r: [0, W.r() * 3, 0] });
        flakes.push([m, W.r() * 6]);
    }
    W.anim(t => flakes.forEach(([m, ph]) => { m.scale.y = 1 + Math.sin(t * 1.4 + ph) * 0.25; }));

    /* ── camp: goat-hair tents in a loose arc ── */
    [[-42, -22, 1.3, 0.4, 0x4a3628], [-30, -30, 1.5, -0.2, 0x55402f], [-52, -8, 1.2, 0.9, 0x4a3628], [42, -24, 1.4, -0.4, 0x55402f], [30, -32, 1.6, 0.2, 0x4a3628],
     [54, -10, 1.2, -0.9, 0x4a3628], [-16, -38, 1.4, 0, 0x6a4a34], [12, -40, 1.5, 0.1, 0x6a4a34]].forEach(([x, z, s, ry, c]) => {
        const t = tent(W, group, x, 0, z, s, c, ry, { pole: true });
        W.add(t, W.G('box', 5.2, 0.35, 0.3), W.mat(TURQ), [0, 2.2, 1.5], { r: [0.4, 0, 0] });       // turquoise trim on the flap
    });
    for (let i = 0; i < 4; i++) W.add(group, W.G('cyl', 0.5, 0.7, 1.4, 6), W.mat(0x8a6a44), [-58 + i * 3.4, 0.7, -2 + (i % 2) * 2]);    // water jars

    /* ── hero prop: the gathering basket, covered basket, and omer measure ── */
    const hero = W.grp(group, [0, 0, 3], { name: 'gathering_basket_and_omer' });
    basket(W, hero, 0, 0, 1.25, 0.7);
    const cover = W.grp(hero, [-4.4, 0, 1.2], { name: 'covered_basket' });
    W.add(cover, W.G('cyl', 1.25, 0.9, 1.0, 9), W.mat(0x8a6a34), [0, 0.5, 0]);
    W.add(cover, W.G('cyl', 1.4, 1.4, 0.16, 9), W.mat(TURQ), [0, 1.15, 0]);
    W.add(cover, W.G('cone', 1.3, 0.5, 9), W.mat(TURQ), [0, 1.5, 0]);
    const omer = W.grp(hero, [4.0, 0, 0.6], { name: 'omer_measure' });
    W.add(omer, W.G('cyl', 0.7, 0.55, 1.6, 8), W.mat(0xb07a3a, { metal: 0.25, rough: 0.6 }), [0, 0.8, 0]);
    W.add(omer, W.G('tor', 0.72, 0.09, 4, 10), W.mat(0x8a5a26), [0, 1.6, 0], { r: [Math.PI / 2, 0, 0] });
    W.add(omer, W.G('tor', 0.4, 0.08, 4, 8), W.mat(0x8a5a26), [0.85, 1.0, 0]);
    W.add(omer, W.G('cyl', 0.6, 0.6, 0.1, 8), W.mat(0xfff0cc, { emissive: 0x6a5a30, ei: 0.5 }), [0, 1.52, 0]);     // exactly full
    const jar = W.grp(hero, [7.2, 0, -0.6], { name: 'manna_jar' });
    W.add(jar, W.G('sph', 1, 7, 5), W.mat(0x9a6a3a), [0, 1.0, 0], { s: [0.9, 1.1, 0.9] });
    W.add(jar, W.G('cyl', 0.45, 0.6, 0.5, 7), W.mat(0x9a6a3a), [0, 2.2, 0]);
    W.add(jar, W.G('tor', 0.92, 0.06, 4, 10), W.mat(TURQ), [0, 1.2, 0], { r: [Math.PI / 2, 0, 0], s: [1, 1, 1] });

    /* ── gatherers, bending to the ground ── */
    const robes = [0x8a6a44, 0x9a5a3a, TURQ, 0xb89a60, 0x7a4a3a, 0xc8b890];
    [[-10, 7, 0.4], [-6.5, 9.5, -0.2], [-1, 10.4, 0.1], [5.4, 9.2, 0.2], [9.6, 7.2, -0.3], [13, 4, -0.6], [-14, 3, 0.6], [-16.5, 9, 0.3]].forEach(([x, z, ry], i) => {
        person(W, group, [x, 0, z], {
            name: 'gatherer', robe: W.pick(robes), sash: 0x4a3020, head: i % 2 ? 'wrap' : 'hair', wrap: W.pick([0xe8d8b0, TURQ, 0xc8a070]), wrapTrim: 0x9a3a2a, hair: 0x2a1a10,
            ry: ry, s: i % 4 === 3 ? 0.75 : 1.12, bend: i % 4 === 3 ? 0.5 : 0.85, armL: [-1.5, -0.2], armR: [-1.5, 0.2], skin: W.pick([0xc68e5a, 0xb07a48, 0xd8a070])
        });
        basket(W, group, x + Math.sin(ry) * 2.6 + 0.6, z + 2.4, 0.7, 0.3, ry);
    });
    person(W, group, [-3.5, 0, -6.5], { name: 'elder_with_jar', robe: 0x7a6a58, cloak: 0x4a4038, head: 'hood', wrap: 0x4a4038, ry: 0.4, s: 1.1, staff: 'planted' });
    person(W, group, [8.6, 0, -4.4], {
        name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xc8c0b0, beard: 'long', ry: -1.15, s: 1.35,
        staff: 'planted', staffH: 5.6, skin: 0xc08450
    });
    person(W, group, [13.4, 0, -6.6], { name: 'aaron', robe: 0xeee6d2, sash: 0x2a4aa0, head: 'wrap', wrap: 0xf0ecdc, wrapTrim: OCHRE, ry: -1.0, s: 1.2 });

    /* ── quail overhead and underfoot ── */
    const birds = [];
    const quail = (parent, brown) => {
        const q = W.grp(parent, [0, 0, 0]);
        W.add(q, W.G('ico', 0.6, 0), W.mat(brown), [0, 0, 0], { s: [1.4, 0.9, 0.9] });
        W.add(q, W.G('sph', 0.28, 5, 4), W.mat(0x5a4028), [0.8, 0.25, 0]);
        W.add(q, W.G('cone', 0.08, 0.3, 3), W.mat(0xd8a040), [1.1, 0.25, 0], { r: [0, 0, -Math.PI / 2] });
        const wl = W.add(q, W.G('box', 0.15, 0.05, 1.3), W.mat(0x8a6a48), [-0.1, 0.2, 0.75]);
        const wr = W.add(q, W.G('box', 0.15, 0.05, 1.3), W.mat(0x8a6a48), [-0.1, 0.2, -0.75]);
        return { q, wl, wr };
    };
    for (let i = 0; i < 9; i++) {
        const b = quail(group, W.pick([0x9a7a50, 0x8a6a44, 0xa88858]));
        b.q.scale.setScalar(1.3);
        birds.push([b, W.rr(-40, 30), W.rr(14, 26), W.rr(-16, 6), W.rr(2, 4), W.r() * 6]);
        W.backdrop(b.q);
    }
    W.anim(t => birds.forEach(([b, x, y, z, v, ph]) => {
        const xx = ((x + 60 + t * v) % 120) - 60;
        b.q.position.set(xx, y + Math.sin(t * 2 + ph) * 0.6, z);
        b.wl.rotation.x = Math.sin(t * 14 + ph) * 0.8; b.wr.rotation.x = -Math.sin(t * 14 + ph) * 0.8;
    }));
    [[-18, -4], [16, 10], [-22, 12], [22, -2], [2, -12]].forEach(([x, z]) => { const b = quail(group, 0x9a7a50); b.q.position.set(x, 0.55, z); b.q.rotation.y = W.r() * 6; b.wl.visible = b.wr.visible = false; });

    return W.finish();
}

export default { build };
