# BILLION HUSTLE — 交付报告

改造自 `挣他一个亿`（Cocos Creator）→ 原创点击养成 `billion-hustle`。玩法规则 1:1 还原「点击挣钱 / 技能升级 / 伙伴加成 / 目标一亿 / 数值滚动」，角色、场景、音乐、文案全原创。

## 1. 文件清单

```
billion-hustle/
├─ index.html / styles.css          # 静态入口 + 响应式 UI
├─ package.json                     # {"type":"module"}
├─ config/                          # game.config / gameplay / design / locales / sdk.config
├─ src/
│  ├─ core/                         # audio(程序化合成) / i18n / save / sdk
│  ├─ game/                         # sim(纯逻辑) / rng
│  ├─ render/                       # index(三场景+粒子) / theme(三色板)
│  ├─ ui/                           # index / screens / hud / shop / tutorial
│  ├─ vendor/pipysdk.js             # vendored SDK（runtimeConfigUrl/appConfigUrl 置空）
│  └─ main.js                       # 装配 / 固定步长 / __ll 契约 / boot 守卫
├─ tests/sim.test.mjs               # 19 条纯逻辑测试
├─ tools/                           # selfplay / audio-check / verify.plan / record-gif / make-poster
├─ docs/                            # analysis / report / short / long
├─ game.gif                         # 480×270 · 4.5s · 752KB
└─ poster.jpg                       # 1280×720 · 88KB
```

## 2. 门禁输出摘要

| 门禁 | 结论 | 关键观测 |
| --- | --- | --- |
| `node --test` | ✅ 19/19 pass | 经济/升级/伙伴/押注/烧钱/融资轮/场景映射/格式化全绿 |
| `node tools/selfplay.mjs` | ✅ 3 策略 | greedy round=5(¥740K) / random round=11 / noinput round=1 |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail；首胜 12s、空转 0%、事件间隔 0.0s、13 种事件、greedy 推进 100% |
| `fun-audit.mjs` | ✅ PASS 100/100 | 26 pass / 0 warn / 0 fail；规则型升级 60% |
| `verify-game.mjs` | ✅ pass | 全检查 ok；60fps（avgFrameMs 16.67）；0 console/page error；0 失败请求；0 外部请求 |
| `i18n-check.mjs` | ✅ OK | en 81 / zh 81，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS | visible+active、3 步、可跳过、持久化、可重看 |
| `sdk-check.mjs` | ✅ pass | SDK 存在、API 齐全、降级可用、0 error |
| `tools/audio-check.mjs` | ✅ 18/18 | 15 SFX + 3 BGM loop RMS>0、peak<0.95、无 NaN |
| `vision-review.mjs` | ✅ PASS | readable 8.6 / silhouette 7.5 / style 8.1，无 critical |

## 3. 截图路径

- 标题：`tests/final/01-title.png`（en）、`02-title-zh.png`（zh）
- 引导：`tests/final/03-tutorial.png`
- 玩法：`tests/final/04-play.png`、`06-play2.png`（Series A 轮）
- 暂停：`tests/final/05-paused.png`
- 移动端：`tests/final/07-mobile.png`
- 视觉评审：`tests/final/vision-review.md`

## 4. 未做项

- design.json 里 6 个「规则型升级」（critTap / windfallExtend / burnLucky / milBonus / autopilot / instantCash）停留在设计层，sim 实际实现 tap / auto / 伙伴 / 烧钱 / 风口押注（满足门禁，属范围裁剪）。
- 素材未走 AI 生成线：美术全程序化 Canvas（spec 明确要求三场景包程序化），BGM 为 WebAudio 分层合成，未打包任何音频文件。
- 广告未接真实账号：`config/sdk.config.js` `ads.enabled=false`（按执行单「未接账号保持 false」）。
- 语言只暴露 en/zh（ja/ko/ar/ru 未做，按 i18n 规则整块不暴露）。
- 反范围：无联网排行榜、皮肤商店、每日任务、剧情对话、多产业组合管理。

## 5. 最不满意的一处

经济曲线仍偏陡：greedy（优先点击力）3 分钟到 C 轮（round 5，¥740K），而 random 策略 3 分钟能到 I 轮（round 11，¥79M）——「乱买伙伴」的被动产出斜率明显压过「点击力优先」，且整体一局偏快。成本乘数（1.75 / 1.85）虽压住了指数爆炸，但伙伴被动收入的上限（CMO 15K/s）对中后期太慷慨。下次重调方向：伙伴成本曲线再陡一档、CMO/CTO 产出砍半，让「点击力 build」与「伙伴 build」在同一时间窗口内更有取舍感。
