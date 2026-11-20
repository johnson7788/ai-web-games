# abc-pop · 源码分析（宝宝学字母）

> 源码目录：`/Users/admin/remake-src/宝宝学字母-creator/`（Cocos Creator 2.4.2，`project.json` 显示引擎 `cocos-creator-js`，name `BabyXieZiMu`）。

## 1. 入口与主循环

- `assets/game/game.ts:12-18` 定义阶段枚举 `currentStageType`：`currentStageNull`（初始化）→ `currentStageWriteCapitalLetters`（写大写）→ `currentStageWriteSmallLetters`（写小写）→ `currentStagePuzzleJigsaw`（拼图）→ `currentStageMax`（游戏结束）。
- `game.ts:47-54` `start()` 初始化后调用 `enterOrLeaveGame()`；并在非微信平台注入一段百度统计脚本（原作者埋点，我们**不移植**）。
- `game.ts:69-159` `enterOrLeaveGame()` 是主推进器：删除上一阶段节点 → `++this.currentStage` → 按阶段 `cc.resources.load` 加载 `map{level}_1`（大写描摹）、`map{level}_2`（小写描摹）、`puzzleJigsaw`（拼图）prefab。
- 原游戏**没有**传统 `update` 主循环：描摹/拼图各自用 Cocos 触摸事件驱动（事件驱动型，不是帧循环型）。

## 2. 存档 / 关卡递进

- `assets/userData.ts:9` 全局解锁 key = `unlockedGameLevelKey`，走 `cc.sys.localStorage`。
- `userData.ts:23-41` `loadUserData(maxGameLevel)` 读档并夹取到 `[1, maxGameLevel]`，缺省 1。
- `userData.ts:55-64` `unlockGameLevel()` 只在「当前关 == 已解锁关」时 `++unlockedGameLevel` 并写档、置 `isUnlockAction=true`。
- `assets/gameLevel/gameLevel.ts:93-138` `switchGameLevel(level, isPlayAnim)` 播放人物缩放动画后 `cc.director.loadScene("game")` 进入单字母玩法。
- 结论：**逐字母解锁、A→Z 顺序推进**（26 字母 × 每字母 3 阶段）。

## 3. 输入与判定

### 3.1 描摹（writeLetters）
- `assets/game/writeLetters.ts:17-19` 灵敏度 `sensitivity=20`、`maxDrawCount`（需临摹次数）、`currentState`（0 初始化 / 1 自动绘制 / 2 玩家描摹）。
- `writeLetters.ts:56-97` `start()` 依次播放箭头动画把字母笔画路径录制进 `paths`；动画播完进入玩家描摹。
- `writeLetters.ts:149-232` 玩家触摸：`TOUCH_MOVE` 里逐路径点比对 `position.sub(touchPos).mag() <= sensitivity`，超界即停；全部笔画描完 → `gameOver(true)` 进入下一阶段。
- 判定本质：**轨迹点距离阈值**，无失败/扣分，只有「描没描到」。

### 3.2 拼图（puzzleJigsaw）
- `assets/game/puzzleJigsaw.ts:37-40` 每关加载 `pitch/map{level}_1..4` 四张碎图。
- `puzzleJigsaw.ts:78-139` 拖拽仓库碎图到灰色目标位，命中 `rect.contains` 则恢复材质；`patchScrollView.content.childrenCount == 0` 即通关 → `gameOver(true)`。

## 4. 资源组织

- 大写描摹 prefab：`assets/resources/map{1..26}_1.prefab`；小写：`map{1..26}_2.prefab`。
- 拼图素材：`assets/resources/pitch/map{1..26}_{1..4}.jpg`。
- 音频：`assets/gameLevel/bg.mp3`、`tips{1..4}.mp3`（随机提示语，见 `gameLevel.ts:36-44`）。

## 5. 到 spec-abc-pop 的 1:1 玩法映射

| 原版（宝宝学字母） | spec-abc-pop 还原/改造 |
| --- | --- |
| 每字母 3 阶段：大写描摹 / 小写描摹 / 拼图 | 每字母 3 轮：认读 / 大小写 / 首字母词 |
| 逐字母递进 A→Z（26 字母） | 同：26 字母 × 3 轮 = 78 关 |
| 描摹无失败，只按阈值判定是否推进 | 点错只抖动不扣分（无挫败） |
| 逐关解锁 + localStorage | Sdk.save 持久化（best/进度） |
| 音频提示语（tips1..4） | WebAudio 程序化：字母名音高区分 + 通用鼓励音 |
| 原版为描摹/拼图操作 | 改造为「点击漂浮字母泡泡」 |

## 6. 原创改造落地（spec 的 P0 + 区别点）

- 糖果云层：气球字母飘过糖果天空；三场景包（晨云 A–I / 雨后 J–R / 夜空 S–Z）。
- 签名点：连续 5 对触发「彩虹字母桥」（`BRIDGE.STREAK=5`）。
- 区别点 1「风速」：`DIFF.WIND_*` 随 levelIndex 递增。
- 区别点 2「双气泡」：大小写轮需两形态各点一次（`sim.js` 的 `formsDone`）。
- 干扰字母递增：`DIFF.DISTRACT_*`；后期混入小写制造大小写混淆（`DIFF.MIXED_CASE_FROM`）。
- 泡泡交叉换位：`BUBBLE` 摆动 `swayAmp/swayFreq` 随难度增大。

## 7. 结论

原版是「描摹 + 拼图」的儿童字母认知游戏，核心是**逐字母三阶段、无失败、顺解锁**。spec 把它重新设计成「点击字母泡泡」的认知玩法，保留了逐字母三轮递进与无挫败反馈，新增糖果天空三场景、彩虹桥签名、风速/双气泡/交叉换位三个区别点。全部数值进 `config/`，sim 为纯逻辑（零 DOM/零 Date.now/seed 随机），渲染/音频全程序化。
