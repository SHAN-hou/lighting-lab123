# 布光练习室

Vite + Three.js 纯前端布光模拟器（人物杂志）。

- 开发：`npm run dev`（带 `--host`，手机同局域网可访问）
- 构建：`npm run build` → `dist/`（`base: './'`，可放任意静态托管）
- 调试参数：`?preset=<id>` 直接加载预设，`?nohelp` 跳过新手弹窗，`?mock`（仅开发模式）模拟一次 AI 分析结果（需本地 `src/mock-ref.png`，已 gitignore）
- 发布：推送到 `main` 后由 `.github/workflows/deploy.yml` 自动部署 GitHub Pages（仓库 Settings → Pages → Source 选 GitHub Actions）
- AI 分析：纯前端，浏览器直连 DeepSeek（`deepseek-flash`，支持看图，已验证允许跨域），密钥由用户填在 localStorage；`src/analyze.js` 提示词与调用，`src/solve.js` 把 AI 判断按物理模型反推成灯光参数，`src/analyzer-ui.js` 界面
- 无头截图：Edge `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=20000 --screenshot=...`（模型加载前画面为黑属正常）

结构：`src/physics.js`（照度/色温/曝光）、`src/presets.js`（预设+说明）、`src/ui.js`（面板/读数）、`src/main.js`（场景渲染）。
照度按"1 米、100%、正对"计算，平方反比；成片曝光 = π·t·ISO/(250·N²)。
