// 用法：DEEPSEEK_API_KEY=sk-... node scripts/test-analyze.mjs 图片1 [图片2 ...]
// 直接调用网站同一套提示词和请求代码，打印 AI 返回结果和耗时
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { analyzePhoto, PROVIDERS } from '../src/analyze.js';

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error('请设置环境变量 DEEPSEEK_API_KEY');

for (const file of process.argv.slice(2)) {
  const mime = extname(file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  const dataURL = `data:${mime};base64,${readFileSync(file).toString('base64')}`;
  const t = Date.now();
  try {
    const ai = await analyzePhoto(dataURL, { ...PROVIDERS.deepseek, apiKey });
    console.log(`\n===== ${file}  (${((Date.now() - t) / 1000).toFixed(1)}s)\n${JSON.stringify(ai, null, 2)}`);
  } catch (e) {
    console.log(`\n===== ${file}  失败：${e.message}`);
  }
}
