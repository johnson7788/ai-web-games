# Tile Vault · 宝库夜盗

> 改造自 `local/src1/3D羊了个羊/`：伪 3D 等距堆叠三消 → 盗贼猫偷宝库。

## G0 立项（八问）

1. **一句话**：盗贼猫潜入地珠宝库，从等距堆叠的宝物中拾取自由块放进底部槽，三同凑齐化作金币雨落袋——槽满或超时就前功尽弃。
2. **参考**：3D 羊了个羊（层叠拾取 + 底部槽 + 三消）。
3. **差异化**：① 伪 3D 等距宝库 + 可旋转视角（0°/45° 两档）② 宝库夜盗叙事 + 金币雨 signature ③ 生成器 + 回溯求解器保证无道具可解。
4. **操作**：点击自由块拾取入槽；触屏同；拖拽/按钮旋转视角。
5. **一局**：1–2 分钟一关；槽满或超时失败；爽点在前 15s 第一次三同金币雨。
6. **成长**：局内道具（撤回/洗牌）+ 跨局关卡解锁/星级/累计金币。
7. **结局**：通关星级结算卡（可下一关）；失败可重试（2 次复活）/重开。
8. **乐趣**：掌控（顺序规划）+ 好奇（视角/假锁/新品类）；第 3 分钟靠「差一点 + 下一关解锁」留住。

## 数据契约

- **世界**：1280×720 逻辑世界 + letterbox；60Hz 固定步长。
- **块**：`{ id, type(0..N-1), x, z, y }`（y=层，x/z=网格列/行）。
- **状态** `run.state`：`phase(playing|won|lost)`、`tiles[]`（场景剩余块）、`tray[]`（底部槽）、`trayCap`、`timeLeft`、`coins`、`merges`、`revivesLeft`、`items{undo,shuffle}`、`stars`、`result`。
- **API**：`createRun(levelIndex, {seed})` / `step(dt)` / `pick(id)` / `undo()` / `shuffle()` / `revive()` / `getHud()` / `drainEvents()` / `isFree(tile)`。
- **自由判定**：`isFree(tile) = !sceneHas(tile.x, tile.z, tile.y+1)`（正上方无剩余块）。
- **事件**：`pick/merge/coinRain/layerClear/countdownTick/undo/shuffle/revive/win/lose/levelStart`。
- **状态机**：`title → playing → (paused ⇄ playing) → result → (retry|next|home)`。
- **调试口**：`window.__ll`（`state.phase / start / pause / resume / restart / home / debug.state() / debug.loadLevel(i) / debug.startSeeded(i,seed) / debug.autoPlaceSolution() / debug.pickNext() / debug.fastForward()`）。

## 目录

`config/`（design/levels/locales/sdk/game.config）· `src/game/{sim,level}.js`（逻辑+生成+求解器）· `src/render/index.js`（等距渲染）· `src/core/{audio,i18n,sdk}.js` · `src/ui/ui.js` · `src/main.js` · `tests/` · `tools/`。
