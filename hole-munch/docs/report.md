# HOLE MUNCH · 交付报告

> 改造自 黑洞大作战（Cocos Creator 3D demo），原创午夜黑洞主题。单 agent 端到端，全门禁自跑自证。
> 分析源见 `docs/analysis.md`（含 demo 事实 `文件:行号` 与改造映射）。

## 1. 文件清单

```
games/hole-munch/
├─ index.html  styles.css  package.json  .gitignore
├─ game.gif（480×270·45帧·~199KB）  poster.jpg（1280×720）
├─ config/
│  ├─ game.config.js（世界/步长/语言/存档键）
│  ├─ gameplay.js（黑洞/移动/吸入/物体/引力连锁/陨石/比赛/升级 全部数值）
│  ├─ levels.js（12 场推进 + 3 场景包）
│  ├─ locales.js（en/zh 各 59 key，完整）
│  ├─ sdk.config.js（appId=pipy-hole-munch）
│  └─ design.json（fun-audit 设计源，100 分）
├─ docs/  analysis.md  short  long.md  report.md
├─ src/
│  ├─ core/  i18n.js  sdk.js  audio.js（程序化 WebAudio：15 SFX + 4 循环层）
│  ├─ game/  rng.js  sim.js（纯逻辑：吞物/大洞吞小洞/AI/引力连锁/陨石雨/名次赛）
│  ├─ render/  index.js  theme.js  particles.js（三场景包 + 黑洞漩涡 + 吞楼震屏）
│  ├─ ui/  index.js  screens.js  hud.js  tutorial.js
│  ├─ vendor/  pipysdk.js（vendored SDK）
│  └─ main.js（固定步长/输入/状态机/window.__ll/boot 守卫）
├─ tests/  sim.test.mjs（21 条纯逻辑测试）  final/（截图+评审报告）
└─ tools/  selfplay.mjs  audio-check.mjs  verify.plan.json
           record-gif.mjs  shots-final.mjs  make-poster.mjs  fun/  audio/
```

## 2. 全套门禁输出摘要（全部 PASS）

| # | 门禁 | 退出码 | 摘要 |
| --- | --- | --- | --- |
| 1 | `node --test` | 0 | 21 pass / 0 fail（纯逻辑：吞物加面积/大洞吞小洞/引力连锁/陨石雨/名次/升级/死亡） |
| 2 | `node tools/selfplay.mjs` | 0 | 3 策略：greedy 到场 3（lv=3, dead=0）、random（dead=3）、noinput（dead=9） |
| 3 | `fun-report.mjs` | 0 | **PASS** 10 pass / 0 warn / 0 fail（首胜 1s、推进率 100%、事件间隔 1s、死亡存在 67%） |
| 4 | `fun-audit.mjs` | 0 | **PASS** 100/100（26 pass；12 关新元素、10 升级 7 rule=70%、3 重玩钩子） |
| 5 | `verify-game.mjs --plan tools/verify.plan.json` | 0 | 桌面 20 断言 + 移动端 3 断言全过；0 console/page error；0 失败请求 |
| 6 | `i18n-check.mjs` | 0 | en/zh 各 59 key，0 missing，0 空值 |
| 7 | `tutorial-check.mjs` | 0 | 引导 3 步（steer/swallow/chain）、可跳过、刷新不重弹、可重看 |
| 8 | `sdk-check.mjs` | 0 | SDK 对象/快捷 API/激励视频降级/埋点/存档/分享/断网降级全过 |
| 9 | `tools/audio-check.mjs` | 0 | 19/19（15 SFX + 4 循环层）RMS>0、peak<0.95、无 NaN |
| 10 | `vision-review.mjs` | 0 | **PASS** 5 张：readable 8.2 / silhouette 6.8 / style 8.4，0 critical |

> 说明：`tutorial-check` 实际以 `--out tests/artifacts` 跑，避免其引导覆盖层截图混入 `tests/final`（视觉评审只审玩法/标题/结算五张）。

## 3. 截图路径（tests/final/）

| 用途 | 路径 |
| --- | --- |
| 标题屏（英文） | `tests/final/01-title.png` |
| 玩法（吞食中） | `tests/final/02-play.png` |
| 结算（夺冠 + 场间三选一） | `tests/final/03-result.png` |
| 移动端玩法（844×390） | `tests/final/04-mobile-play.png` |
| 标题屏（中文） | `tests/final/05-title-zh.png` |

另有 verify 过程截图 `tests/artifacts/v01…v08`（含引导/暂停/结算/移动端）。

## 4. 上线物料

- `game.gif`：480×270、45 帧（约 4.5s@10fps）、~199KB，前 3 秒即出现「黑洞追吃→变大」核心动词与目标。
- `poster.jpg`：1280×720（真实玩法帧 + HTML 叠发光标题/tagline）。
- `docs/short`（≤160 字符英文）+ `docs/long.md`（英文为主 + 中文段落 + 操作说明）。

## 5. 未做项

1. 未接线上 SDK / 广告：`sdk.config.js` 保持 `source:'local'`、`ads.enabled:false`，由 Lead 上线时切 `online` 并填后台 appId。
2. 只做 en/zh（59 key 完整）；ja/ko/ar/ru 按「整块不暴露」删除。
3. 美术全程序化 Canvas + 音频全程序化 WebAudio，未走 AI 出图/出音（符合零外部素材约束）。
4. 未起常驻服务器、未 git commit（按要求）。

## 6. 最不满意的一处

视觉评审前两轮 FAIL 逼我把 HUD 从「四角悬浮」改成「上下两条不透明底条」并把世界边界 margin 从 40 抬到 72，才让「目标可见/无 HUD 遮挡」稳定通过。代价是 1280×720 的吞食场地四周各牺牲了约 32px 的可用空间——在 844×390 移动端尤其明显，可吞物更贴向中带，边缘少了扫街的松弛感。若再做一轮，我会把 HUD 做成「画布内嵌上下留边」的固定安全区，而不是事后用 margin 兜底。
