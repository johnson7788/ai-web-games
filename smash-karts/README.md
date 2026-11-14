# SMASH KARTS · 卡丁车大乱斗

俯视角**可爱卡通**卡丁车道具大乱斗（单机 + 4 台 AI）。**车就是角色**：每台卡丁车有大眼睛、腮红和表情——
开火皱眉、被打尖叫、被 KO 变 X 眼冒星星、赢球星星眼。

你开一台车，在糖果色竞技场里**漂移蓄力**、撞开武器箱，用泡泡枪 / 速射 / 爆米花霰弹 / 火箭把对手打成 X 眼。
三张地图三局，每局先到 **10 次击倒**或 100 秒结束，局间三选一升级（11 个，8 个改规则）。

- 品类：.io 式车辆混战 / 动作（卡丁车道具战）
- 参考：Smash Karts（只借鉴品类；角色、美术、代码全部原创；本版为单机 + AI）
- 技术：零构建纯静态 · ES Module · Canvas 2D 俯视 · 1280×720 letterbox · 60Hz 定步长 · WebAudio 程序化音效

## 运行

```bash
cd games/smash-karts
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

| 动作 | 键盘 | 触屏（横屏） |
| --- | --- | --- |
| 前进 / 后退 | `W` `S` / `↑` `↓` | 左下摇杆 |
| 转向 | `A` `D` / `←` `→` | 左下摇杆 |
| 开火 | `Space` | 右下 `FIRE` |
| **漂移（按住）/ 松手加速** | `Shift` | 右下 `DRIFT` |
| 暂停 | `Esc` / `P` | HUD 右上 `II` |

## 规则

- 一场 = 3 局，每局一张地图（Sunny Meadow → Bubblegum Factory → Lava Lamp Lair），
  先到 **10 次击倒**或 **100 秒**结束（时间到按击倒数判该局）；三局都会打完。
- 漂移蓄满（橙色加速条）松手 → 加速；加速是**唯一的爆发速度**。
- 武器箱：速射 / 爆米花霰弹 / 火箭（溅射），弹药打完回到泡泡枪（无限）。
- 阵亡 2 秒重生，重生 1.5 秒无敌。
- 第 3 局出现冠军车 **Cherry Prime**（170 HP），头顶小皇冠。
- 结算给 S/A/B/C 评级、最高分、"差一点"提示；一键再开。

## 局间升级（11 个，8 个改规则）

弹跳火箭 / 三连爆米花 / 火花尾迹 / 涡轮之心 / 保险杠撞击 / 幽灵起步 / 箱子磁铁 / 幸运箱盖
+ 装甲板 / 快手装填 / 涡轮引擎（数值型）。

## 测试与验收

```bash
node --test                                                     # 纯逻辑（sim + config）
node tools/autoplay.mjs                                         # bot 遥测 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/asset-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs                                      # 22 个音效 RMS 实测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
```

物料（G6）：

```bash
node tools/make-media.mjs        # poster.jpg / poster-1920.jpg / icon.png / favicon.png / game.gif
node tools/stage-release.mjs     # 带版本号的发布目录
```

## 目录

```
config/      game.config（世界/手感/武器/竞技场/升级/评级）/ design.json / locales / sdk.config
src/game/    sim.js（纯逻辑：物理/漂移/加速/武器/AI/箱子/危险地形/回合/升级）
src/render/  index.js（装配）/ karts.js（车身 + 程序化表情）/ arena.js / fx.js / art.js（素材表）
src/ui/      ui.js（标题/HUD/升级三选一/结算/交互引导 + 事件总线）
src/core/    audio / i18n / save / sdk（SDK 唯一出口）
src/main.js  装配 + 状态机 + 输入 + 遥测 + window.__ll
```

## 调试契约 `window.__ll`

- `state.phase` ∈ boot|title|countdown|playing|paused|roundEnd|matchOver
- `start() / startTutorial() / pause() / resume() / restart()`
- `sim`（当前 run 快照，getter）
- `telemetry(policy)` → fun-report 用的遥测
- `tutorial = { active, step, steps, current, skip() }`
- `debug.state() / step(sec,input) / setKills(n) / winRound() / loseRound() / endMatch(won) / teleport(x,y) / forceBoost() / layout()`

## 国际化

仅 `en`（默认）+ `zh`，71 个 key 完全对齐；切语言即时生效、刷新保留；`?lang=` 可临时覆盖。

## 已知限制

- 单人 + AI，没有真实联机（联机需 WebSocket 服务，属后续迭代）。
- 没有车辆涂装 / 商店 / 每日挑战 / 在线排行榜（见 `docs/smash-karts/README.md` 反范围）。
