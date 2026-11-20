# 趣味设计审计 — dig-deep

> 设计源 `config/design.json` · 品类 `arcade` · 2026-11-19T14:31:00.305Z

**结论：PASS** · 分数 100/100（26 pass / 0 warn / 0 fail）

| 检查 | 结果 | 观测 | 怎么修 |
| --- | --- | --- | --- |
| 主/副乐趣合法且不同 | ✅ | primary=mastery secondary=curiosity | — |
| 一句话能被机器读懂（10–120 字） | ✅ | 70 字 | — |
| 核心动词 1–3 个 | ✅ | 3 个 | — |
| 每个动词都有代价 | ✅ | ok | — |
| 每个动词 ≥2 层反馈 | ✅ | ok | — |
| 至少一对动词能组合 | ✅ | 3 个动词声明了组合 | — |
| 第一个有代价的决定 ≤15s | ✅ | 6s | — |
| 前 3 分钟 ≥6 个有代价的决定 | ✅ | 7 个 | — |
| 每个决定都写了代价 | ✅ | ok | — |
| 教-练-变-收每段 10–60s | ✅ | teachSec=30 practiceSec=45 twistSec=45 resolveSec=15 | — |
| 一轮循环 90–180s | ✅ | 135s | — |
| 至少 3 关/幕 | ✅ | 12 关 | — |
| 每关都有新元素，且不重复 | ✅ | dig cells / diamonds refill energy / drill unlocked (2-power, 2-cost) / fault lines collapse under shovel + laser unlock / hard rock arrays / rising dark river speeds up + fossil-dense / giant fossil puzzle cells / diamond lode / faults stacked with hard rock / lava pockets to avoid / ember chasm: diamonds over lava / magma rises faster / reach the molten core (signature) | — |
| 至少 8 个升级/道具 | ✅ | 8 个 | — |
| 「改规则」升级占比 ≥35% | ✅ | 63%（5/8） | — |
| 结算 ≥2 个重玩钩子 | ✅ | 4 个：nearMiss, unlock, growth, rating | — |
| 重玩钩子是已知类型 | ✅ | ok | — |
| 单事件反馈 2–4 层 | ✅ | 3 | — |
| 全屏级反馈 ≤2 次/10s | ✅ | 1 | — |
| 入口 ≤1 屏（最好 0 屏） | ✅ | 1 屏 | — |
| 首次输入 ≤10s | ✅ | 4s | — |
| 首次成功 ≤120s | ✅ | 20s | — |
| 首次玩有交互引导（不是说明书） | ✅ | true | — |
| 交互引导至少 3 步 | ✅ | 4 | — |
| 引导可跳过 | ✅ | true | — |
| 引导可重看 | ✅ | true | — |

## 这份审计不证明什么

- 它只查**结构性事实**：有没有决定、有没有新东西、有没有钩子。
- 真正的证据来自 bot 遥测（`fun-report --auto`）与截图评审（`vision-review.mjs`）。
- 它不能证明「好玩」；它只保证你没有在结构上做一个无聊的游戏。

