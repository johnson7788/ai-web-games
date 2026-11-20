# WATER RITUAL — 源码分析（改造自《多喝烫水》）

源码根：`/Users/admin/remake-src/多喝烫水-creator/`（Cocos Creator 微信小游戏）。
结论：原作是「喝水打卡计划养成」小游戏，核心循环是「设提醒 → 到点打卡 → 累计水滴/金币 → 签到/抽奖/答题」。本作按 spec 重写为「茶馆经营 + 倒水时机」玩法，只还原 P0 的「每日目标 / 倒水入杯 / 完成打卡 / 连续天数 / 累计统计 / 提醒节奏」六件事，其余（微信登录、抽奖、答题、成就、后端）全部不迁移。

## 入口与场景

- `assets/Scenes/start.fire` → `assets/Scripts/Start.js`：大厅/登录入口。
- `assets/Scenes/PlanScene.fire` → `assets/Scripts/DrinkPlan.ts`：**饮水计划主页**（本作对应「茶馆经营主循环」）。
- `assets/Scenes/rank.fire` / `RankView.js`：排行榜（不迁移）。
- 场景跳转：`DrinkPlan.ts:80` `cc.director.loadScene('start')` 回大厅。

## 主循环（DrinkPlan.ts）

- `DrinkPlan.ts:32` `start()`：`Global.isopencount = 0` 后 `initUI()`。
- `DrinkPlan.ts:41-64` `initUI()`：拉 `Global.ShuiDiPlaneList`（饮水计划列表），逐条 `cc.instantiate(this.drinkPlanItem)` 并 `plan.getComponent("DrinkPlanItem").init(i, res.result[i])`（`DrinkPlan.ts:50-52`）；`isopen` 时 `Global.isopencount++`（`DrinkPlan.ts:53-54`）。
- `DrinkPlan.ts:76-115` `onClickToggle`：`toggle_plan`（饮水计划）/ `toggle_list`（守约清单）两个 tab 切换；守约清单 `Global.ShuiDiPlaneLog` 拉历史，`IsFinish` 决定用 `finishPlanItem` 还是灰色 `finishPlanItem_hui`（`DrinkPlan.ts:91-102`）。
- `DrinkPlan.ts:119` `onClickAddRemind` / `:125` `onClickShare` / `:132` `onCreateReport`：原作仅 `console.log`，无实装——本作把「提醒节奏」实装为「每 5 单一波客流高峰」。

## 输入与判定

- `DrinkPlanItem.js:35-45` `init(order, data)`：显示「第 N 杯」+ 时间（`data.time.substr(0,5)`），开关 sprite 依据 `data.isopen`。
- `DrinkPlanItem.js:48-66` `onClickToggle`：开/关打卡；**核心判定**「每日至少 4 杯水」——`if (Global.isopencount > 4)` 才能关，否则 `Global.ShowTip(...,"为了您的健康，每日至少4杯水哦")`（`DrinkPlanItem.js:63`）。这是原作唯一「判定」：每日杯数目标 ≥4。
- `FinishPlanItem.js`：守约记录项（完成/未完成）——对应本作「连续天数连击」。

## 累计统计 / 奖励

- `Global.js:34-71`：水滴 `shuidi`、金币 `gold`、连续登录 `logindays`、守约次数 `keepcount`、成就等级 `cjlvl` 等全局字段。
- `Global.js:118-130` `ScoreChange(num,type,callback)`：数值变动接口（type 1 金币 / 2 水滴）——本作对应「金币/心」。
- `Global.js:137-142` `ShuiDiPlaneCheck` / `:150` `ShuiDiPlaneLog` / `:169` `ShuiDiPlaneList`：守约判定/记录/计划列表（后端接口，本作全部本地化）。
- `AddUpTanChuang.js` / `AddUpView.js`：累计统计弹窗（今日/本周水滴）——本作对应「今日/本周」统计与结算卡。
- `Global.js:557-590` `showAdVedio` / `:592-699` `showBanner`：微信激励视频 + Banner 广告——本作改为站点 pipysdk（`src/core/sdk.js`，`ads.enabled:false` 降级）。

## 原作的「倒水入杯动画」

- 原动画在 `assets/Prefabs/DrinkPlanItem.prefab`（Cocos prefab/动画），无独立脚本——spec 的「点击倒水入杯动画」是本作需**原创**的玩法层：按住倒水、水位上升、水温下降、到线入温松手。

## 本作映射表

| 原作事实 | 本作实现 |
| --- | --- |
| 每日 ≥4 杯目标（DrinkPlanItem.js:63） | 每天 `dayTarget` 单目标（config/tea.js `dayTargetBase`） |
| 倒水入杯动画（prefab） | 按住倒水：`src/game/sim.js` `updatePour` 水位/水温物理 |
| 完成打卡（DrinkPlanItem.js:48） | 松手结算 `commitPour`（`orderScored` / `perfect`） |
| 连续天数连击（Global.logindays/keepcount） | `combo` 连击 + 12 天经营推进 |
| 累计统计（AddUpView.js 今日/本周） | 结算卡 `result.*` + HUD 天/金币/心 |
| 提醒节奏（onClickAddRemind 空实现） | 每 5 单 `rushWave` 客流高峰 |
| 微信广告/登录/后端 | pipysdk + `Sdk.save/load/track` 统一出口 |
