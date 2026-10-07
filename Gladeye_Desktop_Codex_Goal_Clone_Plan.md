# Gladeye 桌面端高保真复刻 — 设计规范与 Codex Goal 执行方案

> **目标网站**：https://www.gladeye.com/  
> **编制日期**：2026-10-07  
> **文档版本**：v1.0 · 公开证据研究版  
> **交付对象**：在具备浏览器、代码编辑和终端能力的环境中执行的 Codex。  
> **交付目标**：桌面端、多页面、可交互、可验证的高保真前端复刻，不是同风格重新设计。  
> **执行方式**：以 Goal 管理持续目标；在预算与权限范围内反复观察、实现、截图、比较、修正。已安装 Superpowers 时，可使用 `executing-plans` 按任务执行；没有该技能不构成安装整套插件的理由。

**Goal**：还原目标网站在桌面浏览器中的主要公开页面、视觉构图、媒体内容、滚动行为、鼠标响应、菜单与页面切换；以冻结的原站参考集和可复现的浏览器测试证明完成。

**Architecture**：将语义 DOM、可选的实时图形层、统一动效调度和内容数据分离。视觉效果是否使用实时 3D，必须先通过原站浏览器观察与媒体请求确认，再确定实现路线。

**Tech Stack**：新建项目默认 Next.js + React + TypeScript + CSS Modules；动效默认 GSAP；存在真实需要时加入 Lenis、Three.js。它们是复刻项目的推荐选型，不是全部已证实的原站依赖。

**Spec**：设计规范、技术边界和验收条件均包含在本文中；无需依赖其他未随附文档。第 1—12 节定义目标与实现约束，第 13—18 节定义任务、迭代和交付。

---

## 0. 执行前必读：证据边界与优先级

### 0.1 本次研究已经获得什么

本次已阅读官网首页的可解析内容、作品目录、About、Contact、Careers，以及多篇官网案例说明；已核查官网图片链接中的 Next.js 图片优化路径和 Storyblok 资源域名；已查看公开展示页中的首页花草场景参考图；已核对相关框架与 Codex Goals 的官方文档。来源索引见第 19 节。

**本次没有完成原站的实时浏览器逐帧观察、HAR 网络包导出、JS bundle 检查、字体文件识别、3D 模型下载或性能实测。** 当前研究环境对部分原始资源返回缓存缺失或访问失败。因此，本文件不声称已拿到花草 GLB、不声称已量出相机参数，也不把展示页上的静态截图说成当日原站浏览器截图。

部分网页解析结果来自搜索服务的缓存，抓取时间不一致；页脚年份也不代表当前版本。执行时必须先捕获实际可访问的原站，冻结一个一致的参考版本。新捕获与本文件冲突时，以有时间戳的新证据为准，并记录差异，不能把两个年代的页面拼成一个不存在的网站。

### 0.2 全文证据标签

| 标签 | 定义 | 能否直接作为实现事实 |
|---|---|---|
| `CONFIRMED-PAGE` | 官网可解析内容或官网实际链接中直接存在 | 可以用于确认页面、内容类型、资源路径；不代表布局和时序已经确认 |
| `CONFIRMED-RELATED` | 官方对另一个客户项目的技术说明 | 只能作为技术参考，不能证明 Gladeye 官网使用相同实现 |
| `VISUAL-REFERENCE` | 公开展示图中可直接观察到的静态视觉 | 可以指导构图分析；不能单独证明滚动、循环、鼠标或真实 3D 行为 |
| `INFERRED` | 根据技术指纹或视觉做出的推断 | 必须明确标注；重要推断需在 Phase 0 验证 |
| `PROPOSED` | 本复刻项目的建议实现与初始参数 | 可以作为实验起点；不能称为原站参数 |
| `UNVERIFIED` | 尚无足够证据 | 不得虚构为事实；加入待核验表 |

### 0.3 全局约束

- 只做桌面端；主验收视口为 `1440×900`，同时覆盖 `1366×768`、`1920×1080`、`2560×1440`。像素尺寸均指 CSS viewport，不能用显示器物理分辨率替代。
- 忠实复刻优先于“设计得更好看”。不得自行加入蓝紫渐变、玻璃卡片、宇宙粒子、仪表盘、3D 金属球或其他原站没有的视觉元素。
- 覆盖公开站内路由及其不同模板；不把范围缩成一个首页，也不扩大到案例中链接出去的客户网站。
- 内容、字体形态、图片裁切、动画触发和页面切换都是质量的一部分；通过编译不等于通过复刻验收。
- 不建立真实业务后端，不连接原站表单，不向第三方发送测试邮件或订阅请求，不复制跟踪脚本。
- 保留现有仓库中与任务无关的代码和用户未提交改动；不强制重建工程或切换框架。
- 不绕过登录、验证码、付费限制或资源权限；不枚举 CMS 私有内容。使用有权使用的素材，资源可公开访问不代表获得再发布许可。
- 不自动购买素材、开通服务、部署公网、推送 GitHub 或创建 PR。需要这些动作时单独获得授权。
- 不把占位图、2.5D 降级、未知字体或缺失路由静默记为完成。
- 文档内一切未标为实测的数值均是项目初始约束或建议，不是测量结果。

### 0.4 审查重点

1. 原站首屏究竟是 WebGL、视频、图像序列，还是混合方案？判断错误会让后续大量工作偏离目标。
2. 多次切换路由和打开菜单后，滚动位置、焦点、渲染循环和资源释放是否正确？
3. 低高度桌面窗口中，标题、菜单和底部 CTA 是否被裁切？
4. 资源失败、WebGL 不可用或用户减少动态效果时，是否仍可浏览和导航？
5. 检查截图时，是否使用了同一视口、字体、页面状态和动画阶段，而不是拿两个不同状态比较？

---

## 1. 对 Gladeye 的站点专项研究结论

### 1.1 首页的视觉辨识度来自哪里

公开展示图中可见：极暗背景中分布着大量绿色枝叶，以及粉、紫、黄橙色花朵；不同距离的植物呈现明显不同的清晰程度；中部保留暗色空间以承载大号白色衬线文字；品牌字标、菜单按钮和探索作品的 CTA 相对克制。[S06]

参考图中的标题为 “Creative innovation for a regenerative future”，其中斜体词形参与标题层级；CTA 为 “Explore our work”。这些是静态参考图中可见的信息，不保证当前线上文案与图中完全一致。[S06]

**设计判断**：它的核心不只是“黑底加很多花”，而是以下关系：

| 视觉层 | 应重建的关系 | 常见低质量替代 |
|---|---|---|
| 暗部与负空间 | 植物密集区域与可阅读的暗部形成对照，黑色具有纵深而非一块平涂背景 | 将整屏均匀撒满植物或发光粒子 |
| 植物形态 | 枝叶、花朵、茎与成簇分布共同构成轮廓，不是均匀重复同一种几何体 | 用小球、彩点或 emoji 花朵替代 |
| 景深 | 前景模糊、中景可辨、远景衰减形成层次 | 对整张 Canvas 统一加 `blur()` |
| 字体对比 | 编辑感衬线标题与紧凑导航之间形成反差，字形与换行非常重要 | 所有文字统一使用默认无衬线字体 |
| 界面密度 | 导航退居其次，画面和文字关系成为注意力中心 | 顶部堆满按钮与多列普通营销卡片 |
| 色彩 | 花色作为小面积高饱和点缀，暗绿与黑维持整体气氛 | 全屏增亮、强 Bloom、荧光化处理 |

需要特别注意：当前展示图有裁切，**不能据图武断认定 Menu 在正中央还是右侧，也不能据图量出标题字号、镜头 FOV 或按钮边距**。这些全部需要原站桌面截图与 DOM 测量。

### 1.2 已能确认的页面结构

| 页面 | 已核实的信息 | 仍需浏览器核实 |
|---|---|---|
| `/` | 有菜单和页脚联系、社交、招聘、订阅相关内容 [S01]；另有花草首页静态参考 [S06] | 首屏加载顺序、首页完整段落、滚动方向、作品 CTA 去向、图形机制 |
| `/work` | 有精选项目、作品档案及 showreel 入口 [S02] | 精选区域是否固定/轮换，档案是否 hover 预览，媒体与列表如何联动 |
| `/work/[slug]` | 多篇案例包含项目介绍、客户/分类/日期、内容章节、图片、下一项目 [S07—S12] | 每类媒体布局、图片进场、章节间距、页面切换 |
| `/about` | 包含机构介绍、服务、工作方法、奖项与媒体内容 [S03] | 栏宽、字体比例、图片编排、是否有横向或固定区域 |
| `/contact` | 有多语言问候语、联系与社交信息 [S04] | 问候语如何运动：轮播、跑马灯、滚动驱动或其他机制 |
| `/careers` | 有招聘介绍及大量媒体链接 [S05] | 图片是列表、拼贴还是交互画廊；是否存在仍可访问的职位详情 |

作品目录存在精选与档案两类内容，不应把它简化成 6 张卡片。官网案例中的“Visit Site”指向客户站点；它不是要求本项目继续克隆客户站点的入口。

### 1.3 技术栈：直接证据与推断分开

| 技术/能力 | 当前证据 | 结论 |
|---|---|---|
| Next.js 图片优化链路 | 官网真实图片链接为 `/_next/image?...&url=...&w=3840`；该路径是 Next.js 图片优化 API 的默认路径 [S02][S03][S14] | **强技术指纹**，高度支持 Next.js 图像链路；不据此识别具体版本或路由模式 |
| Storyblok 资源托管 | 图片 URL 内含 `a-us.storyblok.com/f/1014779/...`；Storyblok 文档确认该域名用于其美国区域资产 [S15] | **资源使用可以确认**；整个内容后台是否都用 Storyblok，仍需网络或官方说明 |
| React | Next.js 的技术关系，以及团队其他项目公开采用 React [S07][S10] | 官网使用 React 是高置信推断；不把具体 React 版本写死 |
| Three.js / WebGL | 参考图呈现三维景深感；团队其他作品有明确 WebGL/Three.js 说明 [S07][S09][S10] | **官网自身尚未运行时确认**；视觉看起来像 3D 不等于已经证明实时 3D |
| GSAP / Lenis | 本次没有官网 bundle 或运行时证据 | **复刻建议，不是原站事实** |
| Framer Motion | 官网案例对 EQTY Lab、Storyblok 案例对 CyberBrokers 有明确说明 [S08][S10] | 仅能确认相应客户项目，不能直接移植结论到官网 |
| Tailwind / CSS Modules | CyberBrokers 项目资料存在此说明 [S10] | 不足以证明官网自身采用同样样式方案 |
| Blender | CyberBrokers 3D 资产生产流程有明确说明 [S10] | 适合本项目资产制作，但原站首页的 DCC 工具未确认 |
| 首页植物 GLB、HDRI、贴图、字体名、shader | 尚未拿到对应请求与文件 | **未知**，禁止编造路径、模型数量或字体名称 |
| 托管商、数据库、后端服务 | 本次证据不足 | 前端复刻不依赖还原这些基础设施 |

### 1.4 已发现的真实资产线索

