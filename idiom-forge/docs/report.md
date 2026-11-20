# IDIOM FORGE · 交付报告

> 改造自「成语拼拼」（Cocos Creator），玩法 1:1 还原（spec P0）+ 全原创成语熔炉主题。
> 交付日期：2026-11-20 · 门禁全绿（见 §2）。

## 1) 文件清单

```
games/idiom-forge/
├─ index.html / styles.css          入口 + 全程序化 UI（熔炉暖橙玻璃拟态）
├─ game.gif                         列表页动画 480×270 4.5s（真实点选填字玩法）
├─ poster.jpg                       1280×720 海报（玩法截图叠大标题）
├─ package.json                     {"type":"module"}
├─ config/
│  ├─ game.config.js / sdk.config.js   全局常量 / 唯一 SDK 配置源
│  ├─ design.json                   机器可读设计源（fun-audit 100/100）
│  ├─ gameplay.js / levels.js / weapons.js  数值 / 12 关 / 十二神兵剪影
│  ├─ idioms.js                     543 成语 + 535 英文词 + 24 字谜（原创词库）
│  └─ locales.js                    en/zh 完整双语
├─ src/
│  ├─ core/{i18n,sdk,audio}.js      i18n / SDK 统一出口 / 程序化音频
│  ├─ game/{rng,questions,sim}.js   纯逻辑（可 node:test）
│  ├─ render/index.js               程序化三场景包 + 熔炉 + 兵器剪影喷发
│  ├─ ui/{index,screens,hud,gameboard,tutorial}.js
│  ├─ vendor/pipysdk.js             vendored SDK（runtimeConfigUrl/appConfigUrl 置空）
│  └─ main.js                       装配 + 固定步长 + __ll 契约
├─ tests/                           30 条纯逻辑测试
├─ tools/                           verify.plan.json / selfplay / audio-check / shots / record-gif / poster
├─ tests/final/                     7 张验收截图 + vision-review + tutorial/sdk 报告
└─ docs/{analysis,report,short,long}.md
```

## 2) 每条门禁输出摘要（全部 PASS）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | **30 pass / 0 fail**（词库校验 6 + 题目生成 8 + sim 16） |
| 自玩遥测 | `node tools/selfplay.mjs` | greedy L12 通关 / random 死亡 / noinput 死亡 |
| Fun Gate | `fun-report.mjs --root .` | **PASS** 10/0/0（首输入 0s / 首胜 0s / 操作 3383/min / 空转 4% / 事件间隔 0.5s / 11 种事件 / 推进率 100% / 死亡率 67%） |
| 设计审计 | `fun-audit.mjs --root .` | **PASS** 100/100（26 pass） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json` | **pass**（0 console error / 0 失败请求 / 帧率 60fps ≥50） |
| 语言完整性 | `i18n-check.mjs --root .` | ✓ en/zh 各 54 key，0 missing 0 empty |
| 交互引导 | `tutorial-check.mjs --root .` | **PASS**（3 步 / 可跳过 / 刷新不重弹 / 可重看） |
| SDK | `sdk-check.mjs --root .` | **pass**（就绪/降级/广告/埋点/存档/分享/断网可玩 10 项全过） |
| 音频 | `node tools/audio-check.mjs` | 22/22（19 SFX + 3 BGM 循环，RMS>0/峰值<0.95/无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | **PASS** readable 8.0 / silhouette 6.4 / style 9.0（无 HUD 遮挡、无文字裁切、目标全部可见） |

## 3) 截图路径（tests/final/）

- 标题：`01-title.png`（标题屏，熔炉场景 + 标题 logo）
- 玩法：`02-play.png`（英文填空）、`03-play-zh.png`（中文填空）、`05-riddle.png`（字谜模式 ×2）
- 铸兵签名瞬间：`04-forge.png`（熔炉喷出神兵剪影）
- 结算：`06-result.png`
- 移动端：`07-mobile.png`（844×390 横屏）

## 4) 未做项

- 未接广告账号：`config/sdk.config.js` 的 `ads.enabled=false`（广告 UI 整体不出现，`showRewarded` 安全返回 false）。
- 未做 ja/ko/ar/ru：按铁律只暴露 en/zh（i18n-check 0 missing）。
- 未做每日任务 / 排行榜 / 皮肤商店（反范围已列明）。
- 未 git commit、未起常驻服务器（按任务约束）。

## 5) 最不满意的一处

**词库释义是「原创但短」的简洁义（2–6 字），不是权威辞典释义。** 中文 543 条成语的「释义」为了覆盖量与可玩性，采用最短义（如「画蛇添足→多此一举」），作为游戏提示够用，但作为「成语学习」内容偏单薄。若后续要往教育向走，需要补完整释义与例句；当前版本把它定位成「提示」，而不是「知识卡片」，视觉上也确实把 clue 放在题目卡里当提示用。
