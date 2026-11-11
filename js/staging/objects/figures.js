import * as THREE from 'three';
import { stagingMaterial } from './primitives.js';

/**
 * Staging figures — low-poly "blocking puppet" actors.
 * Procedural so poses can be generated (standing / seated / walking)
 * and scale variants (adult / child) are exact per the spec:
 *   adult standing ≈ 1.75 m, seated eye height ≈ 1.1 m, child ≈ 1.2 m.
 */

export const figurePresets = {
    'figure-standing': {
        label: 'Actor (standing)',
        defaultColor: 0xff6b6b,
        params: { pose: 'standing', scale: 'adult' },
        create: (params, material) => buildFigure('standing', params.scale === 'child', material)
    },
    'figure-seated': {
        label: 'Actor (seated)',
        defaultColor: 0xff6b6b,
        params: { pose: 'seated', scale: 'adult' },
        create: (params, material) => buildFigure('seated', params.scale === 'child', material)
    },
    'figure-walking': {
        label: 'Actor (walking)',
        defaultColor: 0xff6b6b,
        params: { pose: 'walking', scale: 'adult' },
        create: (params, material) => buildFigure('walking', params.scale === 'child', material)
    },
    'figure-child': {
        label: 'Child',
        defaultColor: 0x4ecdc4,
        params: { pose: 'standing', scale: 'child', variant: 'child' },
        create: (params, material) => buildFigure(params.pose || 'standing', true, material)
    },
    'figure-boy': {
        label: 'Boy',
        defaultColor: 0x4e9bff,
        params: { pose: 'standing', scale: 'child', variant: 'boy' },
        create: (params, material) => buildFigure('standing', true, material)
    },
    'figure-girl': {
        label: 'Girl',
        defaultColor: 0xff8fcf,
        params: { pose: 'standing', scale: 'child', variant: 'girl' },
        create: (params, material) => buildFigure('standing', true, material)
    },
    'figure-child-seated': {
        label: 'Child (seated)',
        defaultColor: 0x4ecdc4,
        params: { pose: 'seated', scale: 'child', variant: 'child' },
        create: (params, material) => buildFigure('seated', true, material)
    },
    'figure-boy-seated': {
        label: 'Boy (seated)',
        defaultColor: 0x4e9bff,
        params: { pose: 'seated', scale: 'child', variant: 'boy' },
        create: (params, material) => buildFigure('seated', true, material)
    },
    'figure-girl-seated': {
        label: 'Girl (seated)',
        defaultColor: 0xff8fcf,
        params: { pose: 'seated', scale: 'child', variant: 'girl' },
        create: (params, material) => buildFigure('seated', true, material)
    }
};

const ADULT = { head: 0.22, torsoH: 0.62, torsoW: 0.34, legH: 0.86, armH: 0.55, hipY: 0.9 };
const CHILD = { head: 0.17, torsoH: 0.42, torsoW: 0.26, legH: 0.52, armH: 0.38, hipY: 0.62 };

/** Standard chair seat heights (metres), shared with chair props for chair-snap. */
export const SEAT_HEIGHTS = { adult: 0.45, child: 0.32 };

function limb(geometry, material, x, y, z, rotX = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.castShadow = true;
    return m;
}

/**
 * Builds a figure group. Origin at floor between feet, +Z facing forward.
 */
function buildFigure(pose, isChild, material) {
    const d = isChild ? CHILD : ADULT;
    const group = new THREE.Group();
    group.name = 'figure-root';

    const skin = stagingMaterial(0xf0c8a0, { roughness: 0.9 });
    const legGeo = new THREE.CapsuleGeometry(d.torsoW * 0.28, d.legH - 0.1, 4, 8);
    const armGeo = new THREE.CapsuleGeometry(d.torsoW * 0.22, d.armH - 0.08, 4, 8);
    const torsoGeo = new THREE.CapsuleGeometry(d.torsoW / 2, d.torsoH - d.torsoW / 2, 4, 12);
    const headGeo = new THREE.SphereGeometry(d.head / 2, 16, 12);

    let hipY, torsoY, headY, legRotX = 0;
    switch (pose) {
        case 'seated':
            hipY = isChild ? 0.32 : 0.45; // chair-seat height
            torsoY = hipY + d.torsoH / 2 - 0.02;
            headY = torsoY + d.torsoH / 2 + d.head / 2 + 0.02;
            break;
        case 'walking':
            hipY = d.hipY - 0.04;
            torsoY = hipY + d.torsoH / 2;
            headY = torsoY + d.torsoH / 2 + d.head / 2 + 0.02;
            legRotX = 0.35;
            break;
        default: // standing
            hipY = d.hipY;
            torsoY = hipY + d.torsoH / 2;
            headY = torsoY + d.torsoH / 2 + d.head / 2 + 0.02;
    }

    // Legs
    const legSpread = d.torsoW * 0.22;
    if (pose === 'seated') {
        const thighLen = 0.42;
        const thighGeo = new THREE.CapsuleGeometry(d.torsoW * 0.28, thighLen, 4, 8);
        const shinLen = hipY - 0.06;
        const shinGeo = new THREE.CapsuleGeometry(d.torsoW * 0.26, shinLen, 4, 8);
        [-1, 1].forEach(s => {
            // Thigh: horizontal, pointing forward (+Z)
            group.add(limb(thighGeo, material, s * legSpread, hipY, thighLen / 2, Math.PI / 2));
            // Shin: vertical, under the knee at the front
            group.add(limb(shinGeo, material, s * legSpread, shinLen / 2, thighLen + 0.04));
        });
    } else {
        [-1, 1].forEach(s => {
            group.add(limb(legGeo, material, s * legSpread, d.legH / 2, 0, s * legRotX * 0.5));
        });
    }

    // Torso
    const torso = new THREE.Mesh(torsoGeo, material);
    torso.position.y = torsoY;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = headY;
    head.castShadow = true;
    group.add(head);

    // Arms
    const shoulderY = torsoY + d.torsoH / 2 - 0.06;
    [-1, 1].forEach(s => {
        group.add(limb(armGeo, material, s * (d.torsoW / 2 + d.torsoW * 0.2),
            shoulderY - d.armH / 2, 0, s * (pose === 'walking' ? -0.4 : -0.05)));
    });

    // Useful measurements for camera / eye-line work
    group.userData.measurements = {
        eyeHeight: headY,
        headHeight: headY + d.head / 2,
        pose,
        isChild
    };
    return group;
}
