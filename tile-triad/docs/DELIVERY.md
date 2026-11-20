# DELIVERY — tile-triad（药草集市）

## 1) 源码分析摘要

原作「羊了个羊 cocos3.0」核心是层叠三消（详见 `docs/analysis.md`）：

- 每堆牌自底向上叠放，上层压下层（`GameManager.ts:99,109`）。
- 被压住的牌 `setGray(true)` 变灰且不可点（`Card.ts:20-28`）。
- 点击顶牌 → 平移入收槽（`GameManager.ts:138-176`），移走后翻出下层（`GameManager.ts:165-174`）。
- 槽内三同消除（`GameManager.ts:189`），槽满判负（`GameManager.ts:199`），清空判胜（`GameManager.ts:205`）。

事实结论：原作是极简 demo——无道具、无关卡推进、无求解器；本作按 spec 补齐并整体原创化。

## 2) 改造点清单

**保留（玩法规则 1:1 还原）**：层叠牌局、上层压下层灰不可点、点击移入收槽、三同消除、槽满判负、撤回/洗牌道具。

**改造 / 原创**：
- 主题原创为「药草集市」：12 类货品（香料罐/干花束/果篮/蘑菇/葫芦/香草捆/蜡烛/茶饼/蜜罐/干鱼/灯笼/钱袋），形状+颜色双编码（色盲可辨）。
- signature：三同消除时陶罐碰撞出香料烟尘 + 掌柜小猫反应动画。
- 三场景包（换章必换）：晨光集市 / 午后市集 / 灯会夜市，色板+构图+装饰互异。
- 12 关三轴递进（槽 7→6、层 2→5、品类 6→12）+ 特性：压顶大层 → 分区双塔 → 假锁层 → 限时收摊 → 道具关 → 终局大阵。
- 可解性：`generateBoard()` 逆向发牌构造必然可解，`validateSolution()` 线性校验 + `solveBoard()` 回溯 DFS 二次证明（单测覆盖全部 12 关）。
- 全程序化 Canvas 美术 + WebAudio 四层 BGM + 每事件 SFX；首次进入 4 步交互引导；存档/埋点/广告只走 `src/core/sdk.js`。

## 3) 门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 24/24 pass |
| `node tools/selfplay.mjs` | greedy 打到第 3 关并通关（levels=3, uniqueEvents=7）；random 触发败局（deaths=1） |
| `fun-report` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit` | **PASS**（100/100，26 pass） |
| `verify-game` | **pass**：60fps（avgFrameMs 16.66）、0 console error、0 失败请求、全部断言绿 |
| `i18n-check` | ✓ en/zh 各 49 key，missing=0 empty=0 |
| `tutorial-check` | ✓ 4 步、可跳过、可重看、刷新不再自动弹 |
| `sdk-check` | pass（SDK 就绪/降级/广告关/埋点/存档/分享 全绿） |
| `audio-check` | PASS（BGM 无缝循环 + 10 类 SFX RMS/时长/峰值全过） |
| `vision-review` | **PASS**：readable 8.6 / silhouette 7.1 / style 8.9（8 张，无 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）— 真实标题屏 + 大标题贴纸字
- `game.gif`（480×270，~0.9MB，前 3 秒为拾取→三消→烟尘核心玩法）
- `SEO.txt`（五关键词 TITLE/CATEGORY/TAGS/SHORT/LONG，中英双份）
- `icon.png`（256×256）、`favicon.png`（256×256）

## 5) 未做项与已知问题

- 未接真实广告账号：`config/sdk.config.js` 的 `ads.enabled=false`、`source='local'`（验收/降级模式），上线前改 `source='online'` 并配置 appId。
- 未做 ja/ko/ar/ru（按铁律未整块翻译就不暴露，当前仅 en/zh）。
- 未做每日挑战/排行榜（设计里未承诺；重玩钩子走 rating/unlock/nearMiss/growth）。
- 已知小瑕疵：掌柜小猫贴右下角台面，视觉模型偶报「与底部暗区融合」；锁图标较小，眯眼时与卡背易混（vision-review 未判 critical）。

## 6) 最不满意的一处

「假锁层」的锁与锚点规则目前偏静态——锁只锁顶牌、锚点必须整堆清空，缺乏「侧翼深挖才解锁」的动态张力；视觉上锁标偏小，传达力不足。理想形态是锁随锚点进度逐步松动，并有更醒目的「连锁解锁」表现，但为控制范围先做成可解、可测的稳定版本。
