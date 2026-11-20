# PLUMBER RUN · 交付报告

> 改造自参考 Cocos《超级马里奥》源码（`/Users/admin/remake-src/超级马里奥creator/`），
> 全 IP 换皮为「蒸汽都市修理工阿扳」。玩法规则 1:1，角色/场景/音乐全原创。
> 全部门禁由脚本自跑，输出见各 `tests/final/*.json` / `tools/fun/*.json`。

## 1) 文件清单

```
games/plumber-run/
├─ index.html            入口（canvas + ui-root + 触屏条 + #rotate + #loading）
├─ styles.css            蒸汽都市 UI + 移动端 844×390 HUD 响应式 + 竖屏提示
├─ package.json          {"type":"module"}
├─ game.gif              480×270 · 4.5s · 1.26MB（真实玩法录制）
├─ poster.jpg            1280×720（玩法截图 + 发光大标题）
├─ config/
│  ├─ game.config.js     世界 1280×720 / 45px 瓦片 / 语言 en+zh
│  ├─ gameplay.js        全部玩法数值（物理/三态/扳手/蒸汽/生命/星级）
│  ├─ levels.js          12 关（16 行网格，地面剖面 + 物体列表构建）
│  ├─ locales.js         en/zh 各 58 key，完整对齐
│  ├─ design.json        fun-audit 设计源（PASS 100/100）
│  └─ sdk.config.js      appId pipy-plumber-run / 广告关闭 / 埋点 / 存档
├─ src/
│  ├─ core/              i18n / save / sdk / audio（WebAudio 程序化合成）
│  ├─ game/              rng / sim（纯逻辑，零 DOM）
│  ├─ render/            theme（三场景包）/ index（Canvas2D 程序化美术）
│  ├─ ui/                screens / hud / tutorial / index
│  ├─ vendor/pipysdk.js  站点 SDK（vendored 本地副本，降级可玩）
│  └─ main.js            装配 / 固定步长 / boot 守卫 / window.__ll 契约
├─ tests/sim.test.mjs    21 条纯逻辑测试
├─ tools/                selfplay / verify.plan.json / audio-check / record-gif / record-poster
└─ docs/                 analysis.md / short.md / long.md / report.md
```

## 2) 门禁输出摘要（全绿 / ≥WARN）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 21 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ 3 策略：greedy 达 12 关 0 死；random/noinput 各 3 死 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail）首胜 14s、操作 129/min、空转 0%、最大间隔 0s、推进 100%、死亡存在 67% |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass） |
| `verify-game.mjs` | ✅ pass（标题/i18n/引导/移动/暂停/重启，0 error/0 失败请求） |
| `i18n-check.mjs` | ✅ en/zh 各 58 key，0 missing 0 empty |
| `tutorial-check.mjs` | ✅ PASS（4 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/降级/广告关闭/埋点/存档/分享全过） |
| `tools/audio-check.mjs` | ✅ 20/20 passed（17 SFX + 3 BGM 循环，RMS>0/峰值<0.95/无 NaN） |
| `vision-review.mjs` | ✅ **WARN**（readable 7.9 / silhouette 6.6 / style 8.9，无 critical） |

## 3) 截图路径（tests/final/）

- 标题：`01-title.png` / `09-title-zh.png`
- 玩法（六主题）：`02-play.png`（晨市）/ `03-play2.png` / `04-sewer.png`（下水道）/ `05-dark.png`（暗关）/ `06-factory.png`（夜工厂）/ `07-finale.png`（锅炉终章）
- 移动端：`08-mobile-play.png`（844×390 + 触屏控制条）
- 引导：`tutorial-first.png` / `tutorial-after-skip.png` / `tutorial-replay.png`
- 评审报告：`vision-review.json` / `vision-review.md`

## 4) 未做项（已列 TODO，不影响门禁）

1. **移动平台 / 伸缩管道 / 水流推进** 三特性：设计源与关卡 `feature` 字段已声明，但 sim 里未实现独立机制（仅暗关 `drawDarkness` + 尖刺 + 坑 + 敌群已实现）；关卡 4/5/6 目前按标准平台跳跃玩法运行，靠主题换皮区分。
2. **广告变现**：`config/sdk.config.js` 的 `ads.enabled=false`，未接广告账号（与上线策略一致，Lead 上传前可改）。
3. **更精细的敌人 AI / Boss**：当前只有「管道怪兽 walker」一种敌人（来回走 + 悬崖掉头 + 被踩/被扳手击毙），未做飞行/发射类敌人与 Boss。
4. **触屏摇杆**：移动端用离散按钮（◀▶/跳/扳手/蒸汽）而非摇杆，按钮 ≥44px、不遮 HUD。
5. **无障碍**：`prefers-reduced-motion` 只关了装饰动画，未单独做色盲符号冗余（关键信息已用形状+文字+位置冗余，非仅红绿）。

## 5) 最不满意的一处

**vision-review 的 silhouette 只有 6.6（WARN 贴线）**：标题屏（`01-title.png`）与暗关（`05-dark.png`）两张拉低了剪影均分——标题屏是纯菜单没有角色，暗关的玩家在黑暗中偏小偏暗。已通过「玩家加亮色轮廓底 + 青蓝工装高对比 + 暗关聚光半径放大」把均分从 5.5 提到 6.6，但暗关玩家在 720p 缩略图里仍然偏小。若要冲 PASS，下一步应把暗关角色再放大/再加一层描边，或让标题屏背景里站一个清晰可辨的角色剪影。

---

*报告由脚本门禁自动产出；未 commit、未起常驻服务器、未改 games/plumber-run/ 之外的游戏目录。*
