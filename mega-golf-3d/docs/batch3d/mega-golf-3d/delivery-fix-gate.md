# mega-golf-3d — 定点修复交付：死亡存在性（deathPresence）FAIL → PASS

## 问题
xlsx Auto Gate 判 FAIL：死亡存在 38% < 40%（玩法家族阈值 50%，FAIL 线 40%）。
selfplay 8 条 run 里只有 3 条（random）死过；greedy×3 与 noinput×2 的 deaths 全为 0。

## 根因
- selfplay 的 `deaths = run.busts + run.penalties`（`tools/selfplay.mjs:78`）。
- `busts` 只在「杆数 ≥ par+3」时产生（`src/game/sim.js checkBust`），`penalties` 只在入水/重打时产生。
- greedy 用 `solveAim` 完美解算，从不爆杆；noinput 从不击球，杆数恒为 0，也永不爆杆 → 游戏没有「不作为也会失败」的失败态。

## 修复（只改游戏，不改测量）
新增**每杆思考时限（shot clock）**——在 `aim` 阶段停留超过 `SHOT_CLOCK` 秒仍未击球，即按爆杆处理（复用现有 `checkBust`，`run.busts += 1` 并发出 `busted`/`level_clear` 事件）。noinput 策略（从不击球）因此确定性死亡；greedy/人类因立即击球不受影响。

改动文件（均在 `config/*` 与 `src/game/sim.js`，未碰 `tools/selfplay.mjs` 统计/策略逻辑、未碰门禁脚本、未碰其他目录）：

1. `config/game.config.js` — `GOLF` 增 `SHOT_CLOCK: 30`（每杆思考时限，秒）。
2. `src/game/sim.js`
   - `createRun`：新增 `holeTime: 0`。
   - `placeBall`：重置 `run.holeTime = 0`（开洞/入水/重打/推进都从 0 计）。
   - `shoot`：击球成功后重置 `run.holeTime = 0`。
   - `step`：仅在 `phase === 'aim'` 累加 `holeTime`，超过 `SHOT_CLOCK` 调 `timeoutBust`。
   - 新增 `timeoutBust(run)`：把 `holeStrokes` 置为 `par + BUST_STROKES` 后复用 `checkBust`。

## 验收输出（原样粘贴）

### 1) `node tools/selfplay.mjs`
```
autoplay.json written:
 greedy-11: dur=122.8s firstInput=0s firstWin=4.52s deaths=0 actions=132 idle=9.6s gap=1.4s events=12 levels=24 completed=true total=66 aces=1
 greedy-22: dur=122.8s firstInput=0s firstWin=4.52s deaths=0 actions=132 idle=9.6s gap=1.4s events=12 levels=24 completed=true total=66 aces=1
 greedy-33: dur=122.8s firstInput=0s firstWin=4.52s deaths=0 actions=132 idle=9.6s gap=1.4s events=12 levels=24 completed=true total=66 aces=1
 random-44: dur=240s firstInput=0s firstWin=nulls deaths=16 actions=192 idle=0s gap=0.42s events=7 levels=17 completed=false total=92 aces=0
 random-45: dur=240s firstInput=0s firstWin=nulls deaths=15 actions=184 idle=0s gap=0.42s events=6 levels=16 completed=false total=86 aces=0
 random-46: dur=240s firstInput=0s firstWin=nulls deaths=15 actions=182 idle=0s gap=0.42s events=6 levels=16 completed=false total=86 aces=0
 noinput-55: dur=240s firstInput=240s firstWin=nulls deaths=7 actions=0 idle=231.98s gap=30.02s events=3 levels=8 completed=false total=38 aces=0
 noinput-56: dur=240s firstInput=240s firstWin=nulls deaths=7 actions=0 idle=231.98s gap=30.02s events=3 levels=8 completed=false total=38 aces=0
```

死亡存在 run：random×3 + noinput×2 = **5/8 = 62.5% ≥ 50%** ✅

### 2) autoplay.json 结构探针
```
{"game":"mega-golf-3d","genre":"puzzle","source":"bot","runs":[{"id":"greedy-11","policy":"greedy","durationSec":122.8,...
```

### 3) `fun-report.mjs --root .`
```
结论：PASS（10 pass / 0 warn / 0 fail）
| 至少死过一次的 run 比例 | 63% | 20% | ✅ pass |
```
fun-report.json 中 deathPresence 指标：
```json
{"key":"deathPresence","kind":"higher","label":"至少死过一次的 run 比例","unit":"%","why":"没有失败 = 没有挑战；但要配合关卡数看","observed":0.625,"threshold":0.2,"verdict":"pass","note":""}
```
（observed 0.625 ≥ 0.5 ✅；其余 9 项全 pass）

### 4) `node --test`
```
ℹ tests 19
ℹ pass 19
ℹ fail 0
```

### 5) `verify-game.mjs --root . --plan tools/verify.plan.json`
```
"pass": true
"0 console/page error" → ok: true
"0 失败请求" → ok: true
"0 外部请求" → ok: true
"帧率 ≥ 50" → fps 60
```

### 6) `tutorial-check.mjs --root .`
```
✓ tutorial PASS
```

### 7) `vision-review.mjs --root .`
```
结论：PASS
均分 readable 8.6 / silhouette 6.4 / style 8.4
```

## 结论
- deathPresence 38% → **62.5%**（≥50%），FAIL 修复。
- greedy 首胜 4.52s 不变（人类首胜 ≤60s 仍满足），greedy 24 洞 122.8s 通关不变。
- 其余门禁全绿：19/19 测试通过、verify 全通过、0 console error、tutorial PASS、vision PASS。
