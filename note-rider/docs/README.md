# NOTE RIDER · 契约页

琴弦骑士：骑音符马的骑士在五线谱桥上驰骋，命中小节音符 = 挥剑斩弦魔。

## 1. 设计源（G0 八问落点，详见 config/design.json）

- **一句话**：骑士骑在音符马上驰骋五线谱桥：跟上节拍换轨挥剑，斩尽迎面扑来的弦魔，连续完美触发整行震动的和弦斩。
- **主乐趣** mastery / 副乐趣 expression。
- **签名记忆点**：连续 8 个 Perfect 触发「和弦斩」，整行五线谱震动。
- **反范围（不做）**：不做真实音频文件谱面（逻辑节拍时钟 seeded 可复现）；不做联机/排行榜；不做多角色；不做商城/装备；不做关卡编辑器。

## 2. 世界 / 坐标 / 单位

- 逻辑世界 1280×720，letterbox；60Hz 固定步长（`STEP = 1/60`）。
- 判定线 `HIT_X = 300`；玩家 `PLAYER_X = 232`。
- 两条弦（轨道）`LANE_Y = [330, 420]`，对应五线谱第 2/4 线；五线谱 `STAFF_LINES = [285,330,375,420,465]`。
- 每拍横向宽度 `PX_PER_BEAT = 220`；note 屏幕 x = `HIT_X + (note.start - beatClock) * pxPerSec`。

## 3. sim 契约（src/game/sim.js，纯逻辑）

### createRun(levelIndex, {seed}) → run
- `run.state`：`level/phase/lane/lanes/beatClock/bpm/speedMult/chartDuration/leadTime/notes/notesTotal/notesHit/notesMissed/score/combo/comboMax/perfectStreak/perfect/great/good/hp/maxHp/energy/energyMax/result/bossDefeated`。
- `phase`: `playing | won | lost`。
- `note`: `{id,lane,type,start,end,hp,damage,isBoss,resolved,spawned}`；`type ∈ tap|hold|red|double`。
- 方法：`step(dt)` / `slash()` / `release()` / `switchLane(target)` / `useSkill(id)` / `getHud()` / `drainEvents()`。

### 判定
- `HIT_WINDOWS = {perfect:0.06, great:0.12, good:0.18}`（秒）；`GRADES = {perfect:{score:30,dmg:2}, great:{20,1}, good:{10,1}}`。
- `hold`：按下即蓄力，蓄满（`beatClock >= note.end`）全额伤害；提前松手（progress<0.88）判漏击。
- `red`：斩中反打扣血（redHit）；不斩越过判定窗 = dodge 无伤。
- 漏击 = 弦魔反击，扣 `note.damage`，断连。

### 事件名（谁发、谁消费）
`beat / noteSpawn / slash / hit / perfect / great / good / miss / redHit / dodge / switch / holdStart / holdComplete / kill / bossDefeated / chordSlash / skill / heal / hurt / block / lifesteal / win / lose`。
sim 发，main 消费（audio.event / view.fx / 结算 / 教程推进）。

## 4. 关卡（config/levels.js）

12 关 3 章：`dawn`（L1-4 晨曦弦桥）/ `rain`（L5-8 雨夜琴城）/ `star`（L9-12 星海音阶）。
每关唯一 newElement；bossHp/BPM 单调不减；skillSelect 在 L5/L8/L11；tempoShift 在 L6；double 自 L7。

## 5. 输入契约

- `Space`/点击 = slash（按下）；`Space` 松开/pointerup = release。
- `↑/↓` 或上下滑动 = switchLane（单弦关返回 `single`；换轨有 0.12s 硬直）。
- `1/2/3/4` = shield/burst/lifesteal/heal。
- `Esc/P` 暂停/继续，`R` 重开，`M` 静音。
- held vs pressed 边沿检测归 main（keydown/keyup，pointerdown/pointerup）。

## 6. 状态机（phase）

`title → playing → paused ↔ playing → result → title`（result 仅由 win/lose 事件进入）。

## 7. 文件所有权

| Owner | 文件 |
| --- | --- |
| Lead | index.html / src/main.js / config/* / src/core/{i18n,sdk} / styles.css / tools/* / tests/final |
| sim | src/game/sim.js / tests/*.test.mjs |
| render | src/render/index.js |
| audio | src/core/audio.js / tools/audio-check.mjs |

## 8. SDK 统一出口

业务代码只碰 `src/core/sdk.js`（广告/埋点/存档/分享，全降级）；配置在 `config/sdk.config.js`（appId `pipy-note-rider`）。
