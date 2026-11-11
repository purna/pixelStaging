import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UI } from './ui.js';
import { FileManager } from './fileManager.js';
import { ObjectFactory } from './factory.js';
import { GeminiManager } from './gemini.js';
import { LayerManager } from './layerManager.js';
import { CameraManager } from './cameraManager.js';
import { ToolTip } from './tooltip.js';
import { HistoryManager, TransformObjectCommand, AddObjectCommand, DeleteObjectCommand, ClearSceneCommand, AddCharacterCommand } from './historyManager.js';
import { CharacterManager } from './characterManager.js';
import { APP_DEFAULTS } from './config.js';
import { TutorialConfig } from './tutorialConfig.js';
import { TutorialSystem } from './tutorialSystem.js';
import { AFrameExporter } from './aframeExporter.js';
import { ExportManager } from './exportManager.js';
import { Notifications } from './notifications.js';
import { StagingManager } from './staging/stagingManager.js';
import { CameraRigManager } from './staging/cameras/rigManager.js';
import { ShotBoard } from './staging/shots/shotBoard.js';
import { ShotManager } from './staging/shots/shotManager.js';
import { SceneManager } from './staging/scenes/sceneManager.js';
import { buildFrustumVisual } from './staging/cameras/frustumRenderer.js';
import { exportStoryboardPDF, openStoryboardReport } from './storyboardExporter.js';

class StageApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.orbit = null;
        this.transformControl = null;
        this.keyframeControls = null;
        this.keyframeGizmos = new Map();
        this.keyframeDragging = false;
        this.poseControls = null;
        this.poseEditState = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clock = new THREE.Clock();

        this.selectedObject = null;
        this.hoveredObject = null;
        this.objects = [];
        this.isInteractingWithGizmo = false;
        this.isDraggingGizmo = false;
        this.gizmoDragJustEnded = false;
        this.originalColors = new Map();
        // 'camera' = drag/navigate the view; 'scene' = select and transform objects.
        this.controlMode = 'camera';
        this.cameraGuidesEnabled = false;

        // Snap state
        this.APP_DEFAULTS = APP_DEFAULTS;
        this.snapEnabled = APP_DEFAULTS.snap.enabled;
        this.snapMode = APP_DEFAULTS.snap.mode;
        this.snapGridUnit = APP_DEFAULTS.snap.gridUnit;
        this.snapThreshold = APP_DEFAULTS.snap.snapThreshold;
        this.snapEdgeThreshold = APP_DEFAULTS.snap.edgeThreshold;
        this.snapTarget = null;       // nearest snap-eligible object
        this.snapFace = null;         // { axis:'x'|'y'|'z', normal: number }
        this.snapOffset = null;       // THREE.Vector3 snap position

        // Runtime snap guides
        this.snapGuideLine = null;    // THREE.Line – visual guide from source to target face
        this.snapGuideFace = null;    // THREE.Mesh – translucent patch on target face

        // Initialize Modules
        this.factory = new ObjectFactory(this);
        this.fileManager = new FileManager(this);
        this.gemini = new GeminiManager(this);
        this.layerManager = new LayerManager(this); // Init Layer Manager
        this.cameraManager = new CameraManager(this); // Init Camera Manager
        this.characterManager = new CharacterManager(this); // Init Character Manager
        this.historyManager = new HistoryManager(this); // Init History Manager
        this.notifications = new Notifications(); // Init Notifications System
        this.staging = new StagingManager(this); // Init Staging (blocking) System
        this.staging.cameras = new CameraRigManager(this); // Virtual movie cameras
        this.staging.shots = new ShotBoard(this); // Camera timeline / shot board (legacy)
        this.staging.shotManager = new ShotManager(this); // Enhanced shot manager with cinematic moves
        this.staging.scenes = new SceneManager(this); // Multi-scene management
        this.tutorialConfig = new TutorialConfig(); // Init Tutorial Config
        this.tutorialSystem = new TutorialSystem(this); // Init Tutorial System
        this.aframeExporter = new AFrameExporter(this); // Init A-Frame Exporter
        this.exportManager = new ExportManager(this); // Init Export Manager
        this.ui = new UI(this); // UI initialized last so it can access layerManager
        // No-op animation stub: keyframing removed in favour of the camera timeline,
        // but save/load/export code paths still call these methods.
        this.animationManager = {
            clips: new Map(), getClip: () => null, toJSON: () => ({ clips: {} }),
            fromJSON: () => {}, seek: () => {}, pause: () => {}, createClip: () => {},
            removeClip: () => {}, update: () => {}
        };
        this.init();
    }

    init() {
        const container = document.getElementById('canvas-container');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a4e); // Lighter background for better visibility
        this.scene.fog = new THREE.Fog(0x2a2a4e, 30, 100); // Fog with near=30, far=100

        // Camera - will be set by camera manager
        this.camera = null;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Ensure renderer is properly set up for interactive controls
        this.renderer.domElement.style.touchAction = 'none';
        this.renderer.domElement.style.userSelect = 'none';

        container.appendChild(this.renderer.domElement);

        // Environment map for PBR materials
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        const roomEnvironment = new RoomEnvironment();
        const envMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
        this.scene.environment = envMap;
        roomEnvironment.dispose();
        pmremGenerator.dispose();

        // Initialize Cameras (before Controls initialization)
        if (this.cameraManager && this.cameraManager.setupCameras) {
            this.cameraManager.setupCameras();
        }

        // Wait for camera to be properly initialized before setting up transform controls
        setTimeout(() => {
            this.setupTransformControls();
        }, APP_DEFAULTS.init.transformControlsDelay);

        // Lighting (Base ambient)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main directional light (like sunlight)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.scene.add(directionalLight);

        // Grid - Larger and more visible
        const gridHelper = new THREE.GridHelper(40, 40, 0x6b7280, 0x4b5563);
        gridHelper.position.y = 0;
        gridHelper.material.opacity = 0.8;
        gridHelper.material.transparent = true;
        gridHelper.renderOrder = -1; // Render behind other objects
        this.scene.add(gridHelper);

        // Axes - Larger and more visible with bright colors
        const axesHelper = new THREE.AxesHelper(10);
        axesHelper.position.y = 0.01; // Slightly above ground
        axesHelper.material.depthTest = false; // Always visible
        axesHelper.renderOrder = 999; // Render on top
        this.scene.add(axesHelper);




        // Events
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), true);
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e), true);
        this.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUpForDeselect(e), true);
        this.renderer.domElement.addEventListener('contextmenu', (e) => this.onRightClick(e));

        // Add event listener for transform space toggle
        setTimeout(() => {
            const spaceCheckbox = document.getElementById('transform-space-checkbox');
            if (spaceCheckbox) {
                spaceCheckbox.addEventListener('change', (e) => {
                    this.toggleTransformSpace(e.target.checked);
                });
            }
        }, APP_DEFAULTS.init.checkboxInitDelay);

        // Ensure grid and axes are visible by default
        this.setGridVisible(true);
        this.setAxesVisible(true);

        // Establish a usable scene before optional editor panels initialize. A
        // broken panel must never prevent the renderer or default scene loading.
        this.addDefaultTestObjects();

        // Every scene owns a permanent camera, even before any shot is added.
        this.staging.cameras.ensureDefaultRig();

        this.initializeEditorModules();

        // Initialize undo/redo buttons state
        this.historyManager.updateUndoRedoButtons();

        // Start Loop
        this.animate();
    }

    initializeEditorModules() {
        const modules = [
            ['UI', () => this.ui.init()],
            ['Tutorial', () => this.tutorialSystem.init()]
        ];

        modules.forEach(([name, initialize]) => {
            try {
                initialize();
            } catch (error) {
                console.error(`${name} failed to initialize:`, error);
            }
        });

        // Make the shot timeline visible so shots are discoverable without
        // digging through a secondary panel.
        try {
            this.staging.shotManager.buildUI();
            if (this.staging.shotManager.ui?.root) {
                this.staging.shotManager.ui.root.style.display = 'flex';
                this.staging.shotManager.refreshUI();
            }
        } catch (error) {
            console.error('Shot timeline failed to initialize:', error);
        }

        // Refresh panels after the default objects exist, even if another
        // optional editor module could not initialize.
        try {
            this.ui.renderHierarchyPanel();
        } catch (error) {
            console.error('Editor panels failed to refresh:', error);
        }

        // Restore saved scenes when available; otherwise the starter scene stays.
        try {
            if (this.staging.scenes.restorePersistedScenes()) {
                this.staging.cameras.ensureDefaultRig();
                this.ui.renderHierarchyPanel();
            }
        } catch (error) {
            console.error('Saved scenes failed to restore:', error);
        }
    }

    // Setup transform controls after camera is properly initialized
    setupTransformControls() {
        setTimeout(() => {
            this.transformControl = new TransformControls(this.camera, this.renderer.domElement);

            if (!this.orbit) {
                this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
                this.configureOrbitControlsForTouch();
            } else {
                this.configureOrbitControlsForTouch();
            }

            // Track if pointer is over transform gizmo
            this.transformControl.isHovered = false;

            // Add hover event listeners
            this.transformControl.addEventListener('hover-on', () => {
                this.transformControl.isHovered = true;
            });
            
            this.transformControl.addEventListener('hover-off', () => {
                this.transformControl.isHovered = false;
            });

            this.transformControl.addEventListener('dragging-changed', (event) => {
                if (this.orbit) this.orbit.enabled = !event.value;
                // Also disable camera movement completely during object transformation
                if (this.cameraManager) {
                    this.cameraManager.setCameraEnabled(!event.value);
                }
                // Track gizmo dragging state
                this.isDraggingGizmo = event.value;
                if (!event.value) {
                    // Gizmo drag just ended - prevent deselection for a brief moment
                    this.gizmoDragJustEnded = true;
                    setTimeout(() => {
                        this.gizmoDragJustEnded = false;
                    }, 100);
                }
            });

            this.transformControl.addEventListener('change', () => {
                // --- Apply snapping while gizmo is being dragged ---
                if (this.snapEnabled && this.selectedObject) {
                    if (this.snapMode === 'grid') {
                        this.selectedObject.position.copy(this.snapObjectToGrid(this.selectedObject));
                    } else if (this.snapMode === 'object') {
                        const snap = this.findSnapshot(this.selectedObject);
                        this.snapTarget = snap ? snap.target : null;
                        this.snapFace = snap ? { axis: snap.faceAxis, normal: snap.faceNormal } : null;
                        this.snapOffset = snap ? snap.snapPosition : null;
                        if (snap && snap.snapPosition) {
                            this.selectedObject.position.copy(snap.snapPosition);
                        }
                        this.updateSnapGuides(snap, this.selectedObject);
                    }
                }
                if (this.selectedObject) this.ui.updateUI(this.selectedObject);
            });

            // Track transform changes for history
            this.transformControl.addEventListener('mouseUp', () => {
                // Final snap before recording the transform in history
                if (this.snapEnabled && this.selectedObject) {
                    if (this.snapMode === 'grid') {
                        this.selectedObject.position.copy(this.snapObjectToGrid(this.selectedObject));
                    } else if (this.snapMode === 'object' && this.snapOffset) {
                        this.selectedObject.position.copy(this.snapOffset);
                    }
                }
                if (this.selectedObject) {
                    this.captureTransformChange(this.selectedObject);
                }
                // Clear snap guides
                this.clearSnapGuides();
            });

            // Ensure transform controls are visible and have proper size
            this.transformControl.setSize(APP_DEFAULTS.transform.gizmoSize);
            this.transformControl.visible = false;
            this.transformControl.space = 'local';

            this.scene.add(this.transformControl);
            this.transformControl.setMode('translate');
            this.setupKeyframeGizmos();
            this.setupPoseControls();
            this.setControlMode('camera');
        }, APP_DEFAULTS.init.uiInitDelay);
    }

    setupKeyframeGizmos() {
        this.keyframeControls = new TransformControls(this.camera, this.renderer.domElement);
        this.keyframeControls.setSize(0.65);
        this.keyframeControls.visible = false;
        this.keyframeControls.enabled = false;
        this.scene.add(this.keyframeControls);

        this.keyframeControls.addEventListener('dragging-changed', (event) => {
            this.keyframeDragging = event.value;
            if (this.orbit) this.orbit.enabled = !event.value && this.controlMode === 'camera';
            if (this.cameraManager) this.cameraManager.setCameraEnabled(!event.value);
        });
        this.keyframeControls.addEventListener('change', () => this.syncActiveKeyframeFromGizmo());
        this.keyframeControls.addEventListener('mouseUp', () => {
            this.staging.shotManager.refreshUI();
        });

        for (const [type, color] of [['start', 0x4caf50], ['end', 0xf44336]]) {
            const group = new THREE.Group();
            group.name = `${type} keyframe`;
            group.visible = false;
            group.userData.isKeyframeGizmo = true;

            const bodyMat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.28), bodyMat);
            const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), bodyMat);
            lens.rotation.x = Math.PI / 2;
            lens.position.z = -0.24;
            body.renderOrder = 20;
            lens.renderOrder = 20;
            group.add(body, lens);

            const frustum = buildFrustumVisual(color);
            frustum.setVisible(false);
            group.add(frustum.group);
            group.userData.frameType = type;
            this.scene.add(group);
            this.keyframeGizmos.set(type, { group, frustum });
        }
    }

    setupPoseControls() {
        this.poseControls = new TransformControls(this.camera, this.renderer.domElement);
        this.poseControls.setSize(0.6);
        this.poseControls.visible = false;
        this.poseControls.enabled = false;
        this.scene.add(this.poseControls);

        this.poseControls.addEventListener('dragging-changed', (event) => {
            if (this.orbit) this.orbit.enabled = !event.value && this.controlMode === 'camera';
        });
        this.poseControls.addEventListener('change', () => {
            const bone = this.poseControls.object;
            if (bone && this.poseEditState) this.ui?.syncPoseEditorFromBone?.(bone);
        });
    }

    beginPoseEditing(model) {
        this.poseEditState = { model, bone: null };
        if (this.transformControl) this.transformControl.detach();
        if (this.keyframeControls) this.keyframeControls.detach();
        const firstBone = this.findPoseBoneByName('Hips') || this.findPoseBoneByName('Spine') || this.firstPoseBone();
        if (firstBone) this.selectPoseBone(firstBone.name);
    }

    endPoseEditing() {
        this.poseEditState = null;
        if (this.poseControls) {
            this.poseControls.detach();
            this.poseControls.visible = false;
            this.poseControls.enabled = false;
        }
        if (this.orbit) this.orbit.enabled = this.controlMode === 'camera';
    }

    firstPoseBone() {
        let found = null;
        this.poseEditState?.model?.traverse?.(object => {
            if (!found && object.isBone) found = object;
        });
        return found;
    }

    findPoseBoneByName(name) {
        const short = (value) => String(value).replace(/^mixamorig:?/, '');
        let found = null;
        this.poseEditState?.model?.traverse?.(object => {
            if (!found && object.isBone && short(object.name) === short(name)) found = object;
        });
        return found;
    }

    selectPoseBone(name) {
        const bone = this.findPoseBoneByName(name);
        if (!bone || !this.poseControls) return false;
        this.poseEditState.bone = bone;
        this.poseControls.attach(bone);
        this.poseControls.setMode(this.poseControls.mode || 'rotate');
        this.poseControls.visible = true;
        this.poseControls.enabled = true;
        this.ui?.syncPoseEditorFromBone?.(bone);
        return true;
    }

    setPoseControlMode(mode) {
        if (!this.poseControls) return;
        this.poseControls.setMode(mode === 'translate' ? 'translate' : 'rotate');
    }

    pickPoseBone(event) {
        if (!this.poseEditState?.model) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObject(this.poseEditState.model, true);
        if (!hits.length) return null;

        const point = hits[0].point;
        const world = new THREE.Vector3();
        let best = null;
        let bestDistance = Infinity;
        this.poseEditState.model.traverse(object => {
            if (!object.isBone) return;
            object.getWorldPosition(world);
            const distance = world.distanceToSquared(point);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = object;
            }
        });
        return best;
    }

    updateKeyframeGizmos() {
        if (!this.keyframeControls) return;
        const shotManager = this.staging?.shotManager;
        const shot = shotManager?.selectedShot;
        const rig = shot ? this.staging.cameras.get(shot.cameraId) : null;

        if (!shot || !rig || shotManager.framingControls || shotManager.previewActive || shotManager.playing) {
            for (const { group } of this.keyframeGizmos.values()) group.visible = false;
            this.keyframeControls.detach();
            this.keyframeControls.visible = false;
            this.keyframeControls.enabled = false;
            return;
        }

        for (const frameType of ['start', 'end']) {
            const gizmo = this.keyframeGizmos.get(frameType);
            if (!gizmo) continue;
            const custom = shot[frameType === 'start' ? 'startFrame' : 'endFrame'];
            const temp = rig.camera.clone();

            if (custom) {
                temp.position.fromArray(custom.position);
                temp.quaternion.fromArray(custom.quaternion);
                if (Number.isFinite(custom.fov)) temp.fov = custom.fov;
            } else {
                shotManager.applyShotMove(temp, rig, shot, frameType === 'start' ? 0 : shot.duration, 0);
            }
            temp.updateMatrixWorld(true);

            gizmo.group.position.copy(temp.position);
            gizmo.group.quaternion.copy(temp.quaternion);
            gizmo.group.visible = true;
            gizmo.frustum.setVisible(true);
            gizmo.frustum.update(temp.fov || rig.camera.fov, rig.camera.aspect, 1.15);
            gizmo.group.userData.keyframe = { shotId: shot.id, frameType, fov: temp.fov || rig.camera.fov };
        }

        const activeType = shotManager.editingFrame === 'end' ? 'end' : 'start';
        const active = this.keyframeGizmos.get(activeType);
        if (active) {
            const distance = this.camera.position.distanceTo(active.group.position);
            if (distance < 0.35) {
                this.keyframeControls.detach();
                this.keyframeControls.visible = false;
                this.keyframeControls.enabled = false;
            } else {
                this.keyframeControls.attach(active.group);
                this.keyframeControls.setMode('translate');
                this.keyframeControls.visible = true;
                this.keyframeControls.enabled = true;
            }
        }
    }

    syncActiveKeyframeFromGizmo() {
        if (!this.keyframeDragging) return;
        const gizmo = this.keyframeControls?.object;
        if (!gizmo?.userData?.keyframe) return;
        const { shotId, frameType, fov } = gizmo.userData.keyframe;
        const shot = this.staging.shotManager.shots.find(s => s.id === shotId);
        const rig = shot ? this.staging.cameras.get(shot.cameraId) : null;
        if (!shot || !rig) return;

        shot[frameType === 'start' ? 'startFrame' : 'endFrame'] = {
            position: gizmo.position.toArray(),
            quaternion: gizmo.quaternion.toArray(),
            target: rig.target?.toArray?.() || null,
            fov
        };
    }

    /**
     * Switch the viewport controls between the camera and scene objects.
     * Camera mode: drag to look around / navigate the view.
     * Scene mode: click objects and use the transform gizmo.
     */
    setControlMode(mode) {
        this.controlMode = mode === 'scene' ? 'scene' : 'camera';

        if (this.orbit) {
            this.orbit.enabled = true;
            this.orbit.enablePan = true;
            this.orbit.enableRotate = true;
            this.orbit.screenSpacePanning = true;

            if (this.controlMode === 'camera') {
                this.orbit.mouseButtons = {
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.PAN
                };
                this.orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
            } else {
                // Blender/Unity style editing: left selects, middle orbits,
                // right pan, two-finger touch orbits/pans/zooms.
                this.orbit.mouseButtons = {
                    LEFT: null,
                    MIDDLE: THREE.MOUSE.ROTATE,
                    RIGHT: THREE.MOUSE.PAN
                };
                this.orbit.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
            }
        }

        if (this.transformControl) {
            this.transformControl.enabled = this.controlMode === 'scene';
            this.transformControl.visible = this.controlMode === 'scene' && !!this.selectedObject;
            if (this.controlMode === 'camera') this.transformControl.detach();
        }

        // Dragging the editor camera exits the shot preview so the user sees
        // exactly what the controls are moving.
        if (this.controlMode === 'camera' && this.staging?.shotManager) {
            this.staging.shotManager.previewActive = false;
        }

        const checkbox = document.getElementById('transform-space-checkbox');
        const label = document.querySelector('.transform-space-toggle .toggle-label');
        if (checkbox) checkbox.checked = this.controlMode === 'camera';
        if (label) label.textContent = this.controlMode === 'camera' ? 'Camera' : 'Scene';

        // Camera nudge tools and the shot timeline belong to camera mode only.
        document.getElementById('camera-nudge')?.classList.toggle('hidden', this.controlMode !== 'camera');
        const timeline = document.getElementById('shot-timeline');
        if (timeline) timeline.style.display = this.controlMode === 'camera' ? 'flex' : 'none';
        if (this.controlMode === 'camera') this.staging?.shotManager?.refreshUI?.();
        document.getElementById('selection-info')?.classList.toggle('hidden', !(this.selectedObject && this.controlMode === 'scene'));

        this.renderer?.domElement && (this.renderer.domElement.style.cursor = 'default');
        this.ui?.showNotification?.(this.controlMode === 'camera' ? 'Camera controls: drag the view' : 'Scene controls: move objects', 'info');
    }

    // Configure orbit controls for optimal touch/trackpad experience
    configureOrbitControlsForTouch() {
        if (this.orbit) {
            // Enable single-finger panning for better touch/trackpad experience
            this.orbit.enablePan = true;
            this.orbit.screenSpacePanning = true;

            // Optimize for trackpad/touch input
            this.orbit.panSpeed = APP_DEFAULTS.transform.orbitPanSpeed;
            this.orbit.rotateSpeed = APP_DEFAULTS.transform.orbitRotateSpeed;
            this.orbit.dampingFactor = APP_DEFAULTS.transform.dampingFactor;
            this.orbit.enableDamping = true;

            this.orbit.enabled = false;
        }
    }
    
        // Kept as a compatibility alias for older UI bindings. The switch now
        // controls camera-vs-scene editing, not local-vs-world transform space.
        toggleTransformSpace(useCameraMode) {
            this.setControlMode(useCameraMode ? 'camera' : 'scene');
        }

    // --- UNDO/REDO METHODS ---
    undo() {
        return this.historyManager.undo();
    }

    redo() {
        return this.historyManager.redo();
    }

    // Capture transform changes for history
    captureTransformChange(object) {
        if (!object) return;

        // Store current transform
        const currentTransform = {
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
            scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
        };

        // Store previous transform (from before the change)
        if (!object.userData.previousTransform) {
            object.userData.previousTransform = currentTransform;
            return;
        }

        // Create and execute transform command
        const oldTransform = object.userData.previousTransform;
        const transformCommand = new TransformObjectCommand(
            this, object, oldTransform, currentTransform
        );
        
        this.historyManager.executeCommand(transformCommand);
        
        // Update previous transform for next change
        object.userData.previousTransform = currentTransform;
    }

    // --- OBJECT CREATION PROXY ---

    addShape(type) {
        const mesh = this.factory.createShape(type);
        const addCommand = new AddObjectCommand(this, mesh);
        this.historyManager.executeCommand(addCommand);
    }


    async addCharacter(type = 'xbot') {
        try {
            const characterCommand = new AddCharacterCommand(this, type);
            await this.historyManager.executeCommand(characterCommand);
        } catch (error) {
            console.error('Failed to add character:', error);
            this.notifications.show('Failed to add character', 'error');
        }
    }

    addLight(type) {
        const lightContainer = this.factory.createLight(type);
        const addCommand = new AddObjectCommand(this, lightContainer);
        this.historyManager.executeCommand(addCommand);
    }

    /** Staging (blocking) object placement — figures, props, architecture, primitives. */
    addStaging(type) {
        // data-type="kind:presetId" e.g. "figure:figure-seated"
        const [kind, presetId] = String(type).split(':');
        this.staging.addFromUI(kind, presetId);
    }

    sitSelected() {
        this.staging.sitSelected();
    }

    // --- VIRTUAL MOVIE CAMERAS (staging.cameraRigs) ---

    addCameraRig() {
        const rig = this.staging.cameras.addRig();
        if (this.ui?.showNotification) this.ui.showNotification(`Camera ${rig.name} added`, 'success');
    }

    viewThroughCamera() {
        this.staging.cameras.cycleViewThrough();
    }

    frameCameraFromView() {
        const rig = this.staging.cameras.selectedRig || this.staging.cameras.rigs[0];
        if (!rig) return;
        this.staging.cameras.setFromCurrentView(rig);
        if (this.ui?.showNotification) this.ui.showNotification(`Camera ${rig.name} framed from current view`, 'success');
    }

    deleteCameraRig() {
        const rig = this.staging.cameras.selectedRig;
        if (!rig) return;
        this.staging.cameras.removeRig(rig.id);
        if (this.ui?.showNotification) this.ui.showNotification(`Camera ${rig.name} deleted`, 'info');
    }

    setCameraLens(type) {
        // type = "50" (focal) or "sensor:fullFrame"
        const rig = this.staging.cameras.selectedRig || this.staging.cameras.rigs[0];
        if (!rig) return;
        if (String(type).startsWith('sensor:')) {
            this.staging.cameras.setLens(rig, null, String(type).split(':')[1]);
        } else {
            this.staging.cameras.setLens(rig, parseFloat(type), null);
        }
    }

    setCameraAspect(type) {
        const rig = this.staging.cameras.selectedRig || this.staging.cameras.rigs[0];
        if (!rig) return;
        this.staging.cameras.setAspect(rig, type);
    }

    // --- SHOT MANAGER (Cinematic Camera Timeline) ---

    toggleShotTimeline() {
        this.staging.shotManager.toggleUI();
    }

    addShot() {
        const cameras = this.staging.cameras;
        if (cameras.rigs.length === 0) {
            if (this.ui?.showNotification) this.ui.showNotification('Add a virtual camera first', 'error');
            return;
        }
        const rig = this.staging.selectedObject?.userData?.rigRef || cameras.rigs[this.staging.shotManager.shots.length % cameras.rigs.length];
        this.staging.shotManager.createShot(rig.id);
    }

    playShots() {
        this.staging.shotManager.play();
    }

    pauseShots() {
        this.staging.shotManager.pause();
    }

    toggleShotsPlayback() {
        this.staging.shotManager.toggle();
    }

    seekShots(time) {
        this.staging.shotManager.seek(time);
    }

    exportShotTimeline() {
        return this.staging.shotManager.exportTimeline();
    }

    importShotTimeline(data) {
        return this.staging.shotManager.importTimeline(data);
    }

    async exportStoryboardPDF() {
        return exportStoryboardPDF(this);
    }

    async openStoryboardReport() {
        return openStoryboardReport(this);
    }

    // --- SCENE MANAGER ---

    createScene(name) {
        return this.staging.scenes.createScene(name);
    }

    deleteScene(name) {
        return this.staging.scenes.deleteScene(name);
    }

    duplicateScene(name) {
        return this.staging.scenes.duplicateScene(name);
    }

    switchScene(name) {
        return this.staging.scenes.switchToScene(name);
    }

    renameScene(oldName, newName) {
        return this.staging.scenes.renameScene(oldName, newName);
    }

    getSceneNames() {
        return this.staging.scenes.getSceneNames();
    }

    getCurrentSceneName() {
        return this.staging.scenes.currentSceneName;
    }

    exportScenes() {
        return this.staging.scenes.exportScenes();
    }

    importScenes(data) {
        return this.staging.scenes.importScenes(data);
    }

    addToScene(obj) {
        this.scene.add(obj);
        // Add to interactable objects list if it's a root selectable item
        if (['shape', 'shape2d', 'light', 'staging', 'character'].includes(obj.userData.type)) {
            this.objects.push(obj);
        } else if (obj.userData.type === 'figure') {
            this.objects.push(obj); // Store the group as the main object
        }
    }

    addOutlineToObject(mesh, color, thickness) {
        if (!mesh || !mesh.geometry) return null;
        const existing = mesh.getObjectByName('outline');
        if (existing) {
            existing.geometry.dispose();
            existing.material.dispose();
            mesh.remove(existing);
        }
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color || 0x000000,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.6,
            depthTest: true,
            depthWrite: true,
        });
        const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterial);
        outlineMesh.name = 'outline';
        outlineMesh.renderOrder = 0;
        outlineMesh.material.depthTest = true;
        outlineMesh.material.depthWrite = true;
        const s = 1 + (thickness || 0.02);
        outlineMesh.scale.set(s, s, s);
        outlineMesh.visible = true;
        mesh.add(outlineMesh);
        return outlineMesh;
    }

    // Get all objects including those in folders
    getAllObjects() {
        let allObjects = [...this.objects];
        if (this.layerManager) {
            this.layerManager.folders.forEach(folder => {
                allObjects = [...allObjects, ...folder.objects];
            });
        }
        return allObjects;
    }

    // --- HELPER FOR AI ---
    applyColorToSelected(hexColor) {
        if (!this.selectedObject) return;
        const obj = this.selectedObject;

        // Find mesh to color
        let targetMesh = null;
        if (obj.userData.type === 'shape' || obj.userData.type === 'shape2d') targetMesh = obj;
        else if (obj.userData.name) targetMesh = obj.children.find(c => c.isMesh); // Limb
        else if (obj.userData.type === 'figure') targetMesh = obj.children.find(c => c.userData.name === 'Torso');

        if (targetMesh || obj.userData.type === 'figure') {
            if (obj.userData.type === 'figure') {
                obj.traverse(c => {
                    if (!c.isMesh) return;
                    const materials = Array.isArray(c.material) ? c.material : [c.material];
                    materials.forEach(material => material?.color?.set(hexColor));
                });
            } else if (targetMesh) {
                const materials = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];
                const index = Math.min(targetMesh.userData.activeMaterialSlot || 0, materials.length - 1);
                materials[index]?.color?.set(hexColor);
            }
            // Force UI update
            this.ui.renderPropertiesPanel(this.selectedObject);
        }
    }

    // Change figure gender
    changeFigureGender(figureObj, newGender) {
        if (figureObj.userData.type !== 'figure') return;

        // Store current transform
        const pos = figureObj.position.clone();
        const rot = figureObj.rotation.clone();
        const scl = figureObj.scale.clone();

        // Store joint rotations for all joints
        const jointData = {};
        figureObj.traverse(child => {
            if (child.userData.name && child.userData.name.includes('Joint')) {
                jointData[child.userData.name] = {
                    x: child.rotation.x,
                    y: child.rotation.y,
                    z: child.rotation.z
                };
            }
        });

        // Get current color from pelvis
        let currentColor = 0x00ff41;
        const pelvis = figureObj.children.find(c => c.userData.name === 'Pelvis');
        if (pelvis && pelvis.material) {
            currentColor = pelvis.material.color.getHex();
        }

        // Remove old figure from objects array and scene
        this.transformControl.detach();

        // Remove all mesh children from objects array
        figureObj.traverse(child => {
            if (child.isMesh) {
                const idx = this.objects.indexOf(child);
                if (idx > -1) this.objects.splice(idx, 1);
            }
        });

        // Remove figure itself from objects array
        const figIdx = this.objects.indexOf(figureObj);
        if (figIdx > -1) this.objects.splice(figIdx, 1);

        this.scene.remove(figureObj);

        // Create new figure
        const newFigure = this.factory.createFigure(newGender);
        newFigure.position.copy(pos);
        newFigure.rotation.copy(rot);
        newFigure.scale.copy(scl);

        // Apply color to all meshes
        newFigure.traverse(c => {
            if (c.isMesh) c.material.color.setHex(currentColor);
        });

        // Restore joint rotations (matching joint names)
        newFigure.traverse(child => {
            if (child.userData.name && jointData[child.userData.name]) {
                const rot = jointData[child.userData.name];
                child.rotation.set(rot.x, rot.y, rot.z);
            }
        });

        // Add to scene and objects array
        this.addToScene(newFigure);
        newFigure.traverse(child => {
            if (child.isMesh) this.objects.push(child);
        });

        this.selectObject(newFigure);
    }

    // --- MANIPULATION ---

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Track hover for gizmo
        if (this.transformControl && this.transformControl.object) {
            const transformHelpers = [];
            this.transformControl.traverse((child) => {
                if (child.isLineSegments || child.isMesh) {
                    transformHelpers.push(child);
                }
            });
            this.transformControl.isHovered = transformHelpers.length > 0 && 
                this.raycaster.intersectObjects(transformHelpers, true).length > 0;
        }
        
        // Track hover for scene objects
        const allSceneObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData && (obj.userData.type === 'shape' || obj.userData.type === 'shape2d' || obj.userData.type === 'light' || obj.userData.type === 'figure' || obj.userData.type === 'staging' || obj.userData.type === 'character')) {
                allSceneObjects.push(obj);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(allSceneObjects, true);
        
        if (intersects.length > 0) {
            let target = intersects[0].object;
            while (target.parent && target.parent !== this.scene) {
                target = target.parent;
            }
            this.setHoverObject(target);
            this.renderer.domElement.style.cursor = 'pointer';
        } else if (!this.transformControl?.isHovered) {
            this.setHoverObject(null);
            this.renderer.domElement.style.cursor = 'default';
        }
    }
    
    setHoverObject(obj) {
        if (obj === this.hoveredObject) return;
        
        // Clear previous hover highlight
        if (this.hoveredObject && this.originalColors.has(this.hoveredObject.uuid)) {
            this.restoreObjectColor(this.hoveredObject);
        }
        
        this.hoveredObject = obj;
        
        // Apply hover highlight
        if (obj && obj.isMesh) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            this.originalColors.set(obj.uuid, materials.map(material => material?.color?.getHex()));
            materials.forEach(material => material?.color?.lerp(new THREE.Color(0xffffff), 0.15));
        }
    }
    
    restoreObjectColor(obj) {
        if (obj && obj.isMesh && this.originalColors.has(obj.uuid)) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            const colors = this.originalColors.get(obj.uuid);
            materials.forEach((material, index) => material?.color?.setHex(colors[index]));
            this.originalColors.delete(obj.uuid);
        }
    }

    onMouseUp(event) {
    }

    onRightClick(event) {
        event.preventDefault();
        if (this.selectedObject) {
            this.deselect();
        }
    }

    // --- POINTER EVENTS ---

    onPointerUpForDeselect(event) {
        if (event.button !== 0 || this.gizmoDragJustEnded || this.isDraggingGizmo || !this.selectedObject || this.transformControl.isHovered) {
            return;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
this.raycaster.setFromCamera(this.mouse, this.camera);

        const allSceneObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData && (obj.userData.type === 'shape' || obj.userData.type === 'shape2d' || obj.userData.type === 'light' || obj.userData.type === 'figure' || obj.userData.type === 'staging' || obj.userData.type === 'character')) {
                allSceneObjects.push(obj);
            }
        });

        const intersects = this.raycaster.intersectObjects(allSceneObjects, true);

        if (intersects.length === 0) {
            this.deselect();
        }
    }

    onPointerDown(event) {
        // Let editor gizmos handle their own drag.
        if (this.keyframeControls?.axis || this.poseControls?.axis) return;

        if (event.button !== 0) return;

        if (this.poseEditState) {
            const bone = this.pickPoseBone(event);
            if (bone) this.selectPoseBone(bone.name);
            return;
        }

        if (this.controlMode === 'camera') this.renderer.domElement.style.cursor = 'grabbing';

        // Calculate mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check if pointer is over transform controls gizmo
        // Only check if an object is selected AND gizmo is visible AND attached
        let isOverGizmo = false;
        if (this.transformControl && 
            this.transformControl.object && 
            this.transformControl.visible &&
            this.transformControl.parent === this.scene) {
            
            // Raycast to check if we're over the transform gizmo
            const transformHelpers = [];
            this.transformControl.traverse((child) => {
                if (child.isLineSegments || child.isMesh) {
                    transformHelpers.push(child);
                }
            });
            
            if (transformHelpers.length > 0) {
                const helperIntersects = this.raycaster.intersectObjects(transformHelpers, true);
                isOverGizmo = helperIntersects.length > 0;
            }
            
            if (isOverGizmo) {
                // Let TransformControls handle gizmo interaction
                return;
            }
        }
        
// Not over gizmo, check if we clicked on an object
        const allSceneObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData && (obj.userData.type === 'shape' || obj.userData.type === 'shape2d' || obj.userData.type === 'light' || obj.userData.type === 'figure' || obj.userData.type === 'staging' || obj.userData.type === 'character')) {
                allSceneObjects.push(obj);
            }
        });

        const intersects = this.raycaster.intersectObjects(allSceneObjects, true);

        if (intersects.length > 0) {
            let target = intersects[0].object;

            // Walk up hierarchy to find root selectable object
            while (target.parent && target.parent !== this.scene) {
                if (target.userData && (target.userData.type === 'shape' || target.userData.type === 'shape2d' || target.userData.type === 'light' || target.userData.type === 'figure' || target.userData.type === 'staging' || target.userData.type === 'character')) {
                    break;
                }
                target = target.parent;
            }

            // If clicking a different object, select it
            if (target !== this.selectedObject) {
                this.selectObject(target);
            }
        } else {
            // Clicking empty space clears the selection immediately, so the
            // next click can select a different object without fighting the
            // previous transform gizmo.
            this.deselect();
        }
    }

    selectObject(obj) {
        // Always resolve a character mesh/bone up to the character root so the
        // pose controls in the properties panel are available.
        let characterRoot = obj;
        while (characterRoot && characterRoot !== this.scene) {
            if (characterRoot.userData?.type === 'character') break;
            characterRoot = characterRoot.parent;
        }
        if (characterRoot?.userData?.type === 'character') obj = characterRoot;

        // Special Handling: Limb selection should select the Joint (parent)
        if (obj.userData.name && obj.parent.userData.name && obj.parent.userData.name.includes('Joint')) {
            this.selectedObject = obj.parent;
        } else {
            this.selectedObject = obj;
        }

        if (this.transformControl) {
            this.transformControl.attach(this.selectedObject);
            this.transformControl.visible = this.controlMode === 'scene';
            this.transformControl.setSize(APP_DEFAULTS.transform.selectGizmoSize);
        }

        this.ui.resetPanelToDefault();

        // This triggers UI update which now renders layers via LayerManager
        this.ui.updateUI(this.selectedObject);

    }

    deselect() {
        this.selectedObject = null;
        if (this.transformControl) {
            this.transformControl.detach();
            this.transformControl.visible = false;
        }
        this.clearSnapGuides();
        if (this.ui) this.ui.updateUI(null);
    }

    setTransformMode(mode) {
        if (mode === 'hand') {
            if (this.orbit) {
                this.orbit.enablePan = true;
                this.orbit.screenSpacePanning = true;
                this.orbit.panSpeed = APP_DEFAULTS.transform.handPanSpeed;
                this.orbit.enableDamping = true;
                this.orbit.dampingFactor = APP_DEFAULTS.transform.dampingFactor;
            }
            this.setControlMode('camera');
            this.ui.showNotification('Camera controls: drag to look, right-drag to pan', 'info');
        } else {
            this.setControlMode('scene');
            this.transformControl.setMode(mode);

            const modeNames = {
                'translate': 'Translate',
                'rotate': 'Rotate',
                'scale': 'Scale'
            };
            this.ui.showNotification(`${modeNames[mode] || mode} mode activated`, 'info');
        }
    }

    deleteSelected() {
        if (!this.selectedObject) return;
        
        let root = this.selectedObject;
        while (root.parent && root.parent !== this.scene) {
            root = root.parent;
        }

        const deleteCommand = new DeleteObjectCommand(this, root);
        this.historyManager.executeCommand(deleteCommand);
    }

    clearScene() {
        const clearCommand = new ClearSceneCommand(this);
        this.historyManager.executeCommand(clearCommand);
    }

    _clearSceneNow() {
        this.deselect();
        for (const object of [...this.objects]) {
            this.scene.remove(object);
        }
        this.objects.length = 0;
        if (this.layerManager?.folders) {
            this.layerManager.folders.forEach(folder => { folder.objects = []; });
        }
        this.ui.updateUI(null);
    }

    // --- LOOP ---

    onWindowResize() {
        const container = document.getElementById('canvas-container');
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);

        // Let camera manager handle camera aspect ratio updates
        if (this.cameraManager) {
            this.cameraManager.onWindowResize();
        }
    }

    // --- SETTINGS METHODS ---
    setGridVisible(visible) {
        // Find and toggle grid helper
        this.scene.traverse(obj => {
            if (obj.type === 'GridHelper') {
                obj.visible = visible;
            }
        });
    }

    setAxesVisible(visible) {
        this.scene.traverse(obj => {
            if (obj.type === 'AxesHelper') {
                obj.visible = visible;
            }
        });
    }

    setSnapEnabled(enabled) {
        this.snapEnabled = enabled;
    }

    // --- SNAP: GRID ALIGNMENT ---

    /** Round a value to the nearest snap unit. */
    snapToGrid(value) {
        const u = this.snapGridUnit;
        return Math.round(value / u) * u;
    }

    /** Snap object position to the nearest grid cell. Leaves y untouched for floor objects. */
    snapObjectToGrid(obj) {
        const base = obj.position.clone();
        base.x = this.snapToGrid(base.x);
        base.z = this.snapToGrid(base.z);
        // Only snap Y if the object sits on / above the ground
        if (base.y > 0.5 || obj.userData.type === 'plane') {
            base.y = this.snapToGrid(base.y);
        }
        return base;
    }

    // --- SNAP: OBJECT-TO-OBJECT ALIGNMENT ---

    /**
     * Return the nearest object whose surface we can snap to, or null.
     *
     * Snapping is face-detection based along the three axes.  For each
     * candidate object we compute where the dragged object's bounding-box
     * bottom edge touches the candidate's top face (and similarly for the
     * four side faces).  The closest hit within `snapThreshold` wins.
     */
    findSnapshot(curObj) {
        if (!this.snapEnabled || this.snapMode === 'off') return null;
        if (!curObj || !curObj.geometry) return null;

        const curBB = new THREE.Box3().setFromObject(curObj);
        const curSize = new THREE.Vector3();
        const curCenter = new THREE.Vector3();
        curBB.getSize(curSize);
        curBB.getCenter(curCenter);

        let best = null;
        let bestDist = this.snapThreshold;

        const candidates = [];
        this.scene.traverse(o => {
            if (o === curObj || o === curObj.parent) return;
            if (!o.geometry || !o.userData) return;
            // Only snap against shapes, lights, and figures.
            const t = o.userData.type;
            if (t !== 'shape' && t !== 'light' && t !== 'figure') return;
            const bb = new THREE.Box3().setFromObject(o);
            // Per-axis distance check – objects must be close in the
            // perpendicular directions before we even consider this hit.
            const c2 = new THREE.Vector3();
            bb.getCenter(c2);
            const dx = Math.abs(curCenter.x - c2.x);
            const dy = Math.abs(curCenter.y - c2.y);
            const dz = Math.abs(curCenter.z - c2.z);
            if (dx < bestDist * 1.5 && dy < bestDist * 1.5 && dz < bestDist * 1.5) {
                candidates.push({ obj: o, bb, center: c2 });
            }
        });

        // Axis pairs we can snap along: targetAxis is which side of the
        // candidate we touch; sweepAxes determine where along that face.
        const faceAxes = [
            { axis: 'y', write: 'y', sweep: ['x', 'z'], normal: 1 }, // top
            { axis: 'y', write: 'y', sweep: ['x', 'z'], normal: -1 }, // bottom
            { axis: 'x', write: 'x', sweep: ['y', 'z'], normal: 1 }, // +x side
            { axis: 'x', write: 'x', sweep: ['y', 'z'], normal: -1 }, // -x side
            { axis: 'z', write: 'z', sweep: ['x', 'y'], normal: 1 }, // +z side
            { axis: 'z', write: 'z', sweep: ['x', 'y'], normal: -1 }, // -z side
        ];

        for (const fa of faceAxes) {
            const oMin = candidates.map(c => c.bb.min[fa.axis]);
            const oMax = candidates.map(c => c.bb.max[fa.axis]);

            const curMin = curBB.min[fa.axis];
            const curMax = curBB.max[fa.axis];

            for (let i = 0; i < candidates.length; i++) {
                const target = candidates[i];
                const tMin = target.bb.min[fa.axis];
                const tMax = target.bb.max[fa.axis];

                // Compute candidate snap position along the normal axis.
                // For a top-face snap (normal=+1) we place the bottom of curObj
                // flush with the top of target.
                let snapVal;
                if (fa.normal === 1) {
                    snapVal = tMax;
                } else {
                    snapVal = tMin - curSize[fa.axis];
                }

                // Distance along the normal axis.
                const distAlong = Math.abs((curMin + curMax) / 2 - (tMin + tMax) / 2);
                if (distAlong > this.snapThreshold) continue;

                // Now check sweep-axes: can we align within edge threshold?
                const [s1, s2] = fa.sweep;
                for (let si = 0; si < 2; si++) {
                    const sa = si === 0 ? s1 : s2;

                    // snap so that cur center matches target center on sweep axis
                    const tCenter = target.center[sa];
                    const curEdge = curBB.min[sa];
                    const curEdgeMax = curBB.max[sa];

                    // candidate snap
                    const snapOnSweep = tCenter - (curCenter[sa] - curBB.min[sa]);

                    // distance
                    const d = Math.abs(curCenter[sa] - tCenter)
                            - (Math.abs(curEdgeMax - curEdge) / 2);

                    if (Math.abs(d) > this.snapEdgeThreshold) continue;

                    // Overall distance squared (for ranking)
                    const dist2 = distAlong * distAlong + (d * d);
                    if (dist2 >= bestDist * bestDist) continue;

                    bestDist = Math.sqrt(dist2);
                    best = {
                        target: target.obj,
                        targetBB: target.bb,
                        snapPosition: new THREE.Vector3(
                            fa.write === 'x' ? snapVal : (si === 0 ? snapOnSweep : curObj.position[si === 0 ? s1 : s2]),
                            fa.write === 'y' ? snapVal : (si === 0 ? curObj.position.y : (sa === 'y' ? snapOnSweep : curObj.position.y)),
                            fa.write === 'z' ? snapVal : (si === 0 ? curObj.position.z : (sa === 'z' ? snapOnSweep : curObj.position.z))
                        ),
                        faceAxis: fa.axis,
                        faceNormal: fa.normal === 1 ? 1 : -1
                    };
                }
            }
        }

        return best;
    }

    // --- SNAP: VISUAL GUIDES ---

    clearSnapGuides() {
        if (this.snapGuideLine) {
            this.scene.remove(this.snapGuideLine);
            this.snapGuideLine.geometry.dispose();
            this.snapGuideLine = null;
        }
        if (this.snapGuideFace) {
            this.scene.remove(this.snapGuideFace);
            this.snapGuideFace.material.dispose();
            this.snapGuideFace = null;
        }
        this.snapTarget = null;
        this.snapFace = null;
    }

    updateSnapGuides(snapResult, selectedObj) {
        this.clearSnapGuides();

        if (!snapResult || !selectedObj) return;

        const srcBB = new THREE.Box3().setFromObject(selectedObj);
        const tgtBB = snapResult.targetBB;
        const targetObj = snapResult.target;

        // Compute closest face alignment on sweep axes
        const selPos = selectedObj.position.clone();
        const tgtPos = targetObj.position.clone();
        const snapPos = snapResult.snapPosition.clone();

        // --- Guide line: from closest face edge of source to target face ---
        // Determine which face of the target we touched and build a
        // thin colored line from the source face edge to the target face.
        const fa = snapResult.faceAxis;
        const fn = snapResult.faceNormal;
        const tCenter = new THREE.Vector3();
        tgtBB.getCenter(tCenter);
        const sMin = srcBB.min[fa];
        const sMax = srcBB.max[fa];

        // Place one end at the innermost edge of the source box
        const srcEdgePos = selPos.clone();
        srcEdgePos[snapResult.faceAxis] = fn === 1 ? sMin : sMax;

        // Place the other end on the nearest edge of the target box
        const tgtEdgePos = tCenter.clone();
        if (fn === 1) {
            tgtEdgePos[fa] = tgtBB.max[fa];
        } else {
            tgtEdgePos[fa] = tgtBB.min[fa];
        }

        // Only use sensible guide line if two-point pair is valid
        if (srcEdgePos.distanceTo(tgtEdgePos) > this.snapThreshold * 3) {
            // skip awkward far-apart guides
            return;
        }

        const lp = new THREE.LineBasicMaterial({
            color: 0x00ff88,
            linewidth: 2,
            transparent: true,
            opacity: 0.9
        });
        const geo = new THREE.BufferGeometry().setFromPoints([
            srcEdgePos, tgtEdgePos
        ]);
        this.snapGuideLine = new THREE.Line(geo, lp);
        this.scene.add(this.snapGuideLine);

        // --- Highlight target object's closest face with a thin translucent patch ---
        const facePatchMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.18,
            depthTest: false,
            side: THREE.DoubleSide,
        });
        const fW = tgtBB.max[(fa + 1) % 3] - tgtBB.min[(fa + 1) % 3];
        const fH = tgtBB.max[(fa + 2) % 3] - tgtBB.min[(fa + 2) % 3];
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(fW, fH), facePatchMat);
        patch.renderOrder = 999;
        patch.position.copy(tCenter);
        patch.position[fa] = fn === 1 ? tgtBB.max[fa] + 0.005 : tgtBB.min[fa] - 0.005;
        // Face outward
        patch.rotation[fa] = fn === 1 ? 0 : Math.PI;
        this.snapGuideFace = patch;
        this.scene.add(patch);
    }

    setCameraSpeed(speed) {
        // Adjust orbit controls speed (only if orbit controls are initialized)
        if (this.orbit) {
            this.orbit.rotateSpeed = speed;
            this.orbit.panSpeed = speed;
            this.orbit.zoomSpeed = speed;
        }
    }

    // --- SCENE SETTINGS METHODS ---
    setBackgroundColor(colorHex) {
        if (!this.scene) return;
        if (colorHex) {
            this.scene.background = new THREE.Color(colorHex);
        } else {
            // Use default background if null/undefined
            this.scene.background = new THREE.Color(0x2a2a4e);
        }
    }

    setAmbientLight(enabled, colorHex) {
        if (!this.scene) return;
        // Find and update ambient light
        this.scene.traverse(obj => {
            if (obj.type === 'AmbientLight') {
                obj.visible = enabled;
                if (colorHex) {
                    obj.color = new THREE.Color(colorHex);
                }
            }
        });
    }

    setFog(enabled, colorHex, near, far) {
        if (!this.scene) return;
        if (enabled) {
            const color = colorHex ? new THREE.Color(colorHex) : new THREE.Color(0x2a2a4e);
            this.scene.fog = new THREE.Fog(color, near ?? 30, far ?? 100);
        } else {
            this.scene.fog = null;
        }
    }

    setGradientBackground(topColorHex, bottomColorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const topColor = new THREE.Color(topColorHex || '#1a1a2e');
        const bottomColor = new THREE.Color(bottomColorHex || '#0f0f1b');

        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, `rgb(${Math.round(topColor.r * 255)}, ${Math.round(topColor.g * 255)}, ${Math.round(topColor.b * 255)})`);
        gradient.addColorStop(1, `rgb(${Math.round(bottomColor.r * 255)}, ${Math.round(bottomColor.g * 255)}, ${Math.round(bottomColor.b * 255)})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.scene.background = texture;
    }

    clearGradientBackground() {
        this.scene.background = new THREE.Color(0x2a2a4e);
    }

    addDefaultTestObjects() {
        // Default staging scene: floor, two walls, one standing actor centrally
        const floor = this.staging.place('architecture', 'floor', { params: { width: 12, depth: 12 } });
        if (floor) floor.position.set(0, 0, 0);

        const backWall = this.staging.place('architecture', 'wall-straight', { params: { length: 8, height: 5.4 } });
        if (backWall) backWall.position.set(-2, 0, -6);

        const sideWall = this.staging.place('architecture', 'wall-straight', { params: { length: 8, height: 5.4 } });
        if (sideWall) {
            sideWall.position.set(-6, 0, -2);
            sideWall.rotation.y = Math.PI / 2;
        }

        this.staging.place('figure', 'figure-standing');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        
        // Update light helpers
        this.scene.traverse(obj => {
            if (obj.userData.type === 'light' && obj.children[1]) {
                obj.children[1].update();
            }
        });

        // Update character animations
        this.characterManager.update(delta);

        // Update orbit controls (only if initialized and enabled)
        if (this.orbit && this.orbit.enabled) {
            this.orbit.update();
        }
        // Staging: shot timeline (playing) > rig view-through > editing camera
        const shotCam = this.staging.shotManager.update(delta);
        const rigCam = shotCam || this.staging.cameras.getRenderCamera();
        const guides = document.getElementById('camera-guides');
        if (guides) guides.classList.toggle('hidden', !(this.cameraGuidesEnabled && rigCam));
        if (rigCam) {
            const vp = this.staging.cameras.getRenderViewport(this.renderer.domElement);
            if (vp) {
                const dpr = this.renderer.getPixelRatio();
                this.renderer.setScissorTest(true);
                this.renderer.setScissor(vp.x * dpr, vp.y * dpr, vp.width * dpr, vp.height * dpr);
                this.renderer.setViewport(vp.x * dpr, vp.y * dpr, vp.width * dpr, vp.height * dpr);
                this.renderer.setScissorTest(false);
                this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);
            } else {
                this.renderer.render(this.scene, rigCam);
            }
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Bootstrap
window.onload = () => {
    window.app = new StageApp();
};
