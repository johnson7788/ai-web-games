# GOBLIN MINES · 源码分析（改造自「地精旷工」Cocos Creator）

> 源码：`/Users/admin/remake-src/地精旷工creator/assets/Script/`
> 结论：原作是**三消挖矿**（swap-match-3 下挖），并非放置经营。spec 标题里「矿工放置/瓶装道具/挂机产出」是对 `List.ts`/`Bottle.ts`（通用 UI 组件）的误读；真正的玩法在 `GameWorld.ts` 的 9×9 消除 + 下挖循环。本作按「玩法规则 1:1 还原、主题全原创」改造：保留三消/资源/下挖/头目/技能，原创「地精矿镇」主题 + 矿灯配给 + 矿难事件。

## 1. 入口与场景流

- `GameStart.ts:21` — 点开始 → `loadScene('main')`。
- `MainStage.ts:23` — `gotoTheMine()` → `loadScene('mine')`（矿道关卡选择）。
- `MineStage.ts:29` — 生成 100 个深度档（`data[i] = i*10` 米），`onListRender` 按已解锁层级灰化；`MineStage.ts:64` 点击已解锁层级 → `Logic.loadGame(level)`。
- `Loading.ts:72` — 加载贴图 + 技能表（`Data/skills.json`）后 `loadScene('game')`。

## 2. 全局状态 `Logic.ts`

- `Logic.METRE_LENGTH = 10`、`Logic.MAX_STEP = 15`（`Logic.ts:19-20`）。
- `Logic.reset()`（`Logic.ts:61`）：`step = MAX_STEP(15)`、`currentMeter = 0`、`coin`/`level` 从 `ProfileManager` 读档。
- `Logic.needBoss()`（`Logic.ts:73`）：`currentMeter >= 10` 时出现头目。
- `Logic.saveData()`（`Logic.ts:79`）：过关后保存 `level` 与 `coins`（本地存档 → 对应本作「离线收益/存档结算」）。

## 3. 棋盘与下挖 `GameWorld.ts`

- 9×9 网格、`TILE_SIZE = 64`（`GameWorld.ts:39-42`）；底部 `OBSTACLE_HEIGHT = 4` 行为障碍带。
- `initMap()`（`GameWorld.ts:68`）：填随机矿石 + 顶部障碍；`j < OBSTACLE_HEIGHT` 放障碍（`GameWorld.ts:77`），`i>2 && i<6 && needBoss()` 放头目格（`GameWorld.ts:79`）。
- 交换 `tileSwitched()`（`GameWorld.ts:294`）：相邻交换、判定 `getBoomList`；有消除 → `Logic.step--`（`GameWorld.ts:324`）+ `boomTiles`；无消除 → 换回（`GameWorld.ts:329`）。
- 消除结算 `boomTiles()`（`GameWorld.ts:337`）：按 `tileSpecial`（普通/横四/竖四/十字/五连，`Tile.ts:31-34`）乘倍率；按 `tileType` 累加红/蓝/紫/绿/油/金币（`GameWorld.ts:358-385`），受 `elements.*max` 上限（`Elements.ts:1-13`）。
- 下落/填充 `fallTiles()`/`fillTiles()`（`GameWorld.ts:438/464`）；空盘 `fillAfter()`（`GameWorld.ts:516`）：`step<1` 判负（`GameWorld.ts:518`）、`currentMeter > METRE_LENGTH` 判胜（`GameWorld.ts:525`）、否则 `downMap()`（`GameWorld.ts:528`）或 `boss.bossAction()`（`GameWorld.ts:531`）。
- `downMap()`（`GameWorld.ts:191`）：`currentMeter += 6`、`step += 3`，整盘下移并生成新障碍带。

## 4. 矿石与障碍 `TileData.ts` / `Tile.ts`

- 6 类矿石 `RED/BLUE/PURPLE/GREEN/OIL/COIN`（`TileData.ts:4-11`）；`OBSTACLE`（`TileData.ts:12`）、`BOSS`（`TileData.ts:13`）。
- `getRandomTileData`（`TileData.ts:59`）：随机 `tile001..tile006`（`Random.getRandomNum(1,6)`）。
- 障碍/冻结/头目字段：`obstacleLevel`（需几次消除）、`frozenLevel`（冻结不能下落）、`isBoss`（`TileData.ts:19-23`）。
- 触屏交换 `Tile.ts:57-78`：拖拽方向判定 `|end.x|>|end.y|` → 左右 / 上下换（`Tile.ts:67-70`）→ 发 `TILE_SWITCH`。

## 5. 头目 `Boss.ts`

- 血量 `currentLevel*10`（最低 5，`Boss.ts:43`），3×3 占位（`Boss.ts:53`）。
- `takeDamge()`（`Boss.ts:56`）：被相邻消除炸到扣血；击杀 → `step += 3`（`Boss.ts:71`）+ 清 boss 格。
- `bossAction()`（`Boss.ts:106`）：每回合（未受击时）按 `data.id` 加障碍或冻结（`Boss.ts:115-125`）。

## 6. 技能 `SkillManager.ts` / `SkillIcon.ts` / `skills.json`

- `resources/Data/skills.json` 定义 4 技能：燃油充能（3 油→+1 步）、TNT（选格 3×3 引爆）、燃油收集（收全盘油）、精准采集（选格 2× 产出）。
- `SkillManager.doOperator()`（`SkillManager.ts:15`）：先 `Logic.updateElements(消耗)` 校验，再按 `resName` 分支。
- `SkillIcon.ts:47-80`：长按看说明、点击/选中/滑动三种触发（`operator` 0/1/2）。

## 7. 存档 `ProfileManager.ts`

- `getSaveData/saveData`（`ProfileManager.ts:29-38`）：`localStorage['goblindata']` 存 `{coins, level, skillList}`——对应本作 `bestShaft` + `bank` 持久化与离线收益。

## 8. 改造映射（原作 → GOBLIN MINES）

| 原作规则 | 本作还原 |
| --- | --- |
| 9×9 相邻交换凑 3+ 消（`GameWorld.ts:294`） | `sim.js` `doSwap` + `findMatches` |
| 4 类矿石/油/金币 + 上限（`GameWorld.ts:358`） | `resources` + `CAPS`（config/gameplay.js） |
| 步数 15，成功消 -1、下挖 +3、击杀 +3（`Logic.ts`/`GameWorld.ts`） | `MOVES` |
| 下挖 `currentMeter += 6` 解锁更深矿层（`GameWorld.ts:191`） | `doDig` + `LEVELS`（12 矿道） |
| 每 10m 头目 + bossAction（`Boss.ts`） | 偶数矿道末层头目 |
| 4 技能（skills.json） | `doSkill`（config/gameplay.js `SKILLS`） |
| 本地存档 level/coins（`ProfileManager.ts`） | `bestShaft`/`bank` + 离线收益 |

**原创差异（spec 要求）**：矿灯配给（地精照亮列 → 该列产出加成 + 挂机产出）、矿难事件（加固 vs 赌运气，扣安全度）、三套场景色板（萤石洞紫 / 铜镇橙 / 深渊竖井蓝黑）、矿车车灯拖尾 signature。
