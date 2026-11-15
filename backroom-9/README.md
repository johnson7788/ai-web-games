# BACKROOM 9（后室第九层）

> 程序化后室迷宫：找 9 个出口，一个实体在追你。转身瞬间，身后的黄墙已经悄悄换了位置，荧光灯闪了一下。

## G0 · 立项八问

1. **一句话**：玩家在第一人称后室迷宫里，一边躲开实体的追逐、一边依次找到 9 个发光出口，每找到两个出口、身后的迷宫就被重组一次。
2. **参考**：dirien/backrooms（只借鉴房间拼接思路，代码全重写）+ 后室都市传说视觉。
3. **差异化**：① 迷宫每 2 出口重组（旧路失效，签名不安感）② 实体有听觉（跑/喘引它）+ 视觉（直视 3s 触发追逐）③ 体力-躲藏-噪音三角：跑得快但耗体力、体力空会喘气引来实体、躲桌底是 50% 的赌博。
4. **操作**：桌面 WASD + 鼠标视角 + Shift 跑 + E 躲/交互 + M 地图；触屏左摇杆移动 + 右滑视角 + 跑/躲/图按钮。
5. **一局**：约 3–5 分钟通关 9 出口；失败不扣命，被抓回当前段起点并扣时间；爽点在第 10–20 秒找到第一个出口、以及每次死里逃生。
6. **成长**：局内成长 = 体力药（稀缺）+ 对迷宫的记忆；跨局成长 = 最佳用时 / 最少被抓纪录存档 + 每日 seed 全球同题。
7. **结局**：通关看到胜利结算（用时/被抓次数/新纪录）；被抓回起点继续；重开回到标题。
8. **乐趣**：主乐趣 = 好奇（探索未知迷宫），副乐趣 = 掌控（学会用脚步/体力/躲藏管理实体）。第 3 分钟玩家还想继续，因为每次重组都让熟悉的路线作废、逼你重新建立空间感。

**乐趣假设**：好奇 + 紧张感驱动探索——实体听觉/视觉让每一步都有代价，迷宫重组让「记住的路」失效。G0.5 验证方式：fun-audit 结构审计（PASS）+ 自动玩测（greedy/random/noinput 遥测）。

**签名记忆点**：转身瞬间，身后的黄墙迷宫已经悄悄换了布局，荧光灯闪了一下。

**反范围（不做）**：联机 / 战斗 / 超过 9 出口 / 剧情文本 / jumpscare 闪屏。

**美术来源**：低多边形后室，色板 壁纸黄 `#d4c17a` + 地毯棕 `#8a7340` + 荧光白 `#f5f5dc` + 阴影黑 `#2a2416`；墙面/地毯/天花板贴图由 Lead 并行 AI 生成（`assets/sky.jpg` 壁纸 / `assets/tex/carpet.webp` / `assets/tex/ceiling.webp`），加载失败回退程序化纯色。

## 运行

```bash
cd games/backroom-9
python3 -m http.server 8124   # 打开 http://127.0.0.1:8124/
```

## 数据契约

### 世界 / 坐标
- 逻辑视口 1280×720 letterbox；固定 60Hz 步长（`STEP=1/60`）。
- 迷宫 = `GRID_W(9)×GRID_H(9)` 个房间，每格 `CELL=8` 单位；墙高 `WALL_H=4`，眼高 `EYE=1.7`，地面 y=0。
- 房间网格中心 `(i+0.5)*CELL, (j+0.5)*CELL`；墙段轴对齐 `{x1,z1,x2,z2}`，`maze.openE/openS` 记录房间间开口。

### 实体字段
```js
run.player { x, z, yaw, pitch, stamina, pantT, hidden, moved, sprinted, hiddenOnce }
run.entity { x, z, yaw, state('wander'|'chase'|'search'), tx, tz, stare, searchT, lastX, lastZ }
run.maze   { walls[], W, H, C, openE, openS, tables[], pickups[], exits[] }
run        { seed, phase('playing'|'won'), time, penalty, segment(1..5), exitIndex(0..8), caught, activeExit, segStart, explored{} }
```

### 事件总线（sim 发 → render/audio/ui 各自消费）
`start / footstep / flicker / chase / search / wander / caught / hidden / unhidden / panting / pickup / exit_found / maze_regen / win`

### 模块 API
```js
createRun({ seed }) -> run           // 纯逻辑，seed 决定迷宫
updateSim(run, input)                 // 固定步长一步
getHud(run) -> { time, exitsFound, segment, caught, stamina, hidden, panting, entityState, phase }
drainEvents(run) -> Event[]
Render.createRenderer(canvas).render(run, dt, phase)
UI { showTitle/showGame/showPause/showResults/updateHUD/drawMap/applyLang/hint/tutorial }
Audio.createAudio() { unlock/setMuted/muted/play/setHum/setDanger }
Sdk { available/ready/newRun/levelCleared/gameOver/track/save/load/share }  // 唯一平台出口
```

### 输入契约（main 读原始输入 → sim 消费）
```js
{ moveX:-1..1, moveZ:-1..1, sprint:bool, hide:bool(边沿), lookDX:rad, lookDY:rad }
```
边沿检测归 main（`Input.hit`），sim 只吃稳态 + 视角增量。

### 状态机
```
title -> playing -> (paused) -> results -> title
                  \-> caught 回当前段起点（不扣命，扣时间）
```

### 标准调试口 `window.__ll`
`state.phase` / `run` / `start` / `pause` / `resume` / `restart` / `startAct` / `tutorial{active,step,steps,current,skip}` / `save` / `ui` / `lang` / `setLang` / `debug{reachExit,win}` / `telemetry()`。

## 测试 / 验收

```bash
node --test                                    # 纯逻辑（21 条）
node tools/selfplay.mjs                        # bot 遥测 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 已知 TODO（对账用）

1. **升级系统未实装**：`design.json` 声明的 8 个升级（marker-sense / silent-sprint / 体力上限…）只作为设计结构存在，玩法层未接入升级选择屏（brief §3 未要求）。G7 迭代时补「每 2 出口三选一升级」。
2. **红/黄门决策未实装**：`design.json` levels[4] 的红门近路 vs 黄门远路选择未做（brief §3 未要求），当前只有单一出口路径。
3. **躲桌底无 peek**：躲藏时是纯静止状态，没有「探头观察」机制（design 的 `peek-hide` 升级同样未做）。
4. **触屏摇杆**：复用 base3d `Input` 的左半屏摇杆 + 右半屏视角；跑/躲/图用右下角按钮，未做独立摇杆皮肤。

## 目录

```
config/        game.config.js / locales.js / sdk.config.js / design.json
src/core/      base3d.js(底座) / i18n.js / save.js / sdk.js / audio.js
src/game/      sim.js（纯逻辑）
src/render/    index.js（three.js 程序化渲染）
src/ui/        ui.js（屏幕/HUD/教学/小地图）
src/main.js    装配 + 状态机 + 调试口
src/vendor/    pipysdk.js（vendored，验收用）
tools/         selfplay.mjs / verify.plan.json
tests/         sim.test.mjs
```
