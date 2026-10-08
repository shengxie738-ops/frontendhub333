# Gladeye V1 开发检查点

更新于 2026-10-08 UTC。分支：`V1`。本提交对应 Work 两个 P1 与 Home FOV 基准修复；上一发布基线为 [63af695](https://github.com/shengxie738-ops/frontendhub333/commit/63af695812b3dae03d325c349fb3d825b4c3d411)。[本轮主管摘要与验收边界](milestones/v1-visual-motion-audit/README.md)。

## 当前结果

- Work 弹簧低帧率发散、Featured 布局 offset、Home resize 回采临时 FOV：已修复，冻结 hash 的独立窄审通过；保留既有系数、端点与尺寸更新
- 组合 11 个显式回归文件：**224/224**；scene 静态检查：**226/226**；无失败、取消或跳过
- 非增量 TypeScript、lint：退出码 0；**六个既有 warning 仍保留**，没有降低规则
- 主工作树独占 `.next` 的组合生产构建：**51/51 页面，退出码 0**
- GitHub CI：无 workflow 配置，本轮不声明 CI 通过；发布后的 status/check 另行核验

这些是受控 CPU/DOM、真实 Three CPU 对象和替代 renderer 的验证。未完成候选截图、source/candidate 像素、原生浏览器时序、媒体解码、真实 GPU 或 FPS 验收。Home FOV 是有意修复继承原站的 bug，不是已测出的像素差。

## 历史已提交阶段

- [302294d](https://github.com/shengxie738-ops/frontendhub333/commit/302294da348a0105ad664c2e4eabb5c89ce6e814)：场景验证器完整汇总
- [986fdc3](https://github.com/shengxie738-ops/frontendhub333/commit/986fdc3f7d581b4f75edf911171b8a4f3e8a49fa)：Header/Menu、Contact footer 生命周期与测试依赖
- [f8c8c21](https://github.com/shengxie738-ops/frontendhub333/commit/f8c8c215fb1dc0a157245adf6ea3f321b39735ac)：五个 Featured 本地视频按精确身份解析
- [a265a02](https://github.com/shengxie738-ops/frontendhub333/commit/a265a02628b98f4477b596267000dd00c4eebf87)：Featured 媒体与 Home 异步所有权
- [9ca1dcd](https://github.com/shengxie738-ops/frontendhub333/commit/9ca1dcd2f5ea40223a50c4fa12d4feeefe6c43b5)：Home 全流程共用 30 秒 deadline
- [e7a4296](https://github.com/shengxie738-ops/frontendhub333/commit/e7a429620c402302f9ae1108aa271684839e2f0d)：限定 render/compile/frame 失败与释放

30 秒预算、媒体准备窗口、64ms 有效时间上限和失败策略属于工程政策，不能当作新测得的原站参数。

## 显式复验

已测试：Node.js **24.19.0**、npm **11.9.0**、app-local jsdom **30.0.1**。本轮只读复用已核对的安装依赖，未另行安装。干净安装方式见 [测试 README](../gladeye-app/scripts/header-menu.README.md)；默认 `npm ci` 的既有 @emnapi peer 限制未修，曾核验的安装命令为 `npm ci --legacy-peer-deps --ignore-scripts`。

```bash
cd gladeye-app
node --test --test-reporter=tap --test-concurrency=1 \
  scripts/header-menu.test.cjs \
  scripts/contact-fidelity.test.mjs \
  scripts/contact-footer-lifecycle.test.cjs \
  scripts/verify-scene-params.test.mjs \
  scripts/featured-video-source.test.cjs \
  scripts/featured-video-lifecycle.test.cjs \
  scripts/home-recovery.test.cjs \
  scripts/home-loading-deadline.test.cjs \
  scripts/home-render-failure.test.cjs \
  scripts/work-motion.test.cjs \
  scripts/home-fov-ownership.test.cjs
node scripts/verify-scene-params.mjs
./node_modules/.bin/tsc --noEmit --incremental false
npm run lint
CIRCLE_NODE_TOTAL=2 NEXT_TELEMETRY_DISABLED=1 npm run build
```

构建环境变量仅限制已安装 Next 的默认 worker 数与遥测，不改 Next 配置。不运行 broad test discovery、legacy browser scripts、server 或 unsafe flags。

## 当前阻断与未修项

- 当日可用 source 仅 CSS 1475×946 / DPR 约 0.8 的少量非 Home 图；Oct 7 四视口未提交证据恢复时缺失。四个目标视口 1440×900、1366×768、1920×1080、2560×1440 的同条件对照仍待验收
- dot 浏览器 WebGL Disabled，localhost 路径已拒绝。私有预览已获批，两条官方路径因容量失败且没有 URL，按优先级暂停；Codex 云端留待用户之后启用
- Contact 手形/physics 功能和素材权利；CameraSampler 端点、透明 index 差异；field-probe 近裁剪限制；exit 取消残留 `extra`：均未修，不能混称本轮已解决
- 原生导航/焦点/滚动锁、五个视频 decode/autoplay/Range、Contact greeting 接缝，以及 Home context loss、hidden-tab、quality rebuild、composer-only shader pass 和深层异常清理仍需浏览器/GPU 证据
- 五个主页面及 42 个案例已有实现；`/ventures` 路由/精确媒体仍不完整，166 个正文视频未本地化，素材再分发权未确认。构建页面数不等于视觉验收内容页

下一步：先取得支持的同条件浏览器/GPU 验收证据，再按证据决定 CameraSampler/透明排序及剩余生命周期的窄修；素材身份与使用权解决后推进 Ventures。保持不绕过安全拒绝、不宣称完整离线或可公开部署。
