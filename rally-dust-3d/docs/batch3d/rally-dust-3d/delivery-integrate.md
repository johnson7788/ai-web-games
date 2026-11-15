# RALLY DUST 3D — 美术/音频接线交付

## 1) 改了哪些文件

- `src/render/index.js`
  - 天空：`assets/sky.jpg` 以 `EquirectangularReflectionMapping` 接到 `scene.background`；加载失败回退程序化渐变天空（canvas 等距柱状，不白屏不报错）。
  - 路面：`buildRoad` 从「单 mesh + vertexColors」改为「按路面类型分段建 mesh」，`gravel.webp`→碎石、`mud.webp`→泥地、无纹理段（asphalt）回退纯色。UV 沿弧长每 9m 重复（RepeatWrapping）。碰撞/判定几何在 `sim.js`（s,t 空间），本改动纯渲染件，未动判定。
  - 树：保留 `tree.webp` billboard + 程序化锥形兜底（原有逻辑）。
- `src/core/audio.js`
  - master 链改 `master → DynamicsCompressor → analyser → destination`，master gain 0.9，峰值 ≤0.9。
  - 新增 SFX 分轨 `sfx` gain bus；引擎/胎噪/音效走 sfx，BGM 走独立 `bgm.gain`。
  - 静音（setMuted）掐断 BGM 并记录播放偏移，恢复时从当前位置续播（`offset`/`startedAt` 跟踪，`_fileStart`/`_fileStop`）；暂停（stopAll）同样保留位置。
  - 首次交互（start）解锁后 BGM 才起播；解码完成时若静音则不起播，待取消静音续播。
  - SFX 程序化合成兜底与接口名（unlock/setMuted/muted/play/event）不变。

未引用 `assets/poster-raw.jpg`、`assets/icon-raw.png`（Lead 后续做物料），`assets/_src/` 原图不进代码。

## 2) 测试通过数

- `node --test`：22/22 pass
- asset-check：PASS（3/3，6 项素材，代码引用 5/5 可解析）
- i18n-check：OK（en/zh 各 57 key，0 缺失）
- tutorial-check：PASS
- sdk-check：PASS（10 项检查）
- verify-game：PASS（帧率 60fps、0 console/page error、0 失败请求、0 外部请求）
- selfplay：greedy 全通 5 关（firstSuccess 29s），random/noinput 基线正常
- fun-report：PASS（10 pass / 0 warn / 0 fail）

## 3) 截图路径

- `tests/final/desktop.png`（标题，0 error）
- `tests/final/mobile.png`（移动，0 error）
- `tests/artifacts/02-driving.png`、`03-drift.png`（玩法层贴图对齐，抽样确认路面纹理已渲染：176 唯一色 / 亮度 std 37.5，非纯色）

## 4) 未做项 / 已知 bug

- 未接入 PMREM 环境反射（车/路为 Lambert/高粗糙 Standard，收益≈0，跳过）。
- 标题屏不建世界 mesh（`builtStage` 起始 -1 与 `renderTitle` 的 stage -1 撞哨兵），只显示天空+车；属既有行为，非本次改动引入，未动玩法层。
- 若用户极端快（<200ms）点开始，首段路可能短暂显示纯色占位，下赛段重建即贴图；正常点击（纹理已加载完）无此现象。

## 5) 最不满意一处

标题屏 `builtStage === -1` 与预览 stage -1 同值导致标题不渲染赛道/地面，只剩「车浮在天空上」的英雄镜头。懒人做法是保留现状（不碰玩法层），正确做法是把标题预览改为独立布尔标志重建世界；本次为最小 diff 未改。
