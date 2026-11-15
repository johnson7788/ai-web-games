# TOWER CLIMB（霓虹塔攀）· 3D 细化（GLB 主体替换）交付

遵循 `docs/batch3d/INTEGRATION-GUIDE.md`：程序化粗模 → AI 高精度 GLB，**玩法/碰撞/物理零改动**，只换视觉网格。base3d 已含 RoomEnvironment+ACES+阴影，未再动光照。

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | 唯一代码改动。顶部新增 `loadModelData` 与三个 GLB data 模块 import；塔心 / 悬浮平台 / 塔顶信标三处主体按「保留程序化 fallback → 异步加载 GLB → 成功移除 fallback 加入 GLB → `.catch(()=>{})` 兜底」模式替换。新增 `applyPlatformTops()`（可重入顶面贴图）、`attachPlatformGLB()`（按碰撞足迹贴合 GLB 底板）、信标呼吸光晕（独立计时 `beaconT`）。 |
| `tests/after-refine.png` | 新增：细化后游玩截图（与 `tests/before-refine.png` 对照）。 |
| `docs/batch3d/tower-climb/delivery-refine.md` | 本交付文档。 |

`lib/models/{tower-core,neon-platform,summit-beacon}.glb.js` 为已就绪资源，直接引用，未改动。`sim.js` / `config/*` / 判定逻辑一律未动。

## 2) 换了哪些主体

| 主体 | 原网格 | GLB | 加载参数 | 视觉贴合 |
| --- | --- | --- | --- | --- |
| 塔心 `tower-core` | `CylinderGeometry(1.2,1.7,60,12)` 亮紫柱（MeshBasic） | 电光紫结晶尖塔（188k tris） | `targetLen:8, forward:'+z', key:'tower-core'` | 加载后非均匀贴合原柱足迹 `(3.4, 60, 3.4)`：整塔高 60、底径 3.4（=原 radiusBottom 1.7×2）。材质 `color=紫.lerp(白,0.55)`、`emissive=紫`、`emissiveIntensity 0.7`、metalness 0.3 / roughness 0.5，还原原亮紫柱「目标入画」可读性。 |
| 悬浮平台 `neon-platform` | `BoxGeometry(half*2,0.45,half*2)` 板 + 发光边条 | 霓虹岩板（74k tris/个，19 个共享几何） | `targetLen:3, forward:'+z', key:'neon-platform'` | 每平台克隆独立材质，按碰撞足迹缩放 `(half*2, 0.55, half*2)`，顶面对齐本地 y≈0（与原 slab 顶面/碰撞面一致）。**保留原发光边条 edge + 底部光晕 under 叠加**；under 随底板厚度下移到 -0.58。 |
| 塔顶信标 `summit-beacon` | `SphereGeometry(1.5)` 品红光球（MeshBasic） | 品红宝石球+金属基座（76k tris） | `targetLen:2, forward:'+z', key:'summit-beacon'` | 等比放大到约 3.5m（原光球直径 3），底部落塔顶 y=59.8。材质 `color=品红.lerp(白,0.5)`、`emissive=品红`、`emissiveIntensity 0.6`。**保留 beaconGlow 光晕球 + lightBeam 冲天光柱**，光晕中心移到球体 (0,62,0)。 |

### 关于 targetLen 的说明（重要）
任务给的 `targetLen≈8/3/2` 作为**加载归一化基准**已照用；但 GLB 自然比例与原件差异大，加载后再按**原网格足迹**贴合（指南原则：targetLen「对齐原网格大小」）：
- 塔心 GLB 自然高宽比约 1.8:1（粗短），若只取 targetLen 8 会得到 8m 矮墩，无法贯穿 10 层（原柱高 60，代码注释明确「从第 1 层一眼看到要爬的塔」）。故加载后把高度贴到 60、直径压到 3.4，保持「细长高塔」轮廓与平台螺旋半径 5 的间隙不变。代价是岩纹纵向拉伸，已用强自发光弱化（观感为电光能量柱，截图确认成立）。
- 平台 GLB 按各平台 `half`（landing 2.4 / step 1.8）分别缩放到 `half*2`，与碰撞 footprint 完全一致。

## 3) 保留了哪些玩法引用（关键）

