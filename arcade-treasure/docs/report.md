# ARCADE TREASURE — 交付报告

> 改造自 `H5电玩白鹭-java`（电玩城平台）。玩法规则 1:1 还原「大厅代币串玩 + 捕鱼接金币循环」的骨架，角色/场景/音乐全原创。
> 只写 `games/arcade-treasure/`；参考实现 `games/abyss-eel` 只读；未 git commit、未起常驻服务器、未碰其他游戏目录。

## 1) 文件清单

```
arcade-treasure/
├─ index.html                入口（1280×720 letterbox + loading pointer-events:none + #rotate）
├─ styles.css                霓虹街机厅 UI / HUD 不透明条 / 机台铭牌 / 响应式
├─ package.json              {"type":"module"}
├─ SEO.txt                   5 关键词（TITLE/CATEGORY/TAGS/SHORT/LONG，中英）
├─ poster.jpg                1280×720 封面（玩法截图 + 发光标题）
├─ game.gif                  480×270 / 4.58s / 300KB 真实玩法录屏
├─ config/
│  ├─ game.config.js         世界/步长/语言/存档键
│  ├─ gameplay.js            代币经济 + 三台机台 + 12 段目标（config-first）
│  ├─ levels.js              12 段推进结构
│  ├─ locales.js             en/zh（67 key 全对齐）
│  ├─ sdk.config.js          appId pipy-arcade-treasure
│  └─ design.json            机器可读设计源（fun-audit 100 分）
├─ src/
│  ├─ main.js                装配 / 固定步长 / 事件分发 / 状态机 / __ll 契约 / boot 守卫
│  ├─ core/{i18n,save,sdk,audio}.js
│  ├─ game/{rng,sim}.js      纯逻辑（大厅 + 3 机台 + 代币/热度/段位）
│  ├─ render/{index,theme}.js 大厅 + 三场景包（暗绿机房/蓝灰雨夜/紫黑像素）
│  ├─ ui/{index,screens,hud,tutorial}.js
│  └─ vendor/pipysdk.js      runtimeConfigUrl/appConfigUrl 置空（本地验收）
├─ tests/sim.test.mjs        18 条纯逻辑测试
├─ tests/final/              6 张 vision-review 截图 + sdk/vision 报告
├─ tools/
│  ├─ selfplay.mjs           3 策略 bot 遥测
│  ├─ audio-check.mjs        RMS 校验
│  ├─ verify.plan.json       verify-game 计划（checks.external=false）
│  ├─ finalshots.mjs         tests/final 截图
│  ├─ record-gif.mjs         game.gif 录制
│  └─ poster.mjs             poster.jpg 生成
└─ docs/{analysis,short,long,report}.md
```

## 2) 门禁输出摘要（全部自己跑过）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 18 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(rank=3,idle=0s) random(dead=1) noinput(dead=1) |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首输入 0s、首胜 0s、空转 0%、事件间隔 0.8s、事件 16 种、推进率 100%、死亡 67%） |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ PASS | 全步骤 true；0 console/page error、0 失败请求、0 外部请求、fps 59.9 |
| `i18n-check.mjs` | ✅ OK | en 67 / zh 67，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 3 步（pick/hit/score）、可跳过、持久化、可重看 |
| `sdk-check.mjs` | ✅ PASS | SDK 对象/快捷 API/降级/埋点/存档/分享全过 |
| `tools/audio-check.mjs` | ✅ | 22/22（20 音效 + 2 循环层，RMS>0、峰值<0.95、无 NaN） |
| `vision-review.mjs` | ✅ WARN | readable 7.2 / silhouette 6.5 / style 8.7，0 critical（≥WARN 达标） |

（`tutorial-check` 截图按经验写进 `tests/artifacts`，避免污染 `tests/final` 的 vision-review 前 8 张；报告 JSON 仍在。）

## 3) 截图路径

- 标题：`tests/artifacts/v01-title.png`、`tests/artifacts/v02-title-zh.png`
- 玩法：`tests/final/01-hall.png`（大厅）、`02-mole.png`（机房守夜）、`03-rain.png`（雨中拾荒）、`04-swarm.png`（像素蜂群）、`05-grandprix.png`（GRAND PRIX 亮灯签名）
- 暂停/结算：`tests/artifacts/v05-paused.png`、`v06-result.png`
- 移动端：`tests/final/06-mobile.png`、`tests/artifacts/v07-mobile.png`

## 4) 未做项

- 未接广告账号（`ads.enabled=false`，sdk-check 已验证安全降级）。
- 未做 ja/ko/ar/ru（整块不暴露，仅 en/zh）。
- 未打包 AI 素材（美术全程序化 Canvas，BGM/SFX 全 WebAudio 程序化合成，zip 内无音频/图片文件）。
- 未做排行榜/每日挑战/皮肤（spec 反范围）。

## 5) 最不满意的一处

**大厅机台铭牌与画布机台元素的重叠**：第一版把三台机台的名字/副标题做成 DOM 标签贴在透明按钮内部，视觉模型在 `05-grandprix` 判了 `text_clipped`（文字与画布的投币口/热度灯重叠），导致 vision-review 一度 FAIL。改成「底部独立不透明铭牌条 + 纯透明点击区」后降到 WARN。根因是画布与 DOM 各画一套、定位靠百分比换算，两个坐标系的边缘没对齐；下次应让机台身份文案直接进画布绘制，DOM 只保留点击热区，彻底消除两层错位。
