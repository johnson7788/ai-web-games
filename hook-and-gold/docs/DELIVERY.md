# HOOK & GOLD — 交付说明

端到端改造自 Cocos 2.4「黄金矿工」（`local/src1/黄金矿工creator2.4.12/`）。玩法规则 1:1 还原，主题/角色/美术/音频全原创。

## 1) 源码分析摘要（原作玩法事实，带文件:行号）

- 钩臂钟摆：`assets/scripts/HookController.js:213` `node.angle = 75 * cos(_rotateTime * 0.9 + PI/2)`，角度在 ±75° 余弦摆动。
- 点击发射：`HookController.js:79` `onActionHook()` → `HOOK_START`（直线伸出，`_hookSpeed=400` 见 `:54`）。
- 重量决定回收速度：`HookController.js:156` `moveHookHead()` 中 `speedRatio = hookWeight !== 0 ? 100/hookWeight : 1`（越重越慢）。
- 命中/回收：`HookController.js:225` `onHookCollide()` 伸出态命中 → 切 `HOOK_BACK` 入 `_hookObjects`；`hookEnd()`（`:126`）累加 `Price` 删物件。
- 越界回钩：`HookController.js:170` `isOutRange()`（x<0 / x>宽 / y<0）。
- 物件 Mass/Price：`config/MiningObjectConfig.js:5`（BIG_GOLD 300/200 … MED_STONE 500/20 等），重物贵而慢、废石重而贱。
- 关卡目标/限时：`config/LevelConfig.js:6` GOAL=[100,200,300]；`TimerController.js:53` 倒计时（demo 值 10s）；`GameController.js:106` 超时 END_LEVEL。
- 炸药道具：`buttons/DynamiteButton.js:36` → `cancelHook()` 清空当前拖拽物 + 爆炸。

## 2) 改造点清单

**保留（1:1 还原）**：钟摆摆动→点击直线伸钩→命中→按重量回收（100/weight）→按目标金额过关→限时→弃钩炸药道具。

**原创主题**：深海打捞船 + 机械锚爪。物件改为沉船残骸：金锭 / 银锭 / 古董瓶 / 废铁哑铃 / 珍珠贝（开合）/ 水母（蜇人扣时）/ 炸药桶（误钩清场）/ 黑珍珠（稀有轻值高）。

**新增机制（12 关推进）**：洋流（物件横移）→ 珍珠贝开合 → 水母群 → 炸药桶连锁 → 时间紧缩 → 深海拖拽（回收更慢）→ 黑珍珠 → 夜海低能见度（物件半影）→ 混合 → 综合 → 终章全要素叠加。三场景包：浅礁碧海 / 深蓝沉船 / 夜海月光。

**signature 记忆点**：拉起大金锭时水面气泡列 + 船身倾斜（`src/render/index.js` drawBoat 按 `hook.weight` 倾斜；`src/game/sim.js` 重物回收发 `bubble` 事件）。

**工程**：零构建纯静态 + 1280×720 letterbox + 60Hz 固定步长 + `window.__ll` 调试契约 + 英文默认/中文必做 + SDK 统一出口 + WebAudio 程序化音频（BGM 四层无缝循环）+ 全程序化 Canvas 美术 + 3 步交互引导。

## 3) 门禁最终输出摘要（全部 ≥WARN，实际全 PASS）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 29 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ greedy 通关并到第 3 关（levelsReached=3，firstSuccess 6.0s） |
| `fun-report.mjs` | ✅ PASS（10 pass / 0 warn / 0 fail；操作 51/min、空转 0%、事件种类 10） |
| `fun-audit.mjs` | ✅ PASS 100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ PASS（60 fps、0 console/page error、0 失败请求、6 张截图） |
| `i18n-check.mjs` | ✅ en/zh 各 38 key 全对齐，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS（可见/3 步/可跳过/持久化/可重看） |
| `sdk-check.mjs` | ✅ PASS（SDK 就绪/降级/广告/埋点/存档/分享全过） |
| `audio-check.mjs` | ✅ PASS（BGM 30s 无缝循环 + 12 类 SFX RMS/时长/峰值达标） |
| `vision-review.mjs` | ✅ PASS（readable 8.2 / silhouette 7.0 / style 8.3，无 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720（真实标题屏）
- `poster-1920.jpg` 1920×1080
- `game.gif` 480×270 · 4.5s 循环 · 312KB（前 3 秒即发射锚爪抓宝）
- `SEO.txt` 五个大写关键词，中英双份
- `icon.png` 256×256 · `favicon.png` 64×64
- 生成脚本：`tools/materials.mjs`（海报/图标）、`tools/record-gif.mjs`（gif）

## 5) 未做项与已知问题

- 未接广告账号：`config/sdk.config.js` `ads.enabled=false`、`source:'local'`（vendored SDK 副本），上线前改 `online`。
- 未做 ja/ko/ar/ru（按铁律，未完整翻译整块不暴露，当前只 en/zh）。
- 未做激励视频复活/金币翻倍（广告未接，结果屏无广告按钮）。
- 视觉模型提示夜海场景物件辨识度偏弱（半影是本关刻意设计，可读性仍 ≥6、无 critical），保留。

## 6) 最不满意的一处

**物件价值/目标的数值手感未经真人校准**：机器遥测（greedy 6s 过关）只能证明「能通、有反馈、没死时间」，无法证明 60 秒一关的节奏对真人是否刚好。当前目标金额与物件价值是我按「约 10–15 钩过关」拍的，若上线后真人 30 秒就过关或始终卡在时间上，需要回读 `config/objects.js` 的 value 与 `config/levels.js` 的 target 重配。
