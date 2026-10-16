// 把 AI 的"看图判断"换算成三盏灯的具体参数：
// 方向/高度/软硬直接采用，亮度和距离用练习室的物理模型反推，让光比、背景亮度对上参考图
import * as THREE from 'three';
import * as P from './physics.js';

const clamp = THREE.MathUtils.clamp;
const num = (v, d) => (Number.isFinite(+v) ? +v : d);
const wrapAz = (a) => Math.round((((num(a, 0) + 180) % 360 + 360) % 360 - 180) / 5) * 5;
const height = (h, d) => Math.round(clamp(P.FACE.y + num(h, d), 0.3, 3) * 20) / 20;
const round = (v, s) => Math.round(v / s) * s;

// 在 [lo, hi] 中二分查找 x，使 f(x) ≈ target（f 单调）
function bisect(f, lo, hi, target, iters = 22) {
  const inc = f(hi) > f(lo);
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if ((f(mid) < target) === inc) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const albedo = (hex) => {
  const c = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  return Math.max(0.02, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
};
const SKIN = 0.35;

export function solveLighting(ai, state) {
  const notes = [];
  const k = ai.key || {}, f = ai.fill || {}, r = ai.rim || {}, b = ai.background || {};
  const cct = (v, id) => round(clamp(num(v, 5600), ...P.LIGHT_SPECS[id].cct), 50);

  const soft = k.softness || 'soft';
  const keyAz = wrapAz(k.az ?? 40);
  const L = state.lights;
  L.key = {
    on: true, power: 70, cct: cct(k.cct, 'key'),
    mod: soft === 'hard' ? 'reflector' : k.spill_control ? 'grid' : 'softbox',
    az: keyAz, height: height(k.height, 0.4), dist: soft === 'soft' ? 1.1 : soft === 'medium' ? 1.7 : 2.0,
    target: 'face', rgb: false, hue: 300, sat: 1,
  };
  if (soft === 'medium') notes.push('参考图的光"不软不硬"：主灯用柔光箱但放远一些（1.7m），光会比贴近时硬一点。');

  // ---------- 辅灯：按目标光比反推亮度 ----------
  const ratio = clamp(num(ai.ratio, 3), 1.1, 16);
  const fillAz = f.az != null ? wrapAz(f.az) : keyAz >= 0 ? -40 : 40;
  L.fill = {
    on: ratio < 10, power: 30, cct: cct(f.cct ?? k.cct, 'fill'), mod: 'softbox',
    az: fillAz, height: height(f.height, 0), dist: 1.5, target: 'face', rgb: false, hue: 300, sat: 1,
  };
  L.rim = {
    on: false, power: 60, cct: cct(r.cct, 'rim'), mod: 'reflector', az: wrapAz(r.az ?? (keyAz >= 0 ? -145 : 145)),
    height: height(r.height, 0.5), dist: 1.3, target: r.target === 'bg' ? 'bg' : 'face',
    rgb: !!r.rgb, hue: round(clamp(num(r.hue, 300), 0, 360), 1), sat: clamp(num(r.sat, 1), 0, 1),
  };

  state.bg = { color: /^#[0-9a-f]{6}$/i.test(b.paper || '') ? b.paper.toLowerCase() : '#9a9a9a', dist: 1.5 };

  const ratioAt = () => P.analyze(state).ratio;
  if (L.fill.on) {
    if (f.on === false) notes.push(`参考图暗面并不全黑（光比约 ${ratio}:1），实际可能用了反光板补光，这里用辅灯代替。`);
    const fl = L.fill;
    fl.power = 100;
    while (ratioAt() > ratio && fl.dist > 0.8) fl.dist = round(fl.dist - 0.1, 0.05);
    fl.power = 1;
    while (ratioAt() < ratio && fl.dist < 4) fl.dist = round(fl.dist + 0.2, 0.05);
    fl.power = Math.round(clamp(bisect((p) => { fl.power = p; return ratioAt(); }, 1, 100, ratio), 1, 100));
  } else if (f.on !== false) {
    notes.push('暗面几乎全黑，所以不开辅灯。');
  }

  // ---------- 轮廓灯 ----------
  const rimToFace = r.on && L.rim.target === 'face';
  if (rimToFace) {
    const rim = L.rim;
    rim.on = true;
    rim.power = 100;
    const keyLux = P.analyze(state).per.key.lux;
    const want = keyLux * Math.pow(2, clamp(num(r.stops, 0), -2, 2));
    const full = P.analyze(state).per.rim.lux;
    let power = (100 * want) / Math.max(full, 1e-3);
    if (power > 100) {
      rim.dist = round(clamp(rim.dist / Math.sqrt(power / 100), 0.6, 4), 0.05);
      power = (100 * want) / Math.max(P.analyze(state).per.rim.lux, 1e-3);
    }
    rim.power = Math.round(clamp(power, 1, 100));
  }

  // ---------- 背景：按"背景比脸亮/暗几档"反推 ----------
  const bgStops = clamp(num(b.stops_vs_face, -1.5), -6, 2);
  const wantRatio = (Math.pow(2, bgStops) * SKIN) / albedo(state.bg.color);
  const bgRatio = () => { const a = P.analyze(state); return a.bgLux / Math.max(a.front, 1e-3); };
  const lightBg = (rim) => {
    rim.on = true;
    rim.power = 100;
    if (bgRatio() < wantRatio) rim.dist = 0.8;
    rim.power = Math.round(clamp(bisect((p) => { rim.power = p; return bgRatio(); }, 1, 100, wantRatio), 1, 100));
  };

  if (r.on && L.rim.target === 'bg') {
    L.rim.az = 175; L.rim.height = 1.2; L.rim.dist = 1.0;
    state.bg.dist = 1.2;
    lightBg(L.rim);
  } else {
    state.bg.dist = round(clamp(bisect((d) => { state.bg.dist = d; return bgRatio(); }, 0.6, 4, wantRatio), 0.6, 4), 0.05);
    if (bgRatio() < wantRatio * 0.7 && !rimToFace) {
      Object.assign(L.rim, { target: 'bg', az: 175, height: 1.2, dist: 1.0, rgb: false });
      state.bg.dist = 1.2;
      lightBg(L.rim);
      notes.push('参考图背景比较亮，单靠主灯溢出的光不够，所以把轮廓灯转过去专门照背景。');
    } else if (bgRatio() > wantRatio * 1.5) {
      notes.push('参考图背景很暗：背景已经拉到最远，还可以换更深的背景纸，或者主灯换成"柔光箱+蜂巢"。');
    }
  }

  // ---------- 相机：只为把成片曝光正常，用户不用管 ----------
  Object.assign(state.cam, { N: 4, wb: 5600, bw: !!ai.bw });
  P.autoExpose(state.cam, P.analyze(state).front);
  return notes;
}
