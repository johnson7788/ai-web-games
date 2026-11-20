# 源码分析 — endless-orb（改造自「不停歇的球 / firing_balls」）

> 源码：`/Users/admin/remake-src/不停歇的球-creator/firing_balls-master-main/`
> 本作按 spec 的 P0（aa 针钉类：中心旋转大圆 + 连续点击发射小球钉在圆上）1:1 还原玩法规则，角色/场景/音乐全原创。

## 结论先行

提供的 Cocos 源码实际是一套**纵向打砖**（发射小球打上方下坠的砖块），与 spec 标题「不停歇的球」的 P0 描述（aa 针钉类）存在品类错位。本作以 **spec 的 P0 为准**：中心旋转能量核 + 点击发射光子钉入圆边 + 撞到已钉光子判负 + 达到目标钉数清环。从源码抽取并还原了以下共用原语，其余（圆钉几何、极性反转、过载钉、三场景包）为原创实现。

## 源码事实（文件:行号）

### 入口 / 主循环
- `assets/src/game/Main.ts:24-43` — `onLoad()`：初始化随机、事件中心、加载动画、音频、`GameModel`，然后 `show(menu)`。可见「加载即进菜单」的入口结构。
- `assets/src/game/Main.ts:57-59` — `update(dt)`：只驱动 `TimerMgr`，实际玩法更新在 `GameView.update`。

### 输入
- `assets/src/game/view/GameView.ts:85-94` — `onTouchMove`：用触摸位移增量计算炮管角度，`angle = clamp(|angle|, 0, 85°)`（限幅 ±85°），再 `cannon_head.angle = -angle`。
- `assets/src/game/view/GameView.ts:96-128` — `update(dt)` 每 `fireBallDt`（`GameModel`，≥2 帧）自动发射一发就绪小球，`item.fireBall(-cannon_head.angle)`。

### 发射 / 判定 / 命中计数
- `assets/src/game/item/BallItem.ts:69-74` — `fireBall(fire_rotation)`：`linearVelocity = (sin(rad)*speed, cos(rad)*speed)`，速度 `ball_speed + 100*ball_fire_speed`。
- `assets/src/game/item/BallItem.ts:76-87` — `onBeginContact`：撞到底部 tag=1 就归位，等待再发射。
- `assets/src/game/item/BrickItem.ts:118-132` — `onEndContact`（球 vs 砖）：`hp -= power`、`score += power`——**命中计数 + 扣血 + 计分**共用原语。
- `assets/src/game/item/BrickItem.ts:39-81` — `hp` setter：归零时触发「掉球/加星/道具/消除特效」，是「命中→反馈→推进」的判死/奖励链。

### 关卡 / 推进
- `assets/src/game/view/GameView.ts:130-170` — 每滚过 `4*brick_radius` 距离生成新一行砖（`new_level`），HP 随 `moved_level` 与场上球数增长——**难度随推进递增**。
- `assets/src/game/view/GameView.ts:237-262` — `resetGame()`：初始 4 球 + 两行砖，炮管随机初始角度。
- `assets/src/game/view/GameView.ts:172-199` — 砖块下坠，`brick.y - radius <= ball_init_y` 触发 `gameOver()`（`GameView.ts:417-421`）。

### 数值 / 配置
- `assets/src/game/GameConst.ts:8-16` — `ball_radius=15`、`ball_speed=1000`、`brick_radius=43`、`max_ball_init_count=60`、`max_ball_fire_speed=10`。
- `assets/src/game/GameConst.ts:23-31` — `theme_config`：单套 10 色主题色板（青→绿→红渐变）。
- `assets/src/game/model/GameModel.ts:9-79` — `ball_power / ball_fire_speed / ball_init_count / score / revive_times` 的钳位 getter/setter，均通过事件中心广播。

### UI / 结算
- `assets/src/game/view/MenuView.ts` / `ResultView.ts` — 菜单与结算视图（未逐行展开，结构为 pop 弹窗 + 按钮）。
- `assets/src/common/audio/AudioPlayer.ts` — 音频播放单例（BGM/SFX，源码用 mp3）。

## 抽取 → 本作映射

| 源码原语 | 本作实现 |
| --- | --- |
| `fireBall(rotation)` 直线发射 | `step({fire})` 直线向上发射光子（`src/game/sim.js`） |
| `onEndContact` 命中扣血 + 计分 | 光子触边钉入 / 撞已钉光子判负（`stickPhoton`/碰撞检测） |
| `new_level` 难度随推进递增 | 12 环：目标钉数递增 + 核形轮换（`config/levels.js`） |
| `theme_config` 单套色板 | 三套场景色板 蓝星核/红巨核/黑洞核（`src/render/theme.js`） |
| `gameOver` 触底判负 | 碰撞判负 / 12 环通关 |

## 本作核心契约（与代码一致）

- 世界：1280×720，能量核圆心 (640,320)，发射口 (640,680)，固定步长 1/60s。
- 状态机：`boot → title → playing → (paused | dead | won | upgrade)`。
- 事件名：`shot / pin / heavyPin / nearMiss / ringClear / sceneEnter / polarityReversal / photonSuck / upgradeChosen / overloadReady / spin / milestone / death / win / shieldSave / miss`。
- 模块 API：`createRun({seed,startRing})` → `{ step(input), getHud(), drainEvents(), applyUpgrade(id), jumpTo(ring), debugPin(n) }`。
