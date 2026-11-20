# Sand Serpent · 交付报告

> slug `sand-serpent` · title `SAND SERPENT` · appId `pipy-sand-serpent` · 改造自 `local/src1/贪吃蛇creator3.0`

## 1) 源码分析摘要（原作玩法事实）

- **入口**：`assets/scripts/gameplay/GameManager.ts:54-79` `start()` 生成棋盘 → 校验蛇配置 → `spawnRandomFruit`，监听 `INPUT_MOVE` 后发 `START_GAME`，`GAME_OVER` 弹结算。
- **网格与步进**：`objects/GameBoard.ts:22` `TILE_SIZE=28`；`configs/LevelConfig.ts` 关卡为 13 行 × 12 列 tiles 数组（`0` 空地 / `1` 墙）。蛇按 `SnakeConfig.interval`（`LevelConfig.ts` 里 `initial:0.3`）定时步进。
- **转向**：`objects/SnakeController.ts:121-131` `changeDirection` + `isLegalMove`（不能 180° 掉头、不能重复当前方向）。
- **移动/吃/死**：`SnakeController.ts:171-193` `moving()`：算下一格 → `getTileIfSafe`（墙/出界为 unsafe）→ `eatFruit` → 合法则 `moveParts`，否则 `gameOver`。`200-213` `isEatSelf()` 撞自身判负。
- **吃食变长**：`SnakeController.ts:195-198` `eatFruit`（吞食动画 + `EAT_FRUIT` 事件）、`306-323` `spawnNewTail()` 长尾巴；`295-304` `incrementEatCounter` 每 N 次进食加速。
- **刷食物**：`GameBoard.ts:35-50` `spawnRandomFruit`（随机可行走格）；`52-68` `eatFruit`。
- **分数**：`ScoreManager.ts:37-45` `addScore`（每果 +1，高分存 localStorage）。
- **输入**：`objects/keypad/KeypadController.ts:64-85` 方向键 → `INPUT_MOVE`。

**P0 还原点**：网格蛇、定时步进、吃食变长、撞墙/撞自身判负、长度即分数——全部 1:1 保留。

## 2) 改造点清单

**保留**：网格移动、方向缓冲（不能掉头/重复）、定时步进、吃食变长、撞墙/撞身判负、长度即分数、方向键输入、关卡棋盘（tiles 2D 数组）。

**原创主题**：沙漠沙蟒。食物换成沙漠生物（甲虫 +1 / 蝎子 +3 会横逃 / 骆驼刺 +5 掉一节尾巴），签名记忆点「蛇身过处留流沙波纹 + 吃食沙粒爆开」。

**新增系统**：
- 12 关推进结构（每关目标长度 + 一个新元素）：无墙穿边 → 有墙 → 仙人掌 → 蝎子 → 双食 → 加速带 → 硬地 → 沙暴 → 骆驼刺 → 组合 → 终章综合。
- 三场景包：白日沙丘 / 绿洲边缘 / 星夜荒漠（色板/装饰/构图互异）。
- 程序化 WebAudio（BGM 16 小节无缝循环 + 10 个 SFX）。
- 交互式新手引导（3 步、高亮真实 UI、可跳过/重看/持久化）。
- 触屏滑动转向；`window.__ll` 调试契约；SDK 统一出口。

**全部代码零构建纯静态**，`python3 -m http.server` 可跑。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 29 条纯逻辑测试全绿（0 fail） |
| `node tools/selfplay.mjs` | ✅ greedy 通关到第 3 关（dur 23.5s / firstSuccess 3.96s / actions 135 / deaths 0 / completed true）；random + noinput 各死 1 次 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS**（100/100，26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass（60.1 fps / 0 console/page error / 0 失败请求 / 7 张截图） |
| `i18n-check.mjs` | ✅ en/zh 各 45 key，0 缺失 0 空值 |
| `tutorial-check.mjs` | ✅ PASS（visible/active/3 步/skip/persist/replay 全过） |
| `sdk-check.mjs` | ✅ pass（SDK 对象/API/降级/0 error） |
| `audio-check.mjs` | ✅ PASS（BGM 40s 无缝循环 + 10 SFX RMS/时长/峰值全过） |
| `vision-review.mjs` | ✅ **PASS**（readable 8.3 / silhouette 7.3 / style 8.9，8 张全过，无 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720 · `poster-1920.jpg` 1920×1080（真实标题屏：沙蟒 + 贴纸标题 + 关卡格）
- `game.gif` 480×270 · 5s 循环 · 286KB（从真实玩法录制：沙蟒追食吃虫变长）
- `icon.png` 256×256 · `favicon.png` 256×256
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）

## 5) 未做项与已知问题

- 广告未接账号（`sdk.config.js` `ads.enabled=false`，插屏/激励不启用）——本地验收按降级可玩处理。
- 沙暴（L8/L12）为纯渲染雾层，不真正隐藏食物/墙（sim 判定不变）；bot 遥测不受影响。
- 触屏只做滑动转向，未加屏幕虚拟方向键（滑动已覆盖，桌面键鼠完整）。

## 6) 最不满意的一处

沙暴「遮挡视野」目前只是半透明沙雾叠加，没有做成真正的视野遮罩（食物/墙仍清晰可见），视觉冲击力弱于设计意图；受单 agent 端到端时间约束，把它落在渲染层而非真实可见性机制。
