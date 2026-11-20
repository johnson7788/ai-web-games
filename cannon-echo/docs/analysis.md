# CANNON ECHO — 源码分析（startwar 星战炮台）

> 改造自 `/Users/admin/remake-src/startwar-源码/`（Cocos Creator 2.x）。原则：玩法规则 1:1 还原，角色/场景/音乐全原创。
> 分析聚焦 `Cannon / CannonFactory / BoxFactory / Box / Bullet / Aim / Game` 与 `cannonJson.json`。

## 1. 入口与主循环

- `assets/src/Game.js:38-44` `onLoad`：注册全局单例 `cc.MainGame`、`cc.bulletFactory`、`cc.boxFactory`、`cc.cannonFactory`、`cc.touchAim`，初始化分数/星星，开启 BGM。
- `assets/src/Game.js:46-52` `start`：首局拉起 `Guide`（新手引导），读存档恢复炮台位置。
- 炮台自动开火逻辑在 `Cannon.js` 的 `update` 里用 `fireInterval` 计时器驱动，没有独立主循环的射击调度。

## 2. 炮台（Cannon）

- `assets/src/Cannon.js:10-13` `setConfig`：按 `level` 从 `cannonJson.json.cannons[level-1]` 读数值（`fireInterval` / `attack` / `bulletCount`），切炮台贴图。
- `assets/src/Cannon.js:27-45` `normalCannonUpdate`：触摸瞄准时 `getTargetRotation(touchPos)` 实时转角；未触摸时 `findTarget()` 自动锁定最近盒子；每 `fireInterval` 到点按 `bulletCount` 发弹，速度经 `setSpeedByrotation` 用角度分解。
- `assets/src/Cannon.js:84-90` `getTargetRotation`：`atan(o/n)` 求瞄准角（n<0 补 180°）。
- `assets/src/Cannon.js:101-106` `levelUp`：升级换皮 + 存档 + 最高等级广播。
- `assets/res/JsonAsset/cannonJson.json:1-393`：30 级炮台表（attack 10 → 1740355、fireInterval 1 → 0.2）。**CANNON ECHO 压缩为 12 级**，保留「威力 + 射速」两轴成长。

## 3. 目标盒（Box / BoxFactory）

- `assets/src/Box.js:9-13` `setConfig`：`hp = 10 + 5*pow(3.5, t)`，`score = hp*pow(1.2, t)`，7 列 x 坐标 `[-420,-280,-140,0,140,280,420]`。
- `assets/src/Box.js:22-24` `attacked`：扣血 → 死亡回收 + `addScore(3*score)` + `breakBox`（震屏/粒子）。
- `assets/src/BoxFactory.js:14-23` `createrStartBoxs` / `createrLineBoxs`：开局 4 行 + 每 2 秒补一行；`getRandomNum` 随机挑 7 列中不重复的 3–7 列。
- 盒子持续下移（`BoxFactory.js:30-32` `moveBy` repeatForever）。

**CANNON ECHO 改造**：原作盒子纯下坠、无类型。我们保留「7 列下坠 + HP + 命中得分 + 波次过场」，并原创 5 种目标型（慢速箱/俯冲群/护盾补给箱/装甲箱/Boss），对应 12 波推进结构。

## 4. 炮弹（Bullet / BulletFactory）

- `assets/src/BulletFactory.js:15-19` `getBulletByLevel`：按等级取弹 + 初始 `linearVelocity=(0,1000)`。
- `assets/src/Bullet.js:5-9` `setConfig`：绑定攻击力，5 秒后回收。
- `assets/src/Bullet.js:11-22` `onBeginContact`：命中盒子 → `attacked(attack*加成)`；命中 tag3 → 回收；其它 → 反弹（`setSpeedByrotation` 预留，原作为空实现）。

**CANNON ECHO 的「回声」正是把原作空实现的反弹做实**：弹打到左右崖壁后转为水平横扫（vy=0），伤害按衰减系数递减，可反弹打掩体后目标。

## 5. 输入（Aim / TouchEvent）

- `assets/src/Aim.js:12-26`：触摸开始/移动把屏幕点转成世界坐标写进 `cc.touchAim.touchPos`；越界（x< -540 或 x>540 或 y 越界）则 `isTouch=false`。

**CANNON ECHO**：指针/触摸瞄准 → `run.step({aimX, aimY, fire})`；触屏按住 = 持续开火（过热锁管）。

## 6. 成长 / 升级

- `assets/src/Game.js:188-190` `getCannonPrice`：买炮价格 `100*pow(4, level-1)`，同 Level 重复购买价递增。
- `assets/src/Game.js:181-187` `buyCannon` / `setNextPrice`：金币购买更高级炮台。
- `assets/src/Game.js:139-149` `breakBox`：击破 10 盒攒进度条 → 段位晋升（`promotion`）。

**CANNON ECHO 改造**：把「买炮 + 段位」改为 **每波三选一升级**（10 项，规则型 6 项 = 60%），更符合网页游戏节奏。

## 7. 结论（映射到 CANNON ECHO）

| 原作事实 | CANNON ECHO |
| --- | --- |
| 底部炮台跟随指针/触摸瞄准 | ✅ `run.angle` 由 `aimX/aimY` 计算 |
| 炮弹有弹速与飞行时间 | ✅ `BULLET.SPEED=1050`，炮弹逐 tick 位移 |
| 目标盒 7 列下坠、HP、命中得分 | ✅ 7 列 + 5 目标型 + 波次 |
| 炮台等级（威力/射速） | ✅ 12 级 + 三选一升级 |
| 波次过场（原作每 2s 补一行） | ✅ 12 波结构 |
| 原作空实现的反弹 | ✅ 崖壁回声横扫（原创 signature） |
| — | ✅ 原创：过热锁管（连射节奏管理） |
