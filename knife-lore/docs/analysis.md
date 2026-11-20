# 源码分析 — knife-lore（改造自 飞刀/飞刀大乱斗）

> 源码根：`/Users/admin/remake-src/飞刀/飞刀/`（Cocos Creator + TypeScript）
> 本文只记事实，带 文件:行号；所有结论用于「玩法规则 1:1 还原、角色/场景/音乐全原创」的改造。

## 1. 核心循环还原（P0）

源项目是「飞刀大乱斗」多人对战，但其底层就是 Knife Hit 品类：**每把刀插进一个绕身体旋转的刀环**，命中已插的刀即弹飞/扣血。

| 原作机制 | 源码位置 | 还原到 knife-lore |
| --- | --- | --- |
| 刀环持续旋转 | `gamescene/KnifePool.ts:82-87`（`rotaAngle -= dt * rotaSpeed`） | 卷轴桩 `post.angle` 按 `speedDeg` 旋转 |
| 刀按等分角插入刀环 | `gamescene/KnifePool.ts:189-260`（`changeDefenceState`，`angle = 2π/len`，`knife.setRota(90 - i*eulerAngle)`） | `stuck[].localAngle` 插在命中角 |
| 命中已插刀 → 弹飞 | `gamescene/Knife.ts:167-228`（`onCollisionEnter` tag==1，`knife.fly(dir)`） | 命中判定 `angDist < GAP_DEG` → 崩刀判负 |
| 刀捕获进池 | `gamescene/Player.ts:371-380`（`captureKnife` → `knifePool.addKnife`） | 掷刀插桩 → `stuck.push` |
| 血尽即死 | `gamescene/Player.ts:459-484`（`setDamage` hp<=0 → `die`） | 撞刀直接 `phase='failed'` |

## 2. 关卡/推进

- `resources/configtable/LevelTable.json`：15 档段位，逐档解锁 `speedUp`（火箭加速）、`hotWheels`（风火轮）、`meteor/movMeteor`（陨石/移动陨石）、`blackHole`（黑洞）、`magnet`（磁铁）。`GameScene.startGame()` 用 `DataManager.getLevelId(star)` 选段位（`gamescene/GameScene.ts:150-183`）。
- 还原为 **12 关**：`转速 / 间歇反转 / 加速脉冲 / 桩形（圆/方/双桩/移动桩）/ 刀数 5→12`，三场景包 竹庭/暮城/雪岳（`config/levels.js`）。

## 3. 输入

- 原作触屏：按下=攻击、拖动=移动、松开=龟缩防御（`gamescene/PlayerController.ts:64-146`）。
- knife-lore 简化为：**点击/空格掷刀**（`src/main.js` 边沿检测 → `run.step({throw})`），触屏同。

## 4. 原创改造点（不抄原作素材/IP）

- **武士道卷轴桩**：掷手里剑击碎卷轴桩；每插一刀桩上刻一圈墨痕（`src/render/index.js` 墨弧），集满绽裂。
- **斩铁**：每 3 关解锁 1 次必中安全角度提示（`config/gameplay.js` ZANTIE + `src/game/sim.js` `useZantie`）。
- **双刀桩对称加成**：两把刀落在对称 ±15° 内额外分（`src/game/sim.js` `land()`）。
- **signature**：最后一刀命中时慢动作刀光圆环 + 桩裂两半墨散（`src/render/index.js` `triggerSignature`）。

## 5. 关键常量还原对照

- 原作刀环半径随刀数增长：`radius = 133.9308 * radiusScale + rd * 5.3564`（`KnifePool.ts:232-234`）。本作固定桩半径（单桩 150 / 双桩 110），刀数涨难度而非半径，更贴合 Knife Hit 手感。
- 原作旋转速度 `rotaSpeed = 144/160`（`KnifePool.ts:234,279`）。本作 `speedDeg 60→112`，随关卡递增。
