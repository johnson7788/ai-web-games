# 源码分析 — hero-vanguard（改造自「英雄大战外星人」）

源码路径：`/Users/admin/remake-src/yxdzwxr-client-2-0-8-英雄大战外星人/yxdzwxr_client-2.0.8-英雄大战外星人/`
（Cocos Creator 2.0.8 + TypeScript，入口 `game.js` / `game_tt.js`）

## 0. 原作是什么

原作为**纵向「发射-弹跳-摧毁元素」**玩法：英雄从底部被「发射」出去，像弹球一样在竖屏地图里弹跳、下落攻击摧毁地图元素（外星士兵/火车/弹簧/Boss），弹尽/落地后进入结算，再靠金币/英雄养成推进关卡（customspass）。spec 把它改造成**双子英雄轨道站防线（放置防御）**——保留原作「英雄自动攻击、技能按钮 CD、敌波推进、击杀得金币升级、Boss、基地破即败」的骨架，但玩法规格按 spec 的 P0 重新定义。

## 1. 入口 → 主循环 → 输入

- 场景入口 `assets/Script/scene/game/game.ts:159` `onLoad()`：`initUI()` → `selectHero()` → `initGame()` → `initGuide()` → `createElsePrefab()`。
- 主循环 `game.ts:387` `update(dt)`：按 `GAME_STATE` 分发，`PLAYING` 时调 `logic.update(dt)`（`assets/Script/scene/game/logic.ts:168`）→ `updatePlaying(dt)`（`logic.ts:277`）。
- 输入 `game.ts:272` `onTouch()`：READY 状态点按 = 开始游戏；否则 `logic.onTouch()`（`logic.ts:118`）→ `dropAttack()`（`logic.ts:138`）。原作是**点按=下落攻击**，没有 WASD/摇杆——这是 spec 改造点。

## 2. 判定 / 碰撞

- 下落落地判定 `logic.ts:413` `STATE.DROP` 分支：`roleZ <= 0` 落地 → `destroyAtkAreaElement()`（`logic.ts:594`）。
- 摧毁判定 `logic.ts:594` `destroyAtkAreaElement()`：以英雄落点为中心 `circleIntersectRect` 判交（`logic.ts:563`），对 `element_list` 逐个 `beDestroy()`；火车（type 1002）需精确撞头/撞身（`logic.ts:632-656`）。
- 攻击范围提示 `logic.ts:718` `checkAtkArea()`：范围内元素变红。
- 过关判定 `assets/Script/scene/game/map_node.ts:453` `checkPass(dis)`：距离超过关卡 `distance` 后 Boss 销毁 → `initLevel()` 进下一关。

## 3. 关卡 / 敌人 / 生成

- 关卡表 `assets/resources/json/customspass_customspass.json`（`monsterID` / `monsterpro` / `Springdis` / `traindis` / `distance`）。
- 敌人表 `assets/resources/json/monster_monster.json`：`id/type/gold/monstersize/monsterseat/isdestroy/zoom` 等字段；Boss 判定 `element.ts:218` `isBoss()`（`type 34/35/36`）。
- 地图生成 `map_node.ts:510` `createMap(row=30)`：按格子铺元素，`ranElement()`（`map_node.ts:660`）按权重表随机选敌人，`createBoss()`（`map_node.ts:415`）在过关点生成 Boss。
- 元素行为 `assets/Script/element/element.ts:232` `update_element(dt)`：铁路（1001）定时生成火车、火车（1002）横移；`element.ts:127` `beDestroy()` 分发金币/碎片/弹簧/火车/Boss 死亡。

## 4. 经济 / 成长

- 击杀金币 `game.ts:638` `addGold(e)`：`怪物金币=[1+(关卡等级-1)*关卡金币参数/100]*怪物大小*(1+怪物参数/10000)`。
- 结算金币 `game.ts:617` `getAccountGold()`：`∑怪物金币*(1+∑atk_gold_per/10000)+∑atk*攻击力金币参数/100`。
- 英雄养成表 `assets/resources/json/heroskills_hero.json`：`att/range/speed/gold/shelvegold` + 各成长 `*up` 字段（千分比成长）。
- 技能表 `assets/resources/json/heroskills_herosklillprobability.json` / `heroskills_consume.json`。

## 5. 技能 / 状态机

- 角色状态 `assets/Script/config.ts:37` `STATE`（IDLE/JUMP/MAX_JUMP/FIRST_JUMP/DROP/HIT_GROUND/MOVE/USE_SUPER_SKILL）与阶段 `config.ts:58` `STAGE`。
- 大招 `assets/Script/element/role.ts:374` `toUseSuperSkill()`：hero 7/8/9 分别走 `skill_7.ts`（英雄不灭）/ `skill_9.ts`（英雄冲锋）/ `skill_default.ts`（英雄撞击）。
- 技能类实现 `assets/Script/skill/skill.ts`（基类）+ `skill_7.ts` / `skill_9.ts` / `skill_default.ts`。
- 物理数值表 `assets/resources/json/game_config.json`（`elastic_force` / `gravity` / `speedValue` / `maxJumpSpeed` 等）。

## 6. UI / 面板

- 主界面按钮 `assets/Script/panel/btnui_panel.ts`（签到/英雄/商城/排行/成就/转盘/冲关）。
- 战斗 HUD `assets/Script/panel/above_panel.ts`（能量条/金币/关卡）。
- 结算 `assets/Script/panel/settlement_panel.ts`。
- 新手引导 `assets/Script/panel/game_guide/game_guide_panel.ts` + `guide_1..8.ts`（原作是**图+手指动画**引导，spec 要求改成交互式真实操作引导）。

## 7. 映射到 spec 的改造决策

| 原作事实 | spec 改造后 |
| --- | --- |
| 发射-弹跳下落（role.ts `startRun/toJump/DROP`） | 双子英雄 WASD/摇杆移动 + 自动攻击 |
| 大招 hero 7/8/9（role.ts `toUseSuperSkill`） | J=共鸣斩 / K=护盾充能 / Tab/Q=换位共鸣 |
| 火车/弹簧/士兵/Boss 地图元素 | 蜂群/重甲/自爆/护盾兵/Boss 敌波 |
| 金币成长（game.ts `addGold` + hero 表） | 击杀得金币 → 波间三选一升级 |
| customspass 关卡推进 | 12 波推进 + 三场景包 |
| Boss `type 34/35/36`（element.ts `isBoss`） | 每 4 波 Boss |
| 原作图+手指引导 | 3 步真实交互引导（move→kill→resonance） |
