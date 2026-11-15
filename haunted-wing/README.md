# HAUNTED WING（闹鬼病栋）

> 手电筒医院逃生：找钥匙 / 躲实体 / 电力管理。第一人称恐怖，纯静态、零构建、零运行期外链。

## 运行

```bash
cd haunted-wing
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## G0 八问

1. **一句话**：你在一座两层废弃医院里，用手电找 3 把钥匙开 3 道门逃出去；摸黑省电但看不清，开灯会引来走廊里巡逻的实体。
2. **参考**：bridge-horror-house（手电/电力/追逐 AI 思路）、nightfall-outbreak（场景光照）；只借品类，不抄素材。
3. **差异化**：① 手电是双刃剑——照明 vs 暴露位置，每开一秒钟都在做取舍；② 实体靠「听觉 + 手电视觉」而非固定巡逻，跑/搜柜会出声引它；③ 发电机小游戏给一个高风险高回报的全局决策（开灯 30s 退散实体，但之后狂暴）。
4. **操作**：桌面 WASD + 鼠标视角 + F 手电 + E 交互/躲柜 + Shift 跑 + C 蹲；触屏左半屏摇杆移动、右半屏划视角 + 手电/交互/跑三键（≥44px）。
5. **一局**：约 2–3 分钟。失败条件 = 3 命被实体抓尽。第一次拿到钥匙约在 60s 内（第一个爽点）。
6. **成长**：局内成长 = 钥匙推进 + 电池补给 + 发电机带来的 30s 安全窗；跨局 = 最快逃生时间存档（best）。
7. **结局**：逃出 = 用时/剩余命/评级（S/A/B/C）；3 命尽 = 失败；一键重开。
8. **乐趣**：主乐趣好奇（探索未知楼层 + 环境叙事），副乐趣掌控（学会听心跳/呼吸判断实体距离）。第 3 分钟还想继续是因为「差一点就逃出去了」+ 评级钩子。第一个有代价的决定在第 10s：开手电搜房还是摸黑省电。

**签名记忆点**：手电闪烁的瞬间，走廊尽头一个扭曲剪影一闪而过，心跳骤起。

**反范围**：不做联机、不做战斗（只能躲）、不做超过 2 层、不做剧情文本量（环境叙事）、不做 jumpscare 闪屏。

## 数据契约（sim 纯逻辑）

- 世界单位：米；网格单元 `WORLD.CELL=2m`；1280×720 letterbox；逻辑帧 `STEP=1/60`。
- 坐标：`x`/`z` 为水平面，`floor` ∈ {1,2}（地面高 y=0 / y=3）；玩家朝向 `yaw`，前向 = `(-sin yaw, -cos yaw)`。
- 玩家 `run.player`：`{ floor, x, z, yaw, lives, battery, flashlight, hidden, hiddenIn, sprint, crouch }`。
- 实体 `run.entity`：`{ floor, x, z, wp, dir, state(patrol|investigate|chase|retreat), frenzy }`。
- 钥匙 `run.keys`：`{ red, blue, gold }`；发电机 `run.generator`：`{ fixed, lightsT, seq[3], progress }`。
- 事件（sim 发，render/audio/ui 消费）：`start / key / door / battery / search / hide / exitHide / caught / heartbeat / breath / noise / flicker / silhouette / generatorTick / generatorWrong / generator / lightsOn / lightsOff / floor / needKey / win / fail`。
- API：`createSim({seed}) -> run`；`updateSim(run, input)`；`drainEvents(run)`；`getHud(run)`；`nearAction(run)`；`ratingFor(time,lives)`。
- 输入契约（边沿归 main）：`{ forward, strafe, turn, flashlight(edge), interact(edge), lever(1..3,edge), sprint, crouch }`。
- 状态机：`title -> playing -> (results)`；`run.phase` ∈ `playing | won | dead`。

## 关键数值（config/game.config.js）

| 项 | 值 |
| --- | --- |
| 玩家 走/跑/蹲 | 4.2 / 6.3 / 2.2 m/s |
| 手电耗电 | 1%/s（开灯才耗） |
| 电池拾取 | +30% |
| 实体 巡逻/调查/追击/狂暴 | 2.2 / 3.2 / 4.8 / 5.6 m/s |
| 命数 | 3（被抓回安全点） |
| 发电机 | 3 拉杆按顺序，开灯 30s |

## 已知 TODO（诚实清单）

- `prefers-reduced-motion` 未单独关闭震屏（本作无震屏，仅心跳 vignette 渐显，强度已压低）。
- 发电机为可选支线，未强制；不影响通关路径。
- 实体 AI 只在一层巡逻（二层为安全收尾），未做「狂暴后追到二层」。
- 材质贴图（assets/tex/*.webp、sky.jpg）已就位但渲染用程序化配色，贴图槽位预留未接线。

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```
