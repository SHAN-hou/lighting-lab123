import * as THREE from 'three';

export const FACE = new THREE.Vector3(0, 1.6, 0.05);

export const LIGHT_SPECS = {
  key: {
    label: '主灯', color: '#ffb547', watt: 100, cct: [2700, 6500], lux1m: 20100, ref: 'reflector', rgb: false,
    desc: '100W 双色温，全场最亮。它决定"光从哪边来、影子往哪边落"，是整张照片的灵魂。',
  },
  fill: {
    label: '辅灯', color: '#5fb4ff', watt: 63, cct: [2700, 6500], lux1m: 11200, ref: 'reflector', rgb: false,
    desc: '63W 双色温。主灯会在脸上留下阴影，辅灯负责把阴影"补亮一点"，控制明暗反差（光比）。',
  },
  rim: {
    label: '轮廓灯', color: '#ff5fd2', watt: 63, cct: [2500, 10000], lux1m: 2350, ref: 'bare', rgb: true,
    desc: '63W RGB 全彩。放在人物侧后方，给头发、脸边、肩膀勾一道亮边，让人从背景里"跳"出来；也可以转过去打背景。',
  },
};

// eff：相对"标准罩"的亮度系数（经验估算值）
export const MODIFIERS = {
  bare: {
    label: '裸灯', eff: 0.25, beam: 120, penumbra: 0.9, size: 0.06,
    tip: '什么都不加。光很"硬"，影子边缘锋利，光到处乱跑（会照到背景）。',
  },
  reflector: {
    label: '标准罩', eff: 1, beam: 55, penumbra: 0.35, size: 0.18,
    tip: '金属反光碗，把光往前集中，亮度最高、影子清晰。厂家标的"带罩照度"就是这个状态。',
  },
  softbox: {
    label: '柔光箱 90cm', eff: 0.3, beam: 110, penumbra: 1, size: 0.9,
    tip: '把小灯泡变成一块大"发光布"。影子边缘过渡柔和、皮肤显细腻，但亮度损失约 1.7 档。杂志人像最常用。',
  },
  grid: {
    label: '柔光箱+蜂巢', eff: 0.22, beam: 45, penumbra: 0.6, size: 0.9,
    tip: '在柔光箱前加一层"格子网"。光依然柔，但只往正前方走，不会溢到背景上，适合暗调人像。',
  },
};

export const APERTURES = [1.4, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const SHUTTERS = [8000, 6400, 5000, 4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 640, 500, 400, 320, 250, 200, 160, 125, 100, 80, 60, 50, 40, 30, 25, 20, 15].map((d) => 1 / d);
export const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400];

