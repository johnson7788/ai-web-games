# BACKROOM 9 · 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | 壁纸贴图按几何尺寸设 repeat：原先 `sky.jpg → wallMat` 固定 `repeat(2,1)`（8u 格墙上被横向压扁一半），改为按墙长 `repeat(len/CELL, 1)`（格墙 1×、边界墙 9×），贴图 2:1 在 8×4 墙面上不畸变。贴图异步到达后 bump `texVersion` 触发 `buildMaze` 重建，按 repeatX 缓存材质复用（只有 1/9 两种墙长，不泄漏）。地板/天花板仍为单材质固定 repeat(9,9)。 |
| `src/core/audio.js` | 补 BGM/SFX 分轨：新增 `sfx` gain 节点（`sfx → master`），`_env/_noise/_thump` 改经 sfx 轨；BGM 仍走 `bgm.gain`。其余（bgm.mp3 解码循环、静音按当前位置续播、master→DynamicsCompressor 峰值 ≤0.9、程序化 drone 兜底）开发 agent 已接好，未重复造轮子。 |

未动：`src/game/sim.js`（判定/碰撞/命中几何）、`src/main.js`、`src/ui/`、config、SDK、其他游戏目录。

素材引用（`grep -rn assets/ src/`）共 4 处：`bgm.mp3`、`tex/carpet.webp`、`tex/ceiling.webp`、`sky.jpg`。`poster-raw.jpg`/`icon-raw.png` 未进任何运行期代码（只存在于 manifest/plan），留给 Lead 做物料。

## 2) 测试通过数

| 命令 | 结果 |
| --- | --- |
| `node --test` | 21/21 pass |
| `asset-check.mjs` | PASS 3/3（5 项素材，4/4 引用可解析） |
| `i18n-check.mjs` | OK（en 48/48、zh 48/48，0 missing/empty） |
| `tutorial-check.mjs` | PASS（4 步，可跳过/可重放/已持久化） |
| `sdk-check.mjs` | pass（0 console/page error，0 失败请求，SDK 域名拦截后降级加载） |
| `verify-game.mjs` | pass（fps 60，0 console/page error，0 失败请求，0 404） |
| `tools/selfplay.mjs` | greedy ×3 全部通关（9 出口 / 5 段），random/noinput 基线正常 |
| `fun-report.mjs` | 全部 ✅ pass（每分钟操作 576、事件种类 7、推进到第 3 关 100%、死亡 ≥1 的 run 25%） |
| `shot.mjs --out desktop.png` | 0 console/page error，0 失败请求 |
| `shot.mjs --out mobile.png --w 844 --h 390 --mobile` | 0 console/page error，0 失败请求 |

## 3) 截图路径

- `tests/final/desktop.png`（1280×720 标题屏）
- `tests/final/mobile.png`（844×390 标题屏）
- `tests/final/01-title.png`、`01b-title-zh.png`、`02-playing.png`、`03-pause.png`、`04-results.png`（verify-game 流程截图）

## 4) 未做项 / 已知 bug

- **scene.background 未接**：本作是封闭后室（地板 + 天花板 + 四周边界墙全实心，fog 16→80），天空/背景永远不可见；且 `assets/sky.jpg` 实际是「后室壁纸」贴图（plan.json 的 prompt 即 wallpaper），不是 equirect 天空。故把它接在墙上，未加 `EquirectangularReflectionMapping` 背景、也未加程序化渐变天空（都不可见，属 YAGNI）。
- **外部请求 2 条**（`pipygames.com/sdk/config.json`、`/api/sdk/config?appId=…`）：这是平台 SDK 自身的配置拉取，被 sdk-check 明确容忍（拦截后降级、页面仍正常），非游戏素材外链；游戏自身脚本/贴图/字体全部本地（`lib/three.module.js` vendored，零 CDN）。
- 边界墙（72u）壁纸 9× 平铺，格墙（8u）1× 平铺，两种墙长已按几何对齐；无遮挡、无判定改动。

## 5) 最不满意一处

`assets/sky.jpg` 命名与内容错位：plan.json 把「后室壁纸」素材起名 `sky`，生成出的是 2048×1028（2:1）壁纸而非天空。我按内容把它当壁纸贴墙（这是视觉上唯一正确用法），但 Lead 模板里「天空 → scene.background」这一项因此无法字面满足。若后续想要真天空/背景，需要重生成一张真 equirect 天空图；否则保持现状即可。
