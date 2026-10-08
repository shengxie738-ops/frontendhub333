# V1 前端动效与首页 FOV：有界审计及修复

日期：2026-10-08 UTC。分支：`V1`。本提交对应下列三个确定性问题的修复，上一发布基线为 [63af695](https://github.com/shengxie738-ops/frontendhub333/commit/63af695812b3dae03d325c349fb3d825b4c3d411)。仅在 dot 云端执行；未使用用户电脑或 Codex 云端。

## 主管摘要

**三个问题已完成生产代码修复、独立窄审及组合 CPU/DOM 验证。视觉、原生浏览器时序、真实 GPU 和性能验收仍未完成。** 本轮没有候选截图或像素差，不声明已完整还原原站。

1. **Work 共用弹簧在低帧率发散（P1）。** 真实生产函数重放确认：光标在 30Hz 的 120 步后约为 `-4e61`，既有 64ms 上限仍不能保证稳定。替换为固定采样目标下阻尼弹簧的解析状态推进，保留 stiffness/damping/mass、target/velocity 语义、`.001` rest 阈值及 64ms 有效时间上限。正常与低帧率受控输入收敛；独立 RK4 的 540 组状态对比通过。旧 Euler 的早期数值并未保持，真实观感与当日 live 动效仍须比较。
2. **Featured reveal 行程与历史 offset 契约不符（P1）。** 历史契约是 `start end → end end`，旧实现要到图片离开视口才结束，且自身 transform 会反向影响几何测量。现使用未变换的 offsetParent/offsetTop 与 clientHeight，进度在布局 top 到达 viewport bottom 时为 0、bottom 到达时为 1；首屏 bypass 共用布局坐标。保留 image target、CSS、层级、opacity、cropper `.8→1` / image `1.4→1` 端点。真实浏览器的布局取整、字体 settle、逆向滚动与时序仍待验收。
3. **Home resize 污染 FOV 基准（P1）。** 真实生产方法重放确认：27° → hover 59.4° → resize 捕获为 base → 继续 hover 130.68°，可重复累乘。实例在任何 frame 前持有未调制的 27°，resize 不再采样展示 FOV，仍更新 projection/尺寸和 uniform。保留 hover `1.2`、exit `20 * extra` 及插值速度。该问题也存在于历史原站，本轮是有意质量改善，并非已测出的 source/candidate 像素差。

## 已验证证据

- 两个修复包按最终源码/测试与完整 diff 的 SHA-256 逐项匹配后整合；独立 reviewer 对对应 hash 均给出无阻断问题结论。源码整合后未改写冻结算法。
- Work 新 suite 原生产 RED：44 项中 29 项预期失败；修复 GREEN：44/44。Home FOV 原生产 RED：8 项预期失败、1 项控制通过；修复 GREEN：9/9。
- 本轮组合 11 个显式回归文件：**224/224**，0 fail、cancelled、skipped；含原有 171 项和新增 53 项。
- 静态 scene verifier：**226/226**。
- 非增量 TypeScript 与 lint：退出 0，**六个既有源码 warning 保留**，没有降低规则。
- 主工作树独占 `.next` 的组合 production build：**51/51 页面，退出码 0**。
- GitHub CI 不记为通过：仓库没有 workflow 配置，发布后的 status/check 结果另行核验，不能用本地 build 代替。

以上来自 Node 24.19.0、npm 11.9.0、React/DOM 受控指标、真实 Three CPU 对象及替代 renderer。未安装或修改依赖；只读复用同 package、同包版本/integrity 的已安装依赖。mock renderer、静态参数和测试数量不是 GPU、媒体解码、FPS 或像素证据。

## 修改范围及复验

七文件白名单：Work `motion.ts`、`FeaturedWorkGrid.tsx`；Home `ValleyScene.ts`；新增 `work-motion.test.cjs`、`home-fov-ownership.test.cjs`；本里程碑及 `docs/V1_STATUS.md`。没有提交原始 research、源码 bundle、截图、媒体、私有 URL 或部署配置。组合复验命令见 [V1 检查点](../../V1_STATUS.md)。

两个独立包的完整 diff SHA-256：

- Work：`681daa936c7dcd9525447d1361c8c5ddc094b6346fc8ed34d6bf20426620862d`
- Home FOV：`4a805f55d3523f1985449354d1223edcf5ff75c201346b3edd018f5f257ee94d`

## 未解决及下一验收门

- 当前可用的当日 source 仅 Oct 8 少量非 Home 参考图：CSS 1475×946、DPR 约 0.8。Oct 7 四视口未提交证据在磁盘恢复时缺失，不能宣称现有四视口证据已可复验。目标 1440×900、1366×768、1920×1080、2560×1440 的同条件 source/candidate/差异记录仍待完成。
- 当前 dot 浏览器 WebGL Disabled，localhost 路径已遭策略拒绝；不得绕过。私有预览已经获批，但两条官方创建路径均因容量失败，没有可用 URL。按当前优先级暂停预览；Codex 云端留待用户之后启用。
- Contact 手形/physics canvas 仍是功能缺口；素材权利未解决。不得用替代手形冒充，未提交或重新分发素材。五个视频 decode/autoplay/Range、导航/历史、焦点/inert/scroll lock、Contact greeting 接缝仍待原生浏览器证据。
- CameraSampler 端点 clamp 与历史 LoopRepeat、一次性透明排序/index 差异未修；不能从 CPU 索引差直接下像素优劣结论。field-probe 未处理近裁剪的理论面积不能作可见面积、overdraw 或 FPS 结论。
- exit 取消仍可能保留 `extra` 与 `-20 * extra`。FOV 包只阻止 resize 污染 base，不宣称取消退出后必回 27°；该恢复仅在调制归零或新实例时成立。
- Home context loss/restoration、hidden-tab、quality rebuild、composer-only shader pass、深层异常清理及最终颜色/FPS 仍需真实 GPU 验收。
- `/ventures` 的路由与精确媒体不完整；166 个案例正文视频未本地化，素材再分发许可未确认。51 个生成页面不等于 51 个视觉验收内容页。

本轮不包含 PR、main 修改、合并、部署、真实表单/订阅或新增埋点。只把已确定且可有界修复的问题推进到 `V1` 源码阶段。
