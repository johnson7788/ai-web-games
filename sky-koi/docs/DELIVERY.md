# SKY KOI · 交付说明（端到端）

> 改造自 `local/src1/跳跃鸟3.0/`（Cocos Creator 3.0 flappy）· 原创主题「锦鲤跃龙门」。
> 全部门禁在 `games/sky-koi/` 内自跑，命令用直连 node 二进制（`node` 是坏掉的 nvm-lazy 函数）。

## 1) 源码分析摘要（原作玩法事实，带文件:行号）

- 单键上扑：`assets/Scripts/Bird.ts:119-156` `fly()` 用 tween 把 bird 上移 `jumpHeight=3.5`，持续 `jumpDuration=0.3`（`:24/:30`）；物理下落由 RigidBody2D 重力完成（`:122` 首次 fly 才 enable）。
- 开局漂浮：`Bird.ts:69-112` `startPreFlightAnimation()` 首扑前上下 20px 往复（pulseHeight=20 / pulseDuration=0.4）。
- 输入：`GameCtrl.ts:84-101` `onClickOrSpace()` 首次点击=重置开局、后续点击=fly；`:103-111` 键盘 SPACE + 触屏 TOUCH_START。
- 管柱循环池：`Pipes.ts:54-69` `initPos()` 门缝 `pipeGap=random(300,380)`、上柱高 `topHeight=random(20,400)`；`:72-98` 每帧左移 `pipeSpeed*dt`，过鸟计分 `:81-87`，离屏生成下一根 `:89-92`，出界销毁 `:94-97`。
- 对象池：`PipePool.ts:25-41` 预建 3 根、`:57-62` reset 清池重建。
- 地面滚动：`Ground.ts:36-91` 四段地面循环左移并回填。
- 判定：`GameCtrl.ts:198-209` 碰撞置 `bird.hitSomething`，`:222-228` update 里每帧 `birdStruck()` → gameOver。
- 结算：`Results.ts:78-104` 高分存 `localStorage["highScore"]`，`:60-78` showResult 显示高分 + 重试。
- 音频：`BirdAudio.ts:19-25` `onAudioQueue()` 是空实现（原作实际无声）。

结论：核心循环 = 单键上扑 + 重力下落 + 左右滚动门柱 + 穿门计分 + 碰撞判负 + 高分结算。

## 2) 改造点清单

**保留（1:1 还原玩法）**
- 单键上扑物理（重力 + 固定上扑冲量）、地面/水面滚动、门柱循环池、穿门计分、碰撞判负、结算屏。

**原创改造**
- 主题：锦鲤在云海跃「鸟居」门柱，穿门得分；signature = 穿门瞬间鲤鳞闪光 + 逆鳞粒子。
- 新机制①珍珠：门缝中的可选珍珠，吃满 3 颗本关升 1 星（`sim.js:_checkPearls`）。
- 新机制②水花连跳：贴水低飞（轻缓下降）触发一次免费小跳，高风险（`sim.js:_checkSkim`）。
- 三场景包：晨曦云海 / 落樱湖面 / 夜空星河（色板/构图/装饰互异，`render/index.js:SCENE_PALETTES`）。
- 12 关推进 + 特性轮换：珍珠关/窄门/移动门/侧风/双门/巨浪/鳞光冲刺（`config/levels.js`）。
- 三星结算：通关 + 珍珠 + 水花跳（`sim.js:_win`）。
- 程序化 WebAudio BGM（D-A-C-G 五声）+ 13 个 SFX（`src/core/audio.js`）。

**全原创/程序化**：角色（锦鲤）、场景、鸟居、珍珠、粒子、音频全部 Canvas/WebAudio 程序化，无外部素材、无水印、无 oasis 字样。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 30 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 串行通关 L1→L3（首胜 8.95s、levels=3、deaths=0）；random deaths=1；noinput deaths=1 |
| `fun-report.mjs` | PASS（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | PASS 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | pass=true，60fps（avgFrameMs 16.67），0 console error，0 失败请求 |
| `i18n-check.mjs` | OK（en/zh 各 33 key，0 missing / 0 empty） |
| `tutorial-check.mjs` | PASS（visible/active/steps=3/skip/persist/replay 全过） |
| `sdk-check.mjs` | pass=true（10 项全 ✓，含降级） |
| `audio-check.mjs` | PASS（BGM 无缝循环 34.3s + 13 SFX 全过 + 负例静音） |
| `vision-review.mjs` | PASS（readable 8.0 / silhouette 8.2 / style 9.2） |

## 4) 物料路径

- `poster.jpg`（1280×720 标题屏 + 贴纸字）
- `poster-1920.jpg`（1920×1080）
- `game.gif`（480×270，4s，约 1.1MB，前 3 秒可见锦鲤扑过鸟居门）
- `icon.png`（256×256）、`favicon.png`（64×64）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION 中英双份）

## 5) 未做项与已知问题

- 未做：未接真实广告账号（`config/sdk.config.js` `ads.enabled=false`），广告 UI 不出现；无第三方统计。
- 未做：无每日挑战/排行榜等 meta 成长（重玩钩子用 rating/nearMiss/unlock/growth 覆盖）。
- 已知：vision-review 依赖视觉模型，同一组截图不同次可能 PASS/WARN 波动，但均 ≥WARN；建议用 `--shots` 指定 6 张验收图跑最稳定。
- 已知：侧风实现为「上下阵风」而非字面横向推力（单键垂直玩法下横向位移无意义，已按升力湍流落地）。

## 6) 最不满意的一处

门缝「目标可见性」的视觉表达。功能上穿门判定很清晰，但要让鸟居门缝一眼读成「从这里穿」比预想难——多次迭代才用「白亮门环 + 中央菱形」让视觉模型稳定识别为目标。若重做，会在美术阶段就把「门缝 = 发光传送门」作为第一原则，而不是后期补丁式高亮。
