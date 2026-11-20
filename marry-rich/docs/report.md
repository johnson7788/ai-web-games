# MARRY RICH · 交付报告

> 规格：`docs/remake-all/games/spec-marry-rich.md` · 参考实现 `games/abyss-eel`（只读） · 源码分析见 `docs/analysis.md`。
> 玩法：小镇姑娘逆袭记——12 个人生节点，三属性（能力/人脉/存款）互相牵制，关键抉择限时 5s（人生天平倾斜），8 结局 + 记忆碎片「如果当初」。

## 1) 文件清单

```
config/design.json        机器可读设计源（fun-audit 100 分）
config/game.config.js     世界尺寸 / 步长 / 语言
config/gameplay.js        属性 / flag / 限时 / reveal 数值
config/story.js           剧情图：18 个具体节点（12 章，三弧线）
config/endings.js         8 结局判定
config/locales.js         en/zh UI 文案（43 key × 2）
config/sdk.config.js      appId=pipy-marry-rich
src/main.js               装配 / 固定步长 / 屏幕状态机 / __ll 契约
src/game/sim.js           纯逻辑剧情 sim（createRun/step/getHud/drainEvents）
src/game/rng.js           mulberry32 确定性随机
src/render/scene.js       三场景包程序化 Canvas + 主角剪影
src/render/index.js       渲染装配 + 人生天平签名动画
src/ui/screens.js         标题/玩法/暂停/结局/记忆碎片 DOM
src/ui/hud.js             三属性条 + 好感度 + 章节 + 倒计时
src/ui/tutorial.js        3 步交互引导状态机 + 覆盖层
src/ui/index.js           createUI 装配
src/core/{i18n,save,sdk,audio}.js   语言/存档/SDK 出口/程序化音频
src/vendor/pipysdk.js     vendored SDK（runtimeConfigUrl/appConfigUrl 已置空）
index.html / styles.css   入口 + 金紫玻璃拟态样式（#loading pointer-events:none）
tests/sim.test.mjs        15 条纯逻辑测试
tests/story.test.mjs      剧情图/8 结局可达/文案完整性测试（共 30 条 node --test）
tools/selfplay.mjs        3 策略 bot 遥测
tools/audio-check.mjs     音频离线校验
tools/verify.plan.json    浏览器验收计划
tools/record-gif.mjs      gif 录制 → ffmpeg
tools/poster.mjs          海报生成
game.gif / poster.jpg     上线物料
docs/{analysis,short,long,report}.md
```

## 2) 门禁输出摘要（全套自跑，全绿）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **30 pass / 0 fail**（≥15 达标） |
| `node tools/selfplay.mjs` | 3 策略：greedy(ch12→corp_peak, done) / random(ch12→startup_ipo, done) / noinput(ch1 停住基线) |
| `fun-report.mjs --root .` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs --root .` | **PASS** · 100/100（26 pass） |
| `verify-game.mjs --plan tools/verify.plan.json` | **pass=true** · 23 checks · fps=60 |
| `i18n-check.mjs --root .` | **OK**（en/zh 各 43 key，0 missing / 0 empty） |
| `tutorial-check.mjs --root .` | **PASS**（3 步 / 可跳过 / 可重看 / 持久化） |
| `sdk-check.mjs --root .` | **pass=true**（SDK 就绪/降级/广告/埋点/存档/分享/断网） |
| `tools/audio-check.mjs` | **14/14 passed**（11 SFX + 3 BGM 循环，RMS>0 峰值<0.95 无 NaN） |
| `vision-review.mjs --root .` | **PASS** · readable 8.6 / silhouette 7.1 / style 8.9 |

**Fun Gate 关键遥测（narrative 门槛）**：首输入 1s（≤12）· 延迟 90ms（≤120）· 首胜 1s（≤90）· 操作 59/min（≥20）· 空转 2%（≤30）· 事件间隔 0.0s（≤5）· 事件种类 11（≥6）· 推进到第 3 章 100%（≥50）。

## 3) 截图路径（tests/final/）

- 标题（英）`01-title.png` / 标题（中）`02-title-zh.png`
- 首次引导 `03-tutorial.png`
- 玩法（抉择）`04-play.png` / 结果卡 `05-result.png`
- 暂停 `06-paused.png` / 结局 `07-ending.png`
- 移动端 844×390 玩法 `08-mobile-play.png`
- 引导三态 `tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`

物料：`game.gif`（480×270 · 4.54s · 842KB）、`poster.jpg`（1280×720）。

## 4) 未做项

- 未接广告账号（`sdk.config.js ads.enabled=false`，按未接账号保持关闭；广告出口代码齐备，`showRewarded` 安全返回 false）。
- 未做 ja/ko/ar/ru（本作只暴露 en/zh，避免半成品语言）。
- 未做 AI 出图/配音（美术为程序化 Canvas + 程序化 WebAudio，符合本执行单零运行期依赖、zip ≤3MB 约束）。
- 未做「真人试玩」数据（`--human` 为可选证据，非门禁）。
- 未上传发布（Lead 负责；本单只交付三样上线物料 + SEO）。

## 5) 最不满意的一处

**silhouette 曾三连 FAIL，靠「把玩法屏玻璃罩改成透明 + 加亮放大主角剪影」才压线过（最终 7.1）。** 剧情类游戏没有「玩家/敌人/子弹」这种天然剪影素材，视觉模型的 silhouette rubric 对纯文字+卡片构图不友好——第一版把 `.screen` 的暗色玻璃罩铺满整屏，主角剪影被 `backdrop-filter` 糊成一团，模型反复判「背景人物剪影过暗且模糊」。教训：**叙事类游戏的 Canvas 主角必须放大、加亮、置于不受玻璃罩遮挡的留白处，且玩法屏不能用全屏暗色磨砂玻璃**。这也是本作最值得写进 playbook 的复盘点。
