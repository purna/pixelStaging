/**
 * Act 4 – Passover Night
 * A quiet Israelite street under a dim moon. The hero doorway is marked on lintel and posts with
 * hyssop and blood while lamplight glows inside; a family stands ready, sandals on, staves in hand,
 * beside a basket of unleavened bread. Palette: near-black blue, cool slate, lamp amber, muted earth.
 * Hero prop (3D): the marked doorway.  Texture keys: bulrush_basket, hammered_gold, stone_tablets.
 */

import { THREE, createScene, person, rock, flame } from './moses-kit.js';

const BRICK = [0x5a4a3c, 0x65533f, 0x50443a];
const BLOOD = 0x9a1818;

function house(W, parent, x, z, w, h, opts = {}) {
    const g = W.grp(parent, [x, 0, z], { name: opts.name || 'house', r: [0, opts.ry || 0, 0] });
    const dw = 5.6, dh = 7.6;
    const sideW = (w - dw) / 2;
    [-1, 1].forEach(sx => {
        for (let row = 0; row < Math.ceil(h / 1.4); row++) {
            W.add(g, W.G('box', sideW, 1.36, 3), W.mat(BRICK[(row + (sx > 0 ? 1 : 0)) % 3]), [sx * (dw / 2 + sideW / 2), 0.7 + row * 1.4, 0]);
        }
    });
    for (let row = Math.floor(dh / 1.4); row < Math.ceil(h / 1.4); row++) W.add(g, W.G('box', dw, 1.36, 3), W.mat(BRICK[row % 3]), [0, 0.7 + row * 1.4, 0]);
    W.add(g, W.G('box', w + 1, 0.7, 3.6), W.mat(0x3e3228), [0, h + 0.35, 0]);       // flat roof lip
    W.add(g, W.G('box', dw - 0.2, dh - 0.4, 0.4), W.basic(opts.lit === false ? 0x120c08 : 0xffb850, opts.lit === false ? 1 : 0.92), [0, dh / 2 - 0.2, 0.1], { name: 'lamp_glow' });
    const post = W.mat(0x4a3020);
    [-1, 1].forEach(sx => W.add(g, W.G('box', 0.6, dh + 0.2, 0.8), post, [sx * (dw / 2 + 0.05), dh / 2, 1.3]));
    W.add(g, W.G('box', dw + 1.4, 0.7, 0.9), post, [0, dh + 0.3, 1.3]);
    if (opts.marked !== false) {       // blood on lintel and both posts
        const b = W.mat(BLOOD, { emissive: 0x3a0606, ei: 0.8, rough: 0.4 });
        W.add(g, W.G('box', dw + 1.2, 0.3, 0.14), b, [0, dh + 0.3, 1.79]);
        [-1, 1].forEach(sx => {
            W.add(g, W.G('box', 0.26, dh * 0.6, 0.14), b, [sx * (dw / 2 + 0.05), dh * 0.6, 1.76]);
            W.add(g, W.G('cone', 0.16, 0.6, 4), b, [sx * (dw / 2 + 0.05), dh * 0.3 - 0.2, 1.78], { r: [Math.PI, 0, 0] });
        });
    }
    return g;
}

