# KILN 2048 · 交付说明

> slug `kiln-2048` · title `KILN 2048` · appId `pipy-kiln-2048`
> 改造自 `local/src1/2048消除cocos/2048/`（Cocos Creator 2.x 的「掉落合球」类，非滑动 2048）

## 1) 源码分析摘要（原作玩法事实）

原作只有 4 个脚本、1 个场景，核心是「顶部投放数字球 → 重力下落 → 同值接触合并翻倍 → 达 2048 消除」：

- `assets/Script/DefaultBall.ts`
  - `:44-73` `onBeginContact`：两球碰撞接触时判同值；`otherIndex > selfIndex` 直接 return（`index` 更大的新球让位，`index` 更小的旧球存活并翻倍）。
  - `:58` `if (selfValue === otherValue)` —— 同值才合并。
  - `:60` `otherCollider.node.removeFromParent()` —— 移除被合并的新球。
  - `:65-66` `nextValue = +selfValue * 2` → `setBallValue(nextValue)` —— 旧球翻倍。
  - `:67-72` `if (nextValue >= 2048) selfCollider.node.removeFromParent()` —— 达 2048 自动消除，并 `wx.vibrateShort()` 震感。
- `assets/Script/Helloworld.ts`
  - `:5` `level = [2,4,8,16,32,64,128,256,512,1024]` —— 投放值集合（最高直接投 1024，2048 只能靠合并）。
  - `:45` `gravity = cc.v2(0, -640)` —— 竖直重力。
  - `:50` `_gameBoxLife_Y = 盒子高度 * 4/5` —— 顶部投放线。
  - `:80-103` `makeDefaultBall()`：按 `level` 随机取值 → 球 `opacity=0/scale=0.5` 渐入 → 初始 `RigidBodyType.Static`（持球悬停可瞄准）。
  - `:99` `scale = 1 + log(num)/log(2)/10` —— 半径随数值（对数）变大。
  - `:105-122` `onClick`：点击/抬起 → 持球置 `Dynamic` 落下 → 置空 → `setTimeout(..., 500)` 500ms 后生成下一球。
  - `:124-137` `onMoveBall`：拖拽移动持球 x，并做左右边界 clamp。
  - `:74-146` `generateFishes()`：场景里游动的鱼（纯装饰，非玩法）。

结论：原作是「物理掉落 + 接触合并」的合成大西瓜式玩法，无关卡、无目标、无失败线（只有无限刷分），`2048` 是唯一的高光消除点。

## 2) 改造点清单

**保留（1:1 玩法规则）**
- 顶部投放数字球、重力下落堆叠、同值接触合并翻倍、达 2048 自动消除加分。
- 半径随 `log2(value)` 增长（`config/game.config.js` `R_BASE`）。
- 持球悬停瞄准 → 释放下落 → 延迟生成下一球（`SPAWN_DELAY`）。
- 同值合并时「旧球存活翻倍、新球移除」的判定方向。

**原创改造（陶窑主题）**
- 数字球 → 釉色档位：`2=素坯 → 4=青釉 → 8=钧红 → 16=釉里红 → 32=青花 → 64=窑变 → 128=豇豆红 → 256=郎窑红 → 512=钧紫 → 1024=宝石蓝 → 2048=天青`（`config/glaze.js`）。
- 合并 = 进窑复烧；2048 = 「天青出窑」整屏暖光脉冲 + 闪光消除（signature，`render/index.js` 的 `firePulse`）。
- 三场景包：`morning-workshop` 晨光陶坊 / `dusk-kiln` 暮色窑口 / `night-fire` 夜焰窑炉，背景火光随场上最大数值升温变亮（`drawFireGlow`）。
- **12 关推进结构**（`config/levels.js`）：三种目标（合成到 X / 出窑 N 个 ≥X / 限投数达标分数）+ 逐关新机制：大值干扰球 → 冰冻球（两次复烧解冻）→ 双色釉（异色才能合，合并后翻色）→ 重锤（砸碎任意球）→ 窄窑腔 → 夜焰三轴叠加。
- 顶部失败线判负（原版没有）：任一球心越过失败线并停留 0.6s 即 `overflow`。
- 纯逻辑自研物理（不引 Matter.js）：圆-圆碰撞 + 位置修正 + 单次速度求解 + 位移睡眠，seeded 随机（`src/game/sim.js`）。

