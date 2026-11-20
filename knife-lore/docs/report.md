# knife-lore · 交付报告

> 改造自《飞刀/飞刀大乱斗》→ 原创网页游戏 KNIFE LORE（武士道卷轴桩 + 掷手里剑）。
> 单 agent 端到端交付；只写 `games/knife-lore/`；未 git commit、未起常驻服务器、未碰其他游戏目录。

## 1. 文件清单

```
index.html / styles.css / package.json
config/    game.config.js · gameplay.js · levels.js · locales.js · design.json · sdk.config.js
src/core/  i18n.js · save.js · sdk.js · audio.js
src/game/  sim.js · rng.js
src/render/ index.js · theme.js · particles.js
src/ui/    index.js · screens.js · hud.js · tutorial.js
src/vendor/pipysdk.js
src/main.js
tests/     sim.test.mjs（22 条纯逻辑测试）
tests/final/  01-title.png · 02-play.png · 03-fail.png · 04-mobile.png
             sdk-report.json · vision-review.json/.md
tests/artifacts/  verify-report.json + 验收过程截图
tests/artifacts/tutorial/  tutorial-report.json + 过程截图（tutorial-check --out）
tools/     selfplay.mjs · verify.plan.json · audio-check.mjs · record-gif.mjs · poster.mjs
docs/      analysis.md · report.md · short · long.md
SEO.txt · poster.jpg（1280×720） · game.gif（480×270 · 4.5s）
```

## 2. 全套门禁输出摘要（全绿）

| # | 门禁 | 结果 |
| --- | --- | --- |
| 1 | `node --test` | ✅ 22 tests / 22 pass / 0 fail |
| 2 | `node tools/selfplay.mjs` | ✅ 3 策略：greedy(lvl=12,dead) random(lvl=12,dead) noinput(lvl=1) |
| 3 | `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail，genre=arcade） |
| 4 | `fun-audit.mjs --root .` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| 5 | `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ exit 0 / pass true / fps 60.1 / 0 console·page·failed 错误 |
| 6 | `i18n-check.mjs --root .` | ✅ OK（en=zh=47 keys，0 missing/empty） |
| 7 | `tutorial-check.mjs --root . --out tests/artifacts/tutorial` | ✅ PASS（visible/active/3 steps/skip/persisted/replayable） |
| 8 | `sdk-check.mjs --root .` | ✅ pass true（SDK 就绪/降级/广告关/埋点/存档/分享 10 项） |
| 9 | `node tools/audio-check.mjs` | ✅ 14/14 passed allPass=true（11 SFX + 3 BGM 循环 RMS>0） |
| 10 | `vision-review.mjs --root .` | ✅ **PASS**（readable 8.0 / silhouette 7.0 / style 8.5，4 张） |

### 门禁详情

**node --test（22 条纯逻辑）**：初始状态契约 / getHud 字段 / 同 seed 确定性 / 掷刀 spawn+throw 事件 / 插刀 stuck+knifeStick / 崩刀 failed+knifeBreak+death / 过关 cleared+levelCleared / 第 12 关 won+gameWon / 桩旋转 / 反转 / 脉冲 / 移动桩 / 双桩交替 / 对称加成 / 斩铁解锁与吸附 / 安全空档 / 角度工具 / 关卡配置 12 关三场景 / 每关新元素互不重复。

**fun-report（arcade）**：首输入 0s、延迟 90ms、首胜 0s、成功率 100%、操作 94/min、空转 0%、事件最大间隔 0s、事件种类 9、推进第 3 关 100%、死亡存在 67%。

**verify-game**：标题屏 → 默认英文/LTR → 切中文 → 切回 → 开局 → 首次引导出现 → 跳过 → 插刀成功 → 崩刀失败卡 → 回标题；移动端 844×390 开局+插刀；fps 60.1（≥50）；0 console/page error、0 失败请求（`checks.external=false` 是 pipysdk 域名许可例外）。

**tutorial-check**：`[data-tutorial]` 根 + `[data-tutorial-skip]` + `#btn-how[data-tutorial-replay]` + `__ll.tutorial`；3 步真实交互（掷刀/插刀/绽裂过关）；可跳过、刷新不再自动弹（`tutorial-done` 经 Sdk.save 持久化）、可重看。

**sdk-check**：PipyGames 存在、快捷 API 齐全、showRewarded 安全返回、track 可用、存档/分享出口存在、拦断 SDK 域名后页面仍可加载（降级）、0 console/page error、0 失败请求（SDK 自身除外）。

**audio-check**：11 SFX（throw/knifeStick/knifeBreak/levelCleared/gameWon/symBonus/zantie/death/sweep/pulse/ui）+ 3 BGM 循环（竹庭/暮城/雪岳），全部 RMS>0、peak<0.95、无 NaN。

**vision-review**：4 张截图，readable 8.0 / silhouette 7.0 / style 8.5，goal_visible 全 Y，无 HUD 遮挡、无文字裁切、移动安全。（tutorial-check 的 3 张过程截图用 `--out tests/artifacts/tutorial` 单独存放，避免「跳过引导后瞬间」的过程帧被误当玩法截图评审。）

## 3. 截图路径

- 标题屏：`tests/final/01-title.png`
- 玩法（已插刀）：`tests/final/02-play.png`
- 失败结算：`tests/final/03-fail.png`
- 移动端（844×390）：`tests/final/04-mobile.png`
- 封面：`poster.jpg`（1280×720）· 列表动画：`game.gif`（480×270 · 4.5s · 前 3 秒含掷刀+桩目标）

## 4. 未做项

- 未接真实广告账号：`sdk.config.js` 保持 `source:'local'`、`ads.enabled:false`（本地降级验收）。
- 美术全程序化 Canvas，未走 AI 出图管线（符合 spec「美术全程序化」与「零外链素材」）。
- 未做 ja/ko/ar/ru（按铁律只暴露 en/zh，其他语言整块删除）。
- 未做联网/排行榜/皮肤商店/每日任务/剧情（spec antiScope）。
- 未收集真人试玩数据（`--human` 属可选加分证据，非门禁）。

## 5. 最不满意的一处

signature「最后一刀慢动作 + 桩裂两半墨散」目前是**渲染层的视觉演出**（`triggerSignature()` 画扩张刀光圆环 + 左右两半滑开 + 墨点飞溅），并没有真正对 sim 做时间膨胀（慢动作是纯视觉近似）。对玩家观感成立、vision-review 可识别，但「慢动作」三个字的物理语义没完全兑现；若重做，我会在 main 的固定步长累加器里加一个 `timeScale` 系数，让最后一刀落地的几十毫秒真实慢放，而不是靠渲染补。
