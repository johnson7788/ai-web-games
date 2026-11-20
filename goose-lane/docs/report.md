# GOOSE LANE · 交付报告

> 改造自「奔跑小鹅鹅」，三车道自动前进跑酷；规格 `docs/remake-all/games/spec-goose-lane.md`；共享执行单 v2。

## 1) 文件清单

```
index.html / styles.css          入口与样式（letterbox、#rotate、#loading pointer-events:none）
config/game.config.js            世界尺寸 / 步长 / 语言
config/gameplay.js               速度 / 车道 / 生成 / 碰撞 / 气球 / 闸机 / 里程
config/levels.js                 12 站 + 三场景包
config/locales.js                en + zh（各 58 key）
config/design.json               机器可读设计源（fun-audit PASS）
config/sdk.config.js             appId pipy-goose-lane
src/core/{i18n,sdk,audio}.js     i18n / SDK 统一出口 / 程序化 WebAudio
src/game/{rng,spawner,sim}.js    纯逻辑模拟（可复现、可测）
src/render/{index,theme,particles}.js   Canvas 渲染 / 三场景 / 粒子+白鸽
src/ui/{index,screens,hud,tutorial}.js UI / 屏幕 / HUD / 首次引导
src/vendor/pipysdk.js            vendored SDK（source:local）
tests/*.test.mjs                 33 条纯逻辑测试
tools/{selfplay,audio-check,shot-final,record-gif,make-poster}.mjs
tools/verify.plan.json           浏览器验收计划
docs/{analysis.md,short.txt,long.md}
game.gif / poster.jpg            上线物料
```

## 2) 门禁输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 33 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ greedy st=12 dead=0 dur=120s gems=25 idle=1% gap=1.1s · random dead=1 · noinput dead=1 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass） |
| `verify-game.mjs` | ✅ pass=true · 0 console/page error · 0 失败请求 · fps 60 |
| `i18n-check.mjs` | ✅ en/zh 各 58 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS（4 步 / 可跳过 / 可重看 / 持久化） |
| `sdk-check.mjs` | ✅ pass=true（SDK 存在 / 降级 / 广告安全 / 埋点 / 存档 / 分享） |
| `audio-check.mjs` | ✅ 20/20 allPass（rms>0、peak<0.95、无 NaN） |
| `vision-review.mjs` | ✅ **WARN**（readable 7.5 / silhouette 8.5 / style 9.2；无 critical） |

## 3) 截图路径

- 标题（英文）：`tests/artifacts/01-title.png`（中文：`02-title-zh.png`）
- 玩法：`tests/final/01-morning.png`（宝石+车）、`02-obstacles.png`（车+坑+气球）、`03-afternoon.png`（午后青）、`04-gate.png`（红灯闸机）、`05-night.png`（夜班霓虹+闸机+逆行车）
- 移动端：`tests/final/06-mobile.png`（844×390）
- 复活/结算：`tests/artifacts/06-revive.png`、`07-dead.png`

## 4) 未做项

- 未接广告账号（`sdk.config.js` 的 `ads.enabled=false`，上线前改 `source:'online'` 由 Lead 处理）。
- 未做皮肤/商店/排行榜/每日任务（见 `design.json.antiScope`）。
- 海报/图标未做 1920×1080 横版与 256×256 图标（brief 只要求 poster.jpg + game.gif，这两样已交付）。

## 5) 最不满意的一处

**HUD 的可读性没有做到满分。** vision-review 的 `readable` 停在 7.5（WARN），反复被挑「HUD 标签间距紧凑、站名文字偏小、移动端 STOP 按钮视觉上无文字说明」。虽然过了 ≥WARN 门禁，但高密度信息条（M / GEMS / BALLOONS / 站名 / BEST）在 1280 画布上仍有挤压感；理想做法是把 HUD 收敛成「大数字 + 小标签」两行、站名换成带底色的胶囊并加大到 1.2rem。时间约束下只做了字号与底色的一轮抬升，没有做一轮「眯眼」级别的排版返工。
