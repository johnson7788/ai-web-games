# dice-cascade · 源码分析（弹球 cocoscreator 3.0）

> 规格：`docs/remake-all/games/spec-dice-cascade.md`。本文件是「改造前先读源码」的事实记录，
> 所有结论带 `文件:行号`，只描述原作事实，不含本作设计（本作设计见 `config/design.json`）。

## 1. 源码定位

- 实际目录：`/Users/admin/remake-src/弹球cocoscreator3-0/`（spec 里写的 `弹球cocoscreator3.0/` 是笔误，磁盘上是 `3-0`）。
- 引擎：Cocos Creator 3.x（TypeScript），物理用 `PhysicsSystem2D`（2D 刚体 + 碰撞）。
- 核心脚本：`assets/scripts/Scenes/PinballScene.ts`（弹珠主场景）、
  `assets/scripts/Prefabs/Dice/DiceMaster.ts`（骰子棋盘）、
  `assets/scripts/Prefabs/Slot/SlotMaster.ts`（老虎机槽）、
  `assets/scripts/Prefabs/Room/RoomTemplate.ts`（3D 房间展示）。

## 2. 主玩法：弹珠台（PinballScene）

`assets/scripts/Scenes/PinballScene.ts`：

- `PinballScene.ts:68-69`：`PhysicsSystem2D.instance.enable = true; gravity = new Vec2(0, 0)` —— 零重力弹珠台。
- `PinballScene.ts:84-105`：`makeTile()` 生成 12 行 × 8 列共 96 个 `TileNode` 格子（110×114），
  用棋盘格 `opacity = 50 + 100 * ((i + j) % 2)` 铺满屏幕，作为弹珠碰撞背景。
- `PinballScene.ts:106-124`：`alocateMonster()` 把 `monsterArray`（ObstacleNode）随机放到 3–7 行的空格上，
  每个障碍占一个格子，记录 `row/column` 与 `occupied`。
- `PinballScene.ts:126-157`：`rollButtonClicked()` 是「发射」入口：先清掉旧弹珠，
  再按 `superBet`（1/3/5/10，见 `PinballScene.ts:66` 与 `276-293` 循环切换）实例化 `superBet` 颗 `BeadNode`，
  随机 x 落在 `-162..162` 顶部，调用 `addRandomForce()` + `activateBead()` 把珠打进台面。
- `PinballScene.ts:160-172`：`onTouchStart` 给所有已发射弹珠再施加一次冲量 `applyForce`（玩家点击 = 加力）。
- `PinballScene.ts:173-218`：`update` 统计所有珠的总动能 `totalForce`；全部珠停（`beadStart=false`）即一局结束，
  `console.log("gold: " + coinNum)` 结算；超过 2 秒/3 秒按 `0.975/0.95` 逐帧衰减速度 `diminishVelocity`。

`assets/scripts/Scenes/BeadNode.ts`：

- `BeadNode.ts:44-52`：`onLoad` 随机 1–5 选 `beadFrame[color]`（5 色珠），注册 `BEGIN_CONTACT`。
- `BeadNode.ts:75-88`：`addRandomForce()` 给珠一个向上为主、随机 x 的冲量
  （`-20000 + 40000*random` x，`90000 + 30000*random` y），把珠「打进」台面。
- `BeadNode.ts:101-145`：`update` 按速度分档施加线性阻尼（>10 时 ×0.9975、>1 时 ×0.985、否则 ×0.95），
  速度 ≤0.1 时置 `beadStart=false`（珠停）。

`assets/scripts/Scenes/ObstacleNode.ts`：

- `ObstacleNode.ts:58-76`：珠碰到障碍 → `pinballScene.addGold(Number(this.myTag) * 10)`，即每个障碍按 `myTag × 10` 给金币，
  并在障碍上方弹「GOLD + N」飘字。**这是原作唯一的得分来源**：珠撞障碍 → 金币。

结论：原作核心循环 = **发射 N 颗珠 → 珠在零重力场弹跳、撞障碍得金币 → 全部停后结算金币**。
没有失败条件、没有目标分、没有推进结构；Dice/Slot/Room 是「房间老虎机」附属玩法（见下）。

## 3. 骰子棋盘（DiceMaster，蛇梯棋式）

`assets/scripts/Prefabs/Dice/DiceMaster.ts`：

- `DiceMaster.ts:40-64`：`initDiceMaster` 生成 `iconNum=16` 个 `DiceIcon`，随机 `iconKind=1..5`、`backKind=1..3`，
  玩家棋子用 `Slot/pig` 贴图，`playerIdx = startIdx`。
- `DiceMaster.ts:65-89`：`getDicePlace(diceNum)` 把一维索引映射成蛇形轨道坐标（每 4 格折行）。
- `DiceMaster.ts:135-166`：`rollWithNetwork()` 掷 2 颗 6 面骰（`Math.floor(Math.random()*6)+1`），
  `rollWithRandom()` 同样掷 2 骰并把「first | second」显示在屏幕中央。
- `DiceMaster.ts:169-183`：`moveBlock` 每走一步给轨道尾部补新图标并整体下移（无尽棋盘）。

结论：原作骰子玩法 = **掷 2 颗 6 面骰 → 在蛇形轨道上按步数移动棋子**（棋盘/老虎机混合，未与弹珠台联动）。

## 4. 老虎机槽（SlotMaster，3 列）

`assets/scripts/Prefabs/Slot/SlotMaster.ts`：

- `SlotMaster.ts:33-64`：`initSlotMaster` 按 `columnNum` 生成多列 `SlotLine`，每列 `rowNum+4` 个 `SlotIcon`。
- `SlotMaster.ts:66-85`：`rollWithNetwork()` 各列先无限滚动，再依次 `stopSlot` 停出结果。
- `SlotMaster.ts:91-110`：`rollWithRandom()/rollWithFixed()` 本地随机/定结果停槽。
- `SlotMaster.ts:112-118`：`getSlotResult` 收集各列结果，集齐后回调 `slotManager.getSlotResult`。

`assets/scripts/Prefabs/Slot/SlotIcon.ts:45-55`：`crushIcon` 命中后把 `candy_X_0` 换成 `candy_X_1`（压碎贴图）。

结论：原作老虎机 = **3 列图标槽，旋转后比对结果**；`SlotLine.ts:112-160` 的 `getIconKind/getSlotResult`
说明「三个槽位图标匹配」是核心判定的兜底（与 spec 兜底方案一致）。

## 5. 可复用的事实点（本作改造依据）

1. 弹珠台得分 = 珠撞障碍（ObstacleNode）累加金币 —— 本作把它改成「骰面决定弹珠落区/奖励倍率，珠落桶计分」。
2. 骰子 = 6 面（1–6），2 颗 —— 本作改成 1–3 颗符文骰，骰面决定弹珠初始区 + 基础倍率。
3. 老虎机 = 多列图标匹配 —— 本作以「三连符文（三骰同面）」作为 signature 金光开门。
4. 原作零重力 + 线性阻尼（BeadNode.ts:121-138）—— 本作弹珠走确定性 Galton 板（可 seed），
   不再依赖物理引擎，纯逻辑可测、可复现。

## 6. 改造结论

- P0「掷骰（概率公平可 seed）、按骰面结果推进/得分」成立：骰面 = 落区 + 倍率，落在弹珠桶上计分。
- spec 的原创改造全部落在弹珠台 + 骰子这条线上，老虎机以「三连符文」signature 吸收，不再做独立槽机。
