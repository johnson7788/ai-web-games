# 源码分析 — 奔跑小鹅鹅 → GOOSE LANE

> 参考源码：`/Users/admin/remake-src/奔跑小鹅鹅/`（Cocos Creator，`assets/src/Game.js` 等）。
> 本作是「改造」不是「移植」：玩法规则按 spec 的 P0 重做成三车道自动前进跑酷，角色/场景/音乐全原创（程序化 Canvas + WebAudio），不复用原作任何素材/IP 名。

## 1. 原作核心结构

| 事实 | 位置 |
| --- | --- |
| 主循环在 `update()`：每帧 `balloon_count` 递减，归零时 `balloon.opacity = 255`（原作「气球」只是待机提示，不是护盾） | `Game.js:325-328` |
| 点击左右：`onClickCanvas(o, t)` 按 `scaleX` 方向取下一格地板 `getFloor(p)`，命中 `judgeProp` 后 200ms 延时移动到下一格 | `Game.js:200-214` |
| 前进步数计分：`next(o)` 中 `score += 1`，`score % 50 == 0` 触发里程碑播报 | `Game.js:129-143` |
| 道具判定：`judgeProp` 分 ice1/2/3、gem、force、reverse、trap（seals/tail 等） | `Game.js:152-198` |
| 复活一次：`gameOver(t)` 按 `isRevive`/`moreRevive` 分支，`reviveGame` 原地重置地板 | `Game.js:84-121` |
| 场景切换：`next()` 里按 `score` 到达 `gameBgScoreLv_1/_2` 换背景图 | `Game.js:131-142` |
| 键盘：`start()` 里 KEY_LEFT/KEY_RIGHT 调 `onClickCanvas` | `Game.js:300-315` |
| 初始化：`onLoad()` 置 `playerSize`、宝石对象池、`boneLand` 落地动画 | `Game.js:289-299` |

## 2. 改造映射（规则 1:1 还原 P0 + 原创 twist）

| spec P0 | GOOSE LANE 实现 |
| --- | --- |
| 3 车道自动前进 | `src/game/sim.js`：`distance += speed*dt`，`WORLD.LANE_X=[330,640,950]` |
| 左右按钮/按键换道 | `main.js` 键盘 ←→/AD + 触屏点半屏；sim `laneChangeCd` 0.12s 冷却 |
| 障碍（车/坑）碰撞判负 | `sim.js:handleCollisions/hit`：同车道 `z<=0` 判负；邻道 `nearMiss` |
| 宝石收集 | `sim.js:handlePickups` gem → `gems+1` + `gem` 事件 |
| 里程计分 | `sim.js`：`distance`（米）+ 每 10m `milestone` 事件 |
| 速度渐增 | `config/gameplay.js:SPEED`（BASE 8 → MAX 16，RAMP 0.06） |
| 复活一次 | `sim.js:revive()` + `main.js` 复活卡（`run.reviveAvailable`） |

**原创 twist（spec）**：
- 气球（叠 2 层抵一次碰撞）→ `sim.js:hit()` 中 `balloons>0` 时 `balloonSave`。
- 闸机门（红灯停 1s 等绿 / 绿灯冲过）→ `sim.js:updateGates`（`GATE.WAIT_SEC=1`）。
- 三场景包（早高峰暖白 / 午后青 / 夜班蓝紫霓虹）→ `config/levels.js:SCENES` + `render/theme.js`。
- 签名「丝滑换乘」：0.5s 内连续换道 3 次白鸽飞过 → `sim.js:onLaneChange`（`COMBO.SMOOTH_*`）。

## 3. 推进结构（12 站）

`config/levels.js:STATIONS`：每 60m 一站；站 3/8/9/11/12 窄缝，站 4/8/10/12 闸机，站 5+ 逆行外卖车，站 8 起切夜班。`src/game/spawner.js` 保证每行至少留一条安全车道、闸机单独成行且前后清空。
