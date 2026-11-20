# 源码分析：FC坦克大战（Battle City）→ IRON SIEGE

源码目录：`/Users/admin/remake-src/FC-坦克大战creator/assets/scripts/`
（Cocos Creator + TypeScript，`assets/scripts/Game/*.ts` 是玩法核心，`assets/maps/*.txt` 是 26×26 关卡文本。）

> 原则：「玩法规则 1:1 还原、角色/场景/音乐全原创」——本文只记**规则事实**（带 文件:行号），
> 结论落到原创改造（蒸汽朋克要塞）在 `src/game/sim.js` 的对应实现。

## 1. 世界常量（Globals.ts）

`Globals.ts:14-46` 定义了全部战场常量：

- `BLOCK_SIZE = 8`，`TANK_SIZE = 16`（坦克=2×2 半格），`MAP_WIDTH = MAP_HEIGHT = 208`（26×26 半格，等价 13×13 坦克格）。
- `TB_INIT_POWER=0 / TB_FAST_POWER=1 / TB_DOUBLE_POWER=2 / TB_STONE_POWER=3 / TB_FOREST_POWER=4`：火力等级。
- `ENEMIES_COUNT = 10`（每关敌人总数），`ENEMY1/2/3 = v2(8/104/200, 200)`（顶部三处生成点），`PLAYER1 = v2(80, 8)`（底部熔炉左下方出生点）。
- `MAX_LEVEL = 36`（原关卡数）。

→ 我的映射：`config/gameplay.js` 的 `MAP` / `PLAYER` / `ENEMY_SPAWNS` / `FURNACE`；战场 26×26 半格、坦克 16 单位、三生成点、玩家出生点全部照搬，缩放为 3×（画布 624px 战场）。

## 2. 入口与主循环（Game.ts）

`Game.ts:159-165 gameLoop()` 固定步长 `dt=0.018`，驱动 `mapLayer.onUpdate(0.02)`（每帧更新玩家/敌人/子弹/道具）。`Game.ts:229-255 showStage()` 预加载地图 `mapLayer.init()` → 初始化信息栏 → `mapLayer.spawn()` 启动生成。`Game.ts:87-123 gameOver()` 基地被毁后播放结算动画。

→ 映射：`src/main.js` 的 60Hz 固定步长累加器 + `src/game/sim.js` 的 `step()`；`Game.ts` 的状态机被我的 `phase: title|playing|paused|dead|win` + `window.__ll` 契约替代。

## 3. 地图加载（MapLayer.ts:_loadMap）

`MapLayer.ts:341-400` 读 `assets/maps/<level>.txt`（26×26=676 字符），字符→方块：

- `'3'` → `block_wall`（砖墙，可毁）　`'5'` → `block_stone`（钢墙，不可毁）
- `'1'` → `block_forest`（草丛，前层遮挡）　`'4'` → `block_river`（水面，不可通行）　`'2'` → ice
- 地图文件是 26 行 26 字符，`data[index++]` 逐格解析；基地老鹰在 `blockTrans[0][12]/[0][13]/[1][12]/[1][13]`（底部中央 2×2 格）。

→ 映射：`config/levels.js` 的 `buildMap()` 程序化生成 26×26 网格（三场景：旷野/雪原/熔城），保留砖/钢/草丛/水面四类方块；老鹰改为「核心熔炉」`FURNACE`（2×2 格底部中央，`config/gameplay.js`）。

## 4. 移动与碰撞（BaseTank.ts）

`BaseTank.ts:32-37 offsetMap` 定义四个方向的「3 宫格」快速碰撞探测偏移；`BaseTank.ts:76-98 _fastIsDirCollisionWithBlock()` 只查移动方向上的 3 格，命中 `block_wall/block_stone/camp/block_river` 即判定碰撞；`BaseTank.ts:148-191 _isCollisionWithTank()` 坦克互撞；`BaseTank.ts:193-198 _adjustPosition()` 转向时把坐标吸附到 8 的整数倍（对齐半格）。

→ 映射：`src/game/sim.js` 的 `collides()` / `moveTank()`（中心点坐标 + AABB + 网格检测 + 坦克互撞，并额外修复了「已重叠坦克无法分离」的死锁：允许重叠坦克彼此让位）。

## 5. 玩家（PlayerTank.ts）

- `PlayerTank.ts:225-255 _onKeyDown`：`W/A/S/D` 移动、`J` 开火、`K` 连发、`L` 生成道具。
- `PlayerTank.ts:55-61 shoot()`：`createBullet(this.dir, pos, Math.min(5,(this.level+1)*2), this, this.level)`（弹速与火力挂钩）。
- `PlayerTank.ts:63-93 disBlood()`：受击扣命→无敌→`reset()` 回出生点；命尽 `gameOver()`。
- `PlayerTank.ts:172-184 changeLevel()`：星形道具提升火力，跨 `TB_DOUBLE_POWER` 时并发弹数 +1。

