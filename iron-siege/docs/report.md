# IRON SIEGE · 交付报告

> 共享执行单 v2 · 单 agent 端到端 · slug `iron-siege` · appId `pipy-iron-siege`
> 全部门禁自跑通过（`node` 在此 shell 被 nvm 破坏，统一用 `/opt/homebrew/bin/node` 直跑）。

## 1) 文件清单

```
games/iron-siege/
├─ index.html              入口（canvas 1280×720 + #rotate + #touch-controls + #loading）
├─ styles.css              蒸汽朋克金属面板 / 右控制台 / 触屏控件 / 竖屏提示 / 响应式
├─ package.json            {"type":"module"}
├─ .gitignore
├─ config/
│  ├─ game.config.js       画布 / 步长 / 语言 / 存档键
│  ├─ gameplay.js          全部玩法数值（战场/火力/重炮/焊修/敌人/熔炉/道具）
│  ├─ levels.js            三场景 + 12 波 + 程序化地图生成（车道式构图）
│  ├─ design.json          机器可读设计源（fun-audit 100 分）
│  ├─ locales.js           en/zh 各 63 key，完整无缺
│  └─ sdk.config.js        appId / 广告位 / 埋点 / 存档 / 分享
├─ src/
│  ├─ vendor/pipysdk.js    vendored 站点 SDK（本地降级）
│  ├─ core/sdk.js          SDK 唯一出口（存档/埋点/广告/分享全走这里）
│  ├─ core/i18n.js         语言（?lang > localStorage > en）
│  ├─ core/audio.js        WebAudio 程序化音效（19 音效 + 引擎循环层，离线可测）
│  ├─ game/sim.js          纯逻辑模拟（移动/碰撞/子弹互抵/波次/道具/胜负）
│  ├─ game/rng.js          mulberry32
│  ├─ render/index.js      Canvas2D 程序化渲染（三场景色板/机甲/熔炉/特效）
│  ├─ render/theme.js      场景色板 + 布局常量
│  └─ ui/{index,screens,hud,tutorial}.js   屏幕/HUD/首次引导
├─ tests/sim.test.mjs      19 条纯逻辑测试
├─ tools/
│  ├─ verify.plan.json     浏览器验收计划（桌面 + 移动 + fps）
│  ├─ selfplay.mjs         3 策略无头自玩（greedy/random/noinput）
│  └─ audio-check.mjs      音效 RMS/峰值/NaN 离线校验
├─ tools/fun/autoplay.json 遥测产物
├─ docs/{analysis,report,short,long}.md
└─ tests/final/            验收证据（截图 + 各报告 json）
```

## 2) 每条门禁的输出摘要

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `/opt/homebrew/bin/node --test` | ✅ 19 tests / 19 pass / 0 fail |
| 无头自玩 | `/opt/homebrew/bin/node tools/selfplay.mjs` | ✅ 3 策略各一局（greedy 到第 3 波） |
| Fun Gate | `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail；首胜 24s、事件间隔 1s、推进率 100%） |
| 设计审计 | `fun-audit.mjs --root .` | ✅ **PASS**（100/100，26 pass / 0 warn / 0 fail） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass=true（0 console/page error、0 失败请求、60fps） |
| 语言完整性 | `i18n-check.mjs --root .` | ✅ en/zh 各 63 key，0 missing / 0 empty |
| 首次引导 | `tutorial-check.mjs --root .` | ✅ **tutorial PASS**（4 步、可跳过、可重看、持久化） |
| SDK 接入 | `sdk-check.mjs --root .` | ✅ pass=true（SDK 就绪/降级/广告/埋点/存档/分享全过） |
| 音频校验 | `tools/audio-check.mjs` | ✅ 20/20 passed，allPass=true（RMS>0、peak<0.95、无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ✅ **PASS**（readable 8.0 / silhouette 6.8 / style 8.8，0 critical） |

## 3) 截图路径（标题 / 玩法 / 移动端）

- 标题：`tests/final/01-title.png`
- 玩法：`tests/final/04-play.png`、`tests/final/07-restart.png`
- 结算：`tests/final/06-dead.png`
- 移动端：`tests/final/08-mobile-play.png`
- （其余验证截图：`tests/final/` 下 `verify-report.json` / `tutorial-report.json` / `sdk-report.json` / `vision-review.json`）

## 4) 未做项

- **`game.gif` / `poster.jpg`**：未做（上线物料 §4，需 playwright 录屏 + ffmpeg 合成 / 截图叠字；本交付聚焦「全门禁 + 报告」，物料可由 Lead 上传前补录，玩法截图 `tests/final/04-play.png` 可直接复用为海报底图）。
- **线上真实 URL 验证**：未做（未接发布开关，`sdk.config.js` 的 `source` 保持 `'local'`，`ads.enabled=false`）。

## 5) 最不满意的一处

**视觉评审里「玩家机甲 / 敌人 / 砖块」的剪影区分度偏弱**：程序化 Canvas 里敌人（暗红）与砖墙（土黄/棕）在远距离色差不够大，vision-review 多次提到「绿色小方块与棕色地形色差小、眯眼难辨」。当前靠玩家的青蓝辉光 + 敌人暗红 + 子弹亮色勉强过线（silhouette 6.8），但没有做到「眯眼一眼分清敌我」。若要再版，优先做**非颜色冗余**：给敌人加统一的锐利倒三角/尖角轮廓 + 高亮描边，给砖块降饱和，让敌我形状本身可区分，而不是只靠色相。