- `userData.edge`：原发光边条 Mesh 原样保留 → `syncPlatforms` 的碎裂闪烁 `m.userData.edge.material.opacity = 0.4+0.6*|sin(t*18)|`（L210-215 逻辑）引用不变。
- `userData.top`：顶面材质引用保留；GLB 到位后指向 GLB 材质（每平台独立实例）。顶面贴图 `assets/tex/platform.webp` 管线改为**可重入** `applyPlatformTops()`：贴图加载完成应用一次、GLB 换板后对新材料再应用一次，每个材质只挂一次（`top.userData.__platTex` 标记防重复 clone），两种异步先后顺序都正确。`repeat=half*2`、`color` 置白逻辑不变。
- `userData.half` / `userData.type` / `userData.blink`：原样保留（贴图 repeat、碎裂判定、缩放 blink 依赖）。
- **碰撞**：sim 侧用 config 的 `half`，与视觉网格无关，未受影响；平台移动/碎裂/检查点光环/坠落判定全部保留。
- 检查点光环 `ringGroup`（10 个 Torus）、`beaconGlow`、`lightBeam`、天空/星空/粒子：均未动。
- 新增 `userData.slab` / `userData.under` 仅为 GLB 换板时定位 fallback 与光晕，不影响玩法。

### 信标呼吸光晕
新增独立计时 `beaconT`（菜单/游玩都推进）驱动 `beaconGlow`/`lightBeam` opacity 呼吸。**刻意不复用 `t`**：原 `t` 仅在菜单 orbit 推进，霓虹圈/碎裂时序依赖它，复用会改动既有玩法视觉时序。呼吸纯装饰，不影响判定。

## 4) 测试通过数（真实输出）

- `node --check src/render/index.js`：**SYNTAX_OK**
- `node --test tests/sim.test.mjs`：**22/22 pass**（sim 未受影响）
- Playwright 硬件 GL（angle/metal）深度探针：
  - **FPS ~60**，**0 console error / 0 pageerror / 0 失败请求**
  - 21 个 GLB 网格全部到位（1 塔心 + 19 平台 + 1 信标）；程序化 fallback 残留 **0**（60m 柱、1.5 球均已移除）
  - 19/19 平台：slab 已移除、GLB 已加入、顶面挂贴图（repeat 4.8/3.6）、edge Mesh 完好（type 配色正确）、under 下移 -0.58
  - 塔心 GLB 尺寸 `[3.4,60,3.4]` y0→60 紫色自发光；平台顶面精确落在碰撞高度 0/6/12…54（moveV 平台 y 实时变化）；信标 GLB y59.8→63.3 品红自发光
  - 保留物：beaconGlow×1、lightBeam×1、检查点光环×10

## 5) 截图路径

- `/tmp/refine-tower-climb.png`（验收主截图：第 1 层仰视，紫色结晶尖塔贯穿画面 + 霓虹平台螺旋 + HUD 完好）
- `tests/after-refine.png`（同上，存档对照 `tests/before-refine.png`）
- `/tmp/refine-tower-menu.png`（菜单 orbit：标题/CLIMB/How to play 完好，背景紫塔发光）
- 单体预览：`/tmp/model-tower-core.png`、`/tmp/model-neon-platform.png`、`/tmp/model-summit-beacon.png`

## 6) 未做项 / 已知问题

- **塔心纵向拉伸**：GLB 粗短比例贴到 60m 细长柱导致岩纹纵向拉长约 10×，靠强自发光呈现「能量柱」观感（截图确认成立）。若复审偏好无拉伸，可改为分段堆叠或保留程序化光束+GLB 基座混合，但会偏离「整换 GLB 主体」要求。
- **平台顶面贴图被发光边条覆盖**：原 `edge` 是实心发光薄板（非空心边框），本就盖住 slab 顶面贴图（既有行为，非本次引入）。本次保留 edge 叠加，故顶面仍呈霓虹色，GLB 岩板细节体现在侧/底面（攀爬仰视主视角）。`userData.top` 贴图引用与管线完整保留。
- **面数预算**：平台 74k×19≈1.4M tris + 塔心 188k + 信标 76k ≈ 1.7M tris；硬件 GL 实测 60fps 无压力。几何在 19 平台间共享（clone 共享 geometry），仅材质独立。
- 信标呼吸为新增纯装饰效果；如需绝对静态可删除 `beaconT` 相关 4 行，不影响其余。