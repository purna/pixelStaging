/**
 * The Nile – High Definition
 * --------------------------
 * A higher-fidelity version of scenes/nile.js. Same composition and layout, but
 * built for detail:
 *
 *   - deterministic noise terrain instead of per-vertex jitter
 *   - gradient sky dome with sun glow, hazy distant ridges
 *   - PBR materials (metalness/roughness varied per material class)
 *   - shadow-casting key light with a cool fill
 *   - proper palm fronds (serrated, drooping), curved trunks, coconuts
 *   - detailed temple: pylons, hypostyle hall, architrave, obelisks, statues
 *   - parametric boat hulls, cambered sails, canopies, oars, rigging
 *   - instanced reeds, distant town, circling birds, brazier flicker
 *
 * Contract (see js/scene-library.js): export build(group), optionally returning
 * { update(t), background, fog, shadows }.
 *
 * `shadows: true` asks the library to turn on renderer.shadowMap, so pass your
 * renderer to the library:  window.sdScenes.attach({ scene: S, camera: C, renderer: R })
 */

import THREE from '../js/three.js';

/* ══ Palette ══════════════════════════════════════════════════════════════ */
const C = {
    skyTop: 0x2f6ea8,
    skyMid: 0x8fc0d8,
    skyHorizon: 0xf0d3a0,
    sun: 0xfff2cf,
    sunHaze: 0xffd9a0,

    sandNear: 0xe0b478,
    sandFar: 0xd2a468,
    sandGreen: 0x7d9a3c,
    ridgeNear: 0x8c8279,
    ridgeFar: 0x7d8b9c,

    water: 0x1d7f9c,
    waterDeep: 0x0f5f7d,

    stone: 0xf0e0bb,
    stoneDark: 0xd9c49a,
    granite: 0x6d5a4a,
    trim: 0x2fa4a8,
    red: 0xc4462b,
    gold: 0xe8b53a,
    timber: 0x6b4a2c,
    timberDark: 0x4a321e,
    rope: 0xbfa676,
    sail: 0xf7efdc,
    reed: 0x8faa3a,
    reedDry: 0xc2b06a,
    mud: 0xc2a071,
    mudDark: 0xa8875c,
    foliage: 0x4f8a2e,
    foliageLit: 0x6ba53a,
    coconut: 0x6a4a2a
};

/* ══ Deterministic randomness ═════════════════════════════════════════════
 * Seeded so the scene is identical on every load — exports stay reproducible.
 */
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
const rand = makeRng(0x4e696c65);
const rr = (a, b) => a + rand() * (b - a);
const pick = arr => arr[Math.floor(rand() * arr.length)];

/* Value noise with smooth interpolation, then fractal octaves. */
function makeNoise(seed) {
    const p = new Uint8Array(512);
    const r = makeRng(seed);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

    const grad = (h, x, y) => {
        const u = (h & 1) ? x : -x;
        const v = (h & 2) ? y : -y;
        return u + v;
    };
    const fade = t => t * t * (3 - 2 * t);

    const noise2 = (x, y) => {
        const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = fade(xf), v = fade(yf);
        const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1];
        const ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
        const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
        const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
        return (x1 + v * (x2 - x1)) * 0.5;
    };

    return (x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) => {
        let sum = 0, amp = 1, freq = 1, norm = 0;
        for (let i = 0; i < octaves; i++) {
            sum += noise2(x * freq, y * freq) * amp;
            norm += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum / norm;
    };
}
const fbm = makeNoise(0x9e3779b9);

/* ══ Materials ═════════════════════════════════════════════════════════════ */
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.92,
    metalness: opts.metalness ?? 0.0,
    flatShading: opts.flat ?? false,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    vertexColors: opts.vertexColors ?? false
});

const MAT = {
    sand: mat(C.sandNear, { roughness: 1 }),
    sandFar: mat(C.sandFar, { roughness: 1 }),
    grass: mat(C.sandGreen, { roughness: 1 }),
    stone: mat(C.stone, { roughness: 0.85 }),
    stoneDark: mat(C.stoneDark, { roughness: 0.9 }),
    granite: mat(C.granite, { roughness: 0.7 }),
    trim: mat(C.trim, { roughness: 0.45, metalness: 0.15 }),
    red: mat(C.red, { roughness: 0.6 }),
    // Gilding. Metalness is kept moderate and a little emissive warmth is added
    // so the gold still reads as gold even before the environment map exists —
    // a fully metallic material with nothing to reflect renders black.
    gold: mat(C.gold, {
        roughness: 0.32,
        metalness: 0.5,
        emissive: 0x4a3200,
        emissiveIntensity: 0.5
    }),
    timber: mat(C.timber, { roughness: 0.95 }),
    timberDark: mat(C.timberDark, { roughness: 0.95 }),
    rope: mat(C.rope, { roughness: 1 }),
    sail: mat(C.sail, { roughness: 0.85, side: THREE.DoubleSide, opacity: 0.94 }),
    frond: mat(C.foliage, { roughness: 0.8, side: THREE.DoubleSide }),
    frondLit: mat(C.foliageLit, { roughness: 0.8, side: THREE.DoubleSide }),
    coconut: mat(C.coconut, { roughness: 0.85 }),
    mud: mat(C.mud, { roughness: 1 }),
    mudDark: mat(C.mudDark, { roughness: 1 }),
    ridgeNear: mat(C.ridgeNear, { roughness: 1 }),
    ridgeFar: mat(C.ridgeFar, { roughness: 1 })
};

/* Helper: create a mesh and attach it to a parent. */
function mesh(geometry, material, x = 0, y = 0, z = 0, parent) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    if (parent) parent.add(m);
    return m;
}

