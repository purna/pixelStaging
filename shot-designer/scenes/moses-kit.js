/**
 * Moses scene kit
 * ---------------
 * Shared helpers for the ten Moses act scenes (act01_… act10_…), written in the
 * same style as nile.js: flat-shaded MeshStandardMaterial, jittered terrain,
 * simple primitives. Each scene calls `createScene(group, opts)`, builds with the
 * helpers, then returns `W.finish()` which yields { background, fog, update }.
 *
 * Conventions
 *  - Story action sits around the origin, focal height ~3; the default camera
 *    looks from +z toward -z.
 *  - Backdrop objects (mountains, sky, distant ridges) are flagged with
 *    userData.excludeFromBounds so they don't skew camera framing.
 *  - Figures face +z and stand about 3.3 units tall.
 */

import THREE from '../js/three.js';

export { THREE };

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createScene(group, { seed = 1, bg, fogNear = 60, fogFar = 200 }) {
    const r = mulberry(seed);
    const mats = {};
    const geos = {};
    const anims = [];
    const W = { group, r };

    W.rr = (a, b) => a + (b - a) * r();
    W.pick = arr => arr[Math.floor(r() * arr.length)];
    W.anim = fn => anims.push(fn);

    /* ── materials & geometry (cached so hundreds of props stay cheap) ── */
    W.mat = (color, o = {}) => {
        const k = 's' + color + JSON.stringify(o);
        if (!mats[k]) {
            mats[k] = new THREE.MeshStandardMaterial({
                color,
                flatShading: true,
                roughness: o.rough ?? 1,
                metalness: o.metal ?? 0,
                emissive: o.emissive ?? 0x000000,
                emissiveIntensity: o.ei ?? 1,
                transparent: o.opacity !== undefined && o.opacity < 1,
                opacity: o.opacity ?? 1,
                depthWrite: !(o.opacity !== undefined && o.opacity < 1),
                side: o.side ? THREE.DoubleSide : THREE.FrontSide
            });
        }
        return mats[k];
    };
    W.basic = (color, opacity = 1, fog = true) => {
        const k = 'b' + color + opacity + fog;
        if (!mats[k]) {
            mats[k] = new THREE.MeshBasicMaterial({
                color, fog, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide
            });
        }
        return mats[k];
    };
    W.G = (kind, ...a) => {
        const k = kind + a.join(',');
        if (!geos[k]) {
            geos[k] = ({
                box: () => new THREE.BoxGeometry(a[0], a[1], a[2]),
                sph: () => new THREE.SphereGeometry(a[0], a[1] || 7, a[2] || 5),
                cone: () => new THREE.ConeGeometry(a[0], a[1], a[2] || 6),
                cyl: () => new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 6),
                ico: () => new THREE.IcosahedronGeometry(a[0], a[1] || 0),
                oct: () => new THREE.OctahedronGeometry(a[0], a[1] || 0),
                dod: () => new THREE.DodecahedronGeometry(a[0], 0),
                tor: () => new THREE.TorusGeometry(a[0], a[1], a[2] || 5, a[3] || 12),
                plane: () => new THREE.PlaneGeometry(a[0], a[1])
            })[kind]();
        }
        return geos[k];
    };

    /* ── scene graph helpers ── */
    const place = (obj, pos, o) => {
        obj.position.set(...pos);
        if (o.r) obj.rotation.set(...o.r);
        if (o.s !== undefined) Array.isArray(o.s) ? obj.scale.set(...o.s) : obj.scale.setScalar(o.s);
        if (o.name) obj.name = o.name;
        return obj;
    };
    W.grp = (parent, pos = [0, 0, 0], o = {}) => {
        const g = place(new THREE.Group(), pos, o);
        (parent || group).add(g);
        return g;
    };
    W.add = (parent, geo, mat, pos = [0, 0, 0], o = {}) => {
        const m = place(new THREE.Mesh(geo, mat), pos, o);
        (parent || group).add(m);
        return m;
    };
    /** Mark an object (and its descendants) as backdrop so it is ignored by camera framing. */
    W.backdrop = obj => {
        obj.traverse(n => { n.userData.excludeFromBounds = true; });
        return obj;
    };

    /* ── terrain: jittered plane with a smooth height function for placing props ── */
    W.ground = (w, d, cx, cz, color, o = {}) => {
        const amp = o.amp ?? 0.6, jit = o.j ?? 0.25, flat = o.flat ?? 30, ramp = o.ramp ?? 40, base = o.y ?? 0;
        const segX = o.seg ?? 36, segZ = o.segz ?? segX;
        const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
        geo.rotateX(-Math.PI / 2);
        const smooth = (x, z) => {
            const t = Math.min(1, Math.max(0, (Math.hypot(x - (o.fx ?? 0), z - (o.fz ?? 0)) - flat) / ramp));
            const f = t * t * (3 - 2 * t);
            const dunes = Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07) + 0.5 * Math.sin(x * 0.21 + z * 0.17);
            return base + f * amp * dunes + (o.rise ? o.rise(x, z) : 0);
        };
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            p.setY(i, smooth(p.getX(i) + cx, p.getZ(i) + cz) + (r() - 0.5) * jit);
        }
        geo.computeVertexNormals();
        const mesh = W.add(group, geo, W.mat(color), [cx, 0, cz], { name: o.name || 'ground' });
        return { mesh, y: smooth };
    };

    W.lights = o => {
        group.add(new THREE.HemisphereLight(o.sky, o.gnd, o.hemi ?? 0.75));
        const sun = new THREE.DirectionalLight(o.sun, o.sunI ?? 1);
        sun.position.set(...(o.sunPos || [-30, 40, 10]));
        group.add(sun);
        return sun;
    };
    W.point = (color, intensity, dist, x, y, z, flicker) => {
        const l = new THREE.PointLight(color, intensity, dist);
        l.position.set(x, y, z);
        group.add(l);
        if (flicker) {
            const ph = r() * 10;
            W.anim(t => { l.intensity = intensity * (1 + Math.sin(t * 7 + ph) * flicker + Math.sin(t * 13.3 + ph * 2) * flicker * 0.6); });
        }
        return l;
    };

    /* ── sky objects (unlit, fog-immune, excluded from framing) ── */
    W.stars = (n, radius, colors, size = 0.9) => {
        const g = W.grp(group, [0, 0, 0], { name: 'stars' });
        for (let i = 0; i < n; i++) {
            const th = r() * Math.PI, ph = Math.acos(0.05 + r() * 0.8);
            const x = Math.cos(th) * Math.sin(ph) * radius * 1.4 * (r() < 0.5 ? -1 : 1);
            const y = Math.cos(ph) * radius * 0.75 + 12;
            const z = -radius * (0.6 + r() * 0.4);
            W.add(g, W.G('oct', 1), W.basic(W.pick(colors), 1, false), [x, y, z], { s: size * (0.4 + r() * 0.9) });
        }
        W.backdrop(g);
        W.anim(t => { g.rotation.z = Math.sin(t * 0.02) * 0.02; });
        return g;
    };
    W.disc = (pos, radius, color, opacity = 1) => W.backdrop(W.add(group, W.G('ico', 1, 1), W.basic(color, opacity, false), pos, { s: radius, name: 'sky_disc' }));

    /* ── finish ── */
    W.finish = () => ({
        background: new THREE.Color(bg),
        fog: new THREE.Fog(bg, fogNear, fogFar),
        update(t) { anims.forEach(fn => fn(t)); }
    });

    return W;
}

