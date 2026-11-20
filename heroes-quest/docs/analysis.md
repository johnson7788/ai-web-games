# 源码分析 — heroes-quest（改造自 Heroes 精品游戏）

> 源码路径：`/Users/admin/remake-src/Heroes-精品游戏/Heroes/`（Cocos Creator 工程）
> 本文件记录「玩法基线」的事实与改造决策，改造原则：玩法规则 1:1 还原品类、角色/场景/音乐全原创。

## 1. 侦察结论：原作是什么

原作是一款 **网格地图上的小队战术 RPG**（Heroes 系），不是消除+RPG、也不是战报制回合。核心事实（带文件:行）：

- 入口 `Main.js`（`assets/scripts/game/Main.js:16-44`）：持久根节点，读 `GameSetting` 存档。
- 战斗场景 `scenes/SceneGame.js:21-33`：`world.init()` 后 `showPlot(PlotConfig.startPlot)`，剧情结束后才开启输入（`inputHandler.active`）。
- 世界装配 `ingame/HosWorld.js:44-53`：`init()` → `tildMapCtrl.init('maps/map_2_region_10')` → 雾系统 → 英雄 → A* 图搜索。
- 网格地图 `ingame/TiledMapControl.js:77-80`：可走性由 `Background` 层 tile 属性 `/m/`（move）+ `Foreground` 层空 gid 决定；`isBlockViewAt` 控制视线阻挡。
- 角色移动 `ingame/CharacterControl.js:38-49`：`moveTo` 按 360px/s 走格子，`rotateTo` 面向目标。
- 寻路 `ingame/HosWorld.js:118-167`：`traverseGridPath` 沿 A* 路径逐格走，`onAfterEnterGrid` 揭示雾、`onAfterExitGrid` 盖回雾。
- 英雄管理 `ingame/HeroesManager.js`：`selectNextHero / glomHeroes`（glom 未实现，是 TODO）。
- 剧情 `config/PlotConfig.js:236-325`：脚本命令 `CHAR_ADD / CHAR_FOLLOW_PATH / CAM_MOVE_ON / MAP_REPLACE_TILE / SYS_SHOW_DIALOG`，开场是「囚犯劫狱」多英雄对话（Thief/Wizard/Cleric/Outlander）。
- 技能 `ingame/talents/*`（`Talent.js / TalentExecutor.js / TalentSteps.js / wizard/TalentFirebolt.js`）：仅有骨架，实际技能数据在 `.fire` 场景/prefab 里，源码未展开战斗判定。

**结论**：原作是「多英雄 + 网格移动 + 雾 + 剧情演出」的战术 RPG 骨架；可确认的玩法基是**小队英雄在地图上移动、切换英雄、逐步揭示战场**，战斗判定大多落在未导出的场景数据里。因此 spec 的兜底方案（回合制三英雄 vs 敌阵：速度条 + 技能 CD）即是对「英雄小队战术战斗」品类的忠实还原。

## 2. 我的改造落点（原创）

| 原作事实 | 我的原创改造 |
| --- | --- |
| 多英雄切换走网格 | 三英雄编队走 **分支远征地图**（12 节点：战斗/事件/休整/精英/Boss） |
| 英雄各司其职（Thief/Wizard/Cleric…） | 全新三英雄：**Kael 先锋 / Syl 游侠 / Nyx 先知**（承伤/输出/治疗） |
| 无明确资源循环 | **行军粮草**：每走一节点耗粮，战斗胜利抢粮 → 路线规划 |
| 无阵位 | **前/中/后三列阵位**：战前布阵，前排承伤、后排受保护（随敌型调整） |
| 技能骨架 | **速度条 + 技能 CD** 回合战斗 + 三英合击技 **「远征军势」**（signature） |
| 单一地牢场景 | **三场景包**：绿野（青）/ 雪原（白蓝）/ 灰烬（暗红），换章换色板+构图+装饰 |

## 3. 关键决策

- **P0 还原**：按「英雄小队战术战斗」还原为回合制三英雄 vs 敌阵（速度条 + 技能 CD），符合 spec 兜底方案。
- **推进结构**：12 列节点 = 12 关等价推进（`config/levels.js`），`levelsReached` 即已完成节点数。
- **bot 契约**：greedy「打弱节点 + 残血休整」实测走完 10 节点（≥ 第 3 节点），random 乱按会死（deathPresence 达标）。

## 4. 事实基线文件索引

- 入口/状态机：`src/main.js`
- 纯逻辑：`src/game/sim.js`（远征状态机）、`src/game/battle.js`（速度条战斗）
- 配置：`config/gameplay.js`（英雄/敌人/阵位/粮草/升级）、`config/levels.js`（12 节点地图 + 三章）
- 测试：`tests/battle.test.mjs` + `tests/sim.test.mjs`（27 条纯逻辑）
