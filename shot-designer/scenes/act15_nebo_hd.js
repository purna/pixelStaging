/**
 * Mount Nebo — High Definition
 * ----------------------------
 * Same composition as moses-nebo.js, with:
 *   - gradient sky dome with sun glow
 *   - shadow-casting key light and cool fill
 *   - renderer shadow map (shadows: true)
 *
 * Contract: exports build(group, opts) -> { update, background, fog, shadows }.
 */

import THREE from '../js/three.js';
import { build as base } from './moses-nebo.js';

const SKY_RADIUS = 280;
const C = { top: 4876954, mid: 11060444, horizon: 16767392, sun: 16773839 };

/* Mark objects that must not influence camera framing. */
const noFrame = obj => { obj.userData.excludeFromBounds = true; return obj; };

function buildSky(group) {
    const geo = new THREE.SphereGeometry(SKY_RADIUS, 40, 24);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            topColor: { value: new THREE.Color(C.top) },
            midColor: { value: new THREE.Color(C.mid) },
            horizonColor: { value: new THREE.Color(C.horizon) },
            sunColor: { value: new THREE.Color(C.sun) },
            sunDir: { value: new THREE.Vector3(-0.52, 0.42, 0.61).normalize() }
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

export function build(group, opts) {
    const handle = base(group, opts);
    buildSky(group);

    // shadow-casting key light matched to the sky dome's sun
    const key = new THREE.DirectionalLight(0xfff0cf, 1.5);
    key.position.set(-62, 50, 73);
    key.target.position.set(0, 0, 0);
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

    // cool fill from the opposite side so shadowed faces keep their form
    const fill = new THREE.DirectionalLight(0x9fc4e8, 0.45);
    fill.position.set(90, 45, -70);
    group.add(fill);

    return { ...handle, shadows: true };
}

export default { build };
