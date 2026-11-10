import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PhysicsManager {
    constructor(scene) {
        this.scene = scene;
        this.enabled = false;
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.81, 0)
        });

        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;

        this.bodies = [];
        this.meshBodyMap = new Map();

        this.debugMode = false;
        this.debugMeshes = new Map();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }

    setGravity(x, y, z) {
        this.world.gravity.set(x, y, z);
    }

    addMesh(mesh, options = {}) {
        if (!mesh.geometry) return null;

        // Applying physics again should update the body, never create a duplicate.
        this.removeMesh(mesh);

        const mass = options.mass ?? 1;
        const bodyType = options.bodyType ?? CANNON.Body.DYNAMIC;

        const shape = this._createShape(mesh);
        if (!shape) return null;

        const body = new CANNON.Body({
            mass: bodyType === CANNON.Body.STATIC ? 0 : mass,
            shape: shape,
            position: new CANNON.Vec3(
                mesh.position.x,
                mesh.position.y,
                mesh.position.z
            ),
            material: options.material ?? undefined
        });

        body.type = bodyType;
        body.linearDamping = options.linearDamping ?? 0.01;
        body.angularDamping = options.angularDamping ?? 0.01;
        body.updateMassProperties();

        if (options.velocity) {
            body.velocity.set(options.velocity.x, options.velocity.y, options.velocity.z);
        }
        if (options.angularVelocity) {
            body.angularVelocity.set(options.angularVelocity.x, options.angularVelocity.y, options.angularVelocity.z);
        }

        if (options.friction !== undefined) {
            body.material = new CANNON.Material({ friction: options.friction });
        }
        if (options.restitution !== undefined) {
            if (!body.material) body.material = new CANNON.Material();
            body.material.restitution = options.restitution;
        }

        this.world.addBody(body);
        this.bodies.push(body);
        this.meshBodyMap.set(mesh.uuid, body);
        body.userData = { meshUuid: mesh.uuid, originalMass: mass };

        return body;
    }

    _createShape(mesh) {
        const geometry = mesh.geometry;
        const type = geometry.type;

        if (type === 'SphereGeometry' || type === 'IcosahedronGeometry') {
            const radius = geometry.parameters?.radius ?? 0.5;
            return new CANNON.Sphere(radius);
        }

        if (type === 'BoxGeometry') {
            const w = geometry.parameters?.width ?? 1;
            const h = geometry.parameters?.height ?? 1;
            const d = geometry.parameters?.depth ?? 1;
            return new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
        }

        if (type === 'CylinderGeometry') {
            const radiusTop = geometry.parameters?.radiusTop ?? 0.5;
            const radiusBottom = geometry.parameters?.radiusBottom ?? 0.5;
            const height = geometry.parameters?.height ?? 1;
            return new CANNON.Cylinder(
                radiusTop,
                radiusBottom,
                height,
                geometry.parameters?.radialSegments ?? 12
            );
        }

        if (type === 'ConeGeometry') {
            const radius = geometry.parameters?.radius ?? 0.5;
            const height = geometry.parameters?.height ?? 1;
            return new CANNON.Cone(radius, height, geometry.parameters?.radialSegments ?? 12);
        }

        if (type === 'PlaneGeometry') {
            return new CANNON.Plane();
        }

        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        if (size.length() > 0) {
            return new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        }

        return new CANNON.Sphere(0.5);
    }

    removeMesh(mesh) {
        const body = this.meshBodyMap.get(mesh.uuid);
        if (body) {
            this.world.removeBody(body);
            this.bodies = this.bodies.filter(b => b !== body);
            this.meshBodyMap.delete(mesh.uuid);
            this.debugMeshes.delete(mesh.uuid);
        }
    }

    getBodyForMesh(mesh) {
        return this.meshBodyMap.get(mesh.uuid) || null;
    }

    update(deltaTime) {
        if (!this.enabled) return;

        const fixedTimeStep = 1 / 60;
        const maxSubSteps = 3;
        this.world.step(fixedTimeStep, deltaTime, maxSubSteps);

        this.meshBodyMap.forEach((body, meshUuid) => {
            const mesh = this._findMeshByUuid(meshUuid);
            if (mesh) {
                mesh.position.set(body.position.x, body.position.y, body.position.z);
                mesh.quaternion.set(
                    body.quaternion.x,
                    body.quaternion.y,
                    body.quaternion.z,
                    body.quaternion.w
                );
            }
        });
    }

    _findMeshByUuid(uuid) {
        let found = null;
        this.scene.traverse((child) => {
            if (child.uuid === uuid) found = child;
        });
        return found;
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (!enabled) {
            this.debugMeshes.forEach((debugMesh) => {
                if (debugMesh.parent) debugMesh.parent.remove(debugMesh);
            });
            this.debugMeshes.clear();
        }
    }

    reset() {
        this.meshBodyMap.forEach((body, meshUuid) => {
            const mesh = this._findMeshByUuid(meshUuid);
            if (mesh) {
                mesh.position.set(0, 5, 0);
                mesh.quaternion.set(0, 0, 0, 1);
            }
        });
    }

    setBodyType(mesh, bodyType) {
        const body = this.meshBodyMap.get(mesh.uuid);
        if (body) {
            body.type = bodyType;
            body.mass = bodyType === CANNON.Body.STATIC ? 0 : (body.userData?.originalMass ?? 1);
            body.updateMassProperties();
            body.velocity.setZero();
            body.angularVelocity.setZero();
        }
    }

    applyForce(mesh, force) {
        const body = this.meshBodyMap.get(mesh.uuid);
        if (body) {
            body.applyForce(new CANNON.Vec3(force.x, force.y, force.z));
        }
    }

    applyImpulse(mesh, impulse) {
        const body = this.meshBodyMap.get(mesh.uuid);
        if (body) {
            body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
        }
    }

    dispose() {
        this.bodies.forEach(body => this.world.removeBody(body));
        this.bodies = [];
        this.meshBodyMap.clear();
        this.debugMeshes.clear();
    }
}

export { CANNON };
