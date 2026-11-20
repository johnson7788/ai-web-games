# ABC POP · 交付报告

> slug `abc-pop` · title `ABC POP` · appId `pipy-abc-pop`
> 参考：`docs/analysis.md`（源码分析）、`config/design.json`（设计源）

## 1) 文件清单

```
index.html / styles.css          入口与糖果天空 UI
config/
  game.config.js                 世界尺寸 / 步长 / 语言
  gameplay.js                    玩法数值（泡泡/难度/计分/连击/心跳）
  levels.js                      26 字母 × 3 轮数据 + 3 场景包 + 单词表
  locales.js                     en/zh 全平铺 46 键
  sdk.config.js                  appId pipy-abc-pop / 广告关闭 / 埋点 / 存档
  design.json                    机器可读设计源（fun-audit PASS）
src/
  core/i18n.js  sdk.js  audio.js
  game/sim.js  rng.js
  render/index.js
  ui/index.js  screens.js  hud.js  tutorial.js
  vendor/pipysdk.js             vendored SDK（已清空 runtimeConfigUrl/appConfigUrl）
  main.js                       装配 / 固定步长 / 状态机 / __ll 契约
tests/
  sim.test.mjs  tutorial.test.mjs   26 条纯逻辑测试
  final/                         5 张验收截图 + vision-review.{json,md}
tools/
  selfplay.mjs  audio-check.mjs  verify.plan.json
  record-gif.mjs  make-poster.mjs
  fun/                           autoplay.json / design-audit / report / fun-report
docs/
  analysis.md  short.txt  long.md  report.md
game.gif                        480×270 · 834KB · 真实玩法录制
poster.jpg                      1280×720 · 玩法图 + 大标题叠字
```

## 2) 门禁输出摘要（全绿）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **26 pass / 0 fail** |
| `node tools/selfplay.mjs` | greedy level=78(全通关) / random level=2 / noinput level=1 |
| `fun-report.mjs --root .` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs --root .` | **PASS** · 100/100（26 pass） |
| `verify-game.mjs --plan tools/verify.plan.json` | **pass=true** · 0 console/page error · 0 失败请求 · fps 60 |
| `i18n-check.mjs --root .` | **OK** · en/zh 各 46 键，0 missing / 0 empty |
| `tutorial-check.mjs --root .` | **PASS** · 3 步 / 可跳过 / 可重看 / 持久化 |
| `sdk-check.mjs --root .` | **pass=true** · SDK 就绪 / 降级 / 广告安全 / 埋点 / 存档 / 分享 |
| `tools/audio-check.mjs` | **14/14 passed** · allPass=true |
| `vision-review.mjs --root .` | **PASS** · readable 9.0 / silhouette 7.6 / style 9.4 |

> 说明：tutorial-check / sdk-check 以 `--out tests/artifacts` 运行，截图不落 `tests/final/`，避免污染 vision-review 的前 8 张扫描。

## 3) 截图路径

- 标题：`tests/final/01-title.png`（+ `tests/artifacts/v01-title.png`）
- 玩法（晨云）：`tests/final/02-play.png`（`tests/artifacts/v04-play.png`）
- 场景包（雨后）：`tests/final/03-rain.png`
- 场景包（夜空）：`tests/final/04-night.png`
- 移动端：`tests/final/05-mobile.png`（`tests/artifacts/v08-mobile-play.png`）
- 中文标题 / 引导 / 暂停：`tests/artifacts/v02-title-zh.png`、`v03-tutorial.png`、`v07-paused.png`

## 4) 未做项

- **未接广告账号**：`sdk.config.js` 中 `ads.enabled=false`（儿童认知游戏，按 spec 无广告），`showRewarded/showInterstitial` 均安全返回 false。
- **不做 TTS 语音**：按 spec 用 WebAudio 程序化合成（字母名音高区分 + 鼓励音），无真人配音。
- **无失败/扣分**：按 spec「点错只抖动不扣分」，故 `deaths=0`，fun-report 以 `sim` 品类门槛（deathPresence=0）判定。
- **未做排行榜 / 皮肤 / 每日任务 / 剧情**：见 `design.json` 的 antiScope。
- 上线发布（upload / SEO.txt 上传）由 Lead 负责，本报告未含线上验证。

## 5) 最不满意的一处

**泡泡非重叠生成用的是「拒绝采样 + 40 次兜底」**：在泡泡密集时（7 个、摆动幅度大）兜底分支可能仍产生轻微靠近的泡泡，极端情况下点击判定会命中「视觉上更靠上」的那一个，对低龄玩家造成轻微困惑。当前通过 1.1× 半径间隙 + 40 次采样把概率压得很低（验收截图与 selfplay 均未见误点），但更稳妥的做法是把泡泡按网格分桶 + 再重排，把非重叠变成**确定性保证**而非概率保证——这是本轮为赶进度留下的一个技术债。
