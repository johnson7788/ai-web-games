# RALLY DUST 3D — 3D 细化（GLB 主体替换）交付

遵循 `docs/batch3d/INTEGRATION-GUIDE.md`。仅改 `games/rally-dust-3d` 目录；玩法/碰撞/物理/判定（`src/game/*`、`config/*`）零改动。

## 1) 改了哪些文件 / 函数

只改 `src/render/index.js`（纯渲染层）：

- **顶部 import**：新增 `loadModelData`（`../../lib/model-loader-data.js`）、`RoomEnvironment`（`../../lib/RoomEnvironment.js`）、三个 data-URI 模型 `rally-car.glb.js` / `rally-boulder.glb.js` / `pine-tree.glb.js`。三个模块均已就绪，直接静态 import，无需轮询。
  - `model-loader-data.js` 内部 `import './three.module.js'` 与 index.html import map 的 `'three'` 同指 `lib/three.module.js`，模块实例一致。
- **`createRenderer`（PBR 光照）**：renderer 创建后加 `ACESFilmicToneMapping` + `shadowMap.enabled=!software` + `PCFSoftShadowMap`；scene 创建后 `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` 接 `scene.environment`（车漆/金属/岩石反射）。
  - 主光 `sun` 加 `castShadow`、`shadow.mapSize 2048`、`shadow.camera ±55 / near20 / far280`、`bias -0.0004 / normalBias 0.03`。
  - 新增 `followSun(x,z)`：主光与 `sun.target` 每帧跟随车辆（赛道长 1400–1800m，静态阴影相机只能盖起点）。`renderGame`/`renderTitle` 各调用一次。
- **GLB 异步管理**：新增 `glb`/`glbWaiters` + `useGLB(key,fn)` + `loadGLB(key,data,opts)`。到位前用程序化 fallback，到位后回调视觉替换；`catch` 静默保留 fallback。世界重建用 `built.alive` 标志防止旧世界的回调写入已移除的 root。
- **`buildCar(useGLB, software)`**：程序化 Box 车壳收进 `fallback` Group（材质升级为 MeshStandardMaterial）；`useGLB('car', targetLen 4.2, forward '+z')` 到位后 `group.remove(fallback); group.add(model)`。GLB 车壳替换 Box 车身。
- **`buildWorld`**：
  - 地面/路面 `receiveShadow=true`。
  - 路边装饰树：保留程序化锥 `InstancedMesh` fallback；`useGLB('pine', targetLen 4)` 到位后把 GLB 单 mesh 的归一化变换烘焙进几何（`geo.applyMatrix4(src.matrixWorld)`），仍用 `InstancedMesh`（单 draw call，60 棵），实例缩放 `sc*1.5` 对齐原锥树冠高度。
  - 障碍树：移除原 `tree.webp` billboard 分支，保留锥 fallback；复用同一 pine 缓存模型克隆，缩放 1.7（高≈6.8，对齐原 7 高锥树）。
  - 撞车石：保留十二面体 fallback；`useGLB('rock', targetLen 2)` 克隆替换，缩放 `sc*1.5`、`y=0.8-1.14*sc`，保持原十二面体直径/顶高/埋深轮廓。
- **`setCamera`**：hood 视角隐藏车壳（见下「保留玩法引用」）。
- **`dispose`**：补 `scene.environment.dispose()`。

## 2) 换了哪些主体

| 主体 | 原网格 | GLB | targetLen | forward |
|---|---|---|---|---|
| 主角拉力车 | Box+Cylinder（buildCar） | rally-car | 4.2 | +z |
| 撞车石 | Dodecahedron（buildWorld） | rally-boulder | 2 | +z |
| 路边锥树/障碍树 | Cone+billboard（buildWorld） | pine-tree | 4 | +z |

朝向判定：原车头朝 +Z（大灯 z=+2.16、引擎盖 z=+1.6）。解码 GLB 几何确认车顶轮廓（−Z 长低引擎盖、+0.2 尾翼尖、+Z 尾箱）原生车头朝 −Z，经 loader `forward:'+z'`（绕 Y 转 π）后朝 +Z，与原车一致。截图确认追车视角看到车尾/尾灯，朝向正确。

## 3) 保留了哪些玩法引用

- **四轮 pivot 旋转驱动**：`car.wheels`（4 个 hub Group）与 `renderGame` 里 `hub.rotation.x += p.speed*dt*2.4`（滚动）、`hub.userData.front` 时 `hub.rotation.y = -p.steerSmooth*0.4`（前轮转向）完全保留。程序化胎+金属轮辋略大于 GLB 轮以包覆，位置对齐 GLB 轮拱（x±0.80、前 z+1.30 / 后 z−1.12、y0.40），滚动/转向可见。
- **车身姿态驱动**：`car.group.position/rotation.y(yaw)/rotation.z(侧倾)` 不变。
- **车身改色材质引用**：原代码无每帧改色（红漆静态），保留 `red` 材质用于 fallback；GLB 自带红色拉力涂装（截图确认 maroon/红 + 泥渍贴花）。
- **碰撞/判定**：障碍碰撞在 sim（s,t,r 空间，`updateObstacles`），渲染替换不动判定；漂移/车损/躲障碍/赛段计时全保留。
- **hood 视角**：原 Box 座舱从内部靠背面剔除「透视」看到路面；GLB 封闭舱会挡镜头，故 `setCamera('hood')` 时 `car.setShellVisible(false)` 隐藏车壳（车轮保留），还原原清晰前视。chase 视角恢复显示。纯视觉，不影响玩法。
- 尘烟粒子、相机抖动、检查点拱门、起终点线、天空/路面贴图槽位均原样保留。

## 4) 验收

- `/opt/homebrew/bin/node --check src/render/index.js`：OK。
- `/opt/homebrew/bin/node --test tests/sim.test.mjs`：**22/22 pass**（玩法逻辑无回归）。
- 截图（硬件 GL，自动 start+skip tutorial）：0 console error / 0 pageerror / 0 失败请求。
  - 主交付：`/tmp/refine-rally-dust.png`（stage1 追车，GLB 红车朝前、四轮贴合、车底软阴影）。
  - 辅助：`/tmp/refine-rally-title.png`（标题英雄镜头）、`/tmp/refine-rally-trees.png`（stage3 松树，树干+分层枝、落地自然）、`/tmp/refine-rally-rocks.png`（stage4 撞车石，纹理石、贴地）、`tests/artifacts/refine-rally-hood.png`（hood 前视清晰）、`tests/artifacts/refine-rally-drift.png`（漂移侧身+车底阴影）。
  - 副本同步在 `tests/artifacts/refine-rally-*.png`。
- 未起常驻服务器（截图用临时 python http.server，脚本结束即 kill）。

## 5) 已知问题 / 说明

- GLB 车高≈1.98（含尾翼/顶灯），比原 Box 车（≈1.34）高；追车相机（height 3.6）视野无碍，hood 视角已用隐藏车壳处理。
- 装饰松树/撞车石在 GLB 基础尺寸上分别乘 1.5 的实例缩放，以对齐原程序化网格的视觉体量（原锥树高 6·sc、十二面体直径 3·sc）；targetLen 仍按指南取 4 / 2。
- 软件渲染（swiftshader 等）下自动关阴影（`!software`），与既有降级策略一致。
- 标题屏不建世界 mesh 的既有哨兵行为（`builtStage=-1` 与预览 stage -1 同值）未动，属 integrate 阶段遗留，非本次引入。
- 三个 GLB 共≈8MB base64（车 4.5M/树 2.5M/石 1.2M），首屏异步解码约 1–2s，期间显示程序化 fallback，不白屏不报错。