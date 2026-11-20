# SKY DROP DODGE — 源码分析

> 改造自 Cocos Creator 2.4.6 项目《躲避高空抛物》（project.json `name: VaccineWar`）。
> 源码目录：`/Users/admin/remake-src/躲避高空抛物/`。原则：玩法规则 1:1 还原，角色/场景/音乐全原创。

## 1. 入口与装配

- `project.json`：engine `cocos2d-html5`（Cocos Creator 2.4.6），包名 `packages`。
- 核心脚本在 `assets/Script/`，场景由 `Game.ts` 编排。

## 2. 主循环 / 生成（Game.ts）

- `_startGame()`（`Game.ts:28-39`）：重置 `spawnTime=levelConfig.spawnTime`、池初始化、时间条 `startCount()`、玩家归位 `(0, y)`、清屏、`_generateItems()`。
- `_generateItems()`（`Game.ts:41-62`）：把 `levelConfig.itemsList` 随机打乱；`schedule(..., _spawnTime)` 周期生成掉落物；生成 x 为全宽随机（`getRangeRandom(-limitX, limitX)`，`limitX = 屏宽/2 - 50`）；y 固定在屏幕顶 +50；index 递增到 `list.length-1` 后停在该项（后期只剩最后一种）。
- `_onUpSpeed()`（`Game.ts:64-71`）：每 15s 触发，`spawnTime -= 0.2`，下限 0.5s，然后重排生成节奏。

## 3. 掉落物（Item.ts / ItemsConfig.ts / LevelConfig.ts）

- `Item.init()`（`Item.ts:26-37`）：`Game.itemMoveSpeed = levelConfig.moveSpeed`；取 `atlas` 对应 `data.id` 的图；碰撞半径 = 图片宽/2；随机旋转角 + 每 1.5s 旋转 45° 的循环 tween。
- `Item.update(dt)`（`Item.ts:40-57`）：`node.y -= Game.itemMoveSpeed * dt` 垂直下落；落出屏幕底 50px 归还对象池。
- `ItemsConfig.ts`（`ITEMS_TYPE_LIST`）：9 种掉落物伤害表——玻璃瓶15 / 纸团1 / 苹果核3 / 压缩机30 / 花盆20 / 易拉罐5 / 水杯6 / 牙膏4 / 香蕉皮2。
- `LevelConfig.ts`（`levelConfig`）：`moveSpeed: 520`、`spawnTime: 1.3`、`itemsList` 为 16 项的 id 轮换（含 0/1/2/4/5/6/7/8 与 3 压缩机）。

## 4. 玩家（Player.ts / TouchArea.ts）

- `Player.onTouchMoveEvt()`（`Player.ts:44-53`）：横向移动，边界为屏宽/2 - 50；触发 `playerMove` 动画。
- `TouchArea.ts`（`_onTouchMoveEvt`）：触屏拖动，把手指 x 直接映射到玩家 x（`convertToNodeSpaceAR`），并调用 `player.onTouchMoveEvt()`。
- `Player.onCollisionEnter()`（`Player.ts:60-75`）：撞 `item` 即归还对象池；若 `!_haveSafeHat` 扣 `item.data.damage` 生命（初始 100），`_curLife<=0` → `_dead()`。
- `Player._dead()`（`Player.ts:77-89`）：播 `playerDie`、清屏、关触摸、0.7s 后结果动画，`setPauseGame(true)`。
- `takeSafeHat()`（`Player.ts:91-98`）：`_haveSafeHat=true` 15 秒无敌。

## 5. 关卡推进（TimeBar.ts / Safehat.ts）

- `TimeBar.startCount()`（`TimeBar.ts:22-55`）：120s 倒计时（`TOTALTIME=120`）；每 15s 触发 `upSpeed`（生成加速）；每 25s 首次弹安全帽引导 UI、之后在场内随机位置刷安全帽（`showSafeHat`）。
- `Game.showSafeHat()`（`Game.ts:96-105`）：随机位置 10s 存活，点击获得 15s 无敌（`Safehat.ts`）。
- 进度条由 `progressBarMoveEffect.js` 缓动填充（lerp 0.2s），`fillEffect.js` 同理。

## 6. 结算（UI/ResultUI.ts）

- `ResultUI.init()`（`ResultUI.ts:15-32`）：按剩余生命分三档动画（`life<=0` / `0<life<90` / `>=90`），并上报统计（`SendMsg.reqSaveAssessStatistics`）。
- `clickAgainGame` 重新开局；`clickBackGame` 回菜单。

## 7. P0 还原映射（本作实现）

| 原作 | 本作（原创） |
| --- | --- |
| 底部角色左右移动（触屏拖动） | ←→/AD + 拖拽移动；触屏拖动 + 举伞按钮 |
| 天上随机掉落物（大小/伤害不同） | 花盆/水瓶/易拉罐/冰箱/沙发/电视/无人机（大小/速度/预警不同） |
| 被砸扣血 → 死 | 3 心生命，小物扣 1 大物扣 2，无敌 1s |
| 120s 倒计时 / 进度条推进 | 12 波推进（每波存活时长），进度条 = 波次进度 |
| 安全帽 15s 无敌 | **能量伞**：可挡 3 次小物，挡大物碎伞（格挡资源管理） |
| 每 15s 加速 / 掉落变密 | 波次轮换：密雨 / 大物稀 / 追踪无人机 / 预警极短偷袭波 |
| （无） | **地面风带**：左/中/右三列，顺风加速逆风减速 |
| （无） | **连续 near-miss(<20px) 触发「风骚走位」慢动作涟漪**（signature） |
| （无） | 三场景包：晴午天台 / 雷雨 / 晚霞（色板+构图+装饰全换） |
