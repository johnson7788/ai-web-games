# DONKEY HURDLE — 交付报告

改造对象：奔跑吧小驴（Cocos 跳跳类）→ 原创横版越障跑酷。玩法 1:1 还原「跳障碍/碰撞判负/距离计分/速度渐增」意象，角色/场景/音乐全原创，未复用原作任何素材/IP 名。

## 1) 文件清单

```
games/donkey-hurdle/
├─ index.html / styles.css / package.json
├─ config/
│  ├─ game.config.js        # 世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js           # 物理 / 障碍 / 陶罐 / 速度 / 事件密度（数值全在此）
│  ├─ levels.js             # 12 段推进 + 3 场景包 + 障碍轮换
│  ├─ locales.js            # en/zh 完整（48 key，0 missing）
│  ├─ sdk.config.js         # appId=pipy-donkey-hurdle（唯一 SDK 配置源）
│  └─ design.json           # 机器可读设计源（fun-audit PASS 100）
├─ src/
│  ├─ main.js               # 装配：固定步长 / 输入 / 事件分发 / 状态机 / __ll
│  ├─ core/{audio,i18n,save,sdk}.js
│  ├─ game/{sim,spawner,rng}.js
│  ├─ render/{index,theme,donkey,particles}.js
│  ├─ ui/{index,screens,hud,tutorial}.js
│  └─ vendor/pipysdk.js     # 站点 SDK vendored 副本
├─ tests/                   # 4 个测试文件，38 条纯逻辑测试
│  └─ final/                # 验收截图 + vision-review/tutorial/sdk 报告
├─ tools/
│  ├─ selfplay.mjs          # 3 策略遥测 → tools/fun/autoplay.json
│  ├─ audio-check.mjs       # 程序化音频离线校验
│  ├─ verify.plan.json      # 浏览器验收 plan
│  ├─ shots.mjs / record-gif.mjs / poster.mjs
│  └─ fun/{autoplay.json,report.md,fun-report.json,design-audit.*}
├─ docs/{analysis.md,report.md,short,long.md}
├─ game.gif (480×270, 4.5s, 697KB)
└─ poster.jpg (1280×720)
```

## 2) 门禁输出摘要（全部自跑）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 38 pass / 0 fail（4 文件） |
| `node tools/selfplay.mjs` | ✅ 3 策略：greedy dist=1512m seg=10 dead、random 78m dead、noinput 37m dead |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail；首输入 2s、首胜 3s、操作 120/min、空转 0%、事件间隔 0s、事件种类 14、推进率 100%、死亡 100%） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass） |
| `verify-game.mjs` | ✅ pass（0 console/page error、0 失败请求、fps=60） |
| `i18n-check.mjs` | ✅ en/zh 各 48 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS（4 步、可跳过、可重看、持久化） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/降级/广告/埋点/存档/分享 10 项全过） |
| `tools/audio-check.mjs` | ✅ 20/20 passed，allPass=true |
| `vision-review.mjs` | ✅ **PASS**（readable 8.0 / silhouette 8.4 / style 9.8；8 张，无 critical） |

> 全部门禁 PASS（vision-review 亦 PASS）。所有报告落盘于 `tests/final/` 与 `tools/fun/`，可复查。

## 3) 截图路径

- 标题：`tests/artifacts/v01-title.png`（en）、`v02-title-zh.png`（zh）
- 玩法：`tests/artifacts/v04-play.png`；受控玩法 `tests/final/01-play-dawn.png` … `06-night.png`（三场景包 + 跳跃/高墙/坑洞）
- 结算：`tests/final/07-result.png`、`tests/artifacts/v06-dead.png`
- 移动端（844×390）：`tests/final/08-mobile.png`、`tests/artifacts/v08-mobile-play.png`
- 引导：`tests/final/tutorial-first.png`、`tests/artifacts/v03-tutorial.png`
- 上线物料：`game.gif`（列表页动图）、`poster.jpg`（封面 1280×720）

## 4) 未做项

- 广告账号未接：`config/sdk.config.js` 的 `ads.enabled=false`（未接账号，符合 SDK 规范，上线时改 `source:'online'` + 广告开关）。
- 只做 en/zh：ja/ko/ar/ru 未做，已整块从 `locales` 与 `CONFIG.languages` 删除，不暴露半成品（i18n-check 0 missing）。
- AI 生成素材未用：本项目美术/音频全程序化（Canvas + WebAudio），无外部素材、无外链、零构建，符合 brief 的「零素材/程序化」要求。
- 无排行榜 / 皮肤商店 / 每日任务（spec 反范围）。
- 线上发布由 Lead 负责（`upload.mjs` 上传 + 线上 verify），本 agent 未执行。

## 5) 最不满意的一处

**无尽跑酷的「目标」对机器评审（vision-review）不直观。** 首轮截图被判 `goal_visible=false`：模型要一个「看得见的终点/收集物」，而跑酷的真实目标是「跑远 + 护罐」。我最终通过三件事修复：给 HUD 补上文案、把补给陶罐画成带金色光晕的醒目收集物、把障碍改成红色警示高对比（横栏红条 / 高墙红顶 / 坑洞红桩+虚线）。这说明本作的核心「目标」不如一个具体收集物那样机器可判，是需要人工向玩家额外说明的部分（已写进教程第 2/3 步与 HUD「Jars/Combo」文案）。另一个连带问题是驴身棕色调与沙地接近，silhouette 从 4.6 调到 8.0 花了较多迭代——若重做，我会在美术阶段先定「角色与地面前景色分离」的色板规则。
