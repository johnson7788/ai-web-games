# INK FINCH · 交付说明

> 改造自 `local/src1/黑白像素鸟-cocos/`（Cocos Creator 2.x flappy 类）→ 原创水墨网页游戏。
> slug `ink-finch` · title `INK FINCH`（墨雀）· appId `pipy-ink-finch`

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

原作是一套 Cocos Creator 2.x 的「黑白像素鸟」flappy 原型：

- **单键上扑**：`gameControl.ts:55-57` `onTouchEnd` 把 `player_rig.linearVelocity = cc.v2(0, 200)`——点击/触屏结束即给一个向上的冲量，重力由物理引擎提供。
- **穿管记分**：`playerControl.ts:46-71` 每帧找最近管柱，`checkBool` 记录是否重叠；`playerControl.ts:82-97` `addScore()` 在鸟越过管柱后 `score++` 并刷新 `scoreLabel`（文案 `score：X`），同时播一个「+分」浮字 tween。
- **即死即重开**：`playerControl.ts:66-69` 飞出屏幕上下界 → `gameOver()`；`playerControl.ts:73-80` `onBeginContact` 碰到 `pipe`/`road` 分组 → `gameOver()`；`gameControl.ts:63-67` `gameOver()` 显示结算层并 `cc.director.pause()`。
- **横向滚动管柱**：`pipeControl.ts:26,43-61` 3 根管柱以 `speed=100` 左移，`interval=(canvasWidth+pipeWidth)/2.2` 等距排列；`pipeControl.ts:63-75` 越界后在队尾重置并 `randomPN*random`（±0–300）随机缝位。
- **双层背景滚动**：`moveControl.ts:32-40` 两张背景图左移、首尾相接。
- **本地最高分**：`gameOverControl.ts:31-39` 读 `cc.sys.localStorage` 的 `maxScore`，破纪录显示 `newText`。
- **暂停/继续/回家**：`bgUIControl.ts:46-116` 设置面板（continue/home）控制 `cc.director.pause/resume/loadScene`。
- **自适应**：`fillScreen.ts:19-21` 撑满窗口避黑边；`AdjustWithHeight.ts` 分数位置按屏高自适应。

## 2) 改造点清单

**保留（玩法 1:1 还原）**
- 单键上扑（点击/空格/触屏）+ 重力下坠。
- 横向滚动的上下管柱（竹节）、穿缝 +1、撞管/落地/触顶即死、即死即重开。
- 「越过柱体记分」的判定语义（贴边穿越为惊险分 `nearMiss`）。

**原创改造（主题 + 玩法）**
- **水墨世界**：墨色雀穿过竹海，上扑溅墨点（signature 记忆点）；黑白灰 + 一抹朱砂红（得分数字/终点朱砂印/目标收集物）。
- **管柱 → 墨竹节**：程序化竹节（竹节凸起 + 竹叶 + 水墨笔触）。
- **三场景包**：晨雾竹海（mist，L1-4）/ 雨夜竹径（rain，L5-8，雨丝）/ 雪竹山道（snow，L9-12，雪山）。
- **无尽 → 12 关关卡制**：每关目标分 + 新机制：常规缝 → 窄缝 → 移动缝 → 上升气流（长按滑翔）→ 逆风（水平漂移）→ 双缝选择（近+1/远+3）→ 竹刺转轮 → 窄缝+转轮 → 逆风滑翔 → 双缝+转轮 → 疾风窄缝 → 终章·墨雪（全机制综合）。
- **工程化**：1280×720 逻辑世界 + letterbox、60Hz 固定步长、`window.__ll` 调试契约、en/zh 双语、SDK 统一出口、程序化 WebAudio（五声 BGM 四层 + 10 个 SFX）、交互式 4 步新手引导、3 策略 bot 遥测。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 30 tests / 0 fail（sim + levels 两套） |
| `node tools/selfplay.mjs` | ✅ greedy 串行到第 3 关（levelsReached=3），3 策略齐全 |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail；首胜 10s、推进率 100%、事件 9 种、空转 0%） |
| `verify-game.mjs` | ✅ pass=true · 60fps · 0 console/page error · 0 失败请求 |
| `i18n-check.mjs` | ✅ en/zh 各 40 key、0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ **PASS**（4 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | ✅ pass=true（SDK 就绪/降级/广告/埋点/存档/分享全过） |
| `tools/audio-check.mjs` | ✅ **PASS**（BGM 无缝循环 + 10 SFX RMS/时长/峰值全过） |
| `vision-review.mjs` | ⚠️ **WARN**（readable 7.9 / silhouette 7.6 / style 9.0，0 critical，0 HUD 遮挡，0 文字裁切） |

## 4) 物料路径

| 物料 | 路径 | 规格 |
| --- | --- | --- |
| 封面 | `poster.jpg` | 1280×720（真实标题屏 + 大标题贴纸字 + 玩法场景） |
| 大封面 | `poster-1920.jpg` | 1920×1080 |
| 列表动画 | `game.gif` | 480×270 · ~3s 循环 · 0.78MB（前 3 秒含上扑 + 穿缝记分） |
| SEO | `SEO.txt` | TITLE/CATEGORY/TAGS/SHORT/LONG，中英双份 |
| 图标 | `icon.png` / `favicon.png` | 256×256 / 64×64 |

## 5) 未做项与已知问题

- 广告未接账号：`config/sdk.config.js` 的 `ads.enabled=false`（符合「未接账号保持 false」）。
- 语言只暴露 en/zh（ja/ko/ar/ru 未翻译，按铁律整块不暴露）。
- 无排行榜/每日挑战（重玩钩子用 rating/unlock/nearMiss/growth）。
- **bot 遥测只覆盖 L1-L3**：greedy 可靠通关 L1/L2 并到达 L3；竹刺转轮/逆风窄缝（L7/L8/L11）对 bang-bang bot 偏难（人类可玩，bot 未能稳定通关）——不构成门禁失败，但自动玩测未覆盖后半机制。

## 6) 最不满意的一处

**bot 控制器对转轮/逆风窄缝（L7/L8/L11）不稳定**。`src/game/ai.js` 的 bang-bang + 相位前馈控制器能稳定穿常规/窄/移动缝，但面对竹刺转轮的窄半缝和逆风叠加窄缝时，爬升与时机预判不够，导致 Fun Gate 的 greedy 证据只推进到第 3 关、未能用自动玩测覆盖后半关卡机制。若要补齐，需给控制器加「转轮间隙的时序规划 + 逆风水平位置的前馈补偿」，而不是继续调参。
