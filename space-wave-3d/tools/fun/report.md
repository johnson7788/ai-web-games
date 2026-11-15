# Fun Gate 报告（bot 遥测） — space-wave-3d

> 品类 `arcade` · 8 条记录 · 数据 `tools/fun/autoplay.json` · 2026-11-15T09:40:21.256Z

**结论：PASS**（10 pass / 0 warn / 0 fail）

| 指标 | 观测 | 门槛 | 判定 | 怎么修 |
| --- | --- | --- | --- | --- |
| 首次输入中位数 | 0s | 10s | ✅ pass | — |
| 输入→动作延迟中位数 | 1ms | 120ms | ✅ pass | — |
| 首胜中位数 | 2s | 60s | ✅ pass（仅 3/3 条 greedy 成功） | — |
| 至少成功一次的 run 比例 | 100% | 80% | ✅ pass | — |
| 每分钟操作数 | 311/min | 60/min | ✅ pass | — |
| 空转时间占比 | 0% | 15% | ✅ pass | — |
| 事件最大间隔 | 1s | 3s | ✅ pass | — |
| 前 3 分钟事件种类 | 12种 | 8种 | ✅ pass | — |
| 推进到第 3 关的 run 比例 | 100% | 60% | ✅ pass | — |
| 至少死过一次的 run 比例 | 100% | 50% | ✅ pass | — |

## 逐条记录

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-11 | greedy | 77s | 0s | 1ms | 2s | 555 | 0% | 1.0s | 11 | 5 | 1 |
| greedy-22 | greedy | 77s | 0s | 1ms | 2s | 636 | 0% | 1.0s | 12 | 5 | 1 |
| greedy-33 | greedy | 71s | 0s | 1ms | 2s | 589 | 0% | 1.0s | 12 | 4 | 1 |
| random-44 | random | 4s | 0s | 1ms | — | 45 | 0% | 1.0s | 6 | 1 | 1 |
| random-45 | random | 6s | 2s | 1ms | — | 66 | 0% | 1.0s | 7 | 1 | 1 |
| random-46 | random | 10s | 0s | 1ms | — | 59 | 0% | 1.0s | 7 | 1 | 1 |
| noinput-55 | noinput | 4s | 4s | 1ms | — | 0 | 0% | 1.0s | 5 | 1 | 1 |
| noinput-56 | noinput | 4s | 4s | 1ms | — | 0 | 0% | 1.0s | 5 | 1 | 1 |

## 怎么读

- 机器人不会无聊：这是**代理指标**，不是「好玩」的证明。成功率/推进率只统计 greedy；random/noinput 只作基线与死时间证据。
- 卡住（bot 反复失败/低推进）= 难度或可读性；空转/低事件密度 = 节奏问题。两者处方不同。
- 机器人能通关不等于玩家想玩；它只排除「进不去、没反馈、没内容、没挑战」。

参考：references/fun-design.md §10、references/playtest-protocol.md

