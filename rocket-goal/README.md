# ROCKET GOAL · 火箭足球

俯视角车辆足球（Rocket League 风格，1v1）：驾驶火箭赛车把球撞进对方球门，先进 **5 球**获胜。Shift 加速（boost）。

- 品类：体育 / 驾驶（车辆足球 / .io）
- 参考：RocketGoal.io / Rocket League（只借鉴品类，物理与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 球场 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/rocket-goal
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 油门 / 刹车：`W/S` 或 `↑/↓`；转向：`A/D` 或 `←/→`。
- 加速：按住 `Shift`（消耗 boost 条，松开回充）。
- `Esc`/`P` 暂停。

## 规则

- 蓝方（你）攻右门，红方（bot）攻左门；球整体越过门线得分。
- 车有惯性 / 转向随速度变化；撞球按车速 + 角度把球击飞（封顶 900）。
- 球有摩擦 / 墙壁反弹；boost 上限 640。
- 进球后开球重置；先达 5 球获胜；胜场存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（创建/开球/加速/转向/boost/撞球/进球/胜利/bot自跑/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：10/10 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 21 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`rocket-goal-cover.png`），经 `tools/make-rocketgoal-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（球场/球门/车/球/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：车物理/boost/撞球/球物理/进球/bot AI/开球）
src/render/  index.js（球场/球门/赛车尾焰/球轨迹/HUD/boost 条/进球覆盖）
src/ui/      ui.js（标题/暂停/结束 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.setScores(a,b)` / `debug.goal(team)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。