# Gladeye 克隆 — CONFIRMED-BUNDLE 事实基线

> 本文件是**唯一事实来源**。所有数值来自原站已发布产物（`/_next/static/chunks/*`、`/_next/static/css/*`、`/valley/*`）的逐字提取，不是估计、不是推断。
> 抓取时间：2026-10-06T17:13–17:25Z，视口 1129×772 @dpr1.5，GPU：RTX 4060 / WebGL2。
> 任何与 `Gladeye_Desktop_Codex_Goal_Clone_Plan.md` 中 `PROPOSED` 参数冲突处，以本文件为准。

## 1. 路由清单（全部 HTTP 200，实测）

```
/  /work  /about  /contact  /careers
/work/into-the-amazon  /work/cyberbrokers  /work/ekos-genesis  /work/the-virtual-economy
/work/hypercinema  /work/the-examination  /work/the-sweetshop  /work/wildsam
/work/openavn  /work/where-opportunity-takes-root  /work/social-mobility-in-the-digital-age
/work/the-dj-and-the-war-crimes  /work/eqty-lab-website  /work/templar
```
每个路由的 DOM/文本/图片/SVG/主题变量已解析到 `evidence/content/<route>.json`，原始 HTML 在 `evidence/source-pages/`。全站 Storyblok 资源 URL 去重表：`evidence/content/_asset-urls.json`（2024 条）。

## 2. 首页机制（决定性结论，取代 plan 文档的全部猜测）

| 项 | 实测事实 |
|---|---|
| 渲染技术 | `<canvas data-engine="three.js r154">`，上下文 **WebGL2**，**Three.js r154** |
| 首屏不是 | 不是 video、不是 img（首页 `imgCount=0`、`video=[]`） |
| 花草实现 | **`THREE.Points` GPU 点云精灵**（BufferGeometry + ShaderMaterial），`transparent:true, depthTest:false`；**不是** InstancedMesh |
| 文档滚动 | `html{overflow:hidden}`、`body{position:fixed;height=100vh}`、`scrollHeight==innerHeight` → 页面**无原生滚动** |
| 滚动输入 | **Lenis**（bundle 内 `{el, touchMultiplier:20}`），`d.on(e => u += e.deltaY)`，虚拟滚动量映射为相机路径进度 |
| 相机驱动 | 由 `/valley/camera-path07.glb` 的烘焙动画曲线驱动（见 §4） |
| 指针 | `window.addEventListener('pointermove', onMouseMove)`，`mouse={x:pageX/innerWidth, y:(pageY-scrollY)/innerHeight}`，`animMouse=Vector2` 平滑跟随，在顶点着色器里对**全屏幕**点产生位移（见 §6） |
| canvas 挂载 | `document.body.prepend(renderer.domElement)`；`documentElement.classList.add('homepage')` |
| DPR | `maxPixelRatio = (innerWidth<CUTOFF || innerHeight<CUTOFF) ? 2 : 1`；`composerPixelRatio = pixelRatio = min(maxPixelRatio, devicePixelRatio)` |
| 类名 | `FlowerValley_wrapper__2YGx1` / `FlowerValley_canvas___rS8E` / `FlowerValley_textContainer__PZdtA` / `FlowerValley_showreelUI__0cLeS` / `_showreelBackButton__GwnLv` / `_showreelPlayButton___soMY` / `_showreelPauseButton__yrpqI` / `_showreelMuteButton__nbdnh` |
| 文字动画 | `FlowerValleyText_character__4j45e`、`_isVisible__8vqou`、`_animate-in__CIGec`、`_animate-out__JgJtR`、`_cta__3mukC`；逐字符 `--delay` 步进 **0.015s**，`--duration: 0.25s` |
| 文案 | `h2.t-hero`：`Creative innovation<br />for a <i>regenerative</i> future`；CTA：`Explore our work`；音频按钮 `aria-label="Unmute audio"` |
| Loader | `Loader_loader__iUG7H`/`spinnerWrapper__n5mpi`/`spinner__lGyv4`/`rotate__X4lFd`/`circleWrapper`/`circle-animation__kG_YY` |

