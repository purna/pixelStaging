/**
 * Shot designer runtime
 *
 * Extracted verbatim from shot_designer.html by scripts/split-shot-designer.
 */
import { D2R, cl, L, EA } from './easing.js';
import { PL, PS, HH, CATS } from './shots.js';
import { TRN, DEFT, PC, CVP, CVN } from './transition-data.js';
import { SceneLibrary } from './scene-library.js';

// --- renderer / scene / camera -------------------------------------
// Scene contents come from scenes/ via SceneLibrary (see bottom of file).
const R = new THREE.WebGLRenderer({
    antialias: true,
    // Needed so toDataURL() (PNG stills) and new VideoFrame(canvas) (MP4)
    // capture real pixels rather than an empty buffer.
    preserveDrawingBuffer: true
});
R.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('vp').appendChild(R.domElement);
const S = new THREE.Scene();
const C = new THREE.PerspectiveCamera(55, 1, .1, 400);
const V3 = THREE.Vector3,
    Y = new V3(0, 1, 0),
    c0 = new V3(-6, 4, -24);
const reg = {};
const $ = i => document.getElementById(i),
    sn = (t, f, s = 0) => Math.sin(t * f + s);

function apply(m, u, t) {
    const e = EA[m.e || 'io'],
        ua = e(m.ph == 2 ? cl(2 * u - 1) : m.ph == 1 ? cl(2 * u) : u),
        ub = e(m.ph == 2 ? cl(2 * u) : m.ph == 1 ? cl(2 * u - 1) : u),
        uu = e(u);
    const a = L(m.a || [0, 0], ua) * D2R,
        r = L(m.r || [40, 40], ua),
        h = L(m.h || [7, 7], ub);
    let x = m.x ? L(m.x, uu) : 0,
        v = m.v ? L(m.v, uu) : 0;
    const sa = (m.s || 0) * Math.exp(-(m.sd || 0) * u),
        sf = m.sf || 9,
        nz = k => sa * (sn(t, sf, k) + .6 * sn(t, sf * 2.3, k * 1.7) + .4 * sn(t, sf * .43, k * 2.9));
    x += m.wv ? sn(t, 2.2) * m.wv : 0;
    const pos = new V3(c0.x + Math.sin(a) * r + x + nz(1) * .25, h + v + (m.bob ? sn(t, m.bf) * m.bob : 0) + nz(2) * .25, c0.z + Math.cos(a) * r);
    const look = new V3(c0.x + (m.tr ? 0 : x), c0.y + (m.tr ? 0 : v), c0.z);
    let yw = m.y ? L(m.y, uu) : 0,
        pt = m.p ? L(m.p, uu) : 0,
        rl = m.o ? L(m.o, uu) : 0;
    if (m.dr) {
        yw += m.dr * (12 * sn(t, .9) + 4 * sn(t, 2.3));
        pt += m.dr * 6 * sn(t, 1.3);
        rl += m.dr * 10 * sn(t, .7)
    }
    if (m.wv) rl += Math.cos(2.2 * t) * m.wv * 1.5;
    yw += nz(3) * 8;
    pt += nz(4) * 8;
    rl += nz(5) * 6;
    const d = look.sub(pos);
    d.applyAxisAngle(Y, yw * D2R);
    d.applyAxisAngle(new V3().crossVectors(d, Y).normalize(), pt * D2R);
    C.position.copy(pos);
    C.up.set(0, 1, 0);
    C.lookAt(pos.clone().add(d));
    C.rotateZ(rl * D2R);
    const f = L(m.f || [55, 55], uu);
    if (C.fov != f) {
        C.fov = f;
        C.updateProjectionMatrix()
    }
}

function free(t) {
    const a = az + (idle > 400 ? Math.sin(t * .15) * .25 : 0);
    C.position.set(tx + Math.sin(a) * Math.sin(pol) * dist, ty + Math.cos(pol) * dist, tz + Math.cos(a) * Math.sin(pol) * dist);
    C.up.set(0, 1, 0);
    C.lookAt(tx, ty, tz);
    if (C.fov != 55) {
        C.fov = 55;
        C.updateProjectionMatrix()
    }
}
let lt = 0;
const vp = $('vp'),
    r3 = x => Math.round(x * 1e4) / 1e4,
    V = a => new V3(...a),
    Q = a => new THREE.Quaternion(...a),
    mat = p => new THREE.Matrix4().compose(V(p.p), Q(p.q), new V3(1, 1, 1));
const newClip = m => ({
    m: m || 'Dolly Shot',
    sp: 1,
    st: null,
    en: null,
    b0: 0,
    b1: 0
});
let seq = [newClip()],
    sel = 0,
    ed = 'st',
    tm = 'translate',
    span = null,
    mode = false,
    ct = 0,
    playing = false,
    anch = [],
    durs = [],
    tot = 1,
    hk = -1,
    tcDrag = false,
    job = null,
    selT = -1,
    sts = [0];
const fit = () => {
    const w = vp.clientWidth & ~1,
        h = vp.clientHeight & ~1;
    R.setSize(w, h);
    C.aspect = w / h;
    C.updateProjectionMatrix();
    const pr = R.getPixelRatio();
    rtA.setSize(w * pr, h * pr);
    rtB.setSize(w * pr, h * pr);
    CA.aspect = CB.aspect = w / h;
    CA.updateProjectionMatrix();
    CB.updateProjectionMatrix()
};
new ResizeObserver(fit).observe(vp);
const bez = (k, x) => {
    let lo = 0,
        hi = 1,
        t = x;
    for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        const X = 3 * (1 - t) * (1 - t) * t * k[0] + 3 * (1 - t) * t * t * k[2] + t * t * t;
        if (X < x) lo = t;
        else hi = t
    }
    return 3 * (1 - t) * (1 - t) * t * k[1] + 3 * (1 - t) * t * t * k[3] + t * t * t
};

