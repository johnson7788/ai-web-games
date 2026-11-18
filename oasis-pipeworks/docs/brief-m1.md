# Oasis Pipeworks · M1 执行单：模拟层（sim + 关卡 + 测试 + 自对弈）

> 前置：骨架已生成；契约见 `docs/README.md`（唯一真相，动手前先读 §3 与 §4）。
> 只改：`src/game/sim.js`、`src/game/level.js`（可选）、`config/levels.js`、`tests/*.test.mjs`、`tools/selfplay.mjs`。
> 禁改：`index.html`、`src/main.js`、`src/render/*`、`src/ui/*`、`src/core/*`、`config/game.config.js`。

## 0. 完成定义（可验收）

- `node --test` 全绿（≥20 条断言，含可解性 solver）。
- `node tools/selfplay.mjs` 输出 `tools/fun/autoplay.json`：greedy 策略能通关 L1，并输出标准遥测（firstInputSec/firstSuccessSec/deaths/操作数/事件数）。
- 冒烟：`createRun(0,{seed:1}) → step → grab → place(0,1) → getHud → drainEvents` 无异常。

## 1. 硬约束

- `src/game/*` 纯逻辑：零 DOM/window/localStorage/Date.now/canvas；随机一律走注入 seed 的 mulberry32（可复现）。
- 覆盖骨架原来的 `createSim/updateSim`；导出改为契约 §3.3 的 `createRun(levelIndex, {seed})`。为兼容旧测试可同时保留 `createSim` 别名（可删旧测试，重写全部）。
- `config/levels.js` 导出 `LEVELS`（契约 §4 的 12 关表逐字落实）与 `LEVEL_COUNT`。每关字段：`{ index, scene, rows, cols, time, blockTime, rocks:[[r,c]], blooms:[[r,c]], start:{r,c,entrance}, end:{r,c,entrance}, queueCap, difficulty, tutorial?, failSafe?, teachSteps?, newElement }`。
- 可解性：写 `solver`（BFS/DFS 找一条从 start 到 end 的管路，岩石不可穿）在测试里验证 12 关全部可解，且 L1 在 failSafe 档（无岩石阻挡的最短路 ≤ cols+rows）。
- 水流推进：格内进度 `t` 0→1 用 `blockTime` 秒线性（或 easeInOut）；到 1 时查下一格 `opens(piece)` 匹配 → `cellWatered`，否则 win/lose 判定（水停在 end 格 = win；其余 = lose 'deadEnd'）。倒计时到 0 且水未开始 → `lose 'timeOut'`（水已开始则流完为止）。
- 队列：`queueCap` 槽；`grab()` 抓底槽第一件（未锁定）；取走后上方件下落（`offsetT` 动画计时，1.0 递减到 0；render 用它做视觉），顶槽补新件（权重：E/N 各 0.22，四弯各 0.12，X 0.08（仅 L5+ 出现在权重里）；L10+ 有 1 件带 `locked`，`placements>=3` 解锁）。
- 铲除：`digLeft` 初始 1；`dig(r,c)` 清 `pipe` 格为 empty（发 dig 事件）；`addDig()`（广告补，main 调用）+1，上限 2。
- 星级：win 时 `stars = 1 + (blooms===bloomTotal?1:0) + (timeLeft >= initialTime*0.3?1:0)`；发 `win` 事件。

## 2. 交付物

- `src/game/sim.js`（≤600 行，模块头注释：职责/依赖/契约指针）
- `config/levels.js`（12 关数据 + 注释）
- `tests/sim.test.mjs`（核心规则）、`tests/levels.test.mjs`（可解性 + 关卡表完整性：twistAxis/难度锯齿不必管，但 rocks 不压 start/end、blooms 不在 rock 上）
- `tools/selfplay.mjs`（Node 无头：用固定 seed 驱动 greedy 策略完成一局 L1，产出 `tools/fun/autoplay.json`；schema 见 `skills/webgame-playbook/references/playtest-protocol.md` §3，至少 greedy/random/noinput 三策略；无 DOM 依赖，直接 import sim）

## 3. 契约

`docs/README.md` §3（管型语义 / API / state 形状 / 事件表）逐字实现。事件对象除 type 外字段勿增删改名。

## 4. 行为规格

- 时间：`step(dt)` 累计；countdown 阶段 `timeLeft -= dt`；flowing 后时间不再倒扣（星级用的 timeLeft 冻结在 flowStart 时刻）。
- `place` 校验：selected 非空、格子 kind==='empty'（bloom 格是 empty+bloom 标记，可放）→ 置 kind='pipe'，`placements++`，发 place。
- 起终点格：kind='start'/'end'，自带 piece 'N'（或关卡定义），不可放置不可铲。
- bloom 计数：水流经 bloom 格发 `bloom` 事件、`blooms++`（同一格只计 1 次）。

## 5. 验收命令（自己跑并贴输出）

```bash
cd games/oasis-pipeworks
node --test
node tools/selfplay.mjs
cat tools/fun/autoplay.json | head -20
```

## 6. 优先级

- P0：sim 完整规则 + 12 关 + 测试 + solver
- P1：selfplay 遥测三策略
- P2：L1 的 teachSteps 元数据（供 tutorial 用）：`teachSteps: ['grab','place','flow']`

## 7. 交付格式

1) 文件清单 2) 测试输出 3) autoplay.json 摘要 4) 未做项 5) 最不满意的一处
