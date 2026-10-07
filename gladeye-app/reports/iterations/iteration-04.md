# Iteration 04 — 定步长累加 + 半行 z 交错（照 iteration-02 处方执行）

Reference: 2026-10-06 冻结集 · Candidate: `gladeye-app/src` 04:10Z · 1440×900 @dpr1 / SwiftShader WebGL2
仪器：`src/experience/lib/field-probe.ts`（stride=11）+ `scripts/capture-home.mjs`（输入序列与 `capture-local` HOME 段逐字一致）

处方来源：`reports/iterations/iteration-02.md` §2（根因）与主代理本轮任务书。
**本轮只做那两条修复，没有动 `SCENE_SETTINGS`/`SCROLLER` 任何原站常数、没有动 `pSize`、没有动 `src/experience/glsl/**`、没有动相机驱动、没有动远端复制带的 x 锚点。**

---

## 1. 两条修复的实现

### 1.1 修复 1：逐渲染帧项 → 固定 1/60 s 步长累加（`src/experience/lib/virtual-scroll.ts`）

原实现把 drift 挂在 rAF 上，每渲染帧一次，并靠 `min(60, elapsed)` 与 `min(frameCount,10)` 封顶：
2 FPS 下 `frameScale = min(60,500)/16.67 = 3.6`、`frameCount = 30` → 每帧只累加 `10 × (-5·l·3.6/30) = -6`，
即 **-12/s**，而 60 Hz 下是 **-300/s** —— 慢 25 倍。这就是"越慢越不动"的正反馈。

现在把两个逐帧项（drift 与 `getScrollPct` 的 2 % 平滑）搬到固定步长上：

```ts
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 120;                       // 追帧上限 = 2 s 旅程
const MAX_ADMITTED_MS = MAX_STEPS_PER_FRAME * STEP_MS;

function step(): void {                                 // 一次 1/60 s
  autoScrollEase += (autoScrollTarget - autoScrollEase) * SCROLLER.autoScrollLerp;
  const driftStep = SCROLLER.drift * autoScrollEase;    // 原式：60Hz 下 frameScale=1, frameCount=1
  accumulator += driftStep;
  driftSum += driftStep;
  stepProgress();                                       // n += (t - n) * .02
}

const raf = (): void => {
  const elapsed = now - lastTime;
  scrollVelocity = ((accumulator - previousScroll) / elapsed) * SCROLLER.velocityScale;
  stepDebtMs += Math.min(Math.max(0, elapsed), MAX_ADMITTED_MS);
  let steps = Math.floor(stepDebtMs / STEP_MS);
  if (steps >= MAX_STEPS_PER_FRAME) { steps = MAX_STEPS_PER_FRAME; stepDebtMs = 0; } // 停摆不爆冲
  else stepDebtMs -= steps * STEP_MS;
  for (let i = 0; i < steps; i++) step();
  ...
};
```

**为什么没有触碰原站常数**：`drift=-5`、`progressSmoothing=.02`、`autoScrollLerp=.25`、
`extentFactor=15`、`extentCap=20000`、`velocityScale=.2`、`touchMultiplier=20`、`progressScale=.2`
全部原样从 `SCROLLER` 读取（`git diff src/experience/data/scene-settings.ts` 为空）。
在 60 Hz 下新代码每帧恰好执行 1 步，`step = drift·l·1/1`，与旧表达式**逐值相同**；
改的只是"什么时候累加"。`1-|x|%1` 回绕公式、`-1*u*.2/a` 映射、`scrollVelocity` 的 per-ms 语义也都保留原样。

追帧上限定在 120 步（=2 s 旅程）的理由：SwiftShader 下一帧 0.2–0.5 s，截图/probe 再把 rAF 卡住 1–2 s，
60 步的封顶会在这些停顿里丢时间（实测只跑到 21 步/秒，见 §5 的 `steps` 列），
旅程速率重新变成"停顿多久"的函数；120 步后实测 60 步/秒（=60 Hz 归一），
而单次最坏爆冲只有 120 步 = pct +0.006，对比旧代码 x2→x3 的 495 世界单位瞬移。

### 1.2 修复 2：半行 z 交错消掉 `dz→0` 奇点（`src/experience/lib/terrain-lookup.ts`）

