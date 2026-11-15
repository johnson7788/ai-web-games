# MONKEY MARBLE（滚球猴）

> 滚球过坡道陷阱，收集香蕉，摔出赛道重来。

## 运行

```bash
cd monkey-marble
python3 -m http.server 8124   # 或直接双击 index.html（零构建纯静态）
```

## G0 · 立项八问

1. **一句话**：玩家在悬浮天际赛道上滚一颗透明玻璃球（里面坐着一只猴子），吃香蕉、跳过移动锤、冲下大坡，别摔出赛道。
2. **参考**：类 *Marble Madness / Super Monkey Ball* 的滚球计时闯关，只借鉴品类，代码/素材全部重写。
3. **差异化（为什么不是换皮）**：① 球里一只会在窄桥上左顾右盼的猴子（签名记忆点）；② 香蕉「+1s 时间奖励」把收集直接换算成 S–C 评级；③ 可控的滚球物理模型，让 greedy/random/noinput 三条 bot 全程无头验收。
4. **操作**：键鼠 WASD 滚球、Space 跳、Shift 刹车、R 回检查点、Esc 暂停；触屏左摇杆 + 跳/刹按钮（≥44px，不遮 HUD）。
5. **一局**：5 关，每关 30–50s；摔出扣 3s 回检查点；通关看 S–C 评级。爽点在冲下大坡那一瞬。
6. **成长**：局内 = 香蕉 +1s 时间奖励换更高评级；跨局 = 最佳总用时存档（Sdk.save）。
7. **结局**：通关 → 评级卡 + 新纪录提示；摔出 → 自动回检查点；一键重开。
8. **乐趣**：主乐趣 = mastery（掌控滚球）。第 3 分钟玩家还想刷到 S。第一个有代价的决定在第 8 秒：冲坡拿速度还是稳滚保控。

## 数据契约

- **世界/坐标/单位**：逻辑视口 1280×720（letterbox）；3D 世界 Y 轴向上，赛道沿 **+Z** 前进、中心线 x=0、悬浮空中；长度单位米；逻辑帧 60Hz 固定步长。
- **实体**：`player = { x, y, z, vx, vy, vz, onGround }`（球，半径 0.5）；`bananas_list[{x,z,y,taken}]`；`hammers[{z,arm,freq,phase,cd,barX}]`；`pads[{z,halfWidth}]`；`checkpoints[{z,passed}]`。
- **事件名**（sim 发 → render/audio/ui 消费）：`roll / jump / land / brake / pickup / fall / hammerHit / bounce / checkpoint / dist / levelCleared / levelStart / finished`。
- **模块 API**：`createSim(opts)` / `updateSim(run, input)` / `advanceLevel(run)` / `drainEvents(run)` / `getHud(run)` / `ratingFor(net, target)`；`createRenderer(canvas).render(run, dt).onEvent(ev)`；`ui.*`；`audio.play(name)`。
- **输入契约**：`{ moveX, moveZ, jump, brake, respawn }`；jump/respawn 为边沿（main 里排队消费），held 与 pressed 的边界由 main 归约。
- **状态机**：`title → playing → levelclear → playing … → results`；`playing ⇄ paused`（Esc/失焦）。
- **调试口**：`window.__ll`（`state.phase/simPhase/lang/dir`、`start/pause/resume/restart/startAct(n)/startTutorial/setInput`、`run`、`tutorial{active,step,steps,current,skip}`、`save/ui/setLang`）。

## 验收

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

## 已知 TODO

- 球体物理为**自研滚球模型**（判定/碰撞全代码，未用 cannon-es）；数值在 `config/game.config.js`，可 ±20% 调。
- 广告账号未接（`config/sdk.config.js` 里 `ads.enabled: false`），接号后改 appId + 广告位即可。
- 移动锤/窄桥的手感数值（`BALL.latSpeed / steerRate`、`levels.js` 的 `arm/freq`）可再调优。
