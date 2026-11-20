# BEAT BALL · 设计契约（docs/README.md）

## 世界 / 坐标 / 单位

- 逻辑世界 1280×720，letterbox 适配（`config/game.config.js` WORLD）。
- 60Hz 固定步长（`STEP = 1/60`），累加器 + 渲染插值。
- 纵深远近：far=拍点出生、near=拍点到达玩家线；渲染用 `eventScreen()` 的 pow2 曲线（`Math.pow(2, approach*4-4)`）。
- 轨道（lane）0..lanes-1，近场 x 间距 `LANE_GAP=150`，向地平线收敛。

## 实体字段

- 玩家：`playerLane`（0..lanes-1）、`playerJumping`、`jumpT`（滞空剩余秒）。
- 障碍 obstacle：`{ kind:'hazard'|'pad', lane, t(到达秒), travel(飞行秒), jump?(跳板), resolved, hit, warned }`。
- 关卡：`{ index, scene, bpm, beats, lanes, warnBeats, hazardProb, padProb, targetCombo, feature, newElement }`（见 `config/levels.js`）。

## 事件表（sim → 各消费者）

`beat` / `warning` / `hazard` / `padHit` / `padMiss` / `perfect` / `nearMiss` / `crash` / `win` / `lose` / `laneChange` / `jump` / `jumpLand` / `distanceTick`。渲染消费 `padHit/perfect/hazard/crash` 做涟漪与震屏；音频经 `audio.event(type,payload)` 映射到 SFX。

## 模块 API

- `createRun(levelIndex, {seed})` → run（纯逻辑，零 DOM）。
- `run.step(dt)` / `run.move(dir)` / `run.jump()` / `run.getHud()` / `run.drainEvents()`。
- `createRenderer(canvas)` → `{ draw(state, dt, view), debugLayout(), resize() }`。
- `createAudio()` → `{ event, setMuted, startBgm, stopBgm, unlock }`。

## 状态机

`title → playing ⇄ paused → result`，`restart` 回到本关 playing，`home` 回 title。sim 内部 `playing → won | lost`。

## 输入契约

- 键盘：←/→（或 A/D）变道、Space 跳跃、Esc/P 暂停、R 重开、M 静音。
- 触屏：滑动左右变道 / 滑动上下或点按跳跃；屏幕按钮 ◀ JUMP ▶。
- 边沿检测在 main.js 键盘事件里做；触屏在 pointerup 里判定滑动方向。

## 存档 / 埋点 / 广告

全部经 `src/core/sdk.js` 统一出口；业务代码不碰 localStorage。`config/sdk.config.js` 是唯一配置源。