原式 `const z = camPos.z`（`camPos = cameraAnim.update(row/(T-1))`）让第 `r` 行**正好落在**
相机在 `pct = r/(T-1)` 时所在的 z 平面，于是 `pct=0/1` 两端 `abs(pos.z-uContainerPos.z)=0`，
`pSize = uFlowerBaseScale/|dz|` 发散。改成按半行采样：

```ts
// 世界 z：半行交错后的路径采样
const staggeredZ = cameraAnim.update((row + 0.5) / T, false).z;
const noiseZ = camPos.z;                    // 噪声域 z：一动不动
...
const z = staggeredZ;
positions.push(x, y, z);
farPositions.push(x, y, z + farZ);
noiseCoordinates.push(x, y, noiseZ);        // 以下全部仍用未交错的 noiseZ
noise3D(k*x, k*y, k*noiseZ);
```

** blast radius 控制**：`(row+0.5)/T` 严格落在 `(0,1)` 内 —— 用 `row/(T-1)+半行` 会让最后一行
被 `segmentIndex` 夹回路径末端，等于把奇点留在原地。交错只影响**世界 z**；
`x`、`y`、`noiseCoordinates`、`terrainNoise`（决定 leaf/flower 与 discard）、`aPoolId`、
`aFlowerGrowNoise`、远端带的 `farZ = update(0.9999,false).z`（EVIDENCE.md §5 逐字常数）**全部未改**，
所以场的"内容"与 r03 一致，只有点所在的那个平面挪了半行（0.125 世界单位）。
`cameraAnim.update(p, false)` 不改 `cameraContainer`，相机驱动零影响。

`tsc`：`src/experience/**` + `src/components/home/**` + `src/hooks/useFlowerValley.ts` **0 错误**；
04:5x 复跑时**全仓 `npx tsc --noEmit` 也已经是 0 错误**（案例代理的 11 个已收尾，不属本轮）。

---

## 2. 可复现性（验收 1，最重要）

同一 wheel 序列（1/2/3/4/5/6/8/10 次 `wheel(0,620)`）在**最终代码**上连跑两次：
Run A = `LABEL=r04`，Run B = `LABEL=r04b`（04:52 dev server 恢复后补跑，同一仪器、同一序列、同一环境）。

| state | pct A | pct B | Δpct | luma A | luma B | Δluma | meanAbsDiff A / B |
|---|---|---|---|---|---|---|---|
| 00_intro | 0.0375 | 0.0312 | **0.0062** | 38.54 | 37.79 | 0.75 | 30.72 / 31.43 |
| 01_stable | 0.0642 | 0.0578 | **0.0064** | 42.07 | 42.82 | 0.75 | 34.23 / **34.21** |
| pointer-0.5-0.5 | 0.0774 | 0.0722 | 0.0052 | 44.11 | 46.30 | 2.19 | 33.45 / 34.81 |
| pointer-0.12-0.2 | 0.0913 | 0.0861 | 0.0052 | 41.02 | 38.39 | 2.63 | 32.06 / 30.41 |
| pointer-0.88-0.2 | 0.1044 | 0.0991 | 0.0053 | 40.57 | 43.63 | 3.06 | 30.91 / 34.60 |
| pointer-0.88-0.85 | 0.1186 | 0.1121 | 0.0065 | 37.24 | 40.93 | 3.69 | 36.57 / 35.55 |
| pointer-0.12-0.85 | 0.1311 | 0.1245 | 0.0066 | 38.93 | 32.60 | 6.33 | 35.96 / 33.09 |
| **scroll-x1** | 0.1495 | 0.1426 | 0.0069 | **42.90** | **42.01** | **0.89** | 39.16 / **35.81** |
| scroll-x2 | 0.1670 | 0.1575 | 0.0095 | 49.09 | 50.52 | 1.43 | 42.84 / 42.18 |
| scroll-x3 | 0.1855 | 0.1716 | 0.0139 | 34.05 | 46.54 | **12.49** | 33.19 / 38.28 |
| scroll-x4 | 0.2033 | 0.1819 | 0.0214 | 68.72 ⚠ | 37.93 | 30.79 | 76.20 / 33.01 |
| scroll-x5 | 0.2117 | 0.1915 | 0.0202 | 67.47 ⚠ | 36.98 | 30.49 | 76.03 / 37.65 |
| scroll-x6 | 0.2179 | 0.2005 | 0.0174 | 68.12 ⚠ | 41.97 | 26.15 | 78.52 / 37.92 |
| scroll-x8 | 0.2197 | 0.2008 | 0.0189 | 67.86 ⚠ | 40.13 | 27.73 | 74.94 / 34.82 |
| scroll-x10 | 0.2196 | 0.1996 | 0.0200 | 68.06 ⚠ | 42.12 | 25.94 | 92.18 / 42.10 |

