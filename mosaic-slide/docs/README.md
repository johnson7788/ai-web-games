# MOSAIC SLIDE · 数据契约

## 1. 世界 / 坐标 / 单位

- 逻辑世界 1280×720（`config/game.config.js` WORLD），60Hz 固定步长（STEP=1/60）。
- 棋盘坐标：`(r,c)`，`r=0..rows-1`、`c=0..cols-1`；cell index = `r*cols+c`。
- 缺口（缺片）的家 = cell 0（左上角），与源码 `isBlank(0,0)` 一致。

## 2. 状态形状（`run.state`）

```
level, phase('playing'|'won'|'lost'), rows, cols, scene, cut,
rotate/blind/dual/timed/hex/grand,            // 机制开关
board[cell] = 碎片 id（0 = 缺口）,             // 完成态 board=[0,1,2,...,N-1]
rot[cell], homeRot[碎片id],                    // 旋转关：朝向（0..3）
blank, moves, rotations, movePar, timePar, timeLeft, initialTime,
reference{visible, mode('full'|'a'|'b'), hideAt, peekUntil}, peekLeft,
stars, wonClock, result
```

## 3. 模块 API

- `createRun(levelIndex, {seed})` → run；`run.step(dt)` / `run.slide(r,c)` / `run.rotate(r,c)` / `run.peek()` / `run.getHud()` / `run.drainEvents()`。
- `solver.js`：`isSolvable(board,rows,cols)`（逆序奇偶 + 缺口曼哈顿距离）、`neighbors`、`solveScramble`。
- `pattern.js`：`createPattern(level)` → `cell(r,c)` 返回 `{fill,accent,motif,variant,...}`（确定性，同关一致）。
- `render/index.js`：`createRenderer(canvas)` → `{draw(state,dt,view), debugLayout(), resize()}`。
- `core/audio.js`：`createAudio()` → `{event,setMuted,startBgm,stopBgm,unlock}` + `scheduleBgmLoop/scheduleSfx`。

## 4. 事件名

`levelStart / firstMove / slide / settle / correct / wrong / rotate / peek / referenceHide / referenceSwitch / countdownTick / win / levelClear / lose`。sim 发事件，render/audio/ui 各自消费。

## 5. `window.__ll` 调试契约

`state.phase/lang`、`start(i)`、`pause/resume/restart/home`、`run()`、`sim()`、`tutorial{active,step,steps,current,skip}`、`startTutorial`、`save/share/ui`、`fps()`、`debug{state,layout,loadLevel,startSeeded,setTutorialDone,startTutorial,tutorialStep,autoPlaceSolution,fastForward,giveUp,armRotate}`。