/* ═════════════════════════════ props ═════════════════════════════ */

/**
 * Low-poly person. o: robe, skin, sash, trim, collar, cloak, head ('hair'|'wrap'|'nemes'|'crown'|'hood'|'bare'),
 * hair, beard ('short'|'long'), wrap, wrapTrim, staff ('planted'|'raised'|'held'), armL/armR [rx, rz], bend, s, ry, simple.
 */
export function person(W, parent, pos, o = {}) {
    const g = W.grp(parent, pos, { r: [0, o.ry || 0, 0], s: o.s || 1, name: o.name || 'figure' });
    const robe = o.robe ?? 0x8a6a44, skin = o.skin ?? 0xc68e5a;

    if (o.simple) {
        const b = W.grp(g, [0, 0, 0], { r: [o.bend || 0, 0, 0] });
        W.add(b, W.G('cyl', 0.5, 0.9, 2.3, 6), W.mat(robe), [0, 1.15, 0]);
        W.add(b, W.G('sph', 0.48, 6, 5), W.mat(skin), [0, 2.7, 0]);
        W.add(b, W.G('sph', 0.54, 6, 4), W.mat(o.hair ?? o.wrap ?? 0x2a1a10), [0, 2.85, -0.05], { s: [1, 0.7, 1] });
        if (o.pack) W.add(b, W.G('box', 0.9, 0.9, 0.6), W.mat(o.pack), [0, 1.7, -0.6]);
        if (o.staff) W.add(g, W.G('cyl', 0.07, 0.09, 4, 5), W.mat(0x5a3818), [0.95, 2, 0.2]);
        return g;
    }

    const body = W.grp(g, [0, 0, 0], { r: [o.bend || 0, 0, 0] });
    W.add(body, W.G('cyl', 0.55, 0.95, 2.3, 7), W.mat(robe), [0, 1.15, 0]);
    W.add(body, W.G('cyl', 0.6, 0.62, 0.22, 7), W.mat(o.sash ?? 0x4a3020), [0, 1.45, 0]);
    if (o.trim) W.add(body, W.G('cyl', 0.97, 1.0, 0.16, 7), W.mat(o.trim), [0, 0.1, 0]);
    if (o.collar) W.add(body, W.G('cyl', 0.72, 0.5, 0.28, 8), W.mat(o.collar, { metal: 0.3, rough: 0.5 }), [0, 2.2, 0]);
    if (o.cloak) W.add(body, W.G('cone', 0.95, 2.4, 7), W.mat(o.cloak), [0, 1.3, -0.2], { s: [1.05, 1, 0.75] });
    W.add(body, W.G('sph', 0.5, 7, 6), W.mat(skin), [0, 2.75, 0]);
    const dark = W.mat(0x1a1008);
    W.add(body, W.G('sph', 0.07, 4, 3), dark, [-0.17, 2.82, 0.44]);
    W.add(body, W.G('sph', 0.07, 4, 3), dark, [0.17, 2.82, 0.44]);

    const head = o.head || 'hair', hc = o.hair ?? 0x2a1a10;
    if (head === 'hair') {
        W.add(body, W.G('sph', 0.55, 7, 5), W.mat(hc), [0, 2.9, -0.06], { s: [1, 0.72, 1.02] });
        if (o.beard) {
            const long = o.beard === 'long';
            W.add(body, W.G('cone', 0.34, long ? 1.2 : 0.7, 5), W.mat(hc), [0, long ? 2.1 : 2.35, 0.3], { r: [Math.PI, 0, 0] });
        }
    } else if (head === 'wrap') {
        W.add(body, W.G('sph', 0.6, 7, 5), W.mat(o.wrap ?? 0xd8c8a0), [0, 2.88, -0.05], { s: [1, 0.78, 1.05] });
        W.add(body, W.G('cyl', 0.53, 0.53, 0.14, 8), W.mat(o.wrapTrim ?? 0x9a3a2a), [0, 2.98, 0], { s: 1.05 });
        W.add(body, W.G('box', 0.9, 1.3, 0.25), W.mat(o.wrap ?? 0xd8c8a0), [0, 2.25, -0.45], { r: [0.15, 0, 0] });
    } else if (head === 'nemes') {
        const c1 = W.mat(o.wrap ?? 0x2a4a9a), c2 = W.mat(o.wrapTrim ?? 0xe0b040, { metal: 0.5, rough: 0.4 });
        W.add(body, W.G('cyl', 0.5, 0.7, 0.95, 8), c1, [0, 3.0, -0.05]);
        W.add(body, W.G('cyl', 0.58, 0.58, 0.14, 8), c2, [0, 2.98, 0.02]);
        W.add(body, W.G('box', 0.32, 1.1, 0.4), c1, [-0.55, 2.35, 0.05]);
        W.add(body, W.G('box', 0.32, 1.1, 0.4), c1, [0.55, 2.35, 0.05]);
        W.add(body, W.G('cone', 0.12, 0.35, 4), c2, [0, 3.2, 0.5]);
        W.add(body, W.G('box', 0.22, 0.8, 0.22), c2, [0, 2.05, 0.45]);
    } else if (head === 'crown') {
        W.add(body, W.G('cone', 0.5, 1.4, 6), W.mat(o.wrap ?? 0xf0e8d8), [0, 3.55, 0]);
        W.add(body, W.G('cyl', 0.56, 0.56, 0.16, 7), W.mat(0xe0b040, { metal: 0.5 }), [0, 2.98, 0]);
    } else if (head === 'hood') {
        W.add(body, W.G('sph', 0.66, 7, 5), W.mat(o.wrap ?? robe), [0, 2.82, -0.1], { s: [1, 0.9, 1.05] });
    }

    const arm = (sx, a) => {
        const [rx, rz] = a || [0, sx * 0.14];
        const p = W.grp(body, [sx * 0.62, 2.15, 0], { r: [rx, 0, rz] });
        W.add(p, W.G('cyl', 0.17, 0.14, 1.35, 5), W.mat(o.sleeve ?? robe), [0, -0.62, 0]);
        W.add(p, W.G('sph', 0.19, 5, 4), W.mat(skin), [0, -1.35, 0]);
        return p;
    };
    const aL = arm(-1, o.armL), aR = arm(1, o.armR);
    const wood = W.mat(0x5a3818);
    if (o.staff === 'planted') {
        aR.rotation.set(0, 0, 0.55);
        const h = o.staffH || 4.6;
        W.add(g, W.G('cyl', 0.08, 0.11, h, 5), wood, [1.28, h / 2 - 0.05, 0.05]);
        W.add(g, W.G('sph', 0.16, 5, 4), W.mat(0x4a2c14), [1.28, h - 0.05, 0.05]);
    } else if (o.staff === 'raised') {
        aR.rotation.set(0, 0, 2.55);
        W.add(aR, W.G('cyl', 0.09, 0.12, 5.4, 5), wood, [0, -2.2, 0]);
    } else if (o.staff === 'held') {
        W.add(aR, W.G('cyl', 0.08, 0.11, 4.2, 5), wood, [0, -1.3, 0.05]);
    }
    g.userData.armL = aL;
    g.userData.armR = aR;
    return g;
}