⚠ = Run A 那一帧被巨精灵白块污染（§6.1），Run B 同一状态是干净帧。

**结论**
- **Δpct 全部 ≤ 0.021**，中位 0.007。**对照修复前**：r00base 的 x1 = 0.9991 vs r02 的 x1 = 0.0040
  → **Δpct = 0.995**（相机差 495 世界单位），且 r02 内部 x2→x3 就翻一次号。方向随机的病灶消失。
- **干净帧的 Δluma 中位 2.2、最大 12.49**（x3，Δpct 0.0139，那里亮度曲线正陡）。
  修复前是"同一进度两次差 9 luma"（r00sweep2/3 在固定 pct 下的散布达 ±8）。
  现在残余抖动**与 pct 差严格同向**，即它已经不是随机源，而是"旅程按墙钟前进"的必然结果。
- **唯一的真随机源是 §6.1 的巨精灵白块**（Run A 5/15 命中、Run B 0/15 命中）。
  它一旦被几何侧压掉，两次执行的 luma 就会贴到 ±3 以内。
- 静止帧 `01_stable` 的 meanAbsDiff 两次都是 **34.2**（护栏 32.21）→ **这不是噪声，是真实回退**，
  原因见 §6.2。

### 2.1 旁证：同一 build 再跑两次（无桥，只比 luma）
03:52 的生产构建同样含两条修复，`r04p1` / `r04p2` 用逐字相同的输入序列各跑一遍：
15 格里 Δluma 中位 3.0、最大 10.94，**两次都没有白块**（0/15、0/15）。
与 §2 一致：抖动来自墙钟进度，白块是低概率抽奖。


---

## 3. field-probe：奇点前后对照（验收 3）

`MODE=sweep`，`setProgress(p)` 钉死进度，stride=11。`ovdMpx = Σ gl_PointSize²`（不做视锥裁剪）。

| pct | 指标 | 修复前 `pre_sweep` | 修复后 `post2_sweep` | 变化 |
|---|---|---|---|---|
| **0.000** | `minAbsDz` | **0.000** | **0.1264** | 离开奇点 ✅ |
| | `maxPointSize` | 6,030,116 px | 4,690 px | ÷1286 |
| | `Σsize²` | **2.93e8 Mpx** | **238.1 Mpx** | **÷1.2e6** |
| | `giant>500 / >2000` | 72 / 24 | 59 / 15 | — |
| **0.500** | `minAbsDz` | 0.125 | 0.1254 | 持平（本来就不在奇点） |
| | `maxPointSize` | 5,043 px | 4,796 px | ≈ |
| | `Σsize²` | 422.3 Mpx | 345.0 Mpx | ≈ |
| **1.000** | `minAbsDz` | **0.000** | **0.0651** | 离开 0 ✅（但未到半行，见下） |
| | `maxPointSize` | 6,251,264 px | 9,194 px | ÷680 |
| | `Σsize²` | **2.32e8 Mpx** | **1026.6 Mpx** | **÷2.3e5** |

pct=0 与 pct=1 的 `Σsize²` 现在与 pct=0.5 同量级（数百 → 千 Mpx），处方目标达成。

**pct=1 只剩 0.065 而不是 0.126 的原因（只记录，未改）**：远端复制带整体平移
`farZ = update(0.9999,false).z = -499.939`，比路径真正的末端 `z(1) = -500` 短 0.061；
带内第 0 行的交错 z 是 -0.126，于是 `dz = -0.126 - 499.939 + 500 = -0.065`。
这条 0.061 的缺口是 `0.9999` 这个 EVIDENCE.md §5 逐字常数带来的（修复前它就是 0.061），
要抹平只能动 `farZ` 或给带子再加一次半行平移 —— 都超出本轮授权，**没做**。

