# SKY RIDER 3D · 美术/音频接线交付

## 1. 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 天空：`assets/sky.jpg` 走 `scene.background`（EquirectangularReflectionMapping），加载失败/未就绪回退程序化 2×256 垂直渐变天空（`makeSkyTexture()`），不白屏不报错。② 浮岛：`assets/tex/rock.webp` → 浮岛 `MeshStandardMaterial.map`（RepeatWrapping，repeat 2×2），加载成功前保留棕灰底色占位。③ 云带：`assets/tex/cloud.webp` → 环外侧 14 片远景透明云面（RepeatWrapping，repeat 2×1.5，`depthWrite:false`，面向环心，半径 430–560、环半径 300 之外，不遮挡赛道）。 |
| `src/core/audio.js` | BGM/SFX 分轨：新增 `sfx` gain（0.9）连到 master，`_envelope`/`_noise`/引擎声全部改走 SFX 轨；BGM 保持独立 `BGM_GAIN=0.42`。master 已接 DynamicsCompressor，峰值 ≤0.9。 |

未改动：`src/game/sim.js`、`src/game/track.js`（判定几何/碰撞/命中一律不动）、`src/core/sdk.js`、`src/ui/ui.js`、`config/*`。

未引用：`assets/poster-raw.jpg`、`assets/icon-raw.png`（海报/图标原画，Lead 后续做物料，游戏代码零引用）。

## 2. 测试通过数

- `node --test`：**20/20 通过**（sim 判定逻辑全部保持）
- `asset-check.mjs`：**3/3 PASS**（代码内 4/4 素材引用可解析）
- `i18n-check.mjs`：**PASS**（en/zh 各 62 key，0 缺失）
- `tutorial-check.mjs`：**PASS**（4 步教学，可跳过/回放）
- `sdk-check.mjs`：**PASS**（10 项全绿）
- `verify-game.mjs`：**PASS**（桌面 + 移动端全步骤；fps **60**；0 console error / 0 pageerror / 0 失败请求 / 0 外链）
- `selfplay.mjs`：**通过**（greedy×3 全部 3 圈完赛；random/noinput 基线正常）
- `fun-report.mjs`：**通过**（各指标 ≥ 阈值）
- `shot.mjs`（desktop 1280×720 / mobile 844×390）：**0 console error / 0 pageerror / 0 404 / 0 外链**

## 3. 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（844×390 移动端）
- `tests/artifacts/01-title.png` … `06-results.png`（verify-game 流程截图，含飞行/boost/暂停/结算）

## 4. 未做项 / 已知 bug

- 海报/图标原画未接（按任务要求留给 Lead 做物料，不入运行期渲染）。
- 浮岛 `IcosahedronGeometry(1,0)` 无细分，`rock.webp` 为正面视角贴图，包在低模球上会有拉伸感——属可接受的低多边形风格，未做 UV 专项处理。
- 云带为静态远景面，不随相机 billboard；视角极偏时边缘较薄（DoubleSide 已缓解）。
- 截图无法在本机人工目检（Read 工具不渲染 PNG），以 verify-game 的 0 error + fps60 + 逐步骤截图作为质量证据。

## 5. 最不满意一处

`rock.webp`（正面视角「草顶浮岛」贴图）直接包在无细分二十面体上，UV 拉伸明显、草顶方向不可控——纹理语义和几何不匹配，效果只比纯色略好。若重做，应为浮岛单独建「上草下岩」两段 UV 的凸包几何，而不是给现成 icosahedron 强贴。
