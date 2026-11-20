# SAND SERPENT · 契约

> 沙漠沙蟒：网格蛇定时步进，吃沙漠生物变长，躲墙/仙人掌/硬地/自身，长到目标长度过关。

## 1. 世界 / 坐标 / 单位

- 逻辑世界 1280×720 + letterbox；固定步长 `STEP=1/60`（`config/game.config.js`）。
- 网格 12 行 × 20 列，坐标 `[r, c]`（r=0..11，c=0..19），`cell≈53px`（render 由 `LAYOUT` 计算）。
- 蛇头 `state.snake[0]`；方向 `{dr,dc}`（`up/down/left/right`）。

## 2. 实体字段

- 蛇：`state.snake = [{r,c},...]`（头→尾），`state.length` 逻辑长度，`state.score` 分数。
- 食物：`state.food = [{r,c,type}]`，type ∈ `beetle|scorpion|thorn`。
- 格：`state.grid[r][c].kind ∈ empty|wall|cactus|hard|boost`。

## 3. 事件名（sim 发 → main/render/audio 消费）

`start / move / turn / eat / grow / spawn / milestone / nearMiss / wrap / boost / scorpionEscape / tailDrop / sandstorm / win / lose`

## 4. 模块 API

- `createRun(levelIndex, {seed})` → `run`；`run.step(dt)` / `run.moveOnce()` / `run.input(dir)` / `run.getHud()` / `run.drainEvents()`。
- `createRenderer(canvas)` → `{ draw(state, dt, view), debugLayout(), resize(w,h) }`。
- `createAudio()` → `{ event, setMuted, startBgm, stopBgm, unlock }`。
- `ui` → 语言/屏幕显隐薄适配层。

## 5. 输入契约

- 键盘：方向键 / WASD；触屏：canvas 滑动（≥24px 判方向）。
- 边沿检测归 main；`run.input()` 内部做方向缓冲（≤3 步，掉头/同向拒绝）。

## 6. 状态机

`phase`: `title → playing ⇄ paused → result`；sim 内 `playing → won|lost`。

## 7. smoke test

```js
const r = createRun(0, { seed: 1 });
r.step(1/60); r.input('up'); r.moveOnce();
r.getHud(); r.drainEvents();
```