**从烘焙路径数据直接算的 min|dz|（`camera-path07.json`，T=2000，无浏览器）**：

| pct | 0 | 0.05 | 0.1 | 0.25 | 0.5 | 0.8 | 0.9 | 0.99 | 1 |
|---|---|---|---|---|---|---|---|---|---|
| 修复前 | **0** | 0.013 | 0.025 | 0.063 | 0.126 | 0.051 | 0.025 | **0.0025** | **0** |
| 修复后 | 0.126 | 0.126 | 0.124 | 0.126 | 0.125 | 0.126 | 0.124 | 0.126 | 0.065 |

---

## 4. 旅程真的在走，方向确定（验收 2）

Run A 逐步实测（`acc` = 累计量，`pct` = 报告进度 = `cameraAnimProgress`，`camZ` = 相机世界 z）：

| shot | vsEv | vsSum | driftSum | acc | smoothPct | pct | camZ | 帧时 ms | steps |
|---|---|---|---|---|---|---|---|---|---|
| 00_intro | 0 | 0 | -3990 | -3990 | 0.0375 | 0.0375 | -17.9 | 467 | 798 |
| 01_stable | 0 | 0 | -6665 | -6665 | 0.0642 | 0.0642 | -31.3 | 484 | 1333 |
| pointer-0.5-0.5 | 0 | 0 | -7990 | -7990 | 0.0774 | 0.0774 | -37.9 | 509 | 1598 |
| pointer-0.12-0.2 | 0 | 0 | -9375 | -9375 | 0.0913 | 0.0913 | -44.8 | 485 | 1875 |
| pointer-0.88-0.2 | 0 | 0 | -10690 | -10690 | 0.1044 | 0.1044 | -51.5 | 482 | 2138 |
| pointer-0.88-0.85 | 0 | 0 | -12110 | -12110 | 0.1186 | 0.1186 | -58.6 | 495 | 2422 |
| pointer-0.12-0.85 | 0 | 0 | -13360 | -13360 | 0.1311 | 0.1311 | -64.7 | 453 | 2672 |
| **x1** | 1 | 620 | -15810 | -15190 | 0.1495 | 0.1495 | **-74.1** | 433 | 3162 |
| **x2** | 3 | 1860 | -18800 | -16940 | 0.1670 | 0.1670 | -82.8 | 227 | 3760 |
| **x3** | 6 | 3720 | -22515 | -18795 | 0.1855 | 0.1855 | -92.0 | 567 | 4503 |
| **x4** | 9 | 5580 | -26155 | -20575 | 0.2033 | 0.2033 | -100.8 | 438 | 5231 |
| **x5** | 14 | 8680 | -30090 | -21410 | 0.2117 | 0.2117 | -104.8 | 438 | 6018 |
| **x6** | 20 | 12400 | -34430 | -22030 | 0.2179 | 0.2179 | -108.1 | 471 | 6886 |
| **x8** | 28 | 17360 | -39570 | -22210 | 0.2197 | 0.2197 | -109.0 | 477 | 7914 |
| **x10** | 38 | 23560 | -45765 | -22205 | 0.2196 | 0.2196 | -108.7 | 444 | 9153 |

- `acc` **全程为负、从未翻号**；`pct` 从 0.0375 单调升到 0.2197，`camZ` 从 -17.9 走到 -109.0
  （**91 世界单位的真实前进**），**没有 0.0001→0.9911 的瞬移，没有负值回绕**。
- `steps`/墙钟 ≈ 60/s（cap=60 时只有 21/s）→ drift 已按 60 Hz 归一。
- `smoothPct` 与 `pct` 逐行相等 → 2 % 平滑不再被帧率拖成"永远追不上"。

**Run B（`r04b`，最终代码第二次执行）逐 shot 摘要**：

| shot | vsEv | vsSum | driftSum | acc | pct | camZ |
|---|---|---|---|---|---|---|
| 00_intro | 0 | 0 | -3365 | -3365 | 0.0312 | -14.8 |
| 01_stable | 0 | 0 | -6025 | -6025 | 0.0578 | -28.1 |
| x1 | 1 | 620 | -15125 | -14505 | 0.1426 | -70.7 |
| x3 | 6 | 3720 | -21125 | -17405 | 0.1716 | -84.9 |
| x6 | 21 | 13020 | -33310 | -20290 | 0.2005 | -99.2 |
| x8 | 29 | 17980 | -38300 | -20320 | 0.2008 | -99.3 |
| x10 | 39 | 24180 | -44385 | -20205 | 0.1996 | -98.9 |

