# Iteration 07 — /work 封面锐化 + 一次按数据的自我回退

环境：`npm run build` → `next start -p 3005` · 1440×900 @dpr1 / SwiftShader · tsc 0 错误 · build exit 0

## 一、`/work` 精选封面停在模糊态（已修，指标改善）
`FeaturedWorkGrid.tsx` 的 `CardImage` 与 `CaseImage` 是**同一个 bug**：清晰层 `opacity: ready ? 1 : 0`，而 `ready` 只由 `onLoad` 置真；本地图片常在 React 挂上 handler 前就解码完，于是永久停在模糊占位层上。
修法：ref 回调里检查 `node.complete && node.naturalWidth > 0`，并加 `onError` 兜底。

| 指标 | r06（修前） | r10（修后） |
|---|---|---|
| `work__0_top` meanAbsDiff | 38.91 | **30.72** |
| cand luma / σ | 161.01 / 104.68 | 159.97 / 110.18 |
| 图片加载 | 82/82 | 48/48 全成功，无横向溢出 |

## 二、一次被数据推翻的自我回退（重要，如实记录）
为消除 `/work` 的外部依赖，我改动了 `cardLayers`：**没有本地文件的视频层不再产生层**，让卡片回落到图片层。理由是 `CardVideo` 对非激活的视频层返回空 div，看起来是 25% 处空白面板的成因。

结果指标**变差**：`work__0_top` meanAbsDiff 30.72 → **45.51**，cand luma 159.97 → **217.92**（更空白）。

原因：**原站精选封面本来就挂 Vimeo 背景播放器（`background=1&autoplay=1&muted=1`）并且能正常出图**。我把视频层删掉，等于把原站真实存在的内容删了 —— 用"离线纯度"换了保真度，而保真度是本项目的第一目标。

处置：**完整回退该改动**（恢复无条件 push 视频层、移除 `videoManifest` 导入与 `videoLayer`/`localVideoFor` 辅助函数），复测确认 `work__0_top` 回到 **30.72**，build 与 tsc 均 0。
教训：外部依赖问题应在**交付限制**里如实声明（已写入 `docs/asset-rights.md` / `docs/runbook.md`），不能靠删原站内容来"净化"。

## 三、`work__25pct` / `work__50pct` 空白面板：确认为真实缺陷（未修，下一轮首要目标）
先怀疑是"整页百分比在两页高度不同处错位"的测量假象，于是写了**语义锚点对齐**工具 `scripts/compare-anchors.mjs`，实测：

- `/work` 原站 docH **7625** vs 我们 **7721**（差 96px = 1.3%）
- `/about` 原站 docH **8654** vs 我们 **8639**（差 15px）
- 首个锚点 `"Where Opportunity Takes Root"` 两侧 `top` **完全相同（635 / 635，delta=0）**

→ **百分比基本对齐，假象说被推翻，空白面板是真的。**
目视确认（`r10w__work__25pct.png`）：CyberBrokers 与 The Examination 两卡只剩客户 meta + 衬线标题，**上方媒体区整块空白**。
根因指向 `CardVideo`：非激活的视频层返回空 `<div>`，而 `active` 索引由 `markLoaded()` 推进 —— **视频层永远不会调用 `onLoaded`**，所以一旦某卡的激活位落在视频层上，就出现"有高度、无内容"的空框。
下一轮修法（不删内容）：让视频层也参与 loaded 计数（iframe `onLoad` / 挂载即计），或在激活视频层之下**始终渲染该卡的图片层作为海报底**，Vimeo 播放器叠在其上 —— 这才与原站 react-player「挂载但隐藏」的行为一致。

## 四、工具新增
- `scripts/compare-anchors.mjs`：以原站的语义锚点（标题在文档中的绝对位置）为准，让两侧在同一内容位置截图配对，并输出 `docs/anchors/anchor-report.json`（含每锚点 delta）。**这是消除"百分比错位"这类假阳/假阴的基础设施。**
  - 已知仪器缺陷待修：文本 key 归一化不一致导致误报 MISSING（原站 `"National Geographic National Geographic"` 有空格、我们无空格；`MAX_ANCHORS` 截断也会漏配）。**MISSING 结论不可信，delta 与 docH 可信。**

## 五、硬门槛状态
| 项 | 状态 |
|---|---|
| `npx tsc --noEmit` | ✅ 0 错误 |
| `npm run build` | ✅ exit 0，51 页静态生成（含 42 条 SSG 案例路径） |
| 47 条路由证据冻结 | ✅ |
| `/work` + 42 案例内容完整性 | ✅ 门禁 PASS，42/42 DOM 验证 |
| 案例首屏 | ✅ 已修（r06，meanAbsDiff 73.81→14.15） |
| 菜单行为 | ✅ 25/25 |
| 首页 3D | ✅ live / 960,000 点 / 无降级；⚠️ 旅程仍偏暗欠推进（校准代理仍在跑） |
| `/work` 25%、50% 媒体空白 | ❌ 已定位根因，未修 |
| 真实 GPU 帧率 | ❌ 未测 |
| 字体与素材授权 | ❌ 未获（已声明） |
