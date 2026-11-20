# ocean-dash 源码分析

> 参考实现：`/Users/admin/remake-src/fish-go-creator/`（吞噬成长）+ `/Users/admin/remake-src/fish-run-creator/`（竞速/机器人对手）
> 本作是**改造**：玩法规则 1:1 还原「鱼群竞速躲避 + AI 对手」，角色/场景/音乐全原创。

## 1. 入口与主循环

- `GamePanel.js:92-103` 启动时 `nodeStartPanel.active=true`，等 `gameReady()` 回调；`startGame()` 开始。
- `GamePanel.js:396-427` `update(dt)`：`gameingMark` 后每秒 `--gameTime`（默认 20s 倒计时，`GamePanel.js:24-28`），到 0 调 `preClose()`，负值调 `gameClose()`。
- `GamePanel.js:295-355` `preClose()`：停玩家速度（`Move.Speed=0`）、关相机、移除节点、显示结束面板；`alive = robotMgr.childrenCount > 1` 判胜负（`GamePanel.js:313-315`）。
- 结论：原作是**限时对抗**（20s 内比谁的鱼群更大/还活着），本作改造为**分段竞速**（12 赛段，比名次）。

## 2. 移动（自动前进 + 方向）

- `Move.js:16-24`：每帧 `x += dt * Velocity.x * Speed; y += dt * Velocity.y * Speed`。方向是单位向量，速度是标量（px/s）。
- `Player.js:67-81` `SetSpeedType(STOP/NORMAL/FAST)` 切换 `stopSpeed/normalSpeed/fastSpeed`（默认均 200，`Player.js:13-22`）。
- `Player.js:42-61` `constrainBehavior()`：越界（±1234）反转对应速度分量，把鱼拉回场内。
- `RobotMgr.js:93-101` `startGame()`：AI 机器人 `Move.Speed = startSpeed`（200），`gameing=true`。
- 结论：**鱼自动前进 + 方向向量转向**；本作保留「自动前进」，把自由向改为**上下二维躲避**（侧视竞速）。

## 3. 鱼群（Leader + Follower 轨道）

- `Leader.js:23-63` `onLoad()`：`collider_radius = (Body.height+Body.width)*scale/2`；`children[]`（追随者）、`competitor[]`（掠食者）；吞噬间隔 `devourInterval=0.0618`。
- `Leader.js:96-141` `setTargetFollowPoint(tar)`：每个追随者按弧度间隔排在 leader 周围圆上，满一圈半径 +1 层。
- `Leader.js:146-173` `onDevour()`：`children.pop()`，无追随者则 `onDeath()`。
- `Leader.js:235-239` `onCollisionEnter`：撞到 `GamePlayer` 且对方 `numChildren()` 更多 → 对方吞己方。
- `Follower.js:57` 追随者最小速度 = 领导者速度 ×0.8；`Follower.js:94` 按距离在 `MinSpeed..MaxSpeed` 之间插值。
- `Follower.js:66-98`：跟随点随 leader 朝向旋转（`followPoint.rotate(0.5π + player_rad)`），再朝跟随点移动。
- 结论：**鱼群是 leader 的轨道跟随者**；本作把「鱼群散聚」做成核心决定：按住收拢=窄缝可过但慢，松开散开=快但易撞。

## 4. AI 对手

- `RobotMgr.js:57-89` `init()`：把玩家置中心，最多 8 个机器人按圆分布（间隔 `startIntervl=100`），初始 `Speed=0`，挂 `RobotAI`。
- `RobotAI.js:198-217` `update(dt)`：`observe()`（射线检测被注释掉）+ 每 `behaviorCD`（`0.2..3s`，`RobotMgr.js:16-22`）随机方向 + 边界约束（±1200）。
- `RobotAI.js:166-185` `seeOtherPlayer()`：对方鱼群比自己大就逃，比自己小就追（注释掉的射线逻辑）。
- 结论：**AI 对手 = 随机游走 + 边界约束的竞速者**；本作把 AI 改成「预判障碍 + 走气流」的竞速对手（3 个，greedy bot 需赢第 3 段名次 ≤2）。

## 5. 判定（吞噬 / 胜负 / 死亡）

- `Leader.js:274-299` `update(dt)`：`competitor` 里每 `devourInterval` 从自身 `onDevour()` 移一个追随者给对方（`setFollowTarget` + `setTargetFollowPoint`）。
- `Leader.js:305-334` `onDeath()`：玩家死亡 → `isVictor=false`、`preClose()`、400ms 后 `gameClose()`。
- `Libaiyu.js:20-22` 食物鱼 `Speed 50-100`，每 `3-7s` 随机方向，撞墙/撞食物反向。
- `GamePanel.js:158-213` `startGame()`：`loadLibaiyu()`、玩家 `SetSpeedType(NORMAL)`、给 7 个起始追随者、`isDevourSafety=false` 在 8s 后解除。
- 结论：原作「碰更小的鱼吞掉对方追随者」= 竞速里「碰到障碍减速/重创」的失败反馈；本作以鱼群数=血量、障碍碰撞掉鱼+减速。

## 6. 本作改造映射

| 原作事实 | 本作（OCEAN DASH） |
| --- | --- |
| 自动前进 `Move.js` | 侧视自动前进，↑↓/WS/指针控制上下 |
| 鱼群轨道跟随 `Follower.js` | 鱼群散聚（按住收拢=窄缝慢，松开散开=快但易撞） |
| AI 随机游走 `RobotAI.js` | 3 个预判障碍 + 走气流的 AI 竞速对手 |
| 吞噬掉鱼 `Leader.onDevour` | 障碍碰撞掉鱼 + 减速（重创） |
| 食物鱼回血/成长 `Libaiyu` | 气泡加速 + 回鱼；洋流带 = 箭形光带加速（signature） |
| 限时 20s 对抗 | 12 赛段竞速（名次 ≤2 过关） |

## 7. 原作素材/IP 全部不用

- 原作纹理 `assets/Texture/`、动画 `assets/Animation/fish*`、音频 `assets/Audios/Bgm.mp3` 等一律不引用。
- 本作：全程序化 Canvas（色板三场景包）+ WebAudio 程序化 BGM/SFX。
