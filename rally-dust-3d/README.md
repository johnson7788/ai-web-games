# RALLY DUST 3D · 拉力尘烟

点对点拉力：路书提示 / 泥地漂移 / 车损。5 个赛段，低多边形山地赛道，泥地发夹弯全漂移时车尾甩起一片尘烟。

## G0 八问

1. **一句话**：玩家按副驾路书在砂石/泥地/柏油混合的拉力赛段上点对点驾驶，漂移过弯得分、撞树石损车，5 段完赛按时间+漂移分评级。
2. **参考**：Racing Limits / WRC 品类（只借鉴品类，不抄素材）。
3. **差异化**：① 路书（pace note）是核心输入——提前 3 秒报弯向与档位，按档入弯给「完美过弯」奖励；② 泥地抓地低→漂移窗口大，路面类型改变同一辆车的手感；③ 车损改变操控（转向偏/极速降），100% 退赛。
4. **操作**：桌面 W/S 油门刹车、A/D 转向、Space 手刹漂移、Shift 降档、C 切车头/车尾相机、R 重开、Esc 暂停。触屏：左转向滑条 + 右油门/刹车/手刹按钮（≥44px）。
5. **一局**：5 赛段约 5–7 分钟。失败=车损 100% 退赛；爽点在第 5 秒第一次油门、第 25 秒泥地发夹弯全漂移。
6. **成长**：局内=漂移分/评级/各赛段时间；跨局=最佳评级、最佳赛段时间、最佳总分存档。
7. **结局**：完赛=结算卡（评级 S–C / 时间 / 漂移时长 / 完美过弯 / 分享）；退赛=DNF 卡；R 一键重开。
8. **乐趣**：主=mastery（漂移线路 + 档位节奏），副=curiosity（每赛段新元素）。第 3 分钟还想继续=「差一点就 S / 差一点就压着档位完美过弯」。第一个有代价的决定=第 8 秒第一个弯「按路书 3 档入弯还是赌 4 档」。

**签名记忆点**：泥地发夹弯全漂移，车尾甩起一片尘烟，路书副驾喊「左 3 接右 2」。
**反范围**：不做联机 / 开放世界 / 车辆改装树 / 剧情 / 超过 5 赛段。
**美术来源**：AI 生成 sky.jpg（天空盒）/ tree.webp / gravel.webp / mud.webp + poster/icon；路面用顶点色 + gravel 贴图，尘烟/车/岩石程序化；BGM AI 生成，SFX 程序化 WebAudio。

## 运行

```bash
cd rally-dust-3d
python3 -m http.server 8124   # 或任意静态服务器；node 用 /opt/homebrew/bin/node
```

## 世界/坐标/单位

- 逻辑视口 1280×720（UI letterbox），3D 渲染全窗口，DPR≤2，60Hz 固定步长。
- 赛道空间 `(s,t)`：s=中心线弧长(m)，t=横向(m)。5 个点对点赛段，`src/game/track.js` 由 seed 生成开放 Catmull-Rom 路径 + 等弧长采样 + 曲率 + 路书 + 障碍。
- 世界坐标 y 向上；渲染由 track samples 建路面 ribbon。

## 实体字段（sim 纯逻辑，无 DOM/THREE/Date.now）

```js
run = {
  phase: 'driving'|'busted'|'finished',
  stage(1..5), time(当前段), totalTime, score, damage(0..100),
  steerBias, biasT, driftSec,
  stageTimes[], stageScores[],
  player: { s, t, angle, speed, steerSmooth, offTrack, drifting },
  stats: { driftSec, pacePerfect, hits, offTrackSec },
  track: createStage(STAGES[stage-1]) → { length, halfWidth, samples, obstacles, notes, surfaceAt, gripAt, curvatureAt, at, toWorld, inBumpy },
  events: [],
}
input = { throttle, brake, steer:-1..1, handbrake, shiftDown }
```

## 事件（sim 发，render/audio/ui 消费）

`driftStart driftEnd driftTick paceNote pacePerfect hit offTrack damageWarn dist surface gear stageClear busted finished`
形状 `{ type, ... }`：hit={kind}；paceNote={dir,gear,next}；stageClear={stage,time,score}；finished/busted={score,rating}。

## 模块 API

- `track.js createStage(spec)`；`sim.js createSim({seed,stage})` / `updateSim(run,input)` / `getHud(run)` / `drainEvents(run)` / `ratingFor(score,busted)`。
- `render createRenderer(canvas)` → `{ render(run,dt), onEvent(ev), resize(w,h), setCamera('chase'|'hood'), dispose() }`。
- `ui`：`showTitle/showGame/showPause/hidePause/showResults(run,info)/updateHUD(run)/popup(ev)/applyLang/setLang`；`ui.tutorial={active,step,steps,current,skip(),start(),update(run)}`。
- `audio createAudio()`：`unlock()/setMuted(b)/muted()/play(name)/ensure/resume/stopAll/setEngine(r)/setSkid(on,i)/event(name)/ui()/beep()`。
- `sdk Sdk`：`ready/newRun/levelCleared/gameOver/track/showRewarded/showInterstitial/canShowAd/save/load/share/onAdStart/onAdEnd`。
- `main.js` 装配；`window.__ll`：`state.phase/run/hud/start/pause/resume/restart/startAct/startTutorial/tutorial/save/ui/lang/setLang/setInput/finish`。

## 状态机

`title → playing(赛段 driving) → results`；`playing ⇄ paused`。赛段冲线自动推进下一段（幕卡横幅）；damage≥100 → busted → results。

## 数值（config/game.config.js 集中）

- 车：maxSpeed 52 m/s、accel 17、brake 30、steer 1.7 / driftSteer 2.4；抓地 asphalt 5.2 / gravel 3.4 / mud 1.5 / 手刹 1.1（角度衰减速率，越低漂移窗口越大）。
- 车损：树 16 / 石 11 / 出界 5/s / 颠簸 4/s；每点伤 −0.4% 极速（下限 60%）；满 100 退赛。
- 得分：漂移 `speed*|angle|*dt*5`；完美过弯 120；每 40m +8；赛段 +400 + 时间奖励；评级 S≥9000 A≥6000 B≥3000 else C，退赛封顶 B。
- 路书：曲率峰值生成 L/R + 档位 1–4，提前 3s（≥42m）报；按档位速度入弯 = 完美过弯。

## 已知 TODO / 简化

- 手动档位简化为「自动离合 + Shift 发动机制动降档」（升档自动）。
- 路书副驾语音走 `speechSynthesis`，无语音/headless 静默降级为图标 + 音效。
- 阶段 4「颠簸近路」实现为「高速压过省时但伤悬挂、减速更稳」的节奏取舍，非真正分叉近路。
- `assets/tex/mud.webp` 贴图槽位已生成但未映射（泥地暂用顶点色 + gravel 贴图），留给美术接线 agent。
- ja/ko/ar/ru 未做（整块不暴露）。

## 验收

```bash
cd /Users/admin/git/webgames/games/rally-dust-3d
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