同样 `acc` 全程为负、`pct` 无回绕无瞬移；`vsEv=39 / vsSum=24180` 与 Run A 的 38/23560 一样，
说明滚轮事件本身 100 % 忠实（Lenis 侧无丢帧），差别只在墙钟。

**但"pct 随滚轮单调上升"没有按字面成立，如实说明**：`pct = -u·.2/a` 让滚轮（`u += deltaY > 0`）
在符号上就是**倒退**项，前进项只有 drift。修复前 drift 被压到 -12/s，滚轮 620/次直接把它压死并翻号；
修复后 drift = -300/s，两次 shot 间隔约 4.5–6 s（-1350～-1800），
所以 x1–x3（+620/+1240/+1860）仍被 drift 盖住 → pct 继续上升；
x5 以后累计滚轮（+8680…+24180）开始吃掉 drift 的增量 → pct 增速衰减，
x8→x10 在 Run A 是 **0.2197 → 0.2196**、Run B 是 **0.2008 → 0.1996**
（平台期，不再前进，但也绝不倒退/回绕）。
要把"滚轮=前进"变成字面成立，必须改 `pct` 的符号映射或 `accumulator += deltaY` 的符号 ——
那正是任务书禁止我动的"相机驱动/原站累加语义"，所以我没动，只把证据摆出来。

---

## 5. 帧率（验收 4）——**没有按预期走，但归因已经做实**

诊断桥 `fps` 在 r04 / r04b 全程仍是 **2**（r02/r03 也是 2）。但端点帧时确实降了：

| pct | onScreen | Σsize² 修复前 | 帧时 修复前 | Σsize² 修复后 | 帧时 修复后 |
|---|---|---|---|---|---|
| 0.000 | ~41.4k | 2.93e8 Mpx | **455 ms** | 238 Mpx | **190 ms**（2.4×） |
| 0.500 | ~23.5k | 422 Mpx | 420 ms | 345 Mpx | 527 ms（噪声） |
| 1.000 | ~5.9k | 2.32e8 Mpx | **564 ms** | 1027 Mpx | **187 ms**（3.0×） |

旅程段（Run A/B，pct 0.03–0.22）帧时中位 **462–471 ms**，与修复前 r02 的 430–521 ms 同带 → **FPS 未提升**。

**归因实验 `LABEL=r04boost QUALITY=boost MODE=sweep`（同一 build，只把质量档换成 boost：180k 点 + 无 composer）**：

| 档 | 点数 | composer | onScreen@pct0 | Σsize²@pct0 | 帧时 | 报告 fps |
|---|---|---|---|---|---|---|
| high | 960,000 | 有 | 41.6k | 238 Mpx | 190–520 ms | **2** |
| boost | 180,000 | **无** | 7.9k | 58.8 Mpx | 6–135 ms | **8** |

→ **2 FPS 不是 overdraw 造成的**：overdraw 已经被两条修复砍掉 10⁵–10⁶ 倍，帧时不动；
把它抬到 8 FPS 的是"点数 ÷5.3 + 去掉 bloom/noise/glitch 整条 composer 链"。
SwiftShader 在 1440×900 上跑 UnrealBloom 五级 mip 分离卷积本身就是百毫秒级。
`fps` 字段是 30 帧滚动均值，471 ms 四舍五入就是 2。
**结论：验收 4 未达成，且达成它的杠杆不在本轮授权范围内（真 GPU 或降档，二者都不许我用来"刷指标"）。**
附带交叉验证：boost 档 `minAbsDz = 0.167–0.169`，正好是它自己行距（500/1500 = 0.33）的一半
—— 半行交错按档缩放，公式生效。


---

## 6. r04 视觉指标（验收 5）

`LABEL=r04` / `LABEL=r04b` + `node scripts/build-comparison-report.mjs`（各 15/15 compared）。

