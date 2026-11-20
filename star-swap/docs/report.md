# STAR SWAP · 交付报告

> slug `star-swap` · title `STAR SWAP` · appId `pipy-star-swap` · 改造自 `creator星星消消乐`
> 结论：**全套门禁全绿**（10/10 PASS）。

## 1) 文件清单

```
games/star-swap/
├─ index.html  styles.css  package.json  .gitignore  README.md  SEO.txt
├─ poster.jpg（1280×720）  game.gif（480×270 / 4.5s / 1.53MB）
├─ config/
│   game.config.js  gameplay.js  levels.js  locales.js  design.json  sdk.config.js
├─ src/
│   core/  i18n.js  save.js  sdk.js  audio.js（WebAudio 程序化 BGM+19 SFX）
│   game/  board.js（纯三消引擎）  sim.js（run 生命周期）  rng.js
│   render/ theme.js（三场景包）  index.js（Canvas 渲染+粒子+白闪）
│   ui/    index.js  screens.js  hud.js  tutorial.js（3 步首次引导）
│   vendor/pipysdk.js（runtimeConfigUrl/appConfigUrl 已清空）
│   main.js（装配 + window.__ll 契约 + boot 守卫）
├─ tests/  board.test.mjs(18)  sim.test.mjs(7)  final/（8 张验收截图 + 门禁报告）
├─ tools/  selfplay.mjs  verify.plan.json  audio-check.mjs  capture.mjs  poster.mjs  record-gif.mjs
└─ docs/   analysis.md  report.md  short.txt  long.md
```

## 2) 门禁输出摘要（全部 PASS）

| # | 门禁 | 结果 |
| --- | --- | --- |
| 1 | `node --test` | **25/25 pass**（board 18 + sim 7） |
| 2 | `node tools/selfplay.mjs` | 3 策略：`greedy(lvl=12,dead=1,dur=2.8s,actions=168)` `random(lvl=8,dead=1,dur=28.6s)` `noinput(lvl=1,dead=0,dur=300s)` |
| 3 | `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail；首输入 0s、空转 0%、事件 17 种、推进率 100%、死亡存在 67%） |
| 4 | `fun-audit.mjs` | **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| 5 | `verify-game.mjs` | **PASS**（17 步全过，fps 60，0 console/page error，0 失败请求，0 外部请求） |
| 6 | `i18n-check.mjs` | **OK**（en 46 / zh 46，0 missing，0 空文案） |
| 7 | `tutorial-check.mjs` | **PASS**（visible/active/steps=3/skip/persisted/replayEntry/replayable 全 true） |
| 8 | `sdk-check.mjs` | **PASS**（SDK 对象/API/降级/埋点/存档/分享/断网全过） |
| 9 | `tools/audio-check.mjs` | **20/20 pass**（19 SFX + 1 BGM loop，rms>0 & peak<0.95 & nan=0） |
| 10 | `vision-review.mjs` | **PASS**（readable 8.8 / silhouette 7.8 / style 9.6；goal_visible 全 Y、无 HUD 遮挡、无文字裁切、移动安全全 Y） |

关键遥测（`tools/fun/autoplay.json`）：greedy 推进到第 12 关并在末关死（`levelsReached=12`、`deaths=1`），满足「greedy 到第 3 关以上」与「至少一条 run 死过」。

## 3) 截图路径（tests/final/）

| 文件 | 内容 |
| --- | --- |
| `01-play.png` | 第 1 关玩法（河内·紫蓝，含目标/步数 HUD） |
| `02-play-zh.png` | 第 1 关中文 UI |
| `03-orion.png` | 第 5 关（猎户·青白，初始特殊星） |
| `04-south.png` | 第 9 关（南门·金橙） |
| `05-dark.png` | 第 3 关（暗物质格） |
| `06-special.png` | 特殊星（行/列爆箭头） |
| `07-mobile.png` | 844×390 移动端玩法 |
| `08-nova.png` | 超新星全屏白闪 |

另有 `tests/artifacts/`：verify-game 过程图（v01–v07）与 tutorial-check 三图（不进入 vision-review 前 8 张）。

## 4) 未做项

- 未跑 `new-game.mjs` 骨架脚本，改为手建目录结构：本机 `node` 是坏掉的 nvm-lazy 别名（`_nvm_lazy` 不存在），而 `new-game.mjs` 内部用 `execFileSync('node', …)` 起测试，会直接崩；且其默认骨架带 ja/ko/ar/ru 半成品语言，会挂 i18n-check。手建结果与骨架等价（目录齐、`package.json` type:module、全部文件已落）。
- 未接真实广告账号（`sdk.config.js` 的 `ads.enabled=false`，未接账号时按规范保持关闭）。
- 未做 ja/ko/ar/ru 多语言（按规范只暴露 en/zh，整块不暴露半成品）。
- 未做真人在线数据（`fun-report --human`，非门禁）。
- 未提交 git、未起常驻服务器、未改其他游戏目录。

## 5) 最不满意的一处

**连击（combo）没有真正参与玩法，只是 HUD 显示 + 音效**。当前 `src/game/sim.js` 的 combo 只在连续消除时 +1、6 秒无消除归零，但**没有像 spec 的「chain」动词那样影响计分或产出**（例如连锁越深额外加分 / 触发特殊星）。设计上 `config/gameplay.js` 里有 `CASCADE_BONUS`（连锁层数乘数），但那是对同一次交换内的连锁，不是跨交换的玩家连击。若时间允许，下一步会把「跨交换连击」接入计分与超新星充能，让「节奏」真正成为可玩的东西——这正对应设计源里 `charge` 动词的「蓄特殊星」代价。

---

### 附：一次典型门禁命令（仓库根）

```bash
cd /Users/admin/git/webgames/games/star-swap
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```
