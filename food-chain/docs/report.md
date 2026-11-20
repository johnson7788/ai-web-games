# FOOD CHAIN — 交付报告

> 改造自「顶级食物链」（Cocos Creator 拖卡配对教育小游戏），按 `spec-food-chain.md` 重诠释为**深海食物网的体型进化吞噬** arcade。
> 源码分析见 `docs/analysis.md`。所有门禁自己跑、全绿（vision-review ≥WARN）。

## 1) 文件清单

```
games/food-chain/
├─ index.html              入口（1280×720 letterbox + boot 守卫 + loading 不拦截点击）
├─ styles.css              玻璃拟态 UI / HUD / 教程覆盖层 / 竖屏提示 / 移动端媒体查询
├─ package.json            {"type":"module"}
├─ game.gif                480×270 玩法录制（~1.1MB）
├─ poster.jpg              1280×720 玩法图 + 叠大标题
├─ config/
│  ├─ game.config.js       世界/步长/语言/存档键
│  ├─ gameplay.js          全部玩法数值（玩家/食物/鱼/毒刺/共生/暗流/得分）
│  ├─ stages.js            12 阶段推进结构 + 三场景包生态
│  ├─ design.json          机器可读设计源（fun-audit）
│  ├─ locales.js           en/zh 各 55 key（完整、无半成品语言）
│  └─ sdk.config.js        appId=pipy-food-chain
├─ src/
│  ├─ core/                i18n / save / sdk（唯一存档埋点出口）/ audio（程序化 BGM+SFX）
│  ├─ game/                rng / spawner / sim（纯逻辑，零 DOM）
│  ├─ render/              index（程序化发光渲染）+ theme（三场景色板）
│  ├─ ui/                  index / screens / hud / tutorial（4 步首次引导）
│  ├─ vendor/pipysdk.js    SDK 本地副本
│  └─ main.js              装配 / 固定步长 / 事件分发 / 状态机 / __ll 契约
├─ docs/                   analysis.md / report.md / short.txt / long.md
├─ tests/                  sim / stages / tutorial 纯逻辑测试（26 条）
│  └─ final/               8 张玩法截图 + vision-review / sdk 报告
└─ tools/                  selfplay / audio-check / verify.plan / make-final / make-poster / record-gif
```

## 2) 门禁输出摘要（全部 ≥WARN，关键 PASS）

| 门禁 | 结果 | 关键证据 |
| --- | --- | --- |
| `node --test` | ✅ PASS | 26 tests / 0 fail（sim 12 + stages 8 + tutorial 5，含吞噬/致死/共生/毒刺/进化/胜利） |
| `tools/selfplay.mjs` | ✅ PASS | greedy stage=3/mass=158（levelsReached=4）、random/noinput 均死（deathPresence=100%） |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail；动词 3、决定 7、12 关、规则升级 78%） |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail（首胜 20s、空转 0%、事件间隔 1.0s、事件种类 8、推进 100%） |
| `verify-game.mjs` | ✅ PASS | 全部断言过、0 console/page error、0 失败请求、fps 60 |
| `i18n-check.mjs` | ✅ PASS | en/zh 各 55 key、0 missing、0 empty |
| `tutorial-check.mjs` | ✅ PASS | 4 步、可跳过、可重看、持久化（move/food/prey/avoid） |
| `sdk-check.mjs` | ✅ PASS | SDK 对象存在、API 齐全、降级可玩、0 错误 |
| `tools/audio-check.mjs` | ✅ PASS | 19/19（17 SFX + water/bgm 循环层）RMS>0、peak<0.95、无 NaN |
| `vision-review.mjs` | ⚠️ WARN | readable 7.9 / silhouette 7.6 / style 9.0；无 critical、无低分项（WARN 因 readable 差 0.1 未到 PASS） |

## 3) 截图路径（`tests/final/`）

- 标题：`01-title.png`
- 玩法（光合带，玩家+浮游+鱼）：`02-play.png`
- 换章·中层带（深蓝）：`03-twilight.png`
- 换章·热泉带（暗红+暗流）：`04-vent.png`
- 特殊状态·护体毒刺：`05-sting.png`
- 签名瞬间·光链进化：`06-chain.png`
- 首次引导：`07-tutorial.png`
- 移动端（844×390）：`08-mobile.png`

（暂停/结算等纯菜单证据留在 `tests/artifacts/v0*.png`，不混入 vision-review。）

## 4) 未做项

- 广告未接账号（`ads.enabled=false`），SDK 用 `source:'local'` 本地副本；上线前改 `config/sdk.config.js`。
- 未做 ja/ko/ar/ru（只 en/zh，整块不暴露，i18n-check 0 missing）。
- 反范围（design.json）：不做联网排行榜、皮肤商店、每日任务、剧情、竖屏专属模式。
- 美术全程序化（符合 spec「美术全程序化 Canvas」），未走 AI 出图管线。
- `game.gif` / `poster.jpg` 已生成，上传由 Lead 负责。

## 5) 最不满意的一处

vision-review 停在 **WARN 而非 PASS**：标题屏与教程屏两张带玻璃遮罩的图 silhouette 被判 6（纯菜单/遮罩天然拉低剪影），且玩家在 stage 0 体型太小，移动端一眼难认出主角——已加「常驻白色标识环」缓解到 silhouette 7.6，但 readable 均分 7.9 仍差 0.1 未到 PASS。若再迭代，优先把标题屏改为「游戏实景 + 大字」的单一构图，并把移动端开局体型/镜头再放大一档。
