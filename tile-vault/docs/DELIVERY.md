# Tile Vault · 交付报告

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

原作 `local/src1/3D羊了个羊/`（Cocos 3.x）核心事实：

- **底部槽容量** `GameConfig.maxCubes = 6`（`assets/Scripts/GameConfig.ts:19`）；`Main.ts` 里 `startEnergy = 6`、`maxLevel = 10`（`assets/Scripts/Main.ts:193,196`）。
- **三同消除判定**：`GameMgr.checkBotCubes`（`assets/Scripts/manager/GameMgr.ts:968`）——底部已 ≥2 枚时，若同 index 已有 2 枚（凑成 3）则 `mergeAction` 消除；否则 `L >= maxCubes-1` 判负（`GameMgr.ts:1002`）。
- **拾取**：点击 ray 命中块 → 压住变暗 → 松手若仍命中同一块则 `_GetMesh` 收走（`GameMgr.ts:823,901,950`）；命中判定 `rayHit`（`GameMgr.ts:1186`）只认最靠前（顶层）块。
- **入槽/消除动画**：`moveToBot`（`GameMgr.ts:1018`）、`refreshBot`（`GameMgr.ts:1032`）、`mergeAction`（`GameMgr.ts:1043`）。
- **重试复活**：`revive()` 把最后一枚退回场景 + 补时 30/45s（`GameMgr.ts:1091`）。
- **关卡生成**：`LevelMgr.loadLevel`（`assets/Scripts/manager/LevelMgr.ts:1325`）读 JSON `mapData:[[x,y,z,prefab]…]`，位置 `_GetPos`（`LevelMgr.ts:1394`）。
- **品类数**：`GameConfig.getCubeTypes(length)` = `3 + ⌊len/10⌋ + ⌊len/60⌋`（cap 8）（`GameConfig.ts:32`）；`getCubeKinds`（`GameConfig.ts:40`）。
- **分组保证三消可解**：`randGrp`（`GameConfig.ts:47`）把每类数量按 `size=3` 成组，保证每种牌数量是 3 的倍数。
- **计时**：`getTimer`（`GameConfig.ts:70`）；超时 → `TimerMgr.timer` → `GameMgr.GameResult(false)`（`TimerMgr.ts:1580`）。

## 2) 改造点清单

**保留（玩法 1:1 还原）**：伪 3D 堆叠拾取、只有未被压住的块可拿、被压块灰显、底部槽、三同消除、槽满失败、计时失败、重试/复活、每关推进。

**原创主题**：宝库夜盗——盗贼猫潜入地珠宝库；堆叠的是宝石箱/金杯/古币等宝物（程序化等距立方体：顶面 + 三面明暗分面）；signature：三同消除时宝物化作**金币雨落进钱袋**；三场景包（地下金库/古墓回廊/龙巢宝山），换章换色板+构图+装饰。

**改造/新增**：
- 能量系统（原作 6/6 体力 + 每日恢复）简化为**关卡内 2 次重试**（`revive()` 救回一枚 + 补时）。
- 12 关推进三轴：层数 2→6、品类 6→12、槽位 7→6；特性：压顶层/深井层/分区双堆/假锁/限时/道具关（撤回×2+洗牌×1）/龙巢终局。
- **可解性保证**：生成器（同一层内每品类整组三同）+ 贪心/回溯求解器 `solveOrder`/`isSolvable`，单测证明 12 关无道具可解。
- **可旋转视角**：拖动/按钮在 0° / 45° 两档等距视角间切换。
- 道具：`undo`（撤回最后一枚入槽）、`shuffle`（槽内宝物全部退回堆顶重排）。

## 3) 门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | PASS · 30 tests / 30 pass / 0 fail |
| `tools/selfplay.mjs` | greedy 串行打 L1→L2→L3 通关（levelsReached=3, completed=true）；random 死于槽满；noinput 死于超时 |
| `fun-audit.mjs` | **PASS** · 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report.mjs` | **PASS** · 10 pass / 0 warn / 0 fail（deathPresence 0.67，推进率 1.0） |
| `verify-game.mjs` | **PASS** · 0 console error / 0 失败请求 / fps 59.9 |
| `i18n-check.mjs` | OK · en/zh 各 38 key，0 missing / 0 empty |
| `tutorial-check.mjs` | **PASS** · visible/active/steps=3/skip/persisted/replayable 全真 |
| `sdk-check.mjs` | **PASS** · 10/10（SDK 就绪/API 齐全/降级/存档/分享/埋点） |
| `tools/audio-check.mjs` | **PASS** · BGM 无缝循环 + 8 个 SFX 全部 RMS/时长/峰值达标 |
| `vision-review.mjs` | **PASS** · readable 8.4 / silhouette 6.9 / style 8.6（8 张，0 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720 · `poster-1920.jpg` 1920×1080（真实龙巢玩法画面 + HTML 大标题贴纸字）
- `game.gif` 480×270 · 5.7s 循环 · 1.35MB（真实玩法录制：拾取 + 三同金币雨）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT/LONG 中英双份）
- `icon.png` 256×256 · `favicon.png` 64×64（从游戏画面裁切宝藏块）

## 5) 未做项与已知问题

- **假锁（fakeLock）是视觉误导**：只给被压块画锁图标，不引入真实的「侧翼可挖」额外解锁规则（见 §6）。
- 广告 `ads.enabled=false`（未接广告账号），`showRewarded` 安全返回 false；上线接账号后改 `config/sdk.config.js`。
- 未做真人试玩数据（`--human` 非门禁）；未接讲解视频（G6.5）。

## 6) 最不满意的一处

**假锁只是「画个锁」的视觉误导，没有实现 spec 里「侧翼可挖」的真实交互**。真实做「挖侧翼解锁」会显著复杂化求解器（锁块要先清邻块才能拿），而「整组三同 per 层」的可解性构造会被破坏。当前实现保住了 P0 玩法与可解性证明，但「假锁」关卡只靠锁图标制造紧张感，深度不够——这是最该在下一轮补强的点。
