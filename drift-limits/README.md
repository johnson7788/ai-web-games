# DRIFT LIMITS · 极限漂移 — 设计源与契约

> 清单来源：`docs/2026年11月14日开发游戏清单.xlsx` 首批 #1（P0，2026-11-17 排期）。
> 复用：`games/neon-drift` 车辆物理与赛道生成（自有代码）；three.js vendored。
> 参考爆款：Racing Limits（CrazyGames 竞速 #1，336 万 plays）——只借鉴品类，不抄素材。
> 模板 `jolbol1/apex-gp` 无许可证 → **不抄其代码**，仅参考「程序化赛道」思路（已由 neon-drift 底座实现）。

## G0 八问

1. **一句话**：夜城环线上，绿灯起步、连击漂移叠倍率、氮气甩警车；撞一次倍率归零，三圈冲线即逃脱。
2. **参考**：Racing Limits（车流穿梭）+ Need for Speed 热度追缉（品类借鉴）。
3. **差异化**：① 漂移=得分=充氮，但漂移掉速让警车逼近——得分与生存天然对立；② 后视镜警灯+距离条是常驻压力源；③ 倍率贪心链（×10）与撞车归零的 push-your-luck。
4. **操作**：键盘 ←→/AD 转向、Space 漂移（红灯期=起步按键）、Shift 氮气、↓/S 刹车、Esc 暂停。触屏：左右半屏转向按钮、右下 DRIFT、左下 NITRO。3 秒看懂：漂=烟+分，警灯近=危险。
5. **一局**：3 圈 ≈ 120–150s。失败=被警车贴尾 1.2s（BUSTED）；爽点在第 3 秒完美起步、第 12 秒第一次漂移连击。
6. **成长**：局内=倍率链/氮气/热度升级；跨局=best score 里程碑解锁 8 个 perk（4 规则 4 数值），每局装 2 个 → build 差异。
7. **结局**：冲线=结算卡（分数/评级 S–C/统计/新纪录/分享）；被抓=BUSTED 卡（同结算但评级封顶 B）；R / 按钮一键重开。
8. **乐趣**：主=mastery（漂移线路与倍率贪心），副=curiosity（perk build 与路障选线）。第 3 分钟还想继续=「差一点就 ×10 / 差一点就 S」。第一个有代价的决定=第 3 秒起步时机。

**规模档**：M（复用底座后实际 S+）：1 赛道 3 热度阶段、3 车型、8 perk、1 结算。
**乐趣假设**：得分（漂移）与生存（速度）对立制造持续取舍；bot 遥测验证：drift 占比 20–50%、有 crash 也有 nearMiss、首胜 ≤120s、重开率。
**签名记忆点**：后视镜里红蓝警灯越漂越近，氮气一喷甩开半条街——屏幕边缘红蓝闪+距离条回弹。
**反范围（不做）**：① 多赛道选择（只 1 条夜城环线）；② 车辆解锁商店（3 车直接可选）；③ 在线排行榜；④ 警察 PIT/碰撞逮捕动画（仅距离条）；⑤ 开放世界/自由漫游；⑥ 损伤维修系统。
**美术来源**：AI 优先——天空盒/海报/图标走 h3-image（A 机）；车漆/路面贴图复用 neon-drift 自有资产；警车灯条/烟雾/粒子程序化；BGM 走 minimax-music-2.5；SFX 程序化 WebAudio。

## 世界/坐标/单位

- 逻辑视口 1280×720 letterbox；3D 渲染，DPR 封顶 2；60Hz 固定步长（STEP=1/60）。
- 赛道空间 `(s,t)`：s=中心线弧长(m)，t=横向(m)，halfWidth=8。圈长 L≈1500m。
- 世界坐标 y 向上；渲染由 track samples 建 mesh。

## 实体字段（sim 纯逻辑，无 DOM/THREE）

```js
run = {
  phase: 'lights'|'race'|'busted'|'finished',
  time, lap(1..3), heat(1..3), lapTimes[],
  score, mult(1..10), noDriftT, nitro(0..1), boostT,
  player: { s,t,angle,speed,steerSmooth,drifting,offTrack },
  cops: [{ s,t,gap,speed }],          // gap = player.s - cop.s
  traffic: [{ s,t,speed,lane,passed }],
  blocks: [{ s,lane }],               // heat3 路障，占两 lane 留缺口
  launch: { result:null|'perfect'|'jump'|'normal' },
  stats: { driftSec, nearMisses, crashes, topMult },
  perks: Set<string>, events: [],
}
input = { steer:-1..1, drift, nitro, brake, launch(边沿) }
```

