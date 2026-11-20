# LIGHT GRID · 交付报告

> 改造自《点亮绿宝石》（Cocos Creator，只读参考）。玩法规则 1:1 还原 Lights Out 核心，角色/场景/音乐/美术全原创（程序化 Canvas + 程序化 WebAudio，零外部素材）。

## 1. 文件清单

```
games/light-grid/
├─ index.html  styles.css  package.json  README.md  .gitignore
├─ config/
│  ├─ gameplay.js      规则与数值（格型翻转模式/电容状态机）
│  ├─ levels.js        36 关库（3 场景包 × 12 关，5×5→6×6→7×7，确定性生成 + 内置解）
│  ├─ design.json      机器可读设计源（fun-audit 输入）
│  ├─ locales.js       en/zh 完整双语
│  ├─ sdk.config.js    appId=pipy-light-grid
│  └─ game.config.js   世界/步长/语言/存档键
├─ src/
│  ├─ vendor/pipysdk.js     站点 SDK（abyss-eel 同款）
│  ├─ core/{sdk,i18n,save,audio}.js
│  ├─ game/{sim,solver}.js   sim=纯逻辑；solver=GF(2) Gauss 求解器
│  ├─ render/{theme,index}.js 三场景色板 + Canvas 渲染 + 签名走线动画
│  ├─ ui/{screens,hud,tutorial,index}.js
│  └─ main.js               装配/状态机/__ll 契约
├─ tests/{sim,solver}.test.mjs   25 条纯逻辑测试
├─ tests/final/                 验收截图 + 各门禁 JSON
├─ tools/                       selfplay / audio-check / shot / record-gif / make-poster / verify.plan.json
├─ docs/{analysis,report,short.txt,long.md}
├─ game.gif    480×270 / 4.55s / 569KB（真实玩法：点亮 + 签名走线）
└─ poster.jpg  1280×720
```

## 2. 门禁输出摘要（全绿）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 25 pass / 0 fail |
| `node tools/selfplay.mjs` | 3 策略：greedy(levels=4,solved=3,dead=0,events=6,idle=0%) / random(dead=1) / noinput |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | **PASS** · 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | `pass: true`（0 console/page error，0 失败请求，fps 60） |
| `i18n-check.mjs` | ✓ en/zh 各 61 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✓ PASS（visible/active/steps=3/skip/persist/replay 全过） |
| `sdk-check.mjs` | ✓ PASS（SDK 就绪 + 降级 + 广告关 + 埋点/存档/分享） |
| `audio-check.mjs` | 12/12 passed，allPass=true |
| `vision-review.mjs` | **PASS**（readable 8.9 / silhouette 7.3 / style 9.4；0 critical / 0 lowMeans） |

关键遥测（fun-report，puzzle 门槛）：首输入 0s、首胜 1s、成功率 100%、操作 335/min、空转 0%、事件间隔 0s、事件种类 6、推进到第 3 关 100%、死亡存在 33%。

## 3. 截图路径

- 标题：`tests/final/01-title.png`、`tests/final/08-title-zh.png`
- 玩法：`tests/final/02-play.png`（5×5 点亮中）、`tests/final/03-diode.png`（二极管格）、`tests/final/04-neon.png`（7×7 霓虹管）
- 结算：`tests/final/06-clear.png`（过关 + 签名走线）、`tests/final/05-overload.png`（保险丝熔断）
- 移动端：`tests/final/07-mobile.png`（844×390）
- 引导：`tests/final/tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`

## 4. 未做项

- 广告账号未接（`ads.enabled=false`，按 spec 未接账号保持关闭，SDK 降级路径已验）。
- 只做 en/zh（ja/ko/ar/ru 未翻译，整块不暴露，i18n-check 通过）。
- 分享图片/海报的 AI 原画版未做——封面用 HTML 叠字（程序化棋盘 + 发光标题），符合「美术全程序化」约束。
- 每日挑战/排行榜等长线 meta 未做（antiScope 明确不做）。

## 5. 最不满意的一处

电容格「点两次才翻转」是**状态式**（第一下蓄能、第二下放电），不在 GF(2) 线性空间里，因此含电容的关卡无法用 Gauss 求解器做独立可解性验证，只能靠「正向重放生成解」证明可解。这让我对含电容关卡的「数学式可解性」证据不如纯线性格型（node/diode/relay/insulator 都有 Gauss 解）那么漂亮。若重做，会考虑把电容改成线性化模型（例如「自身 + 上下隔一格」的跳变），让全部 36 关都能被同一个求解器覆盖。