以下是官网页面图片链接中解出的资源地址；本次**未成功下载验证二进制文件**。尺寸取自 URL，不是解码后的检测结果。文件名也不能直接证明对应页面中的视觉内容。

```text
# 来源：/work 中的图片链接
https://a-us.storyblok.com/f/1014779/5614x3743/c0c68bef31/smugglers2.jpg
https://a-us.storyblok.com/f/1014779/1280x1280/0faec493dd/adobestock_233213881.jpg

# 来源：/about 中的图片链接
https://a-us.storyblok.com/f/1014779/4032x3024/5077b19f33/img_0720.jpg

# 原站中观察到的图片优化包装形式
https://www.gladeye.com/_next/image?q=80&url=<URL_ENCODED_ASSET_URL>&w=3840
```

这些地址的价值是确定资源发现路径，而不是鼓励盲目下载 CMS 空间所有素材。必须通过页面、DOM、网络请求确定“哪张图在哪个位置、何时出现、如何裁切”。

### 1.5 不能从客户案例移植到官网的效果

Gladeye 对 The Virtual Economy 描述了滚动控制 WebGL 镜头和场景衔接；对 Ekos 描述了烘焙灯光与画廊；对 Into the Amazon 描述了 WebGL 与 HTML/React 的统一动画编排。[S07][S09][S12]

这些资料可提供工程方法，**不能证明 Gladeye 官网拥有相同镜头轨迹、画廊或章节结构**。本任务复刻的是 Gladeye 的机构官网，而不是这些客户项目的合集。

---

## 2. 范围定义：什么叫“完整复刻”

### 2.1 路由范围

建立 `evidence/route-inventory.json`。范围是从首页、主导航、作品目录、页脚和站内下一项目入口可发现的公开页面；同域同内容的 query/hash 变体去重，外域停止遍历。

已确认的主页面种子：

```text
/
/work
/about
/contact
/careers
```

已确认存在或官网链接指向的案例种子如下。这里仅作为发现入口，不代表全部目录，也不要求按此顺序展示：

```text
/work/into-the-amazon
/work/the-dj-and-the-war-crimes
/work/hypercinema
/work/cyberbrokers
/work/the-examination
/work/the-sweetshop
/work/social-mobility-in-the-digital-age
/work/eqty-lab-website
/work/ekos-genesis
/work/the-virtual-economy
/work/openavn
/work/wildsam
/work/where-opportunity-takes-root
/work/templar  # 已发现官网链接，本次抓取失败；需检查当前 HTTP 与页面状态
```

后续从 `/work` 收集剩余链接，并逐一记录状态。原站本来失效的页面记录为 `source-unavailable`，不能伪造内容；不应把失效页面计入可完成内容的分母，但必须保留失效证据与排除理由。

### 2.2 三层覆盖，不可偷换

**路由覆盖**：可访问的站内路由能够在本地直接打开、刷新并前后导航。

**内容覆盖**：每个案例拥有自己的标题、媒体、章节、元信息和下一项目关系，不是几十个路由共用同一个假页面。

**视觉覆盖**：不同模板和特殊布局都经过对照；不能仅验证路由返回 200 就声称页面效果一致。

主导航、精选案例及特殊布局做完整截图和交互测试；普通档案案例做首部/中部/尾部抽样视觉检查与全量内容结构测试。任何没有逐屏比对的页面在报告中明确其检查深度。

### 2.3 非目标

不做移动端菜单或触摸手势优化；不做真实招聘投递、订阅平台、CRM、内容管理后台、用户账户或数据库；不复刻客户网站；不擅自替换为用户其他品牌；不照搬原站分析埋点。

桌面范围不等于忽略无障碍：键盘、焦点、减少动态效果、文字选择、浏览器返回仍须工作。

---

## 3. Phase 0：浏览器取证与参考版本冻结

**在拿到足够的当前视觉证据前，不得把花草场景当成已知 Three.js 项目直接开写。** 可以并行搭建测试目录、路由清单和资源清单，但不可宣称已开始高保真还原未知效果。

### 3.1 环境检查

读取仓库根目录、`package.json`、锁文件、已有开发说明与目标目录。避免一上来扫描全仓库、依赖目录或历史构建产物。

记录：

```text
OS / 浏览器版本 / Node 与包管理器版本
可用浏览器控制工具 / 截图能力 / 网络记录能力
CSS viewport / devicePixelRatio / 缩放比例
WebGL 可用性 / renderer 信息 / 是否软件渲染
外网访问 / 本地服务访问 / 可写目录
当前分支 / 未提交改动 / 现有依赖
```

优先用 Codex 环境中实际可调用的浏览器工具；能够使用内置浏览器时直接使用。需要自动回归时再建立 Playwright 脚本，不为读取网页安装无关工具。

云端软件渲染可以用于结构与状态测试，不能作为真实桌面 GPU 帧率达标的证明。无法联网或无法截图时，记录 blocker，继续不依赖缺失证据的任务；不得拿文字解析冒充视觉验收。

### 3.2 参考目录

```text
evidence/
  source-version.json
  environment.json
  route-inventory.json
  navigation-graph.json
  source-pages/             # 页面文本、语义结构与必要 DOM 信息
  source-screens/           # 原站视口截图
  source-motion/            # 短视频、事件轨迹、关键帧与时序表
  source-network/           # 脱敏后的请求元信息
  typography.json
  layout-measurements.json
  motion-inventory.json
  asset-discovery.json
  gaps.md
```

原始 reference 放在应用 `public/` 之外，避免误发布取证材料。不要把 HAR 中的 Cookie、Authorization、个人数据或不必要的查询凭据提交到仓库。

### 3.3 每页先看五类状态

| 状态 | 观察动作 | 产出 |
|---|---|---|
| 进入 | 冷启动，记录导航开始、DOM 就绪、字体就绪、关键媒体就绪 | 加载时序、首帧/稳定帧、失败分支 |
| 静止 | 固定指针，停止滚动观察 5—10 秒 | 时间驱动的呼吸、漂浮、自动轮换是否存在 |
| 指针 | 中心→左上→右上→右下→左下→中心 | 局部响应、视差、按钮 hover、是否有自定义光标 |
| 滚动 | 慢速下滚、快速下滚、反向滚、停顿、回到起点 | 页面位移、镜头/内容变化、sticky/pin 边界 |
| 导航 | 菜单开关、站内跳转、浏览器前进后退、直达 URL | 页面切换、滚动恢复、焦点与媒体释放 |

初次探查可按每次约 `0.5×viewportHeight` 的步长向下走，用于寻找段落；正式对照使用语义锚点和真实动画触发区间。不能只用整页百分比，因为两个页面高度不同时会错位。

### 3.4 首页必须回答的问题

在 `evidence/gaps.md` 中给出证据支持的答案：

- 花草背景是 `<video>`、`canvas`、图片序列还是混合？
- 存在 Canvas 时，其上下文是 2D、WebGL 或其他？Canvas 存在是否真的对应背景，而非分析图或隐藏控件？
- 鼠标移动改变相机、植物组、后期效果，还是仅改变 UI？哪些变化是时间自行推进造成的？
- 滚轮滚动究竟驱动页面、镜头、作品选择还是跳到另一路由？
- CTA 是路由跳转、滚动定位、展开内容，还是一个过渡入口？
- 首屏标题是否逐行出现、分阶段消失、始终固定？斜体究竟覆盖哪些词？
- 前景花草穿过镜头时是否发生遮挡、大小改变和独立视差？
- 页面失焦、菜单打开、进入作品详情时背景是否继续运行？
- 原站是否允许跳过加载？资源失败后是否仍有导航？

每个回答记录 screenshot/video/request 的 evidence ID。不能用“看起来应该是”替代答案。

### 3.5 3D、视频与 2.5D 的判别

| 观察结果 | 更可能的实现 | 实施动作 |
|---|---|---|
| MP4/WebM/HLS 请求，video.currentTime 随时间或滚动变化 | 视频或视频纹理 | 优先复刻播放、时间映射、裁切、前景 UI；不要无必要重做全部 3D |
| Canvas 与模型/纹理请求，指针改变独立物体遮挡与透视 | 实时 3D 或混合 | 分析场景、材质、相机和图形性能 |
| 多张透明图片，层间固定视差而无几何遮挡变化 | 分层 2.5D | 还原层次、透视与裁切，不无必要引入完整场景 |
| 仅有 Canvas，没有显式 GLB 请求 | 可能程序生成、内联资源、视频纹理或自定义二进制 | 检查关联请求和渲染行为，不能据此断言没有模型 |

页面视觉可由多种技术组合构成。执行选择以证据和保真需求为准，而不是为了“技术高级”强行使用某库。

### 3.6 网络与资源采样

在导航前开启请求记录，完成首屏、滚动、菜单、showreel、案例跳转后分别增量保存。

需要识别的类型：HTML、CSS、JS chunk、字体、图像、视频、HLS manifest、glTF/GLB、KTX2/Basis、HDR/EXR、WASM 解码器与 JSON 配置。既看扩展名，也看 `Content-Type`、initiator、response size；无后缀 URL、blob URL 与带 query 的资源不能漏掉。

只分析已被目标公开页面请求的资源。JS 中出现 `three`、`gsap` 或 `lenis` 只能先记为依赖线索，需进一步确认它参与当前效果；不要求逆向整个压缩 bundle，不暴力扫描 source map 或 CMS API。

### 3.7 原站截图集

主视口下至少覆盖：

```text
home__stable-center
home__pointer-left / home__pointer-right
home__scroll-key-N               # 由实测段落生成，不预设不存在的滚动剧情
menu__open / menu__hover-item / menu__closing-mid
work__featured-N / work__archive-top / work__archive-mid / work__archive-bottom
work__hover-preview              # 仅原站存在时
showreel__opening / showreel__playing / showreel__closed
case-[representative]__hero / body-N / next-project
about__hero / services / process / awards
contact__greeting-phase-N / details
careers__hero / media-N / footer
```

每张截图旁保存：源 URL、采样时间、viewport、DPR、scroll container 与位置、指针坐标、就绪条件、动画阶段说明。整页截图可以辅助查缺，但不能代替 fixed、sticky 与 3D 动效的视口关键帧。

### 3.8 Phase 0 完成门槛

有冻结的路由清单、主页面参考图、首页实现类别判断、字体/图片来源线索、主要交互时序和明确缺口清单，才能进入高保真制作。

不能因为个别旧案例失效而停止整个任务；也不能因为首页可解析文字太少就脑补所有页面。

---

## 4. 资产策略：先解决素材，再微调视觉

### 4.1 资产清单字段

创建 `src/content/assets.manifest.json`，每个字段都必须有清晰含义：

```json
{
  "id": "home-botanical-environment",
  "role": "hero-scene",
  "sourcePage": "https://www.gladeye.com/",
  "sourceUrl": null,
  "localPath": null,
  "kind": "unknown",
  "discoveryStatus": "pending-runtime-inspection",
  "downloadStatus": "not-attempted",
  "rightsStatus": "unverified",
  "evidenceIds": [],
  "sha256": null,
  "bytes": null,
  "width": null,
  "height": null,
  "durationSeconds": null,
  "licenseNote": "",
  "replacementNote": null
}
```

