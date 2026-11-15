# KEEP GUARD 3D（三维守城）—— 立项、设计源与接口契约

> 日期：2026-11-15 · 品类：sim（路径塔防）· 平台：浏览器（桌面 + 移动）
> 语言：默认英文（en）+ 中文（zh）；ja/ko/ar/ru 未做，整块不暴露。
> 代码在 `games/keep-guard-3d/`，纯静态、零构建、零运行期外链（唯一例外 pipysdk，降级可玩）。

## 0. 一句话 / 立项八问

**一句话**：在 3D 斜 45° 俯视网格上建塔、升级、放土墙把敌人的红线改道，守住核心 10 波。

- **主乐趣**：掌控（mastery）；**副乐趣**：好奇（curiosity）。
- **乐趣假设**：第 3 分钟玩家还会继续，因为每一次土墙落位都会让整条红色路径瞬间改道，逼敌人绕远路送死；G0.5 用 fun-audit + bot 遥测验证。
- **核心动词（3）**：build（建塔/墙，代价=金币与塔位互斥）/ upgrade（升级，代价=升级贵于新建）/ terraform（土墙堵路，代价=墙可被破墙兵打破）。
- **第一个有代价的决定**：第 10 秒「先建箭塔还是先堵路」。
- **签名记忆点**：土墙堵路瞬间敌人整条红线改道；炮塔 AOE 在拐弯处炸开一片。
- **反范围**：不做联机 / 不做超过 1 张地图 / 不做英雄单位 / 不做科技树 / 不做剧情。

## 1. 操作

- **桌面**：左键选塔/放置；右键拖拽旋转视角；滚轮缩放；1/2/3/4 选箭塔/炮塔/冰塔/土墙；空格提前开战；Esc 暂停；R 重开。
- **触屏**：点按放置；双指旋转+缩放；底部塔按钮栏（≥44px）；开战按钮。

## 2. 核心循环

- 秒级：选塔 → 点格放置（射程圈 + 红线预览）→ 塔自动索敌开火。
- 局级：10 波敌人（步兵/快跑/破墙/飞行/Boss 攻城车），波间 15s 建造期可提前开战（+金币）。
- 长线：核心 20HP；金币=击杀+波奖励+利息（存款 12%）；塔可卖（折价 50%）；最佳纪录存档。

## 3. 玩法与数值

- **塔**：箭塔（单体快射，3 级加暴击）/ 炮塔（AOE 慢射）/ 冰塔（减速，3 级 AOE 减速），各 3 级。
- **敌人**：infantry / runner / breaker（优先打墙）/ flyer（无视路）/ boss（高甲、抗减速）。
- **地图**：16×12 网格，固定岩石压成三段蛇形路径；放塔/墙实时 BFS 重算路径，不允许完全堵死（留至少 1 条路）。
- **胜利**：守完 10 波结算（剩余 HP/用时/击杀/评级 S–C）；**失败**：核心 HP 归零。

## 4. 数据契约

- **世界/坐标**：逻辑视口 1280×720 letterbox；地图 16×12、tile=1，x∈[-8,8]、z∈[-6,6]；`cellWorld(c,r)={x:c-7.5, z:r-5.5}`；固定步长 60Hz。
- **实体**：敌人 `{id,type,spec,hp,maxHp,x,z,nodeIdx,flying,slowT,slowPct,atkCd,dead}`；塔 `{type,level,c,r,cd,id}`；墙 `{c,r,hp}`；弹 `{x,z,tx,tz,speed,type,dmg,aoe,crit,target}`。
- **事件**（`drainEvents`）：`start / build / wall_built / upgrade / sell / early_start / interest / wave / enemy_spawn / shoot / hit / aoe / slow / kill / wall_break / core_hit / wave_clear / win / fail`。sim 发事件，render/audio/ui 各自消费。
- **API**：`createSim({seed})` / `updateSim(run, input)` / `getHud(run)` / `drainEvents(run)` / `buildTower(run,type,c,r)` / `upgradeTower` / `sellTower` / `earlyStart` / `canPlaceAt` / `previewPath`；run 上挂 `step/getHud/drainEvents/startWave/build/upgrade/sell/canPlace/previewPath`。
- **输入**：一次性指令 `{ build:{type,c,r}, upgrade:{c,r}, sell:{c,r}, earlyStart:true }`。
- **状态机**：`title → playing(build⇄combat) → results → title`；`main.state.phase` 管屏幕，`run.phase` 管波内状态。
- **调试口 `window.__ll`**：`state{phase,simPhase,wave,lang,dir}` / `run` / `start/pause/resume/restart/startWave/buildTower/startTutorial` / `tutorial{active,step,steps,current,skip}` / `demo{win,lose}` / `save/ui/lang/setLang`。
- **smoke test**：`const r = createSim({}); r.startWave(); r.step({}); r.getHud(); r.drainEvents();`

## 5. 已知 TODO / 未做项（诚实列）

1. 未跑 `vision-review`（§5 未列，截图已产出 `tests/final/*.png` 供后续评审）。
2. 竖屏旋转提示未做（目标视口为 844×390 横屏；`updateRotate` 留了空壳）。
3. 难度偏易：bot 满员打法可 10 波全通，后续可按真实平台留存数据收紧数值。
4. 触屏双指旋转/缩放实现较粗糙（未做全手势回归），单指点按放置已可用。
5. 程序化渲染已接 `assets/tex/*.webp` + `assets/sky.jpg` 贴图槽位，但天空图未真正作为背景贴图（用雾色近似）。

## 6. 验收

```bash
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```
