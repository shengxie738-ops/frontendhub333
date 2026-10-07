# Iteration 02 — 旅程纵深：五假设逐条检验（结论：全部不成立，根因改判）

Viewport / renderer: 1440×900 @dpr1，Edge/Chromium + SwiftShader(Vulkan) WebGL2，与 r01 同一环境。
本轮**未改动任何渲染行为**（除一个纯类型错误），因为五个假设经实测全部被证伪，
先把根因钉死，避免在错误方向上继续调参。

## 0. 新增的测量面（不改渲染，只读数）

- `src/experience/lib/field-probe.ts`（新）：在 CPU 上逐行复刻顶点着色器的
  `isLeaf / 地形偏移 / rawPos.z 生长 smoothstep / sineOut / pSize / gl_PointSize / 最终裁剪坐标`，
  输出：场包围盒、`uContainerPos` vs 相机世界坐标、屏幕上/已生长点数、
  **overdraw（Σ gl_PointSize²，不做视锥裁剪）**、`minAbsDz`、点尺寸分桶。
- `ValleyScene.probe()` + `qa-bridge.probe()`：把上述结果和 `uContainerPos`、
  scroller 内部状态一起暴露给截图脚本。
- `src/experience/lib/virtual-scroll.ts`：只加了计数器
  （`vsEventCount / vsDeltaSum / driftSum / smoothedPct / lastFrameMs`），无行为改动。
- `scripts/capture-home.mjs`（新）：只截首页，**输入序列与 capture-local.mjs 的 HOME 段逐字一致**
  （9s→settle→6s→5 次 pointer→wheel 1/2/3/4/5/6/8/10），所以与 r01 可比；
  另支持 `MODE=sweep` 用 `setProgress(p)` 扫全路径。

## 1. 五个假设的检验结果

### 假设 1：`uContainerPos` 未随 `cameraContainer` 世界坐标更新 —— **不成立**
从原件 bundle 逐字挖出赋值点（`page-…js` offset 23881）：

```js
let i=this.cameraAnim.update(this.cameraAnimationProgress,!0,this.settings.cameraEase,this.settings.cameraMaxDistanceDiff);
…
this.uniforms.uContainerPos.value=i        // i === gltfCam.position.clone()
```

即原站**就是**把"未经平滑的烘焙相机位置"喂给 `uContainerPos`，不是 `getWorldPosition(cameraContainer)`。
我们的 `ValleyScene.ts:650-656` 与之逐字一致。`CameraAnimator`（`class d`，offset 2257）
的 `0.4` 位置 ease、`dz>o / dz<-o → ease=1`、`rotation.copy` 也逐字一致。
probe 实测：`contZ - uContainerPos.z ≡ -1.1`（= `breathContainer.z = 1 + .12cos`），原站同值。
**改它等于把原站逻辑改错。**

### 假设 2：场的 z 跨度不覆盖相机路径 —— **不成立（但发现了真正的场内容问题，见 §3）**
probe 实测场 `z ∈ [-600, 0]`，路径 `z ∈ [-500, 0]`，覆盖且超出 100 单位。
`terrainLookUp` 与原件（offset 4844 起）逐行对拍：`T/D/A/z/N/E/_`、`B=e*F-b/2`、
`U=y.x+1.5*B`、`W=2.5*sin(1.5U)*|E|`、`G=-E³*sign(E)*B`、`X=-2+|cos(n)|*A*(1+.5Y)`、
`A=4+cos(O)*rand*2`、`q=y.z`、`a.push(U,X,q+_)`、末尾 13 个数组各自 `.concat(.2)` 的顺序 —— 全部一致。

### 假设 3：`aValleySide`/`offsetDirection` 符号或中心曲线朝向错 —— **不成立**
`h.push(e<=V?-1:1)`（V=floor(D/2)=200）与 `offsetDirection = aValleySide*-1.` 均逐字一致。

### 假设 4：场被缩放导致 `24/55` 距离常数失配 —— **不成立**
原件 `buildScene`（offset 19050）里 `new Points(e,p); this.scene.add(this.points)`，
**无任何 scale/除以系数**；我们也是 identity。probe 反算投影：
`rawPos.z = 1.0263·D − 2.026`（near=1, far=77），所以 `rawPos.z≈D`，
`uFlowerBloomDistance:24` 就是 24 世界单位，语义正确。

### 假设 5：进度→帧映射没用 `clip.duration` —— **不成立**
`CLIP_DURATION = 8.291667`（`camera-path07.json.meta.timeRange[1]`），
`progress = clipDuration*pct % 1`、`applySample(clipDuration*pct)`，200 键，逐字一致。

