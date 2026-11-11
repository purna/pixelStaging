/**
 * Act 9 – Forty Years
 * A night-vision relief map of the wilderness years: a glowing sand path winds from Egypt (left) to the
 * green glow of Canaan (right), marked by provision-and-trust stops – manna jar, Sinai, the struck rock
 * and its stream, the bronze serpent pole – with Moses walking beneath a pillar of cloud and fire.
 * Palette: midnight violet, ultramarine, pale cyan, star gold. Hero prop (3D): the path with its markers.
 * Texture keys: desert_sand, hammered_gold, stone_tablets.
 */

import { THREE, createScene, person, rock, tent, palm } from './moses-kit.js';

const GOLD = 0xffd860, CYAN = 0x9ae0f0;
const WAY = [[-44, 24], [-34, 16], [-26, 22], [-16, 14], [-8, 20], [0, 10], [8, 14], [14, 4], [22, 8], [26, -4], [34, -8], [42, -18]];

export function build(group) {
    const W = createScene(group, { seed: 909, bg: 0x0c0824, fogNear: 70, fogFar: 230 });
    const goldM = W.mat(0xe0b040, { metal: 0.55, rough: 0.4 });

    /* ── light ── */
    W.lights({ sky: 0x6a5ac0, gnd: 0x1a1048, hemi: 0.7, sun: CYAN, sunI: 0.7, sunPos: [-30, 55, 36] });
    W.point(0xffd060, 1.6, 60, 0, 14, 10);
    W.point(0x6aff9a, 2.2, 60, 42, 10, -18);
    W.stars(260, 170, [GOLD, CYAN, 0xffffff, 0xc8b8ff], 1.1);

    /* ── the map slab ── */
    W.add(group, W.G('cyl', 66, 70, 2.4, 40), W.mat(0x1c1646), [0, -1.3, 0], { name: 'map_base' });
    const map = W.ground(124, 100, 0, 0, 0x2c2268, { amp: 0.8, j: 0.28, flat: 28, ramp: 36, seg: 38, y: 0, name: 'map_terrain' });
    // clip the square terrain visually by ringing the slab edge
    const rim = W.add(group, W.G('tor', 66, 0.9, 5, 48), goldM, [0, 0.1, 0], { r: [Math.PI / 2, 0, 0], name: 'map_rim' });
    const rim2 = W.add(group, W.G('tor', 78, 0.3, 4, 64), W.basic(CYAN, 0.5), [0, 1.2, 0], { r: [Math.PI / 2, 0, 0] });
    W.backdrop(rim2);
    W.anim(t => { rim2.rotation.z = t * 0.03; });

    /* ── the winding path ── */
    const pathM = W.mat(0xe8c878, { emissive: 0x5a4a1c, ei: 0.7, rough: 0.7 });
    for (let i = 0; i < WAY.length - 1; i++) {
        const [x1, z1] = WAY[i], [x2, z2] = WAY[i + 1];
        const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1);
        W.add(group, W.G('box', 3.2, 0.25, len + 0.8), pathM, [(x1 + x2) / 2, 0.22, (z1 + z2) / 2], { r: [0, ang, 0], name: 'path_segment' });
        W.add(group, W.G('box', 4.6, 0.12, len + 0.8), W.mat(0x5a4a8a), [(x1 + x2) / 2, 0.14, (z1 + z2) / 2], { r: [0, ang, 0] });   // soft verge
    }
    const nodes = [];
    WAY.forEach(([x, z], i) => {
        W.add(group, W.G('cyl', 1.5, 1.5, 0.3, 8), W.mat(CYAN, { emissive: 0x3a8a9a, ei: 0.9 }), [x, 0.4, z], { name: 'waypoint' });
        const pin = W.grp(group, [x, 3.4, z], { name: 'waypoint_marker' });
        W.add(pin, W.G('oct', 0.8), W.basic(GOLD, 0.95), [0, 0, 0], { s: [1, 1.5, 1] });
        W.add(pin, W.G('cyl', 0.05, 0.05, 2.4, 4), W.mat(0x9a8ac8), [0, -1.4, 0]);
        nodes.push([pin, W.r() * 6]);
    });
    W.anim(t => nodes.forEach(([p, ph]) => { p.rotation.y = t * 0.8 + ph; p.position.y = 3.4 + Math.sin(t * 1.6 + ph) * 0.25; }));
    // a faint, risky side-branch that returns to the path
    [[-8, 20], [-2, 28], [6, 26], [8, 14]].forEach(([x, z], i, a) => {
        if (!i) return;
        const [x1, z1] = a[i - 1], len = Math.hypot(x - x1, z - z1);
        W.add(group, W.G('box', 1.6, 0.15, len), W.mat(0x5a3a7a, { emissive: 0x2a1a4a, ei: 0.5 }), [(x + x1) / 2, 0.18, (z + z1) / 2], { r: [0, Math.atan2(x - x1, z - z1), 0] });
    });

    /* ── provision & trust stops ── */
    // Egypt (start): small pyramid and wall
    const eg = W.grp(group, [-50, 0, 28], { name: 'egypt' });
    W.add(eg, W.G('cone', 6, 5, 4), W.mat(0xb8a070), [0, 2.5, 0], { r: [0, Math.PI / 4, 0] });
    W.add(eg, W.G('cone', 4, 3.4, 4), W.mat(0xa89060), [7, 1.7, 3], { r: [0, Math.PI / 4, 0] });
    // manna jar + flakes (-26, 22)
    const mj = W.grp(group, [-26, 0, 27], { name: 'manna_jar' });
    W.add(mj, W.G('sph', 1, 7, 5), goldM, [0, 1.8, 0], { s: [1.4, 1.7, 1.4] });
    W.add(mj, W.G('cyl', 0.9, 1.1, 0.8, 7), goldM, [0, 3.9, 0]);
    for (let i = 0; i < 24; i++) W.add(mj, W.G('cyl', 0.2, 0.2, 0.05, 5), W.basic(0xfff6d8, 0.95), [W.rr(-4, 4), 0.35, W.rr(-3, 4)]);
    // Sinai miniature (-16, 14)
    const sn = W.grp(group, [-18, 0, 6], { name: 'sinai_marker' });
    W.add(sn, W.G('cone', 6, 11, 5), W.mat(0x4a3a8a), [0, 5.5, 0]);
    W.add(sn, W.G('cone', 3.4, 6, 5), W.mat(0x5a4a9a), [-5, 3, 1]);
    W.add(sn, W.G('ico', 2.4, 0), W.basic(GOLD, 0.38), [0, 12, 0], { s: [1.6, 0.8, 1] });
    // the struck rock and stream (-8, 20)
    const mr = W.grp(group, [-9, 0, 24], { name: 'struck_rock' });
    rock(W, mr, 0, 2.2, 0, 3.0, 0x7a6aa8, { sy: 0.95 });
    const stream = W.add(mr, W.G('box', 1.4, 0.15, 9), W.mat(0x5ac8e8, { opacity: 0.8, emissive: 0x2a7a9a, ei: 0.6, rough: 0.2 }), [0.6, 0.2, 5.2], { r: [0.25, 0, 0] });
    W.add(mr, W.G('cyl', 3.2, 3.2, 0.1, 8), W.mat(0x5ac8e8, { opacity: 0.8, emissive: 0x2a7a9a, ei: 0.6 }), [0.8, 0.12, 9.4]);
    W.anim(t => { stream.scale.x = 1 + Math.sin(t * 3) * 0.08; });
    // bronze serpent pole (8, 14)
    const bp = W.grp(group, [10, 0, 19], { name: 'bronze_serpent_pole' });
    const bronze = W.mat(0xb87838, { metal: 0.7, rough: 0.35, emissive: 0x3a2008, ei: 0.5 });
    W.add(bp, W.G('cyl', 0.2, 0.28, 8, 5), W.mat(0x6a4a30), [0, 4, 0]);
    W.add(bp, W.G('box', 3.4, 0.3, 0.3), W.mat(0x6a4a30), [0, 6.6, 0]);
    for (let i = 0; i < 9; i++) { const t = i / 8; W.add(bp, W.G('sph', 0.34 - t * 0.06, 5, 4), bronze, [Math.sin(t * 7) * 0.6, 1.2 + t * 6.2, Math.cos(t * 7) * 0.6]); }
    W.add(bp, W.G('sph', 0.4, 5, 4), bronze, [0, 7.6, 0.2], { s: [1.2, 0.9, 1.4] });
    W.add(bp, W.G('ico', 2.4, 0), W.basic(GOLD, 0.16), [0, 5, 0]);
    // wilderness camps along the later stretch
    [[16, 12], [28, 4], [30, -10]].forEach(([x, z], i) => { tent(W, group, x, 0.2, z, 0.55, 0x3a3070, i * 0.7); tent(W, group, x + 3.4, 0.2, z + 1.2, 0.45, 0x4a3a80, -i * 0.5); });
    // obstacle ridge before the final stretch (the path pauses, never fails)
    [[20, -8, 4], [24, -14, 5], [30, -16, 4]].forEach(([x, z, r]) => W.add(group, W.G('cone', r, r * 1.8, 5), W.mat(0x5a2a5a), [x, r * 0.9, z]));

    /* ── Canaan glows at the end of the path ── */
    const can = W.grp(group, [44, 0, -22], { name: 'canaan' });
    [[0, 0, 7, 6], [-7, 4, 5, 4], [6, 5, 5, 5]].forEach(([x, z, r, h]) => W.add(can, W.G('cone', r, h, 6), W.mat(0x3a9a5a, { emissive: 0x1a5a30, ei: 0.8 }), [x, h / 2, z]));
    for (let i = 0; i < 6; i++) palm(W, can, W.rr(-9, 9), 0, W.rr(-3, 8), 0.8, { leafA: 0x4aaa6a, leafB: 0x6aca7a });
    const glow = W.add(can, W.G('ico', 9, 1), W.basic(0x9affc0, 0.14), [0, 5, 2], { s: [1.4, 1, 1] });
    W.backdrop(glow);
    W.anim(t => { glow.scale.setScalar(1 + Math.sin(t * 1.2) * 0.07); });
    W.add(group, W.G('box', 70, 0.12, 5), W.mat(0x2a4ac8, { emissive: 0x1a2a7a, ei: 0.7, rough: 0.2 }), [20, 0.2, -16], { r: [0, -0.55, 0], name: 'jordan_river' });

    /* ── pillar of cloud/fire above Moses ── */
    const pil = W.grp(group, [0, 0, 6], { name: 'pillar_of_cloud_and_fire' });
    W.add(pil, W.G('cyl', 1.8, 3.4, 60, 7), W.basic(0xffe0a0, 0.2), [0, 30, 0]);
    W.add(pil, W.G('cyl', 0.8, 1.6, 60, 6), W.basic(CYAN, 0.2), [0, 30, 0]);
    W.backdrop(pil);

    /* ── Moses leading, with the people behind ── */
    person(W, group, [0, 0.3, 10], { name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xe0d8d0, beard: 'long', ry: -1.9, s: 1.7, staff: 'planted', staffH: 5.2, skin: 0xc08450 });
    const pal = [0x8a6a44, 0x9a5a3a, 0x6a7a8a, 0xb89a60, 0x4a6a7a];
    for (let i = 0; i < 26; i++) {
        const k = Math.min(WAY.length - 2, Math.floor(i / 2.4)), f = (i / 2.4) % 1;
        const [x1, z1] = WAY[k], [x2, z2] = WAY[k + 1];
        const x = x1 + (x2 - x1) * f + W.rr(-0.9, 0.9), z = z1 + (z2 - z1) * f + W.rr(-0.9, 0.9);
        if (Math.hypot(x, z - 10) < 3) continue;
        person(W, group, [x, 0.3, z], { simple: true, robe: W.pick(pal), s: 0.8, ry: Math.atan2(x2 - x1, z2 - z1) + 0.1, hair: 0x2a1a10, pack: W.r() < 0.5 ? 0x7a5a30 : undefined, staff: W.r() < 0.3 });
    }
    // distant flock
    for (let i = 0; i < 7; i++) W.add(group, W.G('ico', 0.5, 0), W.mat(0xf0e6d0), [-2 + i * 1.4, 0.6, 3.5 + (i % 2) * 1.2], { s: [1.3, 0.9, 0.9] });

    return W.finish();
}

export default { build };
