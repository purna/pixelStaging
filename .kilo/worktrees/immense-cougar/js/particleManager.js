import * as THREE from 'three';
import {
    ParticleSystem,
    ConstantColor,
    ConstantValue,
    ColorRange,
    Gradient,
    IntervalValue,
    Bezier,
    PiecewiseBezier,
    ConeEmitter,
    SphereEmitter,
    DonutEmitter,
    GridEmitter,
    ApplyForce,
    SizeOverLife,
    ColorOverLife,
    RotationOverLife,
    SpeedOverLife,
    LimitSpeedOverLife,
    TurbulenceField,
    GravityForce,
    MeshSurfaceEmitter
} from 'three.quarks';

export class ParticleComponent {
    constructor(mesh, presetName, particleManager) {
        this.mesh = mesh;
        this.particleManager = particleManager;
        this.system = null;
        this.presetName = presetName;
        this.name = `${presetName} on ${mesh.name ?? 'Object'}`;

        this._create();
    }

    _create() {
        const position = this.mesh.position.clone();
        const emitter = this.particleManager.createPreset(this.presetName, position);

        if (emitter) {
            this.system = emitter;
            this.mesh.add(this.system.emitter);
            this.system.emitter.position.set(0, 0, 0);
        }
    }

    play() {
        if (this.system) this.system.play();
    }

    stop() {
        if (this.system) this.system.endEmit();
    }

    pause() {
        if (this.system) this.system.pause();
    }

    reset() {
        if (this.system) this.system.restart();
    }

    dispose() {
        if (this.system) {
            if (this.mesh) {
                this.mesh.remove(this.system.emitter);
            }
            this.system.dispose();
            this.system = null;
        }
    }
}

