import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as P from './physics.js';
import { PRESETS } from './presets.js';
import { buildPanel, renderReadout, initHelp } from './ui.js';
import { solveLighting } from './solve.js';
import { initAnalyzer } from './analyzer-ui.js';
import './style.css';

const HELPER = 1;
const EYE_WB = 5600;

// ---------- 状态 ----------
const state = {
  presetId: null,
  lights: structuredClone(PRESETS[0].lights),
  bg: { color: '#6e6e6e', dist: 2.2 },
  cam: { N: 4, t: 1 / 125, iso: 400, wb: 5600, bw: false },
};

// ---------- 渲染器 ----------
const sceneCanvas = document.getElementById('sceneCanvas');
const photoCanvas = document.getElementById('photoCanvas');
const makeRenderer = (canvas) => {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.toneMapping = THREE.NeutralToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  return r;
};
const rScene = makeRenderer(sceneCanvas);
const rPhoto = makeRenderer(photoCanvas);

const scene = new THREE.Scene();

// ---------- 摄影棚 ----------
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.95 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const backdropMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 1 });
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), backdropMat);
backdrop.receiveShadow = true;
scene.add(backdrop);

const workLight = new THREE.HemisphereLight(0xdfe6ee, 0x30302c, 1);
workLight.layers.set(HELPER);
scene.add(workLight);

// ---------- 人物 ----------
const subject = new THREE.Group();
scene.add(subject);

// 模型是到肩膀的半身像，底部是切口：用一件深色抹胸上衣盖住
function makeTop(topY) {
  const pts = [
    [0, topY - 0.02], [0.2, topY - 0.004], [0.235, topY], [0.24, topY - 0.05],
    [0.235, topY - 0.16], [0.2, topY - 0.24], [0, topY - 0.25],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 64);
  g.scale(1, 1, 0.62);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.85 }));
  m.position.z = -0.04;
  m.castShadow = true;
  return m;
}

// 模型坐标：头顶 y≈3.97，脸中心（眼与鼻尖之间）y≈1.3，下巴 y≈-0.7
const HEAD = { faceY: 1.3, chinToTop: 4.7, realHead: 0.23 };
new GLTFLoader().load('models/LeePerrySmith.glb', (gltf) => {
  let mesh;
  gltf.scene.traverse((o) => { if (o.isMesh) mesh = o; });
  const tl = new THREE.TextureLoader();
  const map = tl.load('models/Map-COL.jpg', invalidate);
  map.colorSpace = THREE.SRGBColorSpace;
  const spec = tl.load('models/Map-SPEC.jpg', invalidate);
  spec.colorSpace = THREE.SRGBColorSpace;
  const normalMap = tl.load('models/Infinite-Level_02_Tangent_SmoothUV.jpg', invalidate);
  [map, spec, normalMap].forEach((t) => (t.anisotropy = 4));
  mesh.material = new THREE.MeshPhysicalMaterial({
    map, normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.48, specularIntensity: 0.6, specularColorMap: spec,
    sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffd9c7),
  });
  mesh.castShadow = mesh.receiveShadow = true;
  const s = HEAD.realHead / HEAD.chinToTop;
  mesh.rotation.set(0, 0, 0);
  mesh.scale.setScalar(s);
  mesh.position.set(0, P.FACE.y - HEAD.faceY * s, 0);
  subject.add(mesh, makeTop(P.FACE.y + (-2.1 - HEAD.faceY) * s));
  invalidate();
}, undefined, (e) => console.error('模型加载失败', e));

// ---------- 灯具 ----------
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#111';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GRID_TEX = gridTexture();
const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide });
const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7, side: THREE.DoubleSide });

