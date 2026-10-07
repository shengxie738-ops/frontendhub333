# Gladeye 克隆进度

**参考版本冻结**：2026-10-06T17:13–18:01Z，`https://www.gladeye.com`，19 条路由全部 HTTP 200。
**采集环境**：Edge/Chromium + WebGL2（SwiftShader 软件渲染，实测原站 3D 山谷可完整出图），viewport 1440×900 @dpr1。
**工程根**：`gladeye-app/`（Next.js 14.2.5 App Router + TS strict + Tailwind 3.4.1 + three@0.154 + lenis@1.1.20 + gsap@3.12.5）。

## 已确认的技术事实（取代 plan 文档 §1.3 的猜测）
- 首页是 **Three.js r154 / WebGL2 实时 3D**，花草为 **`THREE.Points` GPU 精灵点云**（非 InstancedMesh、非视频、非图片序列）。
- 相机由原站真实资产 `valley/camera-path07.glb`（Blender 烘焙，200 关键帧 / 24fps / 8.29s）驱动；运行时 `PerspectiveCamera(27, aspect, 1, 77)`。
- 首页**无原生滚动**（`html{overflow:hidden}`、`body{position:fixed}`），Lenis 累积 `deltaY` 映射为相机进度。
- 后期链：`RenderPass → UnrealBloomPass(strength .5 / threshold .4 / radius .2) → 自定义噪点 pass`；路由切换另有 **glitch pass**（`uGlitchAmount/uDistortion`）。
- **10 段原站 GLSL 源码逐字提取**（`evidence/shaders/`，含 18KB 花草顶点着色器），全部场景参数逐字提取（`EVIDENCE.md` §3）。
- 字体为 **Epicene**（衬线 300 + 真斜体）与 **Soehne**（无衬线），woff2 原件已取；排版标度（`t-hero`/`t-h1`/`t-p`/`t-meta`…）逐字恢复。
- 原站真实素材已本地化：7 张贴图 + 相机 GLB + 环境音 mp3 + 4 个字体，路径与原站一致（`public/valley/`）。

## 本轮完成
- 取证：`evidence/`（路由清单、19 页 HTML、39 份解析内容、2024 条素材 URL、GLSL、GLB 解码、JS 挖掘报告、34+ 张原站参考截图）。
- 工装：`capture-reference.mjs`、`capture-local.mjs`、`build-comparison-report.mjs`（三联对照 + 黑屏/降级/尺寸失配自动标记）、`extract-*.mjs`、`mine-chunks.mjs`。
- 代码：`ValleyScene.ts`（1128 行）、home 组件群、shell（Header/Menu/Footer/Button/RandomFlower/icons）、theme/motion 库、tokens/typography/components/keyframes CSS、`projects.json`、about/contact/careers 三页与 48 张素材。
- 入口：`layout.tsx`、`page.tsx` 已接线（ThemeProvider + MenuProvider + SiteHeader + HomeHero）。

## 当前最重要的 3 个差异 / 未完成项
1. **集成未验证**：`npx tsc --noEmit` 与 `npm run build` 尚未在全量文件到位后跑通；两个 builder 代理撞轮次上限留下半成品（shell、info 三页）。
2. **首页构图未对照**：3D 布点/相机/后期需与原站 34 张参考截图逐项校准（尤其暗部负空间、V 形花草簇轮廓、前景虚化、暗角强度）。
3. **内容页视觉深度未 QA**：`/work` 与案例页的版式、图片裁切、主题（非全黑底）需逐屏比对。

## 阻塞
- 无外部阻塞。素材许可状态待记录（`docs/asset-rights.md` 待写）。
- 真实 GPU 帧率未测（当前采集为软件渲染环境，已在 `_capture-environment.json` 标注）。

## 下轮只需读取
`docs/research/gladeye/EVIDENCE.md`、本文件、`gladeye-app/src/**`、`gladeye-app/docs/design-references/gladeye/`。

## 下一步动作与验收
1. 等 3D / work 两个 builder 代理收尾 → 主对话跑 `tsc` + `build`，修编译错误。
2. `npm run dev` + `capture-local.mjs` → `build-comparison-report.mjs` 生成三联对照，按 `meanAbsDiff` 排序取前 3 个差异修复。
3. 迭代 8 轮，每轮记录 `reports/iterations/iteration-NN.md`。
