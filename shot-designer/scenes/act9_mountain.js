/**
 * Act 7 – Sinai
 * Night at the mountain: a gold-lit cloud and cyan lightning crown the peak, the camp stands in ordered
 * tribal rows, twelve pillars ring an altar of uncut stones, and the two tablets glow on a rock before
 * Moses beside the resting Ark. Palette: midnight violet, ultramarine, pale cyan, star gold.
 * Hero prop (3D): the tablets (and the Ark).  Texture keys: hammered_gold, stone_tablets, egypt_mud_brick.
 */

import { THREE, createScene, person, rock, tent, crowd } from './moses-kit.js';

const GOLD = 0xffd860, CYAN = 0x9ae0f0;

export function build(group) {
    const W = createScene(group, { seed: 707, bg: 0x0e0828, fogNear: 55, fogFar: 210 });
    const goldM = W.mat(0xe0b040, { metal: 0.55, rough: 0.4 });

    /* ── light ── */
    W.lights({ sky: 0x5a4ab0, gnd: 0x1a1040, hemi: 0.6, sun: CYAN, sunI: 0.6, sunPos: [-30, 50, 34] });
    const glory = W.point(0xffd060, 3.0, 140, 0, 46, -58, 0.12);
    W.point(0xffd060, 1.8, 34, 0, 7, -3, 0.06);
    W.stars(200, 160, [GOLD, CYAN, 0xffffff, 0xc8b8ff], 1.0);

    /* ── the mountain (backdrop) ── */
    const mtn = W.grp(group, [0, 0, -75], { name: 'sinai' });
    [[0, 0, 60, 76, 0x2a1a48], [-46, 8, 40, 50, 0x34205a], [44, 6, 42, 56, 0x2e1c4e], [-80, 14, 34, 34, 0x261840], [84, 14, 34, 38, 0x261840], [16, -16, 30, 46, 0x3a2a66]].forEach(([x, z, r, h, c], i) => {
        W.add(mtn, W.G('cone', r, h, 6), W.mat(c), [x, h / 2 - 2, z], { r: [0, i * 0.7, 0] });
    });
    // gold cloud cap and thunderheads
    const cap = W.grp(mtn, [0, 72, 4], { name: 'glory_cloud' });
    W.add(cap, W.G('ico', 22, 1), W.basic(GOLD, 0.26), [0, 0, 0], { s: [1.5, 0.8, 1] });
    W.add(cap, W.G('ico', 14, 1), W.basic(0xfff0b0, 0.4), [0, 2, 4], { s: [1.4, 0.8, 1] });
    W.add(cap, W.G('cone', 26, 90, 6), W.basic(GOLD, 0.06), [0, -40, 0]);
    [[-36, 66, 8, 18], [34, 70, 4, 20], [-14, 88, -4, 16], [20, 90, -2, 18], [-56, 54, 10, 14]].forEach(([x, y, z, s]) => W.add(mtn, W.G('ico', 1, 1), W.mat(0x3a2a6a, { opacity: 0.88, emissive: 0x1a1040, ei: 0.6 }), [x, y, z], { s: [s * 1.5, s * 0.7, s] }));
    // lightning bolts (flicker)
    const bolts = [];
    [[-30, 80, 14, -0.15], [26, 82, 12, 0.2], [2, 74, 18, 0.05], [-52, 62, 16, -0.3]].forEach(([x, y, z, tilt]) => {
        const b = W.grp(mtn, [x, y, z], { r: [0, 0, tilt] });
        let px = 0, py = 0;
        for (let i = 0; i < 6; i++) {
            const dx = (i % 2 ? 1 : -1) * (2.2 + W.r() * 2), dy = -7 - W.r() * 3;
            const len = Math.hypot(dx, dy);
            W.add(b, W.G('box', 0.7, len, 0.7), W.basic(CYAN, 0.95), [px + dx / 2, py + dy / 2, 0], { r: [0, 0, Math.atan2(dx, -dy) * -1 + Math.PI] });
            px += dx; py += dy;
        }
        bolts.push(b);
    });
    W.anim(t => {
        bolts.forEach((b, i) => { b.visible = Math.sin(t * 3.1 + i * 2.3) + Math.sin(t * 7.7 + i) > 1.05; });
        glory.intensity = 3.0 * (1 + Math.sin(t * 1.3) * 0.12);
    });
    W.backdrop(mtn);

    /* ── ground ── */
    W.ground(240, 130, 0, -4, 0x24184a, { amp: 0.7, j: 0.3, flat: 30, seg: 40 });
    W.add(group, W.G('cyl', 18, 20, 0.14, 14), W.mat(0x3a2a6a), [0, 0.06, -3], { s: [1.5, 1, 1], name: 'gathering_circle' });

    /* ── boundary stakes at the mountain's foot ── */
    for (let i = 0; i < 26; i++) {
        const x = -62 + i * 4.8;
        W.add(group, W.G('cyl', 0.12, 0.16, 2.2, 4), W.mat(0x6a5a8a), [x, 1.1, -34]);
        if (i) W.add(group, W.G('box', 4.8, 0.06, 0.06), W.mat(0xc8b8ff, { emissive: 0x4a3a8a, ei: 0.6 }), [x - 2.4, 1.9, -34]);
    }

    /* ── ordered tribal camp with banner poles ── */
    const banners = [0xc4462b, 0x2a6aa0, 0x3a8a5a, 0xc8a030, 0x8a3a8a, 0x2a8a8a];
    [-1, 1].forEach(side => {
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const x = side * (36 + col * 10), z = -18 + row * -9 - 2;
            const t = tent(W, group, x, 0, z, 1.0, 0x2a2450, side * 0.15, { door: 0x0c0818 });
            if (col === 1 && row === 1) {
                W.add(t, W.G('cyl', 0.07, 0.07, 6, 4), W.mat(0x5a4a3a), [0, 5.5, 0]);
                W.add(t, W.G('cone', 0.9, 1.8, 3), W.mat(banners[(row + col + (side > 0 ? 3 : 0)) % 6]), [0.9, 7.6, 0], { r: [0, 0, -Math.PI / 2] });
            }
            if (row === 0) W.add(group, W.G('ico', 0.4, 0), W.basic(0xffb850, 0.9), [x + 1.2, 0.5, z + 3.2]);     // campfire embers
        }
    });

    /* ── altar of uncut stones and the twelve pillars ── */
    const altar = W.grp(group, [-16, 0, -10], { name: 'altar_of_uncut_stones' });
    for (let i = 0; i < 9; i++) rock(W, altar, (i % 3 - 1) * 1.7 + W.rr(-0.3, 0.3), 0.6 + Math.floor(i / 3) * 0.9, W.rr(-1.2, 1.2), 1.25 - Math.floor(i / 3) * 0.2, W.pick([0x6a5a8a, 0x5a4a7a, 0x7a6a9a]), { sy: 0.8 });
    W.add(altar, W.G('cone', 0.8, 1.8, 5), W.basic(0xff9a30, 0.9), [0, 3.4, 0]);
    W.point(0xff9a40, 1.2, 28, -16, 5, -10, 0.25);
    for (let i = 0; i < 12; i++) {
        const a = -Math.PI * 0.95 + (i / 11) * Math.PI * 0.9;
        W.add(altar, W.G('box', 0.9, 3 + W.r() * 0.6, 0.8), W.mat(0x7a6a9a), [Math.cos(a) * 9, 1.6, Math.sin(a) * 7 - 2], { r: [0, -a, (W.r() - 0.5) * 0.08] });
    }

    /* ── hero: the tablets on their rock, glowing ── */
    const rockBase = W.grp(group, [0, 0, -4], { name: 'tablet_rock' });
    rock(W, rockBase, 0, 0.9, 0, 2.4, 0x5a4a7a, { sy: 0.65 });
    const tabs = W.grp(rockBase, [0, 2.0, 0.2], { name: 'tablets' });
    [-1, 1].forEach(sx => {
        const t = W.grp(tabs, [sx * 1.25, 0, 0], { r: [0, sx * -0.12, sx * 0.03] });
        W.add(t, W.G('box', 2.2, 3.4, 0.45), W.mat(0xd4c8b0, { emissive: 0x3a3020, ei: 0.5 }), [0, 1.7, 0]);
        W.add(t, W.G('cyl', 1.1, 1.1, 0.45, 8), W.mat(0xd4c8b0, { emissive: 0x3a3020, ei: 0.5 }), [0, 3.4, 0], { r: [Math.PI / 2, 0, 0] });
        for (let i = 0; i < 5; i++) W.add(t, W.G('box', 1.4 - (i % 2) * 0.3, 0.14, 0.1), W.basic(GOLD, 0.95), [0, 0.6 + i * 0.6, 0.26]);    // glowing inscription lines
    });
    const halo = W.add(tabs, W.G('ico', 3.6, 1), W.basic(GOLD, 0.16), [0, 2.4, 0]);
    W.backdrop(halo);
    W.anim(t => { halo.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06); tabs.position.y = 2.0 + Math.sin(t * 1.1) * 0.05; });

    /* ── Moses and the elders ── */
    person(W, group, [-4.8, 0, 0], { name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xd0c8b8, beard: 'long', ry: 0.75, s: 1.4, armR: [-1.2, 0.25], armL: [-0.9, -0.3], skin: 0xc08450 });
    person(W, group, [5.4, 0, -0.6], { name: 'aaron', robe: 0xeee6d2, sash: 0x2a4aa0, collar: 0xe0b040, head: 'wrap', wrap: 0xf0ecdc, wrapTrim: 0xe0b040, ry: -0.75, s: 1.25, staff: 'planted' });
    person(W, group, [-9, 0, 3.4], { name: 'joshua', robe: 0x6a7a8a, sash: 0x3a4a5a, head: 'hair', hair: 0x2a1a10, ry: 0.5, s: 1.15 });
    [[-2, 7], [3, 8], [8, 6.4], [-7, 8.6]].forEach(([x, z], i) => person(W, group, [x, 0, z], { name: 'elder', robe: W.pick([0x7a6a58, 0x8a7a6a, 0x9a8a78]), cloak: 0x4a4038, head: 'hair', hair: 0xd0c8b8, beard: 'short', ry: Math.PI + W.rr(-0.4, 0.4), s: 1.1 }));

    /* ── the Ark at rest, with its poles ── */
    const ark = W.grp(group, [13, 0, 4], { name: 'ark_of_the_covenant', r: [0, -0.5, 0] });
    W.add(ark, W.G('box', 5.6, 0.4, 3.6), W.mat(0x6a5a8a), [0, 0.2, 0]);
    W.add(ark, W.G('box', 4.6, 2.3, 2.6), goldM, [0, 1.55, 0]);
    W.add(ark, W.G('box', 4.9, 0.35, 2.9), goldM, [0, 2.85, 0]);
    [-1, 1].forEach(sx => {
        W.add(ark, W.G('box', 0.5, 1.6, 0.5), goldM, [sx * 1.3, 3.8, 0]);
        W.add(ark, W.G('sph', 0.36, 5, 4), W.mat(0xd8a060), [sx * 1.3, 4.8, 0]);
        W.add(ark, W.G('box', 0.15, 1.2, 1.9), goldM, [sx * 1.3 - sx * 0.3, 4.2, 0.0], { r: [0, 0, sx * -0.5] });
    });
    [-1, 1].forEach(sz => W.add(ark, W.G('cyl', 0.14, 0.14, 7.4, 5), W.mat(0x5a3818), [0, 1.0, sz * 1.5], { r: [0, 0, Math.PI / 2] }));
    W.point(0xffd060, 0.9, 20, 13, 5, 4);

    /* ── the congregation, bowed toward the mountain ── */
    crowd(W, group, -22, 12, 14, 18, 8, [0x6a7a8a, 0x8a6a44, 0x7a4a3a, 0x4a6a7a, 0xa8854a], { ry: Math.PI, s: 1.05, packs: 0.1, staves: 0.2 });
    crowd(W, group, 22, 12, 14, 18, 8, [0x6a7a8a, 0x8a6a44, 0x7a4a3a, 0x4a6a7a, 0xa8854a], { ry: Math.PI, s: 1.05, packs: 0.1, staves: 0.2 });
    crowd(W, group, 0, 20, 10, 14, 6, [0x8a6a44, 0x9a5a3a, 0xb89a60], { ry: Math.PI, s: 1.05, packs: 0.1, staves: 0.2 });

    return W.finish();
}

export default { build };
