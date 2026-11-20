# BALLOON BURST · 交付说明

## 1) 源码分析摘要（原作「气球大消除」玩法事实）

> 源码路径：`local/src1/气球大消除/`（Cocos Creator + TypeScript）

- **点击破气球（核心动作）**：`Balloon_1.ts:38-45` 的 `onTouchStart` 调 `reduceTimeNum()` + `reduceHp()`；`Balloon_1/2/3.ts:23/22/22` 分别定义 `_hp = 1/2/3`，点一下扣 1 血，扣到 0 进 `gameOver()`。
- **破球得分 + 金币四散**：`Balloon_1.ts:48-58` `gameOver()` 里 `addGoldScore(66)`（Balloon_2=88、Balloon_3=99），并朝 `_pos_1.._pos_4` 四个方向（上下左右）各抛一枚金币，同时 `reduceEnemyNum`。
- **计时/步数结构**：`GameConfig.ts:13` `restartCount: 2`、`GameConfig.ts:18-22` `gameTimer: 100`（秒）；但实际运行用的是 `Layer_1.ts:86` 的 `_timeNum = 3`，`Layer_1.ts:229-232` `reduceTimeNum()` 每次点击 -1——即原作是「每关 3 次点击」的伪计时，而非真倒计时。
- **关卡推进**：`Layer_1.ts:234-301` `getIsExistEnemy()` 按 `_levelNum` 1→2→3→4 推进；`Layer_1.ts:302-339` `setEnemyNum()` 配置每关气球数量（L1=2、L2=8、L3 混 1/2/3 级、L4 混 2/1/2 级）。
- **结束/重开**：`Layer_2.ts:50-53` 「再试一次」调 `Layer_1.againGame()`；`Layer_1.ts:341-386` `againGame()` 按当前关重建气球，`GlobalData.ts` 保存 `lastScore` / `isOpenLayer_2`。

## 2) 改造点清单

**保留（1:1 还原的玩法事实）**
- 同色群「点击即消除」的品类核心（原作是点单个气球扣血，spec 升级为点同色群，但保留「点击→消除→得分→上方补充」的节奏）。
- 连消越大分越高（组分数 = n² × 基准分）。
- 上方气球落下补充（本作「灯笼上浮补位」，方向语义换成正向的「升空」）。
- 计时关卡制（按 `gameTimer` 结构做成真倒计时，`restartCount` 对应可重开）。

**原创改造（热气球节主题）**
- 主题：夜空烟花场上的**纸灯笼群**，三场景「黄昏集会 / 夜空灯节 / 晨雾山谷」（换章换色板+构图+装饰）。
- 连锁「灯串」：消除后上浮靠拢形成新同色群自动连锁加分。
- 签名记忆点：单次消除 ≥6 盏时，破掉的灯笼化作**孔明灯升空 + 全屏暖光**。
- 12 关推进 + 特殊灯笼：金属（两击）、火星（引燃整行）、锁链（成对同消）、变色（5 秒换色）、石头（不可消沉底）、爆点（3×3）、加时、双倍，终章综合。
- 操作：点击 / 拖选滑动；英文默认 + 中文；交互式引导（3 步、可跳过、可重看、持久化）。

## 3) 门禁最终输出摘要（全部通过）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 19 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 串行打到第 3 关（completed=true, reached=3） |
| `fun-audit` | **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report` | **PASS**（10 pass / 0 warn / 0 fail） |
| `verify-game` | **PASS** 60fps / 0 console error / 0 failed request |
| `i18n-check` | **OK**（en/zh 各 45 key，0 missing / 0 empty） |
| `tutorial-check` | **PASS**（visible/active/steps=3/skip/persist/replay 全过） |
| `sdk-check` | **PASS**（全部 ✓，含降级/存档/分享/埋点） |
| `audio-check` | **PASS**（BGM 40s 无缝 + 16 个 SFX RMS/时长/峰值全过） |
| `vision-review` | **PASS**（readable 8.9 / silhouette 7.5 / style 9.4，8 张全 goal_visible、无遮挡/裁切） |

## 4) 上线物料路径

- `poster.jpg`（1280×720，标题屏 + 贴纸字）
- `poster-1920.jpg`（1920×1080）
- `game.gif`（480×270，约 5s 循环，0.96MB）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）
- `icon.png`（256×256）、`favicon.png`（32×32）

## 5) 未做项与已知问题

- 未接入真实广告账号：`config/sdk.config.js` 的 `ads.enabled=false`、`source='local'`（vendored SDK 本地验收），上线前改 `source='online'`。
- ja/ko/ar/ru 未翻译，按铁律整块未暴露（下拉仅 en/zh）。
- 无真人试玩数据（`--human` 为可选证据，本流程未跑）。
- 部分特殊灯笼图标（金属/加时）较小，vision-review 建议加图例；已在 HUD 与文案层补偿说明，未单独加图例页。

## 6) 最不满意的一处

**连锁（灯串）的计分仍在「线性 × 连锁层数」上，且连锁过程在 sim 里是同步结算的**——画面上的「上浮靠拢→再成组→再爆」没有逐波动画时间，玩家的因果感（我这一手触发了什么）被压成一帧。理想做法是给 cascade 事件带 `delay` 让渲染层分波播放，但为了守住「sim 纯逻辑 + 60fps 0 error + greedy 可复现」的底线，本版选择了同步结算、事件携带 cells 由渲染一次性补粒子。这是下一版最想补的手感缺口。