## 3. 场景参数（逐字，`X` 类构造函数 `this.settings`）

```json
{
  "threshold": 0, "strength": 0.25, "radius": 0, "exposure": 1,
  "cameraMaxRotationX": 0, "cameraMaxRotationY": 0, "fovMultiplier": 1.2,
  "uCamNear": 10, "uCamFar": 77,
  "uTerrainOffsetX": 1, "uTerrainOffsetY": 0.33,
  "uFlowerBaseScale": 3853, "uLeavesBaseScale": 2500,
  "uFlowerBloomDistance": 24, "uLeafGrowDistance": 55,
  "uRepulsionStrength": 0.5, "uBrightnessOnTouch": 0.5,
  "uNegativeSpaceDeepness": 0.184,
  "uSpriteSheetMix": 0, "uSigmoidSteepness": 15,
  "uDustSize": 72, "uMaxAlpha": 0.05, "uFadeSpeed": 1.3,
  "cameraMaxDistanceDiff": 0, "cameraEase": 0.15,
  "fadingMouse": false, "mouseDebug": false,
  "uInteractionPositionOffset": 0.32,
  "uNoiseAlpha": 0.02, "uNoiseDensityThreshold": 0.5,
  "bloomParams": { "exposure": 1, "strength": 0.5, "threshold": 0.4, "radius": 0.2 },
  "uMaxDispersedPosX": 100, "uMaxDispersedPosY": 65,
  "dispersalAmountMultiplier": 1.334, "dispersalRandomnessWeight": 0.53,
  "dispersalIsFlowerWeight": 0, "dispersalPositionYWeight": 0
}
```
相机：`new THREE.PerspectiveCamera(27, innerWidth/innerHeight, 1, 77)`。
渲染器：`renderer.outputColorSpace = SRGBColorSpace`；`fbo = new WebGLRenderTarget(w,h,{type, colorSpace: sRGB})`。
uniforms 命名（节选，全部小驼峰带 u 前缀）：`uTime uTotalZ uContainerPos uTerrainOffsetX/Y uLeavesBaseScale uFlowerBaseScale uFlowerBloomDistance uLeafGrowDistance uNegativeSpaceDeepness uRepulsionStrength uBrightnessOnTouch uCamNear uCamFar uLuminosity uCanvasTexture uSpriteSheetPool uSpriteSheetPool2 uDispersalProgress uMousePosition uComposerPixelRatio uCamFov uCamFovBase res`。

## 4. 相机路径原件（真实资产，直接复用）

`public/valley/camera-path07.glb`：Blender glTF 导出，单节点 `Camera`，1 个动画 `Action.001`，3 通道（translation/rotation/scale LINEAR），**200 关键帧**，t∈[0, 8.291666] s ⇒ **24 fps**。
GLB 内 camera：`yfov=0.39959648408210363 rad (22.9°)`, `aspect 1.7778`, `znear 0.1`, `zfar 1000`；节点静止四元数 `[0,-0.03702882304787636,0,0.9993141889572144]`。
解码后的 200 组 VEC3 位移 + VEC4 旋转：`gladeye-app/src/experience/data/camera-path07.json`（脚本 `scripts/extract-camera-path.mjs`）。
驱动逻辑（逐字）：`progress = clip.duration * pct % 1`；`mixer.setTime(clip.duration * pct)`；
`obj.position.x += (gltfCam.position.x - obj.position.x) * 0.4`；y 同；`dz = gltfCam.z - obj.z`，`dz > o → ease = 1`，`dz < -o → ease = 1`；`obj.position.z += dz * ease`；`obj.rotation.copy(gltfCam.rotation)`。
运行时用 `cameraAnimProgress` 与 `uContainerPos` 同步到着色器。

## 5. 资产原件（已放入 `gladeye-app/public/valley/`，路径与原站一致）

