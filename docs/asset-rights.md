# 素材来源与许可清单（asset-rights）

生成时间：2026-10-06T18:33Z · 对应冻结参考版本：gladeye.com 2026-10-06 17:13–18:01Z

> **核心结论：本仓库当前包含受第三方版权保护的素材，仅可用于本地保真度研究，不具备再发布、公开展示或商业使用许可。任何部署、上线、推送远端仓库或对外分发动作之前，必须先由素材权利人逐项授权。**

## 1. 清单总览

| 类别 | 位置 | 数量 | 体积 | 来源 | 许可状态 |
|---|---|---|---:|---|---|
| 3D / 场景贴图与音频 | `gladeye-app/public/valley/**` | 10 | 5.1 MB | gladeye.com 公开 URL 直取 | **未获授权**（Gladeye 自有作品） |
| 相机路径原件 | `public/valley/camera-path07.glb` | 1 | 10 KB | 同上（Blender glTF 导出） | **未获授权** |
| Storyblok 内容图 | `public/sites/gladeye/work/**` | 631 | 341 MB | 原站 `/work` 与案例页引用的 `a-us.storyblok.com/f/1014779/` | **未获授权**，且含**客户项目素材**（双重权利） |
| 同上 | `public/sites/gladeye/careers/**` | 42 | 25 MB | 原站 `/careers` | **未获授权** |
| 同上 | `public/sites/gladeye/about/**` | 6 | 8 MB | 原站 `/about` | **未获授权** |
| 字体 | `gladeye-app/src/app/fonts/*.woff2` | 4 | 148 KB | 原站 `/_next/static/media/` | **未获授权，风险最高**（见 §3） |
| 品牌字标 / 图形 | `src/components/shared/icons.tsx`、`shell/RandomFlower.tsx` | 2+ | — | 原站 DOM 内联 SVG 逐字复制 | **商标**，未获授权 |
| 文案 | `src/content/*.json` | — | — | 原站 DOM/RSC 逐字提取 | 版权文本，未获授权 |
| 取证原件（不发布） | `evidence/source-assets/**` | 40+ | ~7 MB | 原站 CSS/JS chunk、GLB、字体、贴图 | 研究副本，**不得进入 `public/` 或构建产物** |

下载完整性：`evidence/asset-report-info.json` 48/48 成功、0 失败；`evidence/asset-report-work.json` 632 请求 / 630 命中缓存 / 1 成功 / **1 失败** / 355 MB，另有 **4 项宽高比与原站不符**（已标记，需按 §5 处理）。下载器策略字段：校验 HTTP 状态、Content-Type、文件魔数，拒绝空文件、拒绝把 HTML 存成图片，**未使用任何占位图**。

## 2. 3D 资产（决定辨识度的 P0）

| 文件 | 作用 | 备注 |
|---|---|---|
| `valley/camera-path07.glb` | 首页镜头轨迹（200 关键帧 / 24fps / 8.2917s） | 原站真值，逐字节复用；解码副本在 `src/experience/data/camera-path07.json` |
| `valley/flowers/pool_summer.png` | 花草精灵图集（夏） | 7 张贴图均设 `SRGBColorSpace`，与原站一致 |
| `valley/flowers/pool_winter.png` | 花草精灵图集（冬） | 与夏池混合 |
| `valley/terrain.png` | 地形/密度图，CPU 端 ImageData 采样决定布点 | 非显示用贴图 |
| `valley/vignette.png` | 暗角层 | `renderOrder:99` |
| `valley/dust-particle.png` | 尘埃精灵 | |
| `valley/rays/ray1..3.png` | 神光 | |
| `valley/audio/ge-ambient.mp3` | 环境音 3.1 MB | 默认静音，仅在用户交互后可开声 |

着色器：`src/experience/glsl/*.glsl` 是原站 bundle 内 GLSL 字符串的**逐字副本**（`evidence/shaders/` 为提取原件，`scripts/verify-scene-params.mjs` 断言两者不漂移）。它们同样受版权保护。

## 3. 字体（风险最高，必须优先解决）

| 文件 | 字族 | 授权方 | 状态 |
|---|---|---|---|
| `soehne-leicht.woff2` / `soehne-kraftig.woff2` | **Söhne** 300 / 500 | Klim Type Foundry（商业授权） | **未确认用户是否持有授权** |
| `epicene-text-light.woff2` / `epicene-text-light-italic.woff2` | **Epicene Text** 300 / 300 italic | Epicene 字体作者（商业授权） | **未确认用户是否持有授权** |

处理原则（遵循 `Gladeye_Desktop_Codex_Goal_Clone_Plan.md` §4.3）：
- 不从系统里拷贝字体文件冒充；本目录下的 4 个 woff2 是从原站公开 URL 取得的**原件本身**，来源可追溯，但**来源可访问 ≠ 获得使用许可**。
- 若用户没有上述两族字体的授权，必须替换为已获授权的等效字体，并**记录字形与字宽偏差**，不得伪装为原字体。已知偏差风险：首页 `t-hero` 的换行位置、`regenerative` 斜体宽度、菜单条目行宽，都对字宽敏感。
- 建议替代方向（需另行确认可用许可）：无衬线 Söhne → 同类 grotesque（如 Inter、Neue Haas Grotesk 替代需授权）；衬线 Epicene → 老式衬线 + 真斜体字重。**替换后必须重跑视觉对照，不得声称像素级一致。**

## 4. 客户项目素材（双重权利）

`/work` 案例页里的图片与视频是 Gladeye 为**其客户**制作的作品（Into the Amazon、CyberBrokers、Ekos、EQTY Lab、The Virtual Economy 等）。它们同时涉及 Gladeye 与项目客户的权利。案例页中的 “Visit Site” 指向客户站点，**本项目不复刻客户站点**，也不得把客户素材用于本清单之外的用途。

## 5. 待处理项

1. **1 项 work 素材下载失败** → 见 `evidence/asset-report-work.json` 的 `summary.failed`，需按 slug 定位并记录为 `blocked`，不得用占位图顶替。
2. **4 项宽高比不符** → 说明下载到的不是原站展示所用的裁切版本；需回到页面 DOM 取正确的 `/_next/image` 源参数或原始 URL。
3. **374 MB 素材不得进入版本库**：本工作区当前不是 git 仓库。若日后初始化仓库，`public/sites/**` 必须走 LFS 或整体排除，只提交清单与生成脚本；`evidence/source-assets/**`（原站 JS/CSS 原件）与任何 HAR 同样不得入库。
4. **无外部热链**：运行时不请求 `gladeye.com`、不加载原站分析脚本（原站使用 GTM `GTM-THRNDG7` 与 GA4 `G-TM4XDY46KN`，**均未复制**）。交付前需再跑一次运行时请求审计。
5. **表单与订阅为本地模拟**：页脚/联系页的邮箱与订阅 UI 不发起任何真实提交。

## 6. 交付边界声明

本项目是**保真度研究性质的前端复刻**。可用于：本地对照、内部评审、向权利人演示差异。不可用于：公开托管、商用替换原站、或任何形式的素材再分发。若需要可公开发布的版本，必须先取得 Gladeye 的素材与商标授权、两套字体的字体授权，或全部替换为已获授权的等效素材并如实标注偏差。
