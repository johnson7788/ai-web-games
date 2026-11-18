# Oasis Pipeworks（绿洲水工）· 设计源与契约

> 参考源码：`/Users/admin/Downloads/1/已经创建链接/拼水管游戏cocos.rar`（Cocos Creator 2.x）
> 路线：**提取重写**（玩法规则 P0 1:1 还原，角色/场景/音色 P2 全原创）。
> 结论：这是本仓库 `games/oasis-pipeworks/` 的唯一契约页；agent 交付以本页为准。

## 0. 一句话 / 身份

- **一句话**：开闸前的倒计时里，从滑落的管件队列中抓管子铺进沙漠网格，让水一路灌到绿洲的出水口——岩石逼你绕路，花朵引你抄远路。
- **身份四元组**：hook=「水还有 45 秒开闸，用一截截水管把沙漠凿出一条活路」/ verb=布管（grab+place+dig）/ world=沙漠绿洲供水站 / signature=水流实时灌满整条管路、沿途花朵逐个绽放。
- **品类**：益智（puzzle）。难度来自判断与规划，不来自手速。
- **反范围（本版不做）**：不做在线对战、不做无尽模式、不做管件旋转（拿了什么就得用什么——这是原作核心张力）、不做多水流、不做氪金商店、不做成就系统。

## 1. 参考玩法事实（源码 `assets/scripts/main.js`）

P0 必须还原的规则（源码行号）：

| 事实 | 源码 |
| --- | --- |
| 网格 row×col 默认 4×6，右侧 1 列等待区 | main.js:40-47 |
| 6 种管型：E(左右) N(上下) UL(左上) UR(上右) LL(左下) LR(下右) | main.js:80-100, 1301-1331 |
| 起点固定 N 型：grid[0][0]，入口 top 出口 down；终点 N 型 grid[row-1][col-1] | main.js:530-533, 954-955 |
| 等待区每行 1 槽，管件从顶掉落补位，sineIn 0.5s | main.js:571-635 |
| 只能取等待区管件，选中后跟随鼠标，点空格放置；已放置不可取回 | block.js:75-92, main.js:330-344 |
| 倒计时 gameTime=60s 后 started=true 水流开始 | main.js:244-246, 1031-1042 |
| 水流每格 blockTime=5s，格内贝塞尔 5 点插值 | main.js:20-26, 775-839 |
| 下一格必须入口匹配（entrance↔exit 表）否则结束：停在 (row-1,col-1) 判 win 否则 lose | main.js:664-851 |
| 水流绘制为 43px 宽折线，圆角连接 | main.js:883-902 |

P1 同构（反馈节奏）：抓取高亮 / 放置吸附 / 水头沿路径渐进灌注 / 过关结算卡。
P2 原创（全部重做）：沙丘场景、陶土管件造型、角色（一只守水井的沙漠小狐狸搬运工）、BGM/音效。

## 2. 玩法改造（改游玩方式，保原汁原味）

在 P0 骨架上新增：

1. **岩石格（rock）**：不可放置，必须绕路（关卡数据给出）。
2. **花朵格（bloom）**：格子上带花；水流经过该格时 +1 bloom（结算星级用）。
3. **十字管（X）**：第 5 关起进入队列；水流从任一直边进可从对边出，且十字格允许「水经过后仍可继续两条支路」——本作简化为直通（竖进竖出、横进横出），不分叉。
4. **铲除（dig）**：每局 1 次，点已放置管格清除（岩石/起点/终点不可铲）；看激励广告可再补 1 次（每局封顶补 1 次）。
5. **星级结算**：1 星=通关；+1 星=本关全部花朵浇到；+1 星=剩余时间 ≥ 初始倒计时 30%。
6. **关卡推进**：12 关，3 章（见 §4）。
7. **队列锁定件（L10+）**：某队列件带锁，累计放置 3 根管后才解锁可抓取。

## 3. 数据契约（跨模块唯一真相）

### 3.1 世界与坐标

- 逻辑世界 1280×720，左上角 (0,0)，canvas letterbox 缩放。
- 网格区：左侧居中；等待区：右侧一列。`CELL = min(可用宽/cols, 可用高/rows)`，由 render 从 config 计算，sim 不依赖像素。
- `game.config.js`（Lead 拥有）导出 `WORLD/STEP/CONFIG`；`config/levels.js`（M1 拥有）导出 `LEVELS` 数组与 `LEVEL_COUNT`。

### 3.2 管型与连接语义

```
piece: 'E' | 'N' | 'UL' | 'UR' | 'LL' | 'LR' | 'X'
opens(piece) -> 两条边（X 为 4 边）：
  E: left+right   N: top+bottom
  UL: left+top    UR: top+right   LL: left+bottom   LR: bottom+right
  X: 全部（竖直通过：top↔bottom；水平通过：left↔right，按水进入方向决定）
```

### 3.3 sim API（M1 交付，纯逻辑，零 DOM）

```js
import { createRun } from '../src/game/sim.js';
const run = createRun(levelIndex, { seed });     // seed 可选，随机用 mulberry32
run.state   // 见 3.4
run.step(dt)                                      // dt 秒；推进倒计时/水流/队列补位动画计时
run.grab()            -> { ok, piece }            // 抓队首可抓件（顶部第一件未锁定的）
run.place(r, c)       -> { ok, reason }           // 放置 selected 到空格
run.dig(r, c)         -> { ok, reason }           // 铲除已放管格
run.getHud()          -> { level, timeLeft, phase, blooms, bloomTotal, digLeft, stars, queueLen, selected }
run.drainEvents()     -> [event]                  // 事件表见 3.5
run.inputLatencyProbe // 供遥测：无需实现，main 层测
```

### 3.4 `run.state` 形状（渲染消费）

```js
{
  level, phase: 'countdown' | 'flowing' | 'won' | 'lost',
  rows, cols,
  grid: [ [ { kind: 'empty'|'rock'|'start'|'end'|'bloom'|'pipe',
              piece: null | pieceType, watered: false, waterT: 0 } ] ],  // grid[r][c]
  start: { r, c, entrance: 'top'|'down'|'left'|'right', exit: opposite-ish },
  end:   { r, c, entrance, exit },
  queue: [ { piece, locked: bool, offsetT: number } ],   // index 0 = 底槽（最先被抓），向上下补
  queueCap,
  selected: pieceType | null,
  timeLeft, initialTime,
  water: { path: [{x, y}(格中心像素坐标，sim 不算像素——由 render 从 r,c 映射)],
           cells: [ {r, c, tEnter, tExit} ], head: 0..cells.length, t: 0 },
  blooms, bloomTotal, digLeft, digMax, placements,
  stars, result: null | { won, stars, blooms, bloomTotal, timeLeft, placements }
}
```

> 像素换算全部由 render 做（render 从 `WORLD` 与 rows/cols 算 cell 原点）；sim 只输出格坐标与归一化进度 `t`（0..1 per cell）。

### 3.5 事件表（sim 发，render/audio/ui 消费）

```
{ type:'grab', piece }
{ type:'place', r, c, piece }
{ type:'dig',   r, c }
{ type:'countdownTick', timeLeft }
{ type:'flowStart' }
{ type:'cellWatered', r, c }
{ type:'bloom', r, c, blooms }
{ type:'win',  stars, blooms, timeLeft }
{ type:'lose', reason: 'deadEnd'|'timeOut', r, c }
{ type:'queueRefill', piece }
```

### 3.6 状态机（main 拥有）

`title → levelSelect → tutorial(仅首次) → playing(countdown|flowing) → paused → result(won|lost) → levelSelect`

### 3.7 冒烟测试（每个 agent 交付前必跑）

```js
const r = createRun(0, { seed: 1 });
r.step(1/60); r.grab(); r.place(0,1); r.getHud(); r.drainEvents();
```

## 4. 关卡表（12 关 3 章，M1 落进 config/levels.js）

| # | 章/场景包 | rows×cols | 时间 s | 岩石 | 花朵 | 新元素 | 队列特性 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | dawn-desert | 3×4 | 45 | 0 | 0 | 教学关（tutorial+failSafe，teachSteps 3） | 3 槽 |
| 2 | dawn-desert | 4×5 | 45 | 0 | 0 | 队列 4 槽常驻预览 | 4 槽 |
| 3 | dawn-desert | 4×5 | 45 | 2 | 0 | 岩石 + 解锁铲除 | 4 槽 |
| 4 | dawn-desert | 4×6 | 50 | 2 | 2 | 花朵计星 | 4 槽 |
| 5 | dusk-canyon | 4×6 | 50 | 3 | 2 | 十字管入队 | 4 槽 |
| 6 | dusk-canyon | 4×6 | 50 | 2 | 3 | 起终点对调（起点右下，终点左上） | 4 槽 |
| 7 | dusk-canyon | 5×6 | 55 | 5 | 2 | 双岩石走廊窄缝 | 4 槽 |
| 8 | dusk-canyon | 5×6 | 55 | 3 | 3 | 水速 ×1.3（blockTime 3s） | 5 槽 |
| 9 | night-oasis | 5×6 | 55 | 2 | 5 | 三连花田 | 5 槽 |
| 10 | night-oasis | 5×7 | 60 | 4 | 3 | 队列锁定件 | 5 槽 |
| 11 | night-oasis | 5×7 | 60 | 6 | 3 | 大网格长线规划 | 5 槽 |
| 12 | night-oasis | 5×7 | 60 | 6 | 5 | 终章三轴叠加 + 水速 ×1.3 | 5 槽 |

- 每关固定 `start`/`end` 摆位与 rock/bloom 坐标由 M1 给出并保证可解（写 solver 验证测试）。
- `difficulty` 自评 0-10：1,1.5,2.2,2.8,3.2,3.5,4.2,4.6,5,5.4,6,6.5。
- L1 failSafe：无岩石无花，45s 充裕，水流 3.5s/格（宽松）。

## 5. 视觉与音频（M2/M4 契约）

- **场景包**（3 套，色板+构图+装饰，一眼可分）：
  - `dawn-desert`：暖沙色底 #E8C78A/#D9A85F，远处沙丘剪影，龟裂地面纹，晨光顶部渐层，棕榈 1-2 棵。
  - `dusk-canyon`：赤陶/绛紫 #C4552D/#6B2D5C，层岩褶皱，石柱剪影，落日光斑。
  - `night-oasis`：深青/星蓝 #0E3B43/#123C5A，星点+月亮，水光波纹贴地，萤火粒子（≤8 个）。
- **管件造型**：陶土管（赤褐 #A0522D 系 + 内壁深色 + 高光环带），弯管用圆弧，法兰环在端口。水流为浅水蓝 #7FD8E8 半透明，水头处高光点。
- **角色**：网格旁蹲一只小狐狸搬运工（程序化 canvas 绘制，抓管时耳朵竖起、放置时尾巴摆动 6px、水流赢时跳跃）。低幅 idle 动画。
- **HUD**：顶部通栏（关卡名 + 时间胶囊 + 花朵计数 + 铲除按钮带次数徽标），等待区在网格右侧带「NEXT」箭头与下落缓动。
- **音频（M4）**：WebAudio 全程序化。BGM 益智轻快（BPM 112，C 大调/A 小调四级和弦循环，两段 A/B 各 8 小节无缝循环，四层：木鱼点+贝斯+和弦垫+马林巴主音）。SFX：grab(木 click)、place(陶土 clunk+沙 puff 噪声)、dig(铁锹沙爆)、flowTick、bloom(风铃)、win(上行五音 jingle)、lose(闷 thud)、countdown 最后 5s beep。

## 6. 文件所有权

| Owner | 文件 |
| --- | --- |
| Lead（我） | `index.html`、`src/main.js`、`config/{game.config,locales,sdk.config,design}.js`、`src/core/{i18n,save,sdk}.js`、`src/vendor/pipysdk.js`、`styles.css` 最终合并、`tools/verify.plan.json`、tutorial、`tests/final/` |
| M1 qoderclicn | `src/game/sim.js`、`src/game/level.js`（如需）、`config/levels.js`、`tests/*.test.mjs`、`tools/selfplay.mjs` |
| M2 qodercli | `src/render/index.js`、`src/ui/ui.js`、`styles.css`（主笔，Lead 终审合并） |
| M4 claude | `src/core/audio.js`、`tools/audio-check.mjs` |

## 7. 验收（G5 全套命令，见 webgame-playbook SKILL.md G5）

`node --test` / `tools/selfplay.mjs` / `verify-game` / `i18n-check` / `audio-check` / `sdk-check` / `fun-audit` / `fun-report` / `vision-review` / `tutorial-check`。