function buildModifier(mod, emissive) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20), black);
  body.rotation.x = Math.PI / 2;
  body.position.z = -0.12;
  g.add(body);
  const face = (geo, z, tex) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: emissive, map: tex || null, side: THREE.DoubleSide, toneMapped: false }));
    m.position.z = z;
    m.userData.emissive = true;
    g.add(m);
  };
  if (mod === 'bare') {
    face(new THREE.SphereGeometry(0.045, 16, 12), 0.01);
  } else if (mod === 'reflector') {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.065, 0.18, 32, 1, true), metal);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0.07;
    g.add(cone);
    face(new THREE.CircleGeometry(0.06, 24), 0.0);
  } else {
    const box = new THREE.Mesh(new THREE.CylinderGeometry(0.636, 0.1, 0.45, 4, 1, true).rotateY(Math.PI / 4), black);
    box.rotation.x = Math.PI / 2;
    box.position.z = 0.225;
    g.add(box);
    face(new THREE.PlaneGeometry(0.9, 0.9), 0.45, mod === 'grid' ? GRID_TEX : null);
  }
  return g;
}

const rigs = {};
for (const id of Object.keys(P.LIGHT_SPECS)) {
  const spot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 4, 0.5, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 0.15;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.006;
  scene.add(spot, spot.target);

  const helper = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), metal);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 3), black);
  const head = new THREE.Group();
  helper.add(pole, base, head);
  scene.add(helper);
  rigs[id] = { spot, helper, pole, base, head, mod: null, color: new THREE.Color() };
}

// 相机模型
const camModel = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), black);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20), black);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.08;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), metal);
  pole.position.y = -0.78;
  camModel.add(body, lens, pole);
}
scene.add(camModel);

// ---------- 相机 ----------
const photoCam = new THREE.PerspectiveCamera(23.9, 0.8, 0.05, 40);
photoCam.position.set(0, 1.59, 1.3);
photoCam.lookAt(0, 1.535, 0);
camModel.position.copy(photoCam.position);
camModel.quaternion.copy(photoCam.quaternion);

const sceneCam = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
sceneCam.position.set(-0.7, 5.0, 4.4);
sceneCam.layers.enable(HELPER);
const controls = new OrbitControls(sceneCam, sceneCanvas);
controls.target.set(0, 1.1, -0.3);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1;
controls.maxDistance = 12;
controls.update();

const helperRoots = [camModel, ...Object.values(rigs).map((r) => r.helper)];
const setHelperLayers = () => helperRoots.forEach((h) => h.traverse((o) => o.layers.set(HELPER)));

// ---------- 同步状态到场景 ----------
const _pos = new THREE.Vector3();
const _tgt = new THREE.Vector3();
let analysis = null;

function syncScene() {
  backdrop.position.set(0, 1.9, -state.bg.dist);
  backdropMat.color.setStyle(state.bg.color, THREE.SRGBColorSpace);

  for (const [id, rig] of Object.entries(rigs)) {
    const l = state.lights[id];
    const m = P.MODIFIERS[l.mod];
    P.lightPosition(l, _pos);
    P.lightTarget(l, state.bg.dist, _tgt);
    const { spot } = rig;
    spot.position.copy(_pos);
    spot.target.position.copy(_tgt);
    spot.target.updateMatrixWorld();
    spot.angle = THREE.MathUtils.degToRad(Math.min(m.beam / 2, 85));
    spot.penumbra = m.penumbra;
    spot.intensity = P.candela(id, l);
    spot.castShadow = spot.intensity > 0;
    rig.color.copy(P.lightColor(id, l));
    const d = _pos.distanceTo(_tgt);
    spot.shadow.focus = THREE.MathUtils.clamp((2 * Math.atan(0.9 / d)) / (2 * spot.angle), 0.05, 1);
    spot.shadow.radius = THREE.MathUtils.clamp((m.size / d) * 8, 1, 5);
    spot.shadow.camera.far = d + 6;

    // 灯架
    rig.pole.scale.y = Math.max(l.height, 0.05);
    rig.pole.position.set(_pos.x, l.height / 2, _pos.z);
    rig.base.position.set(_pos.x, 0.01, _pos.z);
    if (rig.mod !== l.mod) {
      rig.head.clear();
      rig.head.add(buildModifier(l.mod, 0xffffff));
      rig.mod = l.mod;
    }
    rig.head.position.copy(_pos);
    rig.head.lookAt(_tgt);
    const glow = l.on ? 0.25 + (l.power / 100) * 0.9 : 0.06;
    const c = rig.color.clone().multiplyScalar(glow);
    rig.head.traverse((o) => { if (o.userData.emissive) o.material.color.copy(c); });
  }
  setHelperLayers();
  analysis = P.analyze(state);
}

