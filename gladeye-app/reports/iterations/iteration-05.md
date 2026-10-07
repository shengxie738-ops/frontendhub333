# Iteration 05 — 环境稳定性根因 + 菜单功能缺陷修复

Reference: 2026-10-06 冻结集 · 主环境 1440×900 @dpr1 / SwiftShader WebGL2

## 一、本会话反复 500 的真正根因：构建缓存被多方争写

排查过程（不是一次看穿的，如实记录）：

1. 第一轮全站 500 时 `netstat` 显示 **3000–3005 共 6 个 `next dev` 进程同时存活**，全部写同一个 `.next` 目录。
   我上一轮误判"旧端口已随父调用消亡" —— 因为我的 grep 模式写错了（`:300[0-9] +[0-9]+` 抓到的是外部地址列的 `0`，不是 PID）。**仪器写错会直接导致错误的运维结论。**
   → 杀掉 5 个陈旧进程，清 `.next`，只留一个服务器（3005）。
2. 清完立刻复验：`/about` 200 / 45 标题、`/work` 200 / 47 标题、`/contact` 200、`/careers` 200 —— 全部健康。
   **并且**：上一轮"菜单打开后页面不能滚动、`body{position:fixed}` 永久泄漏"的结论**在干净环境下不成立**（`scroll position established` 从 FAIL 变 PASS，scrollY=1500 正常）。那批失败是缓存污染的假阳性，不是产品缺陷。**复测纪律避免了我去"修"一个不存在的问题。**
3. 但 500 又出现，且此时 `netstat` 确认**只有 3005 一个服务器**。报错为
   `Cannot find module './948.js'`（`.next/server/webpack-runtime.js`）+ `ENOENT .next/cache/webpack/server-development/0.pack.gz`。
   → 真因：**并行的 `npm run build` 与 `next dev` 共用 `.next`**，build 把 dev 的运行时产物覆盖掉。
   → 这是我的派工单缺陷：我一方面要求案例代理"必须跑通 `npm run build`"，一方面只禁止它"起新 server"，没有指出 build 本身会冲掉 dev 缓存。
   → 处置：build 必须在**停掉 dev server 之后**单独跑，跑完再重启 dev。已记入流程。

## 二、菜单：视觉完美但功能失效，根因是 effect 时序

在干净环境（步骤 2）下复跑 `scripts/test-shell-behaviour.mjs`，得到**真实且可复现**的 4 项失败：

| 检查 | 结果 |
|---|---|
| `/about` 可滚动、滚动位可设定 | PASS |
| Menu 按钮能打开覆盖层 | PASS |
| Escape 能关闭覆盖层 | PASS |
| 关闭后无残留半透明层 | PASS |
| **打开菜单时焦点进入面板** | **FAIL** — 焦点停在触发按钮 |
| **Tab 被困在面板内** | **FAIL** — 按 1 次就逃出 |
| **菜单打开期间页面滚动被锁** | **FAIL** — 试图滚到 2600，真的滚过去了 |
| **Escape 后焦点归还触发按钮** | **FAIL** — 焦点落在一个空 `<a>` |

**四个失败是同一个 bug**：`MenuOverlay` 的滚动锁与焦点陷阱 effect 只依赖 `[open]`，但面板是由**另一个** effect 才置 `mounted` 的（为了撑过退场动画）。于是 `open` 翻 true 的那一帧 `panelRef.current` 仍是 `null`，effect 命中 `if (!panel) return` 直接早退 —— **锁和焦点陷阱从未被安装**。

修复（`src/components/shell/MenuOverlay.tsx`）：
- 锁 effect 改为依赖 `[open, mounted]`，并显式 `if (!mounted) return;`
- 焦点陷阱改为 `useFocusTrap(open && mounted, panelRef, triggerRef)`
- 新增卸载兜底 `useEffect(() => () => releaseScrollLock(OWNER), [])`，防止开着菜单卸载组件时泄漏锁

`tsc` 在该文件 0 错误。**运行时复验被上一节的 build/dev 冲突挡住，尚未完成** —— 不把它记为已验证。

## 三、我的测试仪器自身的两个错（都已纠正）

1. 覆盖层选择器写成 `[class*=Menu_overlay], [class*=Menu_panel], [role=dialog]`，而真实 DOM 是 `<nav id="site-menu">` + 内部 `div.h-screen.overflow-y-auto`。选择器不匹配会让"焦点是否在面板内"产生假阴性。已改用 `#site-menu`。
2. `verify-work-content.mjs` 把 `p.next` 当字符串读（实为 `{slug,title,client,headingDoc,source}`），误报 42 个 dangling nextSlug。

## 四、新发现、待验证的缺陷

`page.click(Menu)` 超时，Playwright 报：
> `<img alt="Gladeye" … class="blur-lg …" src="/sites/gladeye/about/…jpg"/>` from `<main class="bg-black">…</main>` subtree **intercepts pointer events**

即内容区的图片在 Menu 按钮位置之上拦截了点击。页头是 `z-Header`(200) + `pointer-events-none`（交互子元素 `pointer-events-auto`），`main` 是 `z-main`(100)，理论上页头在上。**需在干净环境复现确认**：可能是图片自身创建了堆叠上下文，也可能是页头在该滚动位置未覆盖该点。若成立，这是 P1 交互缺陷（菜单在部分滚动位置点不动）。

## 五、本轮已完成的实质交付

- **42/42 案例页 DOM 验证**：用上一轮补抓的 28 页冻结 HTML 重跑 `build-work-data.mjs`，`dom-verified case pages: 42`（此前 14），`unknown prose nodes: []`、`unsupported components: []`、`dom mismatch: []`。案例代理随后重建 `projects.json`，我用门禁复查确认 **42 true / 0 false / 0 unset** 未被冲掉。
- **`scripts/verify-work-content.mjs`** 内容门禁 PASS（exit 0）：42 项目 block 非空、媒体非空、标题唯一、nextSlug 有效、强制 `blocksFromDom === true`。
- **`scripts/test-shell-behaviour.mjs`** 新增：菜单焦点/锁/嵌套/历史/减少动态/深链刷新 共 20+ 项行为断言（此前完全无覆盖）。
- **`docs/runbook.md`**：17 条验收命令 + 采集环境钉死 + 素材再生成 + 已知限制。
- 运维：清理 5 个争写 `.next` 的陈旧 dev server，固定单一端口 3005。

## 六、硬门槛状态（严格）

| 门槛 | 状态 |
|---|---|
| 47 条路由证据冻结 | ✅ |
| `/work` + 42 案例内容完整性 | ✅ 门禁 PASS |
| 首页 3D live / 无降级 / 960,000 点 | ✅（旅程修复进行中） |
| 字体真字面生效（含真斜体） | ✅ |
| 页脚按原站语义挂载 | ✅ |
| 菜单焦点陷阱与滚动锁 | ⚠️ **已定位并改码，运行时未复验** |
| 页头被内容遮挡导致点不动 | ❓ 待复现确认 |
| `npx tsc --noEmit` 全工程 0 错误 | ❌ 12 个（案例层在修） |
| `npm run build` | ❌ **从未成功** |
| 真实 GPU 帧率 | ❌ 未测 |

## 七、下轮
1. 停 dev → 单独跑 `npm run build` → 重启 dev → 复验菜单行为门禁（验证第二节的修复）。
2. 复现并修 `/work` 三缺陷（封面停在模糊态、无视频时未回退 image 层、缺 `vv`+三色点装饰）。
3. 复核旅程修复的**可复现性**（我独立跑两次对比）。
4. 确认页头遮挡问题是否成立。
