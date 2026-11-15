# SKY RIDER 3D（天空骑士）

飞机穿环竞速，8 机同场（1 玩家 + 7 bot 补位）。3 圈竞速，俯冲提速、穿环回充 boost、尾流追赶，冲线排名结算。低多边形天空峡谷，金环发光，飞机拉烟。

## G0 · 八问

1. **一句话**：玩家驾驶飞机在天空峡谷里穿金色圆环竞速，与 7 台 AI 飞机抢 3 圈排名。
2. **参考**：仅借鉴品类思路（`jolbol1/apex-gp` 的程序化赛道 / 任天堂飞行员系列穿环手感），不抄素材/角色/UI。
3. **差异化**：① 俯冲=提速、爬升=减速的速度↔高度耦合，让「走线」成为持续取舍；② 尾流跟随（前机 5m 内 +10% 速度）让「跟线」成为签名对抗；③ 漏环罚时但撞环只掉速不淘汰——失误有代价但不终结一局。
4. **操作**：键鼠 W/S 俯仰、A/D 偏航+坡度、Shift boost、空格刹车、C 切相机、R 重开；触屏左摇杆飞行 + 右 boost/刹车按钮。
5. **一局**：约 2–3 分钟（3 圈），无淘汰；爽点在第 15 秒第一次穿环回充 boost、第 40 秒第一个连续窄环段。
6. **成长**：局内=boost 条管理 + 走线熟练度；跨局=最佳完赛时间存档 + 5 赛道锦标赛解锁（赛道选择持久化）。
7. **结局**：冲线后显示名次/评级（S/A/B/C）/用时/穿环率/漏环/坠机；可重开或回菜单。
8. **乐趣**：主乐趣 = mastery（走线 + 俯冲节奏 + 尾流）；副乐趣 = social（8 机同场抢位）。第 3 分钟还玩是因为「差一点就 S 评级 / 再试一条赛道」；第一个有代价的决定在第 8 秒（俯冲抢速 vs 平飞稳穿环）。

## 数据契约

### 世界 / 坐标 / 单位
- 单位：米；逻辑帧 60Hz（`STEP = 1/60`）。
- 3D 闭环赛道：`src/game/track.js` 生成 `rings[]`，每环 `{bx,by,bz 基础中心, nx,ny,nz 前向法线, radius 判定半径, moveAmp/moveFreq/phase}`。
- 地面 `y=0`（峡谷），环在 y≈35–90；赛道半径 ~300m，每圈 16–20 环。
- 视口 1280×720 letterbox（`#stage` 缩放），相机 16:9 追踪。

### 实体字段
- 玩家/飞机（`run.player` 与 `run.bots[]` 同构）：`pos{x,y,z} / yaw / pitch / roll / speed / boost(0..1) / boosting / ringIndex / lap / ringsPassed / finishTime / finished / fx,fy,fz 前向`。
- 环：见 track.js；`run.track = {rings, ringCount, length, variant}`。
- `run.stats = {ringsPassed, ringsTotal, hits, misses, crashes, topSpeed}`。

### 事件名（`run.events`，`drainEvents` 消费；render/audio/ui 各自订阅）
`countdown` · `raceStart` · `ringPass{n,total}` · `ringHit` · `ringMiss{penalty}` · `groundHit` · `crash` · `boostStart` · `boostEnd` · `slipstream` · `dist{m}` · `lap{n}` · `finished{time,ringsPassed,rank,rating}`

### 模块 API
- `createSim({seed, trackIndex})` / `updateSim(run, input)` / `drainEvents(run)` / `getHud(run)` / `slipstreamActive(p, bots)`。
- `createRenderer(canvas)` → `{render(run,dt), onEvent, resize(w,h), switchCamera(), dispose()}`。
- `ui`：`showTitle/showGame/showPause/hidePause/showResults/updateHUD/updateCountdown/popup/applyLang` + `tutorial`。
- `audio`：`ensure/resume/stopAll/setEngine/event/ui/setMuted/getLevel` + `unlock/muted/play(name)`。
- `Sdk`（统一出口）：`ready/track/newRun/levelCleared/gameOver/canShowAd/showRewarded/showInterstitial/save/load/share`。

### 输入契约
`input = {pitch: -1..1(+爬升/-俯冲), yaw: -1..1, boost: bool, brake: bool}`；held 状态由 main 的 `readInput()` 归并（键盘 + 触屏 + `window.__AUTO` 调试覆盖）。

### 状态机
`title → playing(countdown → race → finished) → results → title`；`playing ⇄ paused`；`restart`（回标题）与 `R`/按钮 `重开`（原地重赛）。

## 已知 TODO / 未做项
- 未做真联机（7 bot 补位）、武器、飞机改装、剧情（brief 反范围）。
- ja/ko/ar/ru 未整块翻译，仅暴露 en/zh（铁律 7）。
- SDK 用 `source:'local'` 本地降级实现；上线时改 `config/sdk.config.js` 为 `online`。
- 无「失败」态（竞速不淘汰），漏斗 `fail` 事件不触发（`load/start/win/restart/session_end` 齐全）。
- 尾流/坠机粒子为程序化占位；AI 素材（`assets/sky.jpg`/`bgm.mp3`）已接线，缺失回退程序化。