| 路径 | 用途（来自 bundle 逐字代码） |
|---|---|
| `valley/camera-path07.glb` | 相机动画路径 |
| `valley/flowers/pool_summer.png` | `uSpriteSheetPool`（精灵图集，夏季花色池） |
| `valley/flowers/pool_winter.png` | `uSpriteSheetPool2`（冬季花色池，季节/花色混合） |
| `valley/vignette.png` | `vignetteTexture`，独立 mesh，`renderOrder: 99` |
| `valley/dust-particle.png` | `dustParticle`（尘埃点精灵） |
| `valley/rays/ray1..3.png` | `godRayTexture/2/3` |
| `valley/terrain.png` | `terrainMapImage`，**CPU 端 ImageData 采样**生成地形与布点 |
| `valley/audio/ge-ambient.mp3` | 环境音（3.1 MB，默认静音） |
| `src/app/fonts/*.woff2` | `soehne-kraftig` `soehne-leicht` `epicene-text-light` `epicene-text-light-italic` |

七张贴图全部 `texture.colorSpace = SRGBColorSpace`（逐字：`e.colorSpace=a.KI_` ×7）。
GLTF 加载器配置了 Draco：`dracoLoader.setDecoderPath('/assets/draco/')` ⇒ 工程需暴露 `/assets/draco/`。

## 6. 着色器原件与分工（`evidence/shaders/`，逐字提取，**必须原样使用**）

| 文件 | 角色 |
|---|---|
| `module-9169-6.glsl` | 花草 Points **顶点**着色器（18 KB）：地形位移、生长 smoothstep、屏幕空间点大小、消散 mix、鼠标推挤、fog |
| `module-4025-5.glsl` | 花草 Points **片元**着色器（7 KB）：精灵图集取色、`vColorCoordinate/vIsLeaf/vIsFloor/vPoolId`、`uSpriteSheetMix`、sigmoid |
| `module-7936-1.glsl` | 尘埃顶点（`uDustSize`、`aMovementRange`、`uDispersalProgress`、easeOutCubic） |
| `module-526-0.glsl` | 尘埃片元（`gl_PointCoord`、旋转、`#include <colorspace_fragment>`） |
| `module-5249-3.glsl` | 神光/光芒片元（`uRay1/2/3`、simplex2D、`uShowRay`、`uScrollPos/2/3`、`uMaxAlpha`、`uFadeSpeed`、`uFlip`） |
| `module-2551-4.glsl` `module-9744-9.glsl` | 对应顶点着色器 |
| `module-5165-8.glsl` | 暗角片元（`uVignetteTexture`、`uShrinkFactor`、屏幕/纹理分辨率） |
| `module-4291-7.glsl` | 噪点后期 pass（`tDiffuse`、`uNoiseAlpha:.02`、`uNoiseDensityThreshold:.5`） |
| `module-255-2.glsl` | **路由切换 glitch pass**（`uFade uGlitchAmount uDarkenFactor uDistortion uGlitchMultiplier uShiftMultiplier`）— 页面间视觉变换 |

顶点着色器关键逻辑（务必保留）：`offsetDirection = aValleySide * -1.`；`isTooDeep = uNegativeSpaceDeepness*0.009 > aTerrainNoise && !isFloorTexture`；`isLeaf = uNegativeSpaceDeepness > aTerrainNoise ? 1 : 0`；`pos.y += terrainNoise*uTerrainOffsetY*yNoise`；`pos.x += terrainNoise*uTerrainOffsetX*offsetDirection`；生长用 `rawPos.z`（屏幕深度）做 `smoothstep(flowerBloomDistance, *1.5+noise*0.5, d)` 与 `sineOut`；`pSize = size/abs(pos.z-uContainerPos.z)`；`gl_PointSize = pSize*animatedScale*0.5*uComposerPixelRatio*(res.y*0.00125)*(uCamFovBase/uCamFov)`；鼠标：`moveVal = (1/(zDistance/5)) - distanceToMouse`，全屏幕应用 `finalPos.xy += moveVal*[cos,sin](angle)`；动画噪声 `fastNoise3d(finalPos.xyz*2, uTime*0.2)`，x/y 各 ×0.2；`aIsFloorDiscard>0.5` 时把点移出视野。

attribute 列表：`position, aSpriteScale, aSpriteIndex, aRandomSeed, aColorCoordinate(vec2), aIsFloorDiscard, aIsFloorPool, aPoolId, aValleySide, aTerrainNoise, aYNoise, aFlowerGrowNoise`。

