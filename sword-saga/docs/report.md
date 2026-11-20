# SWORD SAGA — 交付报告

> 改造自 `Pal2.0 仙剑奇侠`（Cocos Creator 源码）· 玩法规则 1:1 还原 · IP 全原创化《云隐剑歌》
> slug `sword-saga` · appId `pipy-sword-saga` · 2026-11-20

## 1) 文件清单

```
games/sword-saga/
├─ index.html  styles.css  package.json
├─ game.gif (480×270, ~620KB)   poster.jpg (1280×720)
├─ config/
│  ├─ game.config.js   世界尺寸 / 步长 / 语言 / 存档键
│  ├─ sdk.config.js    appId / 广告 / 埋点 / 存档 / 分享
│  ├─ gameplay.js      五行 / ATB / 技能 / 道具 / 敌人 / 12 章
│  ├─ story.js         《云隐剑歌》12 章双语剧情（每章 ≤8 句）
│  ├─ locales.js       en/zh 全量文案（80 key）
│  └─ design.json      机器可读设计源（fun-audit 100/100）
├─ src/
│  ├─ vendor/pipysdk.js   （runtimeConfigUrl / appConfigUrl 置空，杜绝外链）
│  ├─ core/{sdk,i18n,save,audio}.js
│  ├─ game/{battle,sim,rng}.js   纯逻辑（不碰 DOM/window/Date.now）
│  ├─ render/{index,theme}.js    程序化水墨渲染 + 三套场景色板 + 墨晕
│  └─ ui/{index,screens,tutorial}.js
├─ tests/{battle,sim}.test.mjs   23 条纯逻辑测试
├─ tests/final/                  8 张验收截图 + 各门禁报告
├─ docs/{analysis,long,short,report}
└─ tools/{selfplay,audio-check,verify.plan,shots,record-gif,poster}.mjs
```

## 2) 每条门禁的输出摘要

| 门禁 | 结论 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ 23/23 | battle 13 + sim 10；覆盖五行相克 / 速度条 / 灵狐替身 / 剑意蓄势 / 换人 / 12 章推进 / 失败与通关 |
| `node tools/selfplay.mjs` | ✅ 3 策略 | greedy 到第 8 章（ch=8, dead=1, 107s）；random/noinput 基线正常 |
| `fun-report` | ✅ PASS | 10 pass / 0 warn / 0 fail；首胜 5s、空转 0%、事件 24 种、推进率 100% |
| `fun-audit` | ✅ PASS | 100/100（26 pass）；3 动词带代价、8 决定、12 关、规则型升级 80% |
| `verify-game` | ✅ pass | 21 检查全过，0 console/page error、0 失败请求、0 外链 |
| `i18n-check` | ✅ OK | en/zh 各 80 key，0 missing / 0 empty |
| `tutorial-check` | ✅ PASS | 4 步真实交互（walk/talk/attack/win），可跳过/可重看/可持久化 |
| `sdk-check` | ✅ pass | SDK 就绪、广告关闭安全返回、埋点/存档/分享/断网降级全过 |
| `audio-check` | ✅ 21/21 | 17 音效 + 4 循环 BGM（bamboo/snow/tower/boss）全部 RMS>0、peak<0.95 |
| `vision-review` | ⚠️ WARN | readable 7.5 / silhouette 6.5 / style 8.5，0 critical（≥WARN 达标） |

## 3) 截图路径（tests/final/）

- `01-map-bamboo.png` — 青竹林地图（玩家 / 长老 / 战斗门）
- `02-dialog.png` — NPC 剧情对话
- `03-battle.png` — 回合战斗（敌人带红「!」目标标记 + TARGETS 计数）
- `04-target-select.png` — 目标选择菜单
- `05-boss.png` — 第 4 章 Boss 竹王
- `06-snow.png` — 雪山道（第二场景包）
- `07-tower.png` — 锁妖塔（第三场景包）
- `08-mobile.png` — 移动端 844×390（触屏方向键）

（另有 `tests/artifacts/v01–v08` 为 verify-game 流程截图，`tutorial-*` 为引导门禁截图。）

## 4) 未做项

- 无 AI 出图素材：按 spec「美术全程序化 Canvas」执行，未接入 artgen 管线。
- 无第三方平台（Poki/CrazyGames）接入；仅站点 pipysdk（本地 vendored + 降级）。
- 未做装备/支线/开放世界（spec 反范围明确排除）。
- `game.gif` 实际时长 ~4.7s（brief 目标 4.5s，620KB 远低于 2MB 上限）。

## 5) 最不满意的一处

程序化角色的 silhouette 是整套视觉里最弱的一环：vision-review 的 silhouette 均分只有 6.5，模型反复把「灵狐随行」与「剑客」误判为同一实体（亮度/轮廓太接近），并且敌方的元素标签（如 `WOOD`）偏小、距离血条过近。战斗布局本身（左侧双主角纵向排布 + 右侧敌人）也被模型多次提到「无明确分组标识」。若要继续打磨，优先把剑客/灵狐的剪影做明显区分（配色、描边、间距），并把战斗单位从纵向堆叠改为更清晰的左右分区。
