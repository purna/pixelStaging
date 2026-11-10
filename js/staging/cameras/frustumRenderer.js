import * as THREE from 'three';

/**
 * buildFrustumVisual(color) — colour-coded frustum cone lines for one camera
 * rig, built in the rig's local space (camera looks down -Z).
 * Call update(vFovDeg, aspect, depth) to rebuild for lens/aspect changes.
 */
export function buildFrustumVisual(color) {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const lines = new THREE.LineSegments(geometry, material);
    const group = new THREE.Group();
    group.name = 'frustum';
    group.add(lines);

    function update(vFovDeg, aspect, depth = 2.5) {
        const vHalf = Math.tan(THREE.MathUtils.degToRad(vFovDeg) / 2) * depth;
        const hHalf = vHalf * aspect;
        const corners = [
            [-hHalf, -vHalf, -depth], [hHalf, -vHalf, -depth],
            [hHalf, vHalf, -depth], [-hHalf, vHalf, -depth]
        ];
        const verts = [];
        corners.forEach((p, i) => {
            const n = corners[(i + 1) % 4];
            verts.push(0, 0, 0, ...p);   // edge from camera origin
            verts.push(...p, ...n);      // edge along the far rect
        });
        geometry.setFromPoints(verts.map(v => new THREE.Vector3(v[0], v[1], v[2])));
    }

    function setVisible(v) { group.visible = v; }
    function setColor(hex) { material.color.setHex(hex); }

    return { group, update, setVisible, setColor };
}