export class ParticleManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.particleSystems = [];
        this.particleComponents = [];
    }

    addParticleToObject(mesh, presetName) {
        if (!mesh) return null;

        const existing = this.getComponentForMesh(mesh);
        if (existing) {
            existing.dispose();
            this.removeComponent(existing);
        }

        const component = new ParticleComponent(mesh, presetName, this);
        this.particleComponents.push({
            component: component,
            meshUuid: mesh.uuid,
            uuid: component.system?.emitter?.uuid ?? THREE.MathUtils.generateUUID(),
            name: component.name,
            presetName: presetName
        });

        if (!mesh.userData.particleComponents) {
            mesh.userData.particleComponents = [];
        }
        mesh.userData.particleComponents.push(component);

        return component;
    }

    getComponentForMesh(mesh) {
        const entry = this.particleComponents.find(pc => pc.meshUuid === mesh.uuid);
        return entry ? entry.component : null;
    }

    removeComponent(component) {
        const index = this.particleComponents.findIndex(pc => pc.component === component);
        if (index !== -1) {
            this.particleComponents.splice(index, 1);
        }
    }

    removeParticleFromObject(mesh) {
        const component = this.getComponentForMesh(mesh);
        if (component) {
            component.dispose();
            this.removeComponent(component);
        }
        if (mesh.userData.particleComponents) {
            mesh.userData.particleComponents = mesh.userData.particleComponents.filter(
                pc => pc !== component
            );
        }
    }

    createEmitter(options = {}) {
        const texture = options.particleTexture ?? this._createDefaultTexture();
        const material = new THREE.SpriteMaterial({
            map: texture,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        const particleSystem = new ParticleSystem({
            duration: options.duration ?? 5,
            looping: options.looping ?? true,
            startLife: options.lifetime ?? new IntervalValue(1, 3),
            startSpeed: options.speed ?? new IntervalValue(1, 3),
            startSize: options.size ?? new IntervalValue(0.1, 0.5),
            startColor: options.color ?? new ColorRange(
                new THREE.Vector4(1, 1, 1, 1),
                new THREE.Vector4(1, 1, 1, 1)
            ),
            emissionOverTime: options.emissionRate ?? new ConstantValue(50),
            behaviors: options.behaviors ?? [],
            shape: options.emitter ?? new ConeEmitter({
                radius: 0.5,
                thickness: 1,
                arc: Math.PI * 2
            }),
            material: material,
            startTileIndex: new ConstantValue(0),
            uTileCount: 1,
            vTileCount: 1,
            renderOrder: 0
        });

        if (options.position) {
            particleSystem.emitter.position.copy(options.position);
        }
        if (options.rotation) {
            particleSystem.emitter.rotation.copy(options.rotation);
        }
        if (options.scale) {
            particleSystem.emitter.scale.copy(options.scale);
        }

        this.scene.add(particleSystem.emitter);
        this.particleSystems.push({
            system: particleSystem,
            uuid: particleSystem.emitter.uuid,
            name: options.name ?? `Particle System ${this.particleSystems.length + 1}`,
            emitterType: options.emitterType ?? 'cone'
        });

        return particleSystem;
    }

    createPreset(presetName, position = new THREE.Vector3(0, 0, 0)) {
        let behaviors = [];
        let emitter = new ConeEmitter();

        switch (presetName) {
            case 'fire':
                emitter = new ConeEmitter({
                    radius: 0.2,
                    thickness: 1,
                    arc: Math.PI * 2,
                    angle: Math.PI / 6
                });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(1, 1, 0.5), 0], [new THREE.Vector3(1, 0.5, 0), 0.3], [new THREE.Vector3(0.3, 0, 0), 0.7], [new THREE.Vector3(0.1, 0.1, 0.1), 1]],
                        [[1, 0], [1, 0.3], [0.5, 0.7], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.5, 0.5, 0.5), 0],
                            [new THREE.Vector3(1, 1, 1), 0.2],
                            [new THREE.Vector3(0.3, 0.3, 0.3), 1]
                        ]
                    ])),
                    new ApplyForce(new THREE.Vector3(0, 1, 0), new ConstantValue(1)),
                    new LimitSpeedOverLife(new ConstantValue(2), 0.5),
                    new TurbulenceField(new ConstantValue(1), new ConstantValue(1), new ConstantValue(1), new THREE.Vector3(0, 0, 0))
                ];
                return this.createEmitter({
                    name: 'Fire',
                    emitterType: 'cone',
                    position: position,
                    duration: 2,
                    looping: true,
                    lifetime: new IntervalValue(0.5, 1.5),
                    speed: new IntervalValue(1, 3),
                    size: new IntervalValue(0.1, 0.3),
                    color: new ColorRange(
                        new THREE.Vector4(1, 0.8, 0.2, 1),
                        new THREE.Vector4(1, 0.3, 0, 1)
                    ),
                    emissionRate: new ConstantValue(100),
                    behaviors: behaviors,
                    emitter: emitter
                });

            case 'smoke':
                emitter = new SphereEmitter({ radius: 0.3 });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(0.3, 0.3, 0.3), 0], [new THREE.Vector3(0.5, 0.5, 0.5), 0.5], [new THREE.Vector3(0.7, 0.7, 0.7), 1]],
                        [[0.8, 0], [0.4, 0.5], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.3, 0.3, 0.3), 0],
                            [new THREE.Vector3(1.5, 1.5, 1.5), 1]
                        ]
                    ])),
                    new ApplyForce(new THREE.Vector3(0, 0.5, 0), new ConstantValue(1)),
                    new TurbulenceField(new ConstantValue(0.5), new ConstantValue(1), new ConstantValue(1), new THREE.Vector3(0, 0, 0))
                ];
                return this.createEmitter({
                    name: 'Smoke',
                    emitterType: 'sphere',
                    position: position,
                    duration: 4,
                    looping: true,
                    lifetime: new IntervalValue(2, 4),
                    speed: new IntervalValue(0.5, 1),
                    size: new IntervalValue(0.3, 0.6),
                    color: new ColorRange(
                        new THREE.Vector4(0.3, 0.3, 0.3, 0.8),
                        new THREE.Vector4(0.5, 0.5, 0.5, 0.5)
                    ),
                    emissionRate: new ConstantValue(30),
                    behaviors: behaviors,
                    emitter: emitter
                });

            case 'sparkle':
                emitter = new SphereEmitter({ radius: 0.1 });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(1, 1, 0.8), 0], [new THREE.Vector3(1, 1, 0.3), 0.5], [new THREE.Vector3(1, 0.8, 0), 1]],
                        [[1, 0], [1, 0.5], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.1, 0.1, 0.1), 0],
                            [new THREE.Vector3(0.05, 0.05, 0.05), 1]
                        ]
                    ])),
                    new GravityForce(new ConstantValue(2))
                ];
                return this.createEmitter({
                    name: 'Sparkle',
                    emitterType: 'sphere',
                    position: position,
                    duration: 1,
                    looping: true,
                    lifetime: new IntervalValue(0.5, 1),
                    speed: new IntervalValue(2, 5),
                    size: new IntervalValue(0.02, 0.08),
                    color: new ColorRange(
                        new THREE.Vector4(1, 1, 0.8, 1),
                        new THREE.Vector4(1, 0.8, 0.2, 1)
                    ),
                    emissionRate: new ConstantValue(200),
                    behaviors: behaviors,
                    emitter: emitter
                });

            case 'rain':
                emitter = new GridEmitter({
                    size: new THREE.Vector3(10, 0.1, 10),
                    grid: new THREE.Vector3(1, 1, 1)
                });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(0.6, 0.7, 0.9), 0], [new THREE.Vector3(0.5, 0.6, 0.8), 1]],
                        [[0.8, 0], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.02, 0.1, 0.02), 0],
                            [new THREE.Vector3(0.02, 0.1, 0.02), 1]
                        ]
                    ]))
                ];
                return this.createEmitter({
                    name: 'Rain',
                    emitterType: 'box',
                    position: new THREE.Vector3(position.x, position.y + 5, position.z),
                    duration: 1,
                    looping: true,
                    lifetime: new IntervalValue(0.5, 1),
                    speed: new IntervalValue(15, 20),
                    size: new IntervalValue(0.1, 0.1),
                    color: new ColorRange(
                        new THREE.Vector4(0.6, 0.7, 0.9, 0.8),
                        new THREE.Vector4(0.5, 0.6, 0.8, 0.6)
                    ),
                    emissionRate: new ConstantValue(500),
                    behaviors: behaviors,
                    emitter: emitter
                });

            case 'snow':
                emitter = new GridEmitter({
                    size: new THREE.Vector3(10, 0.1, 10),
                    grid: new THREE.Vector3(1, 1, 1)
                });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(1, 1, 1), 0], [new THREE.Vector3(1, 1, 1), 1]],
                        [[1, 0], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.1, 0.1, 0.1), 0],
                            [new THREE.Vector3(0.1, 0.1, 0.1), 1]
                        ]
                    ])),
                    new TurbulenceField(new ConstantValue(0.3), new ConstantValue(1), new ConstantValue(1), new THREE.Vector3(0, 0, 0))
                ];
                return this.createEmitter({
                    name: 'Snow',
                    emitterType: 'box',
                    position: new THREE.Vector3(position.x, position.y + 5, position.z),
                    duration: 1,
                    looping: true,
                    lifetime: new IntervalValue(3, 5),
                    speed: new IntervalValue(0.5, 1),
                    size: new IntervalValue(0.05, 0.15),
                    color: new ColorRange(
                        new THREE.Vector4(1, 1, 1, 1),
                        new THREE.Vector4(1, 1, 1, 0.8)
                    ),
                    emissionRate: new ConstantValue(100),
                    behaviors: behaviors,
                    emitter: emitter
                });

            case 'explosion':
                emitter = new SphereEmitter({ radius: 0.2 });
                behaviors = [
                    new ColorOverLife(new Gradient(
                        [[new THREE.Vector3(1, 1, 0.5), 0], [new THREE.Vector3(1, 0.5, 0), 0.2], [new THREE.Vector3(0.3, 0, 0), 0.6], [new THREE.Vector3(0.1, 0.1, 0.1), 1]],
                        [[1, 0], [1, 0.2], [0.5, 0.6], [0, 1]]
                    )),
                    new SizeOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(0.1, 0.1, 0.1), 0],
                            [new THREE.Vector3(0.8, 0.8, 0.8), 0.3],
                            [new THREE.Vector3(0.2, 0.2, 0.2), 1]
                        ]
                    ])),
                    new SpeedOverLife(new PiecewiseBezier([
                        [
                            [new THREE.Vector3(1, 1, 1), 0],
                            [new THREE.Vector3(0.1, 0.1, 0.1), 1]
                        ]
                    ]))
                ];
                return this.createEmitter({
                    name: 'Explosion',
                    emitterType: 'sphere',
                    position: position,
                    duration: 0.5,
                    looping: false,
                    lifetime: new IntervalValue(0.5, 1.5),
                    speed: new IntervalValue(3, 8),
                    size: new IntervalValue(0.1, 0.3),
                    color: new ColorRange(
                        new THREE.Vector4(1, 1, 0.5, 1),
                        new THREE.Vector4(1, 0.3, 0, 1)
                    ),
                    emissionRate: new ConstantValue(0),
                    behaviors: behaviors,
                    emitter: emitter
                });

            default:
                return this.createEmitter({
                    name: 'Default',
                    position: position
                });
        }
    }

    play(uuid) {
        const ps = this._getParticleSystem(uuid);
        if (ps) ps.play();

        const pc = this._getParticleComponent(uuid);
        if (pc) pc.play();
    }

    stop(uuid) {
        const ps = this._getParticleSystem(uuid);
        if (ps) ps.endEmit();

        const pc = this._getParticleComponent(uuid);
        if (pc) pc.stop();
    }

    pause(uuid) {
        const ps = this._getParticleSystem(uuid);
        if (ps) ps.pause();
    }

    reset(uuid) {
        const ps = this._getParticleSystem(uuid);
        if (ps) ps.restart();
    }

    removeEmitter(uuid) {
        const index = this.particleSystems.findIndex(ps => ps.uuid === uuid);
        if (index !== -1) {
            const ps = this.particleSystems[index];
            this.scene.remove(ps.system.emitter);
            ps.system.dispose();
            this.particleSystems.splice(index, 1);
        }
    }

    removeParticleComponent(meshUuid) {
        const index = this.particleComponents.findIndex(pc => pc.meshUuid === meshUuid);
        if (index !== -1) {
            const pc = this.particleComponents[index];
            pc.component.dispose();
            this.particleComponents.splice(index, 1);
        }
    }

    getComponents() {
        return this.particleComponents.map(pc => ({
            uuid: pc.uuid,
            meshUuid: pc.meshUuid,
            name: pc.name,
            presetName: pc.presetName
        }));
    }

    getEmitters() {
        return this.particleSystems.map(ps => ({
            uuid: ps.uuid,
            name: ps.name,
            emitterType: ps.emitterType
        }));
    }

    update(deltaTime) {
        this.particleSystems.forEach(ps => {
            ps.system.update(deltaTime);
        });
        this.particleComponents.forEach(pc => {
            pc.component.system?.update(deltaTime);
        });
    }

    _getParticleSystem(uuid) {
        const ps = this.particleSystems.find(ps => ps.uuid === uuid);
        return ps ? ps.system : null;
    }

    _getParticleComponent(uuid) {
        const pc = this.particleComponents.find(pc => pc.uuid === uuid);
        return pc ? pc.component : null;
    }

    _createDefaultTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    dispose() {
        this.particleSystems.forEach(ps => {
            this.scene.remove(ps.system.emitter);
            ps.system.dispose();
        });
        this.particleSystems = [];

        this.particleComponents.forEach(pc => {
            pc.component.dispose();
        });
        this.particleComponents = [];
    }
}