## 2. 真正的根因（一句话）

**旅程不是"纵深不对"，而是"根本没往前走"：滚轮以 10:1 压过自动漂移，把进度推进到负值，
被原站的 `1-|x|%1` 回绕公式瞬移到路径末端接缝（pct≈0.99），再倒着走回 0.83；
而 pct 0/1 两端恰是布点网格与相机路径重合的 `dz→0` 奇点，单帧 overdraw 达 10⁸ Mpx、
单精灵直径 6×10⁶ px，把渲染压到 2fps，而漂移与进度平滑都是逐帧项 —— 于是形成
"越慢→越不动→越停在奇点→更亮/更暗"的正反馈。**

### 证据（r02_home wheel 序列，逐帧实测）

| shot | vsEv | vsSum | driftSum | acc | smoothPct | 报告 pct | camZ | 帧 |
|---|---|---|---|---|---|---|---|---|
| 01_stable | 0 | 0 | -409 | -409 | 0.0016 | 0.0016 | 0.1 | 430ms |
| x1 | 1 | 620 | -868 | -248 | 0.0040 | 0.0040 | -1.1 | 498ms |
| x2 | 3 | 1860 | -1007 | **+853** | 0.0001 | 0.0001 | 1.0 | 488ms |
| x3 | 6 | 3720 | -1173 | +2547 | **-0.0089** | 0.9911 | -494.0 | 456ms |
| x6 | 21 | 13020 | -1880 | +11140 | -0.0779 | 0.9221 | -459.2 | 521ms |
| x10 | 39 | 24180 | -2520 | +21660 | -0.1729 | 0.8271 | -411.8 | 485ms |

- Lenis 完全忠实：39 次 `wheel(0,620)` → `vsSum=24180`，一次不多一次不少（已核对
  `node_modules/lenis@1.1.20` 的 `onWheel`：`deltaY` 原样透传，`wheelMultiplier=1`）。
- 漂移只有 -2520，被轮轮的 +24180 压死 → `acc>0` → `target<0` → 回绕。
  **x2→x3 之间 `acc` 由负翻正，pct 从 0.0001 跳到 0.9911 —— 相机瞬移 495 个世界单位。**
- r00base 同一份代码跑出 x1=0.9991（acc 一开始就为正），r02 跑出 x1=0.0040。
  **方向是随机的**，因为 2fps 下"漂移/秒"与"一次滚轮"同量级。这本身就是"旅程不对"的病灶。

### 奇点证据（overdraw，stride=11 抽样）

| pct | minAbsDz | maxPointSize | g500 | g2000 | Σsize² (Mpx) |
|---|---|---|---|---|---|
| 0.000 | **0.000** | 6,002,070 | 72 | 30 | 3.4e8 |
| 0.500 | 0.125 | 4,521 | 92 | 29 | 336 |
| 1.000 | **0.000** | 6,390,372 | 128 | 56 | 3.0e8 |

布点行 z = `pathZ(row/(T-1))`，`row=0` 与 `row=1999` 正好等于路径两端；
相机 pct=0/1 时 `abs(pos.z-uContainerPos.z)→0` → `pSize=size/|dz|→∞`。
**克隆的旅程恰好长期停在 pct≈0 与 pct≈0.99 这两个奇点上。**

### 场内容证据（为什么 x10 偏暗）
`onScreen`：stable 41553 → x10 **12193**。远端复制带（z -500..-600）由**路径前 20% 的行**
平移到 `z-500`，其 x 锚在早期 `camPos.x≈0..4`；而 pct 0.83 处相机 `camX≈-10.9`，
于是这条带整体偏出视锥 → 镜头越深入、屏上点越少。原站代码同样如此，
但原站 60fps 下相机一路向前、不停在接缝上，所以肉眼看到的是"穿过有纵深的山谷"。

## 3. 前后指标对照

| state | meanAbsDiff r01 → r02 | cand luma r01 → r02 | ref luma |
|---|---|---|---|
| home__scroll-x10 | 47.49 → **43.55** | 36.18 → **45.18** | 65.23 |
| home__scroll-x6 | 41.30 → **39.66** | 46.62 → 47.48 | 44.88 |
| home__scroll-x1 | 40.62 → **38.80** | 55.76 → **53.69** | 41.55 |
| home__01_stable | 31.85 → 32.21 | 41.43 → 41.84 | 41.37 |

**必须诚实说明：这组改善不是代码改动带来的。** 本轮除一个纯类型错误外未改任何渲染行为，
差异全部来自 2fps 下旅程的**运行间不确定性**（r00base x10 pct=0.8265 / luma 36.18，
r02 x10 pct=0.8271 / luma 45.18 —— 几乎同一进度，luma 差 9）。
`home__01_stable` 31.85→32.21 也在同一噪声带内（亮度仍吻合 41.84 vs 41.37）。
**"同一进度两次跑出 luma 相差 9"本身就是必须修缺陷的证据，不能当成改善收下。**