export function palm(W, parent, x, y, z, s = 1, o = {}) {
    const g = W.grp(parent, [x, y, z], { s, r: [0, W.r() * 6, 0], name: 'palm' });
    W.add(g, W.G('cyl', 0.18, 0.3, 4.5, 5), W.mat(o.trunk ?? 0x7a4f2b), [0, 2.2, 0], { r: [0, 0, (W.r() - 0.5) * 0.25] });
    for (let i = 0; i < 7; i++) {
        const leaf = W.add(g, W.G('cone', 0.35, 3, 3), W.mat(i % 2 ? (o.leafA ?? 0x4f8a2e) : (o.leafB ?? 0x5fa036)), [0, 4.5, 0]);
        leaf.rotation.order = 'YZX';
        leaf.rotation.set(0, (i * Math.PI * 2) / 7, 1.15);
        leaf.translateY(1.5);
    }
    return g;
}

export function reeds(W, parent, cx, cz, n, spread, o = {}) {
    const g = W.grp(parent, [cx, o.y ?? 0, cz], { name: 'reeds' });
    const cols = (o.cols || [0x6f8f3a, 0x8faa3a, 0x5a7a30]).map(c => W.mat(c));
    const seedMat = W.mat(0x5a3a1c);
    for (let i = 0; i < n; i++) {
        const h = (o.h ?? 4) * (0.6 + W.r() * 0.8);
        const x = (W.r() - 0.5) * spread, z = (W.r() - 0.5) * spread * (o.zs ?? 0.7);
        W.add(g, W.G('cone', 0.14, +h.toFixed(1), 3), W.pick(cols), [x, h / 2, z], { r: [(W.r() - 0.5) * 0.25, W.r() * 3, (W.r() - 0.5) * 0.25] });
        if (o.heads && W.r() < o.heads) W.add(g, W.G('cyl', 0.16, 0.16, 0.7, 5), seedMat, [x, h + 0.1, z]);
    }
    return g;
}

