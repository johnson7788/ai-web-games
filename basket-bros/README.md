# BASKET BROS · 街球兄弟

1v1 街头篮球（玩家 vs 电脑）。夜晚街头球场，抢球 → 蓄力投篮 → 投进远端篮筐；防守端可抢断 / 起跳干扰。先得 **11 分**获胜。

- 品类：体育 / 街机（篮球 / 1v1）
- 参考：BasketBros（只借鉴品类，物理与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 球场 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长物理

## 运行

```bash
cd games/basket-bros
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 移动：`A/D` 或 `←/→`；跳跃：`W/↑`。
- 投篮：**按住空格**蓄力、松开出手（力度条绿区为最佳）。
- 抢断：`J`（靠近持球对手）。
- 移动端：屏下 ◀▶ / 跳 / 投篮(按住) / 抢断 触控按钮。
- `Esc`/`P` 暂停。

## 规则

- P1(蓝) 攻右筐，P2(红,bot) 攻左筐；球从上方穿过筐口记 2 分。
- 投篮为弹道解算 + 误差：空位 + 理想蓄力命中率约 95%；蓄力不足 / 被贴身干扰明显下降。
- 球有重力 / 地面 / 篮板 / 筐沿碰撞，投失后反弹成自由球可争抢。
- 抢断有成功率与冷却；bot 会追球 / 抢断 / 起跳干扰 / 自主蓄力投篮。
- 先到 11 分获胜；胜场存档。

## 测试与验收

```bash
node --test                                                   # 12 条纯逻辑测试（移动/跳跃/拾取/投篮/得分/胜负/抢断/物理/bot/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：12/12 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 23 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`basket-bros-cover.png`），经 `tools/make-basket-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（球场/篮筐/球/球员/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：球员物理/球物理/拾取/投篮弹道/抢断/得分/bot AI）
src/render/  index.js（夜景球场/篮筐/角色/球轨迹/记分板/进球特效）
src/ui/      ui.js（标题/暂停/结束 + 触控按钮 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.setScore(a,b)` / `debug.giveBall(i)` / `debug.shoot(i,charge)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。