→ 映射：`src/game/sim.js` 的 `updatePlayer()` / `respawnPlayer()` / `playerDie()`；操作扩展为 方向/WASD 移动、空格/J 主炮、K 重炮、E 焊修；火力表见 `config/gameplay.js` 的 `FIREPOWER`。

## 6. 敌人（EnemyTank.ts）

`EnemyTank.ts:26-30 onUpdate()` 移动速度 `36 + 6*(level==2)`（快速兵）。`EnemyTank.ts:32-64 init()`：`level = randInt(1,5)`，`blood = level==4 ? 3 : 1`（重甲 3 血），`isProp = level>=5`（补给车掉道具）；`EnemyTank.ts:43-61` 每 0.2s 换向、每 0.5s 随机 50% 开火；`EnemyTank.ts:142-162 disBlood()` 受击掉血/死亡掉道具。

→ 映射：`src/game/sim.js` 的 `updateEnemies()` / `spawnEnemy()`；敌人类型简化为 普通/快速/重甲/补给车 四类，按波配比（`config/levels.js` 的 `WAVES`）。

## 7. 子弹（Bullet.ts）

`Bullet.ts:84-117 onUpdate()`：`realStep = step*50*dt`；碰撞顺序 = 边界 → 方块 → 坦克 → 子弹互抵。`Bullet.ts:139-188 _fastIsCollisionWithBlock()`：砖墙被低火力子弹逐子块破坏（`BlockWall.tryDestory`）、高火力（≥TB_STONE_POWER）直接摧毁；钢墙仅玩家高火力可破；命中 `camp` 触发 `BlockCamp.tryDestory()`。`Bullet.ts:291-316 _isCollisionWithBullet()` 玩家子弹与敌弹互抵。

→ 映射：`src/game/sim.js` 的 `stepBullets()` / `resolveSpawnCell()` / `collideBullets()`；**原创改造**：主炮无限但不可破钢墙，破钢墙唯一手段是限量「重炮弹」（每波 2 发，`config/gameplay.js` 的 `HEAVY`）——这是本作的核心差异点。

## 8. 基地 / 砖墙 / 道具（BlockCamp / BlockWall / Prop）

- `BlockCamp.ts:20-28 tryDestory()`：基地被任何子弹命中即换爆炸贴图并触发 `Game.gameOver()`。
- `BlockWall.ts:19-50 tryDestory()`：砖墙由 4 个子块组成，子弹命中即点亮一个子块，全亮则整块消失。
- `Prop.ts:26 events` = `['life','power','pause','bomb','fence','invincible']`（加命/火力/时钟静止/炸弹清屏/铲子加固/无敌）；`Prop.ts:48-63` 随机位置 + 闪烁 + 10s 消失 + 玩家拾取判定；`Prop.ts:80-87 effective()` 派发 `gameEvent`。
- `MapLayer.ts:205-259`：`pauseAllEnemy`（时钟静止 8s）、`killAllEnemy`（炸弹）、`reinforceFence`（铲子加固围栏）。

→ 映射：`src/game/sim.js` 的 `hitFurnace()`（熔炉受击掉血 + 红色报警脉冲 signature）、`applyProp()`（星核/震爆弹/装甲板/时间冻结，对应 power/bomb/fence/clock）；**原创新增「焊修」**：每关 1 次修复熔炉砖墙，代价是本波敌人提速（`REPAIR`）。

## 9. 信息栏（UpdateInformations.ts）

`UpdateInformations.ts:29-45 init()`：敌人数 `ENEMIES_COUNT` 以 2 列图标展示，每生成一个敌人 `deleteOneIcon()` 删一个图标；`updatePlayerBlood()` 更新剩余命数。

→ 映射：`src/ui/hud.js` 的右控制台 HUD（波次/命数/火力/重炮弹/分数/熔炉血条/剩余敌人数）。

## 10. 关卡推进

`MapLayer.ts:155-163 checkLevelUp()`：场上敌人清空且待生成数归零 → `toNextStage()`；`MapLayer.ts:326-339 toNextStage()` 关卡 +1 并 `gameStart()`。

→ 映射：`src/game/sim.js` 的 `checkWaveClear()` / `chooseUpgrade()`。**原创改造**：12 波（三场景 × 4 波），波间二选一强化（火力/速度/护甲/弹药+），取代原作的线性 36 关。
