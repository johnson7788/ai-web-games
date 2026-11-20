# CARD ROYALE · 交付说明（end-to-end 改造）

## 1) 源码分析摘要（原作玩法事实）

源码：`local/src1/卡牌demo-cocos/assets/Script/`（Cocos 3.x 扑克 demo）。

- **四花色 / 13 序**：`Enum/index.ts:10-29` 定义 `EnumSuit`（HeiTao/HongTao/MeiHua/FangKuai）、`ESuitNum`、`ECardDir`（CLOSE/OPEN）；`Model/GameDB.ts:129-130` `cardTotal=13, cardSuits=4`。
- **整副牌**：`Model/GameDB.ts:167-207` `createCardsDB()` 双层循环生成 52 张 `Poker(count, suit, dir)` 并 `shuffle(pokers, 500)`。
- **发牌**：`Model/GameDB.ts:209-244` `gamePlay()` 与 `createPlayInitDB()`——`PLAY_AREA_COUNT=7` 列，`for count=7..1` 递减发牌，共 28 张进玩牌区，其余 24 张留在 close 区（发牌堆）。这其实是 **Klondike 七列接龙** 的布牌，不是 TriPeaks。
- **玩牌区规则**：`Model/GameDB.ts:75-100` `PlayGroup.isNextPoker()`——空列只接 K(13)；否则要求 `top.suit != poker.suit && top.count - 1 == poker.count`（降序、花色不同）。
- **收牌区规则**：`Model/GameDB.ts:56-73` `ReceiveGroup.isNextPoker()`——同花从 A(1) 起升序叠放（4 组 foundation）。
- **红黑交替**：`Model/Poker.ts:35-41` `isConcatable()` / `isSimilarSuit()` 用 `ESuitNum` 奇偶判断同色。
- **交互**：`View/UIGameView.ts:123-153` `clickCardHandler()` 点击分类派发（play/open/close/receive 四区）；`UI/UIPoker.ts:81-140` 触摸拖拽 + `clickLock(0.5)` 防抖。

结论：原作是 **Klondike 接龙 demo（不完整，无胜负判定/计分/关卡）**。spec 指定「接龙式『与底牌相邻序数可出』」→ 落成 **TriPeaks 接龙**（宫廷牌局）。

## 2) 改造点清单

**保留（玩法内核对齐源码）**
- 标准 52 张牌：四花色 × 13 序（`Enum/index.ts` 的花色结构、`GameDB.ts` 的建牌思路）。
- 相邻序数出牌：把 Klondike 的「降序叠放」改造成 TriPeaks 的「与底牌相邻序数（K↔A 相接）可出」。
- 库存（发牌堆）→ 弃牌堆 → 清场的「翻牌/出牌」核心循环。

**原创改造（宫廷主题 + 完整游戏）**
- **主题**：中世纪宫廷夜宴，牌面程序化绘制宫廷人物（K 国王 / Q 王后 / J 弄臣 / A 王冠 / 2-10 点数）。
- **签名**：连续 5 张不断连出牌 →「皇家连胜」金线贯穿牌桌 + 加分。
- **三场景包**（换章必换，色板/构图/装饰互异）：烛光大厅(L1-4) / 王家花园(L5-8) / 藏宝地窖(L9-12)。
- **12 关推进**：单峰 → 三峰 → 少翻牌(0 次) → 双峰镜像 → 冻结牌(先解冻) → 同花奖励 → 鬼牌(万能 1 张) → 限时 → 藏宝冠冕(翻倍分) → 鬼牌+冻结 → 五峰 → 五峰王座(全机制叠加)。
- **可解性**：seeded 洗牌 + 求解器（DFS + 记忆化）验证，`tests/solver.test.mjs` 12 关 × 1000 种子可解率 ≥99.7%（门槛 95%）。
- **完整游戏化**：计分/连击/星级(1-3)/过关解锁/结算卡/SDK 接入/双语/交互引导/程序化音频/移动端触屏。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 23 条纯逻辑测试全过（牌阵几何/相邻序数/发牌/出牌/冻结/重翻/胜负/求解器 12 关清场 + 1000 种子可解性 ≥95%） |
| `node tools/selfplay.mjs` | ✅ PASS | greedy 串行 L1→L2→L3 通关（levels=3, completed=true, 7 种事件）；random 死亡 1 次（stuck）；noinput 基线 60s |
| `fun-report.mjs` | ✅ PASS | 10/10 指标全 pass：首胜 0s / 操作 2597/min / 空转 0% / 事件 7 种 / 推进率 100% / 死亡存在性 33% |
| `fun-audit.mjs` | ✅ PASS | 26/26 全 pass，100 分（3 动词带代价 / 8 决定 / 12 关新元素 / 80% 规则型升级） |
| `verify-game.mjs` | ✅ PASS | 1280×720 全步骤通过，60fps（avgFrameMs 16.67），0 console error，0 失败请求 |
| `i18n-check.mjs` | ✅ PASS | en/zh 各 45 key，0 缺 0 空，默认 en |
| `tutorial-check.mjs` | ✅ PASS | 4 步交互引导，可跳过/可重看/持久化不再自动弹 |
| `sdk-check.mjs` | ✅ PASS | SDK 就绪/降级/广告关闭安全/埋点/存档/分享/断网可玩，0 error |
| `tools/audio-check.mjs` | ✅ PASS | BGM 38.4s 无缝循环 + 11 个 SFX RMS/时长/峰值全过 |
| `vision-review.mjs` | ✅ PASS | readable 8.6 / silhouette 6.9 / style 8.4，8 张截图 goal_visible 全 Y、无 HUD 遮挡/文字裁切 |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）：真实玩法底图 + HTML 叠大标题。
- `game.gif`（480×270、5s 循环、485KB）：真实玩法录制（L9 藏宝地窖，逐步出牌）。
- `icon.png`（256×256）、`favicon.png`（64×64）：程序化王冠卡背。
- `SEO.txt`：TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION 中英双份。

## 5) 未做项与已知问题

- 未做：广告账号接入（`sdk.config.js` `ads.enabled=false`，按 spec「未接账号保持 false」）；无 ja/ko/ar/ru（只暴露 en/zh，符合铁律 7「没翻完整块不暴露」）。
- 已知：`sdk-check` 的「存档/分享出口」两项以 `__ll.save/__ll.ui` 暴露，故为 PASS（非 error 级）。
- 已知：TriPeaks 卡牌天然重叠，视觉模型对重叠牌的读数偶有 nit（已通过金边高亮 + 目标横幅缓解，均分 readable 8.6 达标）。
- 已知：`tutorial-check` 默认把引导截图写进 `tests/final/`（3 张 `tutorial-*.png`），已在终态清理，vision-review 只扫数字前缀的 8 张。

## 6) 最不满意的一处

牌面重叠导致的「可读性」与「TriPeaks 布牌真实性」之间的张力：为了让视觉模型与玩家一眼看懂，我把可出牌做了强金边发光 + 顶部箭头 + 目标横幅，代价是画面比纯 TriPeaks 更「花」。理想解法是给未露头牌做更强的景深压暗、给露头牌做整卡抬升，但受 Canvas 2D 工期限制，当前只做到高亮层级。
