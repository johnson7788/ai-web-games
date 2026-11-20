# GUN LEGEND · 交付报告

> slug `gun-legend` · title `GUN LEGEND` · appId `pipy-gun-legend` · 2026-11-20
> 改造自 Cocos 源码《枪神之神》（弹道反射解谜射击）→ 港片巷战双枪清关。源码分析见 `docs/analysis.md`。

## 1. 文件清单

```
index.html           1280×720 letterbox + canvas + ui-root + btn-roll + #rotate + #loading
styles.css           霓虹 UI（HUD 不透明条 / 移动端 844×390 紧凑 / 竖屏提示 / reduced-motion）
poster.jpg           1280×720 封面（玩法图 + 发光大标题 + tagline）
game.gif             480×270 列表页动图（真实玩法录制，前 3 秒见开火+目标）
SEO.txt              5 关键词（TITLE/CATEGORY/TAGS/SHORT/LONG，中英）
config/
  game.config.js     WORLD / STEP / 语言 / 存档键
  gameplay.js        全部数值常量 + 纯函数（clamp/comboMult/weaponById/enemyById）
  levels.js          12 场 / 3 场景包 / 武器解锁（左轮→散弹→双持冲锋）
  locales.js         en + zh（53 key 完全一致）
  design.json        趣味设计源（fun-audit PASS 100/100）
  sdk.config.js      SDK 唯一配置源（appId pipy-gun-legend）
src/
  main.js            装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM / __ll
  core/audio.js      WebAudio 程序化合成（28 SFX + 4 BGM 循环层，零音频文件）
  core/i18n.js       语言（?lang= > localStorage > en）
  core/save.js       localStorage 安全降级（本地偏好）
  core/sdk.js        门户 SDK 唯一出口（广告/埋点/存档/分享 + 降级）
  vendor/pipysdk.js  vendored SDK（runtimeConfigUrl/appConfigUrl 置空，避免外部请求）
  game/sim.js        纯逻辑模拟（双枪/换弹舞/翻滚/白鸽/波次/12 场/连杀）
  game/rng.js        mulberry32
  render/index.js    程序化 Canvas（三场景色板 + 目标「!」标记 + 白鸽 + 粒子 + 标题演示场景）
  ui/index.js        createUI 装配
  ui/screens.js      标题/暂停/结算/设置/公告
  ui/hud.js          HUD（场次/血量/得分/连杀/武器/双枪弹匣/翻滚/换弹/TARGETS）
  ui/tutorial.js     4 步交互引导（aim/fire/kill/roll）
tests/
  sim.test.mjs       24 条纯逻辑测试
  final/             8 张验收截图 + vision-review + sdk-report
tools/
  selfplay.mjs       3 策略遥测（greedy/random/noinput）→ tools/fun/autoplay.json
  audio-check.mjs    SFX/循环 RMS 离线校验
  verify.plan.json   浏览器验收计划
  shots.mjs          tests/final 截图生成
  record-gif.mjs     真实玩法录制 → ffmpeg 转 game.gif
  poster.mjs         封面生成
docs/
  analysis.md / long.md / short / report.md
```

## 2. 门禁输出摘要（全部 ≥WARN，无 FAIL）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 24/24 pass |
| `node tools/selfplay.mjs` | ✅ greedy(round6,死1,首胜1.4s) / random(round1,死) / noinput(round1,死) |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS**（100/100，26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass，0 error / 0 失败请求，60fps |
| `i18n-check.mjs` | ✅ OK（en/zh 各 53 key，0 missing / 0 empty） |
| `tutorial-check.mjs` | ✅ PASS（4 步 / 可跳过 / 持久化 / 可重看） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪 / API 齐全 / 降级不崩 / 0 error） |
| `audio-check.mjs` | ✅ 32/32 pass（RMS>0 / peak<0.95 / 无 NaN） |
| `vision-review.mjs` | ✅ **PASS**（readable 8.0 / silhouette 7.6 / style 8.9，0 critical） |

**fun-report 关键指标**（action 门槛）：首输入 0s（≤10）· 延迟 90ms（≤120）· 首胜 2s（≤60）· 成功率 100% · 操作 3570/min · 空转 1% · 事件最大间隔 1s · 事件种类 24 · 推进到第 3 场 100% · 死亡存在 100%。

**vision-review 8 张**：标题 / 玩法 / 战斗 / 白鸽时刻 / 死亡结算 / 天台场景 / 酒楼场景 / 移动端，全部 goal_visible=Y、无 HUD 遮挡、无文字裁切、移动安全。

## 3. 截图路径

- 标题：`tests/final/01-title.png`（及 `02-title-zh.png`）
- 玩法：`tests/final/02-play.png` / `03-combat.png`
- 签名时刻：`tests/final/04-dove.png`（白鸽）
- 三场景：`03-combat.png`（雨巷）/ `06-rooftop.png`（天台）/ `07-restaurant.png`（酒楼）
- 结算：`tests/final/05-dead.png`
- 移动端：`tests/final/08-mobile-play.png`
- 封面：`poster.jpg` · 动图：`game.gif`

## 4. 未做项

- 联网/排行榜、皮肤商店、每日任务、剧情对话、竖屏专属模式（反范围声明，非遗漏）。
- 广告账号未接入：`sdk.config.js` 的 `ads.enabled: false`（未接账号保持关闭，符合 brief）。
- 平台上传由 Lead 负责（本报告只交付物料与本地全绿证据）。

## 5. 最不满意的一处

**标题屏的 silhouette 偏低**：标题屏虽然加了程序化演示场景做背景，但 `.screen` 的 `backdrop-filter` + 高不透明度玻璃层把背后的玩家/敌人剪影几乎盖没，vision-review 对标题截图打了 silhouette≈3–5。其余 7 张剪影都在 7–9。理想做法是给标题屏一张不透明的「英雄剪影」底图（或把玻璃层改成渐变透明、让演示场景更亮），而不是依赖被模糊的 canvas 背景。
