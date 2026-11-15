# ROCKET DERBY（火箭车球）

> 车辆足球 2v2，加速撞球，球速越快分越高。低多边形霓虹球场，纯静态零构建。

## 运行

```bash
cd rocket-derby
python3 -m http.server 8124      # 或任意静态服务器
# 打开 http://127.0.0.1:8124/
```

node 一律用 `/opt/homebrew/bin/node`（本机 node 是坏的 nvm shim）。

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 油门 / 倒车 | W / S | 右下 GO 按钮 |
| 转向 | A / D | 左下摇杆 |
| 跳跃（二段跳） | Space | 右下 JUMP 按钮 |
| Boost 加速 | Shift | 右下 BOOST 按钮 |
| 重开本场 | R | — |
| 暂停 | Esc | — |

## G0 八问

1. **一句话**：玩家开一辆火箭车，在霓虹球场上 2v2 踢足球——加速撞球，球飞得越快进门的分数越高。
2. **参考**：本地 `games/rocket-goal` 的球物理与 AI 直接 3D 化；`cconsta1/threejs_car_demo`（MIT）车辆调参。
3. **差异化**：① 球速即分数（球速 ×100），鼓励全速冲撞而非轻推；② boost 满速撞对手可把对手撞翻 2s（demo），是签名对抗瞬间；③ 空中二段跳撞球拉出火尾轰门。
4. **操作**：W/S 油门、A/D 转向、空格跳、Shift boost；触屏摇杆 + 三个大按钮。3 秒可懂。
5. **一局**：单局 120s，进球多者胜；平局加时金球制。爽点在前 30s 的第一次 boost 撞球。
6. **成长**：局内 boost 条（拾取点回充）；跨局存最佳进球速度 / 胜场，5 关锦标赛。
7. **结局**：每关后结算评级（S/A/B/C）；通关显示冠军；失利可重试本关。
8. **乐趣**：主乐趣掌控（速度与角度换分数），副乐趣社交对抗。第 3 分钟还想继续是因为「再快一点就能把球轰出火尾」；第一个有代价的决定在第 8 秒（抢开局球还是先守门）。

## 数据契约

- **世界**：1280×720 letterbox，60Hz 固定步长。球场 X∈[-60,60]（长度沿 X，球门在 ±X）、Z∈[-38,38]、墙高 6；球门宽 20、高 3.4。
- **实体**：车 `{ x, z, y, heading, speed, boostMeter, boostOn, demoed, demoT }`；球 `{ x, z, vx, vz, y, vy }`；拾取点 `{ x, z, active, t }`。
- **API**（`src/game/sim.js`）：`createSim({seed, level})` / `updateSim(run, input)` / `drainEvents(run)` / `getHud(run)` / `ratingFor(score)`。input `{ throttle, steer, boost, jump }`。
- **事件**：`start / kickoff / countdown / whistle / hit / boostStart / boostEnd / aerial / pickup / goal / concede / demo / demoed / overtime / levelClear / matchLost / win / lose`。sim 发，render/audio/ui 各自消费。
- **状态机**：`kickoff → play → goalReplay → (play | overtime → end)`；`run.result` = `win | lose`。main 的 `state` = `title | playing | paused | results`。
- **调试口**：`window.__ll` = `{ state, run, hud, start, pause, resume, restart, startAct, tutorial, setInput, telemetry }`。

## 已知 TODO

- 美术升级：AI 素材（sky/turf/wall）已接线，车/球仍是程序化低多边形占位，后续由接线 agent 换 AI 贴图件。
- AI 难度曲线只做了 5 档数值（oppMax/oppShot），未做「每关新地形/新行为」的规则型差异。
- 无联机（bot 补位）、无车辆皮肤、无自定义球场（反范围）。
- boost 仅靠拾取点回充 + 极慢自回充，手感偏硬核，可再加 pickup 密度。

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
