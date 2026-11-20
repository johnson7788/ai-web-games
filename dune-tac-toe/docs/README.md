# DUNE TAC TOE · 契约与设计源

> 改造自 `local/src1/井字游戏-creator/`（Cocos Creator 井字棋），沙漠主题原创改造。

## 1. 世界与坐标

- 逻辑世界 1280×720，letterbox；60Hz 固定步长（`STEP=1/60`）。
- 棋盘为 3×3 逻辑格，索引 0–8 行优先；sim 只产索引，像素换算全在 render。
- 棋子：`'X'`=仙人掌（先手/玩家），`'O'`=蝎子（后手/AI/2P 玩家 2）。

## 2. 实体字段

- `board`：`Array<9>`，元素 `'X' | 'O' | null`。
- `state`：`{ mode:'puzzle'|'endless', level, scene, phase:'playing'|'won'|'lost'|'draw', board, turn, movesMade, movesLimit, goal:'win'|'draw', ai:'random'|'greedy'|'perfect'|'2p', result:{outcome, reason, movesMade} }`。

## 3. 事件（sim 发，main 消费）

`start` / `place{cell,player}` / `turn{player}` / `threat{player}` / `block{player}` / `win{reason,movesMade}` / `lose{reason}` / `draw{reason}`。

## 4. 模块 API

- `createRun(levelIndex, {seed})` / `createEndless(mode, {seed})` → run。
- `run.place(i)`：落子（谜题/人机中 X 落子后蝎子同步完美回应；2P 交替）。
- `run.step(dt)`（回合制 no-op）/ `run.getHud()` / `run.drainEvents()`。
- 求解器导出：`winner` / `winningLine` / `bestMove` / `greedyMove` / `randomMove` / `canForceWin` / `canForceDraw` / `winningMoves` / `drawingMoves`。
- `renderer.draw(state, dt, view)` / `renderer.debugLayout()`。
- `createAudio()` → `event/setMuted/startBgm/stopBgm/unlock`。

## 5. 状态机（main）

`title → (levels | endless) → playing → paused / result → title`。

## 6. 调试契约 `window.__ll`

`state.phase/lang` · `start(i)` · `startEndless(mode)` · `pause/resume/restart/home` · `sim()` · `save/load` · `tutorial.{active,step,steps,current,skip}` · `debug.{state,layout,loadLevel,startSeeded,autoPlaceSolution,fastForward,greedyPlace,setTutorialDone}`。

## 7. 谜题约束

12 关三章（dawn 1-4 / dusk 5-8 / night 9-12）。goal=win 的关 `canForceWin(board, movesLimit)===true` 且 `canForceWin(board, movesLimit-1)===false`；L12 goal=draw：`canForceWin(…,3)===false` 且 `canForceDraw===true`。均由 `tests/levels.test.mjs` 单测锁定。
