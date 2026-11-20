# SNAKE ARENA · 交付报告

> slug `snake-arena` · title `SNAKE ARENA` · appId `pipy-snake-arena` · 改造自《贪吃蛇大作战》（slither.io 玩法）
> 原则：玩法规则 1:1 还原（摇杆转向 / 吃食变长 / 加速掉长度 / 撞他蛇身体判死 / 尸体化食物 / AI 蛇群 / 比分=长度 / 限时名次赛），角色/场景/音乐全原创（霓虹数据流蛇 + 超频光屑 + 电磁脉冲 + 三场景包）。

## 1) 文件清单

```
index.html  styles.css  package.json  .gitignore
config/   game.config.js · gameplay.js · rounds.js · locales.js · design.json · sdk.config.js
src/      main.js
  core/   sdk.js · i18n.js · save.js · audio.js
  game/   sim.js · rng.js
  render/ index.js · theme.js · particles.js
  ui/     index.js · screens.js · hud.js · tutorial.js
  vendor/ pipysdk.js（站点 SDK vendored，appId=pipy-snake-arena）
tests/    sim.test.mjs（20 条纯逻辑测试）
  final/  01-title / 02-title-zh / 03-tutorial / 04-play / 05-paused / 06-dead / 07-restart / 08-mobile-play
          + verify-report.json · sdk-report.json · tutorial-report.json · vision-review.{json,md}
tools/    selfplay.mjs · verify.plan.json · audio-check.mjs · record-gif.mjs · make-poster.mjs
docs/     analysis.md（源码分析） · report.md（本文件） · short.md · long.md（SEO）
game.gif（480×270 · 658KB · 真实玩法循环）  poster.jpg（1280×720 · 117KB）
```

## 2) 全套门禁输出摘要（全部自己跑过）

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 20 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(round=3,len=16,dead=1,191.9s,gap=1.87s) · random(round=1,dead=1) · noinput(round=1,dead=1) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首输入 0s · 延迟 90ms · 空转 9% · 最大间隔 2s · 事件 15 种 · 推进到第 3 场 100% · 死亡存在 100%） |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass；3 动词带代价、8 个前 3 分钟决定、12 场各一新元素、9 升级规则型 67%、4 重玩钩子） |
| `verify-game.mjs` | ✅ PASS | 全断言通过 · 0 console/page error · 0 失败请求 · 帧率 60fps（avgFrameMs 16.67） |
| `i18n-check.mjs` | ✅ PASS | en/zh 各 83 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 首次引导可见/可跳过/可重看/刷新不重复（3 步：steer→eat→boost） |
| `sdk-check.mjs` | ✅ PASS | SDK 对象/快捷 API 齐全 · showRewarded 安全 · 断网降级可开 · 0 error |
| `audio-check.mjs` | ✅ PASS | 22/22（19 SFX + 3 BGM 循环，RMS>0 / peak<0.95 / 无缝） |
| `vision-review.mjs` | ✅ PASS | 8 张均分 readable 8.4 / silhouette 7.3 / style 8.8，0 critical |

## 3) 截图路径（tests/final/）

- 标题（英文）：`tests/final/01-title.png`
- 标题（中文）：`tests/final/02-title-zh.png`
- 首次引导：`tests/final/03-tutorial.png`
- 玩法：`tests/final/04-play.png`
- 暂停：`tests/final/05-paused.png`
- 结算：`tests/final/06-dead.png`
- 重开：`tests/final/07-restart.png`
- 移动端玩法（844×390）：`tests/final/08-mobile-play.png`

## 4) 未做项

- **未接线上广告账号**：`ads.enabled=false`，广告 UI 不出现、`showRewarded` 安全返回 false（上传前由 Lead 按后台状态开启）。
- **未上线**：`game.gif` / `poster.jpg` / SEO 已就位，上传由 Lead 走 `skills/upload_games`。
- **深网场次「大蛇 AI 更长」只做了行为近似**：深网场（9–12）靠更高攻击性 + 更密食物体现压力，AI 出生长度未按场次加长（见 §5）。
- **反范围项**（规格声明不做）：真人对战 / 皮肤商店 / 每日任务 / 剧情对话 / 竖屏专属模式。
- **未做讲解视频**（G6.5，非本执行单范围）。

## 5) 最不满意的一处

深网场次的「更长更致命的大蛇 AI」目前只还原了「更致命」（`aggression` 0.58→0.80、食物更密），**没有真正让 AI 出生更长或出现预判/围堵行为**——所以 12 场的后半段推进感主要靠数值换挡而非规则换挡。若再做一轮，我会给深网场 AI 加「出生长度随场次递增」和「两两包夹玩家头部」的规则型行为，让「换章」名副其实。

### 本次返工记录（供复盘）

1. **boot 竞态 + 加载层拦截点击**：`#loading` 全屏覆盖层最初缺 `pointer-events:none`，boot 期点 Start 被吃掉导致 tutorial-check 假失败（neo-tetra 实坑），已修 `styles.css`。
2. **超频解锁场次与首次引导冲突**：引导第 3 步要「按住超频」，但超频原本第 2 场才解锁 → 第 1 场引导卡死。把 `BOOST.UNLOCK_ROUND` 提到 1（超频本就是 P0 核心动词），并同步改 `design.json` 第 1/2 场新元素与 locale。
3. **vision-review 的「目标可见/HUD 遮挡」波动**：通过加大数据点半径 + 脉冲外环、给玩家加 `YOU` 标签（带深色描边）、顶部预留 `WORLD.HUD_TOP=72` 的 HUD 带、HUD 改单行不透明条、触屏按钮改不透明，把均分从 readable ~7 提到 ~8.4 并稳定 PASS。
