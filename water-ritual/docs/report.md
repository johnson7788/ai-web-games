# WATER RITUAL · 交付报告

> 改造自《多喝烫水》→ 茶馆经营 + 倒水时机。玩法规则 1:1 还原 P0 六件事，角色/场景/音乐全原创。
> 源码分析见 `docs/analysis.md`；上线物料 `game.gif` / `poster.jpg` / `docs/short.md` / `docs/long.md`。

## 1) 文件清单

```
index.html                入口（1280×720 letterbox + #rotate + #loading 不拦截点击）
styles.css                茶馆水彩 UI（三套场景色板、移动端 844×390 紧凑化）
package.json              {"type":"module"}
game.gif                  480×270 · 4.5s · 378KB（真实玩法录制）
poster.jpg                1280×720（玩法 + 发光大标题）
config/
  design.json             机器可读设计源（fun-audit 100 分）
  tea.js                  玩法数值（倒水物理/客型/天数/高峰/升级）
  game.config.js          世界尺寸/步长/语言/存档键
  locales.js              en/zh 各 86 key（完整）
  sdk.config.js           appId pipy-water-ritual
src/
  core/i18n.js save.js sdk.js audio.js    i18n / 存档 / SDK 出口 / 程序化 WebAudio
  game/sim.js rng.js      纯逻辑（倒水/订单/天/高峰/升级/事件）
  render/index.js         程序化 Canvas（三场景包 + 水位 + 温度计 + 金圈涟漪）
  ui/index.js screens.js hud.js tutorial.js
  vendor/pipysdk.js       站点 SDK（本地 vendored，断网降级）
  main.js                 装配 + 固定步长 + window.__ll 契约 + boot 守卫
tests/sim.test.mjs        20 条纯逻辑测试
tests/final/              7 张精选截图 + vision-review.json + sdk-report.json
tools/
  selfplay.mjs            3 策略遥测 → tools/fun/autoplay.json
  verify.plan.json        浏览器验收计划
  audio-check.mjs         RMS/峰值/NaN 离线校验
  finalshots.mjs          精选截图生成
  record-gif.mjs          playwright 录屏 → ffmpeg game.gif
  make-poster.mjs         玩法图 + 叠字 → poster.jpg
docs/analysis.md short.md long.md report.md
```

## 2) 全套门禁输出摘要（全部自跑）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ | `tests 20 / pass 20 / fail 0` |
| `tools/selfplay.mjs` | ✅ | greedy day=12 dead=0；random day=12；noinput dead=1 |
| `fun-report.mjs` | ✅ PASS | `10 pass / 0 warn / 0 fail`（首输入 0s、延迟 90ms、首胜 1s、操作 136/min、空转 13%、间隔 0.6s、事件 15 种、推进 100%） |
| `fun-audit.mjs` | ✅ PASS | `100/100 · 26 pass`（3 动词带代价、8 决定、4 幕、10 升级 80% 规则型） |
| `verify-game.mjs` | ✅ | `"pass": true`（0 console error / 0 失败请求，桌面 + 移动端） |
| `i18n-check.mjs` | ✅ | `en/zh 各 86 key · missing 0 · empty 0` |
| `tutorial-check.mjs` | ✅ PASS | 3 步（pour/score/perfect）· 可见/可跳过/持久化/可重看全 true |
| `sdk-check.mjs` | ✅ | `"pass": true`（SDK 就绪/降级/广告/埋点/存档/分享） |
| `tools/audio-check.mjs` | ✅ | `22/22 passed · allPass=true` |
| `vision-review.mjs` | ✅ PASS | `readable 8.3 / silhouette 7.0 / style 8.9`（7 张，goal_visible 全 Y，无 HUD 遮挡/文字裁切/移动不安全） |

## 3) 截图路径

- 标题：`tests/final/01-title.png` · 中文标题 `tests/final/07-title-zh.png`
- 玩法（按住倒水中）：`tests/final/02-play.png`
- 一口回甘金圈涟漪：`tests/final/03-perfect.png`
- 升级商店：`tests/final/04-shop.png` · 结算卡 `tests/final/05-result.png`
- 移动端（844×390）：`tests/final/06-mobile.png`
- 验收过程图（verify-game / tutorial-check）：`tests/artifacts/v01..v08-*.png`、`tests/artifacts/tutorial-*.png`

## 4) 未做项

- 未接线上广告账号（`sdk.config.js` 的 `ads.enabled:false`，全广告 UI 不出现；`source:'local'`）。
- 未打包任何音频文件：BGM/SFX 全程序化 WebAudio（符合「zip ≤3MB、不打包音频」）。
- 未做 ja/ko/ar/ru 多语言（只暴露 en/zh，整块未暴露，避免半成品）。
- 未做联网排行榜 / 皮肤商店 / 每日任务（见 design.json `antiScope`）。

## 5) 最不满意的一处

标题屏的「产品静物」是后补的：`render.draw(null)` 最初只画场景背景，vision-review 第一次把标题截图 silhouette 打到 3/5、把均值拉到 5.9 FAIL。修法是让标题屏也画茶壶+空杯+满温度计静物、并把 `#screen-title` 玻璃压到 0.5 透明度，silhouette 才稳到 7.0。这说明「标题屏也要有可眯眼识别的主体剪影」应该写进渲染 agent 的验收标准，而不是等 vision-review 挂掉再补。
