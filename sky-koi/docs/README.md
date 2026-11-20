# SKY KOI · 设计源与数据契约

## 一句话
锦鲤在云海单键上扑，穿过鸟居门柱得分，贴水面攒免费水花跳，吃满三颗珍珠升一星。

## 八问
1. **一句话**：玩家在云海场景单键上扑锦鲤，穿过鸟居门缝得分，吃珍珠升星、贴水攒免费跳。
2. **参考**：flappy 品类（只借玩法，不抄素材）。
3. **差异化**：①珍珠升星（收集）②水花连跳（水面机制）③彩色国风云海国风（区别于 ink-finch 的水墨极简）。
4. **操作**：点击/空格/触屏单键上扑，3 秒可懂。
5. **一局**：每关目标门数（3–6 扇），撞柱/落水判负；爽点在第 1 扇门穿过（约 8–9 秒）。
6. **成长**：局内=珍珠升星/水花跳；跨局=关卡解锁 + 每关星级 + 历史最佳门数。
7. **结局**：通关看三星卡 + 下一关；失败看落水/撞柱原因 + 重试。
8. **乐趣**：mastery 为主（掌控飞行节奏）+ curiosity 为辅；第 3 分钟靠「珍珠逼窄缝 / 贴水攒跳」的取舍继续；第一个有代价决定在 ~5 秒（第一扇门高空安全 vs 贴水攒跳）。

## 世界与单位
- 逻辑世界 1280×720（16:9），letterbox；60Hz 固定步长（`STEP=1/60`）。
- 锦鲤固定 `x=300`（`GAME.KOI_X`），半径 `KOI_R=24`；重力 `GRAVITY=1400`，上扑 `FLAP_VY=-380`。
- 水面基线 `WATER_BASE=600`，`WAVE_FREQ=0.9` 巨浪；顶部钳制 `CEILING=30`。
- 贴水带 `SKIM_BAND=36`，免费小跳 `SKIM_JUMP_VY=-240`。

## 实体字段（sim.state）
- `koi {x, y, vy, r}`、`gates [{x, baseCenter, gapH, double, moveAmp, movePhase, moveFreq, passed, pearls:[{gap, rel, taken, r}]}]`。
- `score/targetGates/pearls/pearlTarget/skimJumps/skimTarget/waterY/shimmer/stars/result`。

## 事件名（谁发、谁消费）
`flap/gateApproach/gatePass/pearl/star/waterSplash/nearWater/windGust/scaleDash/glideTick/levelStart/win/lose` —— sim 发，main 消费转音频+粒子+教程推进。

## 模块 API
- `createRun(levelIndex, {seed})` → run；`run.step(dt)/flap()/start()/gateAhead()/getHud()/drainEvents()`。
- `createRenderer(canvas)` → `{draw(state,dt,view), debugLayout(), resize()}`。
- `createAudio()` → `{event,setMuted,startBgm,stopBgm,unlock}`。
- `window.__ll`：state.phase / start / pause / resume / restart / debug.state() / debug.loadLevel(i) / debug.startSeeded(i,seed) / debug.fastForward() / debug.autoPlaceSolution()（非适用占位）。

## 状态机
title → playing → (paused | result) → title / playing；sim 内 `playing → won|lost`。

## 输入契约
指针按下 / Space = flap（边沿即触发）；Esc/P = 暂停切换；R = 重开；M = 静音。

## 关卡表（12 关 · 3 场景包）
见 `config/levels.js`；每关一个 `newElement`（design.json 已通过 fun-audit）。
