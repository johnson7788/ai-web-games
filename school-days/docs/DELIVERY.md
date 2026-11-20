# SCHOOL DAYS · 山间学堂 — 交付报告

## 1) 源码分析摘要（原作「学校模拟器」玩法事实）

源码：`local/src1/学校模拟器/`（Cocos Creator，125 脚本约 12k 行）。按 spec 范围收缩，只深读了数值/日程/事件相关脚本：

- **初始金币 2000**：`assets/script/data/PlayerDataManager.ts:14`（`private _money:number = 2000`）。
- **情绪枚举 + 成绩**：`PlayerDataManager.ts:15-16`（`emotion{angry/sad/happy/surprise}`、`_grade:number=0`）。
- **天数与时段推进**：`assets/script/data/GameDataManager.ts:32`（`day=7` 起始）、`:8-13`（`timeTypeDef{morning/afternoon/evening/night}`）、`:78-100`（`nextTime()` 四段推进）、`:102-115`（`nextDay()` 日 +1 回寝室）。
- **HUD 数值展示**：`main/game/PlayerDataControl.ts:17-18`（显示 money）、`main/game/TimeDataControl.ts:14-16`（显示「第 X 天」）。
- **事件窗口模式**：`main/event/Event_Run.ts:17-41` / `Event_Read.ts:17-41` / `Event_Sleep.ts:17-47`（读 JSON 的 `iconPath/title/description`，`eventstart()` 触发小游戏/推进时间）；`main/event/eventWindow.ts`（弹窗显隐）。
- **剧情状态机**：`data/PlotDataManager.ts`（大量 NPC 对话/剧情进度，仅占位数据，无数值曲线）。
- **商店数据**：`assets/resources/shop/dachao.json`（25 种食物，仅 `type/name`，无定价数值）。
- **结论**：原作是「导航 + NPC 剧情 + 小游戏合集」，**没有**可直接照搬的属性成长数值曲线；可提取的是「日/时段推进 + 金币 + 体力 + 情绪/成绩 + 事件弹窗」的骨架。数值曲线按 spec「日程制校园经营」从 0 自设计（见 `config/game.config.js`）。

## 2) 改造点清单

**保留（原作骨架）**：初始金币 2000；「天」推进改为「周」推进；体力/金币资源；成绩/心情/声望属性概念；事件弹窗（标题/描述/二选一）模式。

**原创主题**：山间学堂——山村小学堂，学生为 5 只小熊猫村童（算学×2 / 习武×2 / 游学×1 天赋），三场景包（春日山舍 / 夏夜萤院 / 冬雪书馆），签名记忆点 = 第 12 周放榜日全村灯笼亮起、上榜村童跳起来。

**新增玩法（原作没有）**：12 周课时分配核心循环；四门科目各有代价（读书掉心情 / 习武耗体力 / 游学烧钱 / 休息只回不涨）；天赋加成（第 4 周起翻倍）；每周目标；8 个规则型周特性（体力紧张 / 双事件 / 天赋生 / 游学窗口 / 疫病 / 庆典 / 连轴 / 暴雨 / 模拟考 / 大考）。

**范围红线（未还原）**：装扮、社交、NPC 全剧情、小游戏合集——只做扎实一条日程循环。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ 20/20 | 含一周模拟确定性、结算公式、seeded 事件、天赋/游学窗口/大考等单测 |
| `tools/selfplay.mjs` | ✅ | greedy dur=34.55s firstSuccess=2.83s actions=81 levels=12 completed=true；random/noinput 正常 |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail；操作 153/min、事件 11 种、推进 100% |
| `fun-audit.mjs` | ✅ PASS | 100/100，26 pass / 0 warn / 0 fail |
| `verify-game.mjs` | ✅ pass | 60.1fps、0 console error、0 失败请求、12 周格、中英切换、三场景、暂停/恢复 |
| `i18n-check.mjs` | ✅ | en 138 key = zh 138 key，无缺失/空值 |
| `tutorial-check.mjs` | ✅ PASS | 4 步、可跳过、持久化、可重看 |
| `sdk-check.mjs` | ✅ pass | SDK 对象/API 齐全、广告关闭安全 false、降级可玩、0 error |
| `tools/audio-check.mjs` | ✅ PASS | BGM 40s 无缝循环、13 SFX 全 ≤0.6s、未知事件静音 |
| `vision-review.mjs` | ✅ PASS | 8 张均分 readable 8.3 / silhouette 8.4 / style 8.9，无 critical |

## 4) 物料路径

- `poster.jpg` 1280×720（真实标题屏 + 贴纸标题）
- `poster-1920.jpg` 1920×1080
- `game.gif` 480×270、6.0s 循环、约 1.4MB（前 3 秒为点科目卡排课 + 结束本周）
- `SEO.txt` 五关键词大写、中英双份
- `icon.png` 256×256 PNG、`favicon.png` 64×64 PNG

## 5) 未做项与已知问题

- 未做：多存档位、设置里单独关震屏、每日挑战/排行榜（meta 成长留白）。
- 已知问题：视觉模型两次提到「熊猫头顶天赋圆点无图例」——功能上不影响（天赋主要影响数值），属可读性小瑕疵，未做图例；结果屏标题与三星在个别视角下有轻微层次拥挤（vision 已判非 critical）。
- 周格（level-grid）点击是「重新开始一局」而非「跳到第 N 周并携带进度」——连续经营的存档跨周由 `starsByWeek/bestWeek` 记录，跳周仅用于 debug 截图。

## 6) 最不满意的一处

结果屏（放榜）目前是**不透明 DOM 弹窗盖在灯笼画面上**：签名画面「全村点灯」要靠 `scene-shots.mjs` 临时隐藏遮罩才能被看到，玩家实际通关后第一眼看到的是文字卡片，而不是灯笼齐亮 + 村童跳起来的瞬间。理想做法是把放榜做成「先露 1.5 秒灯笼动画，再弹文字结算卡」，让签名记忆点成为玩家亲眼看到的画面而不是藏在遮罩后面。
