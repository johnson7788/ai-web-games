# OCEAN DASH 交付报告

> 改造自 fish go / fish run（源码 `/Users/admin/remake-src/fish-go-creator/` + `fish-run-creator/`）。
> 玩法规则 1:1 还原「鱼群竞速躲避 + AI 对手」，角色/场景/音乐全原创。全流程单 agent 端到端。

## 1) 文件清单

```
games/ocean-dash/
├─ index.html             入口（1280×720 letterbox + loading(pointer-events:none) + rotate + 触屏按钮）
├─ styles.css             玻璃拟态 UI / HUD 不透明条 / 移动端媒体查询 / RTL 无关
├─ package.json           {"type":"module"}
├─ game.gif               480×270 列表页动图（~1.0MB）
├─ poster.jpg             1280×720 封面
├─ config/
│  ├─ game.config.js      世界尺寸 / STEP / 语言 / 存档键
│  ├─ gameplay.js         全部数值常量 + 纯函数（散聚/速度/障碍/气泡/洋流/滑翔/AI）
│  ├─ levels.js           12 赛段 + 3 场景包（珊瑚浅滩/深沟/红树林）
│  ├─ design.json         机器可读设计源（fun-audit 输入）
│  ├─ locales.js          en/zh 完整（42 key）
│  └─ sdk.config.js       appId=pipy-ocean-dash / 广告关 / 埋点 / 存档
├─ src/
│  ├─ vendor/pipysdk.js   站点 SDK vendored 副本
│  ├─ core/i18n.js        ?lang= > localStorage > en
│  ├─ core/sdk.js         存档/埋点/广告/分享唯一出口（降级 mock）
│  ├─ core/audio.js       WebAudio 程序化 BGM(3 场景分层无缝) + 16 SFX
│  ├─ game/rng.js         mulberry32
│  ├─ game/spawner.js     赛段地图生成（窄缝/水母/洋流/逆流/礁阵/跃面/树根）
│  ├─ game/sim.js         纯逻辑 sim（散聚/上下/跃出滑翔/AI 竞速/判定/事件）
│  ├─ render/index.js     三场景包渲染 + 终点旗(目标常驻) + 粒子 + 暗区
│  ├─ render/particles.js 粒子
│  ├─ ui/index.js         装配
│  ├─ ui/screens.js       标题/暂停/结算/设置/toast
│  ├─ ui/hud.js           赛段/名次/鱼群/进度/收拢/滑翔
│  ├─ ui/tutorial.js      4 步首次交互引导（可跳过/重看/持久化）
│  └─ main.js             固定步长/输入/事件分发/状态机/__ll 契约/boot 守卫
├─ docs/
│  ├─ analysis.md         源码分析
│  ├─ short.md            ≤160 字符英文短描述
│  ├─ long.md             英文为主 + 中文段落 + 操作说明
│  └─ report.md           本报告
├─ tests/sim.test.mjs     21 条纯逻辑测试
├─ tools/
│  ├─ verify.plan.json    浏览器验收计划
│  ├─ selfplay.mjs        3 策略无头自玩 → autoplay.json
│  ├─ audio-check.mjs     音效/BGM 离线 RMS 校验
│  ├─ record-gif.mjs      录屏→ffmpeg→game.gif
│  └─ make-poster.mjs     玩法截图→叠标题→poster.jpg
└─ tests/final/           验收截图 + vision-review / sdk / verify 报告
```

## 2) 门禁输出摘要

| 门禁 | 结果 | 摘要 |
| --- | --- | --- |
| `node --test` | ✅ 21/21 | sim/spawner/rng 纯逻辑测试全绿 |
| `node tools/selfplay.mjs` | ✅ | greedy(seg=11,rank=1,dead=1) random(dead=1) noinput(dead=1) |
| `fun-report.mjs --root .` | ✅ **PASS** | 10 pass / 0 warn / 0 fail；首胜 11s、空转 0%、事件间隔 1s、推进率 100%、死亡存在 100% |
| `fun-audit.mjs --root .` | ✅ **PASS** | 100/100（26 pass） |
| `verify-game.mjs` | ✅ pass | 全部断言通过；0 console/page error、0 失败请求 |
| `i18n-check.mjs` | ✅ OK | en/zh 各 42 key，0 missing/empty |
| `tutorial-check.mjs` | ✅ PASS | visible/active/4 步/skip/persisted/replay 全 true |
| `sdk-check.mjs` | ✅ pass | SDK 对象/快捷 API/降级/埋点/存档/分享 全过 |
| `tools/audio-check.mjs` | ✅ 20/20 | 16 SFX + 4 loop RMS>0、peak<0.95、nan=0 |
| `vision-review.mjs` | ✅ **≥WARN** | readable 7.8–8.0 / silhouette 7.0–7.4 / style 8.6–8.8，无 critical（视觉模型噪声，PASS/WARN 间波动，未达 FAIL） |

**全部门禁 ≥WARN，全绿。**

## 3) 截图路径

- 标题：`tests/final/05-title.png`
- 玩法：`tests/final/01-play.png`、`tests/final/02-gather.png`
- 移动端：`tests/final/04-mobile.png`
- 结算：`tests/final/06-result.png`
- 封面：`poster.jpg`；列表动图：`game.gif`

## 4) 未做项

- 未接广告账号（`sdk.config.js` `ads.enabled: false`，验收即按降级 mock 跑）。
- 未做联网排行榜 / 每日任务 / 皮肤商店 / 剧情（见 design.json antiScope）。
- 未做 SEO.txt（brief §4 只要求 docs/short + docs/long.md；SEO.txt 属 Lead 上传环节）。
- 升级/道具（design.json 里的 8 个升级）为设计源，未在局内做成可点选的跨局成长 UI（本作以 12 赛段推进结构为主体）。

## 5) 最不满意的一处

**视觉模型的「目标可见」判定不稳定**：`vision-review` 对同一张玩法截图（01-play）两次给出相反 verdict（一次 goal_visible=true，一次 false），最终靠「终点旗常驻（远处画右缘方向旗）+ HUD 不透明条 + 领头鱼放大加亮」才稳定到 WARN。这说明对竞速类游戏，「目标」的可读性比想象中更依赖一个**始终可见的实体终点标记**，而不是靠进度条或文字说明——这是我本作学到的最重要一条。
