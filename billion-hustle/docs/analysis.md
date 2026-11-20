# 源码分析 — 挣他一个亿（Cocos Creator）→ BILLION HUSTLE

源码根：`/Users/admin/remake-src/creator-挣他一个亿/`（Cocos Creator 工程，脚本为 CommonJS `require` 风格）。

## 1. 入口与主循环

- 主场景逻辑集中在 `assets/Scripts/UI/GameScene.js`（1302 行）：顶部 HUD、市场货物、公司股票、伙伴约会、技能、随机事件、按「年」推进。
- 开局初始化：`GameScene.js:318-330`（`start()` → `initTopUIData` / `InitMarketItems` / `InitOwnedItems` / `InitCompanyItems`）。
- 初始资金：`GameScene.js:345-388`（`initCash`），随机 20k/50k/100k（权重见 `assets/resources/json/cash.json`）。
- 核心回合循环：`GameScene.js:522-560`（`ToNextYear`）——`RefreshUserAge` → 刷新行情/公司 → `GetBonusRewardEveryYear` → `RefreshUserAssets` → `RefreshHealthHp` → `CheckEventHappen`。
- HUD 刷新：`GameScene.js:678-705`（`RefreshUIShow`），资产分段换图标（`bsqj/scxx/sylx/bdzc`）。

## 2. 技能（点击力 / 自动收入的来源）

- 数据：`assets/resources/json/skill.json`——4 棵技能树（`Id 1..4`），每棵 3–4 个子技能（`subId`），升级表 `upCostList:[[等级, 效果值, 花费], …]`。
- 类型枚举：`assets/Scripts/Core/SkillType.js:1-17`——14 种，含「每年金钱」(3)、「初始金钱」(4)、「初始名声」(11)、「退休年限」(10) 等。
- 面板：`assets/Scripts/UI/SkillPanel.js:19-56`（`InitPanel` 按 4 棵树建格子）、`:117-130`（`ShowPanel`/`RefreshPanel`）。
- 单个格子：`assets/Scripts/UI/SkillItem.js:16-44`（显示等级/图标/升级提示）、`:47-50`（点击 → `OpenUpgradeSkill` 事件）。

## 3. 伙伴（被动加成来源）

- 数据：`assets/resources/json/mate.json`——13 个伙伴，字段 `getCond`（获得条件）、`unlockCond`、`bonusList`（加成，类型见 `MateBonusType`）、`lovePointList`（好感升级）。
- 加成类型：`assets/Scripts/Core/MateBonusType.js:1-8`——`HP/Reputation/Money/WareHouseCapcity/Treat`（含「Money 3」= 加钱，即被动收入）。
- UI：`assets/Scripts/UI/MateItem.js:36-51`（`init`/`RefreshLovePoint`）、`:56-77`（`OpenMateItemPanel` → 约会）。

## 4. 资产与物品

- 类型：`assets/Scripts/Core/ItemType.js:1-13`——`Cash 100 / Goods 101 / Skill 102 / Company 103 / House 104 / Car 105 / Mate 106 / Achieve 107 / EventData 108`。
- 已拥有物：`assets/Scripts/UI/BelongItem.js:20-40`（`init` 显示拥有数量）、`:42-70`（`ClickOpen` → 出售）。
- 货物（低买高卖）：`assets/resources/json/goods.json` + `GoodsItem.js`（`refreshPrice/refreshLowPrice/refreshMidPrice/refreshUpPrice` 按年份波动）。
- 公司/股票：`assets/resources/json/company.json`（5 家公司，`bonusRatio` / `inPrice` / `outPrice` / `proList` 涨跌概率）。

## 5. 数值滚动（签名来源）

- 千分位格式化：`assets/Scripts/Core/Global.js:112-137`（`FormatNum`——倒序每三位加逗号再反转，即「数值滚动」的基础）。
- 全局常量：`assets/Scripts/Core/Global.js:10-18`（`CompanyCreateCost=1000`、`InitWareHouseCapcity=100`、`RetireInitAge=70`、`HealthLine=50`）、`:55-60`（健康状态阈值 80/55/54）。

## 6. 引导与事件

- 市场引导：`GameScene.js:402-476`（`InitMarketItems` 内嵌 `tutorialStep 11→15`：买→下一年→卖）。
- 年龄触发引导：`GameScene.js:562-620`（`CheckTutorialHappen`——25 岁约会、30 岁开公司、持公司股票分红）。
- 随机事件：`GameScene.js:639-675`（`CheckEventHappen`——25 岁后每 2–3 年触发一次）。

## 7. 改造映射（spec）

| 原作 | BILLION HUSTLE |
| --- | --- |
| 低买高卖货物挣钱（GoodsItem） | 点击挣钱（核心动词） |
| 技能树升级（SkillItem/SkillPanel） | 点击力 / 自动收入两级升级 |
| 伙伴约会加成（MateItem，Money 加成） | 伙伴雇佣（被动产出） |
| 目标「挣他一个亿」+ `FormatNum` 滚动 | 目标一亿 + 融资「估值翻牌」动画 |
| —（原创） | 风口轮盘（60s 押赛道 ×3）+ 烧钱模式（2× 30s / 冷却 60s） |
| —（原创） | 12 融资轮 + 三场景包（车库/孵化器/摩天办公） |
