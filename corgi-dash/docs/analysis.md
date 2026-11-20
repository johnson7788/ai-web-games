# corgi-dash 源码分析（改造自「冲吧柯基」）

> 源码：`/Users/admin/remake-src/冲吧柯基/`（Cocos Creator JS 工程，`project.json` 声明 `engine: cocos-creator-js`）
> 本文件按 REBUILD-BRIEF 要求记录「事实 + 文件:行号」，只还原玩法规则，不复用原作素材/IP。

## 1. 入口与工程形态

- `project.json:2-3`：`"engine": "cocos-creator-js"`，Cocos Creator 组件工程。
- 核心逻辑在 `assets/src/*.js`，均为 `cc.Class({ extends: cc.Component })` 组件；全局命名空间 `window.D` / `window.GAME_MODE` 在 `assets/src/global.js` 初始化。

## 2. 全局状态（global.js）

- `global.js:4-8`：`GAME_MODE = { CHALLENGE: "challenge", STAGE: "stage" }`——本作分「挑战（无尽）/ 关卡（STAGE）」两种模式。
- `global.js:16-41`：`window.D` 保存 `userInfo.gold`（初始 1000）、`gameInfo`、`soundSetting`（音乐/音效开关）等。
- 原作是微信小游戏风格，含 `wx.js` / `network.js` / `rank.js` / `share.js`（登录、排行、分享、广告），本次改造全部不还原（网络/排行/广告属反范围）。

## 3. 核心循环（hero.js = 玩家控制器）

- `hero.js:24-26`：`onLoad` 里 `speed <= 0 && (this.speed = 2)`，启用碰撞管理器，注册 `KEY_DOWN/KEY_UP`，`stop = true`（开局静止），`mapLevel = 0`、`inAir = false`、`mapBlockIndex = 0`。
- `hero.js:27`：`robot()`——存在机器人模式（`isRobot`），是原作内嵌的 bot 探针，证明原作支持 headless 自跑。
- `hero.js:48-53`：`onCollisionEnter`——碰撞分 tag：`1` = 星星（`onCollisionExit` 里加金币，`hero.js:69`）、`2/0` = 障碍/地块、`3` = 终点线（`isMapEnd`）。
- `hero.js:68-73`：`onCollisionExit`——tag `1` 加金币；tag `2/0` 推进 `mapLevel`/`mapBlockIndex`，并按 `mapBlockIndex` 加速（`speed = initSpeed + blockAcceleration*(mapBlockIndex-1)`）；`mapLevel === 0 && !inAir` 时 `gameOver()`（判负）。
- `hero.js:75-102`：`onKeyDown/onKeyUp`——方向键 a/w/s/d 转向（`direction`/`rotation`），space 只是缩放展示。
- `hero.js:123-152`：`update`——沿当前方向连续移动（`node.x/y += speed`），相机同步；`inAir` 时先放大再缩小（跳跃缩放表现，`hero.js:140`），`tempTrapLength <= 0` 落地，若 `mapLevel <= 0` 判负。

### 关键判定结论
- 原作实际是「**四向自动移动的跑图/避障**」：玩家在路网上持续前进，在引导图标处「点击」决定**转向或跳跃**（`background.js:52-57` 的 `switchGuideIcon`：点击时若当前引导方向 == 当前朝向则 `setInAir(true)`（跳），否则转向）。
- 但 spec 已把 P0 重新解释为「**横向跑酷**」（自动横跑 + 跳跃 + 障碍判负 + 星星/金币收集 + 距离计分 + 速度渐增）。本改造按 spec 的横向跑酷语义实现，只保留「自动前进 / 跳跃越过障碍 / 碰撞判负 / 收集计分 / 速度渐增 / 无尽距离」这些共性规则。

## 4. 地图与生成（mapContainer.js / map.js）

- `mapContainer.js:30-36`：`getRoad()` 按模式加载关卡数据 `data/level{n}` 或 `data/unlimited/level{n}`，`init(json)` 逐段摆地块。
- `mapContainer.js:37-103`：`init` 按关卡数组 `l.d`（方向）、`l.lt`（地块类型）、`l.bt`（1=引导点 / 2=星星）生成地块/引导图标/星星，`trapLength = 128`（`mapContainer.js:9-12`）。
- `mapContainer.js:104-110`：`remakeMap()` 无尽模式循环复用地图（`circle++`，见 `hero.js:49`）。
- `map.js`：贴图组件，加载 `hero/a_sd_maze` 图集（原作素材，不还原）。

## 5. 星星/金币（star.js / starGroup.js / money.js）

- `starGroup.js:26-32`：`loadStar()` 一次性生成 30 颗普通星星，位置随机在父容器内。
- `money.js:8-14`：`updateGold()` 把 `D.userInfo.gold` 显示到 `goldText`（金币 HUD）。
- 结论：星星 = 收集物（加金币），金币 = 跨局货币。本改造保留「收集物加分数」的共性，金币系统改为「羊群跟随 + 分数倍率」。

## 6. 关卡/模式（stage.js / gameMode.js）

- `background.js:13-15`：`onLoad` 初始化数据、`go()` 注册 `touchstart` 到 `switchGuideIcon`（点击即交互）。
- `background.js:19-21`：`addSteps`——无尽模式用「步数」计分并刷新 HUD。
- `background.js:43-51`：`gameOver()` 播死亡音效、`playDieAnimation()`（旋转倒地）、延时 `revival()`（复活/广告）。
- `background.js:58`：`cleanence()`（结算）。

## 7. 表现（dog.js / background.js）

- `dog.js:18-46`：`running()`——身体/左右腿 scale 循环动画（跑步循环），`gapTime = 0.1`。
- `dog.js:48-56`：`stopForWhile()` / `setRotation()`——腿部动画停止、整体旋转（转向时）。

## 8. 改造映射（原创 · 不碰原作素材）

| 原作事实 | 本作 corgi-dash |
| --- | --- |
| 自动前进（hero.js:123-152 连续移动） | 横向自动跑酷：世界滚动，柯基固定 x |
| 跳跃（background.js:52-57 `setInAir`） | 点击/空格跳；二段跳 + 长按变高 |
| 障碍碰撞判负（hero.js:72） | 障碍碰撞：无羊 → 判负；有羊 → 死羊减分 |
| 星星/金币收集（hero.js:69） | 收集羊 → 羊群跟随链 + 分数倍率 |
| 速度渐增（hero.js:72） | 距离越远速度越快（config-first） |
| 关卡数据 `data/level{n}`（mapContainer.js:33） | 12 段推进结构 + 3 场景包 |
| 引导图标切换（background.js:52-57） | 教程选择器（jump/sheep/whistle/perfect） |

原作未还原（反范围）：微信登录/排行/分享/广告、金币跨局商店、皮肤、复活视频广告、STAGE 关卡数据文件。
