/**
 * Easing functions for shot animation
 * Adapted from shot-designer easing.js
 */

export const D2R = Math.PI / 180;

export const clamp = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, u) => a[0] + (a[1] - a[0]) * u;

export const EASING = {
    io: (u) => u * u * (3 - 2 * u),      // smoothstep
    in: (u) => u * u,                    // ease in
    out: (u) => 1 - (1 - u) * (1 - u),  // ease out
    lin: (u) => u,                       // linear
    ramp: (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2  // smooth ramp
};

export const EASING_NAMES = ['io', 'in', 'out', 'lin', 'ramp'];

export function getEasing(name) {
    return EASING[name] || EASING.io;
}

export function lerpArray(arr, u) {
    if (!Array.isArray(arr)) return arr;
    if (arr.length === 1) return arr[0];
    return lerp(arr, u);
}
/** Cubic bezier easing with x1,y1,x2,y2 control points. */
export function cubicBezierEasing(curve, x) {
    if (!Array.isArray(curve) || curve.length !== 4) return x;
    const [x1, y1, x2, y2] = curve;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        const X = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
        if (X < x) lo = t;
        else hi = t;
    }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}
