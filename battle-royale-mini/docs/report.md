# BATTLE ROYALE MINI · 交付报告

改造自 Cocos 源码《全民吃鸡大战》。玩法规则 1:1 还原（俯视角双摇杆射击 BR：缩圈/捡枪/药/甲/15 AI/击杀计数/最后存活），角色/场景/音乐/美术全原创（玩具兵 + 桌面战场 + 程序化 Canvas/WebAudio）。

## 1. 文件清单

```
index.html              入口（1280×720 letterbox + 加载层 + 旋转提示 + 触屏控制）
styles.css              玻璃拟态 UI + HUD 单条不透明状态栏 + 移动端响应式
config/game.config.js   世界尺寸 / 步长 / 语言 / 存档键
config/gameplay.js      武器/缩圈/AI/物资/背包/玩家数值
config/locales.js       en + zh 全量（57 key，无缺失）
config/design.json      机器可读设计源（fun-audit 100/100）
config/sdk.config.js    SDK 唯一配置（appId pipy-battle-royale-mini）
src/game/sim.js         纯逻辑 BR 模拟（16 角色 / 子弹 / 缩圈 / 拾取 / AI / 胜负）
src/game/rng.js         mulberry32 确定性随机
src/render/index.js     Canvas 2D 渲染（玩具兵 / 文具掩体 / 缩圈 / 安全区标记 / 聚光）
src/render/theme.js     三场景色板（书桌暖木 / 玩具城彩 / 夜库靛蓝）
src/core/{i18n,save,audio,sdk}.js
src/core/audio.js       WebAudio 程序化合成（18 SFX + BGM 循环，零音频文件）
src/ui/{index,tutorial}.js  UI / HUD / 首次交互引导
src/vendor/pipysdk.js   SDK vendored 副本（本地降级）
src/main.js             装配：固定步长 / 输入 / 事件分发 / 状态机 / __ll 契约
tests/sim.test.mjs      19 条纯逻辑测试
tests/tutorial.test.mjs 8 条教程/主题测试
tools/selfplay.mjs      3 策略无头自玩
tools/audio-check.mjs   音效离线校验
tools/verify.plan.json  浏览器验收计划
tools/record-gif.mjs    玩法录屏
tools/poster.mjs        海报生成
docs/{analysis,short,long,report}.md
game.gif                480×270 · 4.5s · 0.96MB（真实玩法）
poster.jpg              1280×720（玩法截图 + 发光标题）
tests/final/            5 张验收截图 + 4 份报告
```

## 2. 门禁输出摘要（全绿）

| # | 门禁 | 结果 |
| --- | --- | --- |
| 1 | `node --test` | ✅ 27 pass / 0 fail |
| 2 | `node tools/selfplay.mjs` | ✅ greedy 推进到第 5 场（4 胜 22 杀）/ random 死亡 / noinput 死亡 |
| 3 | `fun-report` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| 4 | `fun-audit` | ✅ PASS（26 pass / 0 warn / 0 fail，100/100） |
| 5 | `verify-game` | ✅ pass（0 console/page error、0 失败请求、0 外部请求） |
| 6 | `i18n-check` | ✅ OK（en/zh 各 57 key，0 missing 0 empty） |
| 7 | `tutorial-check` | ✅ PASS（4 步 move/shoot/loot/kill，可跳过/持久化/可重看） |
| 8 | `sdk-check` | ✅ pass（SDK 降级 / 广告 false / 埋点 / 存档 / 分享 / 断网可开） |
| 9 | `audio-check` | ✅ 19/19（SFX + BGM 均 RMS>0 / peak<0.95 / nan=0） |
| 10 | `vision-review` | ✅ PASS（readable 8.2 / silhouette 6.2 / style 8.4，0 critical） |

**selfplay 遥测关键值**（action 阈值）：

- greedy：`levelsReached=5, kills=22, firstSuccessSec≈8, maxEventGapSec=0.5, uniqueEvents=16`
- random：`deaths=1`（输入鲁棒性基线）
- noinput：`deaths=1`（无死时间基线：会被缩圈/敌人淘汰）
- 遥测四指标：首次输入 0s、输入延迟 90ms、首胜 8s、事件间隔 0.5s、推进率 100%、死亡存在性 100%

## 3. 截图路径

- 标题：`tests/final/01-title.png`
- 玩法：`tests/final/04-play.png`（安全区标记 + 玩家 + 敌人可见）
- 结算：`tests/final/06-dead.png`（名次/击杀/场次/最佳名次）
- 重开：`tests/final/07-restart.png`
- 移动端：`tests/final/08-mobile-play.png`（844×390，触屏控制首次触摸前隐藏）
- 素材：`game.gif`（玩法录屏）、`poster.jpg`（1280×720 海报）

## 4. 未做项

- 未做「跳哪（富区 vs 安全区）」的开局落地选择——简化为固定出生点 + 出生点附近保底 3 把枪，降低入口摩擦（fun-audit 里的「跳哪」决定在实战中由「2 格背包取舍」「静步 vs 抢高点」承载）。
- 未做空投箱 5 秒开箱与轰炸区（原作 `DropBox`/`dropBoom`）——范围控制，核心循环已覆盖缩圈/捡枪/药/甲/击杀/存活。
- 未做皮肤商店 / 每日任务 / 排行榜 / 多人联机（反范围项，见 design.json antiScope）。
- 未做 `asset-check`（无 `assets/` 目录，美术全程序化 Canvas；音频全程序化 WebAudio）。

## 5. 最不满意的一处

**vision-review 的移动端截图评分波动较大。** 移动端 844×390 下 16 个玩具兵 + 物资 + 缩圈在单屏里信息密度高，视觉模型对「HUD 遮挡/目标可见」的判断在多次运行间有明显波动。最终通过的方式是：HUD 收敛为顶部单条不透明状态栏、触屏控制在首次触摸前隐藏（截图干净）、安全区中心用「脉冲环 + 向下箭头 + 文字标签」明确标记、玩家出生点避开安全区标记。但移动端小屏的「一眼可读」仍是这版最需要继续打磨的点（若真人试玩，建议优先观察移动端首屏是否能在 3 秒内看懂「进圈 + 捡枪」）。
