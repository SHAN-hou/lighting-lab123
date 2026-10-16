import * as P from './physics.js';
import { PROVIDERS, loadSettings, saveSettings, fileToDataURL, analyzePhoto } from './analyze.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const side = (az) => (Math.abs(az) < 8 ? '正前方' : Math.abs(az) > 172 ? '正后方' : `画面${az > 0 ? '右' : '左'}侧 ${Math.abs(az)}°`);
const hgt = (h) => { const d = Math.round((h - P.FACE.y) * 100); return d === 0 ? '和脸一样高' : d > 0 ? `比脸高 ${d}cm` : `比脸低 ${-d}cm`; };

export function planLines(state) {
  return Object.entries(P.LIGHT_SPECS).map(([id, spec]) => {
    const l = state.lights[id];
    if (!l.on) return { id, spec, text: '不开' };
    const color = spec.rgb && l.rgb ? `RGB 色相 ${l.hue}°、饱和度 ${Math.round(l.sat * 100)}%` : `${l.cct}K`;
    const aim = l.target === 'bg' ? '，灯头对准背景' : '';
    return { id, spec, text: `${side(l.az)}，${hgt(l.height)}，距离 ${l.dist.toFixed(2)}m，${P.MODIFIERS[l.mod].label}，亮度 ${l.power}%，${color}${aim}` };
  }).concat({ id: 'bg', spec: { label: '背景', color: '#999' }, text: `背景纸 ${state.bg.color}，离人 ${state.bg.dist.toFixed(2)}m` });
}

export function initAnalyzer(root, { state, onResult, onReference }) {
  const card = document.createElement('section');
  card.className = 'card analyzer';
  card.innerHTML = `
    <h3>照片分析布光 <small>上传参考图，AI 告诉你灯怎么摆</small></h3>
    <div class="btn-row">
      <button type="button" class="primary" data-act="pick">选择参考图</button>
      <button type="button" data-act="settings">AI 设置</button>
    </div>
    <input type="file" accept="image/*" hidden>
    <p class="tip">也可以把图片直接拖进来，或者复制后在页面上粘贴（Ctrl+V）。</p>
    <div class="an-status" hidden></div>
    <div class="an-result" hidden></div>`;
  root.prepend(card);

  const input = card.querySelector('input[type=file]');
  const status = card.querySelector('.an-status');
  const result = card.querySelector('.an-result');
  let controller = null, lastImage = null;

  const setStatus = (html, cls = '') => { status.hidden = !html; status.className = `an-status ${cls}`; status.innerHTML = html || ''; };

  async function run(dataURL) {
    lastImage = dataURL;
    onReference(dataURL);
    const settings = loadSettings();
    if (!settings.apiKey) { setStatus('还没有填写 API 密钥。点"AI 设置"填好后，再点"重新分析"。', 'warn'); openSettings(); showRetry(); return; }
    controller?.abort();
    controller = new AbortController();
    setStatus('<span class="spin"></span> AI 正在看图分析光线……通常需要 10–40 秒 <button type="button" data-act="cancel">取消</button>');
    result.hidden = true;
    const mobile = matchMedia('(max-width: 960px)').matches;
    if (mobile) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const ai = await analyzePhoto(dataURL, settings, controller.signal);
      const notes = onResult(ai);
      setStatus('');
      renderResult(ai, notes);
      if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      if (e.name === 'AbortError') setStatus('已取消。');
      else { setStatus(`分析失败：${esc(e.message)}`, 'bad'); showRetry(); }
    }
  }

  function showRetry() {
    result.hidden = false;
    result.innerHTML = '<button type="button" data-act="retry">重新分析</button>';
  }

  function renderResult(ai, notes) {
    const conf = { high: '把握较大', medium: '把握一般', low: '把握较小' }[ai.confidence] || '';
    result.hidden = false;
    result.innerHTML = `
      <p class="an-summary">${esc(ai.summary)}</p>
      <p class="an-tags">${ai.pattern ? `<span>${esc(ai.pattern)}</span>` : ''}${ai.ratio ? `<span>光比约 ${esc(ai.ratio)}:1</span>` : ''}${ai.bw ? '<span>黑白</span>' : ''}${conf ? `<span>${conf}</span>` : ''}</p>
      <h4>灯这样摆（以相机为准）</h4>
      <ul class="plan">${planLines(state).map((p) => `<li><i class="dot" style="--c:${p.spec.color}"></i><b>${p.spec.label}</b>${esc(p.text)}</li>`).join('')}</ul>
      ${ai.reasons?.length ? `<h4>AI 的判断理由</h4><ul>${ai.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${notes.length ? `<h4>自动换算说明</h4><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <details class="raw"><summary>查看 AI 原始结果（排查问题用）</summary><pre>${esc(JSON.stringify(ai, null, 2))}</pre></details>
      <p class="tip">已自动载入下方的灯光参数。对照"参考原图"和"相机成片"，觉得哪里不像可以直接拖滑块微调。</p>
      <button type="button" data-act="retry">重新分析</button>`;
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try { run(await fileToDataURL(file)); } catch (e) { setStatus(esc(e.message), 'bad'); }
  }

  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'pick') input.click();
    else if (act === 'settings') openSettings();
    else if (act === 'cancel') controller?.abort();
    else if (act === 'retry' && lastImage) run(lastImage);
  });
  $('pickBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { handleFile(input.files[0]); input.value = ''; });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); handleFile(item.getAsFile()); }
  });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', (e) => {
    document.body.classList.remove('dropping');
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); handleFile(file); }
  });

  // ---------- 设置对话框 ----------
  const dlg = $('aiDialog');
  const sel = $('aiProvider');
  sel.innerHTML = Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  sel.addEventListener('change', () => {
    const p = PROVIDERS[sel.value];
    if (p.baseURL) { $('aiBase').value = p.baseURL; $('aiModel').value = p.model; }
  });
  function openSettings() {
    const s = loadSettings();
    sel.value = s.provider;
    $('aiBase').value = s.baseURL;
    $('aiModel').value = s.model;
    $('aiKey').value = s.apiKey;
    dlg.showModal();
  }
  $('aiSave').addEventListener('click', () => {
    saveSettings({ provider: sel.value, baseURL: $('aiBase').value.trim(), model: $('aiModel').value.trim(), apiKey: $('aiKey').value.trim() });
  });
  $('aiClear').addEventListener('click', () => {
    $('aiKey').value = '';
    saveSettings({ ...loadSettings(), apiKey: '' });
  });

  return { renderResult, run };
}
