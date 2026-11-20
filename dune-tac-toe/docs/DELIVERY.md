# DELIVERY — dune-tac-toe

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

原作是 Cocos Creator 竖屏井字棋（`local/src1/井字游戏-creator/`）：

- **3×3 井字棋**：棋盘 9 格 `slotRef[0..8]`，每格 `Slot.isTouched` 标记占用（`assets/Script/Slot.ts:6-7`）；落子换 SpriteFrame（`x-sheet0.png` / `circle-sheet0.png`）。
- **单机 vs 随机 AI**：`Board.getRandomArbitrary()` 里用 `Math.random()` 替 AI 随机选格，先放 O 再放 X（`assets/Script/Board.ts:84-140`）；`isPlayer2` 切换双人同屏（`Board.ts:76-82`）。
- **9 个点击入口**：`clickOne()`…`clickNine()` 逐格硬编码（`Board.ts:142-222`），每格播放 `tocGameSound`。
- **三连判胜**：`showLine()` 判横/竖/斜三连并画胜线（`Board.ts:288-367`）——**注意其索引映射是错的**（如竖线判 `[0,5,6]`、`[1,4,7]`、`[2,3,8]`，横线 `[0,1,2]`、`[5,4,3]`、`[6,7,8]`，与 3×3 行优先坐标不一致），属原版 bug。
- **平局判定**：`touchedSlots > 8`（`Board.ts:245-263`）。
- **计分/结算**：`update()` 里累计 `pointsPlayer1/2/draws` 并重开（`Board.ts:229-286`、`369-392`）。
- **转场/UI**：`ButtonNodes.ts:25-71` 悬停动画、`StartUI.ts` 标题淡入、`FadeObject.ts` 左右滑入、`Audio.ts:22-36` BGM 循环 + 落子音、`setCanvasScaleMode.ts:6-9` 竖屏 1080×1920。

## 2) 改造点清单

**保留（1:1 还原）**：3×3 井字棋、三连判胜、平局判定、双人同屏对战、胜/负/平计分。

**改了什么**：
- 修复原版 `showLine()` 的索引映射 bug，统一为标准行优先坐标 + `LINES` 常量。
- AI 从 `Math.random` 升级为三档：**random / greedy / perfect（Minimax 不可战胜）**；原「单机模式」被三档无尽对战取代。
- 新增 **12 关谜题模式**（win-in-1 → win-in-2 双威胁 → win-in-3 反杀/长线逼迫 → 第 12 关逼平完美蝎子），全部由 Minimax 单测验证唯一/存在解。
- 竖屏 1080×1920 → 横屏 **1280×720 letterbox**。
- 加入 i18n（en/zh）、首次交互引导（≥3 步）、站点 SDK 统一出口、程序化 WebAudio 音频、程序化 Canvas 美术、三场景包。

**原创主题**：沙漠「仙人掌 vs 蝎子」，形状+颜色双编码（色盲友好），三章场景（晨曦沙丘/黄昏峡谷/夜晚绿洲）。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ | 30 tests / 30 pass / 0 fail（sim + 12 关 Minimax 验证） |
| `node tools/selfplay.mjs` | ✅ | greedy 串行到第 3 关 completed；random deaths=1；noinput 基线 |
| `fun-report.mjs` | ✅ **PASS** | 10 pass / 0 warn / 0 fail |
| `fun-audit.mjs` | ✅ **PASS** | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass | 60fps、0 console/page error、0 失败请求、17 断言全过 |
| `i18n-check.mjs` | ✅ OK | en/zh 各 54 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS | visible/active/steps=3/skip/persisted/replayable 全真 |
| `sdk-check.mjs` | ✅ pass | 10 项全过（含断网降级、埋点、存档、分享、广告安全） |
| `tools/audio-check.mjs` | ✅ PASS | BGM 40s 无缝循环；8 SFX 均 RMS>0.01 / dur≤0.6s / peak≤0.98 |
| `vision-review.mjs` | ✅ **PASS** | readable 8.4 / silhouette 7.8 / style 9.1 |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）
- `game.gif`（480×270、约 104KB、4s 循环，前 3 秒为仙人掌/蝎子连续落子与获胜）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT/LONG，中英双份）
- `icon.png`（256×256）、`favicon.png`（32×32）
- 生成脚本：`tools/make-poster.mjs`、`tools/record-gif.mjs`

## 5) 未做项与已知问题

- 未接线上广告账号（`sdk.config.js` 的 `ads.enabled=false`、`source:'local'`），上线前改 `online`。
- 未做每日挑战/排行榜（spec 反范围外）。
- 移动端竖屏仅给旋转提示，未做竖屏专用布局（1280×720 横屏游戏）。
- 无尽对战的蝎子回应是同步落子（无“思考”延迟动画），手感上少一层节奏。

## 6) 最不满意的一处

**谜题难度曲线被井字棋本身的数学上限压扁了**：三子棋的“强制获胜”最深只有 3 步（win-in-4/5 在对抗最优防守时不存在），所以第 7–11 关全是 win-in-3，只能靠「反杀/挤压/长线/唯一胜点」的战术差异做区分，第 11 关退化成近乎空盘的“从零规划三步”，缺少逐关“更狠的敌人/新规则”那种真正的阶梯感。若再做，我会把“难度”转向**残局复杂度**（更多假威胁、更多等价/伪等价落点、限步压力），而不是指望 win-in 数字继续往上走。
