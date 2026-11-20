# SKY DROP DODGE — 交付报告

> 改造自《躲避高空抛物》（Cocos Creator 2.4.6）。玩法 1:1 还原，角色/场景/音乐全原创。
> 全套门禁本地自跑，全部 ≥WARN（其中 fun-audit / fun-report / verify / i18n / tutorial / sdk / audio 全 PASS，vision-review WARN）。

## 1) 文件清单

```
games/sky-drop-dodge/
├─ index.html / styles.css         入口 + 全宽实心顶栏 HUD / 响应式 / 竖屏提示
├─ package.json                    {"type":"module"}
├─ game.gif                        480×270 / 4.5s / 422KB（真实玩法录制）
├─ poster.jpg                      1280×720（玩法图 + 发光大标题/tagline）
├─ config/
│  ├─ game.config.js               世界/步长/语言/存档键
│  ├─ gameplay.js                  玩家/能量伞/风带/涟漪/掉落物数值
│  ├─ levels.js                    12 波 + 3 场景
│  ├─ locales.js                   en + zh（各 56 key）
│  ├─ sdk.config.js                appId=pipy-sky-drop-dodge
│  └─ design.json                  机器可读设计源（fun-audit 100/100）
├─ src/
│  ├─ core/  i18n.js / save.js / sdk.js / audio.js（程序化 WebAudio 15 SFX + 2 loop）
│  ├─ game/  rng.js / sim.js / spawner.js（纯逻辑）
│  ├─ render/ theme.js / scene.js / objects.js / player.js / particles.js / index.js
│  ├─ ui/    index.js / screens.js / hud.js / tutorial.js
│  ├─ main.js                      装配 / 固定步长 60Hz / 事件分发 / 状态机 / boot 守卫
│  └─ vendor/pipysdk.js            SDK vendored 副本
├─ tests/
│  ├─ sim.test.mjs                 18 条纯逻辑测试
│  └─ final/                       8 张验收截图 + vision/sdk 报告
├─ tools/
│  ├─ selfplay.mjs                 3 策略遥测 → tools/fun/autoplay.json
│  ├─ audio-check.mjs              音效离线 RMS 校验
│  ├─ verify.plan.json             浏览器验收计划
│  ├─ capture-final.mjs            生成 tests/final 截图
│  ├─ record-gif.mjs               录屏 → ffmpeg → game.gif
│  └─ make-poster.mjs              玩法图叠字 → poster.jpg
└─ docs/  analysis.md / report.md / short.md / long.md
```

## 2) 门禁输出摘要（本地自跑）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ 18/18 | sim/spawner/风带/伞格挡/涟漪/波次/通关 全过 |
| `node tools/selfplay.mjs` | ✅ 3 runs | greedy(wave=5,dead=1) random(wave=5,dead=1) noinput(wave=2,dead=1) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail；首胜 12s、空转 0%、事件间隔 1.0s、推进率 100%、死亡存在 100% |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass）；规则型升级占比 50% |
| `verify-game.mjs` | ✅ pass | 0 console/page error、0 失败请求、帧率 60fps（avg 16.66ms） |
| `i18n-check.mjs` | ✅ OK | en/zh 各 56 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 3 步真实交互；visible/skip/persisted/replayable 全 true |
| `sdk-check.mjs` | ✅ pass | SDK 对象/API 齐全；showRewarded 安全返回；断网降级通过；0 失败请求 |
| `tools/audio-check.mjs` | ✅ 17/17 | 15 SFX + 2 loop 全 RMS>0 / peak<0.95 / nan=0 |
| `vision-review.mjs` | ⚠️ WARN | readable 7.9 / silhouette 7.1 / style 8.8；0 critical、0 HUD 遮挡、0 文字裁切 |

## 3) 截图路径

- `tests/final/01-title.png` 标题（默认英文）
- `tests/final/02-play.png` 玩法（波 2 密雨）
- `tests/final/03-block.png` 举伞格挡
- `tests/final/04-ripple.png` 慢动作涟漪（signature）
- `tests/final/05-thunder.png` 雷雨场景（无人机波）
- `tests/final/06-dusk.png` 晚霞场景（重物波）
- `tests/final/07-dead.png` 结算卡
- `tests/final/08-mobile.png` 移动端 844×390
- `tests/artifacts/v01..v08` verify-game 浏览器验收过程截图

## 4) 未做项

- 未接线上广告账号（`ads.enabled=false`、`source='local'`；上线前改 `online`）。
- 未做排行榜 / 皮肤 / 每日任务（design.json antiScope 明确不做）。
- 未打包 AI 素材与音频文件——美术/音乐全程序化（符合「零运行期依赖 + zip ≤3MB + BGM 程序化」硬约束）。

## 5) 最不满意的一处

`vision-review` 的 readable 均分 7.9，卡在 WARN 线（< 8.0）。根本原因是「躲避高空坠物」的目标对视觉模型不如「收集/击破」直观——坠物需要被识别为「威胁」而不是普通背景物。已用全宽实心顶栏 HUD（与坠落走廊分离）、坠物危险描边 + 坠落速度线、地面预警「!」落点圈把 readable 从 5.9 拉到 7.9；标题屏 silhouette 5 与结算屏对比度仍有余量，是下一轮优先修的点。
