const L = (o) => ({ on: true, power: 60, cct: 5600, mod: 'softbox', az: 0, height: 2, dist: 1.5, target: 'face', rgb: false, hue: 300, sat: 1, ...o });
const OFF = (o) => L({ on: false, ...o });

export const PRESETS = [
  {
    id: 'three', name: '三点布光', tag: '入门必学',
    how: '主灯侧前方 40° 偏高；辅灯在另一侧、亮度只有主灯一半左右；轮廓灯在人物斜后方（和主灯相反的一侧，勾出暗面的边）。',
    desc: '最经典的"配方"：主灯负责照亮脸，辅灯把阴影补得没那么黑，轮廓灯从背后打出一圈亮边，把人和背景分开。几乎所有人像布光都是从它变化出来的。',
    look: '看成片：脸有明暗但暗面不死黑，头发边缘有一道亮线。',
    lights: {
      key: L({ power: 70, az: 40, height: 2.1, dist: 1.6 }),
      fill: L({ power: 55, az: -45, height: 1.7, dist: 1.9 }),
      rim: L({ power: 60, mod: 'reflector', az: -150, height: 2.2, dist: 1.5 }),
    },
    bg: { color: '#6e6e6e', dist: 2.2 }, cam: { N: 4, wb: 5600 },
  },
  {
    id: 'rembrandt', name: '伦勃朗光', tag: '油画感',
    how: '主灯侧前方约 45°、比头高 50–70cm；辅灯很弱或不开。',
    desc: '名字来自荷兰画家伦勃朗。鼻子的影子和脸颊的影子连起来，在暗面脸颊上留下一个小小的"倒三角"亮区。有故事感、沉稳，常用于男士、人物专访。',
    look: '看成片：暗侧脸颊眼睛下方有个三角形亮块。三角太大→主灯往正面转一点；没有三角→主灯往侧面转或抬高。',
    lights: {
      key: L({ power: 75, az: 50, height: 2.25, dist: 1.4 }),
      fill: L({ power: 12, az: -40, height: 1.6, dist: 2.2 }),
      rim: OFF({ mod: 'reflector', az: -150, height: 2.2, dist: 1.5 }),
    },
    bg: { color: '#2e2e2e', dist: 2.5 }, cam: { N: 4, wb: 5600 },
  },
  {
    id: 'butterfly', name: '蝴蝶光', tag: '美妆封面',
    how: '主灯正对脸、从高处往下打；辅灯在正下方往上补（俗称"夹板光"）。',
    desc: '鼻子正下方会出现一个像小蝴蝶的阴影，所以叫蝴蝶光（也叫派拉蒙光，老好莱坞明星照常用）。显脸瘦、突出颧骨，美妆、时尚杂志封面最爱。',
    look: '看成片：鼻子下方有小蝴蝶形影子，下巴下有阴影；把辅灯调亮可去掉眼袋和法令纹的阴影。',
    lights: {
      key: L({ power: 55, mod: 'reflector', az: 0, height: 2.35, dist: 1.2 }),
      fill: L({ power: 25, az: 0, height: 0.95, dist: 1.0 }),
      rim: OFF({ mod: 'reflector', az: 160, height: 2.2, dist: 1.4 }),
    },
    bg: { color: '#c9c3bb', dist: 2.0 }, cam: { N: 5.6, wb: 5600 },
  },
  {
    id: 'loop', name: '环形光', tag: '万能讨好',
    how: '主灯侧前方 25–35°、略高于头；辅灯另一侧补光；轮廓灯斜后方。',
    desc: '介于蝴蝶光和伦勃朗光之间：鼻子的影子斜向一边、像个小圆环，但不和脸颊的影子连上。对大多数脸型都友好，是商业人像的"保险牌"。',
    look: '看成片：鼻翼旁有一小块斜向下的影子。',
    lights: {
      key: L({ power: 60, az: 30, height: 2.05, dist: 1.5 }),
      fill: L({ power: 25, az: -40, height: 1.6, dist: 1.9 }),
      rim: L({ power: 50, mod: 'reflector', az: -145, height: 2.1, dist: 1.4 }),
    },
    bg: { color: '#5d7488', dist: 2.2 }, cam: { N: 4, wb: 5600 },
  },
  {
    id: 'vogue', name: '杂志柔光', tag: '时尚大片',
    how: '主灯加柔光箱在画面右侧 40°、比脸高 40cm、离得近；辅灯柔光箱在另一侧、和脸差不多高，用来把暗面补到只比亮面暗 1 档多一点；不开轮廓灯；浅灰背景离人 1 米左右。',
    desc: '时尚杂志里常见的柔和侧光：一侧脸亮、一侧略暗但细节都在，阴影边缘很柔，背景是浅灰。干净、通透、高级，靠模特的姿态和头发营造氛围。',
    look: '看成片：光比约 2.5–3:1，鼻子的影子斜向一侧但不和脸颊阴影连上；背景比脸暗 1–1.5 档、中间亮四周暗。成片默认黑白，可在"相机"里切回彩色。',
    lights: {
      key: L({ power: 70, az: 40, height: 2.0, dist: 1.1 }),
      fill: L({ power: 60, az: -40, height: 1.65, dist: 1.4 }),
      rim: OFF({ mod: 'reflector', az: -150, height: 2.2, dist: 1.5 }),
    },
    bg: { color: '#d0d0d0', dist: 0.8 }, cam: { N: 2.8, wb: 5600, bias: 0.3, bw: true },
  },
  {
    id: 'split', name: '分割光', tag: '强烈个性',
    how: '主灯在人物正侧面 90°、和脸差不多高；不开辅灯；轮廓灯在另一侧后方。',
    desc: '脸正好一半亮、一半黑。神秘、强烈、有冲突感，适合男士、艺人硬照、电影海报风格。',
    look: '看成片：鼻梁就是明暗分界线；轮廓灯会在暗面勾出一条细亮边。',
    lights: {
      key: L({ power: 70, mod: 'grid', az: 90, height: 1.75, dist: 1.3 }),
      fill: OFF({ az: -45, height: 1.6, dist: 2 }),
      rim: L({ power: 70, mod: 'reflector', az: -140, height: 1.9, dist: 1.3 }),
    },
    bg: { color: '#141414', dist: 2.6 }, cam: { N: 4, wb: 5600 },
  },
  {
    id: 'highkey', name: '高调光', tag: '清新干净',
    how: '主灯正前方偏高、辅灯正前方偏低（都用柔光箱）；轮廓灯转去打白背景。',
    desc: '整体明亮通透、几乎没有深阴影，背景接近纯白。清新、日系、美妆护肤类杂志常用。光比很小（约 1.5:1–2:1）。',
    look: '看成片：脸很亮很平、背景白；曝光故意比"正常"多一点。',
    lights: {
      key: L({ power: 80, az: 10, height: 2.05, dist: 1.5 }),
      fill: L({ power: 55, az: -10, height: 1.0, dist: 1.4 }),
      rim: L({ power: 100, mod: 'reflector', az: 175, height: 1.2, dist: 0.9, target: 'bg' }),
    },
    bg: { color: '#f2f2f2', dist: 1.6 }, cam: { N: 5.6, wb: 5600, bias: 0.5 },
  },
  {
    id: 'lowkey', name: '低调光', tag: '高级质感',
    how: '主灯加蜂巢从侧前方打；不开辅灯；轮廓灯从后方勾边；黑背景且离人远。',
    desc: '画面大面积是暗部，只照亮你想让人看到的部分。有力量感、高级感。蜂巢让光不乱跑到背景上，背景离得远会更黑。',
    look: '看成片：背景全黑，脸部明暗对比强，轮廓光把头发和背景分开。',
    lights: {
      key: L({ power: 55, mod: 'grid', az: 55, height: 2.1, dist: 1.2 }),
      fill: OFF({ az: -45, height: 1.6, dist: 2 }),
      rim: L({ power: 45, mod: 'reflector', az: -140, height: 2.2, dist: 1.2 }),
    },
    bg: { color: '#121212', dist: 3.0 }, cam: { N: 4, wb: 5600, bias: -0.3 },
  },
  {
    id: 'color', name: '彩色轮廓', tag: '潮流音乐',
    how: '主灯保持自然肤色；轮廓灯切换 RGB 全彩，从侧后方勾边。',
    desc: '用 RGB 轮廓灯在头发和脸边勾出彩色光边，潮流、音乐、电竞类杂志常用。主灯色温偏暖一点和冷色/洋红轮廓形成"冷暖对比"。',
    look: '看成片：脸是正常肤色，暗面边缘一道彩色光。试试改轮廓灯的"色相"。',
    lights: {
      key: L({ power: 50, az: 35, height: 2.0, dist: 1.4, cct: 4300 }),
      fill: OFF({ az: -45, height: 1.6, dist: 2 }),
      rim: L({ power: 100, mod: 'reflector', az: -135, height: 1.9, dist: 1.1, rgb: true, hue: 300, sat: 1 }),
    },
    bg: { color: '#1c2230', dist: 2.4 }, cam: { N: 2.8, wb: 4600 },
  },
];