## 事件（sim 发，render/ui/audio 消费）

`launchPerfect launchJump driftStart driftEnd driftTick nearMiss crash offTrack boostStart boostEnd lap heat copClose busted finished`
形状 `{ type, ... }`：crash={x,z 世界坐标可选,s,t}；nearMiss={bonus}；driftTick={add}；lap={n,time}；busted/finished={score,rating}。

## 模块 API

- `track.js createTrack(def)` → `{ length,n,ds,halfWidth,samples,curvatureAt(s),at(s),toWorld(s,t) }`；sample=`{x,z,tx,tz,sx,sz}`。
- `sim.js createSim({seed,perks,car})` / `updateSim(run,input)` / `getHud(run)` / `drainEvents(run)`。
- `render createRenderer(canvas, track)` → `{ render(run,dt), resize(w,h), dispose() }`。
- `ui`（M3）：`showTitle/showGame/showPause/showResults(run)/updateHUD(run)/applyLang/setLang`；`ui.tutorial={active,step,steps,current,skip(),start()}`；perk 选择 UI。
- `audio createAudio()`（M4）：`ensure/resume/stopAll/setEngine(r,boost)/setSkid(on,i)/setSiren(level)/event(name)/ui()/beep(green)/setMuted(b)`。
- `main.js` 装配；`window.__ll`：`state.phase/run/start/pause/resume/restart/startTutorial/tutorial/save/ui/lang/setLang`。

## 输入契约

held（steer/drift/nitro/brake）由 main 读键盘/触屏；launch 为 pressed 边沿（main 做边沿检测后传 true 一帧）。

## 状态机

title → lights(3s 红灯) → race → (busted | finished) → results；race ⇄ paused。restart 回 lights。

## 数值（config/game.config.js 集中）

- 车：maxSpeed 74、accel 19、brake 46、steer 1.7、driftSteer 2.25、grip 5.4、driftGrip 1.15、driftMinSpeed 26、boostMul 1.42、boostTime 2.3、curveForce 1.25（沿用 neon-drift 校准）。
- 警车：base 0.80×maxSpeed，heat 每级 +0.05；rubber：gap>60 +8m/s，gap<10 −6；crash gap−18；bust gap≤3 持续 1.2s；初始 gap：perfect 55 / normal 38 / jump 13；heat2 第二辆 gap+12。
- 倍率：driftStart 且距上次 driftEnd≤2.5s → mult+1（cap 10）；noDrift 6s → 1（chain-lock 免除）；crash → 1。
- 得分：drift `speed*|angle|*dt*6*mult`；nearMiss 150×mult；lap 500×mult。
- 氮气：drift 充 `|angle|*speed*0.02*dt`；nearMiss +0.15；满 1 才能 boost。
- 车流：heat1 每 2.5s / heat2 1.6s / heat3 1.4s，前方 120–180m，lane∈{−5,0,5}，speed 22–30；碰撞 |ds|<4.2,|dt|<2；nearMiss 2<|dt|<3.4 且超车。
- 路障：heat3 每圈 3 处（0.25/0.55/0.8 L），占两 lane。
- 评级：S≥15000 A≥10000 B≥6000 else C；busted 封顶 B。
- perk 解锁里程：3k/6k/10k/15k/20k/30k/45k/60k。

## 文件所有权

| Owner | 文件 |
| --- | --- |
| Lead | index.html、src/main.js、config/*、src/core/{i18n,save,sdk}.js、src/game/*、tests/*、tools/*、lib/、assets/、styles.css 最终合并 |
| M2 qodercli | src/render/* |
| M3 claude | src/ui/*、styles.css 主笔 |
| M4 claude | src/core/audio.js |

## 里程碑与验收

- M1 sim（Lead）：`node --test` 全绿 + selfplay bot 三策略。
- M2 render：shot 截图 + vision-review ≥WARN。
- M3 UI：tutorial-check PASS + i18n-check + 双视口截图。
- M4 audio：audio-check RMS。
- M5 集成（Lead）：G5 全套门禁。