# FOOD CHAIN — 源码分析（改造自 顶级食物链）

> 结论先行：原工程 `顶级食物链-creator` 是一个 Cocos Creator 的**拖卡配对教育小游戏**（食物链主题的“把正确卡拖进槽位”），
> 并非 arcade 吞噬游戏。本作按 `spec-food-chain.md` 的 P0 契约，把「顶级食物链」重新诠释为**深海食物网的体型进化吞噬**玩法：
> 移动生物 → 吃更小的长大 → 碰更大的即死 → 12 阶段成长（浮游→…→顶级捕食者）。
> 原作的素材 / IP / 文案一律不复用；本作角色 / 场景 / 音乐全部原创（程序化 Canvas + WebAudio 合成）。

## 1. 原工程事实（带 文件:行号）

- 入口 `Game.ts`：`cc.director.on("GAME_START", this._startGame)`（`assets/Script/Game.ts:35`）；`_startGame` 重置 `_curLevel=0` 并 `_loadLevel()`（`Game.ts:43-49`）；`_onNextLevel` 打完最后一关弹 ResultUI（`Game.ts:51-60`）；`_loadLevel` 惰性实例化 `Level_1..4.prefab` 并 `init()`（`Game.ts:62-72`）。
- 关卡 `Level.ts`：`init()` 随机分配 1–4 颜色到 `targetPoint`（`Level.ts:50-61`）；每秒 `_gameTime++`（`Level.ts:63-65`）；`_onTakeInSlot` 命中则 `showItems.itemSp` 换成 `item_${cardId}` 并缩放弹跳、`_curCompleteCount++`，全中则 1s 后弹 PassUI（`Level.ts:72-91`）；未命中则红色闪烁两次（`Level.ts:95-102`）；`_isSame` 判定“槽位位置相同且 itemId==cardId”（`Level.ts:105-107`）。
- 卡 `Card.ts`：拖动距离 >150px 才进入拖拽（`Card.ts:41-44`），松手后把卡拖到 targetPoint，`|x|<100 && |y|<100` 视为放入槽位并 `TAKE_IN_SLOT`（`Card.ts:62-81`）。
- 关卡配置 `LevelConfig.ts`：`LevelList` 4 关，每关 `cardList`（正确答案卡）+ `delList`（已展示需排除的卡）（`Level.ts 同目录 LevelConfig.ts:8-29`）。
- 底栏 `BottomBar.ts`：`SHOWNUM=5`（`BottomBar.ts:16`），从 0–21 随机抽 5 张并排除 `delList`、并入答案卡去重（`BottomBar.ts:29-70`）。
- 文案 `Constants.ts`：`TopicConfigs` 实为交通安全教育题（过马路 / 信号灯 / 乘车），与“食物链”玩法解耦（`Config/Constants.ts:10-68`）。
- 美术：`Texture/game/land/item_0..14.png`、`Texture/game/sea/item_15..21.png` 共 22 张食物链物种卡（`assets/Texture/game/{land,sea}`）。

## 2. 本作玩法还原 / 重诠释（按 spec P0）

| 契约点 | 原工程 | 本作 |
| --- | --- | --- |
| 移动生物 | 拖卡（Card.ts:36 拖拽） | 指针 / 摇杆 / WASD 移动发光生物（`src/game/sim.js`） |
| 吃更小的变大 | （无） | 半径判定：`fish.r <= player.r` 可吞、`+mass`、体型随阶段变大 |
| 碰更大的即死 | （无） | `fish.r > player.r` 且边缘相触 → 死亡结算 |
| 成长阶段 | 4 关卡（LevelConfig.ts） | 12 阶段（浮游→虾→小鱼→…→顶级捕食者） |
| 吃食物涨体型 | 吃卡（教育匹配） | 吃浮游粒子涨 mass |
| 限时/存活计分 | 每关计时（Level.ts:63） | 存活计分 + 阶段推进，死结算 |

## 3. 原创改造（signature + 区别点）

- **签名记忆点**：吞掉同级对手时触发「光链闪烁进化动画」（`lightChain` 事件 → 渲染爆发 + 音效 fanfare + 短暂无敌）。
- **毒刺鱼**：比自己小、可吃，但吞了会掉体型（“能吃≠该吃”，辨识决策）。
- **共生**：贴近水母 3s 获得护体毒刺，期间可吃大一级（`symbioseStart` → `stingGain` → `stingUse`）。
- **三场景包**：光合带（亮青，太阳光束+珊瑚剪影）/ 中层（深蓝，生物荧光点+水母）/ 热泉（暗红，热泉羽流+火星+暗流区）。

## 4. 推进结构（12 阶段）

每阶段 = 体型目标（mass 阈值）+ 生态轮换（毒刺鱼占比 / 大鱼密度 / 水母出现率 / 暗流区），见 `config/stages.js`。
`stageAt(mass)` 单调递增；`radiusAt(stage)` 单调递增；zone 随阶段切三章（0–3 光合 / 4–7 中层 / 8–11 热泉）。

## 5. 与 abyss-eel / fish-frenzy 区分

- 非蛇链（abyss-eel 是光珠长链侧滚），非炮台捕鱼（fish-frenzy 是射击）。
- 本作是**体型进化生态**：位置→吞噬→成长的正反馈环 + 毒刺鱼/共生的风险决策。
