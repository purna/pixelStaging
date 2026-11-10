import * as THREE from 'three';

export class ObjectFactory {
    constructor(app) {
        this.app = app;
    }

    static generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    createMaterial(color = 0x00ff41) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x000000,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 1
        });
        // Copy the MaterialsManager name onto the material if the app has one, so the
        // JS exporter can read it straight from mesh.material.name.
        if (typeof this.app?.materialsManager?.createMaterial === 'function') {
            // Try to find the matching registered material by exact color match.
            const match = this.app.materialsManager.materials?.find(
                m => m.color === color || m.color === (color | 0)
            );
            if (match && typeof match.name === 'string') {
                mat.name = match.name;
            }
        }
        return mat;
    }

    createShape(type) {
        let geometry, mesh;
        const material = this.createMaterial();

        switch (type) {
            case 'box': geometry = new THREE.BoxGeometry(1, 1, 1); break;
            case 'sphere': geometry = new THREE.SphereGeometry(0.6, 32, 16); break;
            case 'cone': geometry = new THREE.ConeGeometry(0.6, 1.5, 32); break;
            case 'cylinder': geometry = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 32); break;
            case 'pyramid': geometry = new THREE.ConeGeometry(0.8, 1.2, 4); break;
            case 'plane':
                geometry = new THREE.PlaneGeometry(2, 2);
                material.side = THREE.DoubleSide;
                break;
            case 'torus': geometry = new THREE.TorusGeometry(0.6, 0.2, 16, 50); break;
            case 'tetrahedron': geometry = new THREE.TetrahedronGeometry(0.7); break;
            case 'octahedron': geometry = new THREE.OctahedronGeometry(0.7); break;
            case 'dodecahedron': geometry = new THREE.DodecahedronGeometry(0.7); break;
            case 'icosahedron': geometry = new THREE.IcosahedronGeometry(0.7); break;
            case 'torusknot': geometry = new THREE.TorusKnotGeometry(0.5, 0.15, 100, 16); break;
            default: geometry = new THREE.BoxGeometry(1, 1, 1); type = 'box';
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = 1;
        const objectId = ObjectFactory.generateId();

        if (type === 'plane') {
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = 0.01;
            mesh.receiveShadow = true;
            mesh.castShadow = false;
        }

mesh.userData = {
            type: 'shape',
            shapeType: type,
            id: objectId,
            materialName: material.name || ('Mat_' + material.color.getHexString()),
            aframe: {
                src: '',
                shadow: { cast: true, receive: true },
                animation: '',
                customAttrs: {}
            }
        };
        return mesh;
    }

    create2DShape(type) {
        let geometry, mesh;
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff41,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });

        switch (type) {
            case 'rectangle':
                geometry = new THREE.PlaneGeometry(2, 1.5);
                break;
            case 'circle':
                geometry = new THREE.CircleGeometry(1, 32);
                break;
            case 'triangle':
                geometry = new THREE.CircleGeometry(1, 3);
                break;
            case 'star':
                geometry = this._createStarGeometry(1, 0.5, 5);
                break;
            case 'heart':
                geometry = this._createHeartGeometry(1);
                break;
            case 'text':
            case 'label':
                return this._createTextLabel('Text');
            default:
                geometry = new THREE.PlaneGeometry(2, 1.5);
                type = 'rectangle';
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 1;
        const objectId = ObjectFactory.generateId();

        mesh.userData = {
            type: 'shape2d',
            shapeType: type,
            id: objectId,
            name: type.charAt(0).toUpperCase() + type.slice(1),
            materialName: material.name || ('Mat_' + material.color.getHexString()),
            aframe: {
                src: '',
                shadow: { cast: false, receive: false },
                animation: '',
                customAttrs: {}
            }
        };
        return mesh;
    }

    _createStarGeometry(outerRadius, innerRadius, points) {
        const shape = new THREE.Shape();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
        return new THREE.ShapeGeometry(shape);
    }

    _createHeartGeometry(scale) {
        const shape = new THREE.Shape();
        const x = 0, y = 0;
        shape.moveTo(x + 0.5 * scale, y + 0.5 * scale);
        shape.bezierCurveTo(x + 0.5 * scale, y + 0.5 * scale, x + 0.4 * scale, y, x, y);
        shape.bezierCurveTo(x - 0.6 * scale, y, x - 0.6 * scale, y + 0.7 * scale, x - 0.6 * scale, y + 0.7 * scale);
        shape.bezierCurveTo(x - 0.6 * scale, y + 1.1 * scale, x - 0.3 * scale, y + 1.54 * scale, x + 0.5 * scale, y + 1.9 * scale);
        shape.bezierCurveTo(x + 1.2 * scale, y + 1.54 * scale, x + 1.6 * scale, y + 1.1 * scale, x + 1.6 * scale, y + 0.7 * scale);
        shape.bezierCurveTo(x + 1.6 * scale, y + 0.7 * scale, x + 1.6 * scale, y, x + 1.0 * scale, y);
        shape.bezierCurveTo(x + 0.7 * scale, y, x + 0.5 * scale, y + 0.5 * scale, x + 0.5 * scale, y + 0.5 * scale);
        return new THREE.ShapeGeometry(shape);
    }

    _createTextLabel(text, fontFamily = 'Inter, sans-serif') {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 80px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 512, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0x00ff41,
            transparent: true,
            side: THREE.DoubleSide
        });

        const geometry = new THREE.PlaneGeometry(6, 1.5);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 1;

        const objectId = ObjectFactory.generateId();
        mesh.userData = {
            type: 'shape2d',
            shapeType: 'text',
            id: objectId,
            name: 'Text: ' + text,
            text: text,
            fontFamily: fontFamily,
            materialName: 'Mat_Text',
            aframe: {
                src: '',
                shadow: { cast: false, receive: false },
                animation: '',
                customAttrs: {}
            }
        };
        return mesh;
    }

    updateTextLabel(mesh, newText, newFontFamily) {
        if (mesh.userData.type !== 'shape2d' || mesh.userData.shapeType !== 'text') return;

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 80px ${newFontFamily || mesh.userData.fontFamily || 'Inter, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(newText, 512, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
        mesh.userData.text = newText;
        mesh.userData.name = 'Text: ' + newText;
        mesh.userData.fontFamily = newFontFamily || mesh.userData.fontFamily;
    }
createFigure(gender) {
        const group = new THREE.Group();
        const material = this.createMaterial(gender === 'male' ? 0x00d9ff : 0xff006e);

        // Proportions - realistic human proportions (approx 7.5 heads tall)
        const headSize = 0.28;
        const w = gender === 'male' ? 0.85 : 0.7;  // Shoulder width
        
        // PELVIS (root)
        const pelvisGeo = new THREE.BoxGeometry(w * 0.7, 0.3, 0.35);
        const pelvis = new THREE.Mesh(pelvisGeo, material);
        pelvis.position.y = 0;
        pelvis.castShadow = true;
        pelvis.userData = { name: 'Pelvis' };
        group.add(pelvis);

        // SPINE (flexible)
        const spineGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.5, 8);
        const spine = new THREE.Mesh(spineGeo, material);
        spine.position.y = 0.4;
        spine.castShadow = true;
        spine.userData = { name: 'Spine' };
        pelvis.add(spine);

        // CHEST/TORSO
        const chestGeo = new THREE.BoxGeometry(w, 0.65, 0.4);
        const chest = new THREE.Mesh(chestGeo, material);
        chest.position.y = 0.55;
        chest.castShadow = true;
        chest.userData = { name: 'Chest' };
        spine.add(chest);

        // NECK
        const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.2, 8);
        const neck = new THREE.Mesh(neckGeo, material);
        neck.position.y = 0.45;
        neck.castShadow = true;
        neck.userData = { name: 'Neck' };
        chest.add(neck);

        // HEAD
        const headGeo = new THREE.SphereGeometry(headSize, 16, 16);
        const head = new THREE.Mesh(headGeo, material);
        head.scale.set(0.9, 1.1, 1);
        head.position.y = 0.35;
        head.castShadow = true;
        head.userData = { name: 'Head' };
        neck.add(head);

        // Function to create articulated limb segments with joints
        const createLimbSegment = (name, length, width, parent, offsetY = 0) => {
            const jointGroup = new THREE.Group();
            jointGroup.position.y = offsetY;
            jointGroup.userData = { name: name + ' Joint' };
            
            const segmentGeo = new THREE.CylinderGeometry(width * 0.9, width, length, 8);
            const segment = new THREE.Mesh(segmentGeo, material);
            segment.position.y = -length / 2;
            segment.castShadow = true;
            segment.userData = { name: name };
            
            jointGroup.add(segment);
            parent.add(jointGroup);
            return jointGroup;
        };

        // ARMS - More realistic proportions
        const armUpperLength = 0.45;
        const armLowerLength = 0.42;
        const armWidth = 0.13;
        const shoulderOffset = (w / 2) + 0.08;

        // Left Shoulder Joint
        const leftShoulderJoint = new THREE.Group();
        leftShoulderJoint.position.set(-shoulderOffset, 0.25, 0);
        leftShoulderJoint.userData = { name: 'Left Shoulder Joint' };
        chest.add(leftShoulderJoint);
        
        // Left Upper Arm
        const leftUpperArm = createLimbSegment('Left Upper Arm', armUpperLength, armWidth, leftShoulderJoint, 0);
        
        // Left Elbow
        const leftElbow = createLimbSegment('Left Forearm', armLowerLength, armWidth * 0.85, leftUpperArm, -armUpperLength);
        
        // Left Hand
        const leftHandGeo = new THREE.SphereGeometry(armWidth * 0.8, 8, 8);
        leftHandGeo.scale(1, 1.2, 0.7);
        const leftHand = new THREE.Mesh(leftHandGeo, material);
        leftHand.position.y = -armLowerLength / 2;
        leftHand.castShadow = true;
        leftHand.userData = { name: 'Left Hand' };
        leftElbow.add(leftHand);

        // Right Shoulder Joint
        const rightShoulderJoint = new THREE.Group();
        rightShoulderJoint.position.set(shoulderOffset, 0.25, 0);
        rightShoulderJoint.userData = { name: 'Right Shoulder Joint' };
        chest.add(rightShoulderJoint);
        
        // Right Upper Arm
        const rightUpperArm = createLimbSegment('Right Upper Arm', armUpperLength, armWidth, rightShoulderJoint, 0);
        
        // Right Elbow
        const rightElbow = createLimbSegment('Right Forearm', armLowerLength, armWidth * 0.85, rightUpperArm, -armUpperLength);
        
        // Right Hand
        const rightHandGeo = new THREE.SphereGeometry(armWidth * 0.8, 8, 8);
        rightHandGeo.scale(1, 1.2, 0.7);
        const rightHand = new THREE.Mesh(rightHandGeo, material);
        rightHand.position.y = -armLowerLength / 2;
        rightHand.castShadow = true;
        rightHand.userData = { name: 'Right Hand' };
        rightElbow.add(rightHand);

        // LEGS - More realistic proportions
        const legUpperLength = 0.55;
        const legLowerLength = 0.52;
        const legWidth = 0.17;
        const hipOffset = w * 0.22;

        // Left Hip Joint
        const leftHipJoint = new THREE.Group();
        leftHipJoint.position.set(-hipOffset, -0.15, 0);
        leftHipJoint.userData = { name: 'Left Hip Joint' };
        pelvis.add(leftHipJoint);
        
        // Left Thigh
        const leftThigh = createLimbSegment('Left Thigh', legUpperLength, legWidth, leftHipJoint, 0);
        
        // Left Knee
        const leftKnee = createLimbSegment('Left Shin', legLowerLength, legWidth * 0.9, leftThigh, -legUpperLength);
        
        // Left Foot
        const leftFootGeo = new THREE.BoxGeometry(legWidth * 0.9, 0.12, legWidth * 1.8);
        const leftFoot = new THREE.Mesh(leftFootGeo, material);
        leftFoot.position.set(0, -legLowerLength / 2 - 0.06, legWidth * 0.4);
        leftFoot.castShadow = true;
        leftFoot.userData = { name: 'Left Foot' };
        leftKnee.add(leftFoot);

        // Right Hip Joint
        const rightHipJoint = new THREE.Group();
        rightHipJoint.position.set(hipOffset, -0.15, 0);
        rightHipJoint.userData = { name: 'Right Hip Joint' };
        pelvis.add(rightHipJoint);
        
        // Right Thigh
        const rightThigh = createLimbSegment('Right Thigh', legUpperLength, legWidth, rightHipJoint, 0);
        
        // Right Knee
        const rightKnee = createLimbSegment('Right Shin', legLowerLength, legWidth * 0.9, rightThigh, -legUpperLength);
        
        // Right Foot
        const rightFootGeo = new THREE.BoxGeometry(legWidth * 0.9, 0.12, legWidth * 1.8);
        const rightFoot = new THREE.Mesh(rightFootGeo, material);
        rightFoot.position.set(0, -legLowerLength / 2 - 0.06, legWidth * 0.4);
        rightFoot.castShadow = true;
        rightFoot.userData = { name: 'Right Foot' };
        rightKnee.add(rightFoot);

        group.position.y = 2.0;
        group.userData = { type: 'figure', gender: gender, id: ObjectFactory.generateId() };

        return group;
    }

    createLight(type) {
        let light, helper;
        const color = 0xffffff;
        const intensity = 2;

        if (type === 'point') {
            light = new THREE.PointLight(color, intensity * 20, 20);
            light.position.set(0, 3, 0);
            helper = new THREE.PointLightHelper(light, 0.5);
        } else if (type === 'spot') {
            light = new THREE.SpotLight(color, intensity * 30);
            light.position.set(0, 5, 2);
            light.angle = Math.PI / 6;
            light.penumbra = 0.2;
            light.target.position.set(0, 0, 0);
            helper = new THREE.SpotLightHelper(light);
        } else if (type === 'directional') {
            light = new THREE.DirectionalLight(color, intensity);
            light.position.set(5, 5, 5);
            helper = new THREE.DirectionalLightHelper(light, 1);
        } else if (type === 'ambient') {
            light = new THREE.AmbientLight(color, intensity);
            light.position.set(0, 0, 0);
            // No helper for ambient light
        } else if (type === 'hemisphere') {
            light = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, intensity);
            light.position.set(0, 5, 0);
            helper = new THREE.HemisphereLightHelper(light, 1);
        }

        light.castShadow = true;
        light.userData = { type: 'light', lightType: type, id: ObjectFactory.generateId() };

        const container = new THREE.Group();
        container.add(light);
        if (helper) {
            container.add(helper);
            light.userData.helper = helper;
        }

        container.userData = light.userData;
        container.position.copy(light.position);
        light.position.set(0, 0, 0);

        return container;
    }
}
