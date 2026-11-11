import * as THREE from 'three';

/**
 * Small 2D orientation gizmo. Draws the world axes projected through the
 * current camera without adding another WebGL canvas.
 */
export class AxisGizmo {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas?.getContext('2d') || null;
        this.size = 92;
        this.dpr = 1;
        this._resize();
        this.axisX = new THREE.Vector3(1, 0, 0);
        this.axisY = new THREE.Vector3(0, 1, 0);
        this.axisZ = new THREE.Vector3(0, 0, 1);
        this.inverse = new THREE.Quaternion();
        this.vector = new THREE.Vector3();
    }

    _resize() {
        if (!this.canvas) return;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = this.size * this.dpr;
        this.canvas.height = this.size * this.dpr;
        this.canvas.style.width = `${this.size}px`;
        this.canvas.style.height = `${this.size}px`;
    }

    update(camera) {
        if (!this.ctx || !camera) return;
        const ctx = this.ctx;
        const size = this.size;
        const center = size / 2;
        const radius = size * 0.34;
        const dpr = this.dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        this.inverse.copy(camera.quaternion).invert();
        const axes = [
            { axis: this.axisX, color: '#ff4d5a', sign: 1 },
            { axis: this.axisY, color: '#7dff6a', sign: 1 },
            { axis: this.axisZ, color: '#4d7cff', sign: 1 },
            { axis: this.axisX, color: '#292929', sign: -1 },
            { axis: this.axisY, color: '#292929', sign: -1 },
            { axis: this.axisZ, color: '#292929', sign: -1 }
        ].map(({ axis, color, sign }) => {
            const v = this.vector.copy(axis).multiplyScalar(sign).applyQuaternion(this.inverse);
            return {
                color,
                sign,
                x: center + v.x * radius,
                y: center - v.y * radius,
                z: v.z
            };
        }).sort((a, b) => a.z - b.z);

        const drawPositive = axes.filter(a => a.sign === 1);
        drawPositive.forEach(a => {
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.lineTo(a.x, a.y);
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        });

        axes.forEach(a => {
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.sign === 1 ? 6.3 : 6, 0, Math.PI * 2);
            ctx.fillStyle = a.color;
            ctx.fill();
            if (a.sign === 1) {
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });

        // Hub
        ctx.beginPath();
        ctx.arc(center, center, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#4d7cff';
        ctx.fill();
    }
}