此示例有意保留 `null`：没有拿到资源就是未知，不能填一个想象中的 `flowers.glb`。实现时使用 schema 校验，失败资源和被替代资源不得拥有误导性的 `verified` 状态。

### 4.2 资产优先级

**P0：决定辨识度。** 首屏关键媒体、植物模型/图层、关键贴图、主字体及斜体、品牌标志、作品首屏封面。

**P1：决定完整度。** 案例视频与图片、About/Careers 媒体、showreel、项目预览、图标。

**P2：细节。** 次要纹理、低频装饰、可重建的小图形。没有原站证据的“噪点纹理”和“发光贴图”不能自动加入。

### 4.3 使用顺序

1. 有权使用且公开提供的原始资产，保持来源与校验值。
2. 用户提供的授权素材或可验证许可的等效资产。
3. 根据参考重新制作的植物、图层或几何，记录其重建性质与差异。
4. 视频/2.5D/静态降级仅用于明确的 fallback 或阶段占位；如果原站是可交互 3D，不得把降级方案当作完整达标。

字体名称确认后，先检查用户是否有对应许可。不得从环境中随意拷贝字体文件进入交付包；没有授权时记录替代字体的字形与字宽偏差，不伪装原字体。

### 4.4 下载与本地化要求

仅对资源清单中的具体 URL 下载；限速并限制并发；失败做有限重试。校验 HTTP、MIME、实际文件头与非空内容，避免把错误 HTML 保存为 `.glb` 或 `.jpg`。

优先保留正确源图，而不是只保存微小预览。使用图片优化链接时，从其 `url` 参数识别来源，但资源可访问性与使用许可仍需单独确认。

需要上传 Git 的大体积文件先检查仓库政策与 LFS；不能自动把大量视频塞进 Git 历史。敏感 HAR 与未经授权的素材不进入公开仓库。运行时避免热链到原站，以免依赖 CORS、URL 变更或消耗原站带宽。

### 4.5 图像与视频检查

逐个记录原始比例、展示框比例、object-fit、object-position、海报帧、视频静音与循环状态。不能用 `object-fit: cover` 掩盖所有裁切问题。

如果是滚动控制视频，验证 seekable 范围、关键帧密度、快速反向滚动表现；不能在每一帧无条件赋值 currentTime。跳转需节流或基于就绪与误差更新。HLS 场景只在证据显示需要时加入播放器，普通 MP4 不引入额外 HLS 库。

### 4.6 3D 文件检查

拿到 glTF/GLB 后记录场景层级、mesh 数、三角面、材质、纹理尺寸、动画、坐标轴、单位、摄像机、灯光、扩展和外部依赖。

按实际扩展配置 Draco、Meshopt 或 KTX2，不把所有解码器一股脑加载。KTX2 转码器需要与渲染器能力匹配，且必须验证解码器部署路径；Three.js 文档要求加载前完成对应能力检测。[S17]

---

## 5. 推荐实现架构

### 5.1 三条路线的选择

| 路线 | 适用条件 | 优势 | 边界 |
|---|---|---|---|
| A：实证驱动的等效实现，默认推荐 | 能观察交互，能获得或制作关键素材 | 源码可维护，视觉与行为可分别校准 | 不需要与原站每个依赖完全相同 |
| B：合法可用资产 + 接近原站结构 | 已确认关键模型、媒体、字体来源与许可 | 更快逼近材质、镜头与媒体质感 | 不能直接搬运整站 bundle 或私有 CMS 配置 |
| C：明确标注的近似重建 | 原始素材不可用，但参考足够 | 可以继续推进，避免空白等待 | 关键 3D/字体差异必须保留，不能冒充像素级复刻 |

先实施 A；能合法取得关键资产时采用 B 的资产策略。不要在未经验证的“纯代码生花”上无限耗费迭代预算。

### 5.2 默认技术分工

| 组件 | 推荐职责 | 不应承担的职责 |
|---|---|---|
| Next.js / React | 路由、语义结构、内容模板、客户端生命周期 | 每帧更新成千上万个植物的 React state |
| CSS Modules + tokens | 精确排版、布局、状态样式 | 用一组通用卡片样式统一原站不同模板 |
| GSAP | 进入退出、菜单、文字、滚动相关时间线 | 与 CSS/Motion 同时控制同一元素同一 transform |
| Lenis，可选 | 证实需要时，统一平滑滚动 | 无证据的强滚动劫持；与原生 smooth 双重叠加 |
| Three.js，可选 | 已确认实时图形时的场景、相机、材质、后期 | 把可选择文字与整页排版全部画进 Canvas |
| 本地 JSON/TS 内容 | 固定参考版本的页面数据、资源关系 | 连接原站 CMS、添加无必要数据库 |
| Playwright | 路由、状态、截图、真实输入回归 | 用截图通过代替主观构图审查和 GPU 实测 |

新项目锁定一组互相兼容的实际版本，提交唯一锁文件；先检查官方安装要求和 peer dependencies，不在文档里虚构“当前原站版本”。已有 React/Vite 工程可保留；有充分理由才更换框架。

### 5.3 单一动效责任与渲染时钟

默认只保留一个 Lenis 实例、一个全局图形运行时和一条明确的每帧更新链。使用 GSAP ticker 驱动 Lenis 时，不再启用 Lenis 自己的自动 rAF。[S18][S19]

建议更新顺序：

```text
输入事件记录目标值
  → 滚动系统更新
  → 更新 ScrollTrigger/章节进度
  → 时间线计算 DOM 与 SceneState 目标
  → 相机/材质/植物姿态采样
  → 一次图形渲染
```

控制字段必须有唯一写入者。可以将 GSAP ticker 作为时钟，但必须保证采样在本轮动画更新后、渲染前完成。不要另建互相竞争的 `requestAnimationFrame` 循环。

如果原站首屏是视频，则图形运行时可替换为媒体控制器。不要为了文件树完整而保留空的 Three.js 依赖。

### 5.4 推荐文件结构

以下用于新建 Next.js 项目；已有仓库按同样职责映射，不能为满足文件名破坏现有架构。

```text
src/
  app/
    layout.tsx
    page.tsx
    work/page.tsx
    work/[slug]/page.tsx
    about/page.tsx
    contact/page.tsx
    careers/page.tsx
    not-found.tsx
  components/
    shell/SiteHeader.tsx
    shell/MenuOverlay.tsx
    shell/SiteFooter.tsx
    shell/RouteTransition.tsx
    home/HomeHero.tsx
    home/HomeExperience.tsx
    work/FeaturedProjects.tsx
    work/ProjectArchive.tsx
    work/ProjectPreview.tsx
    case-study/CaseStudyRenderer.tsx
    case-study/CaseHero.tsx
    case-study/MediaBlock.tsx
    case-study/NextProject.tsx
    media/ShowreelDialog.tsx
    media/ResponsiveMedia.tsx
    shared/MeasuredText.tsx
  experience/
    RuntimeHost.tsx
    ExperienceRuntime.ts
    SceneController.ts
    CameraRig.ts
    BotanicalField.ts
    AssetRegistry.ts
    MediaController.ts
    QualityController.ts
    PostProcessing.ts
    types.ts
    shaders/                  # 只有确实需要自定义材质时创建
  motion/
    MotionProvider.tsx
    ScrollController.ts
    ScrollLocks.ts
    SceneDirector.ts
    motion.schema.ts
    motion.config.ts
  content/
    assets.manifest.json
    navigation.json
    projects.json
    about.json
    contact.json
    careers.json
    schema.ts
  styles/
    globals.css
    tokens.css
    typography.css
  qa/
    installQaBridge.ts
    capture-state.ts
    types.ts
scripts/
  capture-reference.ts
  capture-local.ts
  audit-assets.ts
  audit-routes.ts
  validate-evidence.ts
  build-comparison-report.ts
  collect-performance.ts
tests/
  unit/
  e2e/
  visual/
evidence/
reports/
  baseline/
  iterations/
  final/
docs/
  implementation-decisions.md
  progress.md
  asset-rights.md
  runbook.md
```

不要提前生成所有空模块。按任务真正引入职责，防止“架构很完整但页面没做出来”。

### 5.5 关键接口与状态

```ts
export type ExperienceMode =
  | 'loading'
  | 'home'
  | 'work'
  | 'content'
  | 'fallback'
  | 'disposed';

export type OverlayMode = 'none' | 'menu' | 'showreel';

export interface FrameInput {
  timeSeconds: number;
  deltaSeconds: number;
  scrollY: number; // CSS px，来自实际拥有滚动的容器
  pointerNdc: readonly [number, number]; // x/y 均为 -1..1
  reducedMotion: boolean;
}

export interface SceneState {
  mode: ExperienceMode;
  chapterId: string | null;
  localProgress: number; // 0..1
  cameraPosition: readonly [number, number, number];
  cameraTarget: readonly [number, number, number];
  cameraFov: number;
  focusDistance: number;
  sceneOpacity: number;
}

export interface ExperienceRuntime {
  mount(host: HTMLElement): Promise<void>;
  resize(widthCssPx: number, heightCssPx: number, dpr: number): void;
  update(input: FrameInput, state: SceneState): void;
  pause(reason: string): void;
  resume(reason: string): void;
  dispose(): void;
}
```

同一运行时使用多原因暂停集合，不能菜单一关就错误恢复一个仍因页面隐藏而暂停的场景。overlay 与基础页面 mode 分离，避免菜单状态丢失当前路由。

---

## 6. 首页花草视觉的重建方法

> 本节是 `PROPOSED` 的重建路线。只有 Phase 0 证实实时 3D 适合时实施。实际资源若为视频或层叠图像，保留构图分析，替换渲染方法。

### 6.1 先解决轮廓和构图，再解决特效

依次建立四个观察层：

**远景暗部**：控制画面的深度终点与文字负空间，不可用一层高亮粒子雾占满。

**中景主体**：负责可辨认的花簇和枝叶结构，是颜色、密度、透视和焦点的主要校准对象。

**近景遮挡**：少量大尺度植物掠过画面边缘，建立距离感；位置必须服务构图，不能随机挡住标题或 CTA。

**界面层**：品牌、导航、标题和按钮保持清晰的 DOM 渲染；除非原站有相反证据，不受景深后期处理影响。

顺序必须是：黑白轮廓 → 前中远景 → 植物形态 → 色彩材质 → 相机 → 景深 → 微动。不能先加粒子、Bloom 和胶片噪点再补结构。

### 6.2 植物分布模型

使用固定种子生成多个“植物簇”，簇内部再分配茎、叶和花；不要在全空间均匀随机撒点。

若浏览器证据确认植物围绕一个具有纵深的开放通道分布，可用中心曲线 `C(s)` 与其局部基向量生成：

```text
P(s, θ) = C(s) + r(s, θ) × [cos(θ)N(s) + sin(θ)B(s)] + clusterOffset
```

这里 `C、r、θ、密度遮罩` 均由参考关键帧拟合；公式只是布局工具，**不是已发现的原站算法**。如果原站没有通道，不得用这段公式硬做隧道。

