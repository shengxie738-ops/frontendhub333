# Iteration 06 — 生产构建打通 + 案例首屏全黑（P0）修复

环境：`npm run build` → `next start -p 3005`（**全部结论来自生产构建**，不再用 dev）· 1440×900 @dpr1 / SwiftShader WebGL2

## 一、硬门槛首次达成
- `npx tsc --noEmit` → **0 错误**（全工程）
- `npm run build` → **exit 0**，51 个页面全部静态生成：`/`、`/about`、`/careers`、`/contact`、`/work`、`/_not-found`，`/work/[slug]` 以 SSG 输出全部 42 条路径。首页 169 kB / First Load 256 kB。
- 生产服务器路由复验：`/` `/work` `/about` `/contact` `/careers` `/work/cyberbrokers` `/work/mitoq` `/work/templar` 全部 200 且含真实内容。

## 二、菜单行为：25/25 全通过（此前完全无覆盖）
新增 `scripts/test-shell-behaviour.mjs`，覆盖焦点陷阱、滚动锁、Escape 归还焦点、快速开关泄漏、嵌套锁、导航时关菜单、浏览器 Back 复原、减少动态、深链刷新。

修掉的真实缺陷（**视觉截图永远查不出**）：
1. **effect 时序导致锁与焦点陷阱从未安装**：`MenuOverlay` 的锁/陷阱只依赖 `[open]`，而面板由另一个 effect 才置 `mounted`，所以 `open` 翻 true 那一帧 `panelRef.current` 仍是 null，effect 命中早退。→ 改为依赖 `[open, mounted]`，并加卸载兜底释放锁。
2. **菜单在已滚动页面打开时整个页头被推出视口**（Close 按钮点不到）。根因：滚动锁用 `body{position:fixed; top:-Y}`，而页头是 `fixed inset-x-0` **未声明 `top`**，其 used value 取自静态位置，body 一移它就跟着移。
   - 我先试过"去掉 body:fixed 只用 `html{overflow:hidden}`"——**这是错的**：它挡不住程序化 `scrollTo`，滚动锁直接失效（marker −1500→−2600）。已回退。
   - 正确解：保留 `body:fixed`，给页头补 `top-0`。这对未锁定状态的计算布局完全等价（页头本就贴顶），但锁定时不再被推走。
3. 观测量纠正：`body{position:fixed}` 下 `window.scrollY` 必然为 0，用它断言"是否锁定"是错的；改用内容元素的 `getBoundingClientRect().top`（marker −1500 → −1500 才算锁定）。

结果：**25/25 PASS，exit 0**。

## 三、P0：42 个案例页首屏全黑（已修复并量化）
`case-into-the-amazon__hero` 亮度只有 **2.62**（原站 73.27），整屏只有页头。逐层排查：

- 素材没问题：本地 `1728x1080-…-thumbnail_hero.jpg` 实测 meanLuma **85.6**，与原站首屏 73.27 同量级。
- 分层没问题：竖版层 `display:none`、横版层 `display:block` 1440×900，方向工具类 `portrait:hidden` / `landscape:hidden` 与原站一致。
- 也不是 opacity：祖先链逐节点量出来全是 `op:1`。
- **真因是布局塌陷**：链上 `div.gl-reveal` 高度为 **0** —— `Reveal` 渲染的包裹 div 是 static 定位、子元素 `CaseImage` 又是 `position:absolute`，父元素没有内容可撑高而塌陷；其下 `h-full` 全部继承成 0，图片最终 **1440×0**。

修复：`CaseHero` 两处 `<Reveal>` 补 `className="h-full w-full"`。
验证：7 个案例页首屏图全部 **1440×900** 可见；`case-into-the-amazon__hero` meanAbsDiff **73.81 → 14.15**，亮度 **2.62 → 72.04**（原站 73.27），σ 45.09 vs 44.51。

## 四、顺带修掉的两处
- `CaseImage` 的清晰层只靠 `onLoad` 置真；本地图片常在 React 挂 handler 前就解码完 → 永久 `opacity:0`。改为 ref 挂载时检查 `complete && naturalWidth>0`，并加 `onError` 兜底。
- `CaseImage` 的 LQIP 占位层 src 是 `${asset.src}/m/20x0` —— **直接热链原站 Storyblok**，违反 plan §11.5"运行时不得依赖外部域名"。本地无 600+ 个 20x0 变体，改为使用 frame 自带的 `frameBackground` 色（原站本就有该属性），不新增任何外部请求。

## 五、`Reveal` 的两个通用缺陷（影响所有用它的地方）
1. **零面积目标永不被观察**：`IntersectionObserver` 对 0×0 元素从不判定相交。已改为：优先观察第一个有面积的子孙；若整条链都没有面积，直接放行（否则永久隐藏）。
2. **挂载时已在视口内却因 `rootMargin: 0 0 -10% 0` 不显示**：该下边界收缩是为"从底部进入"的元素调的，会把已经可见但落在最后 90px 的内容排除（实测 H1 在 top:838、收缩线在 810，差 28px 而永久隐藏）。已加挂载时的纯视口判定。

## 六、仍未解决（严格列出）
- **旅程**：`home__01_stable` meanAbsDiff 36.36（r01 曾 31.85），中段 `scroll-x3..x6` 亮度 28–34 vs 原站 42–47，`scroll-x10` 33.03 vs 65.23 —— **现在整体偏暗、欠推进**。校准代理已收尾，其定步长改动已进构建；下一步要处理它标记为"先取证再动"的**远端复制带 x 锚点**。
- **`/work` 精选封面停在模糊态**：`FeaturedWorkGrid` 的 `CardImage` 有与 `CaseImage` 完全相同的 `onLoad` bug，尚未同样修。
- **`work__25pct` / `work__50pct` 差异 114.92 / 92.63**：部分是"整页百分比在两页高度不同处错位"的测量假象，需改用语义锚点复测后才能判定是否为真缺陷。
- **案例页内仍有 1 个实时 Vimeo iframe**（`player.vimeo.com/1079737092`）—— 外链，违反离线要求，需改为本地海报 + 显式 blocked。
- 真实 GPU 帧率未测；字体与素材许可未获授权（见 `docs/asset-rights.md`）。

## 七、下轮三件事
1. 把 `FeaturedWorkGrid.CardImage` 按 `CaseImage` 同样方式修好（onLoad → complete 检查），并让无本地视频的精选层回退到 image 层。
2. 旅程：取证远端复制带 x 锚点，再决定几何改法；目标 `scroll-x10` 亮度 33 → 65。
3. `/work` 复测改用语义锚点，剔除百分比错位假象。
