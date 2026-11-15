# BLOCK BATTLE ROYALE（方块吃鸡）

30 人 bot 体素大逃杀：缩圈 / 建造 / 落地成盒 / 最后存活。零构建纯静态（index.html + ESM），
three.js 体素岛 64×64（InstancedMesh），1 玩家 + 29 bot，5 段缩圈，右键建掩体，击杀掉落体素棺材 + 战利品。

## 运行 / 测试 / 验收

```bash
/opt/homebrew/bin/node --test                                        # 纯逻辑测试
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node tools/selfplay.mjs                            # bot 遥测 → tools/fun/autoplay.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

本地试玩：`python3 -m http.server 8124`（**验收脚本自带端口自增服务，不要起常驻服务器**）。

## 操作

桌面：WASD 移动 · 鼠标视角（点击锁定）· 左键射击 · 右键建造（墙/半墙坡）· R 换弹 · E 捡取 · Tab 背包 · M 小地图
触屏：左半屏摇杆移动 · 右半屏滑动视角 · 右侧 射击/建造/捡取/换弹 按钮

## G0 八问

1. **一句话**：30 人跳到体素岛，捡枪、躲缩圈、建掩体对射，最后存活者吃鸡。
2. **参考**：Fortnite 品类（只借鉴缩圈+建造机制，不抄素材/角色/UI）。
3. **差异化**：① 全 bot（1 玩家 + 29 AI）单机大逃杀；② 体素低多边形岛 + 程序化占位渲染，AI 贴图仅替换美术件；③ 建造是核心动词（墙=满掩体 / 坡=半掩体探头对射）。
4. **操作**：键鼠 FPS + 触屏摇杆按钮；3 秒看懂（准星=射击，蓝墙=缩圈，发光箱=捡装备）。
5. **一局**：2–3 分钟；失败=被淘汰，爽点在第 20–40 秒首次击杀。
6. **成长**：局内（捡枪/甲/方块/医疗→变强）+ 跨局（最佳击杀数存档）。
7. **结局**：胜利/淘汰 → 结算卡（评级 S/A/B/C/D + 击杀数 + 存活时间）→ 一键重开。
8. **乐趣**：mastery（枪法/掩体战）；第 3 分钟靠决赛圈 1v1 的掩体对射钩住；第一个有代价决定在第 8 秒（落热点还是野区）。

**签名记忆点**：决赛圈 1v1，双方体素墙对射，墙块碎裂中一枪爆头，对方落地成盒。
**反范围（不做）**：真联机 / 载具 / 超过 1 张图 / 赛季系统 / 剧情。

## 数据契约（src/game/sim.js 纯逻辑）

- 世界：64×64 体素格（1 格 = 1 单位）。`base[]` 地形（0 陆地 / -1 水，不可破坏）、`top[]` 柱高（= base + 可破坏方块）、`hp[]` 顶层方块血（每块 3 hit）、`kind[]`（0 无 / 1 建筑 / 2 墙 / 3 坡）。
- 实体：`{ id, isPlayer, x, z, y, yaw, pitch, hp, armor, weapon, ammo, mag, blocks, meds, alive, kills, ... }`。玩家眼高 `PLAYER.eye=1.7`，爆头线 `PLAYER.headY=1.55`。
- 输入契约（`updateSim(run, input)`）：`{ yaw, pitch, forward, strafe, fire, build, reload, pickup }`（yaw/pitch 绝对角，forward/strafe -1..1 相对朝向）。
- 事件（sim 发，render/audio/ui 消费）：`start / land / shot / hit / kill / deathBox / pickup / build / blockBreak / zone / zoneTick / airdrop / heal / spark / dead / win`。
- API：`createSim({seed})` / `updateSim(run, input)` / `drainEvents(run)` / `getHud(run)` / `getRating(run)` / `nearestEnemy` / `nearestLoot`。
- 状态机：`drop(跳伞) → playing(战斗) → won | dead`；UI 状态 `title / playing / paused / results`。
- 随机：全部走 `mulberry32(seed)`，同 seed 同世界、同输入同结局。

## 标准调试口

`window.__ll`：`state{phase,simPhase,lang,dir}` / `run` / `start / pause / resume / restart` /
`tutorial{active,step,steps,current,skip}` / `demo{win(),dead()}` / `save / ui / lang / setLang / setInput / telemetry`。

## 已知 TODO / 简化

- 坡（ramp）当前是「半掩体」（1 高，可探头射击），不做攀爬上房；墙（wall）是 2 高满掩体。两者都可被子弹打破（3 hit）。
- 空投只刷一把狙+补给，无下落动画（落地即出现，事件 `airdrop` 标注）。
- 背包为常驻 HUD + Tab 详情弹层，无拖拽管理。
- 移动为「贴地 2D + 掩体阻挡」，无跳跃/下落（本作反范围未要求）。
- bot 目标是「最近可见敌人」，掩体会挡视线（`BUILD.losBlock=1.4`）；不实现真联机、载具、赛季、剧情。
