/**
 * Act 10 – Mount Nebo
 * Long amber dusk on the summit: an aged Moses lays his hand on Joshua, then looks out over the land he
 * will not enter – the Jordan, Jericho's palms, the turquoise Dead Sea, the hills of Gilead and the far
 * glint of the western sea, with Hermon capped in white. Palette: sandstone, ochre, dry umber, faded turquoise.
 * Hero prop (3D): Moses and Joshua on the summit, and the land beyond.  Texture keys: desert_sand, egypt_mud_brick, stone_tablets.
 */

import { THREE, createScene, person, rock, palm, tent } from './moses-kit.js';

const SUMMIT = 0;

export function build(group) {
    const W = createScene(group, { seed: 1010, bg: 0xf0b878, fogNear: 70, fogFar: 235 });

    /* ── light: low amber sun from the promised land, rim-lighting the figures ── */
    W.lights({ sky: 0xffd8a0, gnd: 0x8a6038, hemi: 0.72, sun: 0xffb060, sunI: 1.05, sunPos: [55, 16, -40] });
    W.disc([62, 18, -170], 12, 0xfff0c0);
    W.disc([62, 18, -178], 28, 0xffd080, 0.35);

    /* ── sky streaks (backdrop) ── */
    const sky = W.grp(group, [0, 0, 0], { name: 'dusk_streaks' });
    [[-60, 40, -150, 70], [20, 52, -160, 90], [90, 34, -150, 60], [-110, 56, -165, 80]].forEach(([x, y, z, w]) => W.add(sky, W.G('box', w, 1.6, 0.3), W.basic(0xffe0a8, 0.4), [x, y, z]));
    [[-30, 62, -170, 40], [60, 70, -175, 50]].forEach(([x, y, z, w]) => W.add(sky, W.G('ico', 1, 1), W.mat(0xe8a068, { opacity: 0.6 }), [x, y, z], { s: [w, 5, 8] }));
    W.backdrop(sky);

    /* ── summit plateau ── */
    const top = W.ground(110, 40, 0, 0, 0xc8975a, {
        amp: 0.5, j: 0.35, flat: 20, ramp: 24, seg: 34, y: SUMMIT,
        rise: (x, z) => -Math.max(0, (-z - 10)) * 2.6
    });
    W.backdrop(top.mesh);   // the sloping edge would drag the framing centre downhill
    for (let i = 0; i < 18; i++) rock(W, group, W.rr(-48, 48), SUMMIT + 0.2, W.rr(-14, 16), 0.5 + W.r() * 1.6, W.pick([0x8a6038, 0x9a7048, 0x7a5430, 0xb08858]));
    for (let i = 0; i < 30; i++) W.add(group, W.G('cone', 0.2, 1.0 + W.r() * 0.8, 3), W.mat(W.pick([0x9a8a48, 0x8a7a3a, 0xb0a058])), [W.rr(-50, 50), SUMMIT + 0.5, W.rr(-14, 16)], { r: [(W.r() - 0.5) * 0.4, 0, (W.r() - 0.5) * 0.4] });   // dry grass tufts
    // lone twisted tree
    const tree = W.grp(group, [-20, SUMMIT, -2], { name: 'lone_tree' });
    W.add(tree, W.G('cyl', 0.3, 0.5, 5, 5), W.mat(0x5a3e24), [0, 2.5, 0], { r: [0, 0, 0.18] });
    W.add(tree, W.G('cyl', 0.2, 0.3, 3, 5), W.mat(0x5a3e24), [1.2, 4.6, 0], { r: [0, 0, -0.9] });
    W.add(tree, W.G('ico', 2.4, 0), W.mat(0x5a7a3a), [0.4, 6.0, 0], { s: [1.3, 0.7, 1] });
    W.add(tree, W.G('ico', 1.6, 0), W.mat(0x6a8a44), [2.4, 5.4, 0.4], { s: [1.2, 0.7, 1] });
    // cairn
    for (let i = 0; i < 6; i++) rock(W, group, 18 + W.rr(-0.4, 0.4), SUMMIT + 0.35 + i * 0.5, -3 + W.rr(-0.3, 0.3), 1.2 - i * 0.14, 0xa07a4c, { sy: 0.55 });

    /* ── the land from afar (backdrop) ── */
    const land = W.grp(group, [0, 0, 0], { name: 'promised_land' });
    W.add(land, W.G('box', 420, 1, 200), W.mat(0xb09a58), [0, -9, -110]);                              // the plain of Jordan
    [-80, -10, 70].forEach((x, i) => W.add(land, W.G('box', 90, 0.3, 30), W.mat(i % 2 ? 0x8a9a4a : 0x9aa650), [x, -8.4, -78 - i * 8]));      // green fields
    // Jordan river (winding turquoise ribbon)
    const rv = [[-100, -52], [-60, -50], [-30, -56], [0, -52], [30, -58], [64, -54], [100, -60]];
    for (let i = 0; i < rv.length - 1; i++) {
        const [x1, z1] = rv[i], [x2, z2] = rv[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
        W.add(land, W.G('box', 6, 0.3, len + 1), W.mat(0x6ab0b0, { emissive: 0x2a5a5a, ei: 0.5, rough: 0.3 }), [(x1 + x2) / 2, -8.2, (z1 + z2) / 2], { r: [0, Math.atan2(x2 - x1, z2 - z1), 0] });
    }
    // Dead Sea (turquoise, left)
    W.add(land, W.G('cyl', 30, 30, 0.3, 10), W.mat(0x5aa8a8, { emissive: 0x2a5a5a, ei: 0.5, rough: 0.25 }), [-78, -8.2, -40], { s: [0.8, 1, 1.9] });
    // Jericho palm grove and low walls
    const jer = W.grp(land, [22, -8, -66], { name: 'jericho' });
    for (let i = 0; i < 16; i++) palm(W, jer, W.rr(-12, 12), 0, W.rr(-6, 6), 1.1 + W.r() * 0.5);
    for (let i = 0; i < 7; i++) W.add(jer, W.G('box', 3 + W.r() * 2, 2 + W.r() * 1.4, 2.4), W.mat(W.pick([0xc8a070, 0xb89060, 0xd0aa78])), [-6 + i * 2.8, 1.2, 8 + W.rr(-1, 1)]);
    // the camp of Israel on the plains, small and far
    [[-40, -62], [-34, -66], [-46, -68], [-52, -60], [-38, -72], [-58, -70]].forEach(([x, z], i) => tent(W, land, x, -8, z, 0.9, i % 2 ? 0x4a3628 : 0x5a4030, i * 0.5));
    // hills of Gilead, Moab and the Judean ridge (fading toward turquoise haze)
    [[-120, -150, 50, 22, 0x8a9a6a], [-70, -158, 60, 28, 0x7a9a7a], [-10, -165, 70, 24, 0x7aa08a], [60, -160, 66, 30, 0x70a090], [120, -150, 52, 24, 0x80a088],
     [-40, -125, 38, 14, 0x9a9a58], [30, -122, 40, 16, 0x8a9a52], [90, -118, 36, 12, 0x9aa05a]].forEach(([x, z, r, h, c]) => W.add(land, W.G('cone', r, h, 6), W.mat(c), [x, h / 2 - 9, z]));
    // snow-capped Hermon, far right
    W.add(land, W.G('cone', 40, 44, 6), W.mat(0x8aa8b0), [150, 12, -200]);
    W.add(land, W.G('cone', 13, 14, 6), W.mat(0xf4f0e8), [150, 30, -200]);
    // glint of the western sea on the horizon
    W.add(land, W.G('box', 360, 0.4, 14), W.basic(0x7ad0d0, 0.8), [-10, -3.4, -188]);
    land.position.y = -8;
    W.backdrop(land);
    for (let i = 0; i < 3; i++) W.backdrop(W.add(group, W.G('box', 420, 5, 0.3), W.basic(0xffe0b0, 0.14 + i * 0.05), [0, -2 + i * 5, -90 - i * 28]));   // amber haze bands

    /* ── Moses and Joshua: commissioning ── */
    person(W, group, [-3.4, SUMMIT, 1], {
        name: 'moses', robe: 0xb89870, sash: 0x5a3a20, cloak: 0x7a6248, head: 'hair', hair: 0xf0ece4, beard: 'long', ry: 1.15, s: 1.5, staff: 'planted', staffH: 5.8,
        armL: [-1.45, -0.25], skin: 0xc08450
    });
    person(W, group, [2.6, SUMMIT, 1.2], {
        name: 'joshua', robe: 0x6a8a8a, sash: 0x5a3a20, cloak: 0x4a3a2a, head: 'hair', hair: 0x2a1a10, ry: -1.15, s: 1.3, bend: 0.12, armR: [-0.4, 0.2], skin: 0xc68e5a
    });
    // Joshua's mantle trim and spear laid beside him
    W.add(group, W.G('cyl', 0.07, 0.07, 6, 4), W.mat(0x5a3818), [5.4, SUMMIT + 0.3, 3], { r: [0, 1.2, Math.PI / 2] });
    W.add(group, W.G('cone', 0.2, 0.7, 4), W.mat(0x9a9a9a, { metal: 0.5 }), [8.2, SUMMIT + 0.3, 2.2], { r: [0, 0, -Math.PI / 2] });
    // elders / a distant gathering waiting below the summit path
    [[-14, 6], [-11.5, 7.6], [-9, 6.4]].forEach(([x, z], i) => person(W, group, [x, SUMMIT, z], { simple: true, robe: [0x7a6a58, 0x6a8a8a, 0x8a6a44][i], s: 1.0, ry: -0.6, hair: 0xd0c8b8, staff: i !== 1 }));

    return W.finish();
}

export default { build };
