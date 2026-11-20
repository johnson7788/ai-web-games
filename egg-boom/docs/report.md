# EGG BOOM · 交付报告

> 改造自 Cocos《2048射击》（源码分析见 `docs/analysis.md`）。原创改造：蛋壳护甲 + 蛋黄溅射 + 三套场景包。
> 所有门禁由脚本自行跑通，输出如下。未 git commit、未起常驻服务器、未改动其他游戏目录。

## 1) 文件清单

```
games/egg-boom/
├─ index.html  styles.css  package.json  .gitignore  README.md  SEO.txt
├─ game.gif  poster.jpg
├─ config/  game.config.js · gameplay.js · levels.js · locales.js · sdk.config.js · design.json
├─ src/
│  ├─ main.js
│  ├─ core/  i18n.js · save.js · sdk.js · audio.js
│  ├─ game/  rng.js · spawner.js · sim.js
│  ├─ render/  index.js · scene.js · theme.js · egg.js · dough.js · particles.js
│  ├─ ui/  index.js · screens.js · hud.js · tutorial.js
│  └─ vendor/  pipysdk.js（runtimeConfigUrl/appConfigUrl 置空，避免 ERR_ABORTED）
├─ tests/  sim.test.mjs（23 条）
├─ tests/final/  01-play … 10-title-zh.png + verify/vision/tutorial/sdk 报告
├─ tools/  selfplay.mjs · verify.plan.json · audio-check.mjs · record-gif.mjs · poster.mjs
└─ docs/  analysis.md · short.md · long.md · report.md
```

## 2) 门禁输出摘要（全部 ≥WARN）

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ | 23 tests / 23 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(lv=4,dead=1) random(lv=2,dead=1) noinput(lv=6,dead=1) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail；首输入 2s、首胜 2s、空转 0%、事件间隔 0.0s、事件 11 种、推进 100%、死亡 100% |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ | pass=true；0 console/page error、0 失败请求、0 外部请求、fps 60（avgFrameMs 16.7） |
| `i18n-check.mjs` | ✅ | en/zh 各 54 key，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 3 步（jump/hit/break），可跳过/可重看/持久化 |
| `sdk-check.mjs` | ✅ | SDK 对象/快捷 API 齐全、showRewarded 安全、track 可用、断网降级 OK、0 error |
| `tools/audio-check.mjs` | ✅ | 24/24 音效 RMS>0、峰值<0.95、无 NaN |
| `vision-review.mjs` | ✅ WARN | readable 7.38 / silhouette 7.0 / style 9.0；0 critical、0 低分项 |

## 3) 截图路径（tests/final/）

- 标题：`09-title.png`、`10-title-zh.png`
- 玩法：`01-play.png`、`02-shoot.png`、`06-restart.png`、`07-scene2.png`（甜品站）、`08-scene3.png`（午夜食堂）
- 移动端（844×390）：`04-mobile.png`
- 引导/结算：`03-tutorial.png`、`05-dead.png`

## 4) 未做项

- 未接广告账号（`ads.enabled=false`，SDK 走本地 vendored 副本，线上可切 `source:'online'`）。
- 未做 ja/ko/ar/ru（仅 en/zh 完整暴露）。
- 无 AI 生成素材/音频——按 brief 允许的程序化 Canvas + WebAudio 合成。
- 未做每日任务 / 排行榜 / 皮肤商店（见 `config/design.json` antiScope）。

## 5) 最不满意的一处

蛋黄溅射（连击 ×5 的范围弹）目前只由**手动点按**触发，自动射击永远只打当前行；这给了「何时用蛋黄」的决定，但初次玩家容易攒满 5 连击后没意识到要「点一下」才能释放，教学里也没有专门一步强调它。下一版应在蛋黄就绪时在 HUD 弹一句「TAP FOR YOLK」的强提示。
