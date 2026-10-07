# Iteration 01 — 基线与首轮量化对照

Reference version: gladeye.com，2026-10-06T17:13–18:01Z 冻结，19 条路由全部 200
Candidate commit: 无 git（工作区非仓库）；对应 `gladeye-app/src` 于 18:16Z 的状态
Viewport / DPR / renderer: 1440×900 @dpr1，Edge/Chromium + **SwiftShader (Vulkan)** WebGL2
—— 两侧同一环境：参考集 `homeProbe.rendererString = ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`，克隆同参数采集。

## 本轮问题（按影响排序）

### 1. `home__scroll-x10` 旅程纵深不匹配（P1，最大项）
- 证据：meanAbsDiff **47.49**；参考 luma **65.23**/σ 69.28，克隆 luma **36.18**/σ 42.47。
- 目视：原站镜头已下潜贴近草丛、花草横贯下 2/3、暗部负空间上移、左下有巨大失焦前景光斑；克隆仍是对称 V 形、相机停在草丛外、单朵花偏大偏疏、无近场巨点。
- 中间态同向偏离：`x1` 参考 41.55 / 克隆 55.76（克隆早期反而偏亮）。**克隆亮度先高后低，原站持续走高**。
- 原因假设（已交专职代理逐条验证，一次只改一条）：
  1. `uContainerPos` 未随 `cameraContainer` 世界坐标在"相机更新后、渲染前"写入 → `pSize = size/abs(pos.z-uContainerPos.z)` 分母错，同时解释"点偏大"与"无近场巨点"。
  2. 花草场 z 跨度未覆盖/超出相机路径（路径 z: 0 → -500）。
  3. `aValleySide`/`offsetDirection` 符号或中心曲线朝向错 → V 形保持对称而无下潜感。
  4. 场被缩放导致 `uFlowerBloomDistance:24`/`uLeafGrowDistance:55` 对应的屏幕深度距离失配 → 近场点 growth=0。
  5. 进度→帧映射未用 `clip.duration = 8.291666`。
- 修改范围：仅 `src/experience/**`。**禁止改 EVIDENCE.md §3 的原站常数与 §6 的 GLSL 原件**。

### 2. 静止帧已达标（无需改动，作为回归护栏）
- `home__01_stable` meanAbsDiff **31.85**，亮度几乎完全吻合（参考 41.37/42.83 vs 克隆 41.43/44.12）。
- 结论：曝光、雾、bloom、暗角、后期基线正确。**后续任何改动都不得让此项变差**。
- 剩余 31.85 的主要成分是程序化布点的逐朵位置不可能与原站 PRNG 一致 —— 按 plan §6.2 只要求宏观轮廓、主色花簇位置与空间节奏一致，这一条已达成。

### 3. `/about`、`/contact`、`/careers` 运行时 500（P0）
- 根因链（逐个实测确认）：
  a. `src/styles/typography.css` 用了 `@layer base`，但该文件被 `@import` 后由 css-loader **单独**编译，其中没有 `@tailwind base` → 全站 CSS 编译失败。已改为普通 CSS。
  b. `gladeye-info-tokens.module.css` 把 25K 字符的**全局** CSS（主题变量、`.t-*`、`.ui-*`、`:root`）包在 `:global { }` 里当成 CSS Module → `Selector ":global" is not pure`。已整体提升为 `src/styles/info-tokens.css` 并接进 `globals.css`，同时删除 3 处副作用 import。
  c. `BlurImage` 带 `onLoad` 却是 Server Component → `Event handlers cannot be passed to Client Component props`。已加 `'use client'`。
  d. 现存：`RichInline.tsx:18` `Cannot read properties of undefined (reading 'map')` —— 数据形状与组件期望不匹配（前一位代理被中断的尾巴）。已交专职代理以 JSON 为准修复。
- 附带修复：`src/experience/glsl/*.glsl` 无 loader → 在 `next.config.mjs` 加 `test:/\.glsl$/, type:'asset/source'`，删除 12 个 `.glsl.ts` 手工双胞胎，改为单一真源 + `verify-scene-params.mjs` 逐字节比对 `evidence/shaders/`。

## 验证
- `npx tsc --noEmit`：本轮从 **9 错误 → 1 错误**（剩余 1 个在 `src/experience/lib/camera-path.ts` 重复标识符，属在建代理范围，未代改）。
- `curl` 状态码（3002 端口）：`/` 200；`/about` `/contact` `/careers` 500（修复中）；`/work`、`/work/[slug]` 尚未建立（代理在建）。
- 截图：`docs/candidates/gladeye/r01__*.png`（25 张）；三联叠图 `reports/comparisons/*__overlay.png`；指标 `reports/comparisons/report-r01.{md,json}`。
- 工装缺陷：`capture-local.mjs` 在 `/about` 500 时整轮中断、未写出 `r01__run.json` → 已加 `safeGoto` 容错。

## 已达标项（本轮确认）
- **菜单**：与 `menu__open.png` 并排目视**近乎像素级一致** —— 深绿全屏、`Close` 胶囊、Home(斜体=当前路由)/Work/About/Ventures/Careers/Contact 顺序与字体、页脚四栏（Request a proposal / Follow us: Instagram|LinkedIn|X / Join the team / Find us + ↗）、`© Gladeye 2026` 全部吻合。原站菜单条目真值已冻结为证据（plan 文档原先并不知道有 Ventures 与 X）。
- **首页外壳**：Gladeye 字标、Menu 胶囊、RandomFlower 槽位、音频按钮、`Explore our work` 白色胶囊位置正确。
- **3D 基线**：WebGL2 + three r154 实时点云山谷可渲染，构图/负空间/花色簇/暗角/颗粒感到位。

## 结论
- **接受**：typography.css 去 `@layer`、info-tokens 提升为全局、BlurImage 客户端化、GLSL raw 导入单一真源、capture 容错。
- **回退**：无。
- **需重新取证**：右上角花池 7 朵 SVG —— 原站每次加载随机取一（`RandomFlower` 在 `useLayoutEffect` 里选池 + AnimatePresence `.25s` 淡入淡出），故参考截图与克隆显示不同花形**不是缺陷**；克隆目前固定池 index 0。池内 7 条 path 在 `layout-3ab4cf37f3ac757c.js`（该 chunk 有 18 条 `d:"M`），需按数组边界精确切分才能全部还原 → 记为待办，不影响正确性。

## 下轮最多 3 个问题
1. `scroll-x10` 旅程纵深（上面 5 条假设逐条验证，主指标：克隆 luma 36.18 → 参考 65.23）。
2. `/about` `/contact` `/careers` 渲染到 200 且标题/问候语/媒体条目逐项对齐证据。
3. `/work` 与 14 个 `/work/[slug]` 建立并 200，案例 block 不静默丢内容。
