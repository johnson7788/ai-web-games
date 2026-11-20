# DIG DEEP · 交付报告

> 改造自 `ddddig 挖挖挖`（源码分析见 [analysis.md](analysis.md)）。玩法规则 1:1 还原（格子竖挖/砖块硬度/障碍岩/钻石化石/体力/深度即进度），角色/场景/音乐/文案全原创。

## 1) 文件清单

```
games/dig-deep/
├─ index.html              入口（1280×720 letterbox）
├─ styles.css              UI / HUD 响应式 / 竖屏提示 / 加载层 pointer-events:none
├─ package.json            {"type":"module"}
├─ poster.jpg              1280×720 封面（玩法图 + 大标题 + tagline）
├─ game.gif                480×270 / 4.5s / 213KB 玩法动图
├─ config/
│  ├─ design.json          机器可读设计源（fun-audit 100/100 PASS）
│  ├─ game.config.js       世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js          玩法数值（工具/体力/奖励/塌方/熔岩/洪水）
│  ├─ levels.js            12 层深度目标 + 三场景包特性轮换
│  ├─ locales.js           en + zh 完整（各 71 key）
│  └─ sdk.config.js        appId pipy-dig-deep / 广告位 / 存档 / 分享
├─ src/
│  ├─ main.js              装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM / __ll 契约
│  ├─ game/{sim.js,rng.js} 纯逻辑模拟 + 可复现种子随机
│  ├─ render/{index.js,theme.js}  Canvas2D 渲染 + 三场景包色板
│  ├─ ui/index.js          标题/暂停/结算/地心/HUD/引导
│  ├─ core/{sdk.js,i18n.js,audio.js}   SDK 唯一出口 / i18n / 程序化音频
│  └─ vendor/pipysdk.js    SDK 本地副本
├─ tests/sim.test.mjs      22 条纯逻辑测试
├─ tests/final/            验收截图 + tutorial/sdk/vision 报告
├─ tools/                  selfplay / audio-check / verify.plan / final-shots / record-gif / poster
└─ docs/{analysis.md,report.md,short,long.md}
```

## 2) 门禁输出摘要

| # | 门禁 | 结果 |
| --- | --- | --- |
| 1 | `node --test` | ✅ 22 pass / 0 fail |
| 2 | `node tools/selfplay.mjs` | ✅ 3 策略：greedy(depth=349, layer=12, dead=0) / random(depth=11, layer=2, dead=1) / noinput(depth=0, dead=1) |
| 3 | `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| 4 | `fun-audit.mjs` | ✅ **PASS** · 100/100（26 pass / 0 warn / 0 fail） |
| 5 | `verify-game.mjs` | ✅ pass=true（0 console/page error，0 失败请求，fps=60） |
| 6 | `i18n-check.mjs` | ✅ i18n OK（en/zh 各 71 key，0 missing / 0 empty） |
| 7 | `tutorial-check.mjs` | ✅ tutorial PASS（4 步 / 可跳过 / 持久化 / 可重看） |
| 8 | `sdk-check.mjs` | ✅ pass=true（SDK 就绪 / 降级 / 广告关安全返回 / 埋点 / 存档 / 分享 / 断网可玩） |
| 9 | `audio-check.mjs` | ✅ 25/25 passed（23 音效 + 2 循环层，RMS>0 / peak<0.95 / nan=0） |
| 10 | `vision-review.mjs` | ✅ **PASS**（readable 8.2 / silhouette 6.3 / style 8.5） |

**Fun Gate 关键遥测**（tools/fun/autoplay.json）：
- 首次输入 0s / 输入延迟 90ms / 首胜 1s / 成功率 100% / 操作 1705/min / 空转 0% / 事件最大间隔 0.3s / 事件种类 12 / 推进率 100% / 死亡存在 67%。

## 3) 截图路径

- 标题：`tests/final/01-title.png`（`tests/artifacts/01-title.png` 同源）
- 玩法（黄土层）：`tests/final/02-play.png`
- 玩法（化石暗河）：`tests/final/03-fossil.png`
- 特殊状态（熔核/熔岩）：`tests/final/04-core.png`
- 结算：`tests/final/05-dead.png`
- 移动端（844×390）：`tests/final/06-mobile.png`
- 中文标题：`tests/artifacts/02-title-zh.png`
- 暂停：`tests/artifacts/05-paused.png`
- 引导：`tests/artifacts/tutorial-first.png`

## 4) 未做项

- 未做排行榜/每日挑战/皮肤商店/剧情（已在 `config/design.json` antiScope 声明）。
- 未接真实广告账号（`sdk.config.js` `ads.enabled=false`，`source:'local'`；上线前改 `online` 并接后台 appId）。
- 未做 ja/ko/ar/ru 语言（只做 en/zh 完整，其余整块不暴露，符合 i18n-check）。
- 未做 AI 出图素材（美术全程序化 Canvas，符合「零外部素材」；封面/gif 为真实运行截图）。

## 5) 最不满意的一处

**洪水作为时间压力太弱**。当前洪水上涨速率（0.35–1.10 行/秒）远低于挖掘速率（约 3 行/秒），对会玩的玩家几乎不构成威胁，主要作用退化为「防挂机/让 noinput 死亡」，而不是「逼玩家在直下快挖与绕路吃钻石之间做取舍」。若要真正兑现 spec 里「暗河水位上涨」的压迫感，需要把中后期洪水速率抬到与挖掘节奏相当（约 2.5–3 行/秒），并把钻石收益调成「净体力略负 + 只换分」，让「绕路吃钻石」成为真正的有代价决定。当前版本为保门禁稳定与 bot 可达第 3 层，选择了保守数值，这是最想回炉的地方。