## 7. 布点生成参数（CPU，来自 `terrainLookUp` 代码，逐字）

离屏 canvas `willReadFrequently` + `fillStyle="red"` + `drawImage(terrain.png)`，`S = R(ctx, w)` 取 ImageData；
`T = 2000`（总数，低性能档 1500）、`D = 400`（低 100）、`A = 5`、`z = floor(D/2) = 200`、`N = 15`（低 10）、`E = 30`（低 20）；`_ = cameraAnim.update(0.9999,false).z`。
完整函数体请在 `evidence/source-assets/js/app/page-4c279de0997d388f.js` 内检索 `terrainLookUp` 并读取上下文（±5000 字符）逐段还原，不得凭想象改写。

## 8. 后期链

`EffectComposer(renderer)` → `RenderPass(scene,camera)` → `UnrealBloomPass(new Vector2(w,h), 1.5, .4, .85)` 随后被 `settings.bloomParams` 覆盖为 `strength .5 / threshold .4 / radius .2 / exposure 1` → 自定义 `splitPass`（噪点/glitch）。
`useBoostPerformance`（低性能档）会整体移除 bloom+split pass 与 composer，直接渲染。

## 9. 设计令牌（`/_next/static/css/*` 逐字）

字体族：`Epicene, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`（衬线，全部 `font-weight:300`，有真斜体 `epicene-text-light-italic`）；`Soehne, ui-sans-serif, system-ui, ...`（无衬线）。

```css
.t-hero{font-size:max(4.5vw,2rem);font-family:Epicene…;font-weight:300;line-height:110%;letter-spacing:0}
.t-h1{font-size:clamp(2.5rem,6.5vw + 1rem,8rem);…;line-height:100%;letter-spacing:-.02em}
.t-h2{font-size:clamp(2rem,3.5vw + 1.2rem,5rem);line-height:110%;letter-spacing:-.01em}
.t-h3{font-size:clamp(1.5rem,2.4vw + .9rem,3.5rem)}
.t-h5{font-size:clamp(1rem,1.2vw + .7rem,2rem)}
.t-d2{font-size:clamp(2.625rem,4.6vw + 1.6rem,6.5rem)} .t-d3{font-size:clamp(1.6875rem,5.7vw + .4rem,6.5rem)}
.t-p{font-size:clamp(1rem,.2vw + .9rem,1.1875rem);line-height:145%;font-weight:300;letter-spacing:-.01em}
.t-p-sm{font-size:clamp(.875rem,.1vw + .8rem,1rem);line-height:140%}
.t-p-md{font-size:clamp(1.1875rem,.4vw + 1.1rem,1.5rem);line-height:130%} .t-p-md-alt{同尺寸,Epicene}
.t-p-lg{font-size:clamp(1.25rem,.6vw + 1.1rem,1.75rem);line-height:130%} .t-p-lg-alt{同尺寸,Epicene}
.t-meta{font-size:clamp(.5rem,.3vw + .4rem,.75rem);line-height:100%;letter-spacing:.08em;text-transform:uppercase;font-weight:400}
.t-list{font-size:clamp(.75rem,.9vw + .5rem,1.5rem);line-height:130%;font-weight:400}
.t-list-sm{font-size:clamp(.75rem,.3vw + .7rem,1rem)}
.t-team-meta{font-size:clamp(.5rem,.8vw + .3rem,1.1875rem);font-weight:300;line-height:145%}
.t-work-stat{font-size:clamp(.75rem,.5vw + .6rem,1.1875rem);font-weight:300;line-height:130%}
.t-work-award{font-size:clamp(.75rem,.9vw + .5rem,1.5rem);font-weight:300;line-height:130%}
.t-contact-meta,.t-menu-meta{font-size:clamp(.75rem,.3vw + .7rem,1rem);line-height:140%;letter-spacing:-.004em}
.t-footer-meta{font-size:16px;line-height:140%;letter-spacing:-.004em}
.px-sms{padding-inline:clamp(1rem,.6vw + .9rem,1.5rem)}
.duration-theme{transition-duration:.5s}
.z-Header{z-index:200} .z-main{z-index:100}
.h-Header-height{height:var(--site-header-height)}
.bg-theme-primary{background:rgb(var(--theme-primary)/var(--tw-bg-opacity))}
.text-theme-secondary{color:rgb(var(--theme-secondary)/var(--tw-text-opacity))}
```

