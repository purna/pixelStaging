import * as THREE from 'three';

/**
 * Storyboard PDF export.
 *
 * Every saved scene contributes its shots to one PDF. Each shot gets a page
 * with start/end frames and the camera/timing notes needed to reproduce it.
 * PDF writing is intentionally self-contained (no extra runtime dependency).
 */

const PAGE_W = 612;
const PAGE_H = 792;

function bytes(text) {
    return new TextEncoder().encode(text);
}

function concatBytes(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function base64Bytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function pdfText(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r?\n/g, ' ');
}

function wrap(text, maxChars) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        if ((line + ' ' + word).trim().length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = (line + ' ' + word).trim();
        }
    }
    if (line) lines.push(line);
    return lines;
}

class PDFBuilder {
    constructor() {
        this.objects = new Map();
        this.nextId = 4; // 1 catalog, 2 pages, 3 font
        this.objects.set(3, bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
    }

    addObject(data) {
        const id = this.nextId++;
        this.objects.set(id, data);
        return id;
    }

    addImage(dataUrl, width, height) {
        const imageBytes = base64Bytes(dataUrl);
        const header = bytes(
            `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`
        );
        return this.addObject(concatBytes([header, imageBytes, bytes('\nendstream')]));
    }

    addContent(stream) {
        const body = bytes(stream);
        return this.addObject(concatBytes([
            bytes(`<< /Length ${body.length} >>\nstream\n`),
            body,
            bytes('\nendstream')
        ]));
    }

    addPage(contentId, images) {
        const imageResources = images
            .map((id, index) => `/Im${index} ${id} 0 R`)
            .join(' ');
        const page = bytes(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
            `/Resources << /Font << /F1 3 0 R >> /XObject << ${imageResources} >> >> ` +
            `/Contents ${contentId} 0 R >>`
        );
        return this.addObject(page);
    }

    finish(pageIds) {
        this.objects.set(2, bytes(
            `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
        ));
        this.objects.set(1, bytes('<< /Type /Catalog /Pages 2 0 R >>'));

        const header = bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
        const parts = [header];
        const offsets = [];
        let offset = header.length;
        const ids = [...this.objects.keys()].sort((a, b) => a - b);

        for (const id of ids) {
            const body = this.objects.get(id);
            offsets[id] = offset;
            const prefix = bytes(`${id} 0 obj\n`);
            const suffix = bytes('\nendobj\n');
            parts.push(prefix, body, suffix);
            offset += prefix.length + body.length + suffix.length;
        }

        const maxId = ids[ids.length - 1] || 0;
        const xrefOffset = offset;
        let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
        for (let id = 1; id <= maxId; id++) {
            xref += offsets[id]
                ? `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
                : '0000000000 65535 f \n';
        }
        xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        parts.push(bytes(xref));

        return concatBytes(parts);
    }
}

function makePage(builder, sceneName, shot, frames, sceneNotes = '') {
    const imageObjects = frames.map(frame => builder.addImage(frame.dataUrl, frame.width, frame.height));
    const imageIds = imageObjects;

    const lines = [];
    lines.push(`BT /F1 18 Tf 44 742 Td (${pdfText(sceneName)} - ${pdfText(shot.name)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 44 714 Td (Camera: ${pdfText(shot.cameraName)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 44 698 Td (Move: ${pdfText(shot.move)}    Duration: ${shot.duration.toFixed(1)}s    Speed: x${shot.speed}    Easing: ${pdfText(shot.easing)}) Tj ET`);
    lines.push(`BT /F1 9 Tf 44 684 Td (Lens: ${pdfText(shot.cameraLens || '—')}    Sensor: ${pdfText(shot.cameraSensor || '—')}    Aspect: ${pdfText(shot.cameraAspect || '—')}) Tj ET`);
    const startPos = frames[0]?.position ? frames[0].position.map(v => v.toFixed(2)).join(', ') : '—';
    const endPos = frames[1]?.position ? frames[1].position.map(v => v.toFixed(2)).join(', ') : '—';
    lines.push(`BT /F1 9 Tf 44 670 Td (Start XYZ: ${pdfText(startPos)}    End XYZ: ${pdfText(endPos)}) Tj ET`);

    const framing = [];
    if (shot.startFrame) framing.push('start keyframe');
    if (shot.endFrame) framing.push('end keyframe');
    lines.push(`BT /F1 10 Tf 44 682 Td (Framing: ${pdfText(framing.length ? framing.join(', ') : 'auto / camera preset')}) Tj ET`);

    let imageCommand = 'q\n';
    if (frames.length >= 2) {
        imageCommand += `250 0 0 140 44 500 cm /Im0 Do Q\n`;
        imageCommand += `q 250 0 0 140 318 500 cm /Im1 Do Q\n`;
        lines.push(`BT /F1 9 Tf 44 646 Td (${pdfText(frames[0].label || 'Start keyframe')}) Tj ET`);
        lines.push(`BT /F1 9 Tf 318 646 Td (${pdfText(frames[1].label || 'End keyframe')}) Tj ET`);
    } else {
        imageCommand += `524 0 0 294 44 420 cm /Im0 Do Q\n`;
        if (frames[0]?.label) lines.push(`BT /F1 9 Tf 44 410 Td (${pdfText(frames[0].label)}) Tj ET`);
    }

    const notes = shot.notes || '';
    const textLines = [
        `Camera movement: ${shot.move}. Starts at the first frame and arrives at the second frame over ${shot.duration.toFixed(1)} seconds at x${shot.speed} speed.`,
        shot.transitionLabel || '' ,
        framing.length ? `Use the stored ${framing.join(' and ')} camera framing.` : 'The move is generated automatically from the shot preset.',
        notes
    ].filter(Boolean);

    let y = 606;
    for (const block of textLines) {
        for (const line of wrap(block, 92)) {
            lines.push(`BT /F1 10 Tf 44 ${y} Td (${pdfText(line)}) Tj ET`);
            y -= 14;
        }
        y -= 4;
    }

    lines.push(`BT /F1 9 Tf 44 40 Td (Pixel Staging storyboard - ${pdfText(sceneName)}) Tj ET`);

    const contentId = builder.addContent(imageCommand + '\n' + lines.join('\n'));
    return builder.addPage(contentId, imageIds);
}

function hideExportHelpers(app) {
    const hidden = [];
    const shouldHide = (object) => {
        if (!object) return false;
        if (object === app.transformControl || object === app.keyframeControls) return true;
        if (object.userData?.isKeyframeGizmo || object.userData?.rigRef) return true;
        if (object.userData?.helper) return true;
        if (object.type === 'GridHelper' || object.type === 'AxesHelper') return true;
        if (object.type?.endsWith?.('Helper')) return true;
        if (object.name === 'shot-path-preview') return true;
        if (Array.isArray(app.staging?.shotManager?.pathMarkers) && app.staging.shotManager.pathMarkers.includes(object)) return true;
        return false;
    };

    app.scene.traverse(object => {
        if (shouldHide(object) && object.visible) {
            hidden.push(object);
            object.visible = false;
        }
    });
    return () => hidden.forEach(object => { object.visible = true; });
}

function getRenderSize(app) {
    const renderer = app.renderer;
    const canvas = renderer.domElement;
    const size = renderer.getSize(new THREE.Vector2());
    return {
        width: Math.max(1, Math.round(size.x || canvas.clientWidth || canvas.width)),
        height: Math.max(1, Math.round(size.y || canvas.clientHeight || canvas.height))
    };
}

/** Draw the same thirds / safe-area guides used by the viewport into a still. */
function drawCameraGuides(ctx, width, height) {
    const stroke = Math.max(1, Math.round(Math.min(width, height) / 720));
    const insetRect = (inset) => {
        const x = width * inset;
        const y = height * inset;
        ctx.strokeRect(x, y, width - x * 2, height - y * 2);
    };

    ctx.save();
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width / 3) * 2, 0);
    ctx.lineTo((width / 3) * 2, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height / 3) * 2);
    ctx.lineTo(width, (height / 3) * 2);
    ctx.stroke();

    ctx.setLineDash([stroke * 5, stroke * 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    insetRect(0.05);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(width / 2 - stroke * 8, height / 2);
    ctx.lineTo(width / 2 + stroke * 8, height / 2);
    ctx.moveTo(width / 2, height / 2 - stroke * 8);
    ctx.lineTo(width / 2, height / 2 + stroke * 8);
    ctx.stroke();
    ctx.restore();
}

function renderWithCamera(app, camera, { aspect = null, guides = false } = {}) {
    const renderer = app.renderer;
    const canvas = renderer.domElement;
    const { width, height } = getRenderSize(app);
    const oldViewport = renderer.getViewport(new THREE.Vector4());
    const oldScissor = renderer.getScissor(new THREE.Vector4());
    const oldScissorTest = renderer.getScissorTest();
    const restoreHelpers = hideExportHelpers(app);

    // Frame the still exactly like the camera preview: a centred viewport
    // with the camera's own aspect, rather than stretching the camera over
    // the whole editor canvas.
    let vx = 0;
    let vy = 0;
    let vw = width;
    let vh = height;
    if (Number.isFinite(aspect) && aspect > 0) {
        if (width / height > aspect) {
            vh = height;
            vw = height * aspect;
        } else {
            vw = width;
            vh = width / aspect;
        }
        vx = (width - vw) / 2;
        vy = (height - vh) / 2;
        if (camera.isPerspectiveCamera) {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        }
    }

    renderer.setScissorTest(true);
    renderer.setViewport(vx, vy, vw, vh);
    renderer.setScissor(vx, vy, vw, vh);
    camera.updateMatrixWorld(true);
    renderer.render(app.scene, camera);

    // Copy just the rendered camera viewport at full drawing-buffer
    // resolution. setViewport() takes CSS pixels, while the canvas is in
    // device pixels, so account for the renderer's pixel ratio here.
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const outWidth = Math.max(1, Math.round(vw * scaleX));
    const outHeight = Math.max(1, Math.round(vh * scaleY));
    const out = document.createElement('canvas');
    out.width = outWidth;
    out.height = outHeight;
    const ctx = out.getContext('2d');
    ctx.drawImage(
        canvas,
        Math.round(vx * scaleX),
        Math.round(vy * scaleY),
        outWidth,
        outHeight,
        0,
        0,
        outWidth,
        outHeight
    );
    if (guides && app.cameraGuidesEnabled && !document.body.classList.contains('overlays-hidden')) {
        drawCameraGuides(ctx, outWidth, outHeight);
    }

    const dataUrl = out.toDataURL('image/jpeg', 0.86);

    renderer.setViewport(oldViewport);
    renderer.setScissor(oldScissor);
    renderer.setScissorTest(oldScissorTest);
    restoreHelpers();

    return { dataUrl, width: outWidth, height: outHeight, position: camera.position.toArray() };
}

function getSceneBounds(app) {
    const box = new THREE.Box3();
    let hasBounds = false;
    for (const object of app.objects || []) {
        if (object.userData?.rigRef) continue;
        box.expandByObject(object);
        hasBounds = true;
    }
    if (!hasBounds) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    return box;
}

function renderSceneViews(app) {
    const box = getSceneBounds(app);
    const boundsCenter = box.getCenter(new THREE.Vector3());
    const { width, height } = getRenderSize(app);
    const aspect = width / height;

    // Scene views are laid out from the world origin (the default model
    // position), not from an off-centre bounding box. The vertical focus
    // stays on the content so side views are not framed around the floor.
    const center = new THREE.Vector3(0, boundsCenter.y, 0);
    const halfX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), 2) * 1.15;
    const halfY = Math.max(Math.abs(box.max.y - center.y), Math.abs(box.min.y - center.y), 2) * 1.15;
    const halfZ = Math.max(Math.abs(box.min.z), Math.abs(box.max.z), 2) * 1.15;
    const distance = Math.max(halfX, halfY, halfZ) * 2.2;

    const makeCamera = (position, up, halfHeight, halfWidth) => {
        const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, distance * 4);
        camera.position.copy(position);
        camera.up.copy(up);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        return camera;
    };

    // Fit each view to the full scene extent on both axes.
    const topdownHeight = Math.max(halfZ, halfX / aspect);
    const sideHeight = Math.max(halfY, halfZ / aspect);

    return [
        { label: 'Topdown view', ...renderWithCamera(app, makeCamera(new THREE.Vector3(center.x, Math.max(box.max.y, center.y) + distance, center.z), new THREE.Vector3(0, 0, -1), topdownHeight, topdownHeight * aspect)) },
        { label: 'Left side view', ...renderWithCamera(app, makeCamera(new THREE.Vector3(Math.min(box.min.x, 0) - distance, center.y, center.z), new THREE.Vector3(0, 1, 0), sideHeight, sideHeight * aspect)) },
        { label: 'Right side view', ...renderWithCamera(app, makeCamera(new THREE.Vector3(Math.max(box.max.x, 0) + distance, center.y, center.z), new THREE.Vector3(0, 1, 0), sideHeight, sideHeight * aspect)) }
    ];
}

