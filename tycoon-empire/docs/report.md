# TYCOON EMPIRE · 交付报告

> 改造自 `顶级富豪` + `大老板`（Cocos 源码）→ 原创网页游戏。玩法规则 1:1 还原，角色/场景/音乐/IP 全原创。

## 1. 文件清单

```
games/tycoon-empire/
├─ index.html / styles.css          入口 + 1920 装饰艺术 UI
├─ package.json                     {"type":"module"}
├─ game.gif                         480×270 · 4.2s · 1.1MB（真实玩法循环）
├─ poster.jpg                       1280×720（玩法图 + 大标题发光描边）
├─ SEO.txt / docs/short.md / docs/long.md
├─ config/
│  ├─ game.config.js                世界尺寸/步长/语言
│  ├─ gameplay.js                   12 产业数值 / 股市日 / 贷款 / 离线收益 / 大数格式化
│  ├─ locales.js                    en/zh（各 73 key，0 missing）
│  ├─ design.json                   机器可读设计源（fun-audit PASS 100）
│  └─ sdk.config.js                 appId=pipy-tycoon-empire（local 模式）
├─ src/
│  ├─ core/{i18n,save,audio,sdk}.js  语言/音频设置存档/程序化 WebAudio/SDK 唯一出口
│  ├─ game/{rng,sim}.js             确定性 RNG + 纯逻辑经营模拟
│  ├─ render/index.js               三场景色板 + 主楼 + 金链粒子
│  ├─ ui/{index,tutorial}.js        标题/HUD/产业面板/操作栏 + 3 步交互引导
│  ├─ vendor/pipysdk.js             vendored（runtimeConfigUrl/appConfigUrl 已清空）
│  └─ main.js                       固定步长 / 状态机 / 事件分发 / __ll 契约
├─ tests/{sim,tutorial}.test.mjs    31 条纯逻辑测试
├─ tests/final/*.png                验收截图（标题/玩法/移动端/引导）
└─ tools/{selfplay,audio-check,record-gif,poster}.mjs + verify.plan.json
```

## 2. 全套门禁输出摘要（全部自跑，全绿）

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ | 31 pass / 0 fail（sim 经济 + 教程状态机 + 格式化） |
| `tools/selfplay.mjs` | ✅ | greedy lv=6 / random lv=6 / noinput lv=1 |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首输入 0s / 首胜 0.4s / 空转 1% / 事件间隔 0.03s / 推进 100%） |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass | 0 error / 0 失败请求 / 0 外部请求 / 60fps |
| `i18n-check.mjs` | ✅ OK | en 73 / zh 73 / 0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 3 步 / 可跳过 / 持久化 / 可重看 |
| `sdk-check.mjs` | ✅ pass | SDK 存在 / 降级可玩 / 0 error / 0 失败请求 |
| `tools/audio-check.mjs` | ✅ | 22/22（20 SFX + 2 BGM 循环层 RMS 全过） |
| `vision-review.mjs` | ✅ PASS | readable 8.3 / silhouette 9.0 / style 9.3 |

## 3. 截图路径

- 标题：`tests/final/z-title.png`、`z-title-zh.png`
- 玩法：`tests/final/a-play.png`（点楼）、`b-industries.png`（多产业）、`c-manager.png`（经理+股市）、`d-stock.png`（行情日）、`h-build.png`（金链/高楼）
- 中文玩法：`tests/final/g-play-zh.png`
- 移动端：`tests/final/f-mobile.png`（844×390）
- 引导：`tests/final/tutorial-first.png`、`tutorial-after-skip.png`、`tutorial-replay.png`

## 4. 未做项

- 未接广告账号：`config/sdk.config.js` 保持 `source:'local'`、`ads.enabled:false`（按 brief 允许）。
- 未发布上线（Lead 负责上传；本任务不 git commit、不起常驻服务器）。
- design.json 中 5 个「规则型升级」为设计层的规则表达（经理自动化/股市内幕/破产保护/金链/连点爆发），实际映射为游戏机制（经理、股市、贷款、signature、tapCombo），未做成独立 perk 树（P0 未要求）。

## 5. 最不满意的一处

**点击产出与被动产出的数值耦合太紧**：tap 的产出由 `TAP.base * (1 + 总等级 * perLevel)` 决定，中后期总等级涨起来后，一次点击的收益会迅速超过多数产业的每秒产出，导致「点楼」在后期仍是收益主来源，而不是被产业被动收入取代——这与「放置经营」的心智预期有偏差。理想曲线应是点击只在早期有存在感、后期退为补充。受限于单 agent 时间预算，本轮只调了 `perLevel=0.5` 让 greedy bot 60 秒内能推进到第 6 产业，没有做「点击收益随章节衰减」的分段曲线。若要改，应在 `config/gameplay.js` 加 `TAP.perLevel` 按 `chapter` 分段衰减，并补一条断言测试。
