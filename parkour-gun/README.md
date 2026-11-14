# PARKOUR GUN · 跑酷枪战

横版跑酷射击（.io 风格，单机 + bot）：在平台间奔跑 / 二段跳，射杀红色 bot 小队，先达 **15 击杀**获胜。

- 品类：射击 / 街机（平台跳跃 / 跑酷 / .io）
- 参考：Kour.io（只借鉴品类，物理与代码全部原创；先单机 + 机器人）
- 技术：零构建纯静态 · ES Module · Canvas 横版战场 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长

## 运行

```bash
cd games/parkour-gun
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 奔跑：`A/D`（或方向键）；跳跃：`W/↑/空格`（空中再按一次二段跳）。
- 瞄准：鼠标；开火：按住左键。
- `Esc`/`P` 暂停。

## 规则

- 你（蓝）vs 3 名红 bot；bot 会索敌 / 追击 / 跳跃 / 开火。
- 重力 + 单向平台（可从下方穿过、上方落下站稳）；二段跳。
- 子弹直线飞行，撞平台消失，命中敌方掉 20 血（满血 100）；击杀 +1。
- 阵亡 2s 重生；先达 15 击杀获胜；胜场存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（创建/移动/跳跃/重力/平台/射击/命中/击杀/胜利/bot自跑/RNG）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

验收结果：11/11 测试通过 · 浏览器验收 pass（60fps，0 console 错误）· i18n en/zh 各 21 键无缺 · SDK 降级正常。

## 上架物料

`poster.jpg` / `poster-1920.jpg`（AI 封面合成）· `icon.png` / `favicon.png` · `game.gif`。
封面为 AI 生成（`parkour-gun-cover.png`），经 `tools/make-parkourgun-poster.mjs` 合成；图标/动图由 `tools/make-media.mjs` 产出。

## 目录

```
config/      game.config（重力/平台/玩家/子弹/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：平台物理/二段跳/子弹/bot AI/伤害/重生/记分）
src/render/  index.js（夜景城市/平台/角色/子弹轨迹/记分板/血条/准星/重生覆盖）
src/ui/      ui.js（标题/暂停/结束 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.step(sec,input)` / `debug.setScores(a,b)` / `debug.kill(id)` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语。