给文字对应投影区域设置密度遮罩。随机分布可以有变化，但需保留宏观轮廓、主色花簇位置和空间节奏。相机路径与植物分布要联合校准，不能只改其中一个。

### 6.3 实例化与细节分配

同类植物共享 geometry/material，用实例化减少重复对象的绘制开销。Three.js 的 `InstancedMesh` 适合共享几何/材质、变换不同的大量物体，可减少 draw calls。[S16]

按花形、叶形、材质和空间区块分组，而不是所有植物无差别合并。近景保留真实立体花瓣与可辨叶形，远景可用低面数或透明卡片。完整画面中的关键轮廓应比纯粹追求数量更重要。

每实例属性可包括：seed、scale、朝向、色彩变体、弯曲权重和相位。每帧更新 shader 的时间与少量全局参数，不在 CPU 上逐个改成千上万个矩阵。

初始实验规模可从数百个可见簇起步，再按参考画面的密度与帧耗时增加；不把“5000 株”或任何固定实例数当作达标标准。

### 6.4 材质与透明边缘

叶片应有可辨纹理、法线和合理粗糙度。花色来自底色与光照，不默认所有花瓣发光。

透明叶片优先测试 alphaTest 或适当的抖动透明策略。检查排序、深度写入、边缘白边、mipmap 黑边、双面法线和逆光表现。景深的 depth pass 必须尊重叶片透明裁切，否则会出现矩形虚化轮廓。

同一图集中的透明区域要防止颜色污染；材质近距离露馅时，优先改模型和贴图，不用更重的 blur 掩盖。

### 6.5 相机与鼠标

区分三个量：页面滚动进度、时间推进、指针偏移。分别取证后再合成：

```text
最终相机/场景状态
  = 章节基准状态(scrollProgress)
  + 有证据的时间微动(time)
  + 有证据的指针响应(pointer)
```

鼠标输入归一化到 `[-1, 1]`；幅度按视口与构图校准。阻尼使用与 deltaTime 相关的指数形式：

```text
value += (target - value) × (1 - exp(-λ × dt))
```

这能避免不同刷新率下固定 lerp 系数造成不同手感。截图模式使用固定 delta 与明确状态，不能依赖真实经过时间。

滚动相机轨迹以多个关键姿态定义，必要时使用样条插值；target 也要独立设计，不能每帧硬 lookAt 同一点导致不符合参考的旋转。原站若没有相机旋转，不加“电影感旋转”。

### 6.6 景深与后期

优先重建“何处清晰、何处模糊”的空间关系，再追求复杂散景。可以选择一个支持深度纹理的景深实现；`EffectComposer` 等后期流水线须遵循明确的 pass 顺序。[S21]

校准顺序：焦点所在对象 → 前景模糊范围 → 背景衰减 → 边缘质量 → 输出抗锯齿 → 色彩。不要通过大范围 Bloom 让花瓣失去结构。

颜色贴图与数据贴图使用正确色彩空间；renderer、后期链与输出转换不能重复 tone mapping 或重复 gamma。色彩管理遵循所锁定 Three.js 版本的官方说明。[S20]

### 6.7 加载与失败恢复

首屏 UI 与图形资源解耦，用户不应因为一个纹理失败而无法点击菜单。显示真实阶段，不编造百分比；进度总量未知时使用阶段提示，而不是假装读到了真实 97%。

未完成 shader 编译、关键模型解码和首帧渲染前，不隐藏匹配构图的 poster。切换时保持相同裁切，避免一闪而过的白屏或花草位置突变。

预留 `webglcontextlost`、恢复失败、资源超时和显存不足分支。fallback 保留主要文案与导航，并在 QA 报告中显示降级状态；不得静默把所有云端测试都转成静态图后宣称实时 3D 通过。

---

## 7. 排版、色彩与桌面布局规范

### 7.1 先量再写 token

从 computed styles、真实字体加载和截图收集：family、实际 rendered font、weight、style、font-size、line-height、letter-spacing、text-transform、段宽与换行。

尤其区分真实斜体字体与浏览器合成斜体；不要仅用 `font-style: italic` 就认为与参考一致。测量首屏标题时，同时记录容器宽度、每行文本与基线位置。

建议 token 字段：

```css
:root {
  /* 下列值仅为创建工程时的暂定起点，Phase 0 后必须按参考覆盖。 */
  --page-background: #070807;
  --text-primary: #f5f4ef;
  --text-secondary: #aaa9a3;
  --desktop-gutter: clamp(24px, 2.8vw, 72px);
  --header-layer: 40;
  --route-layer: 60;
  --overlay-layer: 80;
}
```

这些颜色不是对原站取样的结果，也不意味着所有页面都应黑底。主页面与案例详情的实际背景应逐页测量。

### 7.2 字体还原顺序

字形类别和比例 → 实际字体/许可 → 字重与真斜体 → 换行 → 行高 → 字距 → 最后调整字号。错误字体带来的字宽偏差不能靠大量负字距和任意缩放补救。

品牌字标优先使用合法可用的原始 SVG；不得把字标用一个相似系统字体随意打出来。SVG 应保留视图比例，不拉伸，不连同原站追踪脚本一起复制。

### 7.3 桌面适配

主视口锁定构图后，在小高度与大宽度窗口调整，而不是整体等比缩放网页。

- 小高度窗口优先保证导航、标题、CTA 可见；不要靠隐藏内容解决。
- 大宽度窗口分别处理场景视角、文本最大宽度和页面边距。
- 全屏媒体以实测裁切为准；宽高比改变时可以改变相机距离或构图偏移，但不可无依据改变剧情。
- 不固定 `min-width: 1440px` 来逃避 1366px 验收。
- 页面无意外横向溢出；减少动态效果模式保留内容与逻辑顺序。

---

## 8. 动效系统：把可观察行为变成参数表

### 8.1 动效登记规范

创建 `evidence/motion-inventory.json`，每个动效包含：

```text
id / route / target / evidenceIds
triggerType: load | time | pointer | scroll | click | route
startCondition / endCondition
durationMs 或滚动区间
animatedProperties
fromState / toState / keyframes
reversible / interruptPolicy
settledCondition
reducedMotionBehavior
implementationOwner
measurementConfidence
```

未知 duration 用 `null` 并说明需要何种观察；不要填一组“高级网站常用数值”冒充测量。

### 8.2 需要覆盖的动效矩阵

| 对象 | 测量重点 | 可采用的实现 |
|---|---|---|
| 首页加载与标题 | 资源完成与文字出现是否绑定、行间延迟 | 有明确就绪条件的 GSAP 时间线 |
| 花草场景 | 时间、指针、滚动分别驱动什么 | SceneDirector / MediaController |
| 菜单 | 面板进入、背景变化、菜单项交错、关闭反向过程 | 可打断的单一 timeline + focus 管理 |
| CTA/链接 | 颜色、箭头、下划线、位移、光标变化 | CSS 或 GSAP，明确唯一责任 |
| 作品精选 | 卡片/封面/文字的同步关系 | 数据驱动索引 + 状态过渡 |
| 作品档案 | hover 预览位置、追随惯性、切换闪烁 | 仅确认存在后实现 PreviewController |
| 案例媒体 | reveal、裁切、视差、固定区域 | 分模块配置；不对所有图套同一种入场 |
| 联系问候语 | 时间周期、方向、遮罩、字体变化 | 文本轨道/离散轮换，依观察决定 |
| 路由切换 | 退出与进入是否共享媒体、是否重置滚动 | RouteTransition + ready handshake |
| showreel | 打开、播放、静音、关闭和背景冻结 | 可访问的对话框与媒体生命周期 |

### 8.3 统一章节进度

滚动动画定义自己的 start/end，不能把所有动画绑定到整站 `scrollY / documentHeight`。

```ts
export function normalizeProgress(
  position: number,
  start: number,
  end: number,
): number {
  if (![position, start, end].every(Number.isFinite) || end <= start) {
    return 0;
  }
  return Math.max(0, Math.min(1, (position - start) / (end - start)));
}
```

测试应覆盖起点前、起点、区间内、终点后、无效区间与非有限输入。实际滚动长度来自参考测量；不要预设首页一定有 500vh 或 1000vh 的镜头旅程。

### 8.4 避免双重阻尼

同时使用 Lenis 缓动、ScrollTrigger 的 scrub 平滑和相机 lerp，可能造成三次滞后叠加。选择一个主平滑来源，再微调必要的指针响应。[S18][S19]

滚动到某个位置后，判断页面是否 settled，应依据进度误差与元素状态，而不是每个测试都盲等 5 秒。需要记录 fast-scroll 和反向滚动，不能只验匀速向下。

### 8.5 菜单与滚动锁

滚动锁使用 owner/token 模式，例如 `acquire('menu')` 和 `release('menu')`；showreel 与路由过渡可同时拥有锁，不能关闭一个 overlay 就解开其他锁。

记录被锁容器的真实 scroll position。锁定期间处理滚动条占位，关闭后恢复原位置；Tab 保持在打开的面板内，Escape 关闭并回到触发按钮。切换页面时关闭 overlay 并把焦点移到新页面合理位置。

### 8.6 页面过渡

先做正确导航，再做动画。只拦截普通站内左键导航，不破坏 Ctrl/Cmd 点击、新标签、下载、hash 链接和外部链接。

建议状态：

```text
idle → leaving → waiting-for-route → entering → idle
```

过渡开始时保留旧页面可见内容；新页面 DOM/关键媒体 ready 后进入。设置超时恢复，不能无限黑屏。取消或快速连续点击时，确定“最后一次有效目标”并清理旧动画。

不假设某一框架版本具有特定 router events。按照锁定版本与路由模式实现 ready handshake。浏览器返回优先恢复原页面滚动和选择状态，不强制回顶部。

---

## 9. 逐页实现规范

### 9.1 全局外壳

准确还原品牌标志、Menu 控件、页面主题切换和页脚。主题不是在所有页面强制同一个黑色背景，而是由参考决定。

Logo 必须能返回首页。菜单中的实际条目以原站 DOM 与截图为准，不因为有 Careers 页面就擅自添加原站没有的一级导航。

页脚联系方式和订阅 UI 使用本地示意行为，禁止默认调用原站提交端点。展示性按钮点击后明确本地演示状态，不伪造“已向原站成功订阅”。

### 9.2 首页

先还原稳定关键帧的构图，再加入时序；实现所有确实观察到的首页段落。首屏只是首页的一部分还是独立入口，须以 Phase 0 为准。

标题与植物遮挡关系、CTA 路径、鼠标响应和页面离开过程分别测试。禁止将整屏截图当背景再叠重复文字伪装为复刻。

### 9.3 作品目录

还原精选区域、showreel 入口、档案列表及其真实交互，不把不同层级压成统一网格。

数据分离：精选顺序、档案顺序、项目 slug、封面、预览媒体、标题和客户信息。不要从文件名推断项目归属，也不要静默把媒体请求顺序当成显示顺序。

