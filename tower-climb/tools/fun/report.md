# Fun Gate 报告（bot 遥测） — tower-climb

> 品类 `action` · 10 条记录 · 数据 `tools/fun/autoplay.json` · 2026-11-15T09:18:08.703Z

**结论：PASS**（10 pass / 0 warn / 0 fail）

| 指标 | 观测 | 门槛 | 判定 | 怎么修 |
| --- | --- | --- | --- | --- |
| 首次输入中位数 | 0s | 10s | ✅ pass | — |
| 输入→动作延迟中位数 | 3ms | 120ms | ✅ pass | — |
| 首胜中位数 | 2s | 60s | ✅ pass（仅 3/3 条 greedy 成功） | — |
| 至少成功一次的 run 比例 | 100% | 80% | ✅ pass | — |
| 每分钟操作数 | 131/min | 60/min | ✅ pass | — |
| 空转时间占比 | 0% | 15% | ✅ pass | — |
| 事件最大间隔 | 1s | 3s | ✅ pass | — |
| 前 3 分钟事件种类 | 11种 | 8种 | ✅ pass | — |
| 推进到第 3 关的 run 比例 | 100% | 60% | ✅ pass | — |
| 至少死过一次的 run 比例 | 80% | 50% | ✅ pass | — |

## 逐条记录

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-11 | greedy | 38s | 0s | 3ms | 2s | 270 | 0% | 1.0s | 11 | 10 | 2 |
| greedy-22 | greedy | 38s | 0s | 3ms | 2s | 270 | 0% | 1.0s | 11 | 10 | 2 |
| greedy-33 | greedy | 38s | 0s | 3ms | 2s | 270 | 0% | 1.0s | 11 | 10 | 2 |
| random-44 | random | 240s | 0s | 3ms | 42s | 128 | 0% | 1.0s | 8 | 2 | 85 |
| random-45 | random | 240s | 0s | 3ms | 23s | 130 | 0% | 1.0s | 8 | 2 | 81 |
| random-46 | random | 240s | 0s | 3ms | 12s | 131 | 0% | 1.0s | 8 | 2 | 86 |
| random-47 | random | 240s | 0s | 3ms | 9s | 127 | 0% | 1.0s | 8 | 2 | 83 |
| random-48 | random | 240s | 0s | 3ms | 10s | 131 | 0% | 1.0s | 8 | 3 | 87 |
| noinput-55 | noinput | 240s | 240s | 3ms | — | 0 | 0% | 1.0s | 2 | 1 | 0 |
| noinput-56 | noinput | 240s | 240s | 3ms | — | 0 | 0% | 1.0s | 2 | 1 | 0 |

## 怎么读

- 机器人不会无聊：这是**代理指标**，不是「好玩」的证明。成功率/推进率只统计 greedy；random/noinput 只作基线与死时间证据。
- 卡住（bot 反复失败/低推进）= 难度或可读性；空转/低事件密度 = 节奏问题。两者处方不同。
- 机器人能通关不等于玩家想玩；它只排除「进不去、没反馈、没内容、没挑战」。

参考：references/fun-design.md §10、references/playtest-protocol.md

