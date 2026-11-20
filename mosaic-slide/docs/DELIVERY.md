# MOSAIC SLIDE · 交付报告（琉璃拼图坊）

> 改造自 Cocos 拼图《拼图游戏》（`local/src1/拼图游戏 cocos/`）· slug `mosaic-slide` · appId `pipy-mosaic-slide`

## 1) 源码分析摘要（原作玩法事实）

原作是一套 **Cocos Creator 图片拼图**：首页 → 选关 → 游戏，关卡图片/规格来自网络接口（`HttpUnit.GetNowLevelInfo()`）。核心事实：

- 关卡规格：`Game.ts:136-142` 从 `puzzle_cell` 拆出 `HorizontalNum × VerticalNum`，`Game.ts:158` `board.reset(H, V)` 重建棋盘。
- 图片切片：`PuzzlePiece.ts:60-82` `init()` 把纹理按行列切成矩形块，`PuzzlePiece.ts:82` `isBlank = oriCol === 0 && oriRow === 0` —— **缺口（缺片）固定左上角**。
- 洗牌：`PuzzleBoard.ts:86-114` `shuffle()` 用「缺口随机游走」50 步（`getNearPieces` + `exchangeTwoPiece`），并保证洗后已归位碎片数 ≤2。
- 交互：`PuzzleBoard.ts:165-184` `onBoardTouchEnd` 是**拖拽交换式**（把一片拖到另一片上方，`exchangeTwoPiece` 交换）；而 `PuzzleBoard.ts:205-213` `movePiece()` 是**点击滑动式**（与缺口相邻才交换），在 `Game.ts:196-197` 被注释掉。
- 判定：`PuzzleBoard.ts:218-232` `judgeWin()` = 所有碎片 `isRight`（`curCol===oriCol && curRow===oriRow`，见 `PuzzlePiece.ts:609-613`）。
- 计时：`Timer.ts:23-40` 每秒递减，到 0 发「时间用完」→ `Game.ts:192-194` 失败面板；`Game.ts:184` 过关时 `timer.stop()`。
- 过关结算：`Game.ts:171-190` `overGame()` 显示完成图 + 下一关/再玩一次/关卡列表。

## 2) 改造点清单

**保留（1:1 还原的玩法规则）**
- 缺口（缺片）固定在左上角 `(0,0)`，与源码 `isBlank(0,0)` 一致。
- 洗牌 = 缺口随机游走（记录路径，天然可解）。
- 复原原图过关、步数计分、时间计分（步数 + 时间双星，源自源码的步数/倒计时）。
- 关卡图片/规格递进（3×3 → 4×4 → 4×5 → 5×5 → …）。

**改（按 spec 的原创改造）**
- 交互从「拖拽交换」改为 **点击滑动**（spec `操作：点击滑块滑动`；源码里就是被注释掉的 `movePiece` 路径）。
- 原网络图片 → **程序化生成的彩色琉璃花窗**（`src/game/pattern.js`）：seeded 径向对称玫瑰窗，同关所有碎片来自同一图案，参考图与拼块永远一致。
- 原单一场景 → **三场景包**：工坊晨光 / 彩窗午后 / 烛光夜殿（色板 + 构图 + 装饰互异，`src/render/index.js`）。
- 新增 12 关推进机制：六边形切 / 限时 / 旋转块 / 盲拼 / 双图交替 / 6×6 终章（`config/levels.js`）。
- **signature**：完成瞬间「阳光点亮整幅花窗」的透光渐显（`src/render/index.js` 的 light bloom）。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 25 pass / 0 fail（滑块可解性逆序奇偶、shuffle 可解、旋转/盲拼/限时、三星结算、图案确定性） |
| `node tools/selfplay.mjs` | ✅ greedy 通关并串行到第 3 关（events=8、firstSuccess=0.2s）；random/noinput 各死 1 次 |
| `fun-report.mjs` | ✅ **PASS**（推进率 100%、成功率 100%、事件种类 8、空转 0%、死亡存在 67%） |
| `fun-audit.mjs` | ✅ **PASS**（score 100，25/25 全过） |
| `verify-game.mjs` | ✅ pass，60fps（avgFrameMs 16.7），0 console/page error，0 失败请求 |
| `i18n-check.mjs` | ✅ OK（en 38 / zh 38，0 missing / 0 empty） |
| `tutorial-check.mjs` | ✅ PASS（3 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/降级/广告/埋点/存档/分享全 ✓） |
| `tools/audio-check.mjs` | ✅ PASS（BGM 20s 无缝循环 + 10 个 SFX RMS/时长/峰值） |
| `vision-review.mjs` | ✅ **PASS**（readable 8.4 / silhouette 7.6 / style 9.0，0 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）— 真实标题屏 + 花窗英雄图 + 大标题贴纸字。
- `game.gif`（480×270、5.9s、0.58MB）— 逐片滑动的真实玩法 + 完成点亮。
- `SEO.txt` — 中英双份，五个大写关键词（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION）。
- `icon.png`（256×256）、`favicon.png`（32×32）— 从烛光夜殿花窗图案裁切。
- 生成脚本：`tools/poster.mjs` / `tools/record-gif.mjs` / `tools/icon.mjs`。

## 5) 未做项与已知问题

- 异形切（L5）为**六边形视觉近似**：内部仍是方形网格邻接，只把碎片画成六边形——spec 标注「六边形近似」，接受此折中。
- 无拖拽交换路径（原作的主交互被刻意改为点击滑动，按 spec 操作要求）。
- 广告位 `ads.enabled=false`（未接广告账号，符合 upload 前默认）；`source:'local'` 用 vendored pipysdk，上线前改 `online`。
- 碎片滑动为「瞬时换位」无补间动画（见第 6 节）。

## 6) 最不满意的一处

**碎片滑动没有补间动画**——现在 `slide()` 让碎片瞬间跳到缺口位。判定/门禁都正确，但手感少了「玻璃片滑过去」的顺滑与重量感，也降低了 gif 的可读性。计划下一版在 render 层加 ~120ms 的碎片位移动画（sim 不动，只渲染插值），并在 slide 后补一次轻微的音高滑音。
