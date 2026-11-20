# 源码分析：找你妹（FindGame，Cocos Creator）

> 源码：`/Users/admin/remake-src/找你妹/找你妹/zhaonimei/assets/FindGame/scripts/`
> 结论：原作是「按类别找物」的 1v1 竞速小游戏（5 回合、每回合 60 秒、人机对抢）。本作 `spot-it` 还原其核心循环（杂乱场景按清单找物、点错扣时、限时、关卡递进），并原创改造为深夜跳蚤市场手电筒找货（见 `config/design.json` 的 signatureMoment / 手电电量 / 真假孪生）。

## 1. 入口与主循环

- `FindGame_Main.js:58-71` `start()`：设 60fps（`cc.game.setFrameRate(60)`）、`initGame()`、注册 `event_select` 回调。
- `FindGame_Main.js:72-176` `initGame()`：初始化时间（`l_gameEndTime=Date.now()/1000 + 60*1`，即每局 60 秒）、按钮、结算窗、任务栏、读两张配置表（物品 + 任务）、`gameRoundNum=5`、`currentRound=1`、`initRound()`。
- `FindGame_Main.js:529-533` `update(dt)`：每帧 `updateEndTime()`（计时/胜负判定）+ `runAI()`（AI 对手）。

## 2. 物品 / 任务配置（核心数据）

- `FindGame_Main.js:119-146` `s_itemData`：26 种物品，5 类（`itemClassID`）：1 动物、2 交通工具、3 时间、4 文具、5 植物。
- `FindGame_Main.js:150-158` `s_taskData`：6 条任务，形如 `动物*3`（`task1ClassName` + `task1Num`），即「找出 N 个某类物品」。

## 3. 关卡（回合）与判定

- `FindGame_Main.js:185-220` `initRound()`：随机选任务、按 `task1Num` 计算 `currentProessUnit=ceil(100/taskNum)`、物品 `select` 清零、洗牌后重建列表。
- `FindGame_Main.js:246-299` `selectItem(num)`：`itemClassID == currentTaskClassID` 且未选中 → 标记选中、`currentTaskNum-1`、进度 +`currentProessUnit`；`currentTaskNum<=0` → `currentRound+1`、按双方进度结算该回合输赢、`initRound()`。
- `FindGame_Main.js:300-323` `RoundTimeOut()`：倒计时归零 → 强制进入下一回合并按进度结算。
- `FindGame_Main.js:403-427` / `489-527`：5 回合结束（`currentRound>gameRoundNum`）→ 结算窗，按 `i_myWin` vs `i_oppositeWin` 显示 win/lose/deuce。

## 4. AI 对手

- `ai/FindGame_AI.js:6-23` `AI.runAI()`：每帧约 2% 概率随机选一个物品 `selectItemAI(num)`（`FindGame_Main.js:430-482` 同一套命中判定，计入 `i_oppositeProgress`）。→ 本作的 greedy bot 思路同源：**查物品位置表直接点目标**（spec 要求 greedy 必须过第 3 关）。

## 5. 改造映射（1:1 还原 → 原创）

| 原作 | 本作 spot-it |
| --- | --- |
| 按类别找物（动物×3） | 按清单找具体物品（清单 3→6 件，12 关） |
| 点错不扣时（只漏掉） | 点错扣时，点中孪生诱饵双倍扣时 |
| 每回合固定 60s | 每关限时 34–45s，逐关收紧 |
| 26 种物品 5 类 | ≥40 种程序化绘制物品 8 类（`config/items.js`） |
| 无视野机制 | 手电光圈视野，电量随时间缩小、找对回充 |
| 固定一屏 5 回合 | 3 场景包（旧书摊/玩具堆/鬼市）12 关轮换 |
| 1v1 竞速 | 单人限时闯关，signature：找齐清单时市场灯一盏盏亮起 |
