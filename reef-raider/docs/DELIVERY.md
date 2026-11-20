# REEF RAIDER — 交付说明

## 1) 源码分析摘要（原作玩法事实，带文件:行号）

- 发射消耗金币：`GameManager.ts:94-99` `hasGold -= weaponLevel`（消耗 = 炮台等级）。
- 触摸射击入口：`TouchManager.ts:25-28`（100ms 冷却 + `hasGold < weaponLevel` 不发射）；`TouchManager.ts:31-51` 触点角度换算。
- 炮弹：`Bullet.ts:11-12` speed=500、`Bullet.ts:27-29` bounceCount=2、`Bullet.ts:60-85` 撞边反弹/出屏回收、`Bullet.ts:95-99` 伤害 `ceil(rand*level*2 + level)` ∈ [level, 3*level]。
- 鱼：`Utils.ts:22-73` 10 档 hp 4→40 / gold 2→30；`Fish.ts:32-55` 贝塞尔游动；`Fish.ts:62-79` 碰撞扣血、死亡飘分/加金币/死亡动画；`Fish.ts:81-106` 朝向与出屏回收。
- 炮台升降级：`Weapon.ts:16-34`（1–7 级）；`MyGlobal.ts:24-33` 初始 `weaponLevel=1, hasGold=100, bulletCount=0`。
- 胜负：`Utils.ts:99-101` `hasGold<=0 && bulletCount<=0` → 结束（原版无目标分/无倒计时/无关卡）。
- 联网全部剥离：`config.ts:1-5` + `StartBtn.ts:19-44`（axios 登录，已弃用）。

## 2) 改造点清单

**保留（1:1 玩法规则）**：炮台随瞄准转向、点击发射消耗金币、炮弹反弹 2 次、命中扣血判定捕获、捕获按鱼种给金币、炮台可升降级（威力/消耗随档）、金币归零有救济（原版为直接结束，此处改为救济）、鱼群游动路径（直线/正弦/穿屏）。

**原创改造**：
- 主题「深海烟火师」——渔网 → 彩灯泡，命中绽出彩色光网涟漪；**signature：捕到大鱼时鱼化作灯影绕屏游一圈**。
- 5 种鱼（灯鱼/蝶鱼/海龟/魔鬼鱼/幽灵灯笼鱼）+ 终局灯笼鱼王。
- 12 关目标分制（倒计时内 score≥target 通关），三场景包（珊瑚晨光/岩礁黄昏/磷光夜海）。
- 规则型推进：鱼速+ → 稀有限时 ×2 → 密集鱼潮 → 暗礁挡弹 → 金币紧缩 → 连击倍率 → 快鱼+多礁 → 幽灵专场 → 紧缩+鱼潮 → 双倍稀有 → 灯笼鱼王。
- 金币归零救济（一次性 +10 + 连续滴灌），永不卡死。
- 纯程序化 Canvas 美术 + WebAudio 程序化音频（四层 BGM + 无缝循环 + 11 类 SFX），零外部素材。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ | 31 pass / 0 fail（sim 纯逻辑 23 + levels 8） |
| `node tools/selfplay.mjs` | ✅ | greedy 通关且 `levels=3`；random/noinput 各 death=1（死亡存在性 67%） |
| `fun-report.mjs` | ✅ PASS | 10 pass / 0 warn / 0 fail；首胜 2s、操作 660/min、事件 12 种、推进 100% |
| `fun-audit.mjs` | ✅ PASS | 100/100，26 pass / 0 warn / 0 fail |
| `verify-game.mjs` | ✅ | pass=true，60fps（avgFrameMs 16.67）、0 console/page error、0 失败请求 |
| `i18n-check.mjs` | ✅ | en/zh 各 45 key，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ PASS | 3 步引导，可跳过/可重看/刷新不再自动弹 |
| `sdk-check.mjs` | ✅ | pass=true（SDK 就绪/广告降级/埋点/存档/分享/断网降级） |
| `tools/audio-check.mjs` | ✅ PASS | BGM 循环 ≈38.4s 无缝；11 类 SFX RMS>0.01 且 ≤0.6s |
| `vision-review.mjs` | ⚠️ WARN | readable 7.6 / silhouette 7.6 / style 8.8，0 critical |

全套门禁均 ≥WARN，满足 brief 完成条件。

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）——真实磷光夜海玩法画面 + 大标题贴纸字。
- `game.gif`（480×270，1.7MB，5s 循环，前 3 秒即见瞄准/发射/光网捕鱼）。
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）。
- `icon.png`（256×256）、`favicon.png`（32×32）——从灯笼鱼王画面裁切。
- `tests/final/`：8 张玩法剪影截图 + `vision-review.json/.md` + `sdk-report.json`。

## 5) 未做项与已知问题

- SDK 为 `source:'local'`（vendored 副本）且 `ads.enabled:false`——未接广告账号，广告 UI 不出现（符合 spec「未接账号保持 false」）。
- 联网对战/排行榜/房间已剥离，纯单机（spec 要求）。
- 语言仅暴露 en/zh（ja/ko/ar/ru 未翻译，按 i18n 规则整块不暴露）。
- 美术全程序化（无 AI 图片素材），符合 brief「美术全程序化 Canvas」。
- 已知小瑕疵：光网命中目前是扩散圆环涟漪 + 小鱼灯影，而非「经纬线编织的网」；炮台只做旋转无后坐力。

## 6) 最不满意的一处

**签名记忆点「彩色光网」打折了**：`src/render/index.js` 的 `netRipple` 只画了 2 圈扩散圆环，没有做出「彩色光网」该有的经纬线编织感；真正到位的是捕到大鱼后鱼化作灯影绕屏一圈的 `lightShadow`（那个做出来了）。如果再加一轮，我会把光网改成多边形经纬网格 + 随机彩点，让「网」一眼成立，而不是一个泛光圆环。
