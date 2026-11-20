# REEF RAIDER — 源码分析笔记

> 改造自 `local/src1/联网捕鱼-cocos/`（Cocos 捕鱼，单机化 + 原创深海烟火师主题）。
> 分析目标是「事实 + 文件:行号」，供 DELIVERY.md 与实现对齐。

## 一、原作玩法事实（带文件:行号）

### 1. 发射与金币
- `GameManager.ts:94-99` `fireBullet(angle)`：`MyGlobal.hasGold -= MyGlobal.weaponLevel`（发射消耗 = 炮台等级），再从对象池取 `Bullet` 并 `init(angle)`。
- `TouchManager.ts:25-28` 触摸射击入口：`Date.now()-lastTouchTime < 100 || MyGlobal.hasGold < MyGlobal.weaponLevel` 时直接 return——即**100ms 冷却 + 金币不足不发射**。
- `TouchManager.ts:31-51` 把触点坐标换算成角度：`weapon.angle = angle` 后 `director.emit('shoot', angle)`。

### 2. 炮弹
- `Bullet.ts:11-12` `speed=500`（px/s）；`Bullet.ts:27-29` `bounceCount=2`（可反弹 2 次）。
- `Bullet.ts:60-85` `update(dt)`：越界时 `radian=-radian` / `angle=180-angle` 反弹，`bounceCount--`；出屏 >100px 回收。
- `Bullet.ts:95-99` `getHurt()`：`ceil(Math.random()*weaponLevel*2 + weaponLevel)`——**伤害 ∈ [level, 3*level]**。

### 3. 鱼
- `Utils.ts:22-73` 10 档鱼配置：`hp 4→40`、`gold 2→30`（每档 hp+4、gold 递增）。
- `Fish.ts:32-55` `init(x,y,fishType)`：设 `hp=fishType.hp`，从 `Utils.bezierArray` 随机取一条贝塞尔曲线 `cc.bezierBy(rmdTime, rmdBezier)` 游动（`rmdTime = 8~18s`）。
- `Fish.ts:62-79` `onCollisionEnter`：`hp -= hurt`；`hp<=0` → `isLive=false`、停止动作、`createCoinUp`（飘分）、`hasGold += fishType.gold`、播死亡动画后回收并 `createGold`（金币飞向炮台）。
- `Fish.ts:81-106` `update(dt)`：按位移算 `angle`（朝向），出屏 `>半屏+50` 回收。
- `Utils.ts:11-19` `bezierArray`：7 条贝塞尔游动轨迹（鱼群游动路径）。

### 4. 炮台升降级
- `Weapon.ts:16-23` `weaponUp()`：`weaponLevel++`，>7 封顶 7；`Weapon.ts:26-34` `weaponDown()`：<1 封底 1。
- `MyGlobal.ts:24-33` 初始化：`weaponLevel=1`、`hasGold=100`、`bulletCount=0`。

### 5. 胜负
- `Utils.ts:99-101` `testGameOver()`：`hasGold <= 0 && bulletCount <= 0` → 游戏结束跳 `gameOver` 场景。
- 原版**无目标分/无倒计时/无关卡推进**，是「无限打、金币耗完即结束」的单一房间。

### 6. 鱼网/飘分/金币动画
- `Net.ts:9-19` 炮弹命中时 `Net.init(pos)` 播撒网动画（纯视觉，判定在 Fish 的碰撞里）。
- `CoinUp.ts:23-39` 捕获飘分数字；`Gold.ts:8-17` 金币从鱼处飞向目标点（0.8s tween + 缩小）。
- `NumControl.ts:16-21` 6 位金币数字（`padStart(6,'0')`）。

## 二、联网部分（全部剥离）
- `config.ts:1-5` `reqUrl:'http://127.0.0.1:8080'`；`StartBtn.ts:19-44` axios 登录 POST（`/login`）。
- 房间/排行榜/账号系统仅存在于 server 目录，客户端主流程不依赖它。本作**纯单机**，不保留任何联网调用。

## 三、改造映射（原作 → REEF RAIDER）
| 原作 | 本作 |
| --- | --- |
| 渔网 Net | 彩灯泡绽出「光网涟漪」（signature：大鱼化作灯影绕屏一圈） |
| 10 档无名鱼 | 5 种灯鱼/蝶鱼/海龟/魔鬼鱼/幽灵灯笼鱼 + 终局王 |
| 单一房间 | 12 关目标分制 + 三场景包 |
| `testGameOver`（金币+弹耗完） | 倒计时 target 分制 + 金币归零救济 |
| 炮台 1–7 级 | 炮台 1–5 档（1-5 键切换） |
| 无救济 | 金币归零一次性 +10 救济，连续零币滴灌 |
| 无连击/稀有/障碍 | 连击倍率 / 稀有幽灵灯笼鱼 / 暗礁挡弹 / 灯笼鱼王 |