如果存在 hover 跟随预览：限制预览在视口内；快速切换只显示最新目标；进入预览图本身不造成无限 enter/leave 抖动；只为附近项目准备媒体，避免 hover 一次下载全部视频。

### 9.4 案例详情

建立可组合内容 block，而不是每个案例硬写一套，也不是用一个模板吞掉所有差异。

建议 block 类型：

```text
intro / metadata / rich-text / full-bleed-media
contained-media / split-media / media-pair / quote
credits / awards / next-project
```

这些是实现数据类型，具体页面是否包含某类 block 以参考为准。保存媒体原比例、页面背景、文字宽度和章节间距。

主案例要逐个核验首屏、正文媒体、引语、奖项/署名、下一项目。客户项目页面中的视频或截图是官网案例的内容，不代表要在该位置重新实现客户网站本身。

### 9.5 About

分别处理介绍、服务类别、工作方法、奖项与照片，不用普通公司介绍的“4 张卡片”替换复杂排版。[S03]

原站若有超大文字、图片拼贴或特定固定区域，应按浏览器证据重建。奖项数字和年份来自冻结版本；不自动“更新到今天”。

### 9.6 Contact

以多语言问候语为关键独有元素，而不是普通联系表单。[S04] 收集实际文字顺序与运动方式；检查字符重音、长词、字体回退与行高。

轮播/跑马灯需要无缝循环时，通过有限 DOM 副本与可复现相位完成，屏幕阅读器只暴露必要的一份文本，不把大量重复问候语全部朗读。

### 9.7 Careers

独立调查照片编排与交互；解析结果中的大量图片并不能证明图片在一条纵向列表中。[S05]

没有公开职位时还原当前无职位状态；不要虚构岗位、薪酬或申请流程。若存在职位详情，将它归入独立模板并纳入路由清单。

### 9.8 Showreel

视频仅在用户交互允许后开启声音；关闭时暂停并按原站行为重置或保留进度。后台媒体不得继续播放声音。

验证 Escape、关闭按钮、连续开关、视频加载失败、浏览器自动播放限制以及背景滚动恢复。媒体失败时允许关闭对话框，不锁死页面。

---

## 10. 确定性测试与视觉对照

### 10.1 建立两套不同的验证

**原站保真验证**：本地页面与冻结原站参考集比较，回答“像不像”。

**本地回归验证**：同一项目修改前后比较，回答“有没有退步”。

Playwright 的 snapshot baseline 不能自动证明像原站。如果 baseline 第一次就来自错误页面，后面全部通过也没有意义。[S22]

### 10.2 本地 QA 控制桥

仅在测试/开发模式暴露 `window.__GLADEYE_QA__`，正式交付默认关闭。它不改变正常视觉，只允许固定随机种子、时间和状态。

```ts
export interface QaBridge {
  ready(): Promise<void>;
  freeze(): void;
  setTime(seconds: number): void;
  setPointer(xNdc: number, yNdc: number): void;
  setChapterProgress(chapterId: string, progress: number): Promise<void>;
  setOverlay(mode: 'none' | 'menu' | 'showreel'): Promise<void>;
  waitUntilSettled(): Promise<void>;
  getDiagnostics(): {
    assetFailures: string[];
    activeRuntimeCount: number;
    activeScrollLockOwners: string[];
    renderMode: string;
  };
}
```

`setChapterProgress` 作用于已验证的章节，不允许伪造原站不存在的章节。QA bridge 用于固定本地关键帧；另有真实鼠标/滚轮测试，避免“直写 state 能通过，但用户滚动不工作”。

不要在原站任意注入全局随机数替换或强行修改陌生渲染器。原站以正常浏览、可公开观察的页面状态和事件轨迹为基准；无法固定时，记录相位和不确定性。

### 10.3 截图条件

固定 viewport、DPR、浏览器 build、字体、缩放、语言、减少动态效果设定、指针与滚动容器。等待字体和关键媒体 ready；停止测试用时间并渲染一次最终帧后截图。

同一组比较尽量在同一 OS/浏览器环境中采集。不同平台字形抗锯齿或 GPU 输出可能带来差异，必须与真正的布局错误区分。[S22]

画布黑屏、poster 降级、字体 fallback 必须显示在 diagnostics 中；不能给这样的截图打上正常 3D 成功标记。

### 10.4 三种视觉材料

每个关键状态产生：原站 reference、本地 candidate、50% 叠图/差异图。报告同时显示两张原图，不能只提供难以解释的热力图。

静态 DOM 区域可以用像素差、边缘与 bounding boxes；动态植物区域以同相位参考、空间轮廓、焦点、色彩分布和人工审查共同评价。SSIM/LPIPS 可作为辅助，不能把一个指标直接叫“还原率”。

必要的动态 mask 必须明确区域与理由，冻结前定义。不能把整个花草 Canvas 或整个 Hero 遮掉来通过测试；花草是本任务的关键内容。

### 10.5 初始验收容差

以下是项目建议起点，Phase 0 基于参考稳定性校准并冻结；后续不能为通过而偷偷放宽：

| 项目 | 初始目标 |
|---|---|
| 主视口标题换行 | 与参考相同；字体确实不可用时记录阻塞或替代差异 |
| Header/菜单/CTA 关键边界 | 同状态下偏差原则上不超过 4 CSS px |
| 大型段落/媒体边界 | 原则上不超过 8 CSS px；需考虑源参考测量精度 |
| 图片展示比例 | 保持一致，不拉伸；裁切主体位置对齐 |
| 时间型动效起止 | 不超过 `max(100ms, 原持续时间的10%)`，并检查中间阶段 |
| 滚动型关键变化 | 相对已测触发区间偏差原则上不超过 3% |
| 案例媒体覆盖 | 在合法可用和源站可达的范围内完整，无静默占位 |
| 导航/状态错误 | 关键路径零未解决错误 |

一个模糊截图不能支撑 1px 精度。参考不足的项目标记为 `unmeasured`，而不是自动通过。

### 10.6 真实输入测试

自动化覆盖慢滚、快滚、反向滚、停止后稳定、键盘 PageDown/Home/End、菜单与 showreel 连续开关、hover 快速切换、刷新深链接、前进后退、窗口 resize。

记录触发区间开始/中点/结束前后，至少对核心过渡捕获 `0/25/50/75/100%` 五个阶段；静态关键帧相同但中间运动错误，仍不通过。

---

## 11. 性能、稳定性与无障碍

### 11.1 性能目标与测量环境

先固定测试机与浏览器，分别测冷启动和热启动，再做连续滚动/指针/菜单测试。生产构建测量，开发热更新开销不能代表交付性能。

建议目标：在指定真实桌面 GPU 上，主视口场景以接近 60 FPS 为目标，暖机后的 p95 帧间隔优先控制在约 20ms 内，并单独报告超过 33ms 和 50ms 的帧比例。该目标不是本文件已经测得的结果，也不适用于未标注的云端软件渲染环境。

报告实际设备、渲染器、DPR、质量档、持续时间、样本数和页面状态。性能统计避免把静止页面、隐藏标签页或浏览器节流混入交互测试。

### 11.2 质量分档

建立 high/balanced/low/fallback。先保持相机、主体轮廓、文字和花色关系，再降远景密度、渲染分辨率与后期采样；不要把决定辨识度的近景植物直接删光。

建议首轮 DPR 上限为 high 1.5、balanced 1.25、low 1.0，之后按设备与视觉对照校准。这些不是原站配置。QA 固定质量档，自动质量控制在回归截图时关闭。

性能回退要有迟滞，避免质量档频繁跳动；减少页面隐藏时的计算。尺寸变化后正确更新相机、renderer 与 render targets。

### 11.3 内存与清理

连续十次主要路由往返与菜单/showreel 开关，检查 renderer 数、监听器、ticker callback、ScrollTrigger、材质、纹理、视频和对象 URL。

不能只看一次浏览器进程内存；结合运行时对象计数和资源引用检查增长趋势。共享资源有引用管理，不能一个组件 dispose 后把其他页面仍使用的贴图释放。

### 11.4 可访问与失败体验

语义 DOM 保留标题层级、链接与按钮；正文可选中复制。装饰 Canvas 不取代导航；交互图片有合理替代文本。

菜单和视频对话框具备焦点管理、Escape 和清晰的关闭控制。`prefers-reduced-motion` 下停止非必要漂浮、自动跑马和大幅镜头推进，仍提供全部内容入口；这属于必要可用性处理，不改变正常模式的目标构图。

### 11.5 离线与外部依赖审查

开发完成后检查运行时请求：除本地静态资产与明确允许的服务，不依赖 `gladeye.com`、原站分析平台或未知域名。需要外部媒体而未获本地化许可的情况，必须在交付限制中说明，不能宣称离线可用。

---

## 12. 持续迭代策略：有目标、有比较、有停止条件

### 12.1 六个质量阶段

| 阶段 | 聚焦问题 | 本轮应交付的证据 |
|---|---|---|
| R0 基线 | 页面和素材是否真实、范围是否清楚 | 原站参考集、初版截图、缺口表 |
| R1 构图 | 大结构、负空间、字号/换行、页面比例 | 关键边界与叠图比较 |
| R2 媒体/图形 | 植物形态、图片裁切、材质、景深、字体 | 关键资产清单与同状态场景对照 |
| R3 动效 | 触发、时长、相机/指针/内容同步 | 原站与本地短视频、五阶段关键帧 |
| R4 全站 | 所有路由、模板差异、下一项目与返回 | 覆盖矩阵与完整导航测试 |
| R5 稳定性 | 性能、清理、失败、减少动态效果、多视口 | production 构建、浏览器与性能报告 |

阶段可以交叉，但未解决的高优先级问题不能被下一阶段的成功掩盖。完成这些阶段不等于必须浪费固定轮数；所有门槛提前满足即可收束。

### 12.2 每一轮的工作协议

```text
读取 progress.md 和上一轮报告
→ 选取最多 3 个当前影响最大的差异
→ 为每个差异写明参考证据、假设和修改范围
→ 最小必要修改
→ 运行受影响的测试
→ 截取相同状态，并与原站及上一轮比较
→ 接受改进或回退退化
→ 写入本轮结果、未解决项和下一步
```

不能每轮重读所有文档与全站 bundle。一次不要同时改相机、字体、所有颜色和滚动长度，否则无法确认什么导致改进或退化。

### 12.3 差异优先级

优先看任务失败风险，再看视觉影响。建议顺序：

```text
P0 无法访问/无法导航/关键媒体缺失/首屏机制判断错误
P1 首屏轮廓、字体、构图、核心动效与重要页面缺失
P2 局部裁切、间距、hover、过渡衔接
P3 微小阴影、边缘抗锯齿、低频装饰
```

同级内可用 `可见面积 × 视觉显著性 × 出现频率` 排序，但“影响区域小的菜单关闭失效”仍是功能 P0，不能被面积公式排到末尾。

### 12.4 评分表

这是项目管理用的有锚点评分，不是机器自动测得的“相似率”。各维度 0—100，未测标 `unmeasured`，不能填乐观数值。