export const fmtShutter = (t) => (t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`);

// 色温 → 线性 RGB（亮度归一化为 1）
export function kelvinToLinear(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = new THREE.Color().setRGB(
    THREE.MathUtils.clamp(r, 0, 255) / 255,
    THREE.MathUtils.clamp(g, 0, 255) / 255,
    THREE.MathUtils.clamp(b, 0, 255) / 255,
    THREE.SRGBColorSpace,
  );
  return normalizeLum(c);
}

export function normalizeLum(c) {
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c.multiplyScalar(1 / Math.max(y, 1e-4));
}

export function hueToLinear(h, s) {
  return normalizeLum(new THREE.Color().setHSL(h / 360, 1, 1 - s * 0.5, THREE.SRGBColorSpace));
}

// 灯的"肉眼"颜色（线性，亮度为 1）
export function lightColor(id, l) {
  return LIGHT_SPECS[id].rgb && l.rgb ? hueToLinear(l.hue, l.sat) : kelvinToLinear(l.cct);
}

// 发光强度（坎德拉）= 1 米处照度
export function candela(id, l) {
  if (!l.on) return 0;
  const spec = LIGHT_SPECS[id];
  const base = spec.lux1m / MODIFIERS[spec.ref].eff;
  // RGB 饱和色时 LED 只有部分灯珠工作，输出下降
  const rgbLoss = spec.rgb && l.rgb ? 1 - 0.55 * l.sat : 1;
  return base * MODIFIERS[l.mod].eff * (l.power / 100) * rgbLoss;
}

export function lightPosition(l, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(l.az);
  return out.set(Math.sin(a) * l.dist, l.height, Math.cos(a) * l.dist);
}

export function lightTarget(l, bgDist, out = new THREE.Vector3()) {
  return l.target === 'bg' ? out.set(0, 1.5, -bgDist) : out.copy(FACE);
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _toP = new THREE.Vector3();

// 某个点（法线 n）上来自这盏灯的照度，n 为空时按"正对灯"计算
export function illuminanceAt(id, l, bgDist, point, n = null) {
  const cd = candela(id, l);
  if (!cd) return 0;
  lightPosition(l, _p);
  lightTarget(l, bgDist, _t);
  _axis.subVectors(_t, _p).normalize();
  _toP.subVectors(point, _p);
  const d = Math.max(_toP.length(), 0.1);
  _toP.divideScalar(d);
  const m = MODIFIERS[l.mod];
  const half = THREE.MathUtils.degToRad(m.beam / 2);
  const cone = Math.cos(half);
  const pen = Math.cos(half * (1 - m.penumbra));
  const spot = THREE.MathUtils.smoothstep(_axis.dot(_toP), cone, pen);
  const cos = n ? Math.max(0, -n.dot(_toP)) : 1;
  return (cd * spot * cos) / (d * d);
}

// 入射式测光表（白色半球）：侧面来的光也能读到一半
function domeAt(id, l, bgDist, point, n) {
  const e = illuminanceAt(id, l, bgDist, point);
  if (!e) return 0;
  lightPosition(l, _p);
  _toP.subVectors(_p, point).normalize();
  return e * (1 + n.dot(_toP)) / 2;
}

export const exposureLux = (cam) => (250 * cam.N * cam.N) / (cam.t * cam.iso);

// 保持光圈，自动挑选快门和 ISO
export function autoExpose(cam, lux, bias = 0) {
  const target = lux / Math.pow(2, bias);
  let best = null;
  for (const t of SHUTTERS) {
    if (t > 1 / 30) continue;
    for (const iso of ISOS) {
      const ev = Math.abs(Math.log2(target / ((250 * cam.N * cam.N) / (t * iso))));
      // 优先：曝光准 > 快门不慢于 1/125（手持不糊）> ISO 尽量低
      const slow = Math.max(0, Math.log2(t * 125));
      const score = ev * 10 + slow * 4 + Math.abs(Math.log2(iso / 100)) + Math.abs(Math.log2(t * 160)) * 0.3;
      if (!best || score < best.score) best = { score, t, iso };
    }
  }
  cam.t = best.t;
  cam.iso = best.iso;
}

export const FACE_FRONT = new THREE.Vector3(0, 0.1, 1).normalize();
export const CHEEK_R = new THREE.Vector3(Math.sin(1), 0.12, Math.cos(1)).normalize();
export const CHEEK_L = new THREE.Vector3(-Math.sin(1), 0.12, Math.cos(1)).normalize();

export function analyze(state) {
  const { lights, bg } = state;
  const ids = Object.keys(lights);
  const per = {};
  let front = 0, r = 0, lft = 0;
  const bgPt = new THREE.Vector3(0, 1.5, -bg.dist);
  const bgN = new THREE.Vector3(0, 0, 1);
  let bgLux = 0;
  for (const id of ids) {
    const l = lights[id];
    const dist = lightPosition(l, _p).distanceTo(FACE);
    per[id] = { lux: illuminanceAt(id, l, bg.dist, FACE), dist, cd: candela(id, l) };
    front += domeAt(id, l, bg.dist, FACE, FACE_FRONT);
    r += illuminanceAt(id, l, bg.dist, FACE, CHEEK_R);
    lft += illuminanceAt(id, l, bg.dist, FACE, CHEEK_L);
    bgLux += illuminanceAt(id, l, bg.dist, bgPt, bgN);
  }
  const bright = Math.max(r, lft);
  const dark = Math.min(r, lft);
  return {
    per, front, bgLux,
    ratio: dark > 0.5 ? bright / dark : Infinity,
    brightSide: r >= lft ? '画面右侧' : '画面左侧',
    ev: front > 0 ? Math.log2(front / exposureLux(state.cam)) : -Infinity,
  };
}
