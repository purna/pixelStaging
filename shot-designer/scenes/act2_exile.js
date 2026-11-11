/**
 * Act 2 – The Burning Bush
 * Horeb at dusk: a thorn bush wrapped in living flame that does not consume it, Moses in profile with
 * his staff planted and sandals set aside on holy ground, sheep drifting at the edge of the firelight.
 * Palette: charcoal, ember red, burnt orange, covenant gold.
 * Hero prop (3D): the burning bush.  Texture keys: hammered_gold, stone_tablets, nile_reeds.
 */

import { THREE, createScene, person, rock, sheep } from './moses-kit.js';

export function build(group) {
    const W = createScene(group, { seed: 202, bg: 0x140e0c, fogNear: 45, fogFar: 175 });

    /* ── light: hard fire key, cool fill ── */
    W.lights({ sky: 0x4a3a48, gnd: 0x1e0e06, hemi: 0.55, sun: 0x6a7aa8, sunI: 0.45, sunPos: [-30, 30, 20] });
    W.point(0xff7a30, 2.6, 80, 0, 6, -2, 0.12);
    W.point(0xffc860, 1.2, 40, 0, 10, 2, 0.18);

    /* ── sky & horizon ── */
    W.stars(70, 150, [0xc8c0d8, 0xffe0b0], 0.7);
    W.disc([30, 16, -150], 34, 0x8a3a1c, 0.35);
    const ridges = W.grp(group, [0, 0, 0], { name: 'horeb_ridges' });
    [[-70, -130, 70, 46, 0x1e1412], [55, -125, 80, 38, 0x231714], [-10, -150, 90, 30, 0x2a1a14], [110, -140, 60, 34, 0x1e1412], [-120, -140, 50, 30, 0x231714]].forEach(([x, z, r, h, c]) => {
        W.add(ridges, W.G('cone', r, h, 5), W.mat(c), [x, h / 2 - 2, z], { r: [0, x * 0.03, 0] });
    });
    W.backdrop(ridges);

    /* ── ground ── */
    const gr = W.ground(240, 120, 0, 0, 0x4a3426, { amp: 0.8, j: 0.35, flat: 26, seg: 40 });
    W.add(group, W.G('cyl', 13, 14, 0.25, 12), W.mat(0x6a4630), [0, 0.05, -2], { name: 'holy_ground' });   // the cleared circle
    for (let i = 0; i < 16; i++) {        // ring of holy-ground stones
        const a = (i / 16) * Math.PI * 2;
        rock(W, group, Math.cos(a) * 13.2, 0.3, -2 + Math.sin(a) * 13.2, 0.75 + W.r() * 0.4, W.pick([0x7a5a40, 0x8a6a4a, 0x6a4c36]), { sy: 0.6 });
    }
    for (let i = 0; i < 40; i++) {
        const x = W.rr(-70, 70), z = W.rr(-40, 40);
        if (Math.hypot(x, z) < 16) continue;
        if (W.r() < 0.6) rock(W, group, x, 0.2, z, 0.5 + W.r() * 1.6, W.pick([0x3a2a20, 0x4a3426, 0x5a4030]));
        else W.add(group, W.G('cone', 0.5, 1.4, 4), W.mat(0x4a3a20), [x, 0.6, z], { s: [1 + W.r(), 1, 1 + W.r()] });      // dry scrub
    }

    /* ── the bush (hero prop) ── */
    const bush = W.grp(group, [0, 0, -2], { name: 'burning_bush' });
    const wood = W.mat(0x3a2414), wood2 = W.mat(0x4a3018);
    [[-0.9, 0.3], [0.8, -0.4], [0, 0.9]].forEach(([x, z], i) => W.add(bush, W.G('cyl', 0.35, 0.6, 3.6, 5), i ? wood : wood2, [x, 1.7, z], { r: [z * 0.2, 0, -x * 0.25] }));
    for (let i = 0; i < 46; i++) {       // thorny branches radiating outward
        const a = W.r() * Math.PI * 2, tilt = 0.35 + W.r() * 1.0, len = 4 + W.r() * 4.5;
        const b = W.grp(bush, [0, 3, 0], { r: [0, a, tilt] });
        W.add(b, W.G('cone', 0.16, len, 3), W.pick([wood, wood2]), [0, len / 2, 0]);
    }
    const flames = [];
    // (flames near the top of the bush are kept in framing bounds; glow/smoke/embers are not)
    for (let i = 0; i < 26; i++) {       // flames living in the branches
        const a = W.r() * Math.PI * 2, rad = W.r() * 4.4, h = 3.5 + W.r() * 5;
        const s = 0.9 + W.r() * 1.3;
        const f = W.grp(bush, [Math.cos(a) * rad, h, Math.sin(a) * rad], { s });
        W.add(f, W.G('cone', 0.9, 2.8, 5), W.basic(W.pick([0xff5a18, 0xff7a20, 0xff9a28]), 0.88), [0, 1.4, 0], { r: [0, W.r() * 3, 0] });
        W.add(f, W.G('cone', 0.55, 1.9, 4), W.basic(W.pick([0xffc040, 0xffd860]), 0.95), [0.05, 1.0, 0]);
        flames.push([f, s, W.r() * 10]);
    }
    const core = W.add(bush, W.G('ico', 4.2, 1), W.basic(0xffd860, 0.18), [0, 7, 0], { s: [1, 1.5, 1], name: 'glory_glow' });
    W.backdrop(W.add(bush, W.G('ico', 7.2, 1), W.basic(0xff9a30, 0.12), [0, 7, 0], { s: [1, 1.3, 1], name: 'halo' }));
    W.backdrop(W.add(bush, W.G('cone', 2.4, 13, 6), W.basic(0xfff0a0, 0.22), [0, 10.5, 0]));
    W.backdrop(core);
    W.anim(t => {
        flames.forEach(([f, s, ph]) => f.scale.set(s * (1 + Math.sin(t * 8 + ph) * 0.07), s * (1 + Math.sin(t * 5.3 + ph) * 0.2), s * (1 + Math.cos(t * 7 + ph) * 0.07)));
        core.scale.set(1 + Math.sin(t * 2) * 0.05, 1.5 + Math.sin(t * 2.6) * 0.1, 1 + Math.sin(t * 2) * 0.05);
    });

    // smoke curls (thin, high, slow)
    [[2, 17, -3, 3.2], [-2.5, 21, -5, 3.6], [3.5, 25, -2, 3.8], [-1, 29, -6, 4.2]].forEach(([x, y, z, s]) => W.backdrop(W.add(group, W.G('ico', 1, 1), W.mat(0x3a2a26, { opacity: 0.4 }), [x, y, z], { s: [s, s * 0.6, s] })));

    // embers rising
    const embers = [];
    for (let i = 0; i < 60; i++) {
        const m = W.backdrop(W.add(group, W.G('oct', 0.16), W.basic(W.pick([0xff9a30, 0xffc850, 0xff6a20]), 0.95), [0, 0, 0]));
        embers.push([m, W.rr(-9, 9), W.rr(-9, 7), W.rr(0, 26), W.rr(1.4, 3.2), W.r() * 6]);
    }
    W.anim(t => embers.forEach(([m, x, z, y0, v, ph]) => {
        const y = (y0 + t * v) % 26;
        m.position.set(x * (0.5 + y / 40) + Math.sin(t + ph) * 0.8, 2 + y, z + Math.cos(t * 0.7 + ph) * 0.8);
    }));

    /* ── Moses in profile, staff planted; sandals set aside ── */
    person(W, group, [-8.6, 0.05, 8.2], {
        name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x4f3e2c, head: 'wrap', wrap: 0xb89a60, wrapTrim: 0x7a4a20, ry: 1.35, s: 1.25,
        staff: 'planted', staffH: 5.4, skin: 0xc08450
    });
    [[-5.6, 9.6, 0.4], [-4.8, 9.0, -0.3]].forEach(([x, z, r]) => {       // sandals
        W.add(group, W.G('box', 0.7, 0.12, 1.3), W.mat(0x5a3a20), [x, 0.12, z], { r: [0, r, 0] });
        W.add(group, W.G('box', 0.6, 0.1, 0.14), W.mat(0x3a2414), [x, 0.22, z], { r: [0, r, 0] });
    });

    /* ── the flock ── */
    [[-22, 10, 0.3], [-17, 15, 2.2], [-26, 4, 1.4], [16, 13, 4.0], [21, 8, 3.2], [25, 15, 5.0], [12, 20, 3.7], [-13, 21, 0.9], [30, 3, 2.6]].forEach(([x, z, ry]) => sheep(W, group, x, 0, z, ry, 1.0 + W.r() * 0.2));

    return W.finish();
}

export default { build };
