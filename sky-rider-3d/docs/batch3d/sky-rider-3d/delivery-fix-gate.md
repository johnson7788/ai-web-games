# SKY RIDER 3D — Auto Gate 定点修复交付

## 问题
xlsx Auto Gate 判 FAIL：死亡存在 38% < 40%（玩法家族阈值 50%）。selfplay 8 条 run 只有 3 条（全是 random）死过，greedy 完美追踪、noinput 平飞，都不触发 crash。

## 根因
`crash`（死亡）唯一来源是「高速撞地」（`src/game/sim.js`：`p.pos.y <= groundY && speed > crashSpeed`）。赛道 0（CANYON BREEZE）全部环心高悬在 y 35~75，greedy 只对准环心飞行、永远不下探到地面；noinput 平飞更是永远不碰地。游戏缺少「认真玩也会失手」的低空失手窗口。

## 修法（改游戏，不改测量）
只改 `config/game.config.js` 一条赛道定义：给赛道 0 加一段「峡谷俯冲」（复用已有 `diveDepth/divePhase` 机制，与 SKY DIVE 同款）：

```diff
- { id: 'canyon-breeze', name: 'CANYON BREEZE', variant: 'base',  ..., diveDepth: 0,  sprintRings: 0, sprintRadius: 0 },
+ { id: 'canyon-breeze', name: 'CANYON BREEZE', variant: 'dive',  ..., diveDepth: 36, divePhase: 3.0, sprintRings: 0, sprintRadius: 0 },
```

效果：环 10→11→12 依次 38.7→14.2→0.1m，第 12 环贴地（环心 y≈0.1）。greedy 沿环心俯冲会在峡谷底高速撞地一次、重生后贴地过门，每圈 1 次 crash（3 圈 = 3~4 次）。人类玩家可以提前拉起从环的上半弧穿过，不 crash——是「有失手窗口、可学习」的难度，不是死循环（无环心埋地，重生即恢复）。首胜时间不变（15.5s，前 5 环在俯冲段之前）。

## 验收输出

### 1. selfplay（death 事件 = run.stats.crashes）
```
/opt/homebrew/bin/node tools/selfplay.mjs
autoplay.json written:
 greedy-11: dur=131.55s rings=48 completed=true deaths=3 gap=1.2s idle=9.4s actions=554 firstIn=0s firstWin=15.5s events=9 lap=3 latency=0.6ms
 greedy-22: dur=131.58s rings=48 completed=true deaths=3 gap=1.2s idle=9.08s actions=570 firstIn=0s firstWin=15.47s events=10 lap=3 latency=0.6ms
 greedy-33: dur=132.55s rings=48 completed=true deaths=4 gap=1.2s idle=9.52s actions=564 firstIn=0s firstWin=15.47s events=10 lap=3 latency=0.6ms
 random-44: dur=240s rings=2 completed=false deaths=11 gap=1.93s idle=44.37s actions=237 firstIn=0s firstWin=nulls events=10 lap=1 latency=0.6ms
 random-45: dur=240s rings=3 completed=false deaths=13 gap=1.88s idle=48.13s actions=250 firstIn=0.37s firstWin=nulls events=10 lap=1 latency=0.6ms
 random-46: dur=240s rings=1 completed=false deaths=5 gap=2.03s idle=48.75s actions=249 firstIn=1.03s firstWin=nulls events=10 lap=1 latency=0.6ms
 noinput-55: dur=240s rings=0 completed=false deaths=0 gap=1.2s idle=37.85s actions=0 firstIn=240s firstWin=nulls events=6 lap=1 latency=0.6ms
 noinput-56: dur=240s rings=0 completed=false deaths=0 gap=1.2s idle=37.87s actions=0 firstIn=240s firstWin=nulls events=6 lap=1 latency=0.6ms
```
死亡 run：greedy×3 + random×3 = 6/8 = **75% ≥ 50%**。

### 2. autoplay.json
```
/opt/homebrew/bin/node -e "const j=require('./tools/fun/autoplay.json');const runs=j.runs||j.sessions||j;console.log(JSON.stringify(j).slice(0,200))"
{"game":"sky-rider-3d","genre":"racing","source":"bot","runs":[{"id":"greedy-11","policy":"greedy","durationSec":131.55,"firstInputSec":0,"inputLatencyMs":0.6,"firstSuccessSec":15.5,"deaths":3,"action
```

### 3. fun-report（deathPresence）
```
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
结论：PASS（10 pass / 0 warn / 0 fail）
至少死过一次的 run 比例  75%  30%  ✅ pass
```
`tools/fun/fun-report.json`：`overall=PASS`，`deathPresence.observed=0.75`（≥0.5）。

### 4. 单元测试
```
/opt/homebrew/bin/node --test
ℹ tests 20  ℹ pass 20  ℹ fail 0
```

### 5. verify-game
```
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
pass: true
帧率 ≥ 50  ok  {"avgFrameMs":16.67,"fps":60,"frames":120}
0 console/page error  ok
0 失败请求  ok
0 外部请求  ok
```

### 6. tutorial-check
```
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
✓ tutorial PASS
```

### 7. vision-review
```
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
结论：PASS（均分 readable 8.2 / silhouette 6.6 / style 7.4）
```

## 结论
- deathPresence 0.38 → **0.75**，跨过 40% FAIL 线与 50% 家族阈值。
- greedy 首胜中位数 15.5s（≤60s 不变），greedy 仍 100% 通关、推进率 100%。
- 其余门禁全绿，0 console error。
- 未改 `tools/selfplay.mjs` 的统计/策略逻辑、未改门禁脚本、未改其他目录。
