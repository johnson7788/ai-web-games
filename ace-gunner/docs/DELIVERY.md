# ACE GUNNER · 交付报告

> slug `ace-gunner` · title `ACE GUNNER`（边城神射）· appId `pipy-ace-gunner` · 品类 arcade
> 改造自 Cocos 3.6 源码 `local/src1/王牌射手-creator3.6/Ace_Shooter/`

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

源码入口在 `assets/Script/`，核心是三套「Load」层 + 一个 `Global` 关卡数据表：

- **关卡数据** `assets/Script/Global.ts:69-108` —— `LevelInfor` 共 5 关，每关字段：`mycontrol`（射手站位）、`denfense`（防守者站位）、`gloalnum`（过关所需进球数 3/4/4/4/4）、`surplenum`（总射门次数 5/7/7/7/7）。规则是「N 球里进 M 球过关」。
- **瞄准** `assets/Script/GameScene/MycontrolLoad/Mycontrol.ts:19-24` —— 射门角度在 ±45° 间摆动（`AngleSpeed=1` / `FixSpeed=2`）；`HitBall()/FireBall()`（`:47-62`）负责蓄球与发射。
- **球发射** `assets/Script/GameScene/FixLoad/Ball.ts:14,25-37` —— `FireSpeed=50`，从射手位置 +100px 处按角度设 `linearVelocity` 发射。
- **防守者** `assets/Script/GameScene/DefenseLoad/DefenseLoad.ts:58-64` —— 按 `Global.LevelInfor[i].denfense` 摆位；`Defense.ts:24-26` 只播放动画。
- **守门员** `assets/Script/GameScene/FixLoad/FixLoad.ts:24-31` —— 横移速度 5、边界 ±166。
- **回合/过关提示** `assets/Script/GameScene/ElementLoad.ts:49-95` —— 进球 +1 / 剩余 -1 / 回合与过关动画。
- **道具** `assets/Script/Global.ts:113` —— `PropName = ["iceicon", "timepropicon"]`（冰/时间道具，源码未接逻辑）。

**结论**：原「王牌射手」实际是**足球点球/任意球射门游戏**（进球/剩余球数/守门员/防守者站位），不是塔防射击。spec 里「守点射击 + 敌人沿路径进攻 + 弹药换弹 + 据点血量 + 波间升级」的 P0 是对品类的**重新定义**；因此源码中没有「敌人波次/弹药曲线」可直接 1:1 提取，本作数值曲线（波次、敌人 HP/速度、箭袋/换弹、城门血量、升级）按 spec 的 12 波推进结构**自研设计**，见 `config/game.config.js` + `config/levels.js`。

## 2) 改造点清单

**保留（规则骨架）**：瞄准→发射→命中反馈的核心动词；「每关固定次数内达成目标」的节奏感；关卡推进结构（5 关 → 12 波）；波间「选择」这一决定形态。

**原创改造**：
- 主题换成**西部边城神射**：弓箭手守城，敌人是荒漠马匪（步/马/盾/炸药桶/酋长 Boss）。
- 玩法从「射门」改成**守点射击**：敌人沿四道马路逼近，你控制准星拉弓放箭；箭袋换弹节奏 + 城门血量 + 波间金币升级。
- **签名记忆点**：拉满弦箭矢带风鸣（`draw` SFX）+ 连杀触发「鹰眼时刻」（慢动作 + 准星放大 + 金圈）。
- 三场景包：正午荒漠 / 沙暴边境 / 星夜要塞（色板/构图/装饰互异，`src/render/index.js` 的 `SCENE_PALETTES`）。
- 12 波新元素依次：步匪→马匪→盾匪(破盾)→炸药桶→沙暴→双门→混编→酋长 Boss→夜袭→精英混编→马匪群→终局大围攻（`config/levels.js` + `config/design.json`）。
- 10 个升级（6 规则型 / 4 数值型，规则型占比 60%）。

## 3) 每条门禁的最终输出摘要

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ 18 pass / 0 fail |
| 自对弈遥测 | `node tools/selfplay.mjs` | ✅ greedy 达第 10 波 / random 乱按 / noinput 死亡基线 |
| 遥测 Fun Gate | `fun-report.mjs` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| 设计审计 | `fun-audit.mjs` | ✅ PASS 100/100（26 pass） |
| 浏览器验收 | `verify-game.mjs` | ✅ PASS（60fps、0 console error、0 失败请求） |
| 语言完整性 | `i18n-check.mjs` | ✅ en/zh 各 61 key，0 missing |
| 首次引导 | `tutorial-check.mjs` | ✅ PASS（≥3 步、可跳过、持久化不再弹、可重看） |
| SDK 接入 | `sdk-check.mjs` | ✅ PASS（对象/API/降级/埋点/存档全绿；share 为 warn 与黄金参考一致） |
| 音频验收 | `tools/audio-check.mjs` | ✅ PASS（BGM 无缝循环 + 16 个 SFX RMS/时长/峰值） |
| 视觉评审 | `vision-review.mjs` | ⚠️ WARN（readable 7.7 / silhouette 7.8 / style 9.0，无 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720（真实玩法帧 + 大标题贴纸字）
- `poster-1920.jpg` 1920×1080
- `game.gif` 480×270 · 4.57s 循环 · 910KB（前 3 秒即拉弓射箭/命中/爆炸）
- `icon.png` 256×256 · `favicon.png` 64×64（从玩法画面裁切城墙+射手）
- `SEO.txt` 五个大写关键词 TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份

生成脚本：`tools/make-media.mjs`（海报/图标）、`tools/record-gif.mjs`（录制 → ffmpeg 转 gif）。

## 5) 未做项与已知问题

- 未接真实广告账号（`config/sdk.config.js` `ads.enabled=false`，符合「未接账号」策略）。
- 未做多语言 ja/ko/ar/ru（按铁律整块不暴露，只暴露 en/zh）。
- 竖屏提示已做但未做竖屏下的触屏适配细化（横向 844×390 已验证）。
- vision-review 为 WARN（非 PASS）：剩余问题集中在「HUD 文字间距/对比度」「虚线瞄准线在远距离辨识度」「红色箭头无文字说明」——属可读性优化项，未触 critical。

## 6) 最不满意的一处

**盾匪的「射腿」机制被迫降级为「破盾」**。原设计（也是 spec 原文「要先射腿/绕射」）是「瞄准敌人下半身破防」；但在「射手固定在左侧一点、敌人在四条不同高度的马路上」的布局里，箭矢从射手出发、以不同俯仰角命中敌人，「命中上半身 vs 下半身」无法对四条道同时成立（射手在上的道永远先打头顶）。最后改成角度无关的「盾有独立耐久、打碎才掉血」（`sim.js` 的 `shieldHp` + `legShot` 强化改作对盾伤害翻倍），机制清晰且 bot 可通关，但丢掉了 spec 里「射腿」的手感细节。若要还原，需要给盾匪一个真正独立的腿部 hitbox 或让射手可上下移动，属下一迭代。