function pose(c, u, t, an) {
    let m = reg[c.m];
    if (c.cv) {
        m = {
            ...m,
            e: 'lin'
        };
        u = bez(c.cv, u)
    }
    apply(m, 0, 0);
    C.updateMatrix();
    const i0 = C.matrix.clone().invert();
    apply(m, u, t);
    C.updateMatrix();
    if (an) an.clone().multiply(i0).multiply(C.matrix).decompose(C.position, C.quaternion, C.scale);
    if (c.en) {
        const w = EA.io(u);
        C.position.lerp(V(c.en.p), w);
        C.quaternion.slerp(Q(c.en.q), w);
        C.fov = L([C.fov, c.en.f], w);
        C.updateProjectionMatrix()
    }
    C.scale.set(1, 1, 1)
}
const withCam = fn => {
    const p = C.position.clone(),
        q = C.quaternion.clone(),
        f = C.fov;
    fn();
    C.position.copy(p);
    C.quaternion.copy(q);
    C.fov = f;
    C.updateProjectionMatrix()
};
const build = (ids, chain) => {
    const an = [];
    ids.forEach((i, k) => {
        const c = seq[i];
        an[k] = c.st ? mat(c.st) : chain && k > 0 && !trL(ids[k - 1]) ? (pose(seq[ids[k - 1]], 1, 0, an[k - 1]), C.updateMatrix(), C.matrix.clone()) : null
    });
    return an
};
const dur = c => reg[c.m].d / c.sp,
    trL = i => {
        const c = seq[i],
            n = seq[i + 1];
        return c && n && c.tr && c.tr.type != 'none' ? Math.min(c.tr.len, .9 * Math.min(dur(c), dur(n))) : 0
    };
const starts = (ids, ch) => {
    let a = 0;
    return ids.map(i => {
        const o = a;
        a += dur(seq[i]) - (ch ? trL(i) : 0);
        return o
    })
},
    offs = () => starts(seq.map((_, i) => i), true),
    total = () => {
        const o = offs(),
            l = seq.length - 1;
        return o[l] + dur(seq[l])
    };

function rebuild(all) {
    mode = all;
    span = all ? seq.map((_, i) => i) : [sel];
    durs = span.map(i => dur(seq[i]));
    sts = starts(span, all);
    tot = sts[sts.length - 1] + durs[durs.length - 1];
    withCam(() => anch = build(span, all))
}
const play = all => {
    rebuild(all);
    ct = 0;
    hk = -1;
    playing = true;
    sync()
},
    freeUp = () => {
        span = null;
        playing = false
    };
const seek = g => {
    rebuild(true);
    ct = Math.max(0, Math.min(tot, g));
    playing = false;
    hk = -1;
    sync()
};
// framing
const F = {
    p: new V3(),
    q: new THREE.Quaternion(),
    f: 55
};
let view = 'frame',
    fd = null,
    rep;
const aux = new THREE.Group(),
    pl = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        color: 0xffffff,
        fog: false
    })),
    mk = [0x4caf50, 0xe53935].map(c => new THREE.Mesh(new THREE.SphereGeometry(.7, 8, 6), new THREE.MeshBasicMaterial({
        color: c,
        fog: false
    })));
aux.add(pl, ...mk);
S.add(aux);

function refreshF(place) {
    const c = seq[sel];
    if (!c) return;
    withCam(() => {
        const an = build(seq.map((_, i) => i), true)[sel],
            pts = [];
        for (let i = 0; i <= 40; i++) {
            pose(c, i / 40, 0, an);
            pts.push(C.position.clone())
        }
        pl.geometry.setFromPoints(pts);
        mk[0].position.copy(pts[0]);
        mk[1].position.copy(pts[40]);
        if (place) {
            pose(c, ed == 'st' ? 0 : 1, 0, an);
            F.p.copy(C.position);
            F.q.copy(C.quaternion);
            F.f = C.fov
        }
    })
}

function commit() {
    const c = seq[sel],
        was = c[ed];
    c[ed] = {
        p: F.p.toArray().map(r3),
        q: F.q.toArray().map(r3),
        f: r3(F.f)
    };
    refreshF(false);
    if (!was) sync()
}
const mv = (x, y, z) => {
    const ax = (a, k) => new V3(...a).applyQuaternion(F.q).multiplyScalar(k);
    F.p.add(ax([1, 0, 0], x)).add(ax([0, 1, 0], y)).add(ax([0, 0, -1], z));
    commit()
};
const rot = (y, p) => {
    F.q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, y * D2R));
    F.q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), p * D2R));
    commit()
};
const zm = k => {
    F.f = Math.min(80, Math.max(15, F.f * k));
    commit()
};
const acts = {
    mL: () => mv(-1.5, 0, 0),
    mR: () => mv(1.5, 0, 0),
    mU: () => mv(0, 1.5, 0),
    mD: () => mv(0, -1.5, 0),
    mI: () => mv(0, 0, 3),
    mO: () => mv(0, 0, -3),
    rL: () => rot(3, 0),
    rR: () => rot(-3, 0),
    rU: () => rot(0, 3),
    rD: () => rot(0, -3),
    zI: () => zm(.95),
    zO: () => zm(1.05)
};
$('fg').onpointerdown = e => {
    const k = e.target.dataset.k;
    if (!k) return;
    freeUp();
    acts[k]();
    clearInterval(rep);
    rep = setInterval(acts[k], 70)
};
addEventListener('pointerup', () => {
    clearInterval(rep);
    fd = null
});
R.domElement.addEventListener('pointerdown', e => {
    if (!span && view == 'frame') fd = [e.clientX, e.clientY]
});
addEventListener('pointermove', e => {
    if (!fd) return;
    const dx = e.clientX - fd[0],
        dy = e.clientY - fd[1],
        h = vp.clientHeight;
    fd = [e.clientX, e.clientY];
    if (tm == 'rotate') rot(dx * C.fov / h, dy * C.fov / h);
    else {
        const w = 2 * Math.tan(C.fov * D2R / 2) * 30 / h;
        mv(-dx * w, dy * w, 0)
    }
});
R.domElement.addEventListener('wheel', e => {
    if (!span && view == 'frame') zm(1 + e.deltaY * .001)
}, {
    passive: true
});

