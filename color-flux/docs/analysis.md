# 源码分析 — color-flux（参考《颜色跳跃》）

> 源码路径：`/Users/admin/remake-src/颜色跳跃/client/`（Cocos Creator 2.x，TypeScript 脚本）。
> 本文只记录「事实 + 出处」，供玩法 1:1 还原与原创改造对照；不复制任何素材/IP 名。

## 1. 入口与场景流

- 场景编排：`1.Index`（加载）→ `2.Home`（标题）→ `3.Room`（单局）→ `4.Data`（结算），见 `assets/Scene/*.fire`。
- 标题页 `View.Home.ts:25-44`：点 `playButton` → 播 btn 音效 → 预载 `3.Room` → 做 0.5s 离场动画 → `loadScene("3.Room")`。
- 结算页 `View.Room.ts:86-109`：`onJumpFail` 触发 `endAnim()`，0.51s 后 `RingPolicy.setDeafult()`、`HoomEventCenter.offAll()`、把本局分数写入 `RoomController.score` 并切到 `4.Data`。

## 2. 主循环 / 移动

- 球体动作是**自动往复跳**，不是玩家按键起跳：`View.Ball.ts:15-33`
  - `jumpHeight = 320`（上跳高度 px）、`jumpDuration = 0.75`（单程秒）。
  - `setJumpAction()`：`moveBy(0.75, (0,320))` easeCubicOut → `onHighest`；再 `moveBy(0.75, (0,-320))` easeCubicIn → `onLowest`；`repeatForever` 无限循环。
- `View.Ball.ts:55-60` `update(dt)`：每 0.04s 发一次 `createBallShadow`（拖影）。

## 3. 输入

- 双按钮旋转色环：`View.Room.ts:34-46`，`leftBtn`/`rightBtn` 的 `click` → `HoomEventCenter.emit(playLeft/playRight)`。
- 实际旋转：`View.RoomRing.ts:33-46`
  - `onPlayLeft`：`targetAngle += 60`；把 `ringColorType` 在 `defaultColorList` 里前进一位。
  - `onPlayRight`：`targetAngle -= 60`；`ringColorType` 后退一位。
- 旋转缓动：`View.RoomRing.ts:86-101` `update(dt)` 按 `angleSpeel` 每帧逼近 `targetAngle`，到位后 `angleSpeel = 0`。

## 4. 判定（核心规则）

- 球到最低点才判定：`View.Ball.ts:43-46` `onLowest()` 发 `ballLowest(currentColor)`。
- 颜色比对：`View.RoomRing.ts:64-73` `onBallLowest(colorType)`
  - `ballColorType === ringColorType` → `gainScore(1)`（+1 分）。
  - 否则 → `jumpFail`（判负）。
- 换句话说：**球每次落到最低点时，当前球色必须等于色环底部那一段的颜色**；同色 +1，异色判负。玩家要在球下落期间用左右键把正确颜色的环段转到下方。

## 5. 变色规则

- 球在落点判定**之后**立即随机变色：`View.Ball.ts:47-51`。
  - `ColorPolicy.getColorType()`（`ChangeColorPolicy.ts:3-13`）：`Math.floor(1 + Math.random()*6)` 映射到 6 色之一。
- 6 色枚举：`Model.ShadowType.ts:1-7` `ColorType = red | blue | green | yellow | violet | dyellow`。
- 色环 6 段顺序：`ChangeColorPolicy.ts:17-25` `defaultColorList = [violet, dyellow, blue, red, yellow, green]`。
- 角度→段映射：`ChangeColorPolicy.ts:60-68` `getAngleByIndex`：index 0..5 → `0 / 60 / 120 / -180 / -120 / -60`。

## 6. UI / 反馈

- 计分：`View.Room.ts:48-51` `onGainScore` 累加 `currentScore` 写进 `scoreLabel`。
- 失败反馈：`View.Room.ts:53-57` `onJumpFail` → `AudioResource.playByAudioType(AudioType.fail)` + `endAnim()`。
- 环缩放反馈：`View.RoomRing.ts:75-83` `onScaleRing`：落点判定时 0.075s scale +0.1 → -0.1（脉搏感）。
- 音效类型：`Core/AudioType.ts`；资源清单见 `assets/Texture/audio/*`（btn / fail / jump，都是单音效，无 BGM 循环层）。

## 7. 结论：对 color-flux 的映射

| 原作事实 | color-flux 还原/改造 |
| --- | --- |
| 球自动往复跳（320px / 0.75s） | 改为点击/空格**主动起跳** + 重力下落（spec P0） |
| 左右键把色环转到正确角度 | 改为**色环自动旋转**，玩家只控起跳时机（Color Switch 式） |
| 同色 +1 / 异色判负 | 保留：穿过障碍时球色 == 障碍段色才通过，否则判负 |
| 球随机变色（落点后） | 改为**吃色换器变色**（spec：吃色换器变色） |
| 6 色 + 60° 分段 | 保留 6 色；原创改造为极光环带/十字/风车/嵌套双环 |
| 无尽计分 | 保留无尽计分；加 12 段推进 + 3 场景包 |

原创差异点（spec 明确要求）：极光萤主题、韵律环（每 5 环）、双色萤（吃双色核心 5s 双色/分数减半）、极光爆发（连穿 10 环）、三场景包（极夜/日辉/霓虹雨）。