function makeSceneViewsPage(builder, sceneName, views) {
    const imageIds = views.map(view => builder.addImage(view.dataUrl, view.width, view.height));
    const lines = [];
    lines.push(`BT /F1 18 Tf 44 742 Td (${pdfText(sceneName)} - Scene views) Tj ET`);
    lines.push(`BT /F1 10 Tf 44 716 Td (Topdown and side reference views) Tj ET`);

    let imageCommand = 'q\n';
    const positions = [
        { x: 44, y: 532, w: 250, h: 140 },
        { x: 318, y: 532, w: 250, h: 140 },
        { x: 181, y: 340, w: 250, h: 140 }
    ];
    views.forEach((view, index) => {
        const p = positions[index];
        imageCommand += `q ${p.w} 0 0 ${p.h} ${p.x} ${p.y} cm /Im${index} Do Q\n`;
        lines.push(`BT /F1 9 Tf ${p.x} ${p.y - 16} Td (${pdfText(view.label)}) Tj ET`);
    });

    const contentId = builder.addContent(imageCommand + '\n' + lines.join('\n'));
    return builder.addPage(contentId, imageIds);
}

function renderFrame(app, rig, shot, shotManager, localT, explicitFrame = null) {
    const camera = rig.camera.clone();

    if (explicitFrame) {
        camera.position.fromArray(explicitFrame.position);
        camera.quaternion.fromArray(explicitFrame.quaternion);
        if (Number.isFinite(explicitFrame.fov)) camera.fov = explicitFrame.fov;
        camera.updateProjectionMatrix();
    } else if (shot && shotManager) {
        shotManager.applyShotMove(camera, rig, shot, localT, 0);
    } else {
        rig.group.updateMatrixWorld(true);
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        rig.group.getWorldPosition(worldPosition);
        rig.group.getWorldQuaternion(worldQuaternion);
        camera.position.copy(worldPosition);
        camera.quaternion.copy(worldQuaternion);
    }

    return renderWithCamera(app, camera, { aspect: rig.camera.aspect, guides: true });
}

function collectShotsForScene(app) {
    const cameras = app.staging?.cameras;
    const shotManager = app.staging?.shotManager;
    const rigs = cameras?.rigs || [];
    const defaultRig = cameras?.defaultRig || rigs[0] || null;
    const shots = shotManager?.shots || [];

    if (shots.length) {
        return shots.map(shot => {
            const rig = cameras?.get?.(shot.cameraId) || defaultRig;
            return {
                shot,
                rig,
                name: shot.name,
                cameraName: rig?.name ? `Camera ${rig.name}` : 'Default Camera',
                cameraLens: rig?.lens ? `${rig.lens.focalLength}mm` : '',
                cameraSensor: rig?.lens?.sensor || '',
                cameraAspect: rig?.aspect || '',
                move: shot.move || 'Static',
                duration: Number.isFinite(shot.duration) ? shot.duration : 3,
                speed: Number.isFinite(shot.speed) ? shot.speed : 1,
                easing: shot.easing || 'io',
                transitionLabel: shot.transition?.type && shot.transition.type !== 'none'
                    ? `Transition to next shot: ${shot.transition.type}, ${(shot.transition.length || 1).toFixed(2)}s, opacity ${shot.transition.opacity ?? 1}.`
                    : 'Transition to next shot: cut.',
                startFrame: !!shot.startFrame,
                endFrame: !!shot.endFrame,
                notes: shot.notes || ''
            };
        }).filter(item => item.rig);
    }

    if (!defaultRig) return [];
    return [{
        shot: null,
        rig: defaultRig,
        name: 'Scene camera',
        cameraName: defaultRig.name ? `Camera ${defaultRig.name}` : 'Default Camera',
        cameraLens: defaultRig.lens ? `${defaultRig.lens.focalLength}mm` : '',
        cameraSensor: defaultRig.lens?.sensor || '',
        cameraAspect: defaultRig.aspect || '',
        move: 'Static',
        duration: 0,
        speed: 1,
        easing: 'io',
        startFrame: false,
        endFrame: false,
        notes: 'No shot timeline has been added to this scene yet.'
    }];
}

