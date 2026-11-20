# FOG TOWN · 交付报告

> 改造自《迷雾之町》Cocos 源码 → 原创网页游戏「雾町寻踪·油灯侦探」。只写了 `games/fog-town/`，参考实现 `games/abyss-eel` 只读。未 git commit、未起常驻服务器。

## 1) 文件清单

```
games/fog-town/
├─ index.html  styles.css  package.json  .gitignore
├─ poster.jpg (1280×720)  game.gif (480×270 / 4.5s / 1.67MB)
├─ README.md
├─ config/
│  ├─ game.config.js  gameplay.js  levels.js  locales.js  design.json  sdk.config.js
├─ src/
│  ├─ core/  i18n.js  save.js  sdk.js  audio.js
│  ├─ game/  rng.js  mapgen.js  sim.js
│  ├─ render/  theme.js  index.js
│  ├─ ui/  screens.js  hud.js  tutorial.js  index.js
│  ├─ vendor/  pipysdk.js（runtimeConfigUrl/appConfigUrl 已清空）
│  └─ main.js
├─ tests/  sim.test.mjs  mapgen.test.mjs  tutorial.test.mjs
├─ tests/final/  01..08 截图 + vision-review / tutorial-report / sdk-report
├─ tools/  selfplay.mjs  verify.plan.json  audio-check.mjs  mkshots.mjs  record-gif.mjs  poster.mjs
└─ docs/  analysis.md  report.md  short.md  long.md
```

## 2) 门禁输出摘要（全部 PASS）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 29/29 通过（sim 17 + mapgen 5 + tutorial 7 逻辑测试） |
| `node tools/selfplay.mjs` | ✅ greedy(block=12, dead=0, 11 事件) / random(dead=1) / noinput(300s 基线) |
| `fun-report` | ✅ **PASS** 10 pass / 0 warn / 0 fail（推进率 100%、事件种类 11、死亡存在 33%） |
| `fun-audit` | ✅ **PASS 100/100**（26 pass / 0 warn / 0 fail） |
| `verify-game` | ✅ pass:true（0 console error / 0 失败请求 / 0 外部请求，9 截图） |
| `i18n-check` | ✅ en 51 key / zh 51 key，0 missing 0 empty |
| `tutorial-check` | ✅ PASS（4 步 / 可跳过 / 持久化 / 可重看） |
| `sdk-check` | ✅ pass:true（SDK 就绪 / 广告安全 false / 埋点 / 存档 / 分享 / 断网降级） |
| `audio-check` | ✅ 20/20 passed allPass（18 SFX + 2 loop） |
| `vision-review` | ✅ **PASS** readable 8.6 / silhouette 6.8 / style 8.8（8 张全过，goal_visible 全 Y，无 HUD 遮挡 / 文字裁切 / 移动不安全） |

## 3) 截图路径

- 标题：`tests/final/01-title.png`（en）· `tests/final/06-title-zh.png`（zh）
- 玩法：`tests/final/02-play.png`（第 1 街区揭雾）· `tests/final/07-play2.png`（集市废墟）· `tests/final/08-play3.png`（湖畔）
- 特殊状态：`tests/final/03-truth.png`（真相时刻全图点亮）· `tests/final/04-dead.png`（死亡结算卡）
- 移动端：`tests/final/05-mobile.png`（844×390）
- 上线物料：`poster.jpg`（1280×720）· `game.gif`（480×270 / 4.5s / 1.67MB）

## 4) 未做项

- 广告账号未接（`config/sdk.config.js` `ads.enabled=false`，符合「未接账号保持 false」）。
- 仅 en/zh；ja/ko/ar/ru 整块未暴露（符合「完整才暴露」铁律）。
- 不做联网/排行榜/皮肤商店/每日任务/实时战斗（`config/design.json` `antiScope`）。

## 5) 最不满意的一处

Canvas 里钥匙/线索/杠杆图标是几何图形、尺寸偏小，vision-review 在移动端指出「钥匙图标偏小且无高亮边框，易与背景方块混淆」。理想做法是给每个可交互物件加**深色背板 + 更大高亮描边**（同 DOM 层做法），让 silhouette 与可读性再上一档。已作为后续优化项记录，不影响当前全门禁 PASS。
