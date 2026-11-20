# brick-six 交付报告

> BRICK SIX · 蜂巢工坊 —— 改造自 `66消除`（Cocos 六边形堆叠消除）。
> 玩法规则 1:1 还原（随机 2–4 格块组落盘 / 整线消除 / 放不下判负 / 连消 combo），角色/场景/音乐全原创。

## 1. 文件清单

```
games/brick-six/
├─ index.html                   入口（#loading pointer-events:none / #rotate 竖屏提示 / #btn-rotate）
├─ styles.css                   HUD 不透明条 + 移动端媒体查询 + 教程覆盖层
├─ package.json                 {"type":"module"}
├─ game.gif                     480×270 / 4.5s / 659KB（真实玩法录制）
├─ poster.jpg                   1280×720 / 97KB（玩法截图 + 发光大标题）
├─ README.md / long 见 docs/
├─ config/
│  ├─ game.config.js            WORLD/STEP/语言/存档键
│  ├─ gameplay.js               形状池 / 12 档 TIERS / 计分 / 三场景包色板
│  ├─ design.json               机器可读设计源（fun-audit PASS）
│  ├─ locales.js                en/zh 全量（46 key × 2）
│  └─ sdk.config.js             appId=pipy-brick-six / ads.enabled=false
├─ src/
│  ├─ main.js                   装配 / 固定步长 / 输入 / 状态机 / boot 守卫 / window.__ll
│  ├─ vendor/pipysdk.js         vendored SDK（runtimeConfigUrl/appConfigUrl 置空）
│  ├─ core/{sdk,i18n,save,audio}.js   SDK 唯一出口 / 多语言 / 本地设置 / 程序化 BGM+SFX
│  ├─ game/{rng,hex,sim}.js     纯逻辑：mulberry32 / 轴向六边形几何 / 模拟器
│  ├─ render/index.js           Canvas 程序化渲染（三场景包 + 粒子）
│  └─ ui/{index,screens,hud,tutorial}.js
├─ tests/
│  ├─ hex.test.mjs              7 条几何测试
│  ├─ sim.test.mjs              16 条模拟测试
│  └─ final/                    验收截图 + 报告（vision/tutorial/sdk）
├─ tools/
│  ├─ selfplay.mjs              greedy/random/noinput 三策略遥测
│  ├─ verify.plan.json          浏览器验收计划（checks.external=false）
│  ├─ audio-check.mjs           音效/BGM RMS 离线校验
│  ├─ shots.mjs / record-gif.mjs / poster.mjs
│  └─ fun/{autoplay,design-audit,report,fun-report}.json
└─ docs/{analysis,report,short,long}.md
```

## 2. 门禁输出摘要（全套自己跑，全绿）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 23 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ greedy(tier=12, dead=0, success=0.3s) · random(dead=1) · noinput(无输入基线) |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail，品类 puzzle） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass（0 console/page error、0 失败请求、0 外部请求） |
| `i18n-check.mjs` | ✅ en/zh 各 46 key，0 missing / 0 empty |
| `tutorial-check.mjs` | ✅ PASS（3 步 place/rotate/clear，可跳过/重看/持久化） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/降级/广告关/埋点/存档/分享全过） |
| `audio-check.mjs` | ✅ 18/18（15 SFX + 3 BGM 循环，RMS>0、peak<0.95、无 NaN） |
| `vision-review.mjs` | ✅ **PASS**（readable 8.0 / silhouette 7.3 / style 9.2，6 张，无 critical） |

### fun-report 关键指标（bot 遥测）

- 首次输入 0s（≤12）、首胜 0.3s（≤120）、成功 100%（≥80%）
- 操作 3600/min、空转 0%、事件最大间隔 0.1s、事件种类 10（≥6）
- 推进到第 3 档 100%（greedy 达 tier 12）、至少死过一次 33%（random 死）

## 3. 截图路径

| 用途 | 路径 |
| --- | --- |
| 标题 | `tests/final/01-title.png` |
| 玩法（近满环 + 幽灵 + HUD） | `tests/final/02-play.png` |
| 金瀑（三环全满黄金瞬间） | `tests/final/03-cascade.png` |
| 移动端 844×390 玩法 | `tests/final/04-mobile.png` |
| 换章·蜜库（琥珀） | `tests/final/05-honey.png` |
| 换章·冬巢（蓝白 + 窄盘） | `tests/final/06-winter.png` |

## 4. 未做项

- 未接真实广告账号（`config/sdk.config.js` 的 `ads.enabled=false`，符合「未接账号保持 false」）。
- 未做 ja/ko/ar/ru（本作仅 en/zh 完整暴露，其余整块删除，符合 i18n 规则）。
- 未起常驻服务器、未 git commit（按执行单要求）。

## 5. 最不满意的一处

`checkLose` 的判负只做「存在任一合法落位」的朴素判定，没有考虑「连续 N 步无消时给提示」这类节奏优化；另外花粉传染在低档位不做连锁，`pollenChain` 只在第 10 档开启，导致花粉的「连锁布局」卖点要玩到很后面才完全展开。若再迭代一轮，会把花粉连锁提前到第 4 档、并把「无消 5 步」做成可见的局内预警事件（也能顺手把 greedy 的事件密度再抬高）。
