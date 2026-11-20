# Shadow Ninja Cat（影武喵）

> 横版自动跑酷：月下屋顶疾奔的忍者猫，点按跳跃、下压俯冲，收风铃、躲飞镖，闯 12 关。

## 运行

```bash
cd games/shadow-ninja
python3 -m http.server 8124   # 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 | 触屏 |
| --- | --- | --- |
| 跳 / 二段跳（斗篷） | Space / ↑ / W | 点按 |
| 俯冲 | ↓ / S | 下滑 |
| 竹蜻蜓 / 吸金铃 / 双倍铃 | 1 / 2 / 3 | HUD 按钮 |
| 暂停 / 重开 / 静音 | Esc / R / M | HUD 按钮 |

## 契约（docs/README.md §3）

### 世界坐标
- 逻辑世界 1280×720 + letterbox；60Hz 固定步长（`STEP=1/60`）。
- 世界 x = 玩家前缘距离（px），`CELL_W=96` 一格；低层地面 feet y=0，高层平台 y=`HIGH=130`。
- 玩家屏幕 x 固定 `LAYOUT.PLAYER_X=240`，`y=0` 映射屏幕 `LAYOUT.GROUND_LOW_Y=560`。

### 实体字段（sim 纯逻辑，零 DOM）
```
state: { level, scene, phase(countdown|playing|won|lost), clock, countdown,
         x, y, vy, onGround, diving, coyote, jumpBuffer, jumps, doubleJumpUsed,
         hits, chimes, chimeTotal, chimeGoal, goalDist, baseSpeed, speed,
         shield, flyT, magnetT, doubleT, invincibleT, props, abilities, stars, result,
         course[], fogRange, glideRange, dogRange }
cell: { t(flat|gap|spike|enemy|shuriken|glide), high, chime, chimeHigh, dog, fog, glide, collected }
```

### 事件表（sim 发，render/audio/ui 消费）
`countdownTick / go / jump / dive / land / cellEnter / collect / bellBonus / nearMiss / shieldBreak / speedup / fly / prop / revive / win / lose`

### 模块 API
- `createRun(levelIndex, {seed, abilities:{cloak,hook,bell}, props:{fly,magnet,double}})` → run
- `run.step(dt) / run.jump() / run.dive() / run.useProp(type) / run.revive() / run.getHud() / run.drainEvents()`
- `renderer.draw(state, dt, view) / renderer.debugLayout()`
- `audio.event(name, payload) / audio.startBgm() / audio.stopBgm() / audio.setMuted()`

### 状态机
`title → playing → (paused ↔ playing) → result → (retry|next|home)`；输赢由 sim 发 `win`/`lose` 事件驱动。

### 调试契约 `window.__ll`
`state.phase / run() / start(i) / pause / resume / restart / home / sim() / tutorial{active,step,steps,current,skip} / debug.{state,layout,loadLevel,startSeeded,setTutorialDone,startTutorial,tutorialStep,fastForward,autoRun}`

## 存档（统一走 `src/core/sdk.js`）
`save = { chimes, unlocked, stars, owned, props, ach, achTier, best, totalDist, playCount, surpass, flyCount, propCount, muted, tutorialDone, lastLevel }`，key `shadow-ninja:save`。

## 全门禁（游戏目录内执行）
见 `docs/DELIVERY.md` §3。