async function collectStoryboardData(app) {
    const scenes = app.staging?.scenes;
    if (!scenes) return [];
    const originalScene = scenes.currentSceneName;
    const sceneNames = scenes.getSceneNames();
    const data = [];

    try {
        scenes.saveCurrentSceneState();
        for (const sceneName of sceneNames) {
            if (scenes.currentSceneName !== sceneName) scenes.switchToScene(sceneName);
            const sceneNotes = scenes.getSceneNotes?.(sceneName) || '';
            const sceneViews = renderSceneViews(app);
            const items = collectShotsForScene(app);
            for (const item of items) {
                const frames = [];
                if (item.shot) {
                    const shot = item.shot;
                    const keyframes = [
                        { label: `Start keyframe (${shot.startFrame ? 'custom' : 'auto'})`, frame: shot.startFrame, t: 0 },
                        { label: `End keyframe (${shot.endFrame ? 'custom' : 'auto'})`, frame: shot.endFrame, t: item.duration }
                    ];
                    for (const keyframe of keyframes) {
                        const rendered = renderFrame(app, item.rig, shot, app.staging.shotManager, keyframe.t, keyframe.frame);
                        rendered.label = keyframe.label;
                        frames.push(rendered);
                    }
                } else {
                    const rendered = renderFrame(app, item.rig, null, null, 0);
                    rendered.label = 'Scene camera overview';
                    frames.push(rendered);
                }
                data.push({ sceneName, sceneNotes, sceneViews, item, frames });
            }
        }
    } finally {
        if (scenes.currentSceneName !== originalScene) {
            try { scenes.switchToScene(originalScene); } catch (error) { console.warn(error); }
        }
    }
    return data;
}

