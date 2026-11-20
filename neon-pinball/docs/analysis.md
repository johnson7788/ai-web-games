# 源码分析 — king of pinball（Cocos Creator）

> 源码根：`/Users/admin/remake-src/king-of-pinball-creator/`。本作是**改造**不是移植：只取玩法规则骨架（弹珠物理 + 计分 + 多球 + 掉落判负 + 逐轮推进），全部角色/场景/美术/音乐原创为霓虹赛博弹球台。以下事实均带 `文件:行号`。

## 1. 入口与主循环

- Cocos Creator 工程（`project.json`、`creator.d.ts`、`settings/`），脚本集中在 `assets/script/`，共 13 个 `cc.Class` 组件。
- 主控制器 `assets/script/gameCtl.js`：
  - `onLoad()` (`gameCtl.js:70`) 开启物理引擎、初始化回合/球数状态、挂触摸事件；并注入一段外部统计脚本（`gameCtl.js:89`，本作**不采用**，全部埋点只走站点 SDK）。
  - `startGame()` (`gameCtl.js:94`) 清空旧物体 → `initGame()` → `roundNextReady(true)` → 通知结算层开始。
  - `initGame()` (`gameCtl.js:118`) 初始 1 球、回合数 0。
  - 没有 `update(dt)` 主循环——逻辑全部由物理引擎 + 事件回调（`onBeginContact`/`onPreSolve`）驱动。

## 2. 输入（发射推杆）

- `initPlayerEvent()` (`gameCtl.js:130`)：`touchstart`/`touchmove` 更新瞄准指针角度 `initFF(e)`，`touchend` 调 `startRound()` 发射。
- `initFF(e)` (`gameCtl.js:166`)：根据触点相对指针 `ff` 的偏移算角度 `rota = 360*atan(offX/offY)/(2π)`，钳制到 `[-85°, 85°]`。
- `startRound()` (`gameCtl.js:206`)：由指针角度与 `shootPower` 算速度向量 `offX/offY`（`gameCtl.js:209-210`），用 `setInterval` 每 200ms 发一球，直到发满 `roundBalls`（`gameCtl.js:216-224`）。

## 3. 弹珠物理与碰撞

- 球体由 `createBalls()` (`gameCtl.js:155`) 实例化，`linearVelocity` 直接赋值，重力/碰撞交给 Cocos 物理引擎（`gameCtl.js:70` 开启）。
- 撞分块 `ai.js`：`onBeginContact()` (`ai.js:58`) → `cutScore()` 每次碰撞分数 -1，归零销毁（`ai.js:97-104`）；`shakeStart()/shake()` 做 8 帧抖动反馈（`ai.js:65-82`）。
- 底墙回收球 `outwall.js`：`onBeginContact()` (`outwall.js:30`) 标记 `used`、销毁球、调 `moveBall()` 把假球上移做视觉回收（`gameCtl.js:190-204`）。
- 道具复制 `magic1.js`：`onBeginContact()` (`magic1.js:40`) 调 `magic.copy()` 克隆一球（`magic.js:39-56`），并 `addBallNum()`（多球）。
- 重力变化：`ai.js:61` 命中后 `gravityScale=3`；`underWall.js:41` `gravityScale=100`；`w.js:42` `gravityScale=3`。

## 4. 判定（推进 / 失败）

- `aiFactory.js` 每回合生成一排分数块：
  - `createAis()` (`aiFactory.js:84`) 随机数量与每块分数。
  - `getScoreReady(ballCount, type)` (`aiFactory.js:169`) 分数公式：`ballCount<60` 时 `(2 + ballCount/60*10)*ballCount*(0.8+0.4*rand)`，否则 `700+299*rand`；波谷再乘 `0.2+0.2*rand`。
  - `getAiReady()` (`aiFactory.js:189`) 决定一排块数（1–5）。
- 回合推进 `roundNextReady(isInit)` (`gameCtl.js:234`)：回合 +1 → 新一排块 → `moveAi()` 把所有已存在块上移 60px（`gameCtl.js:282`，原作「块逐回合下压」）。
- 失败判定 `isGameOver()` (`gameCtl.js:302`) + `flag.js:28`：若块顶超过 `deadLine`（`ff.y - ff.height - 60`，`gameCtl.js:73`）→ gameover；接近（+60px 内）→ warning。
- 道具节奏 `getMagicReady()` (`gameCtl.js:287`)：每 1–2 回合给一次多球道具。

## 5. 计分与结算

- `scoreCtl.js`：`addScore()` 每次命中 +1（`scoreCtl.js:34`），`getScore()` 返回总分。
- `resultCtl.js`：`gameOver(score)` (`resultCtl.js:117`) 写本局分/历史最高分并弹结算；`getHistoryScore/updateScore` 走 FBInstant 排行榜（`resultCtl.js:144/163`，本作改为本地 best + SDK 存档）。

## 6. 提炼到本作的玩法骨架（1:1 还原的核心规则）

1. **弹珠物理**：重力 + 碰撞反弹 + 多球（`magic.copy`）→ 本作自写 2D 圆-线段/圆-圆碰撞，固定步长。
2. **推杆发射**：瞄准角 + 力度（`initFF/startRound`）→ 本作 Space 蓄力推杆。
3. **命中计分**：碰一下扣一分/加一分（`ai.cutScore`/`scoreCtl.addScore`）→ 本作 bumper/target 得分 + 连击乘数。
4. **多球**：道具克隆球（`magic1/magic`）→ 本作多球 + 黑洞回球。
5. **掉落判负**：球被底墙回收（`outwall`）→ 本作球掉底扣一条命，多球延续。
6. **逐轮/逐台推进**：每回合块上移逼近死线（`moveAi/isGameOver`）→ 本作 12 台目标分逐台推进。

## 7. 原创改造映射（与源差异）

| 源 | 本作 |
| --- | --- |
| 分数块（数字） | 电容球 bumper / 目标灯 / 超导灯 |
| 每回合块下压 | 12 台目标分 + 台面机关轮换 |
| 底墙回收球 | 左右挡板 + 中心掉球孔判负 |
| 多球道具 | 黑洞孔吸入→随机喷射口射回 + 双球台 |
| FBInstant 排行 | 本地 best + SDK 存档（`pipy-neon-pinball`） |
| 单场景 | 三场景包（电玩厅粉紫 / 主机房青蓝 / 霓虹雨街橙红） |
