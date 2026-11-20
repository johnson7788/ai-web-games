# CONSTELLATION LINE · 交付报告

> 改造自 Cocos「一笔画」→ 原创星座连线（欧拉路径）。全部门禁自跑通过。

## 1) 文件清单

```
index.html / styles.css            入口与星空玻璃拟态 UI
config/game.config.js              世界尺寸 / 步长 / 语言 / 存档键
config/gameplay.js                 计分 / 输入命中 / 流星 / 反馈密度
config/levels.js                   24 关星座库（4 边型 × 3 场景包 × 12 星座）
config/locales.js                  en + zh（44 key 对齐）
config/sdk.config.js               SDK 唯一配置（appId pipy-constellation-line）
config/design.json                 机器可读设计源（fun-audit 100 分）
src/game/euler.js                  欧拉路径纯逻辑（度数/分量/存在性/Hierholzer）
src/game/sim.js                    模拟核心（走边/走错重置段/过关/失败/流星/双星图）
src/game/rng.js                    mulberry32 可复现随机
src/render/index.js                Canvas 星空渲染 + 点亮动画 + 粒子
src/render/theme.js                3 场景包（春夜/夏银河/极光冬）
src/ui/{index,screens,hud,tutorial}.js   UI 装配 / 屏 / HUD / 首次引导
src/core/{i18n,sdk,audio}.js       i18n / SDK 唯一出口 / 程序化音频
src/vendor/pipysdk.js              vendored SDK
tests/{euler,sim}.test.mjs         70 条纯逻辑测试
tools/selfplay.mjs                 3 策略遥测（greedy Hierholzer/random/noinput）
tools/audio-check.mjs              音频 RMS/峰值/NaN 离线校验
tools/verify.plan.json             浏览器验收计划
tools/record-gif.mjs               game.gif 录制（截图→ffmpeg）
tools/record-poster.mjs            poster.jpg 生成
docs/{analysis,short,long,report}.md  源码分析 / SEO / 报告
game.gif                          480×270 · 4.5s · 689KB
poster.jpg                        1280×720
```

## 2) 门禁输出摘要（全部通过）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 70 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 过 24 关（lvl=24, dead=0, dur=11.5s, 12 事件种）；random/noinput 各 timeout 死亡 |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail；空转 1%、最大事件间隔 0.08s、推进率 100%） |
| `fun-audit.mjs` | **PASS** 100/100（26 pass） |
| `verify-game.mjs` | **pass:true**，fps 59.9，0 console/page error，0 失败请求，8 截图 |
| `i18n-check.mjs` | **OK**（en 44 / zh 44，0 missing / 0 empty） |
| `tutorial-check.mjs` | **PASS**（visible/active/steps=3/skip/persisted/replayable 全真） |
| `sdk-check.mjs` | **pass:true**（SDK 就绪/广告降级/埋点/存档/分享/断网降级 全 ✓） |
| `tools/audio-check.mjs` | **16/16 passed**（RMS>0、peak<0.95、nan=0） |
| `vision-review.mjs` | **PASS**（readable 9.0 / silhouette 7.3 / style 9.8；0 critical） |

证据文件：`tests/final/{verify-report,sdk-report,vision-review}.json`、`tools/fun/{design-audit,fun-report}.json`、`tools/audio/audio-report.json`。

## 3) 截图路径

桌面 1280×720（`tests/final/`）：

- `g8-title.png` 标题屏
- `g1-play.png` / `g2-play-late.png` 玩法（连线推进）
- `g3-meteor.png` 流星干扰关
- `g4-dual.png` 双星图切笔
- `g5-waypoint.png` 必经北极星
- `g6-win.png` 过关结算卡

移动端 844×390（`tests/final/g7-mobile.png`）；引导截图在 `tests/artifacts/tutorial-*.png`。

## 4) 未做项

- 未用 AI 生成素材：本作美术全程序化 Canvas、音频全 WebAudio 合成，符合「美术全程序化 Canvas」约束，故无 `assets/`、未跑 `asset-check`（brief §3 门禁清单亦不含）。
- 未做 ja/ko/ar/ru：按约束「其他语言整块不暴露」，仅 en/zh 完整暴露。
- 未接广告账号：`ads.enabled=false`（无广告 UI，`showRewarded` 安全返回 false）。
- 未做 SEO.txt（brief §4 只要求 docs/short.md + long.md，二者已交付）。

## 5) 最不满意的一处

早期「开路」关卡由简单折线链生成（每个节点度 ≤2，无岔口），导致前几关没有真正的「选边」决定，
决策密度要等到 waypoint（环+弦）/双星图/流星关才上来。下次应让早期开路段也加入 1–2 条弦制造岔口，
让「教-练-变-收」里的「练」更早出现真实取舍，而不是纯链式描边。
