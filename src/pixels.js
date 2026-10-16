// 直接测量参考图像素：左右半脸亮度、背景亮度、是否黑白
// 用来校正 AI 容易判断错的"左右"和"背景亮暗"

const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const LUT = Array.from({ length: 256 }, (_, i) => toLin(i));

function loadPixels(dataURL, max = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      resolve({ w, h, d: g.getImageData(0, 0, w, h).data });
    };
    img.onerror = reject;
    img.src = dataURL;
  });
}

const median = (a) => { if (!a.length) return 0; a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

// box：[x0, y0, x1, y1]，0–1 的比例坐标
export async function measurePhoto(dataURL, box) {
  const { w, h, d } = await loadPixels(dataURL);
  let chroma = 0;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = LUT[d[i]], g = LUT[d[i + 1]], b = LUT[d[i + 2]];
    lum[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    chroma += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  }
  const bw = chroma / (w * h) < 6;

  const ok = Array.isArray(box) && box.length === 4 && box.every((v) => Number.isFinite(+v));
  if (!ok) return { bw };
  let [x0, y0, x1, y1] = box.map(Number);
  if (Math.max(x0, y0, x1, y1) > 1.5) [x0, y0, x1, y1] = [x0, y0, x1, y1].map((v) => v / 1000);
  if (x1 - x0 < 0.03 || y1 - y0 < 0.03) return { bw };

  // 脸内部：去掉两侧 12%（耳朵、头发），纵向取眉毛到下巴之间
  const fx0 = x0 + (x1 - x0) * 0.12, fx1 = x1 - (x1 - x0) * 0.12, mid = (x0 + x1) / 2;
  const fy0 = y0 + (y1 - y0) * 0.25, fy1 = y0 + (y1 - y0) * 0.9;
  const L = [], R = [], bg = [], brow = [], eyes = [];
  // 背景：只取头部左右两侧一圈（人眼对比时看的就是这里），避开画面暗角、头发、耳朵和身体
  const fw = x1 - x0, fh = y1 - y0;
  const gap = fw * 0.3, far = fw * 1.1;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, l = lum[y * w + x];
      if (u >= fx0 && u <= fx1) {
        if (v >= y0 + fh * 0.05 && v <= y0 + fh * 0.2) brow.push(l);
        else if (v >= y0 + fh * 0.33 && v <= y0 + fh * 0.47) eyes.push(l);
      }
      if (v >= fy0 && v <= fy1 && u >= fx0 && u <= fx1) { (u < mid ? L : R).push(l); continue; }
      if (v >= y0 - fh * 0.2 && v <= y0 + fh * 0.6 && ((u >= x0 - far && u <= x0 - gap) || (u >= x1 + gap && u <= x1 + far))) bg.push(l);
    }
  }
  const lumL = mean(L), lumR = mean(R);
  const eyeStops = brow.length && eyes.length ? Math.log2(Math.max(mean(eyes), 1e-4) / Math.max(mean(brow), 1e-4)) : null;
  const faceBright = Math.max(lumL, lumR, 1e-4);
  const bgLum = bg.length > 30 ? median(bg) : null;
  return {
    bw,
    lumL, lumR,
    sideStops: Math.log2(Math.max(lumR, 1e-4) / Math.max(lumL, 1e-4)), // >0：画面右侧更亮
    bgStops: bgLum != null ? Math.log2(Math.max(bgLum, 1e-4) / faceBright) : null,
    eyeStops, // 眼睛一带比额头暗几档：顶光时会非常暗
  };
}
