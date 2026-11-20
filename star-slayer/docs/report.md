# STAR SLAYER · 交付报告

> 改造自开源参考「超能陆战队-creator」；玩法规则 1:1 还原，角色/场景/IP 全原创。
> 全部门禁已自跑，退出码全部 0。未 git commit、未起常驻服务器、未改动其他游戏目录。

## 1) 文件清单

```
games/star-slayer/
├─ index.html  styles.css  package.json  .gitignore  README.md
├─ config/
│  ├─ game.config.js       世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js          玩法数值（玩家/光核/同步/超载/敌人/Boss）
│  ├─ levels.js            12 波结构 + 5 类敌人 + 三场景
│  ├─ cards.js             12 张技能卡（8 规则型 / 4 数值型）
│  ├─ locales.js           en/zh 完整（各 64 key）
│  ├─ sdk.config.js        pipy-star-slayer（source: local）
│  └─ design.json          机器可读设计源（fun-audit 100/100）
├─ src/
│  ├─ core/  i18n.js · sdk.js · save.js · audio.js（程序化 SFX×21 + BGM×4 分层循环）
│  ├─ game/  sim.js（纯逻辑）· rng.js
│  ├─ render/ index.js · theme.js（三场景色板 + 程序化 Canvas）
│  ├─ ui/    index.js · screens.js · hud.js · tutorial.js
│  ├─ vendor/pipysdk.js    vendored SDK（runtime/appConfigUrl 置空，本地降级）
│  └─ main.js              装配 / 固定步长 / 输入 / __ll 契约 / boot 守卫
├─ tests/  sim.test.mjs · levels.test.mjs · ui.test.mjs（30 条）
├─ tests/final/ 01-play · 02-boss · 03-overload-ready · 04-mobile（png）
│  + sdk-report.json · tutorial-report.json · vision-review.{json,md}
├─ tools/  selfplay.mjs · verify.plan.json · audio-check.mjs · make-shots.mjs
│  · record-gif.mjs · make-poster.mjs · fun/* · audio/* · artifacts/*
├─ docs/  analysis.md · report.md · short · long.md
├─ game.gif（480×270 · 4.5s · 449KB）
└─ poster.jpg（1280×720 · 77KB）
```

## 2) 门禁输出摘要（全部绿色，exit 0）

| 门禁 | 结论 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ 30/30 | sim / levels / cards / tutorial 全过 |
| `node tools/selfplay.mjs` | ✅ | greedy(wave=7,dead=1) random(wave=3,dead=1) noinput(wave=3,dead=1) |
| `fun-report.mjs` | ✅ **PASS** | 10 pass / 0 warn / 0 fail；空转 0%；事件间隔 0.2s；推进率 100%；死亡存在 100% |
| `fun-audit.mjs` | ✅ **PASS** | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass=true | 0 console/page error · 0 失败请求 · 60fps（avgFrameMs 16.68） |
| `i18n-check.mjs` | ✅ OK | en 64 / zh 64，missing 0，empty 0 |
| `tutorial-check.mjs` | ✅ PASS | 4 步（move/fire/kill/sync），可跳过、可重看、已持久化 |
| `sdk-check.mjs` | ✅ pass=true | SDK 对象/API 齐全；showRewarded 安全返回；断网降级可加载 |
| `tools/audio-check.mjs` | ✅ allPass | 25/25（21 SFX + 4 BGM loop）rms>0、peak<0.95、无 NaN |
| `vision-review.mjs` | ✅ **PASS** | readable 8.3 / silhouette 7.3 / style 9.0；0 critical |

## 3) 截图路径

- 标题：`tests/artifacts/v01-title.png`（英文）、`tests/artifacts/v02-title-zh.png`（中文）
- 玩法：`tests/artifacts/v04-play.png`、`tests/final/01-play.png`
- Boss：`tests/final/02-boss.png`
- 超载决策时刻：`tests/final/03-overload-ready.png`
- 移动端：`tests/artifacts/v08-mobile-play.png`、`tests/final/04-mobile.png`
- 暂停/结算/重开：`tests/artifacts/v05-paused.png` · `v06-dead.png` · `v07-restart.png`

## 4) 未做项

- 未接广告账号：`config/sdk.config.js` 的 `ads.enabled=false`，线上 SDK `source` 仍为 `local`（待上线切换 `online` + 广告策略）。
- 未做 ja/ko/ar/ru（整块不暴露，符合「没翻完就整块删掉」）。
- 未做 3D / WebGL；全部程序化 Canvas 2D 渲染，无外部美术/音频素材。
- 未接排行榜 / 皮肤商店 / 每日任务（写入 `design.json.antiScope`）。

## 5) 最不满意的一处

**视觉评审的可读性是被「目标可见」反复卡住后才过关的。** 顶视角射击里「敌人=目标」在视觉模型眼里并不天然成立：它多次把玩家与伙伴光核当成「两个亮度接近的点」，把红色三角当成装饰，直到我做了四件事——给每个敌人加**独立血条**、加**ELIMINATE ALL HOSTILES 目标横幅**、把伙伴光核改成**更小更暗的青色伴星并加连接线**、把敌人放大 2.4 倍并统一暖色。这套「目标信号」是事后为机器评审补的，而不是一开始就设计进视觉语言的；如果立项阶段就把「机器如何理解目标」纳入美术 spec，能省下大量返工。