| 维度 | 权重 | 主要检查 |
|---|---:|---|
| 首页主视觉与媒体 | 30% | 花草轮廓、纵深、材质、焦点、关键图像是否匹配 |
| 排版与空间关系 | 22% | 字体、斜体、换行、间距、构图与背景 |
| 动效与交互时序 | 18% | 滚动、鼠标、菜单、路由、视频 |
| 页面与内容完整度 | 15% | 全部可用路由、模板与媒体结构 |
| 状态与功能正确性 | 10% | 导航、返回、弹层、失败分支 |
| 性能与稳定性 | 5% | 帧时间、生命周期、减少动态效果 |

评分锚点：50 为明显只剩风格相似；70 为主要结构存在但差异显著；85 为整体接近而关键细节仍可辨；95 为关键视口与状态均有证据支撑的高度接近；100 仅用于可验证无差异的有限检查项，不作为泛化整站宣传。

建议完成门槛为加权总分不低于 92、每维不低于 85，且满足全部硬门槛。**评分必须链接截图/测试/测量，不能由 Codex 凭感觉自报 96。** 无法比较的核心维度会阻止完整完成状态。

### 12.5 硬门槛

关键页面可用；主导航与返回正确；核心媒体无占位；核心动效经过真实输入验证；主视口及至少两个辅助视口已回归；无阻断性控制台/资源错误；没有未经说明的 2.5D 或静态代替；所有未完成项可见。

性能测试无法在真实 GPU 上运行时，可交付“视觉/功能已验证，真实 GPU 性能待验”，但不能标为所有硬门槛通过。

### 12.6 预算、停滞与恢复

用户在 Goal 中配置的预算优先。未指定时，以初始实现完成后最多 8 个精修轮次作为默认检查点，不无限自动扩张。

同一核心问题连续 2 轮没有证据化改善，先检查参考与资产是否错误；连续 3 轮无实质进展，改用更有针对性的取证、替代资产或明确的重建路线，不重复随机调整参数。

预算耗尽、关键资产无许可、原站不可访问、参考不足或环境无法运行必要测试时，以 `partial` / `blocked` 收束，保存进度与最佳版本，明确解锁条件。不得悄悄减少范围或放宽门槛后标为 `complete`。

---

## 13. 可执行任务拆分

本节的文件名针对第 5 节建议结构。每项完成后运行测试和必要截图，再做局部提交；不使用 `git add .` 意外收录取证凭据或用户文件。已有仓库按职责映射文件路径，并把映射写入决策记录。

### Task 00 — 环境、分支与范围

**文件**：`evidence/environment.json`、`evidence/route-inventory.json`、`docs/progress.md`。

**接口**：输入目标 URL 与现有仓库；输出可用工具、路由种子和变更范围。

- [ ] 读取最少必要仓库文件，确认未提交改动和可运行命令。
- [ ] 执行浏览器、网络、本地服务与 WebGL 能力探测，保存真实结果。
- [ ] 建立隔离工作目录或工作分支；不丢弃原有改动。
- [ ] 将第 2 节范围写成路由清单，区分已访问、待访问与源站失效。
- [ ] 验证 JSON 可解析、路径正确、记录不含秘密；提交本任务创建的必要文件。

**通过条件**：可以指出本机到底能做哪些验证；没有假设不存在的工具已连接。

### Task 01 — 参考捕获与动效取证

**文件**：`scripts/capture-reference.ts`、`evidence/source-version.json`、`evidence/source-screens/`、`evidence/motion-inventory.json`。

**接口**：输入 route inventory 与 viewport config；输出带 metadata 的参考截图、时序和实现类别判断。

- [ ] 先定义捕获产物 schema，校验缺失 URL/viewport/evidence ID 时失败。
- [ ] 运行该校验，确认空清单不能通过参考验收。
- [ ] 按第 3 节完成主页面与关键交互采样；优先确认首页媒体机制。
- [ ] 去重站内链接并遍历实际目录，不抓取外部客户站点。
- [ ] 运行 `npm run evidence:check`；检查截图可打开且非错误页/黑屏，保存参考版本。

**通过条件**：已确认哪些效果需要实现、哪些仍未知；不是只有一张首屏图。

### Task 02 — 资产与字体审计

**文件**：`src/content/assets.manifest.json`、`scripts/audit-assets.ts`、`evidence/typography.json`、`docs/asset-rights.md`。

**接口**：输入已观察到的资源 URL；输出 verified/local/rebuilt/blocked 状态与内容引用。

- [ ] 写单元测试：错误 HTML 伪装图片、空文件、重复 ID、本地路径不存在时审计失败。
- [ ] 运行测试确认失败后，实现 MIME/文件头/路径/清单关联校验。
- [ ] 下载或准备有权使用的关键资产，逐一核对其页面位置；记录未获许可素材。
- [ ] 检查真实字体、斜体与替代情况；不随意打包环境字体。
- [ ] 运行 `npm run assets:audit`；生成 P0 缺失表并局部提交。

**通过条件**：重要素材不是未经说明的占位图；每个本地资源存在且来源可追踪。

### Task 03 — 工程、语义外壳与全局样式

**文件**：`src/app/layout.tsx`、`src/styles/*`、`src/components/shell/SiteHeader.tsx`、`SiteFooter.tsx`、`tests/e2e/shell.spec.ts`。

**接口**：消费导航与 typography 数据；输出各路由共用外壳。

- [ ] 写导航可达、页面无横向溢出、Header 不遮挡主内容的测试。
- [ ] 运行测试确认页面/组件未完成时失败。
- [ ] 建立或复用工程与兼容锁文件，实现真实结构和测量后的 tokens。
- [ ] 对照主视口校准 Logo、Menu、页边距和页脚，而不是默认模板。
- [ ] 运行 typecheck、shell E2E 与构建；截图并局部提交。

**通过条件**：全局外壳能在四个桌面视口正确布局，字体状态可识别。

### Task 04 — 菜单、焦点与滚动锁

**文件**：`MenuOverlay.tsx`、`src/motion/ScrollLocks.ts`、`tests/unit/scroll-locks.test.ts`、`tests/e2e/menu.spec.ts`。

**接口**：`acquire(owner: string): () => void` 返回释放函数；每 owner 使用独立 token/引用计数。

- [ ] 写多个锁同时存在、重复 release、最后一个锁释放后才解锁的单测。
- [ ] 写键盘打开、Tab 限定、Escape 关闭、焦点返回和恢复 scrollY 的 E2E。
- [ ] 实现锁与面板结构，先让行为通过测试。
- [ ] 根据原站证据加入可打断的开关动效；连续开关不残留半透明层。
- [ ] 运行测试与菜单五阶段截图，局部提交。

**通过条件**：从页面中部打开再关闭，位置不跳；嵌套锁不被误释放。

### Task 05 — 图形/媒体运行时与失败分支

**文件**：`src/experience/RuntimeHost.tsx`、`ExperienceRuntime.ts`、`AssetRegistry.ts`、`MediaController.ts`、`tests/e2e/runtime.spec.ts`。

**接口**：实现第 5.5 节 runtime contract；根据取证选择图形或媒体后端。

- [ ] 写 mount/dispose 幂等、资源失败不挡导航、同一时间只有一个活动 runtime 的测试。
- [ ] 在尚无实现时验证失败，再完成最小生命周期。
- [ ] 连接真正的首屏关键媒体；创建匹配构图的加载 poster 与恢复路径。
- [ ] 测试资源超时、WebGL 不可用、页面隐藏、resize、快速离开。
- [ ] 运行 runtime E2E、控制台检查、首帧截图并提交。

**通过条件**：无无限加载、白屏锁死、重复 rAF 或黑屏冒充成功。

### Task 06 — 首页稳定构图

**文件**：`HomeHero.tsx`、`HomeExperience.tsx`、`CameraRig.ts`、`BotanicalField.ts` 或对应媒体层、`tests/visual/home.spec.ts`。

**接口**：消费原站关键帧与资产清单，输出首页基准状态。

- [ ] 定义主视口标题换行、CTA 边界、文字负空间与植物轮廓的验收记录。
- [ ] 在当前基线截图中确认实际差异，不能自动更新成“通过”。
- [ ] 先校准宏观构图，再校准字体、前中远景与媒体裁切。
- [ ] 若为实时 3D，再校准材质、焦点和相机；若为视频，则匹配对应媒体时刻。
- [ ] 生成同状态叠图与差异说明，运行视觉检查，局部提交。

**通过条件**：去掉动效后也已明显接近原站，而不是靠运动掩盖错误构图。

### Task 07 — 统一滚动与 SceneDirector

**文件**：`src/motion/ScrollController.ts`、`SceneDirector.ts`、`motion.config.ts`、`tests/unit/progress.test.ts`、`tests/e2e/home-motion.spec.ts`。

**接口**：`normalizeProgress`、`FrameInput`、`SceneState`，所有进度映射写入可审查配置。

- [ ] 写归一化进度、反向滚动、边界与无效输入单测。
- [ ] 写真实滚轮、停止后 settled、Home/End 和恢复位置的浏览器测试。
- [ ] 只在有证据需要时启用 Lenis；建立单一调度并清理所有订阅。
- [ ] 加入测量后的 pointer/time/scroll 响应，防止双重平滑。
- [ ] 捕获核心动效五阶段与反向轨迹，运行测试后提交。

**通过条件**：用户输入驱动正确；不是仅 QA bridge 直写状态时才正确。

### Task 08 — 作品精选与档案

**文件**：`FeaturedProjects.tsx`、`ProjectArchive.tsx`、`ProjectPreview.tsx`、`src/content/projects.json`、`tests/e2e/work.spec.ts`。

**接口**：`ProjectRecord` 至少包含 id、slug、标题、元信息、媒体引用、block 列表和 nextSlug。

- [ ] 写目录顺序、每个内部链接可达、预览与项目对应的测试。
- [ ] 实现精选和档案的实际布局与完整数据，不预设统一卡片网格。
- [ ] 原站确有 hover 预览时，加入边界限制、加载切换与最新请求胜出逻辑。
- [ ] 测试快速 hover、滚动中 hover、预览失败、返回列表状态。
- [ ] 对照顶部/中部/底部和关键 hover 截图，测试通过后提交。

**通过条件**：目录完整、链接正确，媒体不串项目，不下载全部视频来响应一次 hover。

### Task 09 — Showreel 对话框

**文件**：`ShowreelDialog.tsx`、`tests/e2e/showreel.spec.ts`。

**接口**：`open/close` 调用 scroll lock；视频状态与 overlay 一致。

- [ ] 写用户打开、播放限制、关闭暂停、焦点返回和错误时可关闭的测试。
- [ ] 实现不依赖原站私有接口的合法媒体播放路径。
- [ ] 根据参考加入进入/退出与背景处理。
- [ ] 连续开关十次，检查无多个声音来源、无锁残留。
- [ ] 运行 E2E 与关键状态截图并提交。

**通过条件**：视频失败不会锁页面；关闭后不在后台继续发声。

### Task 10 — 案例模板与全量内容

**文件**：`CaseStudyRenderer.tsx`、`CaseHero.tsx`、`MediaBlock.tsx`、`NextProject.tsx`、`src/content/schema.ts`、`tests/e2e/cases.spec.ts`。

