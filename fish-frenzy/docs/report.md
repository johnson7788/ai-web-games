# FISH FRENZY · 交付报告

> 改造自 Cocos 单机捕鱼（`/Users/admin/remake-src/单机捕鱼-creator/`）→ 原创深海夜光渔市主题网页游戏。
> slug: `fish-frenzy` · title: `FISH FRENZY` · appId: `pipy-fish-frenzy` · 零构建纯静态 + WebAudio 程序化 BGM（无音频文件）。

## 1. 文件清单

```
games/fish-frenzy/
├─ index.html / styles.css / package.json
├─ config/
│  ├─ game.config.js      世界尺寸 / 步长 / 语言 / 存档键
│  ├─ gameplay.js         经济 / 炮台 / 网弹 / 电击网 / 预报 / 捕获率公式
│  ├─ fishes.js           10 种发光深海种（含巨口鲨 Boss）
│  ├─ paths.js            6 条鱼群路径表（单游/编队/横穿/拐弯）
│  ├─ levels.js           12 场推进结构（营收目标/限时/场景/Boss 场）
│  ├─ locales.js          en/zh 双语（53 key × 2，0 missing）
│  ├─ sdk.config.js       appId=pipy-fish-frenzy / 广告关 / 存档 keyPrefix
│  └─ design.json         设计源（fun-audit 100 分）
├─ src/
│  ├─ core/  i18n.js · save.js · sdk.js · audio.js（WebAudio 程序化 17 SFX + 2 loop）
│  ├─ game/  rng.js · sim.js（纯逻辑核心）· spawner.js
│  ├─ render/ theme.js · scene.js（3 场景包）· fish.js · cannon.js · particles.js · index.js
│  ├─ ui/    index.js · screens.js · hud.js · tutorial.js（4 步交互引导）
│  ├─ vendor/ pipysdk.js（vendored SDK）
│  └─ main.js             装配 / 固定步长 / 事件分发 / window.__ll 契约
├─ tools/  verify.plan.json · selfplay.mjs · audio-check.mjs · make-final.mjs · make-poster.mjs · record-gif.mjs
├─ tests/  sim.test.mjs · spawner.test.mjs · ui.test.mjs（35 条纯逻辑测试）+ tests/final/（8 张验收截图）
├─ docs/   analysis.md（源码分析）· report.md · short.md · long.md
├─ game.gif（480×270 · 4.5s · 656KB） · poster.jpg（1280×720 · 80KB）
```

可部署文件（index.html + src + config + game.gif + poster + SEO）合计约 **1.0 MB**，远低于 3MB 上限。

## 2. 门禁输出摘要（全绿）

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `node --test` | ✅ **35 pass / 0 fail**（契约/捕获率/关卡/胜负/预报/电击网/Boss/教程机） |
| 2 | `node tools/selfplay.mjs` | ✅ 3 条策略：greedy stage=12 / random stage=4 dead / noinput stage=1 dead |
| 3 | `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| 4 | `fun-audit.mjs` | ✅ **PASS**（100/100，26 pass） |
| 5 | `verify-game.mjs` | ✅ **PASS**（8 截图，0 console error / 0 失败请求，全断言过） |
| 6 | `i18n-check.mjs` | ✅ **OK**（en/zh 各 53 key，0 missing / 0 empty） |
| 7 | `tutorial-check.mjs` | ✅ **PASS**（4 步引导可见/可跳过/持久化/可重看） |
| 8 | `sdk-check.mjs` | ✅ **PASS**（SDK 就绪/广告关闭安全返回/降级/埋点/存档/分享全过） |
| 9 | `audio-check.mjs` | ✅ **19/19 passed**（17 SFX + 2 loop RMS>0、peak<0.95、无 NaN） |
| 10 | `vision-review.mjs` | ✅ **WARN**（readable 7.5 / silhouette 6.8 / style 8.6，0 critical） |

### fun-report 关键指标（bot 遥测）

| 指标 | 观测 | 门槛 | 判定 |
| --- | --- | --- | --- |
| 首胜中位数 | 16s | 60s | ✅ |
| 成功率 | 100% | 80% | ✅ |
| 操作频率 | 3078/min | 60/min | ✅ |
| 空转时间占比 | 7% | 15% | ✅ |
| 事件最大间隔 | 1s | 3s | ✅ |
| 事件种类 | 16 种 | 8 种 | ✅ |
| 推进到第 3 场 | 100% | 60% | ✅ |
| 至少死过一次 | 67% | 50% | ✅ |

### 玩法还原 vs 源码（对应关系见 docs/analysis.md）

- 炮台 1-7 档倍率（`CannonManager.ts:16`）→ 夜光炮台，耗币=档位，捕获率随档位升。
- 网弹命中按捕获率判定（`FishBulletBase.ts:21-35` 扣血判死等价模型）→ `captureRate(tier,hp)=clamp(tier/hp,0.05,0.95)`。
- 鱼群路径表（`FishPathConfig.ts:33-75`）→ `config/paths.js` 6 条折线路径。
- 金币余额即血量（`FishUI.ts:21`）→ `coins` 打空判负；每场限时。
- 原创 twist：鱼汛预报（提前 5s 预告路线）+ 电击网（60s 充能群捕）+ 三场景包。

## 3. 截图路径

| 状态 | 路径 |
| --- | --- |
| 标题（英文） | `tests/final/01-title.png` |
| 玩法 | `tests/final/02-play.png` |
| Boss | `tests/final/03-boss.png` |
| 深沟场景 | `tests/final/04-scene2.png` |
| 热泉场景 | `tests/final/05-scene3.png` |
| 电击网 | `tests/final/06-electric.png` |
| 移动端 | `tests/final/07-mobile.png` |
| 标题（中文） | `tests/final/08-title-zh.png` |

（暂停/结算等纯菜单截图留在 `tests/artifacts/`，不污染 vision-review。）

## 4. 未做项

- 未接广告账号：`sdk.config.js` 的 `ads.enabled=false`，广告 UI 不出现（上线前按需改 `source:'online'`）。
- 未做 ja/ko/ar/ru（按铁律整块删除，只暴露 en/zh）。
- 未做联网排行榜 / 皮肤商店 / 每日任务 / 剧情对话（design.json antiScope 明确排除）。

## 5. 最不满意的一处

**经济调参把「高端赌大鱼」做成了「高档炮始终最优」**：因为捕获率 `tier/hp` 单调升且奖励 `value×tier` 随档位线性放大，高档炮的期望收益/币恒不低于低档（只在撞到 0.95 捕获率上限后变平）。这让「换炮档」这个决定退化成「永远用高档 + 管好金币方差」，而不是「低档稳 / 高档赌」的双向取舍。当前靠「小鱼是诱饵（value/hp<1）、追高倍率鱼才赚」把 skill 差异做出来（bot 已验证 greedy 稳赢、random 破产），但炮档本身仍没有真正的风险权衡。下次迭代会让高档炮对小鱼有更陡的惩罚（例如高档炮捕获率上限随目标血量收紧），把「档位」重新变成一个每 30 秒一次的真正决定。
