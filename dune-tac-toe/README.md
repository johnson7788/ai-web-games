# DUNE TAC TOE

> 沙丘井字棋 — 在沙漠棋盘上种下仙人掌，智胜那只每一步都完美防守的蝎子。

## 运行

```bash
cd dune-tac-toe
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 玩法

- **谜题模式**：12 个必胜残局。给定局面，你（仙人掌）先手，在 N 步内获胜；第 12 关「蝎子的完美防守」改为逼平完美 AI。
- **无尽对战**：vs AI 三档（随机 / 贪心 / 完美——困难档不可战胜是特性）+ 双人同屏。
- 双方棋子「仙人掌 vs 蝎子」，形状 + 颜色双编码，色盲友好。

## 操作

| 动作 | 键 / 方式 |
| --- | --- |
| 落子 | 点击格子 / Tab + Enter 可达 |
| 暂停 / 继续 | Esc 或 P |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`dune-tac-toe-lang`），刷新后保留。
- 全部可见文案走 `config/locales.js` 的 `t()`。

## 测试与验收

```bash
node --test                                  # 纯逻辑测试
node tools/selfplay.mjs                      # 3 策略遥测
node tools/audio-check.mjs                   # 音频 RMS/循环验收
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 上线物料

```bash
node tools/make-poster.mjs    # poster.jpg / poster-1920.jpg / icon.png / favicon.png
node tools/record-gif.mjs game.gif
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置（game.config / design.json / levels / locales / sdk.config）
src/core/           i18n / save / sdk / audio
src/game/           sim（纯逻辑 + Minimax AI + 谜题求解器）
src/render/         Canvas 2D 沙漠渲染
src/ui/             UI 薄适配层
src/vendor/         pipysdk（vendored）
src/main.js         主入口
tests/              测试
tools/              自对弈 / 音频验收 / 录 gif / 出海报
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase` / `start(i)` / `startEndless(mode)` / `pause` / `resume` / `restart` / `home` / `debug.state()` / `debug.layout()` / `debug.loadLevel(i)` / `debug.startSeeded(i,seed)` / `debug.autoPlaceSolution()` / `debug.fastForward()` / `tutorial.*`。
