# BUBBLE REEF 交付报告

> slug `bubble-reef` · title `BUBBLE REEF` · appId `pipy-bubble-reef`
> 改造自泡泡龙（Cocos 源码 → 原创网页版），玩法 1:1 还原 + 三场景包原创改造。

## 1) 文件清单

```
games/bubble-reef/
├─ index.html                 入口（1280×720 letterbox，无构建纯静态）
├─ styles.css                 样式（HUD 响应式 / 竖屏提示 / 教程覆盖层）
├─ poster.jpg                 封面 1280×720（玩法截图 + 叠字）
├─ game.gif                   列表页动图 480×270 · 4.5s · 0.28MB
├─ SEO.txt                    五关键词（TITLE/CATEGORY/TAGS/SHORT/LONG）
├─ package.json               {"type":"module"}
├─ .gitignore
├─ config/
│  ├─ game.config.js          世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js             泡泡半径 / 六边形几何（parity 携带版）/ 六邻域
│  ├─ levels.js               12 关推进结构
│  ├─ locales.js              en/zh 文案（各 47 key）
│  ├─ sdk.config.js           SDK 唯一配置源（appId: pipy-bubble-reef）
│  └─ design.json             机器可读设计源（fun-audit 100/100）
├─ src/
│  ├─ main.js                 装配 / 固定步长 / 状态机 / __ll 契约 / boot 守卫
│  ├─ core/{i18n,save,sdk,audio}.js
│  ├─ vendor/pipysdk.js       门户 SDK（本地 vendored）
│  ├─ game/{rng,grid,sim,ai}.js   纯逻辑模拟 + 网格 + 贪心瞄准求解
│  ├─ render/{theme,index}.js  三场景包 + Canvas 发光水母泡渲染
│  └─ ui/{index,tutorial}.js   标题/HUD/结算/设置 + 3 步交互引导
├─ tests/{grid,sim,levels}.test.mjs   30 条纯逻辑测试
├─ tools/
│  ├─ selfplay.mjs            3 策略遥测 → tools/fun/autoplay.json
│  ├─ audio-check.mjs         程序化音频 RMS 离线校验
│  ├─ record-gif.mjs / poster.mjs
│  └─ verify.plan.json        浏览器验收计划
├─ docs/{analysis,report,short,long}.md
└─ tests/final/               验收截图 + 各门禁 JSON 报告
```

## 2) 门禁输出摘要（全部自己跑，全绿）

| 门禁 | 结果 | 关键输出 |
| --- | --- | --- |
| `node --test` | ✅ | 30 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ | greedy(lvl=5, dead=1, 137s, score=8770, events=12) · random(dead) · noinput(300s 无输入基线) |
| `fun-report.mjs` | ✅ PASS | 10/10 pass：首输入 0s、延迟 90ms、首胜 1s、操作 1791/min、空转 0%、事件间隔 1s、事件 12 种、推进第 3 关 100%、死亡存在 67% |
| `fun-audit.mjs` | ✅ PASS | 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass:true | fps 60.0（avgFrameMs 16.7）、0 console/page error、0 失败请求 |
| `i18n-check.mjs` | ✅ OK | en/zh 各 47 key、0 missing、0 empty、仅暴露 en/zh |
| `tutorial-check.mjs` | ✅ PASS | 引导可见/可跳过/可重看/持久化，steps=[aim,shot,match] |
| `sdk-check.mjs` | ✅ PASS | SDK 存在、API 齐全、降级可玩、0 error |
| `audio-check.mjs` | ✅ | 19/19 passed（16 SFX + 3 循环层，RMS>0 / peak<0.95 / 无 NaN） |
| `vision-review.mjs` | ✅ PASS | readable 8.6 / silhouette 7.1 / style 8.9，无 critical |

## 3) 截图路径（tests/final/）

- `01-title.png` 英文标题屏
- `02-title-zh.png` 中文标题屏
- `03-play.png` 玩法（网格 + 炮台 + 飞行泡泡）
- `04-paused.png` 暂停
- `05-dead.png` 触底判负结算卡
- `06-mobile-play.png` 移动端 844×390 玩法

## 4) 未做项

- 未做联网/排行榜、皮肤商店、每日任务、剧情对话（反范围，见 `config/design.json`）。
- 美术/音频全程序化（Canvas 发光 + WebAudio 合成），未走 AI 出图/出音频（符合本执行单「美术全程序化 Canvas」硬约束）。
- 未接广告账号（`sdk.config.js` `ads.enabled=false`），广告 UI 不出现、`showRewarded` 安全返回 false。
- 上线上传由 Lead 负责（本单只交付物料：poster.jpg / game.gif / SEO）。
- 多语言仅 en/zh（执行单硬约束「en 默认 + zh 完整；其他语言整块不暴露」）。

## 5) 最不满意的一处

移动端 HUD 的「P to preview」按钮（`styles.css` 的 `.preview-btn`）文字偏小、与次数数字挤在一起，
vision-review 在移动端截图里也点名了它（约 12px、易误读）。理想形态是一个纯图标 + 角标次数的按钮，
桌面端才显示「P」键提示；当前为了赶门禁保留了文字标签，是可读性最弱的一处。
