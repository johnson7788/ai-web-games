# RING CYCLE · 源码分析（七彩蹦蹦 / ColorUp）

源码根：`/Users/admin/remake-src/七彩蹦蹦/七彩蹦蹦/ColorUp/assets/script/`（Cocos Creator JS）
规格：`docs/remake-all/games/spec-ring-cycle.md`

## 一、原作核心循环（事实 + 行号）

1. **入口**：`game.js:49-51`——`TOUCH_START` 触发 `player.jump()`；`game.js:51` 首次触摸同时隐藏操作提示。
2. **弹跳**：`player.js:55-67`——`jump()` 先 `moveBy(jumpDuration, v2(0, jumpOffsetY))` 上跳（若越顶则只跳到 0），再 `sink = moveBy(sinkDuration, v2(0, -parent.height/2))` 沉到底。同时 `game.js:40-43` 把 `jumpHeight/jumpDuration` 传给 `obstacleSet.moveDown`。
3. **世界滚动**：`obstacleSet.js:65-91`——`moveDown()`：首子节点滚出屏幕即回收（palette 回 NodePool），末子节点顶部低于半屏就补生成新障碍，其余全部下移。
4. **判定（颜色即生命线）**：`player.js:143-161`——`onCollisionEnter`：
   - `obstacle`：`if (!isProtectived && !other.color.equals(this.color)) this.gameOver()`（异色死亡）。
   - `gift`：`game.captureStar(star.score)`（吃星得分）。
   - `palette`：`updateStyle(palette.getPrimaryColor())`（**染色**，换玩家颜色）。
   - `protective`：`protective(duration)`（护罩，`player.js:79-123` 默认 5s 进度条）。
5. **障碍配色**：`obstacleSet.js:118-132`——`createObstacle` 用 `usingColorCount` 逐步开放更多颜色；`circle.js:34-60` / `cross.js:30-50` / `lineSeries.js:70-103`——`setColors(primaryColor, optionalColors, optionalCount)` 首段是 primaryColor，其余从 optionalColors 随机去重填充。
6. **调色板换色**：`palette.js:28-47`——`setColors(colors, exceptColor)` 返回一个 `!= exceptColor` 的随机 primaryColor；`obstacleSet.js:103-106` 保证下一环主色不与上一环相同（`lastPrimaryColor` 链）。
7. **护罩**：`protectiveCover.js:7-8`（duration=5）、`29-32`（碰撞后移除）。
8. **得分**：`giftCollector.js:29-35`——`captureStar(score)` 累加并刷新 label；`star.js:40-50`——吃星后生成爆裂特效并移除。
9. **结算**：`game.js:93-100`——`gameOver()` 调 `gameResult.setNewScore(score)` 后切到 GameOver 场景；`gameResult.js:31-53`——维护 top-3 历史分；`gameOver.js:39-91`——当前分 + 历史前三。

## 二、本作改造映射

| 原作事实 | RING CYCLE 实现 |
| --- | --- |
| 球上跳、世界下滚（`player.js:55` / `obstacleSet.js:84-90`） | 糖球固定屏幕 y，世界持续下滚（`src/game/sim.js` `scrollAndMile`） |
| 触屏跳跃为唯一输入 | ←→ 横移（键盘 + 指针），触屏同 |
| 异色 obstacle 死亡（`player.js:146-148`） | 落在异色格死亡（`resolveRing`） |
| palette 染色（`player.js:154-155`） | 白环万能安全但随机换色；每带推进染料轮转 +1 |
| protective 护罩 5s（`player.js:79-123`） | 木环一次性跳板（不染色不得分保连击） |
| 吃星得分（`giftCollector.js:29`） | 同色/白环得分；连吃 5 同色触发彩虹糖雨（signature） |
| primaryColor ≠ 上一环（`obstacleSet.js:103-106`） | 颜色随带进度轮转 + 白/木概率分配 |

## 三、结论

原作是「上跳穿旋转色环 + 染色 + 护罩」的节奏类；本作按 spec 改为「**下落吃色环**」：横向操控决定落点，颜色即生命线，木环/白环形成「救急 vs 捷径」的取舍，与 color-flux 的「上跳穿旋转障碍」明确区分。
