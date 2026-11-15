# TOWER CLIMB（霓虹塔攀）· 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 天空天穹材质 `color` 由 `0x0a0a14` 改 `0xffffff`，避免深色 tint 压暗 `assets/sky.jpg` 的极光（回退渐变自身已够暗，仍走程序化渐变兜底）。② 平台顶面接线 `assets/tex/platform.webp`：`BoxGeometry` 拆 6 材质数组（+x,-x,**+y顶**,-y,+z,-z），仅顶面挂 map；贴图 `RepeatWrapping`，`repeat = half*2`（1 tile/米，landing 4.8 / step 3.6 按几何尺寸一致）；加载成功才把顶面 `color` 置白并挂 map，失败/缺失回退纯色 `PALETTE.platformTop`。碰撞/命中/判定几何（sim、platforms 布局、edge/under 装饰）一律未动。 |
| `src/core/audio.js` | ① 新增 SFX 分轨 `sfx` GainNode（`SFX_GAIN=0.9`），`_env/_noise/_buildWind` 全部改经 `this.sfx` → master，实现 BGM/SFX 分轨音量。② BGM 文件 `_fileStart(offset)` 记录 `startedAt/offset`，`_pauseBGM` 按 `ctx.currentTime - startedAt` 累加 offset 再停源，`_resumeBGM()` 从 offset 续播（静音/暂停/回菜单均「恢复从当前位置」而非重头）。③ `setMuted(true)` 掐断 BGM（记录 offset + 停源）并 master 置 0，`setMuted(false)` 只恢复 master（BGM 由 `resume()` 在回到游戏时从 offset 续播，避免暂停界面误播）。④ `_fileStart/_resumeBGM/_playBGMFile` 增加 muted 守卫，静音时 fetch 到的 BGM 不起播。master → DynamicsCompressor → analyser → destination 链路与峰值 ≤0.9 保持不变。 |

海报/图标原画（`assets/poster-raw.jpg`、`assets/icon-raw.png`）按任务要求**未引用进游戏代码**，留给 Lead 做上架物料。

## 2) 测试通过数（真实输出）

- `node --test`：**22/22 pass**（`tests/sim.test.mjs`，sim 逻辑未受影响）
- `asset-check`：**PASS 3/3**（4 项素材，3/3 引用可解析）
- `i18n-check`：**OK**（en 40 / zh 40，0 missing 0 empty）
- `tutorial-check`：**PASS**（4 步，可见/可跳过/持久化/可重放）
- `sdk-check`：**pass**（含「0 console/page error」「0 失败请求」）
- `verify-game`：**pass**，fps **60**（frames 120，avg 16.66ms），0 console/page error，0 失败请求
- `selfplay`：greedy×3 全部通关（首胜 2.13s，floor 10），random/noinput 基线正常
- `fun-report`：**PASS（10 pass / 0 warn / 0 fail）**
- `shot`（desktop 1280×720 / mobile 844×390）：0 console error / 0 pageerror / 0 404

贴图接线程序化复核（playwright 探针，无报错）：19/19 平台顶面挂上 `platform.webp`（1024×1024、RepeatWrapping、repeat 3.6/4.8），天空挂上 `sky.jpg`（2048×1028、color=ffffff）。

## 3) 截图路径

- `tests/final/desktop.png`
- `tests/final/mobile.png`
- `tests/artifacts/02-playing.png`、`03-climb.png`（verify 流程内生成的游玩中截图）

## 4) 未做项 / 已知 bug

- 天空沿用开发 agent 已接好的**天穹 mesh**方案（任务允许「scene.background 或天穹 mesh」），未改造成 `EquirectangularReflectionMapping` scene.background —— 不重复造轮子。
- 贴图 `repeat=half*2`（1 tile/米）为按几何尺寸的默认值；若人工复审觉得电路纹过密，只需调 `src/render/index.js` 里的 `repeat.set` 系数，不动几何。
- SFX 音效仍为程序化合成（任务要求保留兜底，接口名 `event(name)/ui()` 与调用点未变）；BGM 为 `assets/audio/bgm.mp3` 解码循环，缺失回退 synthwave 琶音。
- 静音「掐断」只在 AudioContext 已创建后生效；首次交互（点 Start）前无 ctx，此时静音仅记录 `muted` 标记，Start 后按标记起播/静音。

## 5) 最不满意一处

本会话无法直接人眼查看截图（图片读取返回 Unsupported Image），平台贴图与天空的最终观感只能靠程序化探针确认「贴图已加载、已挂到 19 个平台顶面、repeat/wrap/colorSpace 正确、0 报错 + fps 60」来兜底；建议 Lead 在真机上快速扫一眼 `tests/final/desktop.png` 确认贴图密度与天穹接缝。
