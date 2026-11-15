# SPACE WAVE 3D · 美术/音频接线交付

## 1. 改了哪些文件

只动 `games/space-wave-3d`，共 **1 个文件**：

- `src/render/index.js`
  - 天空：`assets/sky.jpg` 已按 `EquirectangularReflectionMapping` 接为 `scene.background`（开发 agent 已接，保留）；把加载失败回退从**纯色**改成**程序化渐变天空**（新增 `gradientSky()`，CanvasTexture 垂直渐变 `#050510 → #0a1a2e → #16102e`），满足"素材未到位/加载失败画占位不白屏"。
  - 贴图：`assets/tex/hull.webp` → 飞船船体材质 `shipMat.map`（`SRGBColorSpace` + `RepeatWrapping`，加载成功把材质色置白避免染色）；加载失败走 `onError` 空回退，保留原扁平色 `0xe0faff` 兜底。**只替换美术件，碰撞/命中/判定几何（sim.js 的门/球判定）零改动。**

其余无需改动（开发 agent 已接好，本次核对对齐）：

- `src/core/audio.js`：BGM `assets/audio/bgm.mp3` 已解码循环播放，首次交互（`btn-start` 调 `audio.unlock()`）起播；`master` → `DynamicsCompressor`，`MASTER_GAIN=0.9`（峰值 ≤0.9）；BGM 走独立 gain（0.40）与 SFX 分轨；缺文件回退程序化 synthwave 琶音。接口名 `unlock/setMuted/muted/play/event` 与调用点未变。静音用 master gain=0 掐断，恢复即从当前位置续播。
- `poster-raw.jpg` / `icon-raw.png` 未进运行期渲染，未被任何游戏代码引用（Lead 后续做物料）。

## 2. 测试通过数

| 检查 | 结果 |
| --- | --- |
| `node --test`（sim 判定层） | **21/21 通过** |
| asset-check | 3/3 通过（sky.jpg / bgm.mp3 / hull.webp 引用可解析，0 404） |
| i18n-check | en 34 / zh 34，0 missing 0 empty，OK |
| tutorial-check | PASS（3 步，可跳过可重放） |
| sdk-check | pass（10/10，0 console/page error，SDK 降级正常） |
| verify-game | pass，**fps 60**（≥50），0 console error / 0 pageerror / 0 失败请求 |
| selfplay | 8 局遥测（greedy×3 推进到 level 4-5、×8 倍率、首输入 0s、延迟 1ms） |
| fun-report | **PASS 10/10**（0 warn 0 fail） |

外链仅 SDK 自身配置请求（`pipygames.com/sdk/config*`），属平台接入预期降级，无游戏侧外链。

## 3. 截图路径

- `tests/final/desktop.png`（1280×720 标题屏）
- `tests/final/mobile.png`（844×390 移动端标题屏）
- 玩法过程帧：`tests/artifacts/01-title.png` … `05-results.png`（verify-game 产出）

天空区域采样确认 nebula 已加载（亮度 min≈12 / max≈244 / avg≈49，非纯色）；飞船区域为青色光晕覆盖，判定门/隧道环正常渲染，无遮挡。

## 4. 未做项 / 已知 bug

- 无已知 bug。BGM 静音采用 master gain=0（不 stop 源），恢复从当前播放位置继续，符合"恢复从当前位置"。
- 海报/图标原画按约定未接（Lead 后续做上架物料）。

## 5. 最不满意一处

船体 `hull.webp` 是"正面视角整船图"，直接 map 到低多边形锥头+圆柱船身上会有拉伸/接缝，视觉上不如平面色干净；但受限于该素材本就是 key-art 而非可平铺 hull 面板贴图，且被飞船青色光晕 sprite 覆盖，实际可读性尚可。若要更好，需 Lead 重出一张可平铺的金属板/装甲板贴图。