| state | ref luma | r02 luma | **A luma** | **B luma** | r02 mad | **A mad** | **B mad** | 判定 |
|---|---|---|---|---|---|---|---|---|
| `home__scroll-x1` | 41.55 | 53.69 | 42.90 | **42.01** | 38.80 | 39.16 | **35.81** | **目标达成 ✅**（luma +0.46，mad −2.99） |
| `home__scroll-x10` | 65.23 | 45.18 | 68.06 ⚠ | **42.12** | 43.55 | 92.18 ⚠ | **42.10** | **目标未达成 ❌**（还差 −23.1） |
| `home__01_stable` | 41.37 | 41.84 | 42.07 | 42.82 | 32.21 | **34.23** | **34.21** | luma ✅；**mad 破护栏 +2.0 ❌（两次一致，非噪声）** |
| `home__scroll-x2` | 40.97 | — | 49.09 | 50.52 | — | 42.84 | 42.18 | 偏亮 +10 |
| `home__scroll-x3` | 42.77 | — | 34.05 | 46.54 | — | 33.19 | 38.28 | 抖动大 |
| `home__scroll-x4` | 42.32 | — | 68.72 ⚠ | 37.93 | — | 76.20 ⚠ | 33.01 | B 干净且达标 |
| `home__scroll-x5` | 47.55 | — | 67.47 ⚠ | 36.98 | — | 76.03 ⚠ | 37.65 | 偏暗 −10.6 |
| `home__scroll-x6` | 44.88 | — | 68.12 ⚠ | 41.97 | — | 78.52 ⚠ | 37.92 | mad 比 r02/r03 略好 |
| `home__scroll-x8` | 42.81 | — | 67.86 ⚠ | 40.13 | — | 74.94 ⚠ | 34.82 | mad 比 r03(34.07) 持平 |
| `home__00_intro` | 41.00 | — | 38.54 | 37.79 | — | 30.72 | 31.43 | 全表最好 |
| pointer ×5 | 37.77–46.05 | — | 37.24–44.11 | 32.60–46.30 | — | 30.91–36.57 | 30.41–35.55 | 正常 |

⚠ = 该帧被巨精灵白块污染，数字不可用。

**两条明确点名的目标，一条达成一条没达成：**
- `scroll-x1` 53.69 → **42.01（参考 41.55）**：✅ 达成，且两次独立执行都成立（42.90 / 42.01），
  meanAbsDiff 也从 38.80 收到 35.81。
- `scroll-x10` 45.18 → 目标 65.23：❌ **没走**。Run B 是 42.12（比 r02 的 45.18 还退 3.1），
  Run A 的 68.06 是白块假象。原因清楚：x10 现在停在 pct 0.20（camZ −99），
  而参考 x10 在 pct≈0.83（iteration-02 记录），**两个帧根本不在旅程的同一处**。
  参考侧 x10 的 65.23 是"深入谷尾 + 远端带"的亮度，我们现在的进度到不了。
- `home__01_stable` 护栏：❌ 32.21 → **34.23 / 34.21（两次一致）**。见 §6.2。

### 6.1 污染帧的取证（只取证，未改）
- `r04__home__scroll-x4/x6`：画布上半部是纯白矩形（y=0..435，整宽），里面两个黑色六瓣花剪影；下半部是正常山谷。
- 白区 **302,952 个像素在两帧间逐字节相同**，其余 591,550 像素不同 → 覆盖层不随相机变化。
- 不是 DOM：`window.scrollY=0`、`html{overflow:hidden}`、`body{position:fixed}`、
  canvas rect `0,0,1440,900`、`elementsFromPoint(720,200)` 全透明、`consoleErrors=[]`。
- 与仪器读数一致：这两帧 `minAbsDz` 0.026 / 0.051，`maxPointSize` 22,421 / 12,177 px ——
  一个 22k px 的点精灵就是屏幕大小的正方形，其直边正是 y≈435 那条线；
  "逐字节相同"是 **bloom 饱和后 clip 到 255** 的结果（削顶区一致，未削顶的谷地仍在变）。
- **复现率**：Run A 5/15 命中；Run B **0/15** 命中（同一天同一环境同一序列）；
  `r04p1` 0/15、`r04p2` 0/15；1440×900 high 档连拍 14 帧纯白占比恒 1.4 %（就是标题字），0/14。
  → **≈ 5/59 ≈ 8 % 的逐帧抽奖**。Run B 的 x8 probe 读数抓到过极端一例：
  `minAbsDz = 0.001`、`maxPointSize = 543,299 px`、`Σsize² = 2.63e6 Mpx`（那一帧的截图仍是干净的，
  因为 wheel 模式下 probe 在 shot 之后，量到的下一帧）。
  **这就是 §7：半行交错把奇点从端点搬走了，但晶格本身还在，2 FPS 下每帧都在抽奖。**

