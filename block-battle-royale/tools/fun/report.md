# Fun Gate 报告（bot 遥测） — block-battle-royale

> 品类 `action` · 8 条记录 · 数据 `tools/fun/autoplay.json` · 2026-11-15T09:31:05.515Z

**结论：PASS**（10 pass / 0 warn / 0 fail）

| 指标 | 观测 | 门槛 | 判定 | 怎么修 |
| --- | --- | --- | --- | --- |
| 首次输入中位数 | 0s | 10s | ✅ pass | — |
| 输入→动作延迟中位数 | 2ms | 120ms | ✅ pass | — |
| 首胜中位数 | 10s | 60s | ✅ pass（仅 3/3 条 greedy 成功） | — |
| 至少成功一次的 run 比例 | 100% | 80% | ✅ pass | — |
| 每分钟操作数 | 409/min | 60/min | ✅ pass | — |
| 空转时间占比 | 0% | 15% | ✅ pass | — |
| 事件最大间隔 | 1s | 3s | ✅ pass | — |
| 前 3 分钟事件种类 | 13种 | 8种 | ✅ pass | — |
| 推进到第 3 关的 run 比例 | 67% | 60% | ✅ pass | — |
| 至少死过一次的 run 比例 | 63% | 50% | ✅ pass | — |

## 逐条记录

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-11 | greedy | 157s | 0s | 2ms | 11s | 190 | 0% | 0.5s | 14 | 5 | 0 |
| greedy-22 | greedy | 87s | 0s | 2ms | 10s | 139 | 0% | 0.5s | 13 | 4 | 0 |
| greedy-33 | greedy | 12s | 0s | 2ms | 10s | 154 | 0% | 0.5s | 12 | 1 | 1 |
| random-44 | random | 10s | 0s | 2ms | — | 627 | 0% | 0.5s | 11 | 1 | 1 |
| random-45 | random | 10s | 0s | 2ms | — | 772 | 0% | 0.5s | 11 | 1 | 1 |
| random-46 | random | 240s | 0s | 2ms | 26s | 647 | 0% | 0.5s | 13 | 5 | 0 |
| noinput-55 | noinput | 21s | 21s | 2ms | — | 0 | 0% | 0.5s | 11 | 1 | 1 |
| noinput-56 | noinput | 10s | 10s | 2ms | — | 0 | 0% | 0.5s | 11 | 1 | 1 |

## 怎么读

- 机器人不会无聊：这是**代理指标**，不是「好玩」的证明。成功率/推进率只统计 greedy；random/noinput 只作基线与死时间证据。
- 卡住（bot 反复失败/低推进）= 难度或可读性；空转/低事件密度 = 节奏问题。两者处方不同。
- 机器人能通关不等于玩家想玩；它只排除「进不去、没反馈、没内容、没挑战」。

参考：references/fun-design.md §10、references/playtest-protocol.md

