# STACK SKY 交付报告

> slug `stack-sky` · title `STACK SKY`（云端叠塔）· appId `pipy-stack-sky`
> 改造自「叠叠乐」（参考源码路径见 `docs/analysis.md` §0），玩法 1:1 还原经典 Stack 塔式规则，角色/场景/音乐全原创。

## 1) 文件清单

```
index.html                入口（1280×720 letterbox + #rotate + #loading 不拦截点击）
styles.css                玻璃拟态 UI + 三场景色板 + 移动端/竖屏响应式
package.json              {"type":"module"}
config/game.config.js     世界尺寸 / STEP / 语言 / 存档键
config/gameplay.js        全部玩法数值（STACK/WIND/SHRINE/CAMERA + 纯函数）
config/levels.js          12 段推进 + 3 场景包（segmentAt/scenePackAt）
config/design.json        G0.5 机器可读设计源（fun-audit 输入）
config/locales.js         en/zh 完整（52 key 完全对齐）
config/sdk.config.js      唯一 SDK 配置（appId=pipy-stack-sky，source=local）
src/core/{i18n,save,audio,sdk}.js
src/game/{rng,sim}.js     纯逻辑模拟（createRun/step/getHud/drainEvents）
src/render/{index,theme}.js  程序化 Canvas：三场景天空 + 浮空岛塔 + 移动岛 + 特效
src/ui/{index,screens,hud,tutorial}.js
src/vendor/pipysdk.js     vendored SDK（同款，appId 已改）
src/main.js               装配：固定步长/输入/状态机/SDK/BGM/window.__ll
tests/sim.test.mjs        19 条纯逻辑测试
tools/selfplay.mjs        3 策略无头自玩 → tools/fun/autoplay.json
tools/audio-check.mjs     WebAudio PCM 离线校验 → tools/audio/audio-report.json
tools/verify.plan.json    配置驱动浏览器验收（含 mobile + fps）
tools/make-final.mjs      生成 tests/final/*.png 视觉评审截图
docs/{analysis,report}.md · docs/short.txt · docs/long.md
```

## 2) 门禁输出摘要（全部 ≥WARN / 通过）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ | 19 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(h=19,seg=6,dead=1) random(dead=1) noinput(dur=150s) |
| `node tools/audio-check.mjs` | ✅ | 18/18 passed，allPass=true |
| `fun-audit.mjs --root .` | ✅ | **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `fun-report.mjs --root .` | ✅ | **PASS**（10 pass / 0 warn / 0 fail） |
| `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ | pass=true，23 checks 全 ok，fps=60（avgFrameMs 16.7） |
| `i18n-check.mjs --root .` | ✅ | en/zh 各 52 key，0 missing 0 empty |
| `tutorial-check.mjs --root .` | ✅ | visible/active/steps≥3/skip/persisted/replay 全 true |
| `sdk-check.mjs --root .` | ✅ | SDK 对象/API 齐全/降级/0 错误全 ✓ |
| `vision-review.mjs --root .` | ⚠️ **WARN** | readable 7.8 / silhouette 6.9 / style 9.0，0 critical |

`vision-review` 结论 WARN（非 FAIL）：8 张玩法截图 0 critical（无目标不可见、无 HUD 遮挡、无文字裁切、移动端安全），均分 readable 7.8 落在 PASS 门槛 8.0 的容差带内（`readable < 8.0` 判定 WARN）。这是唯一 WARN 项。

## 3) 截图路径

- 标题：`tests/final/01-title.png`（en）、`tests/final/02-title-zh.png`（zh）
- 玩法：`tests/final/04-play.png`、`tests/final/07-storm.png`（雷雨层）
- 特殊状态：`tests/final/05-wind.png`（风切）、`tests/final/06-cloudwrap.png`（彩云缠绕签名）
- 教程：`tests/final/03-tutorial.png`、`tests/final/tutorial-{first,after-skip,replay}.png`
- 移动端（844×390）：`tests/final/08-mobile-play.png`
- 功能证据（暂停/结算）：`tests/artifacts/05-paused.png`、`tests/artifacts/06-dead.png`

## 4) 未做项

- 未接广告账号（`ads.enabled=false`，符合未接账号策略；SDK 降级/关闭路径已全绿）。
- 未做 ja/ko/ar/ru（按铁律整块不暴露，只做 en/zh）。
- 未做排行榜/皮肤/每日任务/剧情（design.json antiScope 明确排除）。
- 未 git commit、未起常驻服务器（按约束）。
- game.gif / poster.jpg / SEO.txt 属上线物料，见 `docs/short.txt` + `docs/long.md`（Lead 负责上传）。

## 5) 最不满意的一处

**视觉评审的 readable 停在 7.8（WARN）而非 PASS**：程序化 Canvas 的 HUD 字号在 1280×720 下偏小（HEIGHT/WIDTH/PERFECT 标签 + `Dawn Clouds` 场景名与浅金天空对比度不足），视觉模型多次点出「左上角 HUD 数值字体偏小、弱光难辨」「场景标签与背景光晕融合」。已通过加粗场景名描边/加深配色、加粗落点引导线、标题屏顶对齐+缩短示例塔修复到 0 critical，但 readable 仍差 0.2 分到 PASS 门槛。若要冲 PASS，下一步应把 HUD 标签从 0.78rem 提到 ~0.92rem、给场景名加不透明底条。