**接口**：区分 block union；unknown block 必须显示诊断并阻止完整通过，不能静默丢弃。

- [ ] 写 block schema、缺失媒体、重复 slug、nextSlug 无效的单测。
- [ ] 选择至少三种结构不同的案例先实现模板，确认不同布局真实存在。
- [ ] 按冻结版本补齐其余可用案例，保存章节与媒体顺序。
- [ ] 全量检查直达/刷新/下一项目；主案例逐屏比较，档案案例记录检查深度。
- [ ] 运行 cases 测试与 route audit，修复缺漏后提交。

**通过条件**：不是同一个案例换标题；没有静默丢失复杂内容 block。

### Task 11 — About

**文件**：`src/app/about/page.tsx`、`src/content/about.json`、相关组件、`tests/e2e/about.spec.ts`。

**接口**：消费 About 的独立数据和媒体 block。

- [ ] 写介绍/服务/方法/奖项区域存在和锚点顺序测试。
- [ ] 实现原站实际排版、图片与主题，避免营销模板替换。
- [ ] 只加入实测存在的文字/图片动效。
- [ ] 检查长文、窄高度桌面和减少动态效果状态。
- [ ] 生成各区域对照截图、运行测试并提交。

**通过条件**：页面内容与不同区域的版式关系均完整。

### Task 12 — Contact 与 Careers

**文件**：`src/app/contact/page.tsx`、`src/app/careers/page.tsx`、对应内容 JSON、`tests/e2e/contact-careers.spec.ts`。

**接口**：问候语序列与相位配置、招聘媒体清单。

- [ ] 写特殊字符正确显示、问候语边界不抖动、联系动作不提交原站的测试。
- [ ] 按实测行为实现问候语，而不是猜一个自动轮播。
- [ ] 按原站证据实现招聘媒体编排与存在的职位入口。
- [ ] 测试长问候语、页面隐藏/恢复、减少动态效果与无职位状态。
- [ ] 捕获多相位和页面底部截图，测试后提交。

**通过条件**：保留两页的独有视觉，不虚构岗位或联系成功结果。

### Task 13 — 路由过渡与历史恢复

**文件**：`RouteTransition.tsx`、`tests/e2e/navigation.spec.ts`、`evidence/navigation-graph.json`。

**接口**：路由请求、页面 ready 信号、可取消 transition 与 scroll restoration。

- [ ] 写站内跳转、刷新深链接、后退恢复、Ctrl/Cmd 点击不被拦截的测试。
- [ ] 在无动效版本通过后，实现 measured exit/enter 与 ready handshake。
- [ ] 处理连续点击、资源迟到、失败超时，不留黑屏。
- [ ] 连续跨页十次，检查 rAF、trigger、视频和滚动锁诊断。
- [ ] 运行 navigation E2E 与跨页录像，确认无回归后提交。

**通过条件**：导航正确性不被动效破坏，浏览器历史行为自然。

### Task 14 — 确定性截图与比较报告

**文件**：`src/qa/*`、`scripts/capture-local.ts`、`scripts/build-comparison-report.ts`、`tests/visual/*`。

**接口**：第 10.2 节 `QaBridge`，输入统一 capture-state 清单，输出三联对照与元数据。

- [ ] 写同种子/同时间/同状态截图稳定、非测试环境不暴露 QA bridge 的测试。
- [ ] 实现冻结所有相关时间源、固定媒体帧与 render-once 行为。
- [ ] 原站与本地各自使用同状态定义，保留参考不足标记。
- [ ] 生成 reference/candidate/overlay 报告，拒绝空图、黑屏或隐藏主视觉的 mask。
- [ ] 运行 `npm run qa:capture`、`npm run qa:report` 和可复现性检查并提交。

**通过条件**：截图差异能追溯到具体状态，不混淆两种 baseline。

### Task 15 — 桌面多视口与可访问性

**文件**：布局样式与 `tests/e2e/desktop-matrix.spec.ts`、`accessibility.spec.ts`。

**接口**：统一 viewport 配置、菜单与媒体对话框状态。

- [ ] 写四视口无溢出、关键 CTA 可见、键盘可达和减少动态效果测试。
- [ ] 修复断点、字号、相机 framing 和媒体裁切，而不是全站缩放。
- [ ] 验证 DPR 2 烟测，截图基线仍按固定 DPR 执行。
- [ ] 回归主视口，防止适配小屏时破坏核心构图。
- [ ] 输出四视口覆盖矩阵，测试后提交。

**通过条件**：1366×768 不裁切主交互，2560×1440 不无意义放大所有文字。

### Task 16 — 性能与生命周期

**文件**：`QualityController.ts`、`scripts/collect-performance.ts`、`tests/e2e/lifecycle.spec.ts`、`reports/performance.json`。

**接口**：质量档配置、diagnostics、固定 benchmark 操作序列。

- [ ] 写 runtime 数、锁数量和订阅清理的重复导航测试。
- [ ] 生产构建运行基线，记录真实设备或明确软件渲染限制。
- [ ] 按热点优化实例化、纹理、后期、DPR、懒加载和暂停，不改变核心构图。
- [ ] 同一轨迹重测性能，再跑视觉回归防止“快了但不像”。
- [ ] 保存原始统计与前后对比，通过后提交。

**通过条件**：性能结论带设备与样本；无持续资源增长、静默降级和视觉倒退。

### Task 17 — 视觉精修循环

**文件**：`reports/iterations/iteration-NN.md`、`docs/progress.md` 与每轮实际目标文件。

**接口**：消费差异表，输出最多三个问题的修复证据与下一步。

- [ ] 按第 12 节优先级选题，冻结本轮比较状态。
- [ ] 写差异、根因假设、预计影响，限制修改范围。
- [ ] 实现后运行受影响测试与同状态截图。
- [ ] 对照原站和上一轮，保留真正改善，回退无收益/退化修改。
- [ ] 更新证据化评分、覆盖矩阵与下一步，按预算决定继续或收束。

**通过条件**：每轮有可查看的差异改进，不只是“优化体验”的提交说明。

### Task 18 — 最终审查与交付

**文件**：`reports/final/acceptance.md`、`docs/runbook.md`、`docs/progress.md`、`README.md`。

**接口**：所有任务证据汇总，输出 `complete / partial / blocked` 和运行方式。

- [ ] 从干净安装与生产构建开始，运行全部检查；保留命令、退出码与日志位置。
- [ ] 检查站内外链接、资源来源、许可、运行时外部请求和秘密泄露。
- [ ] 确认参考/candidate/差异图与实际最终 commit 一致，不能交旧截图。
- [ ] 按硬门槛汇总；任何未测项目标明，不写无证据的“100% 还原”。
- [ ] 提供本地运行、已验证页面、剩余差异、素材限制、性能环境与继续工作入口；不自动公网部署或推送。

**通过条件**：接手者可以运行、复现验证，并知道所有未完成边界。

---

## 14. 脚本命令契约

以下是需要在项目中建立的命令接口，不是声称当前仓库已经有这些脚本。包管理器随现有锁文件选择；示例使用 npm。

| 命令 | 要执行的事情 | 失败条件 |
|---|---|---|
| `npm run dev` | 启动本地开发站点 | 服务无法访问 |
| `npm run build` | 生产构建 | 类型/打包/页面生成错误 |
| `npm run start` | 运行生产版本 | 路由或静态资源不可访问 |
| `npm run lint` | 静态规则检查 | 未修复的阻断规则错误 |
| `npm run typecheck` | 类型检查 | 不使用跳过检查伪造成功 |
| `npm run test:unit` | schema、progress、locks、state 等单测 | 断言失败 |
| `npm run test:e2e` | 导航、输入、菜单、媒体、页面覆盖 | 功能失败 |
| `npm run test:visual` | 本地冻结状态视觉回归 | 相对批准基线发生异常变化 |
| `npm run evidence:check` | 参考集、metadata、证据引用合法 | 缺失或伪造证据、空参考 |
| `npm run assets:audit` | 资产存在、校验、引用、替代状态 | 缺失关键文件、错误类型、未说明替代 |
| `npm run routes:audit` | 全量路由和内部链接检查 | 可用源路由在本地失效或静默缺页 |
| `npm run qa:capture` | 按清单捕获本地确定性关键帧 | 未就绪、黑屏、状态不匹配 |
| `npm run qa:report` | 生成可浏览的原站/本地/差异报告 | 图片引用失效或报告漏项 |
| `npm run perf:collect` | 固定操作轨迹性能采样 | 缺少环境、样本或结果标记 |

新增脚本必须有实际实现和 meaningful exit code，不写 `echo passed` 或总是返回 0 的假检查。截图 baseline 更新必须显式操作并说明原因，禁止自动更新后立即宣布测试通过。

---

## 15. 过程文件格式与上下文控制

### 15.1 progress.md

每次工作结束更新，下一轮先读它，而不是重新研究整站。

```text
当前 commit / 当前阶段 / Goal 状态
已冻结参考版本
已确认的技术事实
本轮完成内容与验证命令
当前最重要的 3 个差异
资产/环境/许可阻塞
下次只需读取的文件
下一步的明确动作与验收条件
```

### 15.2 单轮迭代记录

```markdown
# Iteration NN

Reference version:
Candidate commit:
Viewport / DPR / renderer:

## 本轮问题
- evidence ID / 目标组件 / 差异 / 原因假设

## 修改
- 实际文件与参数，为什么只改这些

## 验证
- 命令、退出码、截图/录像路径
- 与 reference 和上一轮分别比较的结果

## 结论
- 接受 / 回退 / 需要重新取证
- 评分变化及对应证据
- 下轮最多 3 个问题
```

### 15.3 避免无效 Token 与返工

主执行者维护状态，必要时只将独立页面或专项审查交给子任务。花草场景、全局时钟、路由过渡必须有明确单一负责人，不允许多个 agent 同时改同一相机或布局 token。

资源清单、路由清单、时序表和参考图只增量读取。长 HAR、压缩 JS、巨大视频不直接倾倒进对话；先生成摘要和关联索引，再按具体问题读取。

不每轮全站截图。小修只测受影响状态，里程碑再做全站回归。工具不可用时做一次有效替代尝试；没有新证据不反复调用同一个失败路径。

---

## 16. 禁止的“看起来完成”方式

| 错误方式 | 为什么不接受 | 正确处理 |
|---|---|---|
| 只做首页，目录与详情都是假链接 | 不符合完整站点范围 | 按 route inventory 逐项覆盖 |
| 用一张截图铺满屏幕 | 缺少真实页面结构与交互 | 重建 DOM 与正确媒体机制 |
| 用视频代替原站可交互 3D，不说明 | 静态相似不代表行为一致 | 作为显式降级，或继续完成实时实现 |
| 用随机花朵/粒子代替核心植物 | 失去主视觉轮廓与材质 | 优先解决资产与空间分布 |
| 所有页面改成黑底玻璃卡片 | 是重新设计，不是复刻 | 每个模板按参考还原 |
| 从作品案例推断官网全部技术 | 项目与项目之间实现可能不同 | 标注 related evidence 并运行时验证 |
| 以页面 build 通过作为结束 | 没有证明视觉、动效和内容 | 检查关键帧、真实输入和覆盖表 |
| 放宽 diff 阈值或遮掉整个 Canvas | 回避主要误差 | 保留关键区域，修复差异或报告限制 |
| 截图来自旧 commit，报告写新版本 | 证据与交付不一致 | 最终 commit 重跑关键检查 |
| 用真实订阅/投递来验证表单 | 对第三方产生非必要写入 | 使用本地 mock 与明确状态 |
| 默认把素材公开托管或推送仓库 | 可能超出授权与使用范围 | 权限/许可检查后单独确认发布动作 |

