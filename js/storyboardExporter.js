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

function makePage(builder, sceneName, shot, frames) {
    const imageObjects = frames.map(frame => builder.addImage(frame.dataUrl, frame.width, frame.height));
    const imageIds = imageObjects;

    const lines = [];
    lines.push(`BT /F1 18 Tf 44 742 Td (${pdfText(sceneName)} - ${pdfText(shot.name)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 44 714 Td (Camera: ${pdfText(shot.cameraName)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 44 698 Td (Move: ${pdfText(shot.move)}    Duration: ${shot.duration.toFixed(1)}s    Speed: x${shot.speed}    Easing: ${pdfText(shot.easing)}) Tj ET`);

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

function renderFrame(app, rig, shot, shotManager, localT, explicitFrame = null) {
    const renderer = app.renderer;
    const canvas = renderer.domElement;
    const width = canvas.width;
    const height = canvas.height;

    // Save the current viewport so storyboard rendering never disturbs the editor.
    const oldViewport = renderer.getViewport(new THREE.Vector4());
    const oldScissorTest = renderer.getScissorTest();

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);

    const camera = rig.camera.clone();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

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
    camera.updateMatrixWorld(true);

    renderer.render(app.scene, camera);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);

    renderer.setViewport(oldViewport);
    renderer.setScissorTest(oldScissorTest);

    return { dataUrl, width, height };
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
                move: shot.move || 'Static',
                duration: Number.isFinite(shot.duration) ? shot.duration : 3,
                speed: Number.isFinite(shot.speed) ? shot.speed : 1,
                easing: shot.easing || 'io',
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
        move: 'Static',
        duration: 0,
        speed: 1,
        easing: 'io',
        startFrame: false,
        endFrame: false,
        notes: 'No shot timeline has been added to this scene yet.'
    }];
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

    try {
        scenes.saveCurrentSceneState();

        for (const sceneName of sceneNames) {
            if (scenes.currentSceneName !== sceneName) {
                scenes.switchToScene(sceneName);
            }

            const items = collectShotsForScene(app);
            for (const item of items) {
                const frames = [];
                if (item.shot) {
                    const shot = item.shot;
                    const keyframes = [
                        { type: 'start', label: `Start keyframe (${shot.startFrame ? 'custom' : 'auto'})`, frame: shot.startFrame, t: 0 },
                        { type: 'end', label: `End keyframe (${shot.endFrame ? 'custom' : 'auto'})`, frame: shot.endFrame, t: item.duration }
                    ];
                    for (const keyframe of keyframes) {
                        const rendered = renderFrame(
                            app, item.rig, shot, app.staging.shotManager,
                            keyframe.t, keyframe.frame
                        );
                        rendered.label = keyframe.label;
                        frames.push(rendered);
                    }
                } else {
                    const rendered = renderFrame(app, item.rig, null, null, 0);
                    rendered.label = 'Scene camera overview';
                    frames.push(rendered);
                }
                pages.push(makePage(builder, sceneName, item, frames));
            }
        }
    } finally {
        // Return to the scene the user was editing.
        if (scenes.currentSceneName !== originalScene) {
            try { scenes.switchToScene(originalScene); } catch (error) { console.warn(error); }
        }
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
