# Iteration 03 — 字体根因修复、页脚接线、/work 首检

Reference: 同前（2026-10-06 冻结集）· Candidate: `gladeye-app/src` 18:56Z · 1440×900 @dpr1 / SwiftShader WebGL2

## 已完成并验证

### 1. 字体从未真正生效（P1，根因级修复）
- 现象（由 info 代理用 `CSS.getPlatformFontsForNode` 证明）：正文实际落在 **Georgia / Arial** 兜底上，不是 Epicene / Soehne。
- 根因：`next/font/local` 把 `--font-epicene` / `--font-soehne` 注入在 **`<body>`** 的类上，而 `src/styles/tokens.css` 在 **`:root`** 就消费 `var(--font-epicene, Epicene)` —— 在 `:root` 处该变量尚未定义，于是永远命中字面量 `Epicene`（系统未安装）→ 回退 Georgia。
- 我的永久修复：把 `fontVariables` 从 `<body>` 移到 **`<html>`**（`src/app/layout.tsx`），使变量在 `:root` 即可见。
- 运行时验证（不靠状态码）：
  - computed `font-family` 现为 `__epicene_f3ccc9, __epicene_Fallback_f3ccc9, Epicene, …` / `__soehne_dfc917, …` —— 已是 next/font 的真实族名。
  - `document.fonts` 已加载：**`__epicene_f3ccc9/300/normal`、`__epicene_f3ccc9/300/italic`、`__soehne_dfc917/300/normal`、`__soehne_dfc917/500/normal`** —— 四个真字面全部到位，**含真斜体**（`regenerative` 与菜单当前项依赖它）。
  - 注：headless Edge 不提供 `CSS.getPlatformFontsForNode`，所以我改用 computed family + FontFaceSet 双证据。

### 2. 页脚从未挂载（P1，我此前漏接）
- `SiteFooter.tsx`（393 行）早已存在，但 `layout.tsx` 里没有渲染它 → 全站缺页脚。
- 修复：新增 `src/components/shell/FooterMount.tsx`，按原站 `showFooter` 语义在 `/` 隐藏、其余路由显示。
- 运行时验证：`footer=true` 于 `/about` `/contact` `/careers` `/work`，`footer=false` 于 `/` ✅；页脚文本含 `Subscribe to our newsletter / Request a proposal / Follow us / Join the team / Find us`。
- 各页 docH 因此增长：`/about` 7739→8639，`/contact` 900→1800，`/careers` →3221。

### 3. GLSL 目录收敛（结束写入战争）
- 真因链：3D 代理**临终前**才把原始 `.glsl` 文件补进目录，它们遮蔽了此前实际生效的 `.glsl.ts` 双胞胎 → 首页从"能渲染"退化为海报（`home__01_stable` meanAbsDiff 31.85 → **94.39**，全部状态被仪器标 `LOW-COLOR-COUNT(fallback?)`）。
- 我的 `.glsl` webpack `asset/source` 规则 + `src/types/glsl.d.ts` + 默认导入是正确方向，但中途我的一次正则替换漏了引号，把 `index.ts` 写坏（24 个错误）。已全部修正。
- 最终形态：raw 规则 + 默认导入 + 双胞胎**同时导出 default**，使 webpack 与 tsc 对同一目录达成一致。`src/experience/glsl/index.ts` 现在 **0 类型错误**。
- 教训（写死进流程）：**"tsc 0 错误"不等于页面能跑**；本次就是类型全绿而页面 500。验收必须以渲染证据为准。

### 4. 首页 3D 恢复并确认（诊断桥实测）
`mode:live`、`degraded:false`、`webgl2:true`、**`pointCount:960000`**、`assetFailures:[]`、`shaderIssues:[]`、`runtimes:1`、`introDone:true`、无 pageerror。
SwiftShader 下 `fps:2`、`placementMs:666` —— 软件渲染所致，非代码缺陷；真实 GPU 性能仍未验（硬门槛缺口，见 §6）。

### 5. 路由离场消散过渡：已存在，无需我补
`src/hooks/useFlowerValley.ts:176` → `if (pathname !== '/') experience.startExitTransition()`；`startHoverTransition/stopHoverTransition` 亦已接。原站 glitch pass 在 composer 内。

## 旅程指标 r01 → r03（同环境同状态）
| 状态 | 参考 luma | r01 克隆 | r03 克隆 | 判定 |
|---|---|---|---|---|
| `01_stable` | 41.37 | 41.43 ✅ | 45.13 ⚠️ | r01 几乎精确，r03 偏亮 +3.8，**轻微倒退** |
| `scroll-x1` | 41.55 | 55.76 ❌ | 56.55 ❌ | 未改善，仍偏亮 +15 |
| `scroll-x5` | 47.55 | 42.53 | 42.58 | 略偏暗 |
| `scroll-x6` | 44.88 | 46.62 | **44.67** ✅ | 收敛 |
| `scroll-x8` | 42.81 | 40.53 | **41.04** ✅ | 收敛 |
| `scroll-x10` | 65.23 | 36.18 ❌ | **未采到**（采集只到 x8） | 待测 |
- meanAbsDiff `01_stable`：31.85 → 32.32（基本持平）。
- 结论：**旅程中段已收敛，起点与静止帧略退**。校准代理仍在跑，暂不下最终结论。
- 关键新线索：`cameraAnimProgress` 在 14 秒无输入后仅 **0.00028**。自动漂移是按帧累加（`u += -5*l*min(c,10)/h`），SwiftShader 下只有 ~2 FPS ⇒ 漂移比 60FPS 慢约 30 倍。这会同时影响两侧，但**克隆的 x1 偏亮 +15 说明起点构图/相机相位仍与原站不一致**。

## `/work` 首检（结构已对，三处真实缺陷）
已达标：两栏精选网格、项目顺序与原站一致（Where Opportunity Takes Root → National Geographic → 红底 Rolling Stone → 人脸）、客户 `t-meta` + 衬线标题版式、**页头主题随页面转黑**（原站 light 主题下黑字黑花）、82 张图全部加载成功、无横向溢出、发现并实现了原站的 `ColoredDotCursor` 自定义光标与 `FeaturedWorkGrid` 真实 CSS Module 类名。

待修（`src/components/work/**`，案例代理所有，我不越界）：
1. **精选封面停在模糊态**：`FeaturedWorkGrid.tsx` 的 `CardImage` 只靠 `onLoaded` 翻锐；本地图片在 React 挂上 handler 前就已解码完，`onLoad` 不再触发。info 代理已在 `about/BlurImage.tsx` 用"挂载时检查 `ref.current.complete`"修掉同一 bug，work 层需同样处理。
2. **National Geographic 面板渲染出 "Sorry / We're having a little trouble."** —— **根因已定位**：`projects.json` 里每个精选项的 `media` 同时含 `image` 与 `video` 两层，而 `into-the-amazon`（National Geographic）**把 `video` 排在第一层**；本工程只下载了 631 张静态图、**未托管任何视频**，于是该面板落到视频缺失的错误态，而不是原站的史前鳄类画作。
   已排除：该文案不在 `gladeye-app/src/**`（`grep -rl` 无命中）、不在 `evidence/source-pages/_work.html`、也不是下载损坏（631 文件离线校验 0 个 HTML 冒充图片、0 个异常小文件）。
   正确修法：本地无视频时**回退到该项的 `image` 层**（原站该位的静态封面），并把视频层如实记为 `blocked` 写进 `docs/asset-rights.md`，**不得留错误态、也不得用占位图冒充**。

3. 原站首个面板上方有 `vv` 折线指示 + 三个彩色圆点装饰，克隆缺失。

## 当前阻塞
- `/work` 页面在 18:56–18:58 期间**完全挂起**（120s 导航超时），因案例代理正在改写 `src/components/work/**` 与 `case-study/**`。属在建状态，不是结论。
- 全工程 `tsc` 仍有 15 个错误，全部集中在 `case-study/CaseBlocks.tsx`(12)、`work/[slug]/page.tsx`(2)、`case-study/CaseMedia.tsx`(1) —— 案例代理的任务范围。
- **`npm run build` 至今从未成功跑过**（硬门槛缺口）。

## 下轮重点
1. 等两个代理收尾 → 收敛 `tsc` 到 0 并**首次跑通 `npm run build`**。
2. 修 `/work` 三缺陷（模糊未锐化 / NG 选错素材 / 缺失装饰）。
3. 校准 `scroll-x1` 起点相位与静止帧回退；补采 `scroll-x10`。
4. `/contact` 挥手 emoji 行与 intro 段宽（info 代理已把 intro 段宽修好，emoji 行仍缺，其报告标为 UNVERIFIED：原站 DOM 里只有 `<canvas class="h-full w-full">`，绘制代码在未捕获的 chunk 中）。
