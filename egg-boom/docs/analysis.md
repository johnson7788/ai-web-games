# EGG BOOM · 源码分析（改造自 Cocos《2048射击》）

> 源码：`/Users/admin/remake-src/2048射击/`（Cocos Creator 2.x 微信小游戏）。
> 原则：玩法规则 1:1 还原、角色/场景/音乐全原创。本文件记录「事实 → 原创改造」的对应关系。

## 1. 入口与主循环

- `assets/Script/InitGame.js:11-19`：初始化时 `GlobalData.game = this`，切到 `startGame` 屏，其余屏隐藏；`loadDataSync()` 预载资源。
- `assets/Script/MainGame.js:92-103` `onLoad`：生成 6 行障碍容器 `zawNode`，行 y 取 `GlobalData.ZhangAiWu`（`GlobalData.js:11` = `[330,198,66,-66,-198,-330]`，屏幕 y = 360 - 值，即 6 行 30/162/294/426/558/690）。
- `assets/Script/MainGame.js:13-29` `initGame`：实例化坦克（`cc.v2(-260,0)`）、`freshZaw()`、随机肤色、播 BGM。
- `assets/Script/MainGame.js:122-135` `update`：分数刷 HUD；`zaw.x <= -300` 时销毁旧排并 `freshZaw()` 生成下一排（关卡步进制）。

## 2. 核心循环（坦克 = 我方）

- `assets/Script/ThirdModule/tanke.js:17-21` `startGame`：`schedule(moveDown, 0.01)`（每 0.01s 下落）+ `schedule(shoot, shootSpeed)`（自动射击）。
- `tanke.js:22-38` `moveDown`：`node.y -= downSpeed*dt`；落底（`y<=-358`）→ 爆炸 → `FinishGame.show()`（判负）。
- `tanke.js:43-46` `Jump`：`unschedule(moveDown)` + `jumpFlag=true`；`tanke.js:80-88` `update`：`jumpFlag` 时 `y += upSpeed*dt`（按住上升）。
- 输入：`MainGame.js:17-19` `TOUCH_START → tankeJump`（起跳）、`TOUCH_END/CANCLE → tankeEnd`（恢复下落）。**即「按住蓄力跳 / 松手下落」的原型。**

## 3. 射击与判定

- `tanke.js:47-58` `shoot`：每发 `shootNum` 颗子弹（`GlobalData.gameConf.shootNum=1`），子弹从坦克右侧射出，`buttle.shoot(1+i)`。
- `assets/Script/ThirdModule/buttle.js:33-51` `update`：子弹向右飞（type 1 直射 / 2 斜下 / 3 斜上），出界（`x>=320`）销毁。
- `assets/Script/ThirdModule/zhangaiwu.js:26-79` `onCollisionEnter`（障碍被子弹击中）：`target -= shootPowder`（每发 -1），`target>0` 刷新数字，`target==0` → 播粒子、销毁、加分数。

## 4. 障碍与道具

- `MainGame.js:30-79` `freshZaw`：每排障碍数字 `util.getRandomNum(stepNum * gameStep)`（随关卡线性涨）；每 `xingNum(6)` 关随机一行挂五角星；每 `propNum(4)` 关掉道具（`propType 1=ups 加速 / 2=power 加攻`，`GlobalData.js:26-32`）。
- `zhangaiwu.js:44-64`：五角星被击破时按 `wuxingType` 生效（1 加速、2 火力、3 三连发），10s/1s 后回退。
- `assets/Script/ThirdModule/prop.js:10-22`：坦克碰道具 → 加速或加攻。

## 5. 判负与结算

- `tanke.js:59-79` `onCollisionEnter`：撞障碍（tag 3）→ 爆炸 → `FinishGame.show()`。
- `assets/Script/FinishGame.js:24-38` `show`：停 BGM、上报排行、显示重开按钮；`restartButtonCb` → `MainGame.destroyGame()` + `initGame()` 重开。

## 6. 数值源

- `GlobalData.js:13-24` `gameConf`：`shootNum:1 / shootSpeed:0.5 / shootPowder:1 / buttleSpeed:500 / propUps:1 / propPower:1`。
- `GlobalData.js:31-44` `cdnParam`：`stepNum:4 / propNum:4 / xingNum:6 / propRate:0.5 / wuxingRate{ups:0.4,power:0.8,shootNum:1}`。

## 7. 原创改造映射（egg-boom）

| 原作（2048射击） | EGG BOOM（原创） |
| --- | --- |
| 坦克下坠/按住上升 | 弹簧蛋滚台面，按住蓄力跳（`src/game/sim.js` `updateCharge`） |
| 子弹打数字障碍每发 -1 | 米粒弹打数字面粉团每发 -1（`damageDough`） |
| 撞未清障碍判负 | 撞未清面粉团判负，但**蛋壳护甲**抵一次（`handleEggCollisions`） |
| 五角星（加速/火力/三连） | 道具三选一（分数/弹药/火力，`dropProp`）+ **蛋黄溅射**（连击×5 换范围弹） |
| 关卡步进（每排 +1 波） | 距离制 12 关，三套场景包（`config/levels.js`） |
| 微信排行/分享 | 站点 SDK 埋点/存档/分享（`src/core/sdk.js`） |

## 8. 事件契约（sim → main/render/audio）

`shoot / doughHit / doughBreak / jump / land / comboUp / comboBreak / yolkReady / yolkFired / propGain / shellBreak / shellRegrow / armorDeflect / rackClear / levelEnter / sceneEnter / milestone / chargeFull / noAmmo / death / win / roll`。
字段说明见 `src/game/sim.js` 各 `emit()` 调用点。