export async function exportStoryboardPDF(app) {
    const scenes = app.staging?.scenes;
    if (!scenes) {
        app.ui?.showNotification?.('No scene manager available', 'error');
        return;
    }

    const originalScene = scenes.currentSceneName;
    const sceneNames = scenes.getSceneNames();
    if (!sceneNames.length) {
        app.ui?.showNotification?.('Add a scene first', 'error');
        return;
    }

    app.ui?.showNotification?.('Building storyboard PDF…', 'info');

    const pages = [];
    const builder = new PDFBuilder();
    const storyboard = await collectStoryboardData(app);

    const seenScenes = new Set();
    for (const { sceneName, sceneNotes, sceneViews, item, frames } of storyboard) {
        if (!seenScenes.has(sceneName) && sceneViews?.length) {
            pages.push(makeSceneViewsPage(builder, sceneName, sceneViews));
            seenScenes.add(sceneName);
        }
        pages.push(makePage(builder, sceneName, item, frames, sceneNotes));
    }

    if (!pages.length) {
        app.ui?.showNotification?.('No cameras found for the storyboard', 'error');
        return;
    }

    const pdf = new Blob([builder.finish(pages)], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pixel-staging-storyboard.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    app.ui?.showNotification?.(`Storyboard exported (${pages.length} pages)`, 'success');
}


function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export async function openStoryboardReport(app) {
    const storyboard = await collectStoryboardData(app);
    if (!storyboard.length) {
        app.ui?.showNotification?.('No shots to report', 'error');
        return;
    }

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        app.ui?.showNotification?.('Allow pop-ups to open the storyboard report', 'error');
        return;
    }

    const sections = storyboard.map(({ sceneName, sceneNotes, sceneViews, item, frames }) => {
        const shot = item.shot;
        const start = frames[0]?.position?.map(v => v.toFixed(2)).join(', ') || '—';
        const end = frames[1]?.position?.map(v => v.toFixed(2)).join(', ') || '—';
        return `
            <section class="shot">
                <header>
                    <div>
                        <span class="eyebrow">${escapeHtml(sceneName)}</span>
                        <h2>${escapeHtml(item.name)}</h2>
                    </div>
                    <div class="badge">${escapeHtml(item.transitionLabel || 'Transition: cut')}</div>
                </header>
                <div class="frames">
                    ${frames.map(frame => `
                        <figure>
                            <img src="${frame.dataUrl}" alt="${escapeHtml(frame.label)}">
                            <figcaption>${escapeHtml(frame.label)}</figcaption>
                        </figure>
                    `).join('')}
                </div>
                ${Array.isArray(sceneViews) && sceneViews.length ? `
                <div class="scene-views">
                    <h3>Scene views</h3>
                    <div class="frames three">
                        ${sceneViews.map(view => `
                            <figure>
                                <img src="${view.dataUrl}" alt="${escapeHtml(view.label)}">
                                <figcaption>${escapeHtml(view.label)}</figcaption>
                            </figure>
                        `).join('')}
                    </div>
                </div>` : ''}
                <div class="meta-grid">
                    <div><span>Camera</span><b>${escapeHtml(item.cameraName)}</b></div>
                    <div><span>Lens</span><b>${escapeHtml(item.cameraLens || '—')}</b></div>
                    <div><span>Sensor</span><b>${escapeHtml(item.cameraSensor || '—')}</b></div>
                    <div><span>Aspect</span><b>${escapeHtml(item.cameraAspect || '—')}</b></div>
                    <div><span>Move</span><b>${escapeHtml(item.move)}</b></div>
                    <div><span>Duration</span><b>${item.duration.toFixed(1)}s</b></div>
                    <div><span>Speed</span><b>×${item.speed}</b></div>
                    <div><span>Easing</span><b>${escapeHtml(item.easing)}</b></div>
                    <div><span>Start XYZ</span><b>${escapeHtml(start)}</b></div>
                    <div><span>End XYZ</span><b>${escapeHtml(end)}</b></div>
                </div>
                <div class="notes">
                    <h3>Scene notes</h3>
                    <p>${escapeHtml(sceneNotes || 'No notes recorded for this scene.')}</p>
                    <h3>Camera / shot notes</h3>
                    <p>${escapeHtml(shot?.notes || 'No notes recorded for this shot.')}</p>
                </div>
            </section>
        `;
    }).join('');

    reportWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Pixel Staging — Storyboard Report</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f0f1b; color: #e0e7ff; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 28px; }
  h1 { margin: 0 0 6px; font-size: 30px; }
  .sub { color: #94a3b8; }
  .print { background: #00ff41; color: #07110a; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
  .shot { break-inside: avoid; background: #1a1a2e; border: 1px solid #2d3748; border-radius: 12px; padding: 18px; margin-bottom: 22px; }
  .shot header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid #2d3748; padding-bottom: 12px; margin-bottom: 14px; }
  .eyebrow { color: #00ff41; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; }
  h2 { margin: 4px 0 0; font-size: 22px; }
  .badge { color: #94a3b8; border: 1px solid #2d3748; border-radius: 999px; padding: 6px 10px; font-size: 11px; }
  .frames { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .frames.three { grid-template-columns: repeat(3, 1fr); }
  .scene-views { margin-bottom: 14px; }
  .scene-views h3 { margin: 0 0 8px; font-size: 12px; color: #00ff41; }
  figure { margin: 0; }
  figure img { width: 100%; display: block; border-radius: 7px; border: 1px solid #2d3748; }
  figcaption { color: #94a3b8; font-size: 11px; margin-top: 5px; }
  .meta-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
  .meta-grid div { background: #16213e; border: 1px solid #2d3748; border-radius: 7px; padding: 8px; }
  .meta-grid span { display: block; color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
  .meta-grid b { font-size: 12px; }
  .notes h3 { margin: 0 0 5px; font-size: 12px; color: #00ff41; }
  .notes p { margin: 0; color: #e0e7ff; line-height: 1.45; white-space: pre-wrap; }
  @media print {
    body { background: white; color: #111; }
    .wrap { max-width: none; padding: 12mm; }
    .print { display: none; }
    .shot { background: white; border-color: #ccc; }
    .shot header { border-color: #ddd; }
    .meta-grid div { background: #f7f7f7; border-color: #ddd; }
    .notes h3, .eyebrow { color: #8a5a00; }
    .sub, .badge, figcaption, .meta-grid span { color: #555; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div>
      <h1>Storyboard & Shot Report</h1>
      <div class="sub">${storyboard.length} shot${storyboard.length === 1 ? '' : 's'} across ${new Set(storyboard.map(s => s.sceneName)).size} scene(s)</div>
    </div>
    <button class="print" onclick="window.print()">Export PDF</button>
  </div>
  ${sections}
</div>
</body>
</html>`);
    reportWindow.document.close();
}
