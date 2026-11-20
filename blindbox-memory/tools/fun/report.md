# Fun Gate 报告（bot 遥测） — blindbox-memory

> 品类 `default` · 8 条记录 · 数据 `tools/fun/autoplay.json` · 2026-11-18T13:43:56.610Z

**结论：PASS**（10 pass / 0 warn / 0 fail）

| 指标 | 观测 | 门槛 | 判定 | 怎么修 |
| --- | --- | --- | --- | --- |
| 首次输入中位数 | 2s | 10s | ✅ pass | — |
| 输入→动作延迟中位数 | 14ms | 120ms | ✅ pass | — |
| 首胜中位数 | 9s | 90s | ✅ pass（仅 4/4 条 greedy 成功） | — |
| 至少成功一次的 run 比例 | 100% | 80% | ✅ pass | — |
| 每分钟操作数 | 101/min | 40/min | ✅ pass | — |
| 空转时间占比 | 0% | 20% | ✅ pass | — |
| 事件最大间隔 | 2s | 4s | ✅ pass | — |
| 前 3 分钟事件种类 | 9种 | 8种 | ✅ pass | — |
| 推进到第 3 关的 run 比例 | 75% | 50% | ✅ pass | — |
| 至少死过一次的 run 比例 | 50% | 30% | ✅ pass | — |

## 逐条记录

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-1 | greedy | 17s | 0s | 18ms | 1s | 90 | 0% | 1.8s | 9 | 2 | 0 |
| greedy-2 | greedy | 21s | 4s | 14ms | 9s | 96 | 0% | 1.8s | 9 | 3 | 0 |
| greedy-3 | greedy | 23s | 4s | 14ms | 10s | 99 | 0% | 1.8s | 9 | 4 | 0 |
| greedy-4 | greedy | 27s | 0s | 16ms | 8s | 101 | 0% | 1.8s | 7 | 4 | 1 |
| random-2 | random | 22s | 0s | 7ms | 11s | 285 | 0% | 0.3s | 5 | 2 | 1 |
| random-4 | random | 23s | 0s | 9ms | — | 284 | 0% | 0.3s | 4 | 4 | 1 |
| random-6 | random | 26s | 0s | 11ms | 2s | 279 | 0% | 0.4s | 5 | 6 | 1 |
| noinput-1 | noinput | 20s | 0s | 0ms | — | 0 | 100% | 0.0s | 2 | 1 | 0 |

## 怎么读

- 机器人不会无聊：这是**代理指标**，不是「好玩」的证明。成功率/推进率只统计 greedy；random/noinput 只作基线与死时间证据。
- 卡住（bot 反复失败/低推进）= 难度或可读性；空转/低事件密度 = 节奏问题。两者处方不同。
- 机器人能通关不等于玩家想玩；它只排除「进不去、没反馈、没内容、没挑战」。

参考：references/fun-design.md §10、references/playtest-protocol.md