function toOrbit() {
    const d = new V3(),
        p = C.position;
    C.getWorldDirection(d);
    dist = 30;
    tx = p.x + d.x * dist;
    ty = p.y + d.y * dist;
    tz = p.z + d.z * dist;
    az = Math.atan2(p.x - tx, p.z - tz);
    pol = Math.min(1.55, Math.max(.2, Math.acos((p.y - ty) / dist)));
    idle = 0
}
$('al').onclick = () => {
    F.p.copy(C.position);
    F.q.copy(C.quaternion);
    F.f = C.fov;
    view = 'frame';
    commit();
    sync()
};

function cam(t) {
    const dt = t - lt;
    lt = t;
    const st = R.domElement.style,
        fr = !span && view == 'frame';
    tcDrag = fr;
    $('frm').style.display = $('fg').style.display = fr ? 'flex' : 'none';
    $('al').hidden = !!span || view != 'explore';
    job = null;
    aux.visible = !span && view == 'explore' && $('shp').checked;
    let g = offs()[sel] + (ed == 'en' ? dur(seq[sel]) : 0);
    if (span) {
        if (playing) {
            ct += dt;
            if (ct >= tot) {
                if ($('lp').checked) ct %= tot;
                else {
                    ct = tot;
                    playing = false;
                    sync()
                }
            }
        }
        let act = [];
        span.forEach((_, k) => {
            if (ct >= sts[k] && ct < sts[k] + durs[k]) act.push(k)
        });
        if (!act.length) act = [span.length - 1];
        const P = k => {
            const u = cl((ct - sts[k]) / durs[k]);
            pose(seq[span[k]], u, t, anch[k])
        },
            kk = act[act.length - 1];
        let cb = kk;
        if (act.length > 1 && trL(span[act[0]])) {
            const kA = act[0],
                pr = cl((ct - sts[kk]) / trL(span[kA]));
            P(kA);
            snap(CA);
            P(kk);
            snap(CB);
            job = {
                tr: seq[span[kA]].tr,
                p: pr
            };
            cb = pr > .5 ? kk : kA
        } else P(kk);
        const c = seq[span[cb]],
            b = L([c.b0, c.b1], EA.io(cl((ct - sts[cb]) / durs[cb])));
        st.filter = b > .1 ? `blur(${b}px)` : '';
        g = mode ? ct : offs()[span[0]] + ct;
        if (kk != hk) {
            hk = kk;
            if (mode && sel != span[kk]) {
                sel = span[kk];
                sync()
            }
        }
    } else if (fr) {
        const w = vp.clientWidth,
            h = vp.clientHeight,
            q = Math.min(.62, .9 * w / (h * 16 / 9)),
            c = seq[sel],
            b = c[ed == 'st' ? 'b0' : 'b1'];
        C.position.copy(F.p);
        C.quaternion.copy(F.q);
        C.fov = 2 * Math.atan(Math.tan(F.f * D2R / 2) / q) / D2R;
        C.updateProjectionMatrix();
        st.filter = b > .1 ? `blur(${b}px)` : '';
        const fh = h * q,
            fw = fh * 16 / 9,
            fs = $('frm').style;
        fs.width = fw + 'px';
        fs.height = fh + 'px';
        fs.left = (w - fw) / 2 + 'px';
        fs.top = (h - fh) / 2 + 'px'
    } else {
        free(t);
        st.filter = ''
    }
    $('ph').style.left = g / total() * 100 + '%';
    $('tcd').textContent = fmt(g)
}
// transitions
const ez = (p, k) => p < .5 ? .5 * Math.pow(2 * p, k) : 1 - .5 * Math.pow(2 - 2 * p, k);
const rtA = new THREE.WebGLRenderTarget(2, 2),
    rtB = new THREE.WebGLRenderTarget(2, 2),
    CA = new THREE.PerspectiveCamera(55, 1, .1, 400),
    CB = CA.clone();