**架构（照抄 oasis-pipeworks 黄金参考的分层）**
- `src/game/sim.js`（纯逻辑，零 DOM）+ `src/game/ai.js`（贪心 AI，Node/浏览器共用）+ `src/render/index.js` + `src/ui/ui.js` + `src/main.js`（装配 + `window.__ll` 调试契约）+ `src/core/{i18n,save,sdk,audio}.js` + `config/*`。
- SDK 三件套（`src/vendor/pipysdk.js` / `src/core/sdk.js` / `config/sdk.config.js`）appId 改为 `pipy-kiln-2048`。
- 英文默认 + 中文必做，仅暴露 en/zh；首次进入 3 步交互引导（可跳过/可重看/持久化不再自动弹）。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **PASS** — 29 pass / 0 fail（合并/消除/冰冻/双色/重锤/失败线/三种目标/种子确定性等） |
| `node tools/selfplay.mjs` | greedy 串行通关 L1→L2→L3：`firstInput 0.02s / firstSuccess 29.75s / actions 150 / lv 3 / events 8 / completed true`；random 中心乱倒 `deaths 1` |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail）：首胜 30s、操作 126/min、空转 0%、最大间隔 1.4s、事件 8 种、推进率 100%、死亡存在 33% |
| `fun-audit.mjs` | **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | **pass**：标题/中英切/12 关卡格/进关/投放/结算/冰冻/夜焰/暂停恢复重开全过；`0 console/page error`、`0 失败请求`、**60fps** |
| `i18n-check.mjs` | **OK**（en/zh 各 42 key，missing 0 / empty 0） |
| `tutorial-check.mjs` | **PASS**（visible/active/steps=3/skip/persist/replay 全 true） |
| `sdk-check.mjs` | **pass**（SDK 就绪/API 齐全/showRewarded 安全/track/断网降级/0 error/0 失败请求） |
| `tools/audio-check.mjs` | **PASS**（BGM 38.4s 无缝循环 + 9 个 SFX RMS/时长/峰值全过 + 未映射事件静音） |
| `vision-review.mjs` | **PASS**（均分 readable 8.0 / silhouette 6.9 / style 8.5，无 critical / 无低分项） |

## 4) 物料路径

- `poster.jpg`（1280×720，标题屏 + 贴纸字，JPEG）
- `poster-1920.jpg`（1920×1080，同上放大）
- `game.gif`（480×270 · 4.8s 循环 · 129KB，前 3 秒可见投放下落 + 同值合并）
- `icon.png`（256×256，天青 2048 球）
- `favicon.png`（同 icon）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）

## 5) 未做项与已知问题

- 未接广告账号：`config/sdk.config.js` `ads.enabled=false`（与 oasis 同款，未接账号不暴露广告 UI）。
- 未做跨语言 ja/ko/ar/ru（按铁律只暴露完整语言，en/zh 已完整）。
- 物理为「位移睡眠 + 位置修正」的简化求解器，极端堆叠（如单一中心塔）偶发短暂抖动，靠 0.6s 失败线宽限兜底判负，不影响可玩与门禁。
- 营销物料（gif）里 `dropNext` 依赖板面落定，节奏略慢于真人连点。

## 6) 最不满意的一处

物理求解器是我从零手写的，为了让「贪心 bot 稳定串行通关」来回调了睡眠判定（速度 → 位移）、位置修正的 slop、速度求解的单次化，折腾很久才稳定。它现在能过全部门禁、可玩，但叠塔极端情况仍偶发微抖，且「堆叠稳定性」的余量不足——如果再迭代，我会换用更成熟的约束求解（分块脉冲 / PBD）或直接接一个轻量物理库，把省下的时间花在关卡手感打磨上。
