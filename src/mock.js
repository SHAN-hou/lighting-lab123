// 仅开发调试用（?mock 或 ?mock=top）：模拟一次 AI 返回，测试换算和界面
// 参考图放在本地 src/mock-ref*.png（已 gitignore）
import vogueRef from './mock-ref.png';
import topRef from './mock-ref-top.png';

export const MOCKS = {
  vogue: {
    ref: vogueRef,
    ai: {
      summary: '柔和的侧前方主光从画面右侧偏高处照来，暗面有少量补光，背景是浅灰色，整体干净通透。',
      pattern: '环形光',
      bw: true,
      key: { az: 40, elev: 20, softness: 'soft', spill_control: false, cct: 5600 },
      fill: { on: true, az: -45, elev: 0, cct: 5600 },
      ratio: 3,
      rim: { on: false, az: -150, elev: 25, target: 'face', rgb: false, hue: 0, sat: 0, cct: 5600, stops: 0 },
      background: { paper: '#c8c8c8', stops_vs_face: -1 },
      reasons: ['画面右侧的脸颊、下巴和肩膀最亮，左侧偏暗，说明主灯在画面右侧。', '明暗之间过渡很平缓，说明用的是大面积的柔光。'],
      confidence: 'medium',
    },
  },
  top: {
    ref: topRef,
    ai: {
      summary: '一盏较硬的灯几乎从头顶正上方往下照，眼窝、鼻下、下巴下全是深影子，背景是浅米灰色。',
      pattern: '其他',
      bw: true,
      key: { az: 0, elev: 78, softness: 'hard', spill_control: false, cct: 5600 },
      fill: { on: false, az: 0, elev: 0, cct: 5600 },
      ratio: 14,
      rim: { on: false, az: 180, elev: 30, target: 'face', rgb: false, hue: 0, sat: 0, cct: 5600, stops: 0 },
      background: { paper: '#d6cfc4', stops_vs_face: -0.5 },
      reasons: ['眉骨下的眼窝发黑、鼻子影子短而直地落在正下方，说明光在正上方。', '头顶和肩膀上沿最亮、脖子大面积在阴影里，是典型顶光。', '影子边缘清晰，光偏硬。', '暗面几乎没有细节，没有补光。'],
      confidence: 'high',
    },
  },
};