const QM = new THREE.ShaderMaterial({
    uniforms: {
        tA: {
            value: rtA.texture
        },
        tB: {
            value: rtB.texture
        },
        p: {
            value: 0
        },
        type: {
            value: 0
        },
        op: {
            value: 1
        },
        rot: {
            value: 0
        },
        amt: {
            value: .5
        },
        asp: {
            value: 1
        },
        col: {
            value: new THREE.Color()
        }
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D tA,tB;uniform float p,type,op,rot,amt,asp;uniform vec3 col;varying vec2 vUv;
vec4 bl(sampler2D t,vec2 u,float r){vec4 c=vec4(0.);for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++)c+=texture2D(t,u+vec2(float(i),float(j))*r);return c/25.;}
vec2 rt(vec2 u,float a){vec2 q=(u-.5)*vec2(asp,1.);q=vec2(cos(a)*q.x-sin(a)*q.y,sin(a)*q.x+cos(a)*q.y);return q/vec2(asp,1.)+.5;}
bool ins(vec2 u){return u.x>=0.&&u.x<=1.&&u.y>=0.&&u.y<=1.;}
void main(){vec2 u=vUv,c=u-.5,q=c*vec2(asp,1.),d=vec2(cos(rot),sin(rot));vec4 A=texture2D(tA,u),B=texture2D(tB,u),o=A;float pi=3.14159,H=.5*(abs(d.x)*asp+abs(d.y)),s=dot(q,d)/H;
 if(type<.5)o=mix(A,B,p);
 else if(type<1.5){float k=(p<.5?p:1.-p)*2.;o=mix(p<.5?A:B,vec4(col,1.),k*op);}
 else if(type<2.5){o=mix(A,B,p);o.rgb+=col*sin(pi*p)*op*1.5;}
 else if(type<3.5){float sf=.02+amt*.3,e=p*(1.+2.*sf)-sf,m=1.-smoothstep(e-sf,e+sf,s*.5+.5);o=mix(A,B,m);}
 else if(type<4.5){vec2 v=u+d*(1.-p);if(ins(v))o=texture2D(tB,v);}
 else if(type<5.5){vec2 a=u-d*p,b=u-d*p+d;if(ins(a))o=texture2D(tA,a);else if(ins(b))o=texture2D(tB,b);else o=vec4(col,1.);}
 else if(type<6.5){float sf=.02+amt*.25,r=length(q),e=p*(.5*length(vec2(asp,1.))+2.*sf)-sf;o=mix(A,B,1.-smoothstep(e-sf,e+sf,r));}
 else if(type<7.5){o=mix(A,B,1.-smoothstep(p-.01,p+.01,abs(s)));}
 else if(type<8.5){float z=amt*3.;o=mix(texture2D(tA,c/(1.+p*z)+.5),texture2D(tB,c/(1.+(1.-p)*z)+.5),p);}
 else if(type<9.5){o=mix(texture2D(tA,rt(u,-p*rot)),texture2D(tB,rt(u,(1.-p)*rot)),p);}
 else if(type<10.5){float r=amt*.03*sin(pi*p);o=mix(bl(tA,u,r),bl(tB,u,r),p);}
 else{float n=600.*pow(.03,sin(pi*p)*(.4+.6*amt));vec2 g=vec2(n*asp,n),v=(floor(u*g)+.5)/g;o=mix(texture2D(tA,v),texture2D(tB,v),p);}
 gl_FragColor=vec4(o.rgb,1.);}`,
    depthTest: false
});
const QS = new THREE.Scene(),
    QC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
QS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), QM));
const snap = o => {
    o.position.copy(C.position);
    o.quaternion.copy(C.quaternion);
    o.fov = C.fov;
    o.updateProjectionMatrix()
};

function frame() {
    if (!job) {
        R.render(S, C);
        return
    }
    const tr = job.tr,
        U = QM.uniforms;
    U.p.value = ez(job.p, tr.spd);
    U.type.value = TRN.findIndex(x => x[0] == tr.type) - 1;
    U.op.value = tr.op;
    U.rot.value = tr.rot * D2R;
    U.amt.value = tr.amt;
    U.asp.value = vp.clientWidth / vp.clientHeight;
    U.col.value.set(tr.col);
    R.setRenderTarget(rtA);
    R.render(S, CA);
    R.setRenderTarget(rtB);
    R.render(S, CB);
    R.setRenderTarget(null);
    R.render(QS, QC)
}
const pr_ = (t, k) => {
    const d = PC[k];
    return d[1] == 'color' ? `<label class="f">${d[0]}<input type="color" data-p="${k}" value="${t[k]}"></label>` : `<label class="f">${d[0]}<input type="range" data-p="${k}" min="${d[1]}" max="${d[2]}" step="${d[3]}" value="${t[k]}"><b>${t[k]}</b></label>`
};

function trn(i) {
    const t = seq[i].tr || {
        type: 'none'
    },
        df = TRN.find(x => x[0] == t.type),
        open = selT == i && t.type != 'none';
    return `<div class="trn${selT == i ? ' sel' : ''}" data-t="${i}"><div class="th"><span>⇄</span><select data-ty="1">${TRN.map(x => `<option value="${x[0]}"${x[0] == t.type ? ' selected' : ''}>${x[1]}</option>`).join('')}</select>${t.type != 'none' ? `<button data-a="tt">${open ? '▴' : '▾'}</button>` : ''}</div>
 ${open ? `<label class="f">Length<input type="range" data-p="len" min=".25" max="4" step=".25" value="${t.len}"><b class="lb">${t.len}s</b></label>` + df[2].map(k => pr_(t, k)).join('') : ''}</div>`
}
// shot cards
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`,
    opts = m => CATS.map(([c, l]) => `<optgroup label="${c}">${l.map(([n]) => `<option${n == m ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>`).join('');
let cvOpen = false,
    hd = -1;
const cvSVG = k => {
    const P = (x, y) => `${20 + 160 * x},${150 - 100 * y}`,
        [a, b, c, d] = k;
    return `<rect x="20" y="50" width="160" height="100" fill="none" stroke="#403425"/><path d="M${P(0, 0)} L${P(1, 1)}" stroke="#403425" stroke-dasharray="3"/><path d="M${P(0, 0)} L${P(a, b)} M${P(1, 1)} L${P(c, d)}" stroke="#a8946f"/><path d="M${P(0, 0)} C${P(a, b)} ${P(c, d)} ${P(1, 1)}" fill="none" stroke="#e3a72f" stroke-width="2.5"/><circle data-h="0" cx="${20 + 160 * a}" cy="${150 - 100 * b}" r="7" fill="#e3a72f"/><circle data-h="1" cx="${20 + 160 * c}" cy="${150 - 100 * d}" r="7" fill="#e3a72f"/>`
};
const curve = c => `<fieldset><legend>Advanced</legend><button data-a="cvt">Animation curve ${cvOpen ? '▴' : '▾'}</button>` + (cvOpen ? `<svg id="cv" viewBox="0 0 200 200" style="width:100%;background:#17130e;border-radius:6px;touch-action:none">${cvSVG(c.cv || CVP[4])}<text x="180" y="168" fill="#a8946f" font-size="9" text-anchor="end">time →</text><text x="4" y="46" fill="#a8946f" font-size="9">progress ↑</text></svg><div class="ed">${CVN.map((n, i) => `<button data-a="cvp:${i}">${n}</button>`).join('')}<button data-a="cvr">Reset</button></div><small>${c.cv ? 'Custom curve' : 'Using the move default easing'}. Drag the handles; going above 1 or below 0 overshoots.</small>` : '') + `</fieldset>`;

function card(c, i) {
    const s = i == sel,
        d = dur(c).toFixed(1),
        ln = Math.min(30, Math.max(.5, Math.round(dur(c) * 2) / 2)),
        f = Math.round(F.f),
        on = (k, v) => k == v ? ' class="on"' : '';
    let h = `<div class="card${s ? ' sel' : ''}" data-i="${i}"><div class="ch" data-a="pick"><span class="ix">${i + 1}</span><div class="ti"><b>${c.m}</b><small>${d}s · ×${c.sp} · ${c.st ? 'custom' : 'auto'} start · ${c.en ? 'custom' : 'auto'} end</small></div>
 <div class="ic"><button data-a="up" title="Move earlier">▲</button><button data-a="dn" title="Move later">▼</button><button data-a="dup" title="Duplicate shot">⧉</button><button data-a="del" title="Delete shot">✕</button></div></div>`;
    if (s) h += `<div class="bd"><label class="f">Camera move<select data-f="m">${opts(c.m)}</select></label>
 <div class="f">Length<input type="range" data-f="len" min=".5" max="30" step=".5" value="${ln}"><b class="lb">${ln}s</b></div>
 <div class="f">Speed<span class="ed"><button data-a="sm">−</button><b>×${c.sp}</b><button data-a="sp">+</button></span></div>
 <fieldset><legend>Framing</legend><div class="seg"><button data-a="ed:st"${on(ed, 'st')}>Start frame</button><button data-a="ed:en"${on(ed, 'en')}>End frame</button></div>
 <div class="seg"><button data-a="vw:frame"${on(view, 'frame')}>Frame view</button><button data-a="vw:explore"${on(view, 'explore')}>Explore scene</button></div>
 <div class="seg"><button data-a="md:translate"${on(tm, 'translate')}>Drag moves</button><button data-a="md:rotate"${on(tm, 'rotate')}>Drag rotates</button></div>
 <label class="f">Zoom<input type="range" data-f="fov" min="15" max="80" value="${f}"><b>${f}</b></label>
 <div class="ed"><span class="tag">${c[ed] ? 'Custom framing' : 'Auto framing'}</span><button data-a="rs">Reset</button></div></fieldset>
 <fieldset><legend>Focus</legend><label class="f">Blur at start<input type="range" data-f="b0" min="0" max="12" step=".5" value="${c.b0}"><b>${c.b0}</b></label>
 <label class="f">Blur at end<input type="range" data-f="b1" min="0" max="12" step=".5" value="${c.b1}"><b>${c.b1}</b></label></fieldset>${curve(c)}</div>`;
    return h + '</div>'
}

function sync() {
    refreshF(!fd);
    $('shots').innerHTML = seq.map((c, i) => card(c, i) + (i < seq.length - 1 ? trn(i) : '')).join('');
    $('pp').textContent = playing ? '⏸' : '▶';
    $('pl').textContent = `Shot ${sel + 1} · ${ed == 'st' ? 'start' : 'end'} frame`;
    tl()
}

function tl() {
    const T = total(),
        o = offs(),
        step = T > 60 ? 10 : T > 24 ? 5 : T > 10 ? 2 : 1;
    let r = '',
        h = '';
    for (let x = 0; x <= T; x += step) r += `<i style="left:${x / T * 100}%">${x}s</i>`;
    seq.forEach((c, i) => {
        h += `<div class="blk${i == sel ? ' sel' : ''}" style="left:${o[i] / T * 100}%;width:${dur(c) / T * 100}%;top:${i % 2 * 54}%"><span class="lb2">${i + 1} · ${c.m}</span>` + ['st', 'en'].map(e => `<i class="kf${c[e] ? ' cu' : ''}${i == sel && ed == e ? ' on' : ''}" data-i="${i}" data-e="${e}" style="left:${e == 'st' ? 0 : 100}%" title="${e == 'st' ? 'Start' : 'End'} frame"></i>`).join('') + '</div>'
    });
    seq.forEach((c, i) => {
        const l = trL(i);
        if (l) h += `<div class="trb${selT == i ? ' sel' : ''}" data-t="${i}" style="left:${o[i + 1] / T * 100}%;width:${l / T * 100}%" title="Transition"></div>`
    });
    $('rl').innerHTML = r;
    $('tt').textContent = fmt(T);
    $('bl').innerHTML = h
}
const after = () => {
    if (span) {
        const r = ct / tot;
        rebuild(mode);
        ct = r * tot
    }
    sync()
},
    sps = (c, len) => c.sp = Math.min(60, Math.max(.01, r3(reg[c.m].d / Math.max(.5, len))));
$('shots').onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const tn = b.closest('.trn');
    if (tn) {
        selT = selT == +tn.dataset.t ? -1 : +tn.dataset.t;
        return sync()
    }
    const i = +b.closest('.card').dataset.i,
        [a, v] = b.dataset.a.split(':'),
        c = seq[sel],
        sw = (x, y) => {
            [seq[x], seq[y]] = [seq[y], seq[x]];
            sel = y
        };
    if (a == 'pick') {
        sel = i;
        view = 'frame';
        freeUp()
    } else if (a == 'up' && i > 0) sw(i, i - 1);
    else if (a == 'dn' && i < seq.length - 1) sw(i, i + 1);
    else if (a == 'dup') {
        seq.splice(i + 1, 0, JSON.parse(JSON.stringify(seq[i])));
        sel = i + 1;
        freeUp()
    } else if (a == 'del' && seq.length > 1) {
        seq.splice(i, 1);
        sel = Math.min(sel, seq.length - 1);
        freeUp()
    } else if (a == 'l-') sps(c, dur(c) - .5);
    else if (a == 'l+') sps(c, dur(c) + .5);
    else if (a == 'sm') c.sp = Math.max(.05, r3(c.sp - .25));
    else if (a == 'sp') c.sp = Math.min(8, r3(c.sp + .25));
    else if (a == 'ed') {
        ed = v;
        freeUp()
    } else if (a == 'md') tm = v;
    else if (a == 'rs') {
        c[ed] = null;
        freeUp()
    } else if (a == 'vw') {
        if (v == 'explore' && !span) toOrbit();
        view = v;
        freeUp()
    } else if (a == 'cvt') cvOpen = !cvOpen;
    else if (a == 'cvp') c.cv = [...CVP[+v]];
    else if (a == 'cvr') c.cv = null;
    after()
};
$('shots').oninput = e => {
    const pk = e.target.dataset.p;
    if (pk) {
        const t = seq[+e.target.closest('.trn').dataset.t].tr,
            v = e.target.value;
        t[pk] = pk == 'col' ? v : +v;
        if (pk != 'col') e.target.nextElementSibling.textContent = v + (pk == 'len' ? 's' : '');
        tl();
        return
    }
    const f = e.target.dataset.f,
        c = seq[sel],
        v = e.target.value;
    if (f == 'b0' || f == 'b1') {
        c[f] = +v;
        e.target.nextElementSibling.textContent = v
    } else if (f == 'len') {
        sps(c, +v);
        e.target.nextElementSibling.textContent = v + 's';
        tl()
    } else if (f == 'fov') {
        freeUp();
        F.f = +v;
        e.target.nextElementSibling.textContent = v;
        commit()
    }
};
$('shots').onchange = e => {
    if (e.target.dataset.p) {
        after();
        return
    }
    if (e.target.dataset.ty) {
        const i = +e.target.closest('.trn').dataset.t,
            v = e.target.value;
        seq[i].tr = v == 'none' ? null : {
            ...DEFT,
            ...(seq[i].tr || {}),
            type: v
        };
        selT = v == 'none' ? -1 : i;
        after();
        return
    }
    const f = e.target.dataset.f;
    if (f == 'm') {
        seq[sel].m = e.target.value;
        after();
        if (!span) play(false)
    } else if (f == 'len') {
        sps(seq[sel], +e.target.value);
        after()
    }
};
$('add').onclick = () => {
    seq.splice(sel + 1, 0, newClip());
    sel++;
    view = 'frame';
    freeUp();
    sync()
};
$('stp').onclick = () => {
    freeUp();
    sync()
};
$('pc').onclick = () => play(false);
$('pa').onclick = () => play(true);
$('pp').onclick = () => {
    if (!span) return play(true);
    playing = !playing;
    if (playing && ct >= tot) ct = 0;
    sync()
};
let dn = false;
const tk = $('tk'),
    sk = e => {
        const r = tk.getBoundingClientRect();
        seek((e.clientX - r.left) / r.width * total())
    };
tk.onpointerdown = e => {
    const k = e.target.closest('.kf'),
        tb = e.target.closest('.trb');
    if (k) {
        sel = +k.dataset.i;
        ed = k.dataset.e;
        view = 'frame';
        freeUp();
        return sync()
    }
    if (tb) {
        selT = sel = +tb.dataset.t;
        freeUp();
        return sync()
    }
    dn = true;
    tk.setPointerCapture(e.pointerId);
    sk(e)
};
tk.onpointermove = e => {
    if (dn) sk(e)
};
tk.onpointerup = () => dn = false;
R.domElement.addEventListener('pointerdown', () => {
    if (span) {
        toOrbit();
        freeUp();
        view = 'explore';
        sync()
    }
});
CATS.forEach(([c, list]) => list.forEach(([n, sp]) => {
    if (sp) reg[n] = {
        d: 6,
        ...sp
    }
}));
fit();
// ---- import / export ----
const out = c => ({
    move: c.m,
    spec: reg[c.m],
    speed: c.sp,
    start: c.st,
    end: c.en,
    blurStart: c.b0,
    blurEnd: c.b1,
    transition: c.tr || null,
    curve: c.cv || null
});
const box = t => {
    $('jt').value = t;
    $('jm').hidden = false
};
async function save(name, obj) {
    const data = JSON.stringify(obj, null, 1);
    try {
        const dl = await window.claude?.use('downloads');
        if (dl) {
            await dl.save({
                filename: name,
                data
            });
            return
        }
    } catch (e) {
        if (e && e.code == 'declined') return
    }
    box(data)
}
$('ex').onclick = () => save('nile-camera-chain.json', {
    format: 'nile-camera-chain',
    version: 1,
    clips: seq.map(out)
});
$('es').onclick = async () => {
    for (const [i, c] of seq.entries()) await save(`nile-clip-${i + 1}-${c.m.replace(/\W+/g, '-')}.json`, {
        format: 'nile-camera-clip',
        version: 1,
        ...out(c)
    })
};

function loadWorld(root) {
    [...S.children].forEach(o => {
        if (o !== aux) S.remove(o)
    });
    [...root.children].forEach(o => S.add(o));
    if (root.isScene) {
        S.background = root.background;
        S.fog = root.fog
    }
    S.traverse(o => {
        if (o.material && o.material.transparent && o.material.opacity === 0) o.material.opacity = 1
    });
    let hl = false;
    S.traverse(o => {
        if (o.isLight) hl = true
    });
    if (!hl) {
        S.add(new THREE.HemisphereLight(0xffffff, 0x666666, .9));
        const d = new THREE.DirectionalLight(0xffffff, .8);
        d.position.set(20, 40, 20);
        S.add(d)
    }
    const bx = new THREE.Box3();
    S.children.forEach(o => {
        if (o !== aux && !o.isLight) bx.expandByObject(o)
    });
    if (!bx.isEmpty()) {
        bx.getCenter(c0);
        dist = Math.min(80, Math.max(16, bx.getSize(new V3()).length() * 1.2));
        tx = c0.x;
        ty = c0.y;
        tz = c0.z
    }
}

function loadGeneric(j) {
    const arr = j.objects || j.children || j.items;
    if (!Array.isArray(arr)) return 0;
    const g = new THREE.Group(),
        v = a => Array.isArray(a) ? a : a && typeof a == 'object' ? [a.x || 0, a.y || 0, a.z || 0] : null,
        T = THREE,
        GM = {
            box: () => new T.BoxGeometry(2, 2, 2),
            sphere: () => new T.SphereGeometry(1, 24, 16),
            cone: () => new T.ConeGeometry(1, 2, 24),
            cylinder: () => new T.CylinderGeometry(1, 1, 2, 24),
            plane: () => new T.PlaneGeometry(2, 2),
            torus: () => new T.TorusGeometry(1, .4, 12, 32),
            tetrahedron: () => new T.TetrahedronGeometry(1),
            octahedron: () => new T.OctahedronGeometry(1),
            dodecahedron: () => new T.DodecahedronGeometry(1),
            icosahedron: () => new T.IcosahedronGeometry(1),
            torusknot: () => new T.TorusKnotGeometry(1, .3)
        };
    arr.forEach(o => {
        try {
            const f = GM[String(o.type || o.shape || (o.geometry && o.geometry.type) || '').toLowerCase().replace(/geometry|[_ -]/g, '')];
            if (!f) return;
            const m = new T.Mesh(f(), new T.MeshStandardMaterial({
                color: o.color ?? (o.material && o.material.color) ?? 0x888888,
                flatShading: true
            })),
                p = v(o.position),
                r = v(o.rotation),
                sc = v(o.scale);
            if (p) m.position.set(...p);
            if (r) m.rotation.set(...r);
            if (sc) m.scale.set(...sc);
            g.add(m)
        } catch (e) { }
    });
    return g.children.length ? (loadWorld(g), 1) : 0
}

function ingest(texts) {
    let n = 0,
        l = [];
    texts.forEach(x => {
        try {
            const j = JSON.parse(x),
                sc = j.scene || (j.object && j.metadata ? j : null);
            if (sc) {
                loadWorld(new THREE.ObjectLoader().parse(sc));
                n++
            } else if (loadGeneric(j)) n++;
            ((j.timeline && j.timeline.clips) || j.clips || (j.move ? [j] : [])).forEach(o => {
                if (o.spec && !reg[o.move]) reg[o.move] = {
                    d: 6,
                    ...o.spec
                };
                if (reg[o.move]) l.push({
                    m: o.move,
                    sp: o.speed || 1,
                    st: o.start || null,
                    en: o.end || null,
                    b0: o.blurStart || 0,
                    b1: o.blurEnd || 0,
                    tr: o.transition ? {
                        ...DEFT,
                        ...o.transition
                    } : null,
                    cv: o.curve || null
                })
            })
        } catch (e) { }
    });
    if (l.length) {
        seq = l;
        sel = 0;
        span = null;
        playing = false
    }
    if (l.length || n) {
        sync();
        $('jm').hidden = $('xm').hidden = true
    } else alert('No scene or camera clips found in that file.')
}
async function loadJS(t) {
    const m = t.match(/\/\*DATA\*\/([\s\S]*?)\/\*END\*\//);
    if (m) return ingest([m[1]]);
    try {
        const g = new THREE.Group();
        new Function('THREE', t)(THREE);
        const f = window.initAllScenes || window.initScene1;
        if (!f) throw 0;
        f(g);
        loadWorld(g);
        sync();
        $('xm').hidden = true
    } catch (e) {
        alert('Could not read that JS file. It should be a Nile export or a Pixel3D .js export.')
    }
}
$('ld').onclick = () => $('fi').click();
$('fi').onchange = async e => {
    const f = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name));
    ingest(await Promise.all(f.map(x => x.text())));
    e.target.value = ''
};
$('pj').onclick = () => box('');
$('jl').onclick = () => ingest([$('jt').value]);
$('jx').onclick = () => $('jm').hidden = true;
const dl = async (name, data) => {
    try {
        const d = await window.claude?.use('downloads');
        if (d) {
            await d.save({
                filename: name,
                data
            });
            return
        }
    } catch (e) {
        if (e && e.code == 'declined') return
    }
    alert('Saving files is not available in this view.')
};
const sceneJSON = () => {
    S.remove(aux);
    const j = S.toJSON();
    S.add(aux);
    return j
},
    tlJ = () => ({
        clips: seq.map(out)
    }),
    wrapJS = d => `/* Nile camera studio export */\n(function(){var DATA=/*DATA*/${JSON.stringify(d)}/*END*/;window.NILE_EXPORT=DATA;\nwindow.initScene1=function(group){var s=new THREE.ObjectLoader().parse(DATA.scene);s.children.slice().forEach(function(c){group.add(c)});return s};\nwindow.initAllScenes=function(group){window.initScene1(group)};})();\n`;
const crcT = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0
    }
    return t
})(),
    crc = b => {
        let c = -1;
        for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8);
        return (~c) >>> 0
    };

function zip(files) {
    const en = new TextEncoder(),
        parts = [],
        cd = [];
    let off = 0;
    files.forEach(([n, d]) => {
        const nb = en.encode(n),
            c = crc(d),
            h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint32(14, c, true);
        h.setUint32(18, d.length, true);
        h.setUint32(22, d.length, true);
        h.setUint16(26, nb.length, true);
        parts.push(h.buffer, nb, d);
        const g = new DataView(new ArrayBuffer(46));
        g.setUint32(0, 0x02014b50, true);
        g.setUint16(4, 20, true);
        g.setUint16(6, 20, true);
        g.setUint32(16, c, true);
        g.setUint32(20, d.length, true);
        g.setUint32(24, d.length, true);
        g.setUint16(28, nb.length, true);
        g.setUint32(42, off, true);
        cd.push(g.buffer, nb);
        off += 30 + nb.length + d.length
    });
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cd.reduce((a, b) => a + b.byteLength, 0), true);
    e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, e.buffer], {
        type: 'application/zip'
    })
}
let xcancel = false;
const xp = t => $('xp').textContent = t,
    tick = () => new Promise(r => setTimeout(r, 0));
async function sweep(step, cb) {
    rebuild(true);
    const n = Math.floor(tot / step + 1e-6) + 1;
    for (let i = 0; i < n && !xcancel; i++) {
        ct = Math.min(tot, i * step);
        playing = false;
        cam(ct);
        frame();
        await cb(i, n)
    }
}
async function withEx(fn) {
    xcancel = false;
    const pr0 = R.getPixelRatio();
    R.setPixelRatio(1);
    fit();
    try {
        await fn()
    } catch (e) {
        xp('Export failed: ' + (e.message || e))
    } finally {
        R.setPixelRatio(pr0);
        fit();
        freeUp();
        sync()
    }
}
const X = {
    sj: () => dl('nile-scene.json', JSON.stringify({
        format: 'nile-scene',
        version: 1,
        scene: sceneJSON()
    })),
    sJ: () => dl('nile-scene.js', wrapJS({
        format: 'nile-scene',
        version: 1,
        scene: sceneJSON()
    })),
    tj: () => dl('nile-scene-timeline.json', JSON.stringify({
        format: 'nile-scene-timeline',
        version: 1,
        scene: sceneJSON(),
        timeline: tlJ()
    })),
    tJ: () => dl('nile-scene-timeline.js', wrapJS({
        format: 'nile-scene-timeline',
        version: 1,
        scene: sceneJSON(),
        timeline: tlJ()
    })),
    png: () => withEx(async () => {
        const files = [];
        await sweep($('sf').value == '1' ? 1 : 1 / 12, async (i, n) => {
            const b = atob(R.domElement.toDataURL('image/png').split(',')[1]);
            files.push([`frame_${String(i + 1).padStart(4, '0')}.png`, Uint8Array.from(b, c => c.charCodeAt(0))]);
            if (i % 4 == 0) {
                xp(`Rendering ${i + 1}/${n}`);
                await tick()
            }
        });
        if (!xcancel) {
            await dl('nile-stills.zip', zip(files));
            xp('Done')
        }
    }),
    mp4: () => withEx(async () => {
        if (!window.VideoEncoder || !window.Mp4Muxer) throw new Error('MP4 export needs a browser with WebCodecs (recent Chrome, Edge or Safari)');
        const fps = +$('vf').value,
            w = R.domElement.width,
            h = R.domElement.height,
            mx = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: w,
                    height: h
                },
                fastStart: 'in-memory'
            }),
            enc = new VideoEncoder({
                output: (c, m) => mx.addVideoChunk(c, m),
                error: e => xp('Encoder error: ' + e.message)
            });
        enc.configure({
            codec: 'avc1.640028',
            width: w,
            height: h,
            bitrate: 8e6,
            framerate: fps
        });
        await sweep(1 / fps, async (i, n) => {
            const f = new VideoFrame(R.domElement, {
                timestamp: Math.round(i * 1e6 / fps)
            });
            enc.encode(f, {
                keyFrame: i % fps == 0
            });
            f.close();
            if (i % 4 == 0) {
                xp(`Encoding ${i + 1}/${n}`);
                await tick()
            }
            while (enc.encodeQueueSize > 8) await tick()
        });
        if (!xcancel) {
            await enc.flush();
            mx.finalize();
            await dl('nile-shot.mp4', new Blob([mx.target.buffer], {
                type: 'video/mp4'
            }));
            xp('Done')
        }
    })
};
$('xm').onclick = e => {
    const k = e.target.closest('[data-x]');
    if (k) X[k.dataset.x]()
};
$('xo').onclick = () => {
    $('xm').hidden = false;
    xp('')
};
$('xc').onclick = () => {
    xcancel = true;
    $('xm').hidden = true
};
$('ld2').onclick = () => $('fj').click();
$('fj').onchange = async e => {
    for (const f of e.target.files) await loadJS(await f.text());
    e.target.value = ''
};
document.addEventListener('pointerdown', e => {
    const h = e.target.dataset && e.target.dataset.h;
    if (h !== undefined && e.target.closest('#cv')) {
        const c = seq[sel];
        c.cv = c.cv || [...CVP[4]];
        hd = +h
    }
});
addEventListener('pointermove', e => {
    if (hd < 0) return;
    const c = seq[sel],
        sv = $('cv'),
        r = sv.getBoundingClientRect(),
        x = (e.clientX - r.left) / r.width * 200,
        y = (e.clientY - r.top) / r.height * 200;
    c.cv[hd * 2] = cl((x - 20) / 160);
    c.cv[hd * 2 + 1] = Math.min(1.5, Math.max(-.5, (150 - y) / 100));
    sv.querySelectorAll('rect,path,circle').forEach(n => n.remove());
    sv.insertAdjacentHTML('afterbegin', cvSVG(c.cv))
});
addEventListener('pointerup', () => {
    if (hd >= 0) {
        hd = -1;
        after()
    }
});
sync();
// camera orbit
let az = 0,
    pol = 1.42,
    dist = 44,
    tx = -4,
    ty = 4,
    tz = -14,
    idle = 0;
const ptrs = new Map();
let pd = 0;
R.domElement.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, e);
    R.domElement.setPointerCapture(e.pointerId);
    idle = 0
});
R.domElement.addEventListener('pointerup', e => ptrs.delete(e.pointerId));
R.domElement.addEventListener('pointermove', e => {
    if (tcDrag || !ptrs.has(e.pointerId)) return;
    const o = ptrs.get(e.pointerId);
    if (ptrs.size == 1) {
        az -= (e.clientX - o.clientX) * .005;
        pol = Math.min(1.52, Math.max(.9, pol - (e.clientY - o.clientY) * .004))
    }
    ptrs.set(e.pointerId, e);
    if (ptrs.size == 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pd) dist = Math.min(80, Math.max(16, dist * pd / d));
        pd = d
    }
});
R.domElement.addEventListener('pointerup', () => pd = 0);
R.domElement.addEventListener('wheel', e => {
    if (tcDrag) return;
    dist = Math.min(80, Math.max(16, dist + e.deltaY * .03))
}, {
    passive: true
});
// --- scene wiring -------------------------------------------------
// Procedural scenes live in scenes/ and are swapped in by SceneLibrary,
// which also owns the per-frame scene update (swell, drift, ...).
const library = new SceneLibrary({
    scene: S,
    camera: C,
    renderer: R,
    keep: [aux],
    select: document.getElementById('scn'),
    loadButton: document.getElementById('scnload')
});
// The library may widen C.far for scenes with a sky dome or distant
// backdrops. The transition cameras must match or those shots get clipped.
const syncCamFar = () => {
    CA.far = C.far;
    CB.far = C.far;
    CA.updateProjectionMatrix();
    CB.updateProjectionMatrix();
};
addEventListener('sd:scene', syncCamFar);

library.init().then(() => {
    syncCamFar();
    const note = document.getElementById('scne');
    const n = library.entries.length;
    if (note) {
        note.textContent = library.current
            ? `Loaded: ${library.current.id}`
            : (n ? 'Choose a scene, then press Load' : 'No scenes listed in the manifest');
    }
    sync();
}).catch(e => {
    const note = document.getElementById('scne');
    if (note) { note.textContent = e.message || String(e); note.style.color = '#e57373'; }
    console.error('[scene-library]', e);
});

const clk = new THREE.Clock();
(function loop() {
    requestAnimationFrame(loop);
    const t = clk.getElapsedTime();
    idle += 1;
    library.update(t);
    cam(t);
    frame()
})(); 