## 4. 改动清单

| 文件 | 改动 | 是否违反 EVIDENCE |
|---|---|---|
| `src/experience/lib/camera-path.ts` | 删除重复声明的 `private readonly clipDuration`（TS2300）。纯类型，运行时零影响 | 否 |
| `src/experience/lib/field-probe.ts` | 新增，只读测量面 | 否 |
| `src/experience/lib/virtual-scroll.ts` | 新增只读计数器 + `getScrollStats()`；drift 表达式等价重写 | 否 |
| `src/experience/ValleyScene.ts` | 新增 `probe()` / `containerWorldPosition()` | 否 |
| `src/experience/qa-bridge.ts` | 新增 `probe()` 桥 | 否 |
| `scripts/capture-home.mjs` | 新增，首页专用 + `MODE=sweep` | 否 |
| `src/experience/glsl/index.ts` | 曾改导入指向 `.glsl.ts` 以解 500，**已回退**（并行代理恢复了 next.config 的 asset/source 规则） | 否 |

未动：`SCENE_SETTINGS` 任何字段、`glsl/*.glsl` 原件、`next.config.mjs`、相机路径驱动。

## 5. 验证
- `npx tsc --noEmit`：`src/experience/**` 与 `src/components/home/**` **0 错误**
  （仓内其余错误在 `src/app/work/[slug]`、`src/components/case-study`，属并行代理在建文件）。
- 首页健康：`mode=live`、`webgl2=true`、`degraded=false`、`assetFailures=[]`、
  `shaderIssues=0`、`degradeReasons=[]`、`pointCount=960000`、`consoleErrors=[]`、canvas 1440×900。
- 产物：`docs/candidates/gladeye/r02_home__*.png` + `r02_home__run.json`（含逐帧 probe）；
  扫描集 `r00sweep2/r00sweep3__sweep-*.png` + `r00sweep*__sweep.json`；
  指标 `reports/comparisons/report-r02_home.{md,json}`。

## 6. 下一轮 3 个校准点（按性价比排序）

1. **先解决"旅程不可复现"，再谈亮度。** 让 journey 单调向前：在 `progressOverride` 之外，
   把 wheel→progress 的有效符号按原站 60fps 的净效果校正（原站 60fps 下 drift=-300/s，
   与轮轮同量级并持续向前；我们 2fps 下 drift=-56/s 被轮轮压死）。
   **不改 §3/§2 任何常数**，改的是"逐帧项在低帧率下的补偿时机"——即把 drift 与
   `getScrollPct` 的 2% 平滑从"每帧一次"改成"每 1/60 s 一次"的定步长累加，
   这正是 `min(60,elapsed)`/`min(frameCount,10)` 这几个封顶项想表达却表达不动的意图。
   预期：x1 从 53.69 向 41.55 收，x10 从 45.18 向 65.23 升，且两次跑分一致。
2. **消掉 `dz→0` 奇点**（overdraw 10⁸ Mpx 的直接来源，也是 2fps 的主因之一）。
   手段限定在"我们自己的几何"：给布点行一个半行的 z 交错（`row+0.5`），
   使 `minAbsDz` 恒 ≥ 半行间距，路径两端不再与布点面重合。**不动 `pSize` 公式、不动 §3 常数。**
3. **远端复制带的 x 锚点**：`farPositions` 目前把"路径前 20% 的行"平移到 z-500，
   但 x 仍锚在早期 `camPos.x`，导致 pct>0.8 时整条带偏出视锥（onScreen 41.5k→12.2k）。
   需要取证确认原站是否如此；若是，则第 1 点让相机真正向前之后此项自然缓解，不要先动它。

## 7. 需要越界处理的事项
- 无。本轮未遇到必须改 `src/app/**`、`next.config.mjs`、`evidence/**`、`docs/design-references/**` 的情况。
- **但需要协调一次并行冲突**：约 02:36 有代理把 `next.config.mjs` 的
  `{test:/\.glsl$/, type:'asset/source'}` 规则删掉并把 `glsl/index.ts` 改成从 `.glsl.ts` 具名导入，
  导致整站 **HTTP 500 约 10 分钟**（webpack 仍优先解析真实 `.glsl` 文件 → ModuleParseError）。
  现已恢复。建议明确 `src/experience/glsl/**` 与 `next.config.mjs` 的单一归属，
  否则截图类代理会反复被中断。