### 6.2 为什么 `01_stable` 的 meanAbsDiff 一定回退
参考 `01_stable` 是在原站也跑 ~2 FPS 的 SwiftShader 下抓的，那时原站的 drift 同样只有 −12/s，
15 s 后它的进度是 pct≈0.005（camZ≈−1.5）。修复 1 把 drift 归一到 60 Hz 之后，
我们的静止帧停在 **pct 0.058–0.064（camZ −28 ~ −31）** —— 已经深入山谷 30 个单位，
构图与参考帧不是同一处，meanAbsDiff 从 32.2 抬到 34.2 是这个位移的直接后果（luma 仍然对得上：42.8 vs 41.4）。
**这不是"改坏了"，是"改对了之后不再对齐一张按 2 FPS 抓的参考帧"。**
要么接受静止帧护栏的这 2 点位移，要么把参考侧重抓一套"按 pct 对齐"的基准（§11 第 3 条）。



---

## 7. 处方没做到的那一半：奇点是"晶格"，不是"端点"

半行交错把相机平面与**端点行**解开了（§3 已证明），但布点是 2000 个 z 平面、
间距 0.25 世界单位，相机在旅程中连续扫过全部 z —— **每穿过一行，那一行的 400 个点同时 `|dz|→0`**。
交错只是把重合点从 `pct = r/(T-1)` 搬到 `pct = (r+0.5)/T`，没有消除重合本身。

量化（用烘焙路径直接算）：行距 0.25，`|dz| ≤ 0.125` 必然发生；
一个点精灵要不盖满 1440×900 需要 `|dz| ≥ 3853·0.2·0.5625/1440 ≈ 0.30 > 0.25 = 一整行距`。
60 FPS 下相机每帧走 0.025 单位，穿越一行要 10 帧，最坏 `|dz|≈0.0125` 只持续一帧（16 ms，人眼是"闪烁"）；
2 FPS 下相机每帧走 0.75 单位 = 3 行，`|dz|` 在 `[0,0.125]` 上一致分布 →
**约一半的采样帧带巨精灵**。这就是 §6 那五帧的来历，也解释了为什么修复前 x1 会偏亮 +12
（r02 x1 `minDz=0.012`、`maxPx=5.07e4`，同一个病，只是当时相机停在接缝上）。

下一步假设（按性价比）：
1. **行内逐点 z 抖动**（仍属"只动我们自己的几何"）：给每个点的 z 加 `±半行` 的确定性抖动，
   使任一相机平面附近同时共面的点数从 400 降到 ~1，`Σsize²` 再降 ~400×，
   巨精灵从"糊满半屏"退化为"边缘 bokeh"（参考帧 x6 左右边缘正是这种 bokeh，说明原站也有，只是不共面成墙）。
   代价：行的景深"锐度"下降，需要重跑 r05 对照。
2. **`gl_PointSize` 上限**——本轮明令禁止（`pSize` 公式与 GLSL 原件不许动），留给主代理裁决。
3. **参考帧的进度对齐**：如果目标是"与 2 FPS 下抓的参考截图对齐"，那 drift 归一化反而会把旅程推到
   参考帧没去过的进度区间。要么用 `MODE=sweep` 逐 pct 重抓一套**参考侧**的进度-亮度曲线
   （现在只有 21 点、且噪声 ±8 luma），要么承认 meanAbsDiff 只能覆盖静止帧。
4. **材质混合模式**：巨精灵画成"白底+黑花"而不是"发光 bokeh"，指向 `ShaderMaterial` 用了默认
   NormalBlending；原站 `new Points(e,p)` 的 `p` 的 blending 我没能在本地证据（82 KB 的 bundle 副本）里查到，
   **未作任何修改**，只登记为待查。

---

## 8. 远端复制带 x 锚点：只观察（验收 7）

