# LAUNCH LEGENDS · 交付报告

> 改造自 Cocos 小游戏《一飞冲天 FlyBall》→ 原创烟花升空祭网页游戏。
> 全流程单 agent 端到端；全门禁自跑至 ≥WARN。

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

源码根：`local/src1/CocosCreator小游戏《一飞冲天》源码/FlyBall/assets/scripts/`

- **弹球竖直弹跳上升**：`Ball.ts:23-26` 定义 `dropSpeed=30 / dropAddSpeed=0`；`Ball.ts:122-183 updateTime()` 每帧 `dropAddSpeed += 40` 模拟重力，`jump()`（`Ball.ts:57-72`）给 `dropAddSpeed = -600`（普通）/ `-3000`（长跳）向上冲量；当 `node.position.y >= 568`（`Ball.ts:130-147`）不再上移而是把整屏墙体 `nodeWallRoot` 往下滚，形成「球在顶、世界下滑」的爬升错觉，`Common.totalDistance/curScore` 随滚动累加（`Ball.ts:136-148`）。
- **撞碎玻璃墙得分**：`Ball.ts:34-44 onCollisionEnter` 里 `group==Define.groupGlass` → 销毁玻璃节点 + `GameManager.flyGold()` + 粒子；`GameManager.ts:301-314 flyGold()` 让金币飞到左上角并 `Common.curGold + 1`。
- **实墙即死 / 金球无敌**：`Ball.ts:45-54` `group==Define.groupWall` 时若 `this.isGold` 直接 return（无敌可穿），否则 `GameManager.showGameOver()`；`Define.ts:79-80` 定义 `groupGlass='glass' / groupWall='wall'`。
- **金球（无敌）状态**：`Ball.ts:98-119 setGold()` 定时闪烁约 2s 后回落；`BattleView.ts:110-119 countDown` 倒计时结束后 `curBall.setGold(true)`（复活/开局赐无敌）。
- **坠落即失败**：`Ball.ts:169-181` 有金币时 `y <= -20` → `showGameOver()`；无金币时在 `y=200` 落地反复弹（`standACtion`，`Ball.ts:88-96`）。
- **左右控制横移**：原作实为「墙体左右移动」（`Wall.ts:84-124`：actionType 0 旋转 / 1 两子节点对移 / 2 整体平移），弹体 x 固定在 320——本次改造按 brief P0 要求把横移移到玩家侧（弹体左右）。
- **复活机制**：`GameManager.ts:365-375 showGameOver()` 若 `Common.isCanRevive` 弹 `ReviveView`；`ReviveView.ts:47-85` 看激励视频 / 分享 / 扣金币三选一复活，成功后 `GameManager.reveive()`（`GameManager.ts:316-325`）重置弹体。
- **分数=高度**：`Common.ts:30-35` 维护 `curScore/curDistance/totalDistance`；`Ball.ts:143-148` 每爬 100 像素 `curDistance+1`，高度即分数。

## 2) 改造点清单（保留什么 / 改了什么 / 原创主题）

**保留（玩法规则 1:1 还原）**
- 弹体持续自动竖直弹跳、玩家只负责左右横移。
- 撞碎可破坏障碍（玻璃墙 → 云絮）得分 + 加速。
- 金球无敌可撞实墙（金球 → 炽热态「尾焰烧穿一切」）。
- 撞实墙/坠落 = 失败；高度即分数。
- 复活接站点 SDK（`showRewarded('revive')` 成功才续命）。

**改（机制原创化 + 可测化）**
- 原作随机滚动墙 → 改为 **seed 确定性生成的 12 关层阵列**（`config/levels.js` + `src/game/level.js`），每层分段 `cloud 云絮 / steel 钢棚 / empty 空档`，并保证一条安全通道列（`corridor`）供 bot 与可解性校验。
- 原作「世界下滑」的连续滚动 → 改为 **离散弹跳周期**：一次弹跳 = 爬 1 层，中点为撞层判定（`src/game/sim.js:_resolveLayer`）。
- 原作金币 → **引信蓄能**：3 片云絮蓄满进入炽热态 3.5s（限时无敌 + 可烧穿钢棚），结束后引信归零。
- 原作 1 屏随机关卡 → **12 关推进**：横风 / 云絮连击 / 全钢棚 / 侧壁反弹 / 阵雨减速 / 移动云台 / 窄井通道 / 终章三轴叠加。

**原创主题（角色/场景/音乐全原创）**
- 角色：**烟花弹**（Canvas 程序化绘制：弹体 + 尾焰 + 常亮光晕，炽热态白热化）。
- 场景三章换章必换色板/构图/装饰：**小城夜空 / 云海之上 / 星环之巅**（`src/render/index.js` 三套 SCENE_PALETTES + 城景/云带/星环三套装饰）。
- 签名记忆点：**每爬 5 米在弹体周围绽放一圈迷你烟花**（`firework` 事件 → 环形火花特效）。
- 音频：原创 BGM「夜空华尔兹」（A 小调 Am–F–C–G，16 小节无缝循环）+ 12 个程序化 SFX。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 28/28 pass |
| `node tools/selfplay.mjs` | ✅ greedy 33s 通关 L1→L3（levelsReached=3）、random 死 1 次、noinput 死 1 次 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass） |
| `verify-game.mjs` | ✅ 60fps、0 console/page error、0 失败请求、12 步全过 |
| `i18n-check.mjs` | ✅ en/zh 各 40 key，0 缺失 0 空 |
| `tutorial-check.mjs` | ✅ visible/active/steps≥3/skip/persist/replay 全过 |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/API 齐全/showRewarded 安全/track/降级） |
| `tools/audio-check.mjs` | ✅ BGM 32s 无缝 + 9 SFX RMS/时长/峰值全过 |
| `vision-review.mjs` | ⚠️ **WARN**（readable 7.9 / silhouette 8.0 / style 9.3，无 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720（真实标题屏：大标题 + 烟花弹 + 迷你烟花 + 城景）
- `poster-1920.jpg` 1920×1080
- `game.gif` 480×270 循环（L3 云絮连击真实玩法录制，前 3 秒即撞云动作）
- `icon.png` 256×256 · `favicon.png` 32×32
- `SEO.txt`（TITLE / CATEGORY / TAGS / SHORT DESCRIPTION / LONG DESCRIPTION，中英双份）

## 5) 未做项与已知问题

- 广告账号未接入：`config/sdk.config.js` 的 `ads.enabled=false`、`source='local'`；上线前改 `source='online'` 并开广告位。revive 按钮仅在 `Sdk.canShowAd('revive')` 时出现，本地不显示（符合预期）。
- 移动端竖屏旋转提示：`#rotate-screen` 只有文案与跳过按钮，未实现「横屏更宽」的自动弹出逻辑（本作 1280×720 横向，桌面优先）。
- `vision-review` 为 WARN（readable 7.9，离 PASS 差 0.1），模型主要指出「GOAL/Level HUD 间距略小、火箭下方无发射台高亮」等非阻断项；已通过加大 HUD 透明度与字号、火箭 1.4×+光晕、星环下移等改善。

## 6) 最不满意的一处

**层阵列的视觉「离散跳变」**：逻辑上「一次弹跳 = 爬 1 层」，但渲染层是固定挂在判定线上、随 `layerIndex` 递增瞬间跳位，缺乏原作那种「世界连续下滑」的顺滑爬升感。为了让逻辑可测（离散判定）牺牲了连续滚动的视觉，是本作最明显的手感短板；后续若加连续滚动插值（`layerIndex` 小数化 + 层间 lerp）能显著提升爽感。
