/**
 * Single three.js instance for the whole tool.
 *
 * The tool is mid-migration: app.js is still a classic script using the global
 * THREE loaded by a UMD <script> tag, while js/ modules are ES modules that
 * want `import ... from 'three'` via the import map.
 *
 * Loading both would create two separate three.js instances, and objects built
 * by one cannot be relied upon by the other. So resolve once, here:
 *
 *   1. If a global THREE already exists (UMD script tag), use it.
 *   2. Otherwise fall back to the ESM build named by the import map.
 *
 * The dynamic import is lazy, so the ESM build is never downloaded while the
 * UMD global is present.
 */

let instance = null;

if (window.THREE) {
    instance = window.THREE;
} else {
    instance = await import('three');
}

window.THREE = window.THREE || instance;

export default instance;
export { instance as THREE };
