// 仅开发调试用（?mock）：模拟一次 AI 返回，测试换算和界面
export { default as MOCK_REF } from './mock-ref.png';

export const MOCK = {
  summary: '柔和的侧前方主光从画面右侧偏高处照来，暗面有少量补光，背景是浅灰色，整体干净通透。',
  pattern: '环形光',
  bw: true,
  key: { az: 40, height: 0.4, softness: 'soft', spill_control: false, cct: 5600 },
  fill: { on: true, az: -45, height: 0, cct: 5600 },
  ratio: 3,
  rim: { on: false, az: -150, height: 0.5, target: 'face', rgb: false, hue: 0, sat: 0, cct: 5600, stops: 0 },
  background: { paper: '#c8c8c8', stops_vs_face: -1 },
  reasons: [
    '画面右侧的脸颊、下巴和肩膀最亮，左侧偏暗，说明主灯在画面右侧。',
    '明暗之间过渡很平缓，没有锋利的阴影边，说明用的是大面积的柔光。',
    '暗面的皮肤细节还看得清，说明有补光，亮暗面相差大约 1.5 档（约 3:1）。',
    '头发边缘没有亮边，说明没有用轮廓光。',
  ],
  confidence: 'medium',
};
