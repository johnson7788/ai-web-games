# RAGDOLL ARCHERS 3D · 美术/音频接线交付

## 1. 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 天空：`assets/sky.jpg` 改为 `EquirectangularReflectionMapping` + `SRGBColorSpace` 映射到 `scene.background`，加载失败/未到位回退程序化渐变天空（CanvasTexture `skyTop→skyBottom`，不白屏）。② 木箱：抽成共享 `crateMat`，`assets/tex/wood.webp` 只加载一次并设 `RepeatWrapping` + `repeat(1,1)`，去掉每箱重复建材质/重复加载贴图。 |
| `src/core/audio.js` | 新增 SFX 分轨总线 `sfx.gain`（独立于 BGM 的 `bgm.gain`），`_env`/`_noise` 改走 SFX 总线再汇入 `master`，实现 BGM/SFX 分轨音量；`master` 保持 `DynamicsCompressor` + gain 0.9（峰值 ≤0.9）。BGM 解码循环、首次交互解锁后起播、静音从当前位置续播等既有逻辑未动。 |

未改动：玩法层与判定几何（`src/game/sim.js`、`config/game.config.js`）、UI、SDK、i18n。海报/图标原画（`poster-raw.jpg`、`icon-raw.png`）未进运行期渲染（Lead 后续做物料）。

## 2. 测试通过数

- `node --test`：**19/19 pass**（0 fail）
- asset-check：**3/3 PASS**（5 项素材，代码内 4/4 引用可解析）
- i18n-check：**OK**（en/zh 各 55 key，0 missing/empty）
- tutorial-check：**PASS**（4 步，可跳过/重看/持久化）
- sdk-check：**pass**（0 console/page error，0 失败请求，SDK 域名拦截后降级可用）
- verify-game：**pass**（0 errors / 0 failed requests，fps 60.1）
- selfplay：**OK**（greedy 稳定清 5 关，firstWin 2.25s，lat 0.4ms）
- fun-report：**全绿**（行动 1830/min、空转 3%、事件种类 15、推进 100%、死亡 100%）
- 截图：desktop / mobile 各 0 console error / 0 pageerror / 0 404

## 3. 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（1688×780）
- verify 分镜：`tests/artifacts/01-title.png` ~ `05-mobile-play.png`
- 引导：`tests/final/tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`

## 4. 未做项 / 已知 bug

- 首帧首次点击的 `ui_click` SFX 会被吞：`play()` 不自动 `ensure()`，`AudioContext` 尚未创建即返回，需 `unlock()` 后才有声。既有行为、接口未动，不计入任务要求。
- 暂停/回菜单再 `resume()` 时 BGM 从头重播（`stopAll` 停源 + `_fileStart` 新起 BufferSource），只有静音键保留位置。任务只要求「静音掐断/恢复从当前位置」（已满足），暂停态位置续播未做。
- `pipygames.com/sdk/config.json` 等 2 条请求为 vendored `pipysdk.js` 运行时自带（平台接入既有行为），非外链素材/资源；sdk-check 已按「SDK 域名拦截降级」判 PASS。

## 5. 最不满意一处

BGM 暂停/回菜单 resume 会从 0 重播而非续播位置——静音键满足任务要求，但暂停态没有位置记忆，体验上不一致。若要补，可在 `_pauseBGM` 记录 `ctx.currentTime - src 起点偏移`，`_fileStart` 用 `offset` 续播，成本约 10 行。
