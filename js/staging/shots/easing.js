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