主题变量（RGB 三元组形式，逐字来自首页 header/main 内联 style）：
```
--theme-primary:16 16 16; --theme-secondary:255 255 255; --theme-tertiary:255 255 255;
--theme-header:255 255 255; --theme-header-secondary:125 125 125;
--theme-header-button-text-default:255 255 255; --theme-header-button-text-roll-over:0 0 0;
--theme-header-button-bg-default:125 125 125; --theme-header-button-bg-roll-over:255 255 255;
```
注意原站拼写为 `roll-over`（不是 hover）。`--site-header-height` 实际值需在浏览器/`evidence/source-assets/_next/static/css/70ccb8e7fa150b80.css` 内核对（`grep site-header-height`）。各页 `data-theme="dark|light"` 决定主题；页脚/关于/联系的主题不同，必须按 `evidence/content/<route>.json` 的 `themes` 字段还原。

## 10. 外壳 DOM（逐字）

```html
<div class="dark pointer-events-none fixed inset-x-0 z-20 z-Header text-theme-header transition-colors duration-theme" style="--theme-header:255 255 255;…">
  <div class="flex h-Header-height items-center justify-between px-sms">
    <div class="w-[98px] sm:w-[130px]"><a class="pointer-events-auto" aria-label="Home" href="/">«logo svg viewBox="0 0 2401 590" class="h-auto w-full fill-current"»</a></div>
    <div class="flex justify-center Header_buttonContainer__rN6i5">
      <button class="pointer-events-auto Header_button__qn2Wj Button_main__NewW7 Button_default__CcbQU"><span class="Button_inner__d7ZPg">Menu</span></button>
    </div>
    <div class="hidden w-[130px] justify-end md:flex"><a aria-label="About" href="/about"><div class="w-[50px] fill-current" style="opacity: 1">«RandomFlower svg viewBox="0 0 50 43.49" class="RandomFlower_svg__Fz3ul h-auto w-full"»</div></a></div>
  </div>
</div>
<main style="--theme-primary:16 16 16;--theme-secondary:255 255 255;--theme-tertiary:255 255 255" class="bg-black">
  <div style="opacity:1">
    <div class="relative z-main bg-theme-primary [transition-bg duration-theme]"> …page sections… </div>
  </div>
</main>
<section data-theme="dark" class="text-theme-secondary transition-colors duration-theme"> … </section>
```
Logo 与 RandomFlower 的**原始 SVG path 已存** `evidence/content/_root.svgs.json` 与各页 svgs 文件；必须原样内联为 React 组件，不得用相似字体重排字标。
Framer Motion 变体（逐字）：`{scale:1.1,transition:{duration:1}}` / `initial:{scale:1,transition:{duration:1}}`；页面容器 variants 按路由 `"/"===y?p:v` 切换。

## 11. 音效与菜单

`Header_button` 打开 `MenuOverlay`（`menu-open` 状态见 `evidence/content/_root.json` links）；音频按钮 5 条 `<line>` 用 `scaleY(0.3|0.6|1)` 做频谱律动；`ge-ambient.mp3` 默认静音（`isMuted:true`），zustand store 提供 `toggleMute/muffleBG/updateVolume/stopBackgroundMusic`；离开首页时 `startExitTransition()` 触发着色器 `uDispersalProgress` 消散 + glitch pass。

## 12. 复现命令

```
node scripts/extract-camera-path.mjs evidence/source-assets/valley/camera-path07.glb gladeye-app/src/experience/data/camera-path07.json
node scripts/extract-shaders.mjs      # -> evidence/shaders/*.glsl
node scripts/extract-content.mjs      # -> evidence/content/*.json
node scripts/mine-chunks.mjs          # -> evidence/js-mine.txt
```