r04 全程 `bounds` 固定为 `x ∈ [-33.8, +28]`、`z ∈ [-600, 0]`（两条带合起来）。
- 旅程现在只到 pct 0.22（camZ -109），`onScreen` 从 40,252 缓降到 33,311（**-17 %**），
  没有出现 iteration-02 在 pct 0.83 看到的 41,553 → 12,193（**-71 %**）崩塌。
- 带子的 x 锚确实仍钉在"路径前 20 % 的行"上（camX ∈ [0, +4.2]），而相机 x 在 pct 0.2 处是 +4.8、
  在 pct 0.83 处是 -10.9 —— 越深入，带子越偏离视轴中心。
- **判定：在 r04 的进度范围内，x 锚点不是主因**（主因是 §7 的晶格巨精灵）。
  证据已留，按处方**一个字没动**（包括 `farZ` 的 `0.9999`）。

---

## 9. 首页健康（诊断桥）

`r04__run.json` 与 `r04b__run.json` 的 `homeDiag` / `finalDiag` **四次全部一致**：
`mode=live`、`degraded=false`、`degradeReasons=[]`、`assetFailures=[]`、`shaderIssues=[]`（0 条）、
`webgl2=true`、`pointCount=960000`、`runtimes=1`、`introDone=true`、`dpr=1`、
`placementMs=537`、`pageCrashed=null`、`consoleErrors=[]`，30/30 截图非空白
（Run A 的 x4–x10 五格是"渲染被巨精灵糊住"，不是页面失效——DOM、canvas、桥都在）。


## 10. 产物与协作
- 新产物：`docs/candidates/gladeye/r04__*.{png,json}`（Run A，含逐 shot 完整 probe）、
  `r04p1__*` / `r04p2__*`（无桥 luma 复现双跑）、`pre_sweep__*`、`post_sweep__*`、`post2_sweep__*`；
  `reports/comparisons/report-r04.{md,json}`。
- 改动文件（仅授权范围内）：`src/experience/lib/virtual-scroll.ts`、`src/experience/lib/terrain-lookup.ts`、
  `scripts/capture-home.mjs`（sweep 模式改为**先 probe 后截图**、加 `overdraw/fps/crash` 列、
  加 `QUALITY=` 帧成本归因钩子、加"无桥立刻退出"护栏；wheel 输入序列一字未改）、
  `reports/iterations/iteration-04.md`（本文件）。

### 10.1 没有越界的硬证据（mtime）
| 路径 | mtime | 结论 |
|---|---|---|
| `src/experience/glsl/*.glsl`（13 个原件） | 01:39 | 本轮未动（我最早一次写入是 03:22） |
| `src/experience/glsl/*.glsl.ts` / `index.ts` | 02:41–02:48 | 未动 |
| `next.config.mjs` | 02:39 | 未动（主代理所有） |
| `src/experience/data/scene-settings.ts` | 01:41 | 未动；`drift:-5 / progressSmoothing:.02 / autoScrollLerp:.25 / extentFactor:15 / extentCap:20000 / velocityScale:.2 / touchMultiplier:20 / progressScale:.2` 全部原样 |
| `src/experience/lib/terrain-lookup.ts` | 03:22 | 本轮修复 2 |
| `src/experience/lib/virtual-scroll.ts` | 04:24 | 本轮修复 1 |

`node scripts/verify-scene-params.mjs` **跑不起来**（`ReferenceError: allExperienceSources is not defined`
在第 612 行）—— 这是该脚本自身的既有缺陷，不在我可改的文件清单里，留给主代理；
所以上表用 mtime + 逐字段 grep 代替它做非漂移证明。

## 11. 下一轮该做的三件事（按性价比）
1. **恢复 3005 的 dev 模式**（我只能等：不许重启、不许删 `.next`），然后补
   `LABEL=r04b BASE=http://127.0.0.1:3005 node scripts/capture-home.mjs`（Run B，带 pct/acc）
   与 `QUALITY=boost MODE=sweep SWEEP_STEPS=3 node scripts/capture-home.mjs`（帧成本归因）。
2. **行内逐点 z 抖动**（§7 假设 1）——把"一行 400 点共面"打散，这是巨精灵白块唯一的几何侧解法，
   且仍然只动我们自己的布点。
3. **采集协议改成按 pct 门控截图**，否则旅程一旦真的按 60 Hz 前进，luma 就必然随墙钟漂移，
   meanAbsDiff 无法区分"场景不对"和"进度不对"。

