# MEGA GOLF 3D · 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 天空：`assets/sky.jpg` 加载成功以 `EquirectangularReflectionMapping` 设为 `scene.background`，失败保留程序化渐变兜底；② 果岭/沙坑贴图：`assets/tex/green.webp`、`assets/tex/sand.webp` 经 `TextureLoader` 接进对应材质 `map`（`RepeatWrapping` + 按几何尺寸设 `repeat`），加载成功 `color` 置白、失败保持原兜底色不白屏；③ 各向异性过滤 ≤4。 |
| `src/core/audio.js` | BGM 暂停记录播放偏移 `offset`，恢复从当前位置继续（此前 pause→resume 会从头重放）。 |

未改动：`src/game/sim.js`（判定几何/碰撞/命中全为代码，零触碰）、`config/*`、`poster-raw.jpg`/`icon-raw.png`（Lead 后续做物料，未引用进游戏代码）。

## 2) 测试通过数

- `node --test`：**19 pass / 0 fail**
- `asset-check`：PASS 3/3（5 项素材，4/4 引用可解析）
- `i18n-check`：OK（en/zh 各 43 keys，0 missing/empty）
- `tutorial-check`：PASS
- `sdk-check`：pass=true，0 console/page error，0 失败请求，SDK 降级正常
- `verify-game`：pass=true，fps=60（avgFrameMs 16.67），0 console error / 0 pageerror / 0 失败请求 / 0 外链
- `selfplay`：greedy 三局均 24 洞通关（total 66），random/noinput 基线正常，无异常
- `fun-report`：全指标 pass（每分钟操作 55/min、空转 8%、事件种类 12、推进到第 3 关 100%）

## 3) 截图路径

- `tests/final/desktop.png`（1280×720，title 态，0 error）
- `tests/final/mobile.png`（1688×780，移动视口，0 error）
- `tests/artifacts/02-playing.png`（对局态，验证贴图已上屏）

## 4) 未做项 / 已知 bug

- `poster-raw.jpg`、`icon-raw.png` 按约定未进运行期渲染（物料由 Lead 处理）。
- `sky.jpg` 为 2048×1028（≈2:1 而非精确 2:1 等距柱状），环绕处有极轻微接缝，视觉不可感知。
- 贴图仅替换美术件（`material.map`），判定/碰撞/命中几何全部在 `src/game/sim.js`，未动。

## 5) 最不满意一处

`sky.jpg` 顶部实际均色约 `#5499D3`，比色板 `#7dd3fc` 偏暗偏灰，接上后天空观感比原程序化渐变略闷（非 bug，是素材本身明度）。若后续要更亮，可在 Lead 侧把天空素材提亮一档，或改回程序化渐变 + sky.jpg 只做天穹点缀。
