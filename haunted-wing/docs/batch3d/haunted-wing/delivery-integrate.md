# HAUNTED WING · 美术/音频接线交付

## 1) 改了哪些文件

- `src/render/index.js`
  - 天空：`assets/sky.jpg` → `scene.background`（`EquirectangularReflectionMapping` + `SRGBColorSpace`）；加载失败回退程序化渐变天穹 `makeGradientSky()`（Canvas 垂直渐变 + BackSide 球，`fog:false` / `depthWrite:false`，不遮挡）。
  - 贴图：`assets/tex/tile.webp` → 墙材质 `map`（`RepeatWrapping`，repeat 2×3 = 墙块 2m×3m 每米一砖）；`assets/tex/floor.webp` → 地板材质 `map`（每层 `clone()` 后按 `g.w*cell × g.h*cell` 设 repeat）。均开 `anisotropy`。
  - 仅替换材质 `map`，**几何/碰撞/命中/判定一律未动**（BoxGeometry/PlaneGeometry 尺寸、位置、可见性逻辑原样）。
- `src/core/audio.js`
  - master 链路改为 `master → DynamicsCompressor → analyser → destination`（threshold -12dB / ratio 6，峰值 ≤0.9）。
  - 新增 `sfx` 分轨 Gain；所有程序化 SFX（`_env`/`_noise`）改接 `sfx` 轨，BGM 走原 `bgm.gain` 轨 → BGM/SFX 分轨音量。
  - BGM 行为不变：`unlock()`（首次交互）解码循环播放 `assets/audio/bgm.mp3`，静音经 master gain=0 掐断、恢复从当前位置续播，缺文件回退程序化暗噪。

## 2) 测试通过数

| 命令 | 结果 |
| --- | --- |
| `node --test` | 21/21 pass |
| asset-check | PASS 3/3（4/4 代码素材引用可解析；poster/icon 未引用） |
| i18n-check | OK（en/zh 各 59 key，0 missing/empty） |
| tutorial-check | PASS |
| sdk-check | pass（0 console/page error，0 失败请求） |
| verify-game | pass，fps 60，0 console/page error，0 失败请求，0 外链 |
| selfplay | greedy 3/3 通关，random/noinput 基线正常 |
| fun-report | overall PASS |
| shot desktop / mobile | 0 console error / pageerror / 404 / 外链 |

## 3) 截图路径

- `tests/final/desktop.png`（标题屏 1280×720）
- `tests/final/mobile.png`（标题屏 844×390）
- `tests/artifacts/01-title.png` / `01b-title-zh.png` / `02-playing.png` / `03-pause.png` / `04-results.png`（verify-game 全流程）

## 4) 未做项 / 已知 bug

- `assets/poster-raw.jpg`、`assets/icon-raw.png` 未进运行期渲染（Lead 后续做物料，按要求未引用进游戏代码）。
- `PAL.floor` / `PAL.floor2` 两个调色板常量因地板改用贴图后不再被引用，仅作设计意图留档，无运行影响。
- 墙贴图 repeat 对所有墙块统一（2×3），因所有墙块尺寸相同故等价；未做每墙独立 UV。

## 5) 最不满意一处

程序化渐变天穹是兜底路径，正常流程里 `sky.jpg` 加载成功即被隐藏，几乎看不见；它只为「素材缺失不白屏」而存在，渐变映射到球面的上下方向未精修。真实天空观感完全依赖 `sky.jpg`，天穹兜底只保证不黑屏、不算「好看」。
