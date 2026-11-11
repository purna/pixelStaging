/**
 * EASING + scalar math
 *
 * Extracted verbatim from shot_designer.html by scripts/split-shot-designer.
 */
export const D2R = Math.PI / 180,
    cl = x => Math.min(1, Math.max(0, x)),
    L = (a, u) => a[0] + (a[1] - a[0]) * u;
export const EA = {
    io: u => u * u * (3 - 2 * u),
    in: u => u * u,
    out: u => 1 - (1 - u) * (1 - u),
    lin: u => u,
    ramp: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2
};
