# ACE GUNNER · 契约与设计源

## 一句话

你是边城城垛上的神射手，拉弓瞄准从荒漠冲来的马匪，放箭守住城门，连杀触发鹰眼慢动作，用金币买强化撑过十二波围攻。

## 世界 / 坐标 / 单位

- 逻辑世界 1280×720（`config/game.config.js` `WORLD`），60Hz 固定步长 `STEP=1/60`。
- 城墙在左（x<150），射手固定于 `(ARCHER_X=150, ARCHER_Y=250)`；敌人从右 `SPAWN_X=1240` 沿四条道 `LANE_Y=[200,330,460,590]` 向左行进。
- 城门为唯一受保护目标，`GAME.BASE_HP=100`，归零判负。

## 实体字段

- **敌人** `{ id, kind, lane, door, x, y, hp, maxHp, speed, damage, radius, gold, mass, explodeRadius, wallDanger, shieldHp, state:'walking'|'attacking'|'dead', bossPhase }`；kind ∈ `foot/rider/shield/barrel/boss`。
- **箭矢** `{ id, x, y, vx, vy, damage, radius, pierce, explosive, dist, dead }`。
- **玩家派生属性**（升级可改）：`fireCooldown / reloadTime / damage / range / pierce / triple / explosive / eagleDuration / eagleTimeScale / legShot`。

## 事件名（sim 发，main/render/audio 消费）

`waveStart spawn shot draw reload reloadDone arrowHit block shieldBreak kill explosion wallHit eagleEye eagleExtend bossPhase upgradeChosen waveClear win lose`

## 模块 API

- `src/game/sim.js` `createRun(levelIndex, {seed})` → `run`：`step(dt) / aim(x,y) / pressFire() / releaseFire() / fire() / reload() / chooseUpgrade(id) / nextWave() / getHud() / drainEvents()`。
- `src/render/index.js` `createRenderer(canvas)` → `{ draw(state, dt, view), debugLayout(), resize() }`。
- `src/core/audio.js` `createAudio()` → `{ event, setMuted, startBgm, stopBgm, unlock }`。
- `src/ui/ui.js` `ui`：语言切换 + 屏幕显隐。
- `src/core/sdk.js` `Sdk`：存档/埋点/广告/分享唯一出口。

## 状态机

`phase`（main）：`title → playing → (paused) → result`；sim 内部 `wave → upgrade → won|lost`。升级屏是 `wave→upgrade` 时的覆盖层。

## 输入契约

- 鼠标/触屏：`pointermove` → `aim`；`pointerdown` → `pressFire`（拉弦）；`pointerup` → 短按(<120ms) `fire()`（满弦）/ 长按 `releaseFire()`（按拉弦力度）。
- 键盘：`Esc/P` 暂停、`R` 换弹、`M` 静音。
- `window.__ll` 调试契约：`state.phase / start / pause / resume / restart / home / run / sim / debug.state / debug.layout / debug.loadLevel / debug.startSeeded / debug.autoPlaceSolution / debug.fastForward`。

## 设计审计

`config/design.json` 已过 `fun-audit`（PASS 100/100）：3 动词、8 个前 3 分钟决定、12 关各一新元素、10 升级（6 规则型）、4 重玩钩子（rating/unlock/nearMiss/growth）。

## 铁律对照

- 英文默认 + zh 必做，只暴露 en/zh。
- 存档/埋点/广告只走 `src/core/sdk.js`；业务代码不直接碰 localStorage。
- 音频全程序化 WebAudio（BGM 四层编制 16 小节无缝循环 + 每事件 SFX）。
- 美术全程序化 Canvas，三场景包一眼可分。
- 首次进入交互式引导（3 步，可跳过/可重看/持久化）。