function applyWB(wb) {
  const w = P.kelvinToLinear(wb);
  for (const rig of Object.values(rigs)) {
    rig.spot.color.setRGB(rig.color.r / w.r, rig.color.g / w.g, rig.color.b / w.b);
  }
  workLight.color.setRGB(1 / w.r, 1 / w.g, 1 / w.b).multiply(new THREE.Color(0xdfe6ee));
}

// ---------- 渲染 ----------
let dirtyScene = true, dirtyPhoto = true;
function invalidate() { dirtyScene = dirtyPhoto = true; }

const labelsEl = document.getElementById('labels');
const labelEls = {};
for (const [id, spec] of Object.entries(P.LIGHT_SPECS)) {
  const el = document.createElement('span');
  el.className = 'lbl';
  el.style.setProperty('--c', spec.color);
  el.textContent = spec.label;
  labelsEl.appendChild(el);
  labelEls[id] = el;
}
labelEls.cam = Object.assign(document.createElement('span'), { className: 'lbl cam', textContent: '相机' });
labelsEl.appendChild(labelEls.cam);

function updateLabels() {
  const w = sceneCanvas.clientWidth, h = sceneCanvas.clientHeight;
  const place = (el, v) => {
    v.project(sceneCam);
    const hidden = v.z > 1;
    el.style.display = hidden ? 'none' : '';
    el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -150%)`;
  };
  for (const id of Object.keys(rigs)) {
    place(labelEls[id], rigs[id].head.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
    labelEls[id].classList.toggle('off', !state.lights[id].on);
  }
  place(labelEls.cam, camModel.position.clone().add(new THREE.Vector3(0, 0.12, 0)));
}

const histCanvas = document.createElement('canvas');
histCanvas.width = 80;
histCanvas.height = 100;
const histCtx = histCanvas.getContext('2d', { willReadFrequently: true });
let histogram = null;

function computeHistogram() {
  histCtx.drawImage(photoCanvas, 0, 0, histCanvas.width, histCanvas.height);
  const d = histCtx.getImageData(0, 0, histCanvas.width, histCanvas.height).data;
  const bins = new Array(48).fill(0);
  let clip = 0, crush = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    bins[Math.min(47, Math.floor((y / 256) * 48))]++;
    if (d[i] > 250 || d[i + 1] > 250 || d[i + 2] > 250) clip++;
    if (y < 4) crush++;
  }
  const n = d.length / 4;
  histogram = { bins, clip: clip / n, crush: crush / n };
}

function render() {
  if (controls.update()) dirtyScene = true;
  if (dirtyScene || dirtyPhoto) syncScene();
  if (dirtyScene) {
    const ref = Math.max(analysis.front, analysis.bgLux, 30) * 1.3;
    applyWB(EYE_WB);
    rScene.toneMappingExposure = Math.PI / ref;
    workLight.intensity = ref * 0.3;
    workLight.visible = true;
    scene.background = new THREE.Color(0x0e1013);
    rScene.render(scene, sceneCam);
    updateLabels();
    dirtyScene = false;
  }
  if (dirtyPhoto) {
    const { N, t, iso, wb } = state.cam;
    applyWB(wb);
    workLight.visible = false;
    rPhoto.toneMappingExposure = (Math.PI * t * iso) / (250 * N * N);
    scene.background = new THREE.Color(0x000000);
    rPhoto.render(scene, photoCam);
    computeHistogram();
    photoCanvas.style.filter = state.cam.bw ? 'grayscale(1) contrast(1.06)' : '';
    document.getElementById('grain').style.opacity = THREE.MathUtils.clamp(Math.log2(iso / 100) * 0.075, 0, 0.45);
    document.getElementById('exif').textContent = `f/${N}  ${P.fmtShutter(t)}  ISO ${iso}  WB ${wb}K`;
    renderReadout(document.getElementById('readout'), state, analysis, histogram);
    dirtyPhoto = false;
  }
  requestAnimationFrame(render);
}

// ---------- 尺寸 ----------
function resize() {
  const sv = sceneCanvas.parentElement;
  rScene.setSize(sv.clientWidth, sv.clientHeight, false);
  sceneCam.aspect = sv.clientWidth / Math.max(sv.clientHeight, 1);
  sceneCam.updateProjectionMatrix();
  const pv = photoCanvas.parentElement.parentElement;
  const W = pv.clientWidth, H = pv.clientHeight;
  let w = W, h = W / 0.8;
  if (h > H) { h = H; w = H * 0.8; }
  const frame = photoCanvas.parentElement;
  frame.style.width = `${Math.floor(w)}px`;
  frame.style.height = `${Math.floor(h)}px`;
  rPhoto.setSize(Math.floor(w), Math.floor(h), false);
  invalidate();
}
const ro = new ResizeObserver(resize);
document.querySelectorAll('#views, #views > .view').forEach((el) => ro.observe(el));

// ---------- 交互 ----------
function onChange({ meter = false } = {}) {
  if (meter) {
    const a = P.analyze(state);
    P.autoExpose(state.cam, a.front);
  }
  invalidate();
}

function applyPreset(p) {
  state.presetId = p.id;
  state.lights = structuredClone(p.lights);
  state.bg = { ...p.bg };
  state.cam.N = p.cam.N;
  state.cam.wb = p.cam.wb;
  state.cam.bw = !!p.cam.bw;
  P.autoExpose(state.cam, P.analyze(state).front, p.cam.bias || 0);
  panel.refresh();
  invalidate();
}

const panel = buildPanel(document.getElementById('panel'), state, { onChange, applyPreset, PRESETS });
initHelp();

const viewsEl = document.getElementById('views');
const setMode = (mode) => {
  document.querySelectorAll('.view-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.mode === mode));
  viewsEl.classList.remove('mode-split', 'mode-scene', 'mode-photo', 'mode-ref');
  viewsEl.classList.add(`mode-${mode}`);
};
document.querySelectorAll('.view-tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

function showReference(url) {
  document.getElementById('refImg').src = url;
  viewsEl.classList.add('has-ref');
  document.body.classList.add('has-ref');
  setMode('split');
}

function applyAnalysis(ai, px) {
  state.presetId = null;
  const notes = solveLighting(ai, state, px);
  panel.refresh();
  invalidate();
  return notes;
}

const analyzer = initAnalyzer(document.getElementById('panel'), { state, onResult: applyAnalysis, onReference: showReference });

const params = new URLSearchParams(location.search);
if (params.has('photoonly')) document.body.classList.add('photo-only');
applyPreset(PRESETS.find((p) => p.id === params.get('preset')) || PRESETS[0]);
// 开发调试：?autotest=名字 → 用 .gt/名字.png 跑一遍完整的真实分析（密钥取自启动时的 VITE_TEST_KEY 环境变量）
if (import.meta.env.DEV && params.has('autotest') && import.meta.env.VITE_TEST_KEY) {
  (async () => {
    const { saveSettings, PROVIDERS, fileToDataURL } = await import('./analyze.js');
    saveSettings({ provider: 'deepseek', ...PROVIDERS.deepseek, apiKey: import.meta.env.VITE_TEST_KEY });
    const blob = await (await fetch(`/.gt/${params.get('autotest')}.png`)).blob();
    await analyzer.run(await fileToDataURL(blob));
    const probe = document.createElement('canvas').getContext('2d');
    probe.canvas.width = probe.canvas.height = 16;
    probe.drawImage(photoCanvas, 0, 0, 16, 16);
    const canvasSum = probe.getImageData(0, 0, 16, 16).data.reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0);
    console.warn('AUTOTEST', JSON.stringify({ canvasSum, px: analyzer.lastPx, lights: state.lights, bg: state.bg, notes: [...document.querySelectorAll('.an-result li')].map((li) => li.innerText).slice(-4), status: document.querySelector('.an-status')?.innerText }));
  })();
}
if (import.meta.env.DEV && params.has('mock')) {
  import('./mock.js').then(({ MOCKS }) => {
    const m = MOCKS[params.get('mock')] || MOCKS.vogue;
    showReference(m.ref);
    analyzer.renderResult(m.ai, applyAnalysis(m.ai));
  });
}
resize();
render();
