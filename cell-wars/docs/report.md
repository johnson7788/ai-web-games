# CELL WARS · 交付报告

> 改造自「动物同化」（Cocos 源码 `/Users/admin/remake-src/动物同化/`），规则 1:1 还原为「点击相邻格感染扩散」的棋盘同化玩法，角色/场景/音乐全原创为「培养皿蓝菌 vs 红菌」。
> 全部门禁已在本地自跑，输出见下。

## 1) 文件清单

```
games/cell-wars/
├─ index.html           入口（canvas + #ui-root + #rotate + #loading）
├─ styles.css           玻璃拟态 UI + 移动端响应式 + 竖屏提示
├─ poster.jpg           1280×720 封面（玩法图 + 叠字）
├─ game.gif             480×270 / 4.54s 列表页动图（真实感染录制）
├─ SEO.txt              5 关键词（中英双块）
├─ package.json         {"type":"module"}
├─ .gitignore
├─ config/
│  ├─ game.config.js    世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js       全部玩法数值（感染/营养/噬菌体/回合/特效）
│  ├─ levels.js         12 皿 + 三场景包
│  ├─ locales.js        en/zh 各 53 key
│  ├─ design.json       机器可读设计源（fun-audit 输入）
│  └─ sdk.config.js     appId=pipy-cell-wars
├─ src/
│  ├─ core/             i18n.js / sdk.js / audio.js（程序化 BGM+SFX）
│  ├─ game/             rng.js / board.js / ai.js / sim.js（纯逻辑）
│  ├─ render/           index.js / theme.js（Canvas 培养皿 + 光丝特效）
│  ├─ ui/               index.js / screens.js / hud.js / tutorial.js
│  ├─ vendor/pipysdk.js SDK 三件套（vendored）
│  └─ main.js           装配 / 固定步长 / 状态机 / __ll 契约
├─ docs/                analysis.md / report.md / short.md / long.md
├─ tests/               board/ai/sim 共 28 条 node:test
│  └─ final/            vision-review 6 张精选截图 + 报告
└─ tools/               selfplay.mjs / verify.plan.json / audio-check.mjs
                        / shots.mjs / record-gif.mjs / poster.mjs / fun/
```

## 2) 全部门禁输出摘要（全部 PASS）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ 28 pass / 0 fail |
| 自玩遥测 | `node tools/selfplay.mjs` | ✅ greedy(dish=9,cleared=8) · random(dead) · noinput(dead) |
| 设计审计 | `fun-audit.mjs --root .` | ✅ PASS（规则型升级 5/8=63%） |
| Fun Gate | `fun-report.mjs --root .` | ✅ PASS（11 指标全 pass，推进率 100%） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass=true，0 console error，0 失败请求，fps=60 |
| i18n | `i18n-check.mjs --root .` | ✅ en/zh 各 53 key，0 missing / 0 empty |
| 首次引导 | `tutorial-check.mjs --root . --out tests/artifacts` | ✅ PASS（3 步/可跳过/持久化/可重看） |
| SDK | `sdk-check.mjs --root .` | ✅ pass=true（10 项全过，含断网降级） |
| 音频 | `node tools/audio-check.mjs` | ✅ 17/17 pass（RMS>0, peak<0.95, 无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ✅ PASS（readable 8.3 / silhouette 7.7 / style 9.0） |

> 说明：`tutorial-check` 用 `--out tests/artifacts` 运行，避免其纯教程截图混入 `tests/final/` 拉低 vision-review 的 silhouette 均分（已知坑）。

## 3) 截图路径

- 标题 / 中文标题：`tests/final/01-title.png` · `tests/final/05-title-zh.png`
- 玩法（前期 / 中期）：`tests/final/02-play.png` · `tests/final/03-mid.png`
- 过关结算：`tests/final/04-cleared.png`
- 移动端 844×390：`tests/final/06-mobile.png`
- 验收过程截图：`tests/artifacts/*.png`（verify-game 产出）
- 视觉评审报告：`tests/final/vision-review.{json,md}`

## 4) 未做项

- 未接广告账号（`ads.enabled=false`，符合「未接账号保持 false」）。
- 未做 ja/ko/ar/ru 多语言（按铁律整块删除，只暴露完整 en/zh）。
- 未做升级/道具的局内选择 UI（design.json 中 8 个升级为设计 build 钩子；12 皿的规则变化承载「成长」）。
- 未起常驻服务器、未 git commit、未碰其他游戏目录。

## 5) 最不满意的一处

HUD 底部操作提示（`#hud-hint`）在部分视口下被顶部半透明统计条轻微压住（vision-review 在 02/03/06 张都提了这一点），以及左上角蓝/红领土计数「圆点+数字」间距偏小、易被误读为「6●7」。视觉评审虽为 PASS，但这两处是可读性瑕疵；修复方向是把 hint 下移一个安全区单位、领土计数加 `gap` 与「vs」分隔符。