---

## 17. 最终交付与完成判定

### 17.1 必须交付

可运行的完整前端工程；有效锁文件与运行命令；路由/资产/字体清单；冻结参考版本说明；原站与本地关键帧对比报告；核心交互短视频或轨迹；测试结果与性能环境；剩余差异与许可清单；继续迭代的 progress 文档。

不要求将所有大型原始取证文件提交 Git，但交付说明必须告诉使用者它们在哪里、如何生成、哪些不应公开。

### 17.2 验收矩阵

| 项目 | complete 必需 | 证据位置 |
|---|---|---|
| 原站版本一致、边界清楚 | 是 | `evidence/source-version.json` |
| 首页核心机制已核实 | 是 | `evidence/gaps.md` + source-motion |
| 主页面与全部可用站内内容有覆盖状态 | 是 | route inventory + routes audit |
| 重要素材存在、替代与许可透明 | 是 | assets manifest + asset-rights |
| 字体、构图、图形与媒体关键帧通过 | 是 | comparison report |
| 核心动效经过真实用户输入测试 | 是 | E2E + motion report |
| 菜单/showreel/历史导航/错误恢复通过 | 是 | E2E logs |
| 多桌面视口与减少动态效果通过 | 是 | desktop matrix |
| 生产构建和类型检查通过 | 是 | build/typecheck logs |
| 性能经过指定设备验证 | 性能完整验收必需 | performance report |
| 无未经说明的外部提交、热链或占位 | 是 | final audit |
| 最终截图与交付 commit 一致 | 是 | acceptance.md |

### 17.3 最终状态

`complete`：所有适用硬门槛均有证据满足，评分满足项目目标，重要差异已解决。

`partial`：工程可运行，部分视觉/页面/性能或素材尚未达到要求；列出具体未完成项，不用“基本完成”模糊处理。

`blocked`：关键素材、参考、权限或运行环境阻止继续推进；保留已完成内容与最小解锁条件。

**不要承诺不可测的绝对 100% 像素一致。目标是尽可能高保真，并能清楚证明哪些已经对齐、哪些仍有差异。**

---

## 18. 可直接交给 Codex 的 Goal 提示词

### 18.1 启动方式

将本文件放到仓库根目录，或明确告诉 Codex 文件的实际路径。OpenAI 官方 Goals 文档将 Goal 定义为具备完成条件、验证面、约束和停止边界的持续目标，并提供 `/goal`、暂停、恢复与清除操作。[S23]

先确认当前安装版本/界面支持 Goals；使用实际提供的命令入口，不把普通聊天里的“继续”误当成 Goal 已启用。不要为了使用本文而擅自升级整个项目依赖。

### 18.2 完整启动提示词

```text
/goal 依据仓库中的 Gladeye_Desktop_Codex_Goal_Clone_Plan.md，完成
https://www.gladeye.com/ 的桌面端、多页面、高保真前端复刻。

这是忠实复刻，不是风格参考或重新设计。主验收视口为 1440×900，
同时覆盖 1366×768、1920×1080、2560×1440，不开发移动端版本。

先读取文档第 0—3 节、现有仓库必要文件和实际可用工具，完成原站浏览器取证，
确认首页花草视觉究竟采用实时图形、视频还是混合机制。冻结参考版本、
路由范围、关键截图、时序与资产清单。文档中的推断和建议参数不得当作原站事实。

随后按文档任务推进实现。保留原站真实构图、字体与斜体层级、媒体裁切、
菜单、作品目录、案例详情、About、Contact、Careers、showreel、滚动响应、
鼠标响应和页面过渡。用真实可用的站内路由清单保证范围完整，不克隆外部客户网站。

新项目采用文档推荐架构；已有项目优先复用。不要无必要引入新框架，
不要让多个动画系统同时控制同一属性。关键素材优先解决，不能用随机粒子、
默认字体、玻璃卡片或单张截图伪装完成。无法使用的素材明确记录，并选择
有权使用的重建路线；静态或 2.5D 降级不得冒充原站交互已还原。

建立确定性 QA 状态和真实鼠标/滚轮测试，按同视口、同页面状态比较原站与本地。
每轮最多修复 3 个最大差异，保存叠图、关键帧、测试结果和 progress.md，
验证改进后继续，不要因为 build 通过就停止。不要自动更新错误 baseline、
放宽容差、遮掉核心 Canvas 或减少页面范围来通过验收。

在当前配置预算内持续迭代。未另设精修预算时，初始实现后最多进行 8 个精修轮次，
达到门槛可提前完成；连续无进展时按文档重新取证或更换有证据的解决路线。
预算、权限、素材或环境阻塞时保留最佳版本并交付 partial/blocked 报告，
列出具体差异、已尝试路径和下一步解锁条件，不无限重试，不虚报完成。

不要修改无关代码或覆盖未提交改动，不向原站提交表单、发送邮件或订阅，
不购买素材，不自动部署公网，不推送 GitHub 或创建 PR。

最终输出可运行工程、运行方式、路由和资产覆盖表、原站/本地对照报告、
测试及性能环境、最终 commit 对应的截图、剩余差异和明确完成状态。
```

### 18.3 中断后的续接提示词

```text
继续当前 Gladeye 复刻 Goal。先读取 docs/progress.md、最近一次迭代报告和
最终变更文件，不重新进行无必要的全站扫描。核对当前 commit 与参考版本，
选出尚未解决的最多 3 个高优先级差异，沿用冻结的验收标准继续修复与验证。
只有出现新证据、参考失效或范围变更时才更新基线，并留下原因。
```

---

## 19. 研究来源与实施参考

以下链接用于追溯本文件中的事实与技术依据。检索日期为 2026-10-07；公开页面、缓存和展示截图可能不是同一更新时间。对于当前 UI 和运动行为，执行阶段的新浏览器取证优先。来源中的客户项目技术不能直接当作机构官网技术。

### 19.1 目标站点与视觉参考

- **[S01] Gladeye 首页**：https://www.gladeye.com/ — 首页可解析内容、导航控件与页脚；本次不含完整运行时画面。
- **[S02] Gladeye 作品目录**：https://www.gladeye.com/work — 精选、档案、案例链接、showreel 文本与图片链接结构。
- **[S03] Gladeye About**：https://www.gladeye.com/about — 介绍、服务、工作方法、奖项和 Storyblok 图片链接。
- **[S04] Gladeye Contact**：https://www.gladeye.com/contact — 多语言问候语与联系内容；运动形式需要实测。
- **[S05] Gladeye Careers**：https://www.gladeye.com/careers — 招聘介绍与媒体链接；图片排布需要实测。
- **[S06] Encore 官方 Showcase 中的 Gladeye 展示图**：https://encore.dev/showcase — 用作花草首屏的静态视觉参考，不证明原站当日布局与动画。对应图像地址：https://encore.dev/assets/img/gladeye_screen.jpg 。本次图像来自搜索图像预览；未下载原始图像字节，也不根据该展示推断官网使用 Encore 后端。

### 19.2 Gladeye 官方案例与相关第一方说明

- **[S07] Into the Amazon 案例**：https://www.gladeye.com/work/into-the-amazon — 说明该客户项目将 WebGL 与 HTML/React 动画协同编排；也用于确认官网案例模板内容。
- **[S08] EQTY Lab 案例**：https://www.gladeye.com/work/eqty-lab-website — 明确描述该客户网站的 Next.js、Storyblok 与 Framer Motion。
- **[S09] Ekos Genesis 案例**：https://www.gladeye.com/work/ekos-genesis — 描述该客户项目的 3D 画廊、烘焙照明和环境表现。
- **[S10] Storyblok：CyberBrokers 客户案例**：https://www.storyblok.com/cs/cyberbrokers — 明确说明该项目采用 React/Next.js、Three.js、Blender、Tailwind/CSS Modules、Framer Motion。
- **[S11] Gladeye：CyberBrokers**：https://www.gladeye.com/work/cyberbrokers — 官网案例结构、媒体与内容组织参考。
- **[S12] Gladeye：The Virtual Economy**：https://www.gladeye.com/work/the-virtual-economy — 描述该项目的滚动镜头、场景衔接和低多边形策略，不是官网首页参数。
- **[S13] Gladeye：其他已读取页面**：
  - https://www.gladeye.com/work/hypercinema
  - https://www.gladeye.com/work/the-dj-and-the-war-crimes
  - https://www.gladeye.com/work/social-mobility-in-the-digital-age
  - https://www.gladeye.com/work/the-examination
  - https://www.gladeye.com/work/the-sweetshop
  - https://www.gladeye.com/work/wildsam
  - https://www.gladeye.com/work/openavn
  - https://www.gladeye.com/work/where-opportunity-takes-root

### 19.3 官方技术文档

- **[S14] Next.js Image**：https://nextjs.org/docs/pages/api-reference/components/image — 图片优化默认路径、尺寸和自定义加载说明。引用其路径定义不代表官网使用 Pages Router。
- **[S15] Storyblok Assets**：https://www.storyblok.com/docs/concepts/assets — 区域资源域名与资源 URL 格式。
- **[S16] Three.js InstancedMesh**：https://threejs.org/docs/pages/InstancedMesh.html — 实例化、变换、边界与资源清理。
- **[S17] Three.js KTX2Loader**：https://threejs.org/docs/pages/KTX2Loader.html — GPU 纹理格式转码与 renderer 能力检测。
- **[S18] GSAP ScrollTrigger**：https://gsap.com/docs/v3/Plugins/ScrollTrigger/ — 滚动进度、触发与生命周期配置。
- **[S19] Lenis 官方仓库**：https://github.com/darkroomengineering/lenis — 滚动实现与 GSAP ticker 集成说明。
- **[S20] Three.js Color Management**：https://threejs.org/manual/en/color-management.html — 工作空间、贴图与输出颜色管理。
- **[S21] Three.js Post Processing**：https://threejs.org/manual/en/post-processing.html — 后期渲染链的职责与组织方式。
- **[S22] Playwright Visual Comparisons**：https://playwright.dev/docs/test-snapshots — 截图对照、基线与环境相关注意事项。
- **[S23] OpenAI：Using Goals in Codex**：https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex — 持续目标、完成契约、验证与预算/阻塞停止机制。

---

## 20. 一句话工作准则

**先证明原站是什么，再实现它；先还原构图与素材，再微调动效；每次迭代拿出同状态对比，直到达标或清楚说明阻塞。**
