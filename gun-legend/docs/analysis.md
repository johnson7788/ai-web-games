# 源码分析：枪神之神（Cocos Creator）→ GUN LEGEND

> 源码根：`/Users/admin/remake-src/cocos-creator-枪神之神/qszs/assets/src/`
> 结论：原作是一款**弹道反射解谜射击**（瞄准 → 子弹撞墙反弹最多 20 次 → 命中所有「受苦者」且避开「VIP」），不是动作清关。本作按 spec 把「瞄准/开火/弹道/命中判定」还原为**港片巷战双枪清关**，其余为原创改造。

## 1. 射击核心（事实，带 文件:行号）

- **瞄准**：`Gunner.js:28-33` `onTouchStart` 记录 `gunPos`/`gunDir`，`handGun.angle = -signAngle(gunDir)·180/π`；`Gunner.js:34-40` `onTouchMove` 实时更新枪口朝向与 `aim` 十字线位置。
- **开火**：`Gunner.js:42-43` `onTouchEnd` 里检查 `shotedBullets >= bulletFilled`（弹尽则播 empty），否则 `createAbullet()` + `LevelModel.shotABullet()`。
- **子弹生成**：`Gunner.js:45-49` `createAbullet()` 在 `muzzel` 世界坐标实例化 `bulletPre`，`RigidBody.linearVelocity = gunDir.normalize()·2000`，子弹 `angle = handGun.angle`。
- **命中判定**：`Bullet.js:13-24` `onBeginContact`：`bullet` 组撞 `body` 组 → 记录 `_kills`、在命中点喷血、`cc.systemEvent.emit(KILLED, 父节点名)`。
- **弹道反射**：`Bullet.js:25-29` 撞 `border`/`prop` 组首次生成撞击粒子；`Bullet.js:29` `reflectCount++`，`> 20` 后 `useABullet()` 并销毁（反射上限 20 次）。
- **出界回收**：`Bullet.js:44` 世界坐标越界（x<-500 / x>1300 / y<=-500 / y>2000）→ `useABullet()` 并移除。

## 2. 目标 / 胜负判定（事实）

- `GameLogic.js:14` `onLevelAdded` 把子节点按名字归入 `suffers`（要杀的）与 `vips`（不能杀的）；`injury` 关的 `role` 也进 `vips`。
- `GameLogic.js:16-22` `onKilled`：命中 `vip` → 立即 `FAILURE_BUY_KILL`（失败）；命中 `suffer` → 标记；所有 `suffer` 清空 → `passed()`。
- `GameLogic.js:42-47` 若关卡类型为 `vip`/`injury`，需等场上没有 `bullet` 节点才真正 `passed`。
- `LevelModel.js:64-67` `onGoLevel` 从 `LevelConfig.Bullet = "总数:三星线:二星线:一星线"` 拆出 `lastBullets/bulletFilled/starNeeds`（**子弹经济 = 星级**）。
- `LevelModel.js:100-108` `onLevelPassed` 按 `shotedBullets` 对照 `starNeeds` 评 1–3 星；`LevelModel.js:147-151` `shotABullet`/`useABullet` 维护消耗。

## 3. 关卡类型（事实）

`LevelModel.js:6` 四类：`CLASSIC_ID=1000`（清光目标）/`VIP_ID=2000`（别误伤 VIP）/`INJURY_ID=3000`（受伤目标）/`GRENADE_ID=4000`（手雷）。`LevelModel.js:16-18` `setLevelTypeStr` 对应 levelType 1–4。

## 4. 复用到 GUN LEGEND 的映射

| 原作（弹道解谜） | GUN LEGEND（巷战清关） |
| --- | --- |
| 指针瞄准枪口（Gunner.js） | 指针瞄准 + 白色十字准星 |
| 点击开火、子弹按方向飞行（Gunner.js:45-49） | 点击/长按开火，双枪弹丸按瞄准方向飞行 |
| 命中判定 + 事件广播（Bullet.js:13-24） | 弹丸 vs 敌人圆形碰撞 → hit/kill 事件 |
| 子弹经济 → 星级（LevelModel.js:100-108） | 双枪弹匣 → 换弹节奏 + 连杀计分 |
| 反射上限 20 次（Bullet.js:29） | 弃用反射，改为弹幕 + 翻滚无敌闪避 |
| 目标清空过关（GameLogic.js:21） | 波次清空 → 过关 → 12 场推进 |

## 5. 原作的 meta 系统（未采用）

`GameModel.js`（体力/金币/皮肤/签到）、`PlayerModel.js`（微信登录/排行）、`Facade.js`（平台标识/行为埋点）、大量 UI（`Rank/SignIn/InviteDaily` 等）均为微信小游戏运营层，本作按 brief 只保留站点 pipysdk 埋点/存档/分享，不做联网/排行/皮肤/每日任务。
