/**
 * Act 8 – The Golden Calf
 * A bonfire revel around a gleaming golden calf on a rough altar. Celebrants circle the flames with
 * raised arms, Aaron stands by the altar, and Moses arrives at the edge of the light with his staff,
 * broken tablet fragments at the altar's foot. Palette: charcoal, ember red, burnt orange, covenant gold.
 * Hero prop (3D): the golden calf.  Texture keys: egypt_mud_brick, hammered_gold, stone_tablets.
 */

import { THREE, createScene, person, rock, flame, tent } from './moses-kit.js';

const GOLD = 0xe8b838;

export function build(group) {
    const W = createScene(group, { seed: 808, bg: 0x120a08, fogNear: 40, fogFar: 175 });
    const calfM = W.mat(GOLD, { metal: 0.85, rough: 0.28, emissive: 0x7a5210, ei: 0.55 });

    /* ── light: hard fire key, deep cool shadow ── */
    W.lights({ sky: 0x3a3048, gnd: 0x1e0c06, hemi: 0.5, sun: 0x6a7aa8, sunI: 0.35, sunPos: [-30, 36, 26] });
    W.point(0xff7a30, 2.2, 95, 0, 9, 10, 0.1);
    W.point(0xffc860, 1.6, 45, 0, 8, -9, 0.1);
    W.stars(50, 150, [0xc8c0d8, 0xffe0b0], 0.7);
    W.disc([-20, 18, -150], 22, 0x7a2a14, 0.25);

    /* ── ridges and camp (backdrop) ── */
    const ridges = W.grp(group, [0, 0, 0], { name: 'ridges' });
    [[-80, -125, 70, 40, 0x1e1412], [50, -130, 80, 44, 0x231714], [-10, -150, 90, 32, 0x2a1a14], [120, -135, 60, 34, 0x1e1412]].forEach(([x, z, r, h, c]) => W.add(ridges, W.G('cone', r, h, 5), W.mat(c), [x, h / 2 - 2, z]));
    W.backdrop(ridges);
    [[-46, -30, 1.3], [-34, -38, 1.5], [44, -32, 1.4], [32, -40, 1.6], [-60, -16, 1.2], [58, -18, 1.2]].forEach(([x, z, s], i) => W.backdrop(tent(W, group, x, 0, z, s, i % 2 ? 0x3a2a22 : 0x2e2018, 0.3 - i * 0.1)));

    /* ── ground ── */
    W.ground(240, 120, 0, 0, 0x3a2a20, { amp: 0.7, j: 0.3, flat: 30, seg: 40 });
    W.add(group, W.G('cyl', 26, 28, 0.12, 16), W.mat(0x4a3428), [0, 0.06, 2], { s: [1.4, 1, 1], name: 'revel_ground' });
    for (let i = 0; i < 26; i++) {
        const x = W.rr(-70, 70), z = W.rr(-38, 38);
        if (Math.hypot(x, z) < 14) continue;
        rock(W, group, x, 0.2, z, 0.5 + W.r() * 1.5, W.pick([0x2a1e18, 0x3a2a20, 0x4a3426]));
    }

    /* ── the altar and the golden calf (hero) ── */
    const altar = W.grp(group, [0, 0, -10], { name: 'calf_altar' });
    for (let i = 0; i < 3; i++) W.add(altar, W.G('box', 14 - i * 2.4, 1.0, 7 - i * 1.0), W.mat(i % 2 ? 0x6a4a34 : 0x5a3e2a), [0, 0.5 + i * 1.0, 0]);
    for (let i = 0; i < 14; i++) rock(W, altar, W.rr(-6.4, 6.4), 0.5, W.rr(-3.4, 3.4) + 1.5, 0.45 + W.r() * 0.5, 0x5a3e2a);     // calf altar base stones
    const calf = W.grp(altar, [0, 3.0, 0], { name: 'golden_calf', s: 1.35 });
    W.add(calf, W.G('ico', 1, 1), calfM, [0, 2.3, 0], { s: [3.0, 1.6, 1.5] });                        // body
    W.add(calf, W.G('ico', 1, 0), calfM, [-1.6, 3.1, 0], { s: [1.4, 1.2, 1.2] });                     // shoulder hump
    W.add(calf, W.G('box', 1.5, 1.4, 1.4), calfM, [3.1, 3.0, 0], { r: [0, 0, -0.25] });              // head
    W.add(calf, W.G('box', 0.9, 0.8, 1.1), calfM, [4.1, 2.45, 0], { r: [0, 0, -0.25] });             // muzzle
    [-0.55, 0.55].forEach(z => { W.add(calf, W.G('cone', 0.22, 1.3, 4), calfM, [3.0, 4.1, z * 1.6], { r: [0.3 * Math.sign(z), 0, 0.2] }); W.add(calf, W.G('cone', 0.25, 0.6, 4), calfM, [2.55, 3.4, z * 1.2], { r: [0, 0, 0.9] }); });
    [[1.6, 0.55], [1.6, -0.55], [-1.6, 0.55], [-1.6, -0.55]].forEach(([x, z]) => W.add(calf, W.G('cyl', 0.28, 0.22, 1.7, 5), calfM, [x, 0.85, z]));
    W.add(calf, W.G('cone', 0.2, 2, 4), calfM, [-3.3, 2.0, 0], { r: [0, 0, 0.5] });                   // tail
    const gleam = W.add(calf, W.G('ico', 3.2, 1), W.basic(0xffd860, 0.12), [0.4, 2.6, 0]);
    W.backdrop(gleam);
    W.anim(t => { gleam.scale.setScalar(1 + Math.sin(t * 2.2) * 0.07); });
    [-9, 9].forEach(x => {      // altar braziers
        W.add(altar, W.G('cyl', 0.25, 0.35, 3, 5), W.mat(0x4a3428), [x, 1.5, 1.6]);
        W.add(altar, W.G('cyl', 1.3, 0.8, 0.9, 7), W.mat(0x3a2a20), [x, 3.3, 1.6]);
        flame(W, altar, x, 3.7, 1.6, 1.1);
    });

    /* ── two bonfires flanking the revel, leaving the calf in clear sight ── */
    [[-19, 4], [19, 4]].forEach(([fx, fz], k) => {
        const fire = W.grp(group, [fx, 0, fz], { name: 'bonfire' });
        for (let i = 0; i < 9; i++) W.add(fire, W.G('cyl', 0.35, 0.4, 5, 5), W.mat(0x2a1a10), [0, 0.6, 0], { r: [0.35 + W.r() * 0.2, (i / 9) * Math.PI * 2, 1.45] });
        flame(W, fire, 0, 0.4, 0, 2.6);
        flame(W, fire, 1.4, 0.4, 0.8, 1.6);
        flame(W, fire, -1.4, 0.4, -0.6, 1.8);
        W.add(fire, W.G('ico', 3.6, 1), W.basic(0xff9a30, 0.12), [0, 4, 0], { s: [1, 1.4, 1] });
        for (let i = 0; i < 12; i++) rock(W, fire, Math.cos(i / 12 * 6.28) * 3.3, 0.3, Math.sin(i / 12 * 6.28) * 3.3, 0.5, 0x4a3a30);
        W.point(0xff6a20, 2.2, 60, fx, 6, fz, 0.16);
    });

    // embers
    const embers = [];
    for (let i = 0; i < 70; i++) {
        const m = W.backdrop(W.add(group, W.G('oct', 0.17), W.basic(W.pick([0xff9a30, 0xffc850, 0xff6a20]), 0.95), [0, 0, 0]));
        embers.push([m, W.pick([-19, 19]) + W.rr(-3, 3), W.rr(2, 7), W.rr(0, 30), W.rr(1.6, 3.6), W.r() * 6]);
    }
    W.anim(t => embers.forEach(([m, x, z, y0, v, ph]) => { const y = (y0 + t * v) % 30; m.position.set(x * (0.5 + y / 35) + Math.sin(t + ph) * 0.9, 2 + y, z + Math.cos(t * 0.7 + ph)); }));

    /* ── the revelers, circling with arms raised ── */
    const dancers = [];
    const cols = [0xc4462b, 0xd8822a, 0xe0b040, 0x9a3a2a, 0xb8602a, 0xd8c890];
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, r = 10.5 + (i % 2) * 2.2;
        const x = Math.cos(a) * r * 1.0, z = 4 + Math.sin(a) * r * 0.85;
        if (z < -2 && Math.abs(x) < 9) continue;            // keep the calf sightline clear
        const p = person(W, group, [x, 0, z], {
            name: 'reveler', robe: W.pick(cols), sash: 0xe0b040, collar: i % 3 ? undefined : 0xe0b040, head: i % 2 ? 'hair' : 'wrap', hair: 0x2a1a10, wrap: W.pick([0xe8d8b0, 0xc4462b]), wrapTrim: 0xe0b040,
            ry: Math.atan2(-x, -(z - 4)) , s: 1.1, armL: [0, -2.4 + W.r() * 0.5], armR: [0, 2.4 - W.r() * 0.5], skin: W.pick([0xc68e5a, 0xb07a48, 0xd8a070])
        });
        dancers.push([p, W.r() * 6]);
    }
    W.anim(t => dancers.forEach(([p, ph]) => { p.position.y = Math.abs(Math.sin(t * 4 + ph)) * 0.45; p.rotation.z = Math.sin(t * 4 + ph) * 0.05; }));

    /* ── Aaron by the altar; Moses arriving with tablet fragments at his feet ── */
    person(W, group, [-7.6, 0, -4], { name: 'aaron', robe: 0xeee6d2, sash: 0x2a4aa0, collar: 0xe0b040, head: 'wrap', wrap: 0xf0ecdc, wrapTrim: 0xe0b040, ry: 0.5, s: 1.2, armL: [0, -0.8], armR: [0, 0.8] });
    person(W, group, [17, 0, 9], {
        name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xd0c8b8, beard: 'long', ry: -2.4, s: 1.4,
        staff: 'planted', staffH: 5.8, skin: 0xc08450
    });
    const frag = W.grp(group, [9.4, 0, 6.5], { name: 'broken_tablets' });
    [[0, 0, 0.5, 1.8, 0.9, 0.4], [1.6, 0.0, -0.4, 1.3, 0.6, 0.4], [-1.4, 0.0, 0.7, 1.0, 0.7, 0.35], [0.6, 0.0, 1.4, 0.8, 0.5, 0.3]].forEach(([x, y, r, w, h, d]) => {
        const f = W.add(frag, W.G('box', w, h, d), W.mat(0xb8ac98), [x, h / 2 * 0.6, y + (x * 0.2)], { r: [0.3 + r * 0.2, r, 0.4 - r * 0.3] });
        W.add(f, W.G('box', w * 0.7, 0.08, 0.06), W.basic(GOLD, 0.95), [0, h * 0.1, d / 2 + 0.02]);
    });

    return W.finish();
}

export default { build };
