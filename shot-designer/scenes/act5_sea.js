/**
 * Act 5 – Through the Sea
 * A dry seabed path runs diagonally between two standing walls of water toward a gold dawn shore.
 * Moses raises his staff at the head of the column; the people stream ahead with children and packs,
 * and Pharaoh's chariots wait as silhouettes behind the pillar of cloud. Palette: deep indigo, river teal,
 * foam blue, wet silver. Hero prop (3D): Moses' raised staff.  Texture keys: nile_reeds, hammered_gold, stone_tablets.
 */

import { THREE, createScene, person, crowd, rock, palm } from './moses-kit.js';

const PHI = -0.3;           // the whole crossing is rotated so it runs from front-left to back-right
const MID = -26;            // local z of the path midpoint, used to centre the crossing on the origin

export function build(group) {
    const W = createScene(group, { seed: 505, bg: 0x0a1430, fogNear: 50, fogFar: 200 });

    /* ── light: low raking silver key, dawn glow ahead ── */
    W.lights({ sky: 0x6aa0d0, gnd: 0x2a2a34, hemi: 0.75, sun: 0xc4dcf4, sunI: 0.95, sunPos: [-45, 18, 34] });
    W.point(0xffc870, 1.4, 90, 38, 12, -70);
    W.disc([58, 20, -150], 13, 0xffe2a8);
    W.disc([58, 20, -158], 26, 0xffb060, 0.28);
    W.stars(60, 150, [0xdce8f8, 0xbfd4f0], 0.7);

    const root = W.grp(group, [-(MID * Math.sin(PHI)), 0, -(MID * Math.cos(PHI))], { r: [0, PHI, 0], name: 'crossing' });

    /* ── seabed ── */
    const bed = W.ground(80, 130, 0, -26, 0x8a7a58, { amp: 0.25, j: 0.22, flat: 50, seg: 14, segz: 40, name: 'seabed_path' });
    bed.mesh.parent.remove(bed.mesh); root.add(bed.mesh);
    const floor = W.add(root, W.G('box', 260, 0.6, 200), W.mat(0x1a2a3c), [0, -0.9, -26], { name: 'deep_floor' });
    W.add(root, W.G('box', 30, 0.05, 130), W.mat(0xa8956a), [0, 0.1, -26], { name: 'dry_path' });
    [-1, 1].forEach(sx => W.add(root, W.G('box', 8, 0.08, 130), W.mat(0x4e5a52), [sx * 19, 0.08, -26]));    // wet margins

    // puddles & shells (wet sandals)
    for (let i = 0; i < 26; i++) W.add(root, W.G('cyl', 0.6 + W.r() * 1.2, 0.6, 0.05, 6), W.mat(0x4a8aa0, { opacity: 0.65, rough: 0.2, metal: 0.3 }), [W.rr(-13, 13), 0.13, W.rr(14, -64)], { s: [1, 1, 0.7 + W.r() * 0.6] });
    for (let i = 0; i < 22; i++) rock(W, root, W.rr(-9, 9) + (W.r() < 0.5 ? -17 : 17), 0.2, W.rr(14, -64), 0.3 + W.r() * 0.6, W.pick([0x5a5a56, 0x7a6e58, 0x4a5a5a]));

    /* ── the two water walls ── */
    const walls = [];
    [-1, 1].forEach(sx => {
        const wall = W.grp(root, [sx * 23, 0, -26], { name: sx < 0 ? 'water_wall_left' : 'water_wall_right' });
        const n = 26;
        for (let i = 0; i < n; i++) {
            const h = 22 + W.r() * 10, z = 52 - (i / (n - 1)) * 104 + 0, d = 4 + W.r() * 3;
            const col = W.mat(W.pick([0x1a6a88, 0x1f7a96, 0x165e7c, 0x2a8aa4]), { opacity: 0.74, rough: 0.25, metal: 0.25 });
            const c = W.add(wall, W.G('box', 4.6, h, 4.2), col, [sx * (d * 0.5), h / 2, z + W.rr(-0.4, 0.4)]);
            walls.push([c, h, W.r() * 6]);
            W.add(wall, W.G('ico', 2.3, 0), W.mat(0xe4f4fa, { opacity: 0.85 }), [sx * (d * 0.5), h + 0.4, z], { s: [1.1, 0.5, 1.0] });      // foam cap
            for (let k = 0; k < 3; k++) W.add(wall, W.G('oct', 0.5), W.mat(0xe4f4fa, { opacity: 0.9 }), [sx * (-1.8) + W.rr(-0.6, 0.6), W.rr(0.3, 3.5), z + W.rr(-1.5, 1.5)]);   // spray at the base
        }
        // inner sheen planes
        W.add(wall, W.G('box', 0.15, 24, 104), W.basic(0xbfe8f4, 0.14), [sx * -2.4, 12, 0]);
        W.backdrop(wall);
    });
    W.anim(t => walls.forEach(([c, h, ph]) => { c.scale.y = 1 + Math.sin(t * 1.1 + ph) * 0.018; c.position.y = (h * c.scale.y) / 2; }));

    /* ── far shore (golden dawn) ── */
    const shore = W.grp(root, [0, 0, -84], { name: 'far_shore' });
    W.add(shore, W.G('box', 90, 2, 34), W.mat(0x9a8a58), [0, 0.6, 0]);
    [[-24, 6, 16, 0x7a7a48], [20, 5, 14, 0x6a7a44], [0, 8, 22, 0x867a4c]].forEach(([x, h, r, c]) => W.add(shore, W.G('cone', r, h, 6), W.mat(c), [x, h / 2 + 1.4, -6]));
    for (let i = 0; i < 12; i++) palm(W, shore, -34 + i * 6 + W.rr(-2, 2), 1.4, W.rr(-2, 6), 1.0 + W.r() * 0.6);
    W.backdrop(shore);

    /* ── pillar of cloud/fire and the Egyptian host behind it ── */
    const pillar = W.grp(root, [-8, 0, 34], { name: 'pillar_of_cloud' });
    W.add(pillar, W.G('cyl', 4.5, 7, 70, 8), W.basic(0xd8d0c0, 0.26), [0, 35, 0]);
    W.add(pillar, W.G('cyl', 2.2, 3.4, 70, 6), W.basic(0xffc870, 0.35), [0, 35, 0]);
    W.point(0xffb860, 1.0, 50, -8, 12, 34);
    W.backdrop(pillar);
    const host = W.grp(root, [0, 0, 44], { name: 'egyptian_chariots' });
    for (let i = 0; i < 5; i++) {
        const c = W.grp(host, [-14 + i * 7, 0, W.rr(-3, 4)], { r: [0, W.rr(-0.25, 0.25), 0] });
        const dark = W.mat(0x1a2030);
        W.add(c, W.G('box', 3.2, 1.2, 2.4), dark, [0, 1.6, 0]);
        W.add(c, W.G('box', 0.3, 2.2, 2.4), dark, [-1.5, 2.3, 0]);
        [-1.4, 1.4].forEach(z => W.add(c, W.G('tor', 1.1, 0.16, 5, 10), dark, [0, 1.1, z]));
        W.add(c, W.G('box', 3.0, 1.3, 1.0), dark, [3.6, 1.7, 0.0]);
        W.add(c, W.G('cone', 0.4, 1.4, 4), dark, [5.2, 2.5, 0], { r: [0, 0, -1.0] });
        W.add(c, W.G('cyl', 0.06, 0.06, 1.4, 4), W.mat(0x3a3a48), [0.5, 4.4, 0]);
        W.add(c, W.G('cone', 0.5, 0.9, 4), W.mat(0x3a3a58), [0.5, 5.3, 0]);   // pennant
    }
    W.backdrop(host);

    /* ── Moses, staff raised (hero prop), at the head of the column ── */
    person(W, root, [-3.0, 0, 3], {
        name: 'moses', robe: 0x8a6a44, sash: 0x5a3a20, cloak: 0x5a4a38, head: 'hair', hair: 0xc8c0b0, beard: 'long', ry: Math.PI - 0.12, s: 1.5,
        staff: 'raised', armL: [0, -0.3], skin: 0xc08450
    });
    person(W, root, [5.6, 0, 1.4], { name: 'aaron', robe: 0xeee6d2, sash: 0x2a4aa0, head: 'wrap', wrap: 0xf0ecdc, wrapTrim: 0xe0b040, ry: Math.PI + 0.1, s: 1.2, staff: 'planted' });
    person(W, root, [9.0, 0, 4.4], { name: 'miriam', robe: 0xc89a4a, sash: 0x2f7a7a, head: 'wrap', wrap: 0x3a9a9a, wrapTrim: 0xe0b040, ry: Math.PI + 0.3, s: 1.1 });

    /* ── the people: columns streaming down the path ── */
    const pal = [0x8a6a44, 0x9a5a3a, 0x6a7a8a, 0xb89a60, 0x7a4a3a, 0xc8b890, 0x4a6a7a, 0xa8854a];
    [[-8, -6], [8, -10], [-2, -18], [-9, -26], [8, -32], [0, -40], [-8, -50], [6, -58]].forEach(([x, z], i) => crowd(W, root, x, z, 8 + (i % 3) * 2, 20, 7, pal, { ry: Math.PI, s: 1.05, packs: 0.6, staves: 0.35 }));
    [[-2.5, -4], [6, -14], [-7, -22]].forEach(([x, z]) => {     // children with wet sandals
        person(W, root, [x, 0, z], { simple: true, robe: W.pick(pal), s: 0.6, ry: Math.PI + W.rr(-0.4, 0.4), hair: 0x2a1a10 });
        person(W, root, [x + 1.6, 0, z - 1.4], { simple: true, robe: W.pick(pal), s: 0.55, ry: Math.PI + W.rr(-0.4, 0.4), hair: 0x3a2418 });
    });
    // a few flocks/carts of belongings
    [[-10, -20], [11, -36]].forEach(([x, z]) => {
        const cart = W.grp(root, [x, 0, z], { r: [0, Math.PI + 0.2, 0], name: 'cart' });
        W.add(cart, W.G('box', 3.2, 0.5, 2), W.mat(0x6a4a2a), [0, 1.3, 0]);
        W.add(cart, W.G('box', 2.4, 1.3, 1.4), W.mat(0x9a7a4a), [0, 2.2, 0]);
        [-1.3, 1.3].forEach(z2 => W.add(cart, W.G('cyl', 0.8, 0.8, 0.2, 8), W.mat(0x3a2a1a), [0, 0.8, z2 * 0.9], { r: [Math.PI / 2, 0, 0] }));
    });

    return W.finish();
}

export default { build };
