# Fun Gate 报告（bot 遥测） — haunted-wing

> 品类 `narrative` · 8 条记录 · 数据 `tools/fun/autoplay.json` · 2026-11-15T09:33:00.757Z

**结论：PASS**（10 pass / 0 warn / 0 fail）

| 指标 | 观测 | 门槛 | 判定 | 怎么修 |
| --- | --- | --- | --- | --- |
| 首次输入中位数 | 0s | 12s | ✅ pass | — |
| 输入→动作延迟中位数 | 2ms | 120ms | ✅ pass | — |
| 首胜中位数 | 1s | 90s | ✅ pass（仅 3/3 条 greedy 成功） | — |
| 至少成功一次的 run 比例 | 100% | 80% | ✅ pass | — |
| 每分钟操作数 | 88/min | 20/min | ✅ pass | — |
| 空转时间占比 | 21% | 30% | ✅ pass | — |
| 事件最大间隔 | 2s | 5s | ✅ pass | — |
| 前 3 分钟事件种类 | 9种 | 6种 | ✅ pass | — |
| 推进到第 3 关的 run 比例 | 100% | 50% | ✅ pass | — |
| 至少死过一次的 run 比例 | 63% | 0% | ✅ pass | — |

## 逐条记录

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-11 | greedy | 9s | 0s | 2ms | 1s | 39 | 23% | 2.1s | 9 | 5 | 0 |
| greedy-22 | greedy | 11s | 0s | 2ms | 1s | 32 | 18% | 2.0s | 9 | 5 | 0 |
| greedy-33 | greedy | 9s | 0s | 2ms | 1s | 38 | 21% | 1.9s | 10 | 5 | 0 |
| random-44 | random | 17s | 0s | 2ms | — | 138 | 32% | 4.6s | 8 | 1 | 3 |
| random-45 | random | 17s | 0s | 2ms | — | 138 | 45% | 5.6s | 8 | 1 | 3 |
| random-46 | random | 18s | 0s | 2ms | — | 138 | 43% | 5.7s | 8 | 1 | 3 |
| noinput-55 | noinput | 20s | 20s | 2ms | — | 0 | 34% | 4.5s | 7 | 1 | 3 |
| noinput-56 | noinput | 20s | 20s | 2ms | — | 0 | 34% | 4.5s | 7 | 1 | 3 |

## 怎么读

- 机器人不会无聊：这是**代理指标**，不是「好玩」的证明。成功率/推进率只统计 greedy；random/noinput 只作基线与死时间证据。
- 卡住（bot 反复失败/低推进）= 难度或可读性；空转/低事件密度 = 节奏问题。两者处方不同。
- 机器人能通关不等于玩家想玩；它只排除「进不去、没反馈、没内容、没挑战」。

参考：references/fun-design.md §10、references/playtest-protocol.md

