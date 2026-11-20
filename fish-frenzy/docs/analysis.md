# fish-frenzy 源码分析（Cocos 单机捕鱼 → 原创深海渔场）

> 源码：`/Users/admin/remake-src/单机捕鱼-creator/`
> 结论：原作是「炮台瞄准 + 点击发射渔网弹 + 按捕获率扣血判死 + 金币余额」的经典捕鱼单机。本改造保留玩法规则，角色/场景/音乐全原创（深海夜光渔市主题）。

## 1. 入口与主循环

- `assets/FishSingle/script/game/scene/FishGameScene.ts`：战斗场景装配（未逐行读，由各 Manager 的 `update()` 驱动）。
- 主循环由 Cocos 组件 `update()` 组成：`FishManager.update()`（鱼生成/移动/离场）、`BulletManager.update()`（弹飞行）、`FishNetManager`（网动画）。

## 2. 炮台与炮档（核心：1-7 档倍率）

- `CannonManager.ts:16` `cannonType: number = 1`，`CannonManager.ts:24-29` `onMeMove` 把鼠标位置换算成炮台旋转角 `view.angle = rot - 90`。
- `CannonManager.ts:31-33` `refreshCannon` 按 `cannonType-1` 换炮身贴图。
- `CannonManager.ts:35-37` `getCannonPosition` 返回炮口（弹的出生点）。
- `FishUI.ts:55-67` `onClickPre/onClickNext`：炮档 1↔7 增减（`cannonType < 7` 才可加），`FishUI.ts:21` `score: number = 1000000`（金币余额即血量）。

## 3. 发射与判定（命中→扣血→捕获）

- `BulletManager.ts:53-72` `onShootBullet`：`score >= cannonType` 才可发射，发射即扣 `score -= cannonType`；弹从炮口飞向点击点，`bulletType = cannonType - 1`。
- `BulletManager.ts:26` `bulletMoveSpeed = 30`，`BulletManager.ts:41-51` 弹到达目标后 `FishNetManager.addFishNet`（放网）。
- `FishBulletBase.ts:21-35` `onCollisionEnter`：撞到活鱼 → 放网 + 扣鱼血 `fish.blood -= (bulletType+1)`；`blood <= 0` 则 `playDeadMv`。
  - 即：**伤害 = 炮档**（1-7），鱼 `blood`（`FishConfig.ts` 里 2-14）是捕获门槛；等价于「命中一次按 `炮档/血量` 概率致死」，大血量鱼捕获更难。

## 4. 鱼与血量（FishConfig）

- `FishConfig.ts:5-29` 29 种鱼，`FishInfo(fishType, name, blood, wikiScale)`：蝴蝶鱼 blood 2 → 美人鱼/金龙 blood 14 → 章鱼 blood 10。
- `FishConfig.ts:38-45` `getFishInfoByType` 按类型查表。

## 5. 鱼群路径（单游/编队/横穿/拐弯）

- `FishPathConfig.ts:33-75` `config`：16 条折线路径（左入/右入/下往上），每条由 `[x,y]` 控制点组成；`FishPathConfig.ts:107-126` `initNormalConfig` 把每条路径再生成原路 + 水平翻转 + 垂直翻转 3 份，共 48 条 `FishPathInfo`。
- `FishPathConfig.ts:10-26` `mapConfig`：鱼汛（wave）编队表，每项 `[fishType, scale, side, x, y]`，成批鱼从屏幕外按 `x + winSize.width` 进入（`FishManager.ts:190`）。
- `FishPathInfo.ts:5` `pathId/path`；`FishMapInfo.ts:3-14` `fishType/scale/side/x/y`。
- `FishMover.ts:45-108` `moveBezier`：三点贝塞尔插值移动，`speed` 控制移速，按方向翻转贴图。

## 6. 生成节奏（FishManager）

- `FishManager.ts:110-130` `randomFish`：随机 1-10 条、随机鱼种 1-29、随机路径，`nextRandomFishTime = 2-5s` 再生成。
- `FishManager.ts:60-68` / `177-193` 鱼汛：`mapCount` 30-60s 倒数后 `playWaveEffect` → `startFishMap` 批量出编队。
- `FishManager.ts:149-157` `killFish`：`ScoreManager.addScore(fishInfo.blood, pos)`（**奖励 = 鱼的 blood 值**）+ `playFishDead`。

## 7. 金币与结算

- `ScoreManager.ts:22-31` `addScore`：得分从鱼位置飞到 HUD 后 `FishUI.instance.score += score`。
- 胜负：`FishUI.ts:21` 金币即血量，`BulletManager.ts:56` 金币不足时 `CommonTips.showMsg("金币不足!")`。

## 8. 音频

- `GameMusicHelper.ts:7-18`：`playBg` 随机 `background-1..3`；`playFishDead` 按鱼种 `deadfish_<type>`；`playFire` 开火。
- 原 mp3 素材不移植（本作 WebAudio 程序化合成）。

## 9. 改造映射（原创深海渔场）

| 原作 | 本作（fish-frenzy） |
| --- | --- |
| 炮台 1-7 档 | 夜光炮台 1-7 档（耗币=档位，捕获率随档位升） |
| 鱼 blood 2-14 | 发光深海种 hp 2-25（灯笼鱼/魔鬼鱼/皇带鱼/巨口鲨 Boss），`value/hp` 决定期望收益 |
| 命中扣血判死 | 网弹命中按 `captureRate(tier,hp)` 概率捕获 |
| 随机单游/编队/路径表 | 路径表（6 条折线）+ 编队 + 横穿/拐弯 |
| 金币余额=血量 | 金币余额=血量，打空判负；每场限时 |
| —（新增） | 鱼汛预报（顶部预告 5s 后路线）+ 电击网（60s 充能群捕） |
| 单一背景 | 三场景包：珊瑚渔场(亮青)/深沟(深蓝)/热泉(暗红) |
| 单局无推进 | 12 场推进结构（每场营收目标 + 鱼种/密度/路径轮换 + Boss 场） |

关键公式（写入 config/gameplay.js，逻辑层不写死）：
- 捕获率 `captureRate(tier,hp) = clamp(tier/hp, 0.05, 0.95)`
- 捕获奖励 = `fish.value × tier`；期望收益/币 = `value/hp`（本作全部鱼 ≥1.5，大鱼更高方差更高回报）
