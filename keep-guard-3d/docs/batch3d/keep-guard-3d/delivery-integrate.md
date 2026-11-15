# KEEP GUARD 3D · 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | 新增 `gradientSky()` 程序化渐变天空兜底；启动时先设渐变背景，再异步 `loadTexture('assets/sky.jpg')` → `EquirectangularReflectionMapping` 挂到 `scene.background`，失败静默保留渐变。 |
| `src/core/audio.js` | BGM 文件循环接 offset 续播（`_fileStart` 用 `start(0, offset)`，`_pauseBGM` 记录 `offset`）；`setMuted` 静音时 `_pauseBGM`、取消静音 `_resumeBGM`（恢复从当前位置）；新增 `this.sfx` 分轨 gain（SFX 全部经 sfx 总线 → master → DynamicsCompressor，峰值 ≤0.9）；解码完成后仅在未静音时起播。 |

未改：`src/game/*`、`config/game.config.js`（判定几何/玩法层一字未动）、`src/vendor/pipysdk.js`。

开发 agent 已接好的部分经核对保留：`assets/tex/{grass,stone,path}.webp` 已挂到地面/岩石/路径材质（RepeatWrapping + repeat），`bgm.mp3` 解码循环、`unlock()/setMuted()/muted()/play()` 接口与调用点不变。海报/图标原画（`poster-raw.jpg`、`icon-raw.png`）未引用进运行期代码，留给 Lead 做物料。

## 2) 测试通过数

| 检查 | 结果 |
| --- | --- |
| `node --test` | 20 pass / 0 fail |
| asset-check | PASS 3/3（5/5 处引用可解析，6 项素材） |
| i18n-check | OK（en/zh 各 54 key，0 缺失） |
| tutorial-check | PASS（4 步，可跳过/可重放） |
| sdk-check | pass:true，0 console/page error，0 失败请求 |
| verify-game | pass:true，fps 60.1，0 console/page error，0 failed requests |
| selfplay | greedy 通关（wave=10 win=true kills=177），random/noinput 基线正常 |
| fun-report | 全部 ✅ pass |
| shot desktop/mobile | 0 console error / 0 pageerror / 0 404 / 0 外链 |

## 3) 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（844×390 @ DPR2）
- `tests/artifacts/01-title.png` `01b-title-zh.png` `02-combat.png` `03-pause.png` `04-results.png`

## 4) 未做项 / 已知 bug

- 程序化渐变天空兜底 + `sky.jpg` 均已生效（运行期探针确认 `scene.background` 为 EquirectangularReflectionMapping 的 bitmap 贴图，非 canvas 渐变）。
- 无已知崩溃/白屏/undefined；素材缺失时贴图回退纯色、天空回退渐变、BGM 回退程序化合成。
- Synth BGM 兜底不做 offset 续播（仅文件 BGM 支持精确续播；兜底场景够用）。
- 外部请求仅 SDK 自身 config（`pipygames.com`，按降级处理），游戏资产零外链。

## 5) 最不满意一处

默认相机俯角 0.95 rad（约 54°）朝下，导致 `sky.jpg` 里最有价值的暖色地平线与山/要塞剪影基本落在画面外，游戏内只露出一条纯灰蓝天空带。接线本身正确，但 AI 天空美术在玩法视角下几乎读不出来。要真正利用上需抬高地平线/调相机俯角或给地图外沿加远景剪影 mesh——但这会动玩法层相机，本单未越界，建议作为后续视觉优化项。
