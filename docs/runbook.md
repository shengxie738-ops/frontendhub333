# Runbook — Gladeye 桌面端高保真复刻

工程根：`gladeye-app/`（Next.js 14.2.5 App Router · TypeScript strict · Tailwind 3.4.1 · three@0.154 · lenis@1.1.20 · gsap@3.12.5）

## 1. 安装与运行

```bash
cd gladeye-app
npm install                  # 锁文件 package-lock.json
npm run dev                  # 默认 http://localhost:3000（被占用时会顺延端口）
npm run build && npm start   # 生产构建与运行
```

素材体积约 424 MB（`public/valley` 5 MB + `public/sites/gladeye` 419 MB，含 5 个精选封面视频）。
首次克隆仓库后若缺素材，见 §4 的再生成命令。

## 2. 取证与验收命令

全部在**仓库根**（`gladeye-app/` 的上一级）或标注的目录内运行。

| 命令 | 作用 | 失败含义 |
|---|---|---|
| `node scripts/extract-shaders.mjs` | 从原站 bundle 逐字提取 GLSL → `evidence/shaders/` | 提取数 ≠ 10 |
| `node scripts/extract-camera-path.mjs evidence/source-assets/valley/camera-path07.glb gladeye-app/src/experience/data/camera-path07.json` | 解码相机路径 200 关键帧 | 帧数 ≠ 200 或 duration ≠ 8.291666 |
| `node scripts/extract-content.mjs` | 解析 `evidence/source-pages/*.html` → `evidence/content/*.json` | 路由数与清单不符 |
| `node scripts/mine-chunks.mjs` | 挖掘原站 JS/CSS 关键片段 → `evidence/js-mine.txt` | — |
| `node scripts/inspect-glb.mjs <glb>` | 打印 glTF 结构 | — |
| `node scripts/audit-work-content.mjs` | `/work` 内容对照原站：slug 覆盖、精选顺序、标题逐字 | 任一缺失即失败 |
| `node scripts/inspect-videos.mjs public` | 校验 mp4 魔数，抓「HTML 冒充媒体文件」 | 出现 non-mp4 即失败 |
| `cd gladeye-app && node scripts/verify-scene-params.mjs` | 断言场景常数与 GLSL 与 `evidence/` 逐字一致 | 任一漂移即失败 |
| `cd gladeye-app && node scripts/verify-work-content.mjs` | 42 项目：block 非空、媒体非空、标题唯一、nextSlug 有效、**blocks 必须 DOM 验证** | 任一不满足 exit 1 |
| `cd gladeye-app && node scripts/capture-reference.mjs` | 采集原站参考集 → `docs/design-references/gladeye/` | 截图黑屏/降级会被标记 |
| `cd gladeye-app && node scripts/capture-local.mjs` | 采集本地候选集 → `docs/candidates/gladeye/` | 未就绪/黑屏/状态不符 |
| `cd gladeye-app && node scripts/capture-home.mjs` | 首页专用快速采集（含逐帧 probe） | — |
| `cd gladeye-app && node scripts/capture-pages.mjs` | 内容页采集 + DOM 体检（图片/溢出/主题/标题） | — |
| `cd gladeye-app && node scripts/build-comparison-report.mjs` | 三联对照（原站/本地/叠图差异）→ `reports/comparisons/` | 图片引用失效或漏项 |
| `cd gladeye-app && npx tsc --noEmit` | 类型检查 | 任何 error |
| `cd gladeye-app && npm run build` | 生产构建（含类型检查与全部路由静态化） | 任何页面生成失败 |

采集环境变量：`VW/VH`（视口，默认 1440×900）、`LABEL`（产物前缀，每轮必须换新，勿覆盖历史）、`BASE`（本地服务地址）、`ROUTES`/`CASES`/`MARKS`（范围与滚动位）、`HEADED=1`（有头模式）。

## 3. 采集环境必须钉死

原站会按探针环境**静默分档**，所以两侧必须在同一环境采集，否则差值无意义：

- 浏览器：`channel: 'msedge'`，`headless: true`
- WebGL：`--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist`
- 视口 1440×900，`deviceScaleFactor: 1`，`locale: 'en-US'`，`reducedMotion: 'no-preference'`
- 实际渲染器记录在 `docs/design-references/gladeye/_capture-environment.json` 的 `homeProbe.rendererString`
  （当前为 `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`）

⚠️ **软件渲染下首页只有约 2 FPS**，且自动漂移与进度平滑是逐帧项 —— 低帧率会让旅程推进速度失真。任何"帧率达标"的结论都必须换到真实 GPU 重测，不能引用本环境数字。

## 4. 素材再生成

```bash
# /work 与案例图片（631 个文件）
node scripts/download-assets-gladeye-work.mjs
# about / careers 图片（48 个文件）
node scripts/download-assets-gladeye-info.mjs
# 8 个精选封面视频（KINDS 可改，但 166 个正文视频默认不抓，见 docs/asset-rights.md）
cd gladeye-app && node scripts/download-featured-videos.mjs
```
下载器一律校验 HTTP 状态 / Content-Type / 文件魔数 / 非空，**不使用占位图**。
失败与 blocked 记录在 `evidence/asset-report-work.json`、`evidence/asset-report-info.json`、`evidence/video-blocked.json`。

3D 与字体原件不在上述脚本内：它们已在 `evidence/source-assets/`，
复制到 `gladeye-app/public/valley/` 与 `gladeye-app/src/app/fonts/` 即可（路径须与原站一致）。

## 5. 调试与诊断

- 仅非生产构建暴露 `window.__GLADEYE_QA__`：`setTime / setPointer / setProgress / setDispersal / setQuality / waitUntilSettled / probe / containerWorldPosition / getDiagnostics`。
- `getDiagnostics()` 必看字段：`mode`（应为 `live`）、`degraded`、`degradeReasons`、`assetFailures`、`shaderIssues`、`pointCount`、`fps`、`placementMs`、`cameraAnimProgress`、`dispersalProgress`。
- `field-probe.ts` 是 CPU 侧复刻顶点着色器的测量仪器，输出 `minAbsDz`、`Σsize²`、`maxPointSize`、屏上点数 —— 调 3D 前先跑它，不要靠眼睛调参。
- dev 日志里若出现 `Module parse failed ... .glsl`，说明 `next.config.mjs` 的 raw 规则被删了（该文件与 `src/experience/glsl/**` 归主代理独占，多代理并发改过这里会造成全站 500）。

## 6. 已知限制（交付时必须在报告中出现）

1. **真实 GPU 帧率未测**：本环境为软件渲染。
2. **166 个案例正文视频未本地化**（体积 + 第三方 Vimeo 版权），组件回退海报帧；3 个精选封面视频源站返回的是 HTML 错误页，已记为 blocked。
3. **字体许可未确认**：Söhne（Klim）与 Epicene 为商业字体，当前用的是从原站公开 URL 取得的原件本身，可访问 ≠ 有授权。见 `docs/asset-rights.md`。
4. `/contact` 问候语滚动速率与挥手图形为 UNVERIFIED（原站该处由未捕获的 chunk 内代码绘制）。
5. 右上角花朵为原站 7 朵花池随机取一，两侧显示不同花形属正常，非缺陷。
6. 42 个案例中 10 个做了全深度逐屏比对，32 个为抽样比对（深度标注见 `evidence/route-inventory.json`）。

## 7. 不做什么

无真实后端、不连原站表单、不发邮件/订阅、不复制 GTM/GA 埋点、不做移动端版式、不复刻客户网站、不自动部署公网、不推送远端。
