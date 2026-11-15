# RAGDOLL ARCHERS 3D（布偶弓箭手）

> 低多边形罗马竞技场里的布偶弓箭决斗。拉弓 → 抛物线 → 箭插进对方身体 → 慢镜头看布偶瘫倒。
> 平台：浏览器（桌面 + 移动）· 默认英文（en）+ 中文（zh）· 纯静态零构建、零运行期外链（仅 pipysdk 可降级）。

## 0. 立项八问（G0）

1. **一句话**：玩家在竞技场里拖拽拉弓，计算抛物线松手放箭，箭插进对方布偶身体、整个布偶被带飞瘫倒，慢镜头环绕回放。
2. **参考**：只借鉴品类——`pemmyz/js_rapier_ragdoll_v1`（布偶约束思路，MIT，我们用 cannon-es 重写）+ `games/paw-brawl`（布偶瘫软表现）+ 怒鸟式拖拽抛物线。
3. **差异化**：① 3D 物理布偶中箭部位受冲量、击杀瞬间瘫软（不是血条掉血）；② 拖拽方向/长度=角度/力度 + 12 点抛物线预览（受风偏移）；③ 击杀 0.8s 慢镜头相机环绕。
4. **操作**：桌面 = 鼠标拖拽拉弓松手放箭，A/D 横移；触屏 = 触屏拖拽 + 左下 ◀▶ 按钮。3 秒看懂。
5. **一局**：5 关决斗，每关一个新元素；玩家 3 心，被击倒扣 1 心重开本关；爽点在第 2–4 秒第一次命中、第 8–15 秒第一次慢镜头击杀。
6. **成长**：局内 = 每关后三选一升级（穿透/分裂/瞄准慢放/御风/快速箭袋/强弓/重箭/疾靴）；跨局 = 最佳用时 + 最佳爆头数存档。
7. **结局**：通关 5 关 → 星级结算（剩余心数）+ 用时 + 爆头数；心耗尽 → 战败结算；均可一键重开。
8. **乐趣**：主乐趣 = 掌控（mastery，抛物线解算 + 风补偿 + 爆头精准），副乐趣 = 表达（expression，拖拽力度角度自选弹道）。第 3 分钟还想继续 = 想用更少箭、更多爆头刷星。第一个有代价的决定在第 ~2 秒：拉多满、瞄多高。

**签名记忆点**：箭插进布偶肩膀，整个布偶被带飞瘫倒在地，慢镜头环绕回放。

**反范围（不做）**：联机对战 / 超过 5 关 / 角色皮肤 / 剧情对话 / 3v3。

## 1. 数据契约（design-doc §5.3）

**世界/坐标**：米制，地面 y=0，重力 -9.82；玩家固定 x=-6、对手 x=+6；z 为横移轴（±3.2 内）；固定步长 1/60，逻辑视口 1280×720。

**实体**：
- `player = { x, z, aimAngle, aimPower, drawing, invulnT, alive }`（逻辑弓手，3 心，无刚体）
- `enemy = { id, x, z, baseY, alive, torsoHits, disarmT, bowDropped, accuracy, parts }`，`parts = { head/torso/armL/armR/legL/legR: { body, r, part } }`（cannon-es 刚体，存活 KINEMATIC 站桩、击杀切 DYNAMIC 瘫软）
- `arrow = { id, body, owner:'player'|'enemy', flying, stuckTo, pos, quat }`（cannon 刚体飞行，命中后挂接到部位）
- `crate / platform`：静态障碍（第 3/4 关）

**事件**（sim 发，main 分发到 audio/ui/sdk）：
`start, draw, shot, enemy_shot, hit{part}, kill{headshot}, ragdoll, level_clear, level_restart, heart_lost, wind, upgrade_offer, upgrade, win, dead, fail, quiver_empty`

**API**：
```js
createRun({ seed }) -> run
run.step(input) / run.drainEvents() / run.getHud()
run.getUpgradeChoices(n) / run.applyUpgrade(id) / run.solveAim(part)
solveAim(run, part) / solveVelocity(from,to,wind,maxSpeed) / forceKillEnemies(run)
```
**输入**：`{ strafe:-1|0|1, aim:{angle,power}|null, fire:bool }`（拖拽→角度/力度在 main 层换算；held/pressed 边沿归 main）。

**状态机**：`main.state`：`title → playing ⇄ paused`，`playing → upgrade → playing`，`playing → results → title`。`run.phase`：`duel → levelClear → upgrade|won`，`duel → dead`。

**i18n**：默认 en；zh 必做；ja/ko/ar/ru 未翻译整块不暴露。`?lang=` > localStorage > en；下拉 `#lang-select` + 刷新保留。

## 2. 已知 TODO（诚实列出）

- 素材占位：`assets/sky.jpg` / `tex/sand.webp` / `tex/wood.webp` / `audio/bgm.mp3` 为 AI 生成件（Lead 已出图），渲染与音频已接线、缺件回退程序化不报错。
- 触屏拖拽判定在画布内（非全屏），竖屏建议横屏游玩。
- 慢镜头相机环绕为固定半径 7m，未按击杀部位做特写。
- 第 5 关双对手对静止站位较难；AI 未做「预判玩家移动」的高级瞄准。
- `best` 存档语义为「最短通关用时」（越小越好）；首次通关前显示 0s。

## 3. 运行与验收

```bash
cd ragdoll-archers-3d
python3 -m http.server 8124   # 或任意静态服务器
# 全套门禁见 docs/batch3d/ragdoll-archers-3d/delivery.md
```

## 4. 目录

```
config/   design.json（机器可读设计源）/ game.config.js（数值）/ locales.js（en+zh）/ sdk.config.js
src/core/ base3d.js / i18n.js / save.js / sdk.js / audio.js
src/game/ sim.js（cannon-es 布偶 + 抛物线 + 关卡 + 升级，纯逻辑可测）
src/render/ index.js（低多边形 3D）
src/ui/   ui.js（屏幕/HUD/升级/首次引导）
src/main.js（装配/固定步长/事件分发/输入/__ll）
tools/    selfplay.mjs / verify.plan.json / artgen/
tests/    sim.test.mjs / final/（验收截图与报告）
```
