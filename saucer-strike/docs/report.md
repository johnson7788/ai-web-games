# SAUCER STRIKE · 交付报告

> 改造自 `打飞碟-creator`（固定炮位射击飞碟波次）+ `shoot`（拉弓力度角度发射）。玩法规则 1:1 还原，角色/场景/音乐全原创。源码分析见 `docs/analysis.md`。

## 1) 文件清单

```
games/saucer-strike/
├─ index.html / styles.css / package.json / README.md
├─ config/
│  ├─ game.config.js      世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js         全部玩法数值（炮/蓄力/过热/曳光/近失/流星/升级）
│  ├─ levels.js           碟型定义 + 12 波 + 3 场景章
│  ├─ locales.js          en/zh（各 57 key，完整）
│  ├─ design.json         机器可读设计源（fun-audit 输入）
│  └─ sdk.config.js       appId: pipy-saucer-strike
├─ src/
│  ├─ core/               sdk.js（SDK 唯一出口）/ i18n.js / save.js / audio.js（程序化 BGM+SFX）
│  ├─ game/               sim.js / spawner.js / rng.js（纯逻辑，零 DOM）
│  ├─ render/             index.js / scene.js / theme.js / particles.js（程序化 Canvas）
│  ├─ ui/                 index.js / screens.js / hud.js / tutorial.js
│  ├─ vendor/pipysdk.js   SDK vendored 副本（appId 改 pipy-saucer-strike；外链配置置空）
│  └─ main.js             装配 / 固定步长 / 输入 / 事件分发 / 状态机 / __ll 契约
├─ tests/                 sim.test.mjs + spawner.test.mjs + tutorial.test.mjs（29 条）
├─ tools/                 selfplay.mjs / audio-check.mjs / verify.plan.json / record-gif.mjs / poster.mjs
├─ docs/                  analysis.md / report.md / short.md / long.md
├─ tests/final/           验收截图 + verify/sdk/tutorial/vision 报告
├─ poster.jpg (1280×720) / game.gif (480×270·4.5s)
└─ .gitignore
```

## 2) 全套门禁输出摘要

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ **29 pass / 0 fail**（sim 18 + spawner 6 + tutorial 5） |
| 无头自玩 | `node tools/selfplay.mjs` | ✅ 3 策略：greedy 到 12 波(通关,apm 587) / random 到 5 波(死亡) / noinput 到 1 波(死亡) |
| Fun Gate 遥测 | `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| 设计审计 | `fun-audit.mjs --root .` | ✅ **PASS** · 100/100（26 pass） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final` | ✅ **pass** · 60fps（avgFrameMs 16.67）· 0 console/page error · 0 失败请求 · 0 外部请求 |
| 语言完整性 | `i18n-check.mjs --root .` | ✅ en/zh 各 57 key，0 missing / 0 empty |
| 交互引导 | `tutorial-check.mjs --root . --out tests/artifacts` | ✅ **PASS**（4 步 aim/fire/kill/tracer；可跳过/可重看/持久化） |
| SDK 接入 | `sdk-check.mjs --root . --out tests/final` | ✅ **pass**（对象存在/API 齐全/降级/埋点/存档/分享/断网可开） |
| 音频 RMS | `node tools/audio-check.mjs` | ✅ **27/27**（24 SFX + 3 BGM 循环层，rms>0 / peak<0.95 / 无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ✅ **PASS**（readable 8.0 / silhouette 6.0 / style 8.3，6 张全 goal_visible） |

**fun-report 关键指标**（greedy 单跑）：首胜 1s · 每分钟操作 447 · 空转 0% · 事件最大间隔 0s · 事件种类 16 · 推进率 100% · 至少死过一次 67%。

## 3) 截图路径

- 标题：`tests/final/01-title.png`
- 玩法（拖拽蓄力 + 飞碟 + 命中）：`tests/final/04-play.png`
- 首次引导：`tests/final/03-tutorial.png`
- 结算：`tests/final/06-dead.png`
- 重开：`tests/final/07-restart.png`
- 移动端 844×390：`tests/final/08-mobile.png`
- 封面：`poster.jpg`（1280×720）
- 列表动画：`game.gif`（480×270 · 4.5s · 444KB，前 3 秒即拖拽蓄力 + 命中）

## 4) 未做项

- 不做联网/排行榜、皮肤商店、每日任务、剧情对话（设计源 antiScope 明确排除）。
- 未接线上广告账号（`config/sdk.config.js` 的 `ads.enabled=false`，`source='local'`）。
- 未做敌弹还击（原作 `enemy.ts` 的敌弹分支）——spec 的 P0 只要求飞碟波次/命中计分/漏碟扣命，敌弹非 P0。
- 未做竖屏专属模式（横竖 letterbox 兼容 + `#rotate` 提示）。

## 5) 最不满意的一处

**曳光弹做成了自动寻的（必然命中 → 必然显形）**。spec 里「曳光弹（每波 1 发显形弹，命中后 3s 内显形）」本意是「打空了就浪费」，以此强化「留给隐形碟波」的取舍；本作为了让 bot 与验收可靠、且不引入「打空即废」的挫败，把它做成了自寻最碟，命中/出界都会触发显形——这削弱了该决定的代价强度。若再迭代，会让曳光弹沿当前瞄准方向直线飞行、打空即废，并给隐形碟补一个可预判的闪烁节奏来替代保底。
