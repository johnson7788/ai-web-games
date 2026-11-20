# CAKE KART · 交付报告

> slug `cake-kart` · title `CAKE KART` · appId `pipy-cake-kart`
> 改造自 Laya 3D「蛋糕飞车」→ 甜品卡丁车圈速竞速（伪 3D Mode7，全程序化素材）。
> 工作目录：`games/cake-kart/`（只写本目录；参考实现 `games/abyss-eel` 只读）。

## 1) 文件清单

```
games/cake-kart/
├─ index.html                入口（canvas / ui-root / 触屏按钮 / rotate / loading）
├─ styles.css                甜品玻璃拟态 UI + 响应式 + #rotate + #loading(pointer-events:none)
├─ package.json              {"type":"module"}
├─ .gitignore
├─ game.gif                  480×270 · 4.5s · 1.1MB（真实玩法：油门→漂移→糖霜加速）
├─ poster.jpg                1280×720 海报
├─ SEO.txt                   5 个关键词（TITLE/CATEGORY/TAGS/SHORT/LONG，中英）
├─ config/
│  ├─ game.config.js         WORLD / STEP / CONFIG(lang)
│  ├─ sdk.config.js          appId pipy-cake-kart / 广告位 / 存档 / 分享
│  ├─ locales.js             en + zh（45 key，0 missing）
│  ├─ gameplay.js            竞速/漂移/道具/地形/AI 数值
│  ├─ tracks.js              12 站 GP + 三场景包
│  └─ design.json            fun-audit 设计源
├─ src/
│  ├─ vendor/pipysdk.js      SDK 本地副本
│  ├─ core/{sdk,i18n,save,audio}.js   SDK 唯一出口 / i18n / 存档 / 程序化音频
│  ├─ game/{rng,track,sim}.js         纯逻辑：PRNG / 赛道几何 / 竞速 sim
│  ├─ render/{theme,trackmap,mode7,index}.js  三场景色板 / 俯视贴图 / Mode7 / 装配
│  ├─ ui/{screens,hud,tutorial,index}.js       屏幕 / HUD / 4 步引导 / 装配
│  └─ main.js                固定步长 / 输入 / 事件分发 / 状态机 / __ll
├─ tests/
│  ├─ sim.test.mjs           20 条纯逻辑测试
│  └─ track.test.mjs         6 条赛道测试
├─ tools/
│  ├─ selfplay.mjs           3 策略无头自玩 → tools/fun/autoplay.json
│  ├─ audio-check.mjs        离线 PCM 校验
│  ├─ verify.plan.json       浏览器验收计划
│  ├─ record-gif.mjs         录屏 → ffmpeg → game.gif
│  └─ poster.mjs             玩法截图 + 叠字 → poster.jpg
└─ docs/
   ├─ analysis.md            源码分析（文件:行号）
   ├─ report.md              本报告
   ├─ short.md               ≤160 字符英文简介
   └─ long.md                英文 + 中文（含操作说明）
```

## 2) 每条门禁输出摘要

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 26 pass / 0 fail（20 sim + 6 track） |
| `node tools/selfplay.mjs` | ✅ PASS | greedy(lap=3,rank=1,deaths=0,64s,16事件) / random(lap=3,rank=6,40死) / noinput(lap=2,18死) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail：首输入 0s、延迟 90ms、首胜 23s、成功率 100%、1270 操作/min、空转 0%、最大事件间隔 1s、16 种事件、推进率 100%、死亡率 67% |
| `fun-audit.mjs` | ✅ PASS | 全部 ✅（3 动词带代价 / 7 个决定 / 12 关每关新元素 / 10 升级 60% 规则型 / 4 钩子 / 4 步引导） |
| `verify-game.mjs` | ✅ PASS | 0 console/page error、0 失败请求、fps 60（avgFrameMs 16.7）、标题/切语言/开局/引导/转向/漂移/暂停/恢复/完赛/回标题全过 |
| `i18n-check.mjs` | ✅ PASS | en/zh 各 45 key，0 missing 0 empty，默认 en |
| `tutorial-check.mjs` | ✅ PASS | 4 步（throttle/steer/drift/boost）、可跳过、刷新持久化、可重看 |
| `sdk-check.mjs` | ✅ PASS | SDK 就绪、API 齐全、showRewarded 安全、埋点/存档/分享、断网降级、0 错误 |
| `tools/audio-check.mjs` | ✅ PASS | 17/17（16 SFX + 1 BGM 循环）RMS>0 / peak<0.95 / 无 NaN |
| `vision-review.mjs` | ⚠️ WARN（≥WARN 达标） | readable 7.7 / silhouette 8.0 / style 9.3，0 critical、0 lowMeans，3 张玩法图全部 goal_visible=Y、无 HUD 遮挡、无文字裁切（视觉模型逐次打分有小幅波动，PASS/WARN 之间，均 ≥WARN） |

## 3) 截图路径

| 用途 | 路径 |
| --- | --- |
| 标题（英文） | `tests/artifacts/v01-title.png` |
| 标题（中文） | `tests/artifacts/v02-title-zh.png` |
| 首次引导 | `tests/artifacts/v03-tutorial.png` |
| 玩法（驾驶） | `tests/artifacts/v04-play.png` · `tests/final/01-play.png` |
| 玩法（糖霜漂移） | `tests/artifacts/v04b-drift.png` · `tests/final/02-drift.png` |
| 完赛结算 | `tests/artifacts/v06-finish.png` |
| 移动端（844×390） | `tests/artifacts/v08-mobile-play.png` · `tests/final/03-mobile.png` |
| 海报 | `poster.jpg` |
| 列表页动图 | `game.gif` |

## 4) 未做项

- **不做真 3D 引擎**：按 spec 用 Mode7 伪 3D（俯视贴图透视投影），无 WebGL/three.js。
- **不做 ja/ko/ar/ru**：只暴露 en/zh（完整才暴露），符合 i18n 铁律。
- **不做 AI 素材**：美术全程序化 Canvas（spec 明确「不引外部素材」），故无 `assets/`、未跑 asset-check。
- **不做联网/排行榜/皮肤商店/每日任务/剧情**：见 design.json `antiScope`。
- **上线动作未做**：`game.gif` / `poster.jpg` / `SEO.txt` 已产，但上传/发布由 Lead 负责（本单不 commit、不起常驻服务）。

## 5) 最不满意的一处

**车道（rail-based）移动模型**。当前 karts 被约束在「赛道中心线 + 横向偏移（lane）」上推进，而不是自由 2D 平面运动：转向只改变 lane 偏移、离轨靠离心外滑 + 撞栏判定，碰撞与超车都简化为一维排序。这样做换来了 `node --test`/selfplay 的可复现与稳健（greedy 稳定 3 圈 rank 1、noinput 稳定撞栏），也满足了验收，但**手感上不如真正的 2D 卡丁车物理**——玩家没有「自由切弯、车身姿态、两车真实擦碰」的临场感。若再做一版，我会把赛道改成可碰撞的带状多边形 + 自由 2D 位置/朝向/速度积分，同时保留轨道弧长投影做圈数判定，让漂移的外滑真正来自离心力与轮胎摩擦角，而不是一个 `lane += (laneV + slide) * STEP` 的标量近似。

---

*全套门禁自己跑并全绿；`window.__ll` 契约照抄 abyss-eel；boot 竞态守卫、`#loading` pointer-events:none、`#rotate` 竖屏提示、教程持久化、SDK 唯一出口均已落地。*
