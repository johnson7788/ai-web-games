# PLUMBER RUN · 源码分析（参考 Cocos 超级马里奥）

> 改造自 `/Users/admin/remake-src/超级马里奥creator/`（Cocos Creator 2.2.2）。
> 原则：玩法规则 1:1 还原，角色/场景/音乐全原创；IP 全部换皮（水管工/蘑菇/库巴 → 蒸汽都市修理工「阿扳」/管道怪兽/原创世界观）。

## 1. 入口与主循环

- 工程入口 `project.json`：引擎 cocos-creator-js 2.2.2，起始场景 `logo`（`settings/project.json:start-scene`）。
- 设计分辨率 960×640（`settings/project.json:design-resolution-width/height`），游戏内用 40px 瓦片 × 16 行 ≈ 640 高（`assets/script/mapMgr.js:130-135`）。
- 主逻辑由 `assets/script/gameMgr.js` 装配：`onLoad` 初始化 `player/map/monster/prop/pos` 各 manager（`gameMgr.js:46-57`），`update` 里做地图跟随（`gameMgr.js:126-151`）。
- 计时器 `globalMgr.time` 初始 300s，`gameMgr.readTime()` 每 0.5s 减 1（`gameMgr.js:111-120`），撞旗杆后停止读秒（`collsiFlag` → `unschedule(readTime)`）。

## 2. 输入与角色状态机

- 玩家输入：`player.js:167-202` 监听 KEY_DOWN/KEY_UP，按键 `k` 跳、`a/d` 左右、`s` 下蹲、`j` 加速/发射。
- 状态机 FSM（`state/FSM.js`），玩家状态定义在 `state/playerState.js`（1576 行）：
  - `Stand` / `Walk` / `Jump` / `Fall` / `Slide` / `Squat` / `Fire` / `Swim` / `Float` / `Climb` / `Die` 及三态变身 `ToBig` / `ToSmall` / `FlashCatch*`。
  - 跳跃「长按高跳」：`Jump.handleInput` 在 keyup 时把 `vCurrAcceleration` 调到最大下落加速度 `vMaxAcceleration`（`playerState.js:131-140`），松手即加速下落，实现变高跳。
  - 形态三态 `FORM_STATE.SMALL/BIG/FIRE`（`enum.js:30-34`）。
- 物理常量在 `player.js:34-54`：跳跃初速 660、加速初速 744、重力 -3800/-1320、水平加速 250/640、速度上限 220/320。

## 3. 碰撞与瓦片

- 瓦片类型 `TILE_TYPE` / `GID`（`enum.js:36-66`）：LAND/WALL/QUESTION/COIN/HIDE_QUESTION/FLAG/PIPE_H_ENTRY/PIPE_V_ENTRY。
- 碰撞检测在 `actor.js:57-109`：上/下/左/右四点采样 → `mapMgr.getObstacleTileAt` 取瓦片类型（`mapMgr.js:137-160`）。
- 顶砖出道具：`mapMgr.pushQuestion`（问号砖，`mapMgr.js:260-277`）与 `pushWall`（普通砖，大形态可顶碎，`mapMgr.js:283-324`）、`collsiCoin`（金币，`mapMgr.js:327-331`）。
- 旗杆过关：`player.collsiFlag`（`player.js:427-440`）→ `EM.COLLSI_FLAG` → `mapMgr.riseWriteFlag`（升白旗）→ `globalMgr.nextRound()` + `GAME_PASS`（`mapMgr.js:97-105`）。

## 4. 敌人与踩踏

- 敌人种类 `MON_TYPE`（`enum.js:70-87`）：蘑菇怪/鸭子/花/火球/Boss/头盔/鱼/章鱼/忍者/刺猬/…。
- 蘑菇怪 `monster/mushroom.js`：`interactive(actor)` 实现「踩到头部 → flat 死亡 + 反弹；侧面 → 大形态变小 / 小形态死」（`mushroom.js:53-83`），`collsiDown` 落地（`mushroom.js:164-174`），`changeDir` 撞墙掉头（`mushroom.js:192-197`）。
- 怪物管理 `monsterMgr.js`：对象组按屏幕出现逐批实例化（`iteratorMonsterObjects`，`monsterMgr.js:208-218`），碰撞遍历（`monsterMgr.js:181-197`）。

## 5. 道具与状态

- `propMgr.js:73-148` 按对象组 `createProp` 生成道具：蘑菇 `mush`（小→大）、花朵 `flower`（大→火力）、星星 `star`（无敌闪烁）等。
- `prop/mush.js:73-87` 拾取：小形态 `to_big`；`prop/flower.js:51-68`：小→大、大→火力、火力→加分。

## 6. 卷轴与相机

- `gameMgr.update`：玩家世界坐标越过 `flag+offset` 就左移地图（`gameMgr.js:126-137`）。
- `posMgr.js`：出生点/终点/地图固定点/管道传送（`posMgr.js:31-59`、`81-127`）。

## 7. 改造映射（原版 → PLUMBER RUN）

| 原版 | 本作 |
| --- | --- |
| 横版卷轴跑跳（长按高跳） | `src/game/sim.js` 物理：`GRAVITY_RISE` vs `GRAVITY` 实现长按高跳 |
| 顶 ? 砖出道具（小→大→火力） | `bump()`：`?` 砖出 `M`(扳手包)/`F`(蒸汽齿轮)，三态 `FORM.SMALL/BIG/FIRE` |
| 踩敌人 | `collideEnemies()`：`p.vy>0 && 脚在敌人中线以上` → stomp |
| 掉坑/碰敌人损命 | `killPlayer('pit'|'enemy')`，大/火力形态碰敌变小 |
| 隐藏金币砖 | `C` 金币砖（顶出金币） |
| 旗杆跳分过关 | `checkFlag()` + `clearLevel()`（3 星：金币/时间/无伤） |
| 地下关（管道进入） | 三场景包 theme 轮换（下水道/夜工厂）替代 |
| 火力态 | 原创「蒸汽喷射」悬停：`FIRE_HOVER_GRAV` 按住跳缓降 |
| —（原创） | 扳手回旋（去程/回程双伤敌）+ 蒸汽罐（满罐高跳+悬停） |

## 8. 原创差异化落点

- **扳手回旋**：`updateWrench()` 去程到射程掉头，回程路径也伤敌（`WRENCH.RANGE=340`，短手约束）。
- **蒸汽罐**：`S` 拾取充能（`STEAM.PICKUP=25`），满罐按 steam 触发 `steamBurst`（高跳 + `STEAM.HOVER_SEC` 悬停）。
- **三场景包**：`src/render/theme.js` 晨市屋顶（暖）/下水道（青绿）/夜工厂（靛红），换章换色板+构图+装饰。
- 角色「阿扳」程序化绘制（青蓝工装+橙色安全帽+护目镜），完全原创，无任何原作形象/名称。
