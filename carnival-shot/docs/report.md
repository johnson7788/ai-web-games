# CARNIVAL SHOT — 交付报告

> 执行单：`docs/remake-all/REBUILD-BRIEF.md`（共享执行单 v2）· 规格：`docs/remake-all/games/spec-carnival-shot.md`
> 改造自 打鸭子 + 打靶游戏（源码分析见 `docs/analysis.md`，事实带 文件:行号）
> 结论：**全套门禁全绿**，可交付。

## 1. 文件清单

```
games/carnival-shot/
├─ index.html                 入口（letterbox 1280×720）
├─ styles.css                 UI / HUD / 响应式 / #rotate / #loading
├─ package.json               {"type":"module"}
├─ poster.jpg                 1280×720 海报
├─ game.gif                   480×270 · 4.5s · 622KB
├─ config/
│  ├─ game.config.js          世界尺寸 / 步长 / 语言
│  ├─ gameplay.js             全部数值常量 + 纯函数（弹匣/连击/目标/奖励/惩罚）
│  ├─ levels.js               12 关 + 三场景包（灯会/河灯/烟花夜）
│  ├─ locales.js              en + zh（61 key，0 missing/empty）
│  ├─ sdk.config.js           appId pipy-carnival-shot / 广告 / 埋点 / 存档 / 分享
│  └─ design.json             机器可读设计源（fun-audit 100/100）
├─ src/
│  ├─ core/{i18n,save,sdk,audio}.js   i18n / 存档 / SDK 唯一出口 / WebAudio 程序化音频
│  ├─ game/{rng,sim,spawner}.js       纯逻辑：固定步长 sim / 加权生成 / 确定性 PRNG
│  ├─ render/{theme,scene,targets,particles,index}.js  程序化 Canvas 渲染 + 三场景包 + 粒子/孔明灯雨
│  ├─ ui/{screens,hud,tutorial,index}.js  标题/暂停/结算/轮盘 + HUD + 3 步交互引导
│  ├─ main.js                 装配 / 固定步长 / 输入 / 事件分发 / 状态机 / __ll 契约
│  └─ vendor/pipysdk.js       站点 SDK vendored 副本
├─ tests/
│  ├─ sim.test.mjs            18 条纯逻辑测试
│  └─ spawner.test.mjs        5 条生成器测试
├─ tools/
│  ├─ selfplay.mjs            3 策略遥测（greedy/random/noinput）→ tools/fun/autoplay.json
│  ├─ audio-check.mjs         音效/循环层离线校验
│  ├─ verify.plan.json        浏览器验收计划
│  ├─ record-gif.mjs          录制玩法 → ffmpeg → game.gif
│  └─ make-poster.mjs         玩法截图 + HTML 叠字 → poster.jpg
└─ docs/
   ├─ analysis.md             源码分析（还原映射）
   ├─ report.md               本报告
   ├─ short.md                SEO 短描述（159 字符）
   └─ long.md                 SEO 长描述（中英，含操作）
```

## 2. 门禁输出摘要（全部 ≥WARN / PASS）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | **26 pass / 0 fail** |
| 自动玩测 | `node tools/selfplay.mjs` | 3 策略：greedy(12关,0死,94708分) / random(1关,1死) / noinput(1关,1死) |
| 设计审计 | `fun-audit --root .` | **PASS · 100/100（26 pass / 0 warn / 0 fail）** |
| Fun Gate | `fun-report --root .` | **PASS（10 pass / 0 warn / 0 fail）**，首输入 1s / 延迟 90ms / 空转 0% / 事件间隔 0.9s / 19 种事件 / 推进 100% / 死亡 67% |
| 浏览器验收 | `verify-game --root . --plan tools/verify.plan.json` | **pass**，fps 60（avgFrameMs 16.67），0 console/page error，0 失败请求 |
| i18n | `i18n-check --root .` | **OK**：en/zh 各 61 key，0 missing / 0 empty |
| 首次引导 | `tutorial-check --root .` | **PASS**（visible/active/3步/skip/persist/replay 全 true，0 error） |
| SDK | `sdk-check --root .` | **pass**：SDK 就绪/降级/埋点/存档/分享/断网可玩 全 ✓ |
| 音频 | `node tools/audio-check.mjs` | **22/22 passed**（19 SFX + 3 循环层，rms>0 / peak<0.95 / 无 NaN） |
| 视觉评审 | `vision-review --root .` | **PASS**：readable 8.3 / silhouette 6.9 / style 8.8，goal_visible 全 Y，无 HUD 遮挡/文字裁切/移动端不安全 |

`fun-report` 逐条记录：

| run | 策略 | 时长 | 首输入 | 延迟 | 首胜 | 行动/分 | 空转 | 最大间隔 | 事件种类 | 关卡 | 死亡 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| greedy-123 | greedy | 356s | 1s | 90ms | 1s | 3600 | 0% | 0.9s | 19 | 12 | 0 |
| random-456 | random | 35s | 0s | 90ms | 33s | 2499 | 31% | 1.0s | 13 | 1 | 1 |
| noinput-789 | noinput | 30s | — | 90ms | — | 2 | 98% | 1.0s | 3 | 1 | 1 |

## 3. 截图路径

`tests/final/`（vision-review 前 8 张全部为真实运行截图，非设计稿）：

| 文件 | 内容 |
| --- | --- |
| `01-title.png` | 标题屏（灯会场景 + 装饰目标剪影） |
| `02-play.png` | 玩法：纸鸢横飞 + HUD（分数/关卡/时间/弹药/目标进度） |
| `03-hit.png` | 命中反馈（得分 + 连击） |
| `04-combo.png` | 签名时刻：连击 ×8 孔明灯雨 |
| `05-reload.png` | 换弹进度条 + 弹药图标 |
| `06-result.png` | 结算卡 |
| `07-mobile.png` | 移动端 844×390 玩法 + 触屏换弹按钮 |
| `08-scene2.png` | 河灯场景（青蓝，第 5 关） |
| `tutorial-first/after-skip/replay.png` | 首次引导三态（tutorial-check 产出） |

线上物料：`game.gif`（480×270 · 4.5s · 622KB，前 3 秒为核心射击动词+目标）、`poster.jpg`（1280×720）。

## 4. 未做项

1. **未接广告账号**：`config/sdk.config.js` 的 `ads.enabled=false`、`source:'local'`（按执行单「未接账号保持 false」；SDK 降级/断网可玩已验）。
2. **无 AI 生成素材**：美术全程序化 Canvas、BGM 全 WebAudio 程序化分层合成（执行单允许的轻量路线，且不打包音频文件，zip 体积安全）。
3. **无联网/排行榜/每日任务/皮肤商店**（design.json antiScope）。
4. **只做 en/zh**（ja/ko/ar/ru 整块不暴露，i18n-check 0 missing）。
5. **无竖屏专属模式**（仅横屏 letterbox + 竖屏旋转提示，不挡操作）。

## 5. 最不满意的一处

红灯鸭轮盘当前是**自动揭示型小游戏**（命中后立即由 sim 掷出奖励、UI 播放 1.4s 轮盘动画），而非「玩家按键停轮」的真实交互轮盘。这样做的取舍：把「追红灯鸭」的决策点保留在「值不值得花一枪去追」上，且避免给无头 bot 与教程增加一条额外输入分支。若再迭代一轮，会把它做成「指针落下即停」的真轮盘（仍保持 sim 纯逻辑可测）。
