# Gladeye V1 开发检查点

更新于 2026-10-07 UTC。分支：`V1`。本检查点对应的已核验源码版本为 [e7a429620c402302f9ae1108aa271684839e2f0d](https://github.com/shengxie738-ops/frontendhub333/commit/e7a429620c402302f9ae1108aa271684839e2f0d)。

本轮**源码阶段收束**。这是一组已审查、已测试的分阶段修复，不是完整克隆、视觉验收或性能达标声明。

## 已完成阶段

- [302294d](https://github.com/shengxie738-ops/frontendhub333/commit/302294da348a0105ad664c2e4eabb5c89ce6e814)：修复场景验证器的完整汇总输出，保留既有检查。[里程碑](milestones/v1-verifier-repair/README.md)
- [986fdc3](https://github.com/shengxie738-ops/frontendhub333/commit/986fdc3f7d581b4f75edf911171b8a4f3e8a49fa)：Header/Menu 主题、引用与可访问属性；Contact footer 生命周期、问候语时序；声明可移植的测试依赖。[里程碑](milestones/v1-ui-lifecycle-repair/README.md)
- [f8c8c21](https://github.com/shengxie738-ops/frontendhub333/commit/f8c8c215fb1dc0a157245adf6ea3f321b39735ac)：按精确项目/视频身份解析五个已有本地 Featured MP4。[里程碑](milestones/v1-featured-video-source/README.md)
- [a265a02](https://github.com/shengxie738-ops/frontendhub333/commit/a265a02628b98f4477b596267000dd00c4eebf87)：Featured 准备/就绪/播放所有权、暂停与失败处理；Home 迟到回调、已销毁及部分构造所有者清理。[里程碑](milestones/v1-media-scene-lifecycles/README.md)
- [9ca1dcd](https://github.com/shengxie738-ops/frontendhub333/commit/9ca1dcd2f5ea40223a50c4fa12d4feeefe6c43b5)：Home 全加载流程共用 30 秒 deadline，不重置、不重试。[里程碑](milestones/v1-home-loading-deadline/README.md)
- [e7a4296](https://github.com/shengxie738-ops/frontendhub333/commit/e7a429620c402302f9ae1108aa271684839e2f0d)：限定场景同步 shader/compile 与 frame/clock/RAF 异常的失败状态和所有者释放。[里程碑](milestones/v1-home-render-failure/README.md)

30 秒预算、媒体准备窗口和失败策略是工程政策，不能当作新测得的原站参数。

## 当前验证结果

- 九个显式回归脚本：**171/171**，无失败、跳过或取消
- 静态场景检查：**226/226**
- 非增量 TypeScript、lint：退出码 0；**六个既有警告仍保留**，没有降低规则
- 最终隔离候选生产构建：**51/51 页面**；全部非生成应用输入及安装依赖与最终版本等价。没有声称另跑一次主工作树构建
- GitHub CI：没有配置或该 commit 的结果，**不能记为 CI 通过**

这些结果来自受控 Node/React/CPU 及替代 renderer 的测试。静态参数、mock-GPU 和构建通过不能证明真实 GPU、媒体解码、原站视觉或原生浏览器行为。

## 安装与显式复验

已测试环境：**Node.js 24.19.0、npm 11.9.0**。jsdom 固定为 app-local devDependency 30.0.1。安装说明见 [测试 README](../gladeye-app/scripts/header-menu.README.md)。

```bash
cd gladeye-app
npm ci --legacy-peer-deps --ignore-scripts

node --test --test-concurrency=1 \
  scripts/header-menu.test.cjs \
  scripts/contact-fidelity.test.mjs \
  scripts/contact-footer-lifecycle.test.cjs \
  scripts/featured-video-source.test.cjs \
  scripts/featured-video-lifecycle.test.cjs \
  scripts/home-recovery.test.cjs \
  scripts/verify-scene-params.test.mjs \
  scripts/home-loading-deadline.test.cjs \
  scripts/home-render-failure.test.cjs

node scripts/verify-scene-params.mjs
./node_modules/.bin/tsc --noEmit --incremental false
npm run lint
npm run build
```

默认 `npm ci` 仍受既有缺失的 @emnapi peer 条目限制，上面的 legacy-peer 命令是已验证的安装方式，不代表默认安装已修复。

不要运行无文件白名单的 `node --test` 全量发现：旧浏览器脚本有不同运行前提和未获批准的安全相关配置。上述九文件命令不会启动浏览器。

## 代码与视觉边界

- 已冻结四个 CSS 源视口的 Header/Menu/Contact 参考：1440×900（DPR 约 0.8），1366×768、1920×1080、2560×1440（DPR 0.5）。这是原站参考，不是本地视觉通过；比较必须匹配 DPR、字体、滚动和动画阶段
- 现有五个主页面及 42 个案例具备实现；`/ventures` 仍缺完整路由与精确媒体。生成 51 个构建页面不等于 51 个完成视觉验收的内容页
- 真实导航/历史、原生焦点/inert/滚动锁、五个视频的 decode/autoplay/Range、Contact 问候语接缝/物理画布仍需浏览器证据
- Home context loss/restoration、hidden-tab、quality rebuild、composer-only shader pass 的真实 GPU 编译/输出及深层异常清理仍未完成
- 166 个案例正文视频仍未本地化；素材再分发权未确认，不能宣称完全离线、可公开部署或权利已解决

## 当前阻断

- 当前测试浏览器禁用 WebGL，并明确拒绝 localhost 访问；已有终端 HTTP 成功不能代替浏览器验收。不得绕过安全拒绝
- 私有预览许可与额外图形运行许可尚未收到回复；首页可用 WebGL 与真实 GPU 性能均未验证
- Ventures 的五个图像来源和一个独立视频均缺合格本地文件，许可待解决。不能用同名项目的其他视频替代；Contact 手形素材也未获得再分发确认

## 下一步三个优先任务

1. **合规预览与视觉对照**：私有预览获准后，先推进非 WebGL 页面的四 CSS 视口原站/本地/差异记录，覆盖真实菜单、导航、媒体和反向输入；首页 3D 待可用 WebGL 后单独验证。验收：无关键导航/资源错误、无未说明降级；未测项逐项保留
2. **剩余图形生命周期**：单独测试 context loss/restoration、隐藏/恢复、quality 重建和 composer-only GPU pass。验收：失败后可导航、所有权不复活、不重复循环；受控测试与获准真实 GPU 结果分别记录，不能混称性能通过
3. **Ventures 资产与路由完整性**：解决精确媒体与使用权，再冻结组件规格并实现 `/ventures`。验收：素材身份正确、全部现有路由保留、深链接/返回/主题/页脚正确，有匹配参考的视觉证据；无替代媒体冒充原资产

此检查点不包含截图、素材、私有下载地址或运行环境路径；不授权部署、真实表单/订阅、埋点或新的素材再分发。
