# WORD DUEL · 交付报告

改造自 Cocos 3.0《文字斗争》：把「中文汉字单位召唤对轰」改造成「英文单词拼写回合制法术决斗」。
全部逻辑原创重写，零外部素材（程序化 Canvas + 程序化 WebAudio），只复刻原作的**对答攻防结构**与**数值层级**。

## 1) 源码分析摘要（原作玩法事实，带文件:行号）

原作 `local/src1/文字斗争cocos3.0/wenzidouzhenp/assets/script/` 是一款实时召唤类汉字对战（非严格回合制，但结构是「我方出手 → 敌方自动回应」）：

- **出战单位与能量**：`dlg/dlgcom/GameDlgCom.ts:44-50` 定义 5 种角色工厂（兵/勇/炮/神/医），`:53-62` 定义能量消耗表（角色 1/3/2/6/4、命令 4/10/14）。玩家在 7×14 战场（`EnemySetDlgCom.ts:28-34`）上消耗能量召唤单位。
- **倒计时判负**：`GameDlgCom.ts:132-145` `timeCountDown()` 从 `gameTime=241`（`game/prop/GameProp.ts:8-20`）递减，到 0 判 `isSucc:false`。
- **能量不足提示**：`GameDlgCom.ts:228-239` 与 `:241-254` 在能量不足时 `BubbleTipDlgCom.createTip("能量不足")`，扣能后生成角色/命令。
- **敌我数值**：`data/EnemyData.ts:5-151` 8 种敌人（墙/卒/迫/轰/灭/火/转/家，家 HP 2000 是胜负目标）；`data/RoleData.ts:6-97` 5 种角色（士兵/勇士/炮手/神/医生）。
- **血条与死亡**：`game/com/HPCom.ts:40-53` 血量归零销毁对象、满血隐藏血条。
- **气泡提示**：`dlg/dlgcom/BubbleTipDlgCom.ts:32-67` 上浮 30px + 停留 + 淡出的提示动画。
- **关卡制**：`dlg/dlgcom/LevelDlgCom.ts:32-43` 关卡列表，未解锁置灰不可点；`EnemySetDlgCom.ts:75-87` 按空位摆放敌人。

## 2) 改造点清单

**保留（结构级 1:1 还原）**
- 回合式「我方出手 → 敌方回应」的攻防节奏（拼词 = 原作的召唤出手）。
- 能量 → 字母盘取舍：原作「能量有限，召唤谁」变成「9 张字母有限，拼什么词」。
- 血条对轰、关卡制 12 个递进敌人、气泡提示（拼错/破盾/冰冻等）。
- 「伤害挂钩」：原作单位攻击力/攻速由单位类型决定 → 我方伤害由**词长 + 出手速度**决定。

**原创改造（符文决斗场主题）**
- 中文汉字单位 → 英文 anagram/拼写：每回合 9 张字母，按序点击拼词施法。
- 敌人带元素属性：火=短词两段快攻、冰=冰冻一回合、雷=答错双倍反伤。
- 签名记忆点：**长词（≥6 字母）命中时符文链在对手身上炸开成词云**。
- 三场景包（晨雾法环 / 午夜竞技场 / 星陨高塔），色板/构图/装饰互异（`config/levels.js` SCENES）。
- 12 关递进规则：常规 → 火 → 冰 → 雷 → 限时短(12s) → 词长门槛≥4 → 护盾 → heal 词回血 → 偷字 → 双生火 → 词长门槛≥5 → 终局三轴叠加。
- 词库：87,332 个 3–8 字母英文词（`config/words.js`，来自 macOS 词典过滤去重，单测校验存在性/长度分布/无重复）。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 | 关键观测 |
| --- | --- | --- |
| `node --test` | ✅ 24 pass / 0 fail | sim 逻辑 + 词库校验 |
| `tools/selfplay.mjs` | ✅ greedy 通关到第 3 关 | greedy lvl=3 completed=true；random/noinput deaths=1 |
| `fun-report.mjs` | ✅ PASS（10 pass / 0 warn / 0 fail） | 首胜 0s、事件 11 种、推进率 100%、死亡存在 67% |
| `fun-audit.mjs` | ✅ PASS 100/100（26 pass） | 3 动词有代价、7 决定、12 关、规则型升级 92% |
| `verify-game.mjs` | ✅ pass | 60fps（avgFrameMs 16.66）、0 console/page error、0 失败请求、0 外部请求 |
| `i18n-check.mjs` | ✅ OK | en/zh 各 45 key，无缺失/空值 |
| `tutorial-check.mjs` | ✅ PASS | 3 步、可跳过、可重看、持久化 |
| `sdk-check.mjs` | ✅ pass | SDK 就绪/降级/埋点/广告/存档/分享全过（2 warn 已修） |
| `audio-check.mjs` | ✅ PASS | BGM 38.4s 无缝循环 + 13 个 SFX RMS/时长/峰值全过 |
| `vision-review.mjs` | ✅ WARN | readable 7.6 / silhouette 8.6 / style 9.6，0 critical |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）— 标题屏（演示决斗场景 + 大标题）
- `game.gif`（480×270、6.7s、473KB）— 真实拼词→施法→词云爆炸循环
- `icon.png`（256×256）、`favicon.png`（64×64）— 从玩法画面裁切
- `SEO.txt` — 中英双份五关键词（TITLE/CATEGORY/TAGS/SHORT/LONG）

## 5) 未做项与已知问题

- 未接广告账号：`sdk.config.js` 的 `ads.enabled=false`（符合「未接账号保持 false」）；SDK 用 vendored 本地副本。
- 未做每日挑战/排行榜（规格未要求）；重玩钩子用评级/解锁/差一点/成长四项覆盖。
- 未做真实真人试玩数据（全自动流水线不依赖）。
- 视觉评审仍在 WARN 档：视觉模型反复挑「Swap 3 按钮黄字深底对比度略低」「顶部 HUD 文案偏小」等小项，均非 critical，已按 WARN 放行并在 TODO 记录。

## 6) 最不满意的一处

**敌方元素属性对「拼词手感」的反馈不够直观**——冰冻/偷字/护盾这些机制在逻辑与数值上都有，但视觉上只有气泡提示 + 短暂特效，玩家第一眼很难把「雷系 = 答错双倍」这种规则和画面绑定。理想是给每个元素一个常驻的敌人状态图标/光环，让规则一眼可读；当前受工期所限只做了元素配色 + 目标标记，属于「逻辑够、可读性欠一层」。