export function rock(W, parent, x, y, z, s, color, o = {}) {
    return W.add(parent, W.G('dod', 1), W.mat(color), [x, y, z], {
        s: [s * (o.sx ?? 1), s * (o.sy ?? 0.7), s * (o.sz ?? 1)], r: [W.r(), W.r() * 6, W.r()], name: 'rock'
    });
}

export function sheep(W, parent, x, y, z, ry = 0, s = 1) {
    const g = W.grp(parent, [x, y, z], { r: [0, ry, 0], s, name: 'sheep' });
    const dark = W.mat(0x3a2a20);
    W.add(g, W.G('ico', 1, 1), W.mat(0xf0e6d0), [0, 1.35, 0], { s: [1.35, 0.95, 0.95] });
    W.add(g, W.G('box', 0.5, 0.55, 0.6), dark, [1.35, 1.6, 0]);
    W.add(g, W.G('cone', 0.16, 0.45, 3), dark, [1.3, 2.05, 0.28], { r: [0, 0, -0.5] });
    W.add(g, W.G('cone', 0.16, 0.45, 3), dark, [1.3, 2.05, -0.28], { r: [0, 0, -0.5] });
    [[0.6, 0.35], [0.6, -0.35], [-0.6, 0.35], [-0.6, -0.35]].forEach(([lx, lz]) => W.add(g, W.G('cyl', 0.1, 0.1, 0.9, 4), dark, [lx, 0.45, lz]));
    return g;
}