/* Mark objects that must not influence camera framing. */
const noFrame = obj => { obj.userData.excludeFromBounds = true; return obj; };

/* ══ Sky ══════════════════════════════════════════════════════════════════ */
/* Kept well inside a typical camera far plane so it is never clipped away. */
const SKY_RADIUS = 280;

function buildSky(group) {
    const geo = new THREE.SphereGeometry(SKY_RADIUS, 40, 24);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            topColor: { value: new THREE.Color(C.skyTop) },
            midColor: { value: new THREE.Color(C.skyMid) },
            horizonColor: { value: new THREE.Color(C.skyHorizon) },
            sunColor: { value: new THREE.Color(C.sun) },
            sunDir: { value: new THREE.Vector3(-0.52, 0.60, 0.61).normalize() }
        },
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 topColor, midColor, horizonColor, sunColor, sunDir;
            varying vec3 vDir;
            void main() {
                float h = vDir.y;
                vec3 c = mix(horizonColor, midColor, smoothstep(-0.04, 0.30, h));
                c = mix(c, topColor, smoothstep(0.22, 0.85, h));
                float d = max(dot(vDir, normalize(sunDir)), 0.0);
                c += sunColor * pow(d, 900.0) * 3.0;   // the disc itself
                c += sunColor * pow(d, 12.0) * 0.35;   // tight bloom
                c += sunColor * pow(d, 2.5) * 0.10;    // broad atmospheric haze
                gl_FragColor = vec4(c, 1.0);
            }
        `
    });
    const sky = new THREE.Mesh(geo, material);
    sky.frustumCulled = false;
    group.add(noFrame(sky));
    return sky;
}

/* ══ Lighting ═════════════════════════════════════════════════════════════ */
function buildLights(group) {
    const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x8a6236, 0.55);
    group.add(hemi);

    // Key light: warm sun placed on the viewer's side of the scene so the
    // default framing is front-lit rather than a silhouette. Direction matches
    // the sky shader's sunDir.
    const key = new THREE.DirectionalLight(0xfff0cf, 2.35);
    key.position.set(-78, 90, 92);
    key.target.position.set(0, 0, -22);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = -95; cam.right = 95; cam.top = 95; cam.bottom = -95;
    cam.near = 20; cam.far = 340;
    cam.updateProjectionMatrix();
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 2.5;
    group.add(key, key.target);

    // Cool fill from the opposite side so shadowed faces keep their form.
    const fill = new THREE.DirectionalLight(0x9fc4e8, 0.5);
    fill.position.set(90, 45, -70);
    group.add(fill);

    // Warm bounce off the sand.
    const bounce = new THREE.DirectionalLight(0xffcf94, 0.18);
    bounce.position.set(0, -30, 20);
    group.add(bounce);

    return { key, fill, hemi };
}

/* ══ Terrain ══════════════════════════════════════════════════════════════ */
const WATER_Y = -0.5;
const CHANNEL_HALF = 15;

/* Vertex colour = sand above the waterline, light blue below it. This is what
 * turns the riverbed that shows through the water into a second blue rather
 * than a patch of yellow. */
function tintSubmerged(geo, cz, sandHex) {
    const p = geo.attributes.position;
    const sand = new THREE.Color(sandHex);
    const shallow = new THREE.Color(0x63c4d8);
    const c = new THREE.Color();
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const wz = p.getZ(i) + cz;              // world z
        const wy = p.getY(i);                   // height is baked into geometry
        const inChannel = 1 - Math.min(1, Math.max(0, (Math.abs(wz) - CHANNEL_HALF) / 12));
        const depth = Math.min(1, Math.max(0, (WATER_Y - wy) / 1.4));
        c.copy(sand).lerp(shallow, inChannel * depth);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function terrainMesh(group, { w, d, cx, cz, y, amp, freq, color, material, segments, octaves = 5, seedOffset = 0 }) {
    const geo = new THREE.PlaneGeometry(w, d, segments, Math.round(segments * (d / w)));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i) + cx + seedOffset;
        const pz = pos.getZ(i) + cz;
        // Taper the noise to zero at the edges so banks meet cleanly.
        const ex = Math.min(1, Math.abs(pos.getX(i)) / (w / 2));
        const ez = Math.min(1, Math.abs(pos.getZ(i)) / (d / 2));
        const edge = (1 - ex * ex) * (1 - ez * ez);
        pos.setY(i, y + fbm(px * freq + seedOffset, pz * freq, octaves) * amp * (0.35 + 0.65 * edge));
    }
    geo.computeVertexNormals();
    tintSubmerged(geo, cz, color);
    // Clone: these materials are shared with dunes/pyramids, which have no
    // colour attribute and would render black with vertexColors on.
    const mat2 = material.clone();
    mat2.vertexColors = true;
    const m = mesh(geo, mat2, cx, 0, cz, group);
    m.receiveShadow = true;
    return m;
}

function buildTerrain(group) {
    // Banks deliberately overlap the water so the riverbed shows through; the
    // submerged part is tinted light blue by tintSubmerged().
    terrainMesh(group, {
        w: 300, d: 150, cx: 0, cz: -95, y: -0.6, amp: 4.2, freq: 0.012,
        segments: 150, octaves: 5, color: C.sandFar, material: MAT.sandFar
    });
    terrainMesh(group, {
        // Sits just below the waterline, so the part inside the channel is
        // tinted light blue and the rest stays a green bank.
        w: 300, d: 26, cx: 0, cz: -13.5, y: -0.78, amp: 0.7, freq: 0.05,
        segments: 190, octaves: 3, color: C.sandGreen, material: MAT.grass
    });
    terrainMesh(group, {
        w: 300, d: 90, cx: 0, cz: 40, y: -0.6, amp: 1.5, freq: 0.018,
        segments: 190, octaves: 4, color: C.sandNear, material: MAT.sand
    });
}

/* Hazy ridges on the horizon for depth. Excluded from framing. */
function buildRidges(group) {
    const ridge = (w, d, cz, height, color, material, freq, seedOffset) => {
        const geo = new THREE.PlaneGeometry(w, d, 120, 26);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const t = (x / (w / 2) + 1) / 2;                 // 0..1 along the ridge
            const ridgeShape = Math.sin(Math.PI * Math.pow(t, 0.9));  // taper to the ends
            const n = fbm(x * freq + seedOffset, cz * freq, 5);
            const h = (0.35 + 0.65 * n) * height * (0.25 + 0.75 * ridgeShape);
            pos.setY(i, Math.max(0, h));
        }
        geo.computeVertexNormals();
        const m = mesh(geo, material, 0, -1, cz, group);
        noFrame(m);
        return m;
    };
    ridge(560, 120, -195, 58, C.ridgeNear, MAT.ridgeNear, 0.006, 11);
    ridge(680, 150, -282, 92, C.ridgeFar, MAT.ridgeFar, 0.004, 27);
}

/* Image-based lighting is deliberately not used here. A PMREM cubeUV texture
 * needs a working float render target; where that is unavailable the texture
 * samples as black, which blackens every material in the scene. Metals are
 * therefore kept low and carry a little emissive warmth instead, so gold and
 * water read correctly with no environment at all. */
function buildEnvironment() {
    return null;
}

/* ══ Water ════════════════════════════════════════════════════════════════ */
const WATER_W = 300, WATER_D = 30, WATER_SEG_X = 190, WATER_SEG_Z = 34;

function buildWater(group) {
    const geo = new THREE.PlaneGeometry(WATER_W, WATER_D, WATER_SEG_X, WATER_SEG_Z);
    geo.rotateX(-Math.PI / 2);

    // Two shades of blue: a deep channel that lightens toward the banks, so the
    // river reads as depth rather than as one flat colour.
    {
        const p = geo.attributes.position;
        const deep = new THREE.Color(0x0d4a66);
        const shallow = new THREE.Color(0x3fa8cc);
        const colors = new Float32Array(p.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            const t = Math.min(1, Math.abs(p.getZ(i)) / (WATER_D / 2));
            c.copy(deep).lerp(shallow, t * t);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // Low metalness plus a faint emissive: without image-based lighting a
    // metallic, low-roughness surface would have nothing to reflect and go black.
    const water = new THREE.Mesh(geo, mat(0xffffff, {
        vertexColors: true,
        roughness: 0.16,
        metalness: 0.0,
        opacity: 0.92,
        emissive: 0x08222f,
        emissiveIntensity: 0.35
    }));
    water.position.set(0, WATER_Y, 0);
    water.receiveShadow = true;
    group.add(water);
    return { mesh: water, geometry: geo, base: Float32Array.from(geo.attributes.position.array) };
}

/* ══ Palms ═════════════════════════════════════════════════════════════════ */
function frondGeometry(length, width, droop, teeth = 9) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= teeth; i++) {
        const t = i / teeth;
        const taper = Math.sin(Math.PI * Math.pow(t, 0.8));
        // Alternate full/short widths to read as separate leaflets.
        const w = width * taper * (i % 2 === 0 ? 1 : 0.52);
        shape.lineTo(t * length, w);
    }
    for (let i = teeth; i >= 0; i--) {
        const t = i / teeth;
        const taper = Math.sin(Math.PI * Math.pow(t, 0.8));
        const w = width * taper * (i % 2 === 0 ? 1 : 0.52);
        shape.lineTo(t * length, -w);
    }
    shape.lineTo(0, 0);

    const geo = new THREE.ShapeGeometry(shape);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const w = pos.getY(i);
        const t = Math.min(1, x / length);
        // Droop downward, plus a soft fold along the spine.
        const fold = -Math.abs(w) * 0.10 * t;
        pos.setXYZ(i, x, -droop * t * t + fold, w);
    }
    geo.computeVertexNormals();
    return geo;
}

function trunkGeometry(height, baseR, topR, bend, radial = 10, rings = 14) {
    const geo = new THREE.CylinderGeometry(topR, baseR, height, radial, rings, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y + height / 2) / height;      // 0 base → 1 top
        pos.setZ(i, pos.getZ(i) + bend * t * t);
        pos.setX(i, pos.getX(i) * (1 - 0.12 * t));
    }
    geo.computeVertexNormals();
    return geo;
}

const FROND_LENGTH = 3.4;

function palm(group, x, z, scale = 1, frondCount = 10) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.rotation.y = rr(0, Math.PI * 2);
    group.add(tree);

    const height = rr(4.4, 6.2);
    const lean = rr(-0.5, 0.5);
    const trunk = mesh(trunkGeometry(height, 0.30, 0.17, lean), MAT.timber, 0, height / 2, 0, tree);
    trunk.castShadow = true;

    // Crown: fronds radiate out and droop, plus a collar and coconuts.
    const crown = new THREE.Group();
    crown.position.set(0, height, lean);
    tree.add(crown);

    for (let i = 0; i < frondCount; i++) {
        const frond = mesh(
            frondGeometry(FROND_LENGTH * rr(0.85, 1.15), rr(0.46, 0.62), rr(0.9, 1.5)),
            i % 3 === 0 ? MAT.frondLit : MAT.frond,
            0, 0, 0,
            crown
        );
        frond.rotation.y = (i / frondCount) * Math.PI * 2 + rr(-0.12, 0.12);
        frond.rotation.z = rr(0.18, 0.62);
        frond.castShadow = true;
    }

    const collar = mesh(new THREE.SphereGeometry(0.34, 10, 8), MAT.timber, 0, -0.08, 0, crown);
    collar.scale.set(1, 0.7, 1);

    for (let i = 0; i < 3; i++) {
        const nut = mesh(new THREE.SphereGeometry(0.15, 8, 6), MAT.coconut,
            rr(-0.22, 0.22), -0.3, rr(-0.22, 0.22), crown);
        nut.castShadow = true;
    }

    return { tree, crown };
}

function buildPalms(group) {
    const crowns = [];

    // Avenue along the palace terrace.
    [[-30, 6], [-24, 8.5], [-6, 8], [4, 7]].forEach(([x, z]) => {
        crowns.push(palm(group, -14 + x, -27 + z, rr(1.05, 1.35)).crown);
    });

    // Far bank avenue.
    for (let i = 0; i < 14; i++) {
        crowns.push(palm(group, -100 + i * 14.5 + rr(-4, 4), -12.5 - rr(0, 3), rr(0.85, 1.3)).crown);
    }

    // Near bank cluster.
    [[-16, 20], [-3, 26], [14, 18], [26, 24], [-32, 16], [6, 31], [-44, 27], [38, 30], [52, 20]]
        .forEach(([x, z]) => crowns.push(palm(group, x, z, rr(1.2, 1.6)).crown));

    // A few scattered mid-ground palms for depth.
    for (let i = 0; i < 8; i++) {
        crowns.push(palm(group, rr(-110, 110), rr(-9.5, -6.5), rr(0.9, 1.4)).crown);
    }

    return crowns;
}

/* ══ Reeds and grass (instanced) ═══════════════════════════════════════════ */
function bladeGeometry(height, width) {
    const geo = new THREE.PlaneGeometry(width, height, 1, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y + height / 2) / height;
        pos.setX(i, pos.getX(i) * (1 - t * 0.88));
        pos.setZ(i, Math.pow(t, 2) * height * 0.22);
    }
    geo.computeVertexNormals();
    return geo;
}

function buildReeds(group) {
    const COUNT = 2200;
    const geo = bladeGeometry(1.7, 0.11);
    const material = mat(C.reed, { roughness: 0.9, side: THREE.DoubleSide });
    const reeds = new THREE.InstancedMesh(geo, material, COUNT);
    reeds.castShadow = false;
    reeds.receiveShadow = false;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const euler = new THREE.Euler();
    const colour = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
        // Cluster along both water edges, with a long tail inland.
        const side = rand() < 0.5 ? -1 : 1;
        const edge = 8.6 + Math.pow(rand(), 2) * 7.5;
        pos.set(rr(-140, 140), 0, side * edge + rr(-1.6, 1.6));
        euler.set(rr(-0.22, 0.22), rr(0, Math.PI * 2), rr(-0.28, 0.28));
        q.setFromEuler(euler);
        const s = rr(0.55, 1.5);
        scl.set(s, s * rr(0.8, 1.35), s);
        m.compose(pos, q, scl);
        reeds.setMatrixAt(i, m);
        colour.setHex(rand() < 0.28 ? C.reedDry : C.reed);
        colour.offsetHSL(rr(-0.02, 0.02), rr(-0.06, 0.06), rr(-0.05, 0.05));
        reeds.setColorAt(i, colour);
    }
    reeds.instanceMatrix.needsUpdate = true;
    if (reeds.instanceColor) reeds.instanceColor.needsUpdate = true;
    group.add(reeds);
    return reeds;
}

/* ══ Dunes, pyramids, obelisks ════════════════════════════════════════════ */
function buildDunes(group) {
    const geoCache = new Map();
    for (let i = 0; i < 11; i++) {
        const x = rr(-130, 130);
        const z = -30 - Math.pow(rand(), 0.7) * 95;
        const radius = rr(9, 24);
        const height = rr(4, 11);
        const seg = geoCache.get(radius) || null;
        const geo = seg || new THREE.ConeGeometry(radius, height, 26, 4);
        if (!seg) geoCache.set(radius, geo);
        // Soften the cone so it reads as a wind-shaped dune, not a pyramid.
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            const py = pos.getY(k);
            const t = (py + height / 2) / height;
            const wobble = fbm(pos.getX(k) * 0.09 + i, pos.getZ(k) * 0.09, 3) * radius * 0.16 * (1 - t);
            pos.setX(k, pos.getX(k) + wobble);
            pos.setZ(k, pos.getZ(k) + wobble * 0.7);
        }
        geo.computeVertexNormals();
        const dune = mesh(geo.clone(), MAT.sandFar, x, height / 2 - 1.2, z, group);
        dune.rotation.y = rr(0, Math.PI * 2);
        dune.receiveShadow = true;
        dune.castShadow = true;
    }
}

function buildPyramids(group) {
    const pyramid = (x, z, size, casing) => {
        const p = new THREE.Group();
        p.position.set(x, -0.5, z);
        p.rotation.y = rr(-0.2, 0.2);
        group.add(p);

        const body = mesh(
            new THREE.ConeGeometry(size * 0.7071, size * 0.65, 4, 3),
            MAT.sand,
            0, size * 0.325, 0, p
        );
        body.rotation.y = Math.PI / 4;
        body.castShadow = true;
        body.receiveShadow = true;

        // Remnant of the polished casing at the apex.
        if (casing) {
            const cap = mesh(
                new THREE.ConeGeometry(size * 0.7071 * 0.16, size * 0.65 * 0.17, 4, 1),
                MAT.stone,
                0, size * 0.65 * 0.915, 0, p
            );
            cap.rotation.y = Math.PI / 4;
            cap.castShadow = true;
        }

        // Rubble skirt.
        for (let i = 0; i < 7; i++) {
            const a = rr(0, Math.PI * 2);
            const r = size * rr(0.5, 0.8);
            const rock = mesh(new THREE.DodecahedronGeometry(rr(0.5, 1.3), 0), MAT.stoneDark,
                Math.cos(a) * r, rr(0.1, 0.5), Math.sin(a) * r, p);
            rock.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
            rock.castShadow = true;
        }
        return p;
    };

    pyramid(26, -48, 30, true);
    pyramid(48, -58, 22, false);
    pyramid(6, -66, 15, true);
}

function obelisk(parent, x, y, z, height, material) {
    const shaft = height * 0.86;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);

    mesh(new THREE.CylinderGeometry(height * 0.075, height * 0.095, shaft, 4, 1), material, 0, shaft / 2, 0, g)
        .rotation.y = Math.PI / 4;
    mesh(new THREE.ConeGeometry(height * 0.075, height * 0.14, 4, 1), MAT.gold, 0, shaft + height * 0.07, 0, g)
        .rotation.y = Math.PI / 4;

    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
}

/* ══ Temple / palace ══════════════════════════════════════════════════════ */
function column(parent, x, z, height, radius) {
    const col = new THREE.Group();
    col.position.set(x, 0, z);
    parent.add(col);

    mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.5, height * 0.05, 20), MAT.stoneDark, 0, height * 0.025, 0, col);
    mesh(new THREE.CylinderGeometry(radius * 0.86, radius, height * 0.9, 20, 3), MAT.stone, 0, height * 0.5, 0, col);
    mesh(new THREE.BoxGeometry(radius * 2.7, height * 0.06, radius * 2.7), MAT.stoneDark, 0, height * 0.96, 0, col);
    mesh(new THREE.BoxGeometry(radius * 2.2, height * 0.03, radius * 2.2), MAT.gold, 0, height * 0.99, 0, col);
    return col;
}

function statue(parent, x, y, z, material) {
    const s = new THREE.Group();
    s.position.set(x, y, z);
    parent.add(s);

    mesh(new THREE.BoxGeometry(2.0, 0.5, 1.6), MAT.stoneDark, 0, 0.25, 0, s);          // plinth
    mesh(new THREE.CylinderGeometry(0.52, 0.66, 2.4, 12), material, 0, 1.7, 0, s);        // body
    mesh(new THREE.CylinderGeometry(0.30, 0.44, 0.5, 12), material, 0, 3.15, 0, s);       // shoulders
    mesh(new THREE.SphereGeometry(0.34, 14, 12), MAT.gold, 0, 3.62, 0, s);                // head
    // Nemes headdress flanks.
    mesh(new THREE.BoxGeometry(0.16, 1.5, 0.5), material, -0.36, 2.6, 0.02, s);
    mesh(new THREE.BoxGeometry(0.16, 1.5, 0.5), material, 0.36, 2.6, 0.02, s);
    s.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return s;
}

function buildTemple(group) {
    const T = new THREE.Group();
    T.position.set(-14, 0, -27);
    group.add(T);

    /* Podium: three stepped tiers. */
    mesh(new THREE.BoxGeometry(40, 1.1, 20), MAT.stoneDark, 0, 0.55, 0, T).receiveShadow = true;
    mesh(new THREE.BoxGeometry(37, 1.1, 17.5), MAT.stone, 0, 1.65, 0, T).receiveShadow = true;
    mesh(new THREE.BoxGeometry(34.5, 1.2, 15.5), MAT.stone, 0, 2.8, 0, T).receiveShadow = true;

    /* Crenellated parapet around the podium. */
    const merlon = new THREE.BoxGeometry(1.0, 0.9, 0.7);
    for (let i = -19; i <= 19; i++) {
        mesh(merlon, MAT.stone, i * 1.05, 4.35, -9.4, T);
        mesh(merlon, MAT.stone, i * 1.05, 4.35, 9.4, T);
    }
    for (let i = -8; i <= 8; i++) {
        mesh(merlon, MAT.stone, -19.4, 4.35, i * 1.05, T);
        mesh(merlon, MAT.stone, 19.4, 4.35, i * 1.05, T);
    }

    /* Great hypostyle hall. */
    mesh(new THREE.BoxGeometry(30, 5.2, 11), MAT.stone, 0, 5.9, -1.5, T).receiveShadow = true;
    mesh(new THREE.BoxGeometry(31, 0.55, 12), MAT.trim, 0, 8.7, -1.5, T);       // cornice
    mesh(new THREE.BoxGeometry(30.6, 0.28, 11.6), MAT.gold, 0, 9.05, -1.5, T);  // gilded band

    // Two rows of nine columns, with architrave beams above.
    for (let i = -4; i <= 4; i++) {
        column(T, i * 3.1, 3.4, 5.2, 0.42);
        if (Math.abs(i) > 1) column(T, i * 3.1, -6.2, 5.2, 0.42);
    }
    mesh(new THREE.BoxGeometry(27, 0.7, 1.1), MAT.stoneDark, 0, 8.15, 3.4, T);
    mesh(new THREE.BoxGeometry(27, 0.7, 1.1), MAT.stoneDark, 0, 8.15, -6.2, T);

    /* Upper shrine. */
    mesh(new THREE.BoxGeometry(11, 2.8, 7.4), MAT.stone, 0, 10.3, -2.5, T).receiveShadow = true;
    mesh(new THREE.BoxGeometry(11.8, 0.4, 8.2), MAT.gold, 0, 11.9, -2.5, T);

    /* Pylons flanking the gate. */
    const pylon = x => {
        const p = new THREE.Group();
        p.position.set(x, 3.4, 4.6);
        T.add(p);
        const h = 12.5;
        mesh(new THREE.CylinderGeometry(2.0, 2.7, h, 4, 1), MAT.stone, 0, h / 2, 0, p).rotation.y = Math.PI / 4;
        mesh(new THREE.BoxGeometry(5.0, 0.5, 4.0), MAT.stoneDark, 0, h + 0.25, 0, p);
        // Cavetto cornice.
        mesh(new THREE.CylinderGeometry(1.55, 2.6, 1.5, 4, 1), MAT.gold, 0, h + 1.25, 0, p).rotation.y = Math.PI / 4;
        // Flagstaff niche and a recessed door.
        mesh(new THREE.BoxGeometry(0.22, 4.2, 0.3), MAT.trim, 0, h * 0.72, 2.3, p);
        mesh(new THREE.BoxGeometry(0.7, 3.2, 0.3), MAT.red, 0, h * 0.55, 2.32, p);
        p.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        return p;
    };
    pylon(-5.5);
    pylon(5.5);

    /* Gate: recessed doors, lintel, threshold. */
    mesh(new THREE.BoxGeometry(6.4, 3.4, 0.5), MAT.granite, 0, 5.2, 4.9, T);
    mesh(new THREE.BoxGeometry(2.3, 3.0, 0.35), MAT.timberDark, -1.5, 4.9, 5.05, T);
    mesh(new THREE.BoxGeometry(2.3, 3.0, 0.35), MAT.timberDark, 1.5, 4.9, 5.05, T);
    mesh(new THREE.BoxGeometry(7.2, 0.55, 1.1), MAT.trim, 0, 7.05, 4.8, T);
    mesh(new THREE.BoxGeometry(7.0, 0.22, 1.2), MAT.gold, 0, 7.4, 4.8, T);

    /* Obelisks either side of the approach. */
    obelisk(T, -8.6, 3.4, 6.4, 6.2, MAT.stone);
    obelisk(T, 8.6, 3.4, 6.4, 6.2, MAT.stone);

    /* Statues on the terrace. */
    statue(T, -12.5, 3.4, 7.0, MAT.stone);
    statue(T, 12.5, 3.4, 7.0, MAT.stone);

    /* Grand stair down to the near bank. */
    for (let i = 0; i < 9; i++) {
        const w = 12 - i * 0.5;
        mesh(new THREE.BoxGeometry(w, 0.42, 1.1), MAT.stone, 0, 0.21 + i * 0.4, 9.6 + i * 0.95, T)
            .receiveShadow = true;
    }

    T.traverse(o => { if (o.isMesh && !o.receiveShadow) o.receiveShadow = true; });
    return T;
}

/* Banner poles with cloth that ripples. */
function buildBanners(group, temple) {
    const banners = [];
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 7.5, 8);
    const clothGeo = new THREE.PlaneGeometry(1.5, 2.6, 8, 10);
    const clothBase = Float32Array.from(clothGeo.attributes.position.array);

    [[-7.2, 7.2], [7.2, 7.2]].forEach(([x, z], i) => {
        mesh(poleGeo, MAT.timber, x, 3.4 + 3.75, z, temple).castShadow = true;
        mesh(new THREE.SphereGeometry(0.16, 10, 8), MAT.gold, x, 3.4 + 7.6, z, temple);

        const cloth = mesh(clothGeo, mat(i ? C.trim : C.red, {
            roughness: 0.9,
            side: THREE.DoubleSide
        }), x + 0.8, 3.4 + 5.6, z, temple);
        banners.push({ cloth, base: clothBase });
    });

    return banners;
}

/* Braziers with a flickering flame. */
function buildBraziers(group, temple) {
    const flames = [];
    const bowlGeo = new THREE.CylinderGeometry(0.42, 0.24, 0.5, 14, 1, true);
    const flameGeo = new THREE.ConeGeometry(0.3, 1.0, 10);

    [[-10.5, 9.0], [10.5, 9.0], [-4.2, 5.4], [4.2, 5.4]].forEach(([x, z]) => {
        mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.5, 10), MAT.granite, x, 3.4 + 0.75, z, temple);
        mesh(bowlGeo, MAT.gold, x, 3.4 + 1.6, z, temple);
        const flame = mesh(flameGeo, mat(0xffb347, {
            roughness: 1,
            emissive: 0xff8c1a,
            emissiveIntensity: 2.2
        }), x, 3.4 + 2.3, z, temple);
        flames.push(flame);
    });

    return flames;
}

/* ══ Distant town ══════════════════════════════════════════════════════════ */
function buildTown(group) {
    const town = new THREE.Group();
    town.position.set(30, 0, -62);
    group.add(town);

    for (let i = 0; i < 46; i++) {
        const w = rr(2.2, 5.0);
        const h = rr(2.0, 5.5);
        const d = rr(2.2, 4.6);
        // Slight taper reads as mudbrick.
        const house = mesh(new THREE.CylinderGeometry(w * 0.44, w * 0.5, h, 4, 1),
            rand() < 0.5 ? MAT.mud : MAT.mudDark,
            rr(-26, 26), h / 2, rr(-14, 14), town);
        house.rotation.y = rr(0, Math.PI);
        house.scale.z = d / w;
        house.castShadow = true;
        house.receiveShadow = true;

        // Flat roof parapet.
        if (rand() < 0.4) {
            mesh(new THREE.BoxGeometry(w * 0.7, 0.4, d * 0.7), MAT.mudDark,
                house.position.x, h + 0.2, house.position.z, town);
        }
    }

    obelisk(town, -14, 0, -4, 11, MAT.stone);
    obelisk(town, 12, 0, 3, 8.5, MAT.stone);
    return town;
}

/* ══ Feluccas ═════════════════════════════════════════════════════════════ */
/* Parametric hull: stations along the length, girth from keel to gunwale. */
function hullGeometry(length, beam, draft, freeboard, stations = 44, girth = 9) {
    const positions = [];
    const indices = [];

    for (let i = 0; i <= stations; i++) {
        const t = (i / stations) * 2 - 1;                 // -1 bow … 1 stern
        const x = t * (length / 2);
        // Fine at the ends, fuller amidships.
        const fullness = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.42);
        const rocker = Math.pow(Math.abs(t), 2.4) * draft * 0.35;   // keel rises at the ends
        for (let j = 0; j <= girth; j++) {
            const s = j / girth;                          // 0 keel … 1 gunwale
            const halfBeam = (beam / 2) * fullness * Math.pow(s, 0.34);
            const y = -draft + rocker + s * (draft + freeboard);
            positions.push(x, y, -halfBeam);
        }
    }

    const row = girth + 1;
    for (let i = 0; i < stations; i++) {
        for (let j = 0; j < girth; j++) {
            const a = i * row + j;
            const b = a + 1;
            const c = a + row;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

/* Cambered sail: a plane bulged out by a parabola. */
function sailGeometry(width, height, camber) {
    const geo = new THREE.PlaneGeometry(width, height, 12, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const u = x / (width / 2);            // -1 … 1
        const v = (y + height / 2) / height;  // 0 … 1
        pos.setZ(i, camber * (1 - u * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)));
    }
    geo.computeVertexNormals();
    return geo;
}

function felucca(group, x, z, scale, sailColor, sailMat) {
    const boat = new THREE.Group();
    boat.position.set(x, -0.2, z);
    boat.scale.setScalar(scale);
    boat.rotation.y = rr(-0.25, 0.25);
    group.add(boat);

    const L = 5.4, B = 1.5, draft = 0.5, freeboard = 0.55;

    const hull = mesh(hullGeometry(L, B, draft, freeboard), MAT.timber, 0, 0, 0, boat);
    hull.castShadow = true;
    hull.receiveShadow = true;

    // Gunwale rail and a couple of thwarts.
    mesh(new THREE.BoxGeometry(L * 0.96, 0.09, 0.1), MAT.timberDark, 0, freeboard - draft * 0.1, B * 0.42, boat);
    mesh(new THREE.BoxGeometry(L * 0.96, 0.09, 0.1), MAT.timberDark, 0, freeboard - draft * 0.1, -B * 0.42, boat);
    [-1.1, 0.5].forEach(tx => {
        mesh(new THREE.BoxGeometry(0.22, 0.08, B * 0.86), MAT.timberDark, tx, freeboard * 0.55, 0, boat);
    });

    // Deck.
    mesh(new THREE.BoxGeometry(L * 0.9, 0.06, B * 0.7), MAT.timberDark, 0, freeboard * 0.5, 0, boat);

    // Stern canopy.
    const canopy = mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.7, 14, 1, false, 0, Math.PI),
        MAT.timberDark, -1.5, freeboard * 0.72, 0, boat);
    canopy.rotation.z = Math.PI / 2;
    canopy.castShadow = true;

    // Mast, yard and sail.
    const mastH = 6.2;
    mesh(new THREE.CylinderGeometry(0.055, 0.075, mastH, 8), MAT.timber, 0.35, freeboard * 0.5 + mastH / 2, 0, boat)
        .castShadow = true;
    const yard = mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.5, 8), MAT.timber,
        0.35, freeboard * 0.5 + mastH * 0.72, 0, boat);
    yard.rotation.x = Math.PI / 2;

    const sail = mesh(sailGeometry(2.9, 3.5, 0.34), sailMat || MAT.sail,
        0.35, freeboard * 0.5 + mastH * 0.72 - 1.75, 0, boat);
    sail.rotation.y = Math.PI / 2;
    sail.castShadow = true;

    // Rigging.
    [[-2.2, 0.25], [2.1, -0.25]].forEach(([rx, rz]) => {
        const from = new THREE.Vector3(0.35, freeboard * 0.5 + mastH, 0);
        const to = new THREE.Vector3(rx, freeboard * 0.5 + 0.1, rz);
        const dir = to.clone().sub(from);
        const rope = mesh(new THREE.CylinderGeometry(0.018, 0.018, dir.length(), 5), MAT.rope, 0, 0, 0, boat);
        rope.position.copy(from).add(to).multiplyScalar(0.5);
        rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    });

    // Oars shipped along the gunwale.
    [-1, 1].forEach(side => {
        const oar = mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.6, 6), MAT.timber,
            -0.4, freeboard * 0.6, side * (B * 0.5 + 0.1), boat);
        oar.rotation.set(0, 0, Math.PI / 2);
        oar.rotation.y = side * 0.08;
    });

    // Cargo: a jar and two crates.
    mesh(new THREE.SphereGeometry(0.24, 10, 8), MAT.mud, 1.0, freeboard * 0.7, 0.28, boat);
    mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), MAT.timber, 1.6, freeboard * 0.7, -0.25, boat);
    mesh(new THREE.BoxGeometry(0.42, 0.34, 0.4), MAT.timberDark, 1.6, freeboard * 0.7 + 0.36, -0.25, boat);

    return boat;
}

function buildBoats(group) {
    const boats = [
        { obj: felucca(group, -20, 2, 1.2, 0xfaf0dc, MAT.sail), speed: 1.6 },
        { obj: felucca(group, 25, -3.5, 0.95, 0xf5e2b8, mat(0xf5e2b8, { roughness: 0.85, side: THREE.DoubleSide, opacity: 0.94 })), speed: -1.15 },
        { obj: felucca(group, 0, 4.5, 0.7, 0xfff6e6, mat(0xfff6e6, { roughness: 0.85, side: THREE.DoubleSide, opacity: 0.94 })), speed: 0.9 },
        { obj: felucca(group, -58, -2.0, 1.05, 0xf2e4c4, mat(0xf2e4c4, { roughness: 0.85, side: THREE.DoubleSide, opacity: 0.94 })), speed: 1.35 },
        { obj: felucca(group, 46, 5.5, 0.8, 0xfaeeda, mat(0xfaeeda, { roughness: 0.85, side: THREE.DoubleSide, opacity: 0.94 })), speed: -0.85 }
    ];
    boats[1].obj.rotation.y = Math.PI;
    return boats;
}

/* ══ Birds ════════════════════════════════════════════════════════════════ */
function birdGeometry() {
    const g = new THREE.BufferGeometry();
    // Two swept wings meeting at the body.
    const v = new Float32Array([
        0, 0, 0.16, -0.95, 0.12, -0.30, -0.10, 0, -0.10,
        0, 0, 0.16, 0.10, 0, -0.10, 0.95, 0.12, -0.30
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
}

function buildBirds(group) {
    const geo = birdGeometry();
    const material = mat(0x2b2118, { roughness: 1, side: THREE.DoubleSide });
    const birds = [];
    for (let i = 0; i < 11; i++) {
        const b = mesh(geo, material, 0, 0, 0, group);
        b.scale.setScalar(rr(0.7, 1.3));
        noFrame(b);
        birds.push({
            obj: b,
            radius: rr(28, 70),
            height: rr(16, 34),
            speed: rr(0.12, 0.26) * (rand() < 0.5 ? -1 : 1),
            phase: rr(0, Math.PI * 2),
            cx: rr(-30, 30),
            cz: rr(-70, -10)
        });
    }
    return birds;
}

/* ══ Build ════════════════════════════════════════════════════════════════ */
export function build(group, ctx = {}) {
    const sky = buildSky(group);
    buildLights(group);
    buildRidges(group);
    buildTerrain(group);
    const water = buildWater(group);
    buildDunes(group);
    buildPyramids(group);

    const temple = buildTemple(group);
    const banners = buildBanners(group, temple);
    const flames = buildBraziers(group, temple);

    const crowns = buildPalms(group);
    buildReeds(group);
    buildTown(group);
    const boats = buildBoats(group);
    const birds = buildBirds(group);

    let frame = 0;

    return {
        // A gradient sky dome provides the background, so clear the flat colour.
        background: null,
        fog: new THREE.Fog(C.skyHorizon, 80, 380),
        // Headroom past the default far plane for the sky and distant ridges.
        far: 900,
        shadows: true,

        update(t) {
            frame++;

            /* Water: two crossing swells plus a fine chop. */
            const pos = water.geometry.attributes.position;
            const base = water.base;
            for (let i = 0; i < pos.count; i++) {
                const x = base[i * 3], z = base[i * 3 + 2];
                const swell = Math.sin(x * 0.035 + t * 0.55) * 0.16
                    + Math.sin(z * 0.09 - t * 0.8) * 0.09;
                const chop = Math.sin((x + z) * 0.42 + t * 2.1) * 0.028
                    + Math.cos((x - z) * 0.55 - t * 1.7) * 0.022;
                pos.setY(i, swell + chop);
            }
            pos.needsUpdate = true;
            // Normals matter for the specular sheen; every other frame is enough.
            if ((frame & 1) === 0) water.geometry.computeVertexNormals();

            /* Boats: drift downstream, bob and roll. */
            boats.forEach(({ obj, speed }, i) => {
                obj.position.x += speed * 0.012;
                if (obj.position.x > 130) obj.position.x = -130;
                if (obj.position.x < -130) obj.position.x = 130;
                obj.position.y = -0.2 + Math.sin(t * 1.4 + i) * 0.07;
                obj.rotation.z = Math.sin(t * 1.1 + i * 0.7) * 0.035;
                obj.rotation.x = Math.sin(t * 0.9 + i) * 0.02;
            });

            /* Palm crowns: slow wind sway. */
            crowns.forEach((crown, i) => {
                crown.rotation.z = Math.sin(t * 0.7 + i * 0.6) * 0.035;
                crown.rotation.x = Math.cos(t * 0.55 + i * 0.4) * 0.028;
            });

            /* Banner cloth: travelling ripple. */
            banners.forEach(({ cloth, base: cbase }, bi) => {
                const p = cloth.geometry.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const x = cbase[i * 3], y = cbase[i * 3 + 1];
                    const u = (x + 0.75) / 1.5;
                    p.setZ(i, Math.sin(u * 5.2 - t * 3.4 + bi) * 0.16 * u
                        + Math.sin(y * 3 + t * 2.2) * 0.04 * u);
                }
                p.needsUpdate = true;
                cloth.geometry.computeVertexNormals();
            });

            /* Braziers: flicker. */
            flames.forEach((flame, i) => {
                const f = 0.82 + Math.sin(t * 9.3 + i * 2.1) * 0.12
                    + Math.sin(t * 21.7 + i) * 0.06;
                flame.scale.set(f, 0.9 + f * 0.22, f);
                flame.material.emissiveIntensity = 1.8 + f * 0.8;
            });

            /* Birds: circle and flap. */
            birds.forEach(b => {
                const a = t * b.speed + b.phase;
                b.obj.position.set(
                    b.cx + Math.cos(a) * b.radius,
                    b.height + Math.sin(a * 2.3) * 2.2,
                    b.cz + Math.sin(a) * b.radius * 0.7
                );
                b.obj.rotation.y = -a + Math.PI / 2;
                b.obj.rotation.z = Math.sin(a * 2.3) * 0.3;
                const flap = Math.sin(t * 7.5 + b.phase) * 0.55;
                b.obj.scale.y = 0.7 + Math.abs(flap) * 0.8;
            });
        }
    };
}

export default { build };
