# 趣味设计审计 — sand-serpent

> 设计源 `config/design.json` · 品类 `arcade` · 2026-11-19T05:34:04.594Z

**结论：PASS** · 分数 100/100（26 pass / 0 warn / 0 fail）

| 检查 | 结果 | 观测 | 怎么修 |
| --- | --- | --- | --- |
| 主/副乐趣合法且不同 | ✅ | primary=mastery secondary=curiosity | — |
| 一句话能被机器读懂（10–120 字） | ✅ | 58 字 | — |
| 核心动词 1–3 个 | ✅ | 3 个 | — |
| 每个动词都有代价 | ✅ | ok | — |
| 每个动词 ≥2 层反馈 | ✅ | ok | — |
| 至少一对动词能组合 | ✅ | 3 个动词声明了组合 | — |
| 第一个有代价的决定 ≤15s | ✅ | 4s | — |
| 前 3 分钟 ≥6 个有代价的决定 | ✅ | 7 个 | — |
| 每个决定都写了代价 | ✅ | ok | — |
| 教-练-变-收每段 10–60s | ✅ | teachSec=25 practiceSec=50 twistSec=45 resolveSec=20 | — |
| 一轮循环 90–180s | ✅ | 140s | — |
| 至少 3 关/幕 | ✅ | 12 关 | — |
| 每关都有新元素，且不重复 | ✅ | wrap-around edges（穿边环绕，无墙） / border walls（有墙，撞墙即死） / cactus obstacles（仙人掌障碍） / escaping scorpion（会横逃的蝎子，+3 分） / two foods at once（双食同屏） / speed boost tiles（加速带，踩到临时提速） / hard ground（硬地格，不能穿过） / periodic sandstorm（定时沙暴遮挡视野） / camel thorn（骆驼刺，+5 分但掉一节尾巴） / scorpion + cactus combo（蝎子+仙人掌组合） / boost + hard ground combo（加速带+硬地组合） / full storm finale（全要素综合） | — |
| 至少 8 个升级/道具 | ✅ | 11 个 | — |
| 「改规则」升级占比 ≥35% | ✅ | 82%（9/11） | — |
| 结算 ≥2 个重玩钩子 | ✅ | 4 个：nearMiss, growth, unlock, rating | — |
| 重玩钩子是已知类型 | ✅ | ok | — |
| 单事件反馈 2–4 层 | ✅ | 3 | — |
| 全屏级反馈 ≤2 次/10s | ✅ | 1 | — |
| 入口 ≤1 屏（最好 0 屏） | ✅ | 1 屏 | — |
| 首次输入 ≤10s | ✅ | 5s | — |
| 首次成功 ≤120s | ✅ | 40s | — |
| 首次玩有交互引导（不是说明书） | ✅ | true | — |
| 交互引导至少 3 步 | ✅ | 3 | — |
| 引导可跳过 | ✅ | true | — |
| 引导可重看 | ✅ | true | — |

## 这份审计不证明什么

- 它只查**结构性事实**：有没有决定、有没有新东西、有没有钩子。
- 真正的证据来自 bot 遥测（`fun-report --auto`）与截图评审（`vision-review.mjs`）。
- 它不能证明「好玩」；它只保证你没有在结构上做一个无聊的游戏。

