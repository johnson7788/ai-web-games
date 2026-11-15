# PIXEL MINE 3D · 美术/音频接线交付

## 1. 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 天空：`scene.background` 用 `EquirectangularReflectionMapping` 接 `assets/sky.jpg`，加载失败回退程序化渐变天空（CanvasTexture，同映射），去掉旧天穹 mesh；② 贴图：dirt→`assets/tex/dirt.webp`、stone/bedrock→`assets/tex/rock.webp`、gold→`assets/tex/ore.webp`，`RepeatWrapping` + 按体素面 UV 内缩（PAD=0.005）避开贴图四边 ~4px 透明边框；③ 合并几何按材质分桶（dirt/rock 各自 MeshLambertMaterial + uv），发光方块（coal/iron/diamond/lava/treasure）保留原 InstancedMesh，gold 发光材质换成 ore 贴图；材质全局共享，chunk 重建只 dispose 几何。**碰撞/命中/判定几何未动**（sim.js 零改动）。 |
| `src/core/audio.js` | ① master 后接 `DynamicsCompressor`（threshold -12/knee 20/ratio 12），master gain 0.9 保证峰值 ≤0.9；② 新增 SFX 分轨 gain（0.9），`_envelope`/`_noise` 改接到 sfx 轨，BGM 仍走独立 bgm gain（0.4）；BGM mp3 解码循环 + 首交互解锁起播 + 静音（master 置 0/0.9）恢复不重播、接口名与调用点全部不变。 |

未动：`src/game/sim.js`、`config/*`、`src/ui/*`、`src/main.js`、`index.html`、`styles.css`。海报/图标原画（`assets/poster-raw.jpg`、`assets/icon-raw.png`）未引用进游戏代码。

## 2. 测试通过数

| 检查 | 结果 |
| --- | --- |
| `node --test` | 23 pass / 0 fail |
| `asset-check` | PASS 3/3（5/5 素材引用可解析，0 外链/0 _src 引用） |
| `i18n-check` | OK（en/zh 各 85 key，0 missing） |
| `tutorial-check` | PASS（4 步，可跳过/重播） |
| `sdk-check` | pass（0 console/page error，SDK 降级正常） |
| `verify-game` | pass（fps 60，0 console/page error，0 failed requests，0 external） |
| `selfplay` | 8 runs：greedy×3 通关 depth=62/coins≈278，random/noinput 基线正常 |
| `fun-report` | 全部 ✅ pass |
| `shot` desktop | 0 console/page error，0 failed/external |
| `shot` mobile | 0 console/page error，0 failed/external |

## 3. 截图路径

- `tests/final/desktop.png`、`tests/final/mobile.png`（shot 产出）
- `tests/artifacts/01-title.png`、`01b-title-zh.png`、`02-playing.png`、`03-mining.png`、`04-pause.png`、`05-results.png`、`mobile-title.png`、`mobile-game.png`（verify-game 产出）

## 4. 未做项 / 已知 bug

- **梯子不可见**（预存在）：`isOpaque` 把 LADDER 当非不透明，`buildChunk` 直接 `continue`，梯子方块在 3D 里不渲染（能放、能爬，纯逻辑/判定都在，只缺视觉）。不在本次素材清单内（无 ladder 贴图），未改判定几何凑视觉。
- **bedrock 复用 rock 贴图**：基岩与石头同材质，仅深 48+ 与宝藏房边缘可见，靠硬度（4.0 vs 1.0）区分。若要保留原深灰信号可加第三桶，未做。
- 贴图四边各有 ~4px 透明边框（AI 生成产物，manifest 报 alpha:true），用 UV 内缩避开；相邻面纹理有 ~1% 不连续，体素尺度下不可见。

## 5. 最不满意一处

gold 发光方块从纯色 InstancedMesh 换成了 ore 贴图的 MeshBasicMaterial（整立方渲染），金矿横脉相邻块共享面 coplanar z-fight——同材质同贴图所以视觉不可见，但这层「整立方发光」的代价是我为了加贴图把金块材质从「和 coal/iron/diamond 统一」里拆了出来，读代码时会觉得 gold 是特例。若重做，倾向把 gold 也改回「只画暴露面 + emissive 贴图」，和 dirt/stone 同一套暴露面逻辑。
