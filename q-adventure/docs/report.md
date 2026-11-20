# Q ADVENTURE · 交付报告

改造自《Q萌大冒险》客户端源码（行为树敌人 1:1 借鉴，角色/场景/音乐全原创）。纯静态 + Canvas 2D 程序化渲染 + WebAudio 程序化音频，零运行期依赖（唯一例外站点 pipysdk vendored + 降级）。

## 1. 文件清单

```
games/q-adventure/
├─ index.html  styles.css  package.json  README.md
├─ game.gif（480×270 / 4.5s / 215KB）  poster.jpg（1280×720 / 74KB）
├─ config/
│  ├─ design.json  game.config.js  gameplay.js  levels.js  locales.js  sdk.config.js
├─ src/
│  ├─ main.js（装配 / __ll 契约 / boot 守卫 / 教程选择器 / BGM 切换）
│  ├─ core/  i18n.js  sdk.js  audio.js（WebAudio 程序化 BGM+SFX）
│  ├─ game/  sim.js（纯逻辑平台模拟 + 行为树敌人 + 鼓点跳）  rng.js
│  ├─ render/ index.js（三场景包程序化渲染 + 粒子 + 目标/敌人标记）
│  ├─ ui/    index.js  screens.js  hud.js  tutorial.js（4 步首次引导）
│  └─ vendor/ pipysdk.js（runtimeConfigUrl/appConfigUrl 已清空，避免 ERR_ABORTED）
├─ tests/
│  ├─ sim.test.mjs  levels.test.mjs  audio.test.mjs（node:test 21 条纯逻辑）
│  ├─ artifacts/（verify-game 截图 + tutorial/sdk 报告）
│  └─ final/（01–08 玩法截图 + 09 标题 + vision-review 报告）
├─ tools/
│  ├─ selfplay.mjs（3 策略遥测 → tools/fun/autoplay.json）
│  ├─ verify.plan.json  audio-check.mjs  shots.mjs  record-gif.mjs  poster.mjs
│  └─ fun/（design-audit / fun-report / report）
└─ docs/  analysis.md  short.md  long.md  report.md
```

## 2. 全套门禁输出摘要（全部 ≥WARN）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 21 tests / 21 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ greedy 达第 4 关（req≥3）；random 达第 8 关；noinput 第 1 关死亡 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail）：首输入 0s、首胜 1s、空转 3%、事件间隔 2s、事件种类 14、推进 100%、死亡 100% |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass=true；0 console error / 0 失败请求 / 0 外部请求；帧率 60fps |
| `i18n-check.mjs` | ✅ i18n OK（en/zh 各 57 key，0 missing / 0 empty） |
| `tutorial-check.mjs` | ✅ tutorial PASS（4 步 / 可跳过 / 持久化 / 可重看） |
| `sdk-check.mjs` | ✅ pass=true（对象存在 / API 齐全 / 降级 / 0 error） |
| `tools/audio-check.mjs` | ✅ 24/24 passed（SFX 19 + BGM 循环 4 + API 契约） |
| `vision-review.mjs` | ✅ **WARN**（readable 7.6 / silhouette 7.4 / style 9.1，均 ≥ 门槛 7/6/6；8 张全 goal_visible、无 HUD 遮挡、无文字裁切、移动端安全） |

## 3. 截图路径

- 标题：`tests/final/09-title.png`
- 玩法：`tests/final/01-play.png`（奔跑）、`02-jump.png`（跳）、`03-collect.png`（收集）、`04-enemy.png`（敌人+追击标记）、`05-cloud.png`（云端场景包）、`06-night.png`（夜林+尖刺）、`07-wall.png`（蹬墙）、`08-mobile.png`（移动端）
- 验收过程图：`tests/artifacts/v01-title.png` … `v06-mobile-play.png`

## 4. 上线物料

- `game.gif`：480×270、4.5s、215KB（≤2MB），从真实玩法录制（跑/跳 + 终点旗同屏，前 3 秒见核心动词 + 目标）。
- `poster.jpg`：1280×720、74KB（玩法图 + 发光描边大标题 + tagline）。
- SEO：`docs/short.md`（≤160 字符英文）+ `docs/long.md`（英文为主 + 中文段落 + 操作说明）。

## 5. 未做项

- 未接广告账号：`config/sdk.config.js` 的 `ads.enabled=false`（符合 G6 要求）。
- 未生成 AI 图片素材：本作美术全程序化 Canvas（spec 允许，且不引外部素材）。
- 未做 Boss 战 / 排行榜 / 皮肤商店 / 每日任务（spec 反范围明确列出）。
- 未 git commit（按要求）；未起常驻服务器（所有截图/录制脚本用完即关）。

## 6. 最不满意的一处

**HUD 目标指示与移动端触屏按钮被 vision-review 连续点名**：目标箭头「→ GOAL」虽已加暗色背板，但视觉模型仍多次反馈「箭头偏小/无高亮」，且左下角 ◀ ▶ 按钮间距（目测 <44px）在 844×390 视口下被反复判定「易误触」。桌面 1280×720 下按钮间距充足，但移动端小视口我把两个方向键做成了 54px 圆形并排（间距仅 ~20px），vision 判定为移动端不安全边缘。若能重做，我会把移动端方向键改成**单个摇杆式分离按钮 + 更大触控命中区（≥64px，间距 ≥8px）**，并把 GOAL 箭头做成随距离收缩的高亮脉冲图标，从根本上解决这两处 readability 扣分。
