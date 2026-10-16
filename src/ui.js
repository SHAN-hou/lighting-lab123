import * as P from './physics.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c != null && el.append(c));
  return el;
};

const azName = (v) => {
  const a = Math.abs(v);
  const side = a < 8 || a > 172 ? '' : v > 0 ? '画面右侧 · ' : '画面左侧 · ';
  const where = a < 8 ? '正前方' : a < 65 ? '侧前方' : a <= 105 ? '正侧面' : a <= 172 ? '侧后方' : '正后方';
  return side + where;
};
const cctName = (k) => (k < 3300 ? '暖黄 · 像烛光/钨丝灯' : k < 4500 ? '暖白' : k < 6000 ? '日光白' : k < 7500 ? '冷白 · 像阴天' : '偏蓝 · 像蓝天阴影');

export function buildPanel(root, state, { onChange, applyPreset, PRESETS }) {
  const updaters = [];
  const reg = (fn) => (updaters.push(fn), fn);

  const row = (label, tip, control, valueEl) =>
    h('div', { class: 'row' },
      h('div', { class: 'row-head' }, h('label', {}, label), valueEl || ''),
      control,
      tip ? h('p', { class: 'tip' }, tip) : '');

  const range = ({ label, tip, min, max, step, get, set, fmt, cls = '', meter = false }) => {
    const val = h('span', { class: 'val' });
    const input = h('input', { type: 'range', min, max, step, class: cls });
    input.addEventListener('input', () => { set(+input.value); val.textContent = fmt(get()); onChange({ meter }); });
    reg(() => { input.value = get(); val.textContent = fmt(get()); });
    return row(label, tip, input, val);
  };

  const list = ({ label, tip, values, get, set, fmt }) => {
    const idxOf = () => {
      const v = get();
      let bi = 0;
      values.forEach((x, i) => { if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(values[bi] / v))) bi = i; });
      return bi;
    };
    return range({ label, tip, min: 0, max: values.length - 1, step: 1, get: idxOf, set: (i) => set(values[i]), fmt: (i) => fmt(values[i]) });
  };

  const seg = ({ label, tip, options, get, set }) => {
    const tipEl = h('p', { class: 'tip' });
    const btns = options.map(([v, text]) => h('button', { type: 'button', onclick: () => { set(v); onChange(); refresh(); } }, text));
    reg(() => {
      btns.forEach((b, i) => b.classList.toggle('on', options[i][0] === get()));
      const o = options.find((x) => x[0] === get());
      tipEl.textContent = typeof tip === 'function' ? tip(get()) : tip || '';
      tipEl.style.display = tipEl.textContent ? '' : 'none';
      return o;
    });
    return h('div', { class: 'row' }, h('div', { class: 'row-head' }, h('label', {}, label)), h('div', { class: 'seg' }, btns), tipEl);
  };

  // ---------- 预设 ----------
  const descEl = h('div', { class: 'preset-desc' });
  const presetBtns = PRESETS.map((p) =>
    h('button', { type: 'button', class: 'preset', onclick: () => applyPreset(p) }, h('b', {}, p.name), h('small', {}, p.tag)));
  reg(() => {
    PRESETS.forEach((p, i) => presetBtns[i].classList.toggle('on', p.id === state.presetId));
    const p = PRESETS.find((x) => x.id === state.presetId);
    descEl.replaceChildren(...(p ? [
      h('p', {}, p.desc),
      h('p', {}, h('em', {}, '怎么摆：'), p.how),
      h('p', {}, h('em', {}, '怎么看：'), p.look),
    ] : [h('p', { class: 'muted' }, '你已经在自由调整了。随时可以点上面的预设重新开始。')]));
  });
  root.append(h('section', { class: 'card' },
    h('h3', {}, '一键预设 ', h('small', {}, '杂志常用布光，点一下看效果')),
    h('div', { class: 'preset-grid' }, presetBtns), descEl));

  const touched = () => { state.presetId = null; };

  // ---------- 灯 ----------
  for (const [id, spec] of Object.entries(P.LIGHT_SPECS)) {
    const L = () => state.lights[id];
    const mut = (fn) => (v) => { fn(v); touched(); };
    const onBox = h('input', { type: 'checkbox', class: 'switch' });
    onBox.addEventListener('click', (e) => e.stopPropagation());
    onBox.addEventListener('change', () => { L().on = onBox.checked; touched(); onChange(); refresh(); });
    reg(() => { onBox.checked = L().on; });

    const body = h('div', { class: 'card-body' });
    body.append(h('p', { class: 'spec-desc' }, spec.desc,
      h('span', { class: 'spec-num' }, `参数：${spec.watt}W · ${spec.rgb ? `${spec.cct[0]}–${spec.cct[1]}K + 全彩` : `${spec.cct[0]}–${spec.cct[1]}K`} · ${spec.ref === 'bare' ? '裸灯' : '带罩'} 1 米照度 ${spec.lux1m} lux`)));

    body.append(range({
      label: '亮度（调光）', min: 1, max: 100, step: 1,
      get: () => L().power, set: mut((v) => (L().power = v)),
      fmt: (v) => `${v}% · 约 ${Math.round((spec.watt * v) / 100)}W`,
      tip: '灯上的调光旋钮。亮度减一半，相当于画面暗"1 档"。',
    }));

    const cctRow = range({
      label: '色温', min: spec.cct[0], max: spec.cct[1], step: 50, cls: 'cct-track',
      get: () => L().cct, set: mut((v) => (L().cct = v)),
      fmt: (v) => `${v}K · ${cctName(v)}`,
      tip: '光的"冷暖"。数字越小越黄越暖，越大越蓝越冷。5600K 左右是标准日光白。',
    });
    if (spec.rgb) {
      body.append(seg({
        label: '灯光模式', options: [[false, '色温（白光）'], [true, 'RGB 全彩']],
        get: () => L().rgb, set: mut((v) => (L().rgb = v)),
        tip: (v) => (v ? '全彩模式：可以打出任意颜色。注意饱和度越高、亮度越低（只有部分彩色灯珠在亮）。' : ''),
      }));
      const hueRow = range({
        label: '色相（什么颜色）', min: 0, max: 360, step: 1, cls: 'hue-track',
        get: () => L().hue, set: mut((v) => (L().hue = v)), fmt: (v) => `${v}°`,
      });
      const satRow = range({
        label: '饱和度（颜色有多浓）', min: 0, max: 100, step: 1,
        get: () => Math.round(L().sat * 100), set: mut((v) => (L().sat = v / 100)), fmt: (v) => `${v}%`,
      });
      body.append(cctRow, hueRow, satRow);
      reg(() => {
        cctRow.style.display = L().rgb ? 'none' : '';
        hueRow.style.display = satRow.style.display = L().rgb ? '' : 'none';
      });
    } else body.append(cctRow);

    body.append(seg({
      label: '灯前附件（决定光的软硬）',
      options: Object.entries(P.MODIFIERS).map(([k, m]) => [k, m.label]),
      get: () => L().mod, set: mut((v) => (L().mod = v)),
      tip: (v) => P.MODIFIERS[v].tip,
    }));

    if (id === 'rim') {
      body.append(seg({
        label: '照向哪里', options: [['face', '照人物'], ['bg', '照背景']],
        get: () => L().target, set: mut((v) => (L().target = v)),
        tip: (v) => (v === 'bg' ? '灯转过去打背景纸，用来提亮背景或在背景上打出光斑/彩色。' : '灯始终对准人的脸。'),
      }));
    }

    body.append(
      range({
        label: '方位角（绕着人转）', min: -180, max: 180, step: 5,
        get: () => L().az, set: mut((v) => (L().az = v)),
        fmt: (v) => `${v}° · ${azName(v)}`,
        tip: '从相机方向看：0° = 和相机同一边（正面），±90° = 人的正侧面，±180° = 人的正后方。',
      }),
      range({
        label: '灯的高度（离地）', min: 0.3, max: 3, step: 0.05,
        get: () => L().height, set: mut((v) => (L().height = v)),
        fmt: (v) => { const d = Math.round((v - P.FACE.y) * 100); return `${v.toFixed(2)}m · ${d === 0 ? '和脸一样高' : d > 0 ? `比脸高 ${d}cm` : `比脸低 ${-d}cm`}`; },
        tip: '人脸约 1.6 米高。灯越高，鼻子、下巴的影子越往下拉长；低于脸会很诡异（"恐怖片光"）。',
      }),
      range({
        label: '水平距离', min: 0.2, max: 4, step: 0.05,
        get: () => L().dist, set: mut((v) => (L().dist = v)),
        fmt: (v) => `${v.toFixed(2)}m`,
        tip: '距离翻倍，照到脸上的光只剩 1/4（平方反比定律）。柔光箱离得越近，光越柔。',
      }),
    );

    const det = h('details', { class: 'card light' },
      h('summary', {}, h('i', { class: 'dot', style: `--c:${spec.color}` }), h('b', {}, spec.label),
        h('small', {}, `${spec.watt}W ${spec.rgb ? 'RGB' : '双色温'}`), onBox),
      body);
    det.open = id === 'key';
    root.append(det);
  }

  // ---------- 背景 ----------
  const swatches = ['#f2f2f2', '#c9c3bb', '#9a9a9a', '#6e6e6e', '#2e2e2e', '#121212', '#5d7488', '#2f4a3f', '#6b2230', '#1c2230'];
  const colorInput = h('input', { type: 'color' });
  colorInput.addEventListener('input', () => { state.bg.color = colorInput.value; touched(); onChange(); refresh(); });
  const swBtns = swatches.map((c) => h('button', { type: 'button', class: 'sw', style: `--c:${c}`, title: c, onclick: () => { state.bg.color = c; touched(); onChange(); refresh(); } }));
  reg(() => { colorInput.value = state.bg.color; swBtns.forEach((b, i) => b.classList.toggle('on', swatches[i] === state.bg.color)); });
  root.append(h('details', { class: 'card' },
    h('summary', {}, h('i', { class: 'dot', style: '--c:#999' }), h('b', {}, '背景'), h('small', {}, '背景纸颜色与距离')),
    h('div', { class: 'card-body' },
      row('背景纸颜色', '同一张背景纸，打光多少会让它看起来更亮或更暗：白纸不打光也会变灰，灰纸打强光也能接近白。', h('div', { class: 'swatches' }, swBtns, colorInput)),
      range({
        label: '人到背景的距离', min: 0.8, max: 4, step: 0.05,
        get: () => state.bg.dist, set: (v) => { state.bg.dist = v; touched(); }, fmt: (v) => `${v.toFixed(2)}m`,
        tip: '背景离人越远，溢到背景上的光越少，背景越暗，人的影子也越不容易落在背景上。',
      }))));

  // ---------- 相机 ----------
  const cam = state.cam;
  root.append(h('details', { class: 'card', open: '' },
    h('summary', {}, h('i', { class: 'dot', style: '--c:#e8e8e8' }), h('b', {}, '相机'), h('small', {}, '同样的光，相机设置不同，照片亮度也不同')),
    h('div', { class: 'card-body' },
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'primary', onclick: () => { onChange({ meter: true }); refresh(); } }, '一键测光'),
        h('button', { type: 'button', onclick: () => { const k = state.lights.key; cam.wb = Math.round(k.cct / 100) * 100; onChange(); refresh(); } }, '白平衡 = 主灯色温')),
      h('p', { class: 'tip' }, '"一键测光"会保持你选的光圈不动，自动调快门和 ISO，让人脸曝光正常——相当于摄影师拿测光表对着脸测一下。'),
      seg({ label: '成片色彩', options: [[false, '彩色'], [true, '黑白']],
        get: () => cam.bw, set: (v) => (cam.bw = v),
        tip: (v) => (v ? '黑白片只看明暗：更容易看清光比、阴影形状和光的软硬，很多杂志人像都用黑白。' : '') }),
      list({ label: '光圈', values: P.APERTURES, get: () => cam.N, set: (v) => (cam.N = v), fmt: (v) => `f/${v}`,
        tip: '镜头的"开口"。f 后面数字越小，开口越大、照片越亮；f/2.8 比 f/4 亮 1 档。（真实相机还会影响背景虚化，这里未模拟）' }),
      list({ label: '快门', values: P.SHUTTERS, get: () => cam.t, set: (v) => (cam.t = v), fmt: P.fmtShutter,
        tip: '感光的时间。时间翻倍，进光翻倍。用持续灯手持拍摄，最好不慢于 1/125 秒，否则容易糊。' }),
      list({ label: 'ISO（感光度）', values: P.ISOS, get: () => cam.iso, set: (v) => (cam.iso = v), fmt: (v) => `ISO ${v}`,
        tip: '相机的"灵敏度"。数值翻倍亮度翻倍，但噪点（颗粒感）变多——成片上会模拟出来。' }),
      range({ label: '白平衡', min: 2500, max: 10000, step: 100, cls: 'cct-track wb', get: () => cam.wb, set: (v) => (cam.wb = v), fmt: (v) => `${v}K`,
        tip: '告诉相机"什么颜色算白"。和灯的色温设成一样，肤色就正常；比灯高 → 照片偏黄偏暖；比灯低 → 照片偏蓝偏冷。' }),
    )));

  function refresh() { updaters.forEach((f) => f()); }
  refresh();
  return { refresh };
}

// ---------- 数据读数 ----------
const ratioName = (r) => (r < 1.6 ? '很平很柔 · 高调/美妆' : r < 2.5 ? '柔和自然' : r < 4.5 ? '有立体感 · 杂志常用' : r < 8 ? '强烈 · 有戏剧感' : '非常强烈 · 低调/分割');
const fmtLux = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v >= 10 ? 0 : 1));

export function renderReadout(el, state, a, hist) {
  const ids = Object.keys(P.LIGHT_SPECS);
  const maxLux = Math.max(...ids.map((id) => a.per[id].lux), a.bgLux, 1);
  const lightRows = ids.map((id) => {
    const s = P.LIGHT_SPECS[id], p = a.per[id], on = state.lights[id].on;
    return `<div class="lux-row ${on ? '' : 'off'}"><i class="dot" style="--c:${s.color}"></i><span class="n">${s.label}</span>
      <span class="bar"><b style="width:${(p.lux / maxLux) * 100}%;background:${s.color}"></b></span>
      <span class="v">${on ? `${fmtLux(p.lux)} lux` : '关'}</span><span class="d">${p.dist.toFixed(2)}m</span></div>`;
  }).join('');

  const ev = a.ev;
  const evClamped = Math.max(-3, Math.min(3, isFinite(ev) ? ev : -3));
  const evText = !isFinite(ev) ? '一片漆黑' : Math.abs(ev) <= 0.35 ? '曝光正常' : ev > 0 ? `偏亮 +${ev.toFixed(1)} 档` : `偏暗 ${ev.toFixed(1)} 档`;
  const evCls = Math.abs(ev) <= 0.35 ? 'ok' : Math.abs(ev) <= 1 ? 'warn' : 'bad';

  const ratio = a.ratio;
  const ratioText = isFinite(ratio) ? `${ratio.toFixed(1)} : 1` : '∞ : 1';

  const tips = [];
  const { cam, lights } = state;
  if (ev > 0.7) tips.push('过曝：降低灯的亮度、把灯拉远、缩小光圈（f 数字调大）或降低 ISO。');
  if (ev < -0.7 && isFinite(ev)) tips.push('欠曝：调亮灯、灯靠近一点、开大光圈（f 数字调小）、放慢快门或提高 ISO。也可以直接点"一键测光"。');
  if (cam.t > 1 / 60) tips.push('快门慢于 1/60 秒，手持很容易拍糊，建议上三脚架或提高 ISO。');
  if (cam.iso >= 3200) tips.push('ISO 很高，画面颗粒感明显（看成片上的噪点）。');
  const key = lights.key, fill = lights.fill, rim = lights.rim;
  if (key.on && Math.abs(key.cct - cam.wb) >= 700)
    tips.push(`主灯 ${key.cct}K、白平衡 ${cam.wb}K → 皮肤会${key.cct < cam.wb ? '偏黄偏橙（暖）' : '偏蓝偏青（冷）'}。点"白平衡 = 主灯色温"可还原肤色。`);
  if (key.on && fill.on && Math.abs(key.cct - fill.cct) >= 1000)
    tips.push('主灯和辅灯色温相差较大，脸的亮面和暗面会是两种颜色（如果是故意做冷暖对比，那就对了）。');
  if (key.on && fill.on && a.per.fill.lux > a.per.key.lux) tips.push('辅灯照到脸上的光比主灯还亮——主次颠倒了，影子会变得混乱。');
  if (rim.on && rim.target === 'face' && Math.abs(rim.az) < 100) tips.push('轮廓灯跑到人物前面了，它就变成了另一盏"主灯"。轮廓灯一般放在 ±120°~170°。');
  ids.forEach((id) => { if (lights[id].on && a.per[id].dist < 0.75) tips.push(`${P.LIGHT_SPECS[id].label}离脸很近（${a.per[id].dist.toFixed(2)}m），挪动一点点亮度就变化很大。`); });
  if (hist && hist.clip > 0.03) tips.push(`成片约 ${(hist.clip * 100).toFixed(0)}% 的区域已经"死白"，那里的细节找不回来了。`);
  if (!tips.length) tips.push('一切正常。试着只改一个参数，对比成片前后的变化，这是学布光最快的方法。');

  const bgStops = a.bright > 0 && a.bgLux > 0 ? Math.log2(a.bgLux / a.bright) : -Infinity;
  const bgText = !isFinite(bgStops) ? '几乎没有光' : Math.abs(bgStops) < 0.3 ? '和脸差不多亮' : bgStops > 0 ? `比脸亮 ${bgStops.toFixed(1)} 档` : `比脸暗 ${(-bgStops).toFixed(1)} 档`;

  el.innerHTML = `
    <div class="ro-card"><h4>照到脸上的光 <small>照度 · 灯到脸距离</small></h4>${lightRows}
      <div class="lux-sum">测光表读数 <b>${fmtLux(a.front)} lux</b> · 背景 ${fmtLux(a.bgLux)} lux（${bgText}）</div></div>
    <div class="ro-card"><h4>光比 <small>亮面 : 暗面</small></h4><div class="big">${ratioText}</div>
      <div class="sub">${isFinite(ratio) ? ratioName(ratio) : '暗面完全没有光'} · 亮面在${a.brightSide}</div>
      <div class="sub muted">1档≈2:1，2档≈4:1，3档≈8:1</div></div>
    <div class="ro-card"><h4>测光表 <small>相对"正确曝光"</small></h4>
      <div class="meter"><div class="scale">${[-3, -2, -1, 0, 1, 2, 3].map((v) => `<span>${v > 0 ? '+' + v : v}</span>`).join('')}</div>
      <div class="needle ${evCls}" style="left:${((evClamped + 3) / 6) * 100}%"></div></div>
      <div class="sub ${evCls}">${evText}</div>
      <canvas class="hist" width="192" height="44"></canvas><div class="sub muted">直方图：左=暗部 右=亮部${hist ? ` · 死白 ${(hist.clip * 100).toFixed(1)}%` : ''}</div></div>
    <div class="ro-card tips"><h4>小贴士</h4><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;

  if (hist) {
    const c = el.querySelector('.hist'), g = c.getContext('2d');
    const max = Math.max(...hist.bins.slice(1, -1), 1);
    g.fillStyle = 'rgba(255,255,255,.75)';
    const bw = c.width / hist.bins.length;
    hist.bins.forEach((b, i) => { const hh = Math.min(1, b / max) * c.height; g.fillRect(i * bw, c.height - hh, bw - 0.5, hh); });
  }
}

export function initHelp() {
  const dlg = document.getElementById('help');
  document.getElementById('helpBtn').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  if (!localStorage.getItem('seenHelp') && !location.search.includes('nohelp')) { dlg.showModal(); localStorage.setItem('seenHelp', '1'); }
}