export function tent(W, parent, x, y, z, s, cloth, ry = 0, o = {}) {
    const g = W.grp(parent, [x, y, z], { r: [0, ry, 0], s, name: 'tent' });
    W.add(g, W.G('cone', 3.2, 3.4, 4), W.mat(cloth), [0, 1.7, 0], { r: [0, Math.PI / 4, 0], s: [1.3, 1, 1] });
    W.add(g, W.G('box', 1.2, 1.7, 0.1), W.mat(o.door ?? 0x1e1208), [0, 0.85, 1.9], { r: [0.32, 0, 0] });
    if (o.pole) W.add(g, W.G('cyl', 0.07, 0.07, 1.2, 4), W.mat(0x3a2410), [0, 3.7, 0]);
    return g;
}

export function column(W, parent, x, y, z, h, rad, color, o = {}) {
    const g = W.grp(parent, [x, y, z], { name: 'column' });
    const seg = o.seg ?? 8;
    W.add(g, W.G('box', rad * 2.6, 0.5, rad * 2.6), W.mat(o.base ?? color), [0, 0.25, 0]);
    W.add(g, W.G('cyl', rad * 0.85, rad, h, seg), W.mat(color), [0, 0.5 + h / 2, 0]);
    if (o.band) {
        const bm = W.mat(o.band, { metal: 0.4, rough: 0.5 });
        W.add(g, W.G('cyl', rad * 0.9, rad * 0.9, 0.35, seg), bm, [0, 0.5 + h * 0.2, 0], { s: 1.03 });
        W.add(g, W.G('cyl', rad * 0.86, rad * 0.86, 0.35, seg), bm, [0, 0.5 + h * 0.8, 0], { s: 1.04 });
    }
    W.add(g, W.G('box', rad * 2.4, 0.5, rad * 2.4), W.mat(o.cap ?? color), [0, 0.75 + h, 0]);
    if (o.lotus) W.add(g, W.G('cone', rad * 1.3, rad * 1.5, 6), W.mat(o.lotus), [0, 0.5 + h + 0.2, 0], { r: [Math.PI, 0, 0] });
    return g;
}

/** Stacked emissive cones that flicker in update(). */
export function flame(W, parent, x, y, z, s = 1, cols = [0xff6a20, 0xffb030, 0xfff0a0]) {
    const g = W.grp(parent, [x, y, z], { s, name: 'flame' });
    W.add(g, W.G('cone', 0.9, 2.6, 5), W.basic(cols[0], 0.9), [0, 1.3, 0]);
    W.add(g, W.G('cone', 0.65, 2.0, 5), W.basic(cols[1], 0.95), [0.1, 1.15, 0.05], { r: [0, 1, 0.08] });
    W.add(g, W.G('cone', 0.4, 1.4, 4), W.basic(cols[2], 1), [-0.05, 0.8, 0], { r: [0, 0.5, -0.06] });
    const ph = W.r() * 10;
    W.anim(t => {
        g.scale.set(s * (1 + Math.sin(t * 9 + ph) * 0.06), s * (1 + Math.sin(t * 6.3 + ph) * 0.14), s * (1 + Math.cos(t * 8 + ph) * 0.06));
    });
    return g;
}

export function crowd(W, parent, cx, cz, n, w, d, palette, o = {}) {
    const g = W.grp(parent, [cx, 0, cz], { name: 'crowd' });
    for (let i = 0; i < n; i++) {
        const x = (W.r() - 0.5) * w, z = (W.r() - 0.5) * d;
        person(W, g, [x, o.y ? o.y(cx + x, cz + z) : 0, z], {
            simple: true,
            robe: W.pick(palette),
            skin: W.pick([0xc68e5a, 0xb07a48, 0xd8a070, 0x9a6a3c]),
            hair: W.pick([0x2a1a10, 0x3a2418, 0xd8c8a0, 0x8a3a2a]),
            s: (o.s ?? 1) * (0.75 + W.r() * 0.35),
            ry: (o.ry ?? 0) + (W.r() - 0.5) * 0.6,
            pack: W.r() < (o.packs ?? 0.4) ? W.pick([0x7a5a30, 0x9a3a2a, 0x4a6a7a]) : undefined,
            staff: W.r() < (o.staves ?? 0.25)
        });
    }
    return g;
}
