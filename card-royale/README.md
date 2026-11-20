# CARD ROYALE

> 皇家牌局 — A royal TriPeaks solitaire at the midnight court

## 运行

```bash
cd games/card-royale
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 出牌 | 点一张与底牌点数相邻（K↔A 相接）的金边露头牌 |
| 翻牌 | 点左下角翻牌堆 |
| 重翻 | 库存空时自动提示，点翻牌堆消耗一次重翻 |
| 解冻 | 点冰封的露头牌 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

- 标准 52 张牌（四花色 13 序）+ 可选 1 张鬼牌。
- 牌阵为多峰三角阵，上层盖下层相邻两列，只有「露头」的牌可出。
- 出与弃牌堆底牌**相邻序数**（K 与 A 相接）的露头牌，清空全部牌阵过关。
- **皇家连胜**：连续 5 张不断连出牌触发金线 + 加分；同色连出累积 combo 分。
- 冻结牌需先解冻；藏宝冠冕翻倍分；鬼牌是万能底牌；限时关剩余时间换星。

## 语言

- 默认 **英文**，可切 **中文**；`?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试与验收

```bash
node --test                                             # 纯逻辑（含 1000 种子可解性）
node tools/selfplay.mjs                                 # bot 三策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css   入口与样式
config/                   design.json · game.config.js · levels.js · locales.js · sdk.config.js
src/game/                 sim.js（纯逻辑）· solver.js（求解器）
src/render/               index.js（Canvas 2D：场景/程序化牌面/金线）
src/ui/                   ui.js
src/core/                 i18n.js · audio.js（程序化 WebAudio）· sdk.js
src/vendor/               pipysdk.js
tests/                    node:test 纯逻辑
tools/                    selfplay / verify.plan / record-gif / audio-check / make-materials
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `debug.state()` /
`debug.loadLevel(i)` / `debug.startSeeded(i,seed)` / `debug.autoPlaceSolution()` / `debug.fastForward()` / `debug.layout()`。