export function build(group) {
    const W = createScene(group, { seed: 404, bg: 0x070b16, fogNear: 38, fogFar: 160 });

    /* ── light: faint moon, amber lamp spill ── */
    W.lights({ sky: 0x2e3e5c, gnd: 0x161a22, hemi: 0.55, sun: 0x7a90b8, sunI: 0.42, sunPos: [-40, 34, 20] });
    const lamp = W.point(0xffb050, 2.4, 55, 0, 5, 1, 0.08);
    W.point(0xffb050, 1.0, 40, 0, 7, -5);

    /* ── sky ── */
    W.stars(120, 150, [0xc8d4f0, 0xfff0d0, 0x9ab0d8], 0.85);
    W.disc([-60, 42, -150], 6, 0xc8d4e8);
    const clouds = W.grp(group, [0, 0, 0], { name: 'clouds' });
    [[-40, 30, -120, 22], [30, 36, -130, 26], [90, 28, -125, 20]].forEach(([x, y, z, s]) => W.add(clouds, W.G('ico', 1, 1), W.mat(0x141c30, { opacity: 0.85 }), [x, y, z], { s: [s, s * 0.22, s * 0.5] }));
    W.backdrop(clouds);

    /* ── street ── */
    W.ground(200, 110, 0, 0, 0x3a342c, { amp: 0.35, j: 0.22, flat: 30, seg: 34 });
    W.add(group, W.G('box', 16, 0.06, 90), W.mat(0x4a4236), [0, 0.04, 0], { name: 'path' });

    /* ── the marked doorway (hero) ── */
    const hero = house(W, group, 0, -8, 26, 12, { name: 'marked_doorway' });
    // threshold stone and bowl of blood with hyssop
    W.add(group, W.G('box', 7.4, 0.35, 2.6), W.mat(0x6a6258), [0, 0.18, -5.6]);
    const bowl = W.grp(group, [-5.2, 0, -4], { name: 'hyssop_bowl' });
    W.add(bowl, W.G('cyl', 0.95, 0.6, 0.7, 8), W.mat(0x3a2a20), [0, 0.35, 0]);
    W.add(bowl, W.G('cyl', 0.8, 0.8, 0.06, 8), W.mat(BLOOD, { emissive: 0x3a0606, ei: 0.8, rough: 0.3 }), [0, 0.68, 0]);
    for (let i = 0; i < 9; i++) W.add(bowl, W.G('cone', 0.06, 2.2 + W.r() * 0.6, 3), W.mat(i % 2 ? 0x4a7a3a : 0x5a8a44), [(W.r() - 0.5) * 0.4, 1.6, (W.r() - 0.5) * 0.3], { r: [(W.r() - 0.5) * 0.5, 0, (W.r() - 0.5) * 0.5] });
    W.anim(t => { lamp.intensity = 2.4 + Math.sin(t * 4) * 0.12 + Math.sin(t * 9.3) * 0.08; });

    /* ── neighbouring houses: each marked, deeper in shadow ── */
    house(W, group, -34, -12, 24, 10, { name: 'house_left', ry: 0.25 });
    house(W, group, 34, -12, 24, 10, { name: 'house_right', ry: -0.25 });
    [[-62, -26], [62, -26], [-88, -40], [88, -40]].forEach(([x, z], i) => W.backdrop(house(W, group, x, z, 22, 9, { name: 'house_far', ry: x < 0 ? 0.4 : -0.4, lit: i % 2 === 0 })));

    // far rooftops (Egyptian town, unlit silhouettes)
    const far = W.grp(group, [0, 0, 0], { name: 'rooftops' });
    for (let i = 0; i < 22; i++) {
        const w = 8 + W.r() * 10, h = 5 + W.r() * 7;
        W.add(far, W.G('box', w, h, 6), W.mat(W.pick([0x141a26, 0x1a2030, 0x10161f])), [-110 + i * 10.5 + W.r() * 3, h / 2, -72 - W.r() * 12]);
        if (W.r() < 0.3) W.add(far, W.G('box', 0.9, 1.2, 0.2), W.basic(0xffb850, 0.8), [-110 + i * 10.5, h * 0.6, -68.8]);
    }
    W.backdrop(far);

    /* ── supper: table with bread basket and bitter herbs ── */
    const table = W.grp(group, [12, 0, -1.5], { name: 'supper_table' });
    W.add(table, W.G('box', 6.4, 0.4, 3.2), W.mat(0x5a4028), [0, 2.0, 0]);
    [[-2.8, -1.3], [2.8, -1.3], [-2.8, 1.3], [2.8, 1.3]].forEach(([x, z]) => W.add(table, W.G('cyl', 0.2, 0.24, 2, 4), W.mat(0x3e2c1c), [x, 1, z]));
    const basket = W.grp(table, [-1.3, 2.2, 0], { name: 'unleavened_bread_basket' });
    W.add(basket, W.G('cyl', 1.3, 0.95, 0.9, 9), W.mat(0x8a6a34), [0, 0.45, 0]);
    for (let i = 0; i < 4; i++) W.add(basket, W.G('cyl', 0.95, 0.95, 0.09, 9), W.mat(0xd8b070), [(i % 2 - 0.5) * 0.3, 0.98 + i * 0.1, (i - 1.5) * 0.12]);
    W.add(table, W.G('cyl', 0.7, 0.6, 0.25, 7), W.mat(0x6a5a48), [1.8, 2.3, 0.3]);       // bitter-herb dish
    for (let i = 0; i < 8; i++) W.add(table, W.G('cone', 0.12, 0.7, 3), W.mat(0x5a8a3a), [1.8 + (W.r() - 0.5) * 0.7, 2.6, 0.3 + (W.r() - 0.5) * 0.5], { r: [W.r() - 0.5, 0, W.r() - 0.5] });
    W.add(table, W.G('sph', 0.7, 6, 4), W.mat(0xd8c8a0), [0.4, 2.4, -0.5], { s: [1.5, 0.7, 0.8] });   // roast lamb, simply
    W.add(group, W.G('cyl', 0.1, 0.12, 0.8, 5), W.mat(0x3a3028), [9.8, 0.4, -5]);       // spit post
    flame(W, group, 9.8, 0.0, -5, 0.45);

    /* ── the family, ready to leave ── */
    person(W, group, [-8.5, 0, 3.6], { name: 'father', robe: 0x8a6a44, sash: 0x4a3020, cloak: 0x5a4a38, head: 'hair', hair: 0x2a1a10, beard: 'short', ry: 0.5, s: 1.2, staff: 'planted', staffH: 5 });
    person(W, group, [-4.4, 0, 6.4], { name: 'mother', robe: 0x9a5a3a, sash: 0xd8b070, head: 'wrap', wrap: 0xe0d0b0, wrapTrim: 0x9a3a2a, ry: 0.15, s: 1.1 });
    person(W, group, [-6.6, 0, 7.6], { name: 'child', robe: 0xb89a60, head: 'hair', hair: 0x2a1a10, ry: 0.3, s: 0.62 });
    person(W, group, [1.4, 0, 7.6], { name: 'child', robe: 0x6a7a8a, head: 'hair', hair: 0x3a2418, ry: -0.3, s: 0.7 });
    person(W, group, [6.2, 0, 4.4], { name: 'elder', robe: 0x7a6a58, cloak: 0x4a4038, head: 'hood', wrap: 0x4a4038, ry: -0.5, s: 1.15, staff: 'planted' });
    // travel packs and sandals already by the door
    [[-2.2, 2.4], [-0.8, 3.0]].forEach(([x, z], i) => W.add(group, W.G('box', 1.8, 1.3, 1.2), W.mat(i ? 0x6a4a30 : 0x4a5a6a), [x, 0.65, z], { r: [0, 0.5 + i, 0] }));
    rock(W, group, 18, 0, 10, 1.2, 0x3a342c);
    rock(W, group, -20, 0, 12, 1.0, 0x3a342c);

    /* ── drifting dust motes in the lamp spill ── */
    const motes = [];
    for (let i = 0; i < 34; i++) {
        const m = W.backdrop(W.add(group, W.G('oct', 0.07), W.basic(0xffd890, 0.8), [0, 0, 0]));
        motes.push([m, W.rr(-9, 9), W.rr(1, 11), W.rr(-2, 4), W.r() * 6]);
    }
    W.anim(t => motes.forEach(([m, x, y, z, ph]) => m.position.set(x + Math.sin(t * 0.4 + ph) * 0.8, y + Math.sin(t * 0.3 + ph * 2) * 0.5, z + Math.cos(t * 0.35 + ph) * 0.8)));

    return W.finish();
}

export default { build };
