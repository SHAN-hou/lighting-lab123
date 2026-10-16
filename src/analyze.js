// 调用视觉大模型分析参考图的布光（OpenAI 兼容接口，浏览器直连）

export const PROVIDERS = {
  deepseek: { label: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-flash' },
  custom: { label: '其他（OpenAI 兼容接口）', baseURL: '', model: '' },
};

const KEY = 'aiSettings';
export function loadSettings() {
  const s = JSON.parse(localStorage.getItem(KEY) || '{}');
  return { provider: 'deepseek', ...PROVIDERS.deepseek, apiKey: '', ...s };
}
export const saveSettings = (s) => localStorage.setItem(KEY, JSON.stringify(s));

// 缩小到最长边 1280px 的 JPEG，省流量也省钱
export function fileToDataURL(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('图片读取失败，请换一张 JPG/PNG 图片'));
    img.src = URL.createObjectURL(file);
  });
}

const PROMPT = `你是资深人像摄影布光师。请分析这张参考照片的布光，并换算到一个虚拟摄影棚里。只输出 JSON。

【虚拟摄影棚的坐标约定】
- 人脸高度 1.6 米，相机在人物正前方。
- 方位角 az（度）：从相机这边看，灯绕人物水平旋转的角度。0 = 灯和相机同方向、正对人脸；+90 = 观看照片时画面右侧的正侧面；-90 = 画面左侧正侧面；±180 = 人物正后方。"画面右侧"指你看这张照片时的右边，不是模特自己的右手边。
- 即使模特侧身或转头，也一律以相机为准给出方位角。
- height：灯比脸高多少米（-1.0 ~ +1.4），0 = 和脸一样高。

【可用的灯】主灯（双色温 2700-6500K）、辅灯（双色温 2700-6500K）、轮廓灯（2500-10000K 或 RGB 全彩，可以照人物边缘，也可以转去照背景）。

【判断依据】请综合观察：眼睛里的眼神光位置、鼻子影子的方向与长度（蝴蝶光/环形光/伦勃朗光/分割光）、脸颊明暗交界线的位置和软硬、下巴下方的影子、头发和脸部边缘有无亮边、背景的亮度与渐变、整体色调和色温倾向。

【输出 JSON 格式】
{
  "summary": "一句话概括这张图的布光（中文，给摄影小白看）",
  "pattern": "蝴蝶光|环形光|伦勃朗光|分割光|平光|侧逆光|其他",
  "bw": true/false（是否黑白照片）,
  "key": { "az": 数字, "height": 数字, "softness": "hard|medium|soft", "spill_control": true/false（光是否被严格控制、背景几乎没被照到）, "cct": 色温K },
  "fill": { "on": true/false, "az": 数字, "height": 数字, "cct": 色温K },
  "ratio": 数字（脸部亮面 : 暗面 的亮度比，例如 1.5、3、8；暗面全黑填 16）,
  "rim": { "on": true/false, "az": 数字, "height": 数字, "target": "face|bg", "rgb": true/false, "hue": 0-360（rgb 为 true 时）, "sat": 0-1, "cct": 色温K, "stops": 数字（轮廓亮边比脸的亮面亮几档，-2 ~ +2，0 = 一样亮）},
  "background": { "paper": "#RRGGBB（推测背景纸本身的颜色，白/灰/黑/彩色）", "stops_vs_face": 数字（背景比脸部亮面亮几档，负数表示更暗，-6 ~ +2）},
  "reasons": ["3-5 条判断理由，用小白能听懂的话，例如：眼神光在瞳孔右上方，说明主灯在画面右侧偏高的位置"],
  "confidence": "high|medium|low"
}
要求：数字都用阿拉伯数字；不要输出 JSON 以外的任何文字。`;

export async function analyzePhoto(dataURL, settings, signal) {
  if (!settings.apiKey) throw new Error('请先在"AI 设置"里填写 API 密钥');
  const base = settings.baseURL.replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataURL } },
          ],
        }],
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('网络连接失败，请检查网络或接口地址');
  }
  if (!res.ok) {
    const msg = { 401: 'API 密钥不正确', 402: '账户余额不足，请到 DeepSeek 平台充值', 429: '请求太频繁，请稍后再试' }[res.status];
    const detail = await res.text().catch(() => '');
    throw new Error(msg || `AI 服务返回错误 ${res.status}：${detail.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 没有返回有效的分析结果，请重试');
  return JSON.parse(m[0]);
}
