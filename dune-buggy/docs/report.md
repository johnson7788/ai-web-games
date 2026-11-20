# DUNE BUGGY — 交付报告

> 改造自 Cocos Creator 3D 赛车 demo（`/Users/admin/remake-src/3D赛车-creator/`）→ 原创伪 3D 沙丘越野。
> 玩法规则 1:1 还原（油门/刹车/转向随速度缩放/计时/检查点/冲出赛道减速/圈速排行），角色/场景/音乐全原创。

## 1) 文件清单

```
config/design.json       设计源（fun-audit 输入，PASS 100）
config/game.config.js    世界尺寸 / 步长 / 语言 / 存档键
config/gameplay.js       全部数值常量 + 纯函数（胎压/地形/评级）
config/levels.js         12 赛段定义
config/locales.js        en + zh（68 key，完整）
config/sdk.config.js     appId pipy-dune-buggy
src/core/{sdk,i18n,save,audio}.js
src/vendor/pipysdk.js    vendored SDK（本地降级）
src/game/{rng,sim,track}.js   纯逻辑模拟 / 赛道生成（零 DOM）
src/render/{index,theme}.js   伪 3D 行扫描渲染 + 三场景包
src/ui/{index,screens,hud,tutorial}.js
src/main.js              装配 / 固定步长 / 输入 / 状态机 / __ll
index.html / styles.css
tests/sim.test.mjs       20 条纯逻辑测试
tools/{selfplay,audio-check,verify.plan,capture,record-gif,poster}.mjs
docs/{analysis,long,short,report}.md
game.gif                 480×270 · 4.4s · 1.18MB
poster.jpg               1280×720
```

## 2) 门禁输出摘要（全部 ≥WARN / PASS）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ 20 pass / 0 fail |
| bot 遥测 | `node tools/selfplay.mjs` | ✅ greedy stage10 / random·noinput 各 DNF |
| Fun Gate | `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| 设计审计 | `fun-audit.mjs --root .` | ✅ **PASS** 100/100（26 pass） |
| 浏览器验收 | `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass=true，fps 60，0 error，0 失败请求 |
| 语言完整性 | `i18n-check.mjs --root .` | ✅ i18n OK（en/zh 各 68 key，0 missing/empty） |
| 首次引导 | `tutorial-check.mjs --root .` | ✅ tutorial PASS（4 步/可跳过/可重看/持久化） |
| SDK | `sdk-check.mjs --root .` | ✅ pass=true（对象/API/降级/埋点/存档/分享） |
| 音频 | `node tools/audio-check.mjs` | ✅ 19/19 passed（RMS>0 / peak<0.95 / 无 NaN） |
| 视觉评审 | `vision-review.mjs --root .` | ✅ **PASS**（readable 8.6 / silhouette 7.8 / style 9.6） |

> 说明：`tutorial-check` 默认把 3 张引导截图写进 `tests/final/`，其文件名 `tutorial-*` 排序在 `01..08` 之后，
> 不影响 vision-review 扫的「前 8 张」玩法截图（按名排序 01–08 优先）。

## 3) 截图路径

- 玩法：`tests/final/01-play.png`（沙脊+检查点拱门）、`02-ridge.png`、`03-jump.png`（跳台签名瞬间）、`04-rock.png`、`05-storm.png`、`06-dusk.png`
- 移动端：`tests/final/07-mobile.png`（844×390 触屏）
- 标题：`tests/final/08-title.png`
- 验收：`tests/artifacts/v01..v08-*.png`、`tests/final/tutorial-*.png`

## 4) 未做项

- 未接真实广告账号（`ads.enabled=false`，符合「未接账号」默认）。
- 未做联网排行榜 / 皮肤商店 / 每日任务（反范围明确不做）。
- 双脊岔路（stage 11）的 ridgeX 走 ±0.34 分叉、greedy bot 仍居中不骑脊（不影响 3 段完赛判定）。
- 未做 `ja/ko/ar/ru`（en/zh 完整才暴露，符合约束）。

## 5) 最不满意的一处

**伪 3D 的弯道离心与转向手感是「数值可信」但不够「有驾驶感」。** 原作是速度直写 + 转向随速度缩放的极简模型，
本作保真地把它搬进 playerX 横向位移 + `curve*速度*离心` 外抛，数值与单测都对，但视觉上缺少轮胎侧滑、
沙尘甩尾的过渡层，高速入弯只表现为「横向位置外漂」，没有「车在打滑」的质感。若再迭代，我会在渲染层给
buggy 加一个与 `playerX 变化率` 成比例的甩尾角度 + 尾尘粒子，让「打滑」这件事看得见，而不是只在抓地系数里发生。
