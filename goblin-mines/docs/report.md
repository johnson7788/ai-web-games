# GOBLIN MINES · 交付报告

> 改造自「地精旷工」（Cocos Creator 三消挖矿）。玩法规则 1:1 还原，主题/美术/音乐全原创。
> 全部门禁 PASS（含 fun-audit / fun-report / vision-review）。未 git commit、未起常驻服务器、未碰其他游戏目录。

## 1. 文件清单

```
games/goblin-mines/
├─ index.html / styles.css / package.json
├─ config/
│  ├─ game.config.js     世界尺寸/步长/语言/存档键
│  ├─ sdk.config.js      appId=pipy-goblin-mines，SDK 唯一配置源
│  ├─ locales.js         en 默认 + zh 完整（各 63 key）
│  ├─ design.json        趣味设计审计源（fun-audit 100 分）
│  ├─ gameplay.js        全部玩法数值（步数/安全度/矿工/技能/头目）
│  └─ levels.js          12 条矿道里程碑（3 套场景色板分章）
├─ src/
│  ├─ core/              audio.js（WebAudio 程序化 20 SFX + 2 loop）/ i18n.js / save.js / sdk.js
│  ├─ game/              sim.js（纯逻辑三消挖矿）/ rng.js（mulberry32）
│  ├─ render/            index.js + theme.js（Canvas2D 发光渲染 + 三场景色板 + 矿车拖尾）
│  ├─ ui/                index.js + tutorial.js（屏幕/HUD/技能/矿工/塌方预警/3 步引导）
│  ├─ vendor/pipysdk.js  站点 SDK vendored（appId 由 data-app-id 注入，关闭热更新外联）
│  └─ main.js            装配/固定步长/事件分发/状态机/__ll 契约
├─ tests/sim.test.mjs    23 条纯逻辑测试
├─ tools/
│  ├─ selfplay.mjs       3 策略无头自玩 → tools/fun/autoplay.json
│  ├─ audio-check.mjs    音效离线 RMS/峰值/NaN 校验
│  ├─ verify.plan.json   浏览器验收计划（桌面 + 移动 + FPS）
│  ├─ make-shots.mjs     生成 tests/final 8 张验收截图
│  ├─ make-poster.mjs    poster.jpg（玩法截图 + HTML 大标题叠加）
│  └─ record-gif.mjs     Playwright 录 webm → ffmpeg 转 game.gif
├─ game.gif（480×270 · 4.5s · 1.7MB）/ poster.jpg（1280×720）
├─ docs/                 analysis.md（源码分析）/ short.md / long.md / report.md
└─ tests/final/          8 张截图 + vision-review / tutorial / sdk 报告
```

## 2. 门禁输出摘要

| 门禁 | 结果 | 关键证据 |
| --- | --- | --- |
| `node --test` | ✅ 23/23 pass | sim/rng/audio 纯逻辑 |
| `tools/selfplay.mjs` | ✅ 3 策略 | greedy shaft=3 dead=1 · random shaft=3 dead=1 · noinput dead=1 |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass） |
| `verify-game.mjs` | ✅ PASS | 20 断言全过 · fps 60 · 0 error / 0 failed / 0 external |
| `i18n-check.mjs` | ✅ OK | en/zh 各 63 key · 0 missing · 0 empty |
| `tutorial-check.mjs` | ✅ PASS | visible/active/skip/persist/replay 全过 |
| `sdk-check.mjs` | ✅ PASS | SDK 就绪/广告降级/埋点/存档/分享/断网降级 |
| `audio-check.mjs` | ✅ 22/22 | rms>0 · peak<0.95 · nan=0 |
| `vision-review.mjs` | ✅ PASS | readable 8.3 / silhouette 7.0 / style 9.0 · 无 critical |

## 3. 截图路径

- `tests/final/01-title.png` 标题屏
- `tests/final/02-play.png` 核心玩法（交换/消除/收集）
- `tests/final/03-lit.png` 提灯地精照亮列（矿灯配给）
- `tests/final/04-boss.png` 头目矿兽战
- `tests/final/05-collapse.png` 矿难预警 + 加固/赌运气
- `tests/final/06-dead.png` 结算卡
- `tests/final/07-zh-play.png` 中文玩法
- `tests/final/08-mobile.png` 移动端 844×390
- `tests/artifacts/v01..v08` verify-game 过程截图（标题/中文/引导/玩法/暂停/结算/重开/移动）

## 4. 未做项

- 未做 6 语言（ja/ko/ar/ru 按铁律整块不暴露，只做 en + zh）。
- 未接广告账号（`ads.enabled: false`，`showRewarded` 安全返回 false）。
- 未做地精「移动列」的专用 UI 入口（goblin 移动通过 `run.step({move})` 契约存在，UI 用「雇佣→点列」简化；升级为点击地精行）。
- 未做排行榜/每日任务/皮肤商店（见 design.json antiScope）。

## 5. 最不满意的一处

**greedy 遥测时长只有 0.6s**（`tools/fun/autoplay.json`）。机器人每 tick 就做一次交换，几秒内挖穿两条矿道并耗尽步数死亡——fun-report 全 PASS，但这组遥测更接近「压力测试」而非「一局正常手感」，不足以佐证真实玩家的节奏。若继续打磨，应给 greedy 加真实的「思考间隔 + 生理震颤」动作模型，让 `durationSec` 落在 60–120s 的拟真区间，遥测才更有说服力。
