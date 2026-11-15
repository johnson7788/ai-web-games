# VAULT RUN（屋顶跑酷）—— 立项、设计源与接口契约

> 品类：第一人称 3D 跑酷（platformer）· 平台：浏览器（桌面 + 移动）
> 语言：默认 **英文**（en），**中文**（zh）必做；ja/ko/ar/ru 未翻译，整块不暴露
> 参考：StarKnightt/parapet（只读动作状态机设计，代码重写）+ three-player-controller（MIT）
> 代码在 `games/vault-run/`，纯静态、零构建、零运行期外链（唯一例外 pipysdk，加载失败降级可玩）。

## 0. 一句话与立项（G0 八问）

1. **一句话**：第一人称屋顶跑酷——自动前进，翻越 / 滑铲 / 蹬墙，5 分钟一局。
2. **参考**：parapet（屋顶跑酷动作状态机）、three-player-controller（第一人称控制器）；只借鉴品类，不抄素材/角色/UI。
3. **差异化**：① 屋顶视角 + 黄昏低多边形城市剪影（暖橙/天空紫色板）；② 三动词上下文状态机（翻越/滑铲/蹬墙）各带代价与连击；③ 计时生存局（时间加成拾取 + 坠落回检查点扣时），5 分钟速通压力。
4. **操作**：桌面 A/D 变向、空格上下文动作、Shift 冲刺；触屏左右滑动变向、点按动作、长按冲刺。
5. **一局**：5 分钟计时，速度随时间上升；撞障碍停 1s 扣 3s，坠落回检查点扣 10s；时间归零或冲过 2000m 终点 = 结算。
6. **成长**：局内——速度上升 + 连击倍率（×2 上限 ×8）+ 体力管理；跨局——最佳距离存档 + 评级。
7. **结局**：冲线 = WIN（评级 S/A/B/C）；时间归零 = "TIME'S UP"（同样结算评级）；重开一键回标题。
8. **乐趣**：主 **mastery**（时机与路线掌控），副 **expression**（连招流畅度）。第 3 分钟玩家为什么继续：连击升调 + 越来越密的障碍 + 追逐最高评级；第一个有代价的决定在第 8 秒（翻越矮墙还是绕路）。

**乐趣假设**：玩家会为了「连续翻越 3 道矮墙的节奏下压 + 连击音效升调」而反复重开，直到摸出最短路线。
**签名记忆点**：三连翻越矮墙，相机节奏性下压 + 手撑画面 + COMBO ×3 升调。

**反范围（这版不做）**：不做联机、不做开放城市、不做角色皮肤、不做剧情、不做超过 5 分钟的局。

## 1. 核心循环

- **秒级**：自动前进 → A/D 变向 → 空格上下文动作（翻越/滑铲/蹬墙）→ 成功得分+连击 / 失误扣时。
- **局级**：5 段路线（天台→管道→窄巷→吊臂→速降）→ 冲线或时间归零 → 评级 + 最佳距离。
- **长线**：最佳距离存档 + 评级追求。

**3 分钟循环（教-练-变-收）**：教 30s（翻越矮墙）→ 练 45s（滑铲管道）→ 变 30s（蹬墙窄巷 + 吊臂移动平台）→ 收 15s（速降冲线）。

**每关新元素**：

| 关 | 新元素 | 段 |
| --- | --- | --- |
| 1 | 翻越矮墙（含签名三连） | 天台 |
| 2 | 滑铲管道 | 管道 |
| 3 | 蹬墙跨缺口（窄巷，侧向坠落风险） | 窄巷 |
| 4 | 移动吊臂平台（对齐 x 过缺口） | 吊臂 |
| 5 | 高速窄梁 + 连续翻越冲线 | 速降 |

## 2. 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 变向 | A / D 或 ← / → | 左右滑动 |
| 上下文动作 | Space（翻越/滑铲/蹬墙） | 点按 |
| 冲刺 | Shift（耗体力） | 长按 |
| 暂停 | Esc | — |

## 3. 数据契约（§5.3）

### 世界/坐标
- 逻辑视口 **1280×720**（letterbox，`#view` 缩放），60Hz 固定步长（`STEP = 1/60`）。
- 世界为直线路线：玩家沿 **+z** 前进（0 → 2000m），**x** 横向，**y** 高度（屋顶面 y=0）。
- 5 段各占一段 z 区间（`LEVELS.startZ`），每段一个横向半宽 `halfWidth`（越窄越容易侧向坠落）。

### 实体
```js
run = {
  seed, phase: 'running'|'finished', reason, win,
  time, clock, speed, dist, score, combo, stamina, stunT,
  player: { x, y, z, acting: null | { type, t, dur, ob } },
  course: { finishZ, obstacles[], pickups[], sections[], halfWidthAt(), sectionAt(), checkpointAt() },
  stats: { vault, slide, wallrun, hits, falls, pickups, topCombo },
  events: [], rng,
}
obstacle = { id, type: 'vault'|'slide'|'wallrun'|'crane', z, x, w, h?, gapW?, platformAmp?, platformFreq?, phase?, platformHalf?, cleared }
```

### 事件（谁发谁消费）
| 事件 | 载荷 | 消费 |
| --- | --- | --- |
| `step` | — | 脚步音 + 画面 bob |
| `vault` / `slide` / `wallrun` | `combo` | 音效/粒子/弹窗/教学 |
| `success` | `action, combo` | 首胜遥测 |
| `combo` | `n` | 连击升调音 + 弹窗 |
| `hit` | `obstacle` | 撞停震屏 + 扣时提示 |
| `fall` | `at` | 坠落音 + 回检查点提示 |
| `pickup` / `milestone` / `section` | — | 音效 + 弹窗 |
| `win` / `timeout` | `score` | 结算 + SDK 漏斗 |

### API
```js
createSim({ seed }) -> run
updateSim(run, input) -> run   // 纯逻辑，固定步长
drainEvents(run) -> Event[]
getHud(run) -> { phase, time, dist, speed, score, combo, stamina, section, acting, next }
teleportTo(run, z, x)          // 调试/验收瞬移
ratingFor(score) -> 'S'|'A'|'B'|'C'
Render.createRenderer(canvas) -> { render(run,dt), onEvent(ev), resize, dispose }
UI.ui -> { showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang, tutorial }
Audio.createAudio() -> { unlock/setMuted/muted/play/event/resume/stopAll/ui/getLevel }
```

### 输入
```js
input = { steer: -1|0|1, action: bool /* 边沿 */, sprint: bool }
```
边沿检测在 `main.js`（`actionQueued`）；`window.__AUTO` 供验收/bot 注入。

### 状态机
```
title -> playing -> results
            └-> paused -> playing
```
`__ll.state.phase` ∈ `title | playing | paused | results`；`run.phase` ∈ `running | finished`。

## 4. 技术架构
- 零构建纯静态：`index.html` + ES Module；无 npm/CDN/外链；`lib/three.module.js` vendor。
- `config/*` 所有数值/文案/关卡（config-first）；`src/game/*` 纯逻辑（无 DOM/window/localStorage/Date.now，随机用 seed）。
- 事件总线：sim 发事件，render/audio/ui 各自消费。
- SDK 只走 `src/core/sdk.js` + `config/sdk.config.js`（域名锁/广告/埋点/存档/分享统一出口）；加载失败降级可玩。
- 存档只经 `Sdk.save/load`（`src/core/save.js` 封装）。
- 渲染：程序化低多边形屋顶 + 障碍 + 水箱/霓虹剪影；贴图槽位（`assets/sky.jpg`、`assets/tex/roof.webp`、`assets/tex/brick.webp`）加载失败回退纯色，不白屏不报错。

## 5. 运行与验收

```bash
node --test                                          # 纯逻辑回归（21 条）
node tools/selfplay.mjs                              # 三策略 bot → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .      # 设计结构审计
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # bot 遥测 Fun Gate
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 6. 已知 TODO（对账用）
- 吊臂移动平台相位由 seed 派生，不同 seed 难度略有差异（有意为之，未做难度归一）。
- 音效为程序化合成兜底；`assets/audio/bgm.mp3`（AI BGM）已存在，缺失时回退合成鼓点。
- 蹬墙「抄近道 vs 正路」目前实现为「蹬墙时机 vs 撞墙」，未做物理分岔路线（属反范围外的路线分支）。
