# WORD DUEL · 符文决斗

> 拼出英文单词施放符文，与十二位法师回合对决——词越长伤害越高，拼错就吃反伤。

一款零构建纯静态的回合制英文拼词对战游戏：每回合抽 9 张字母牌，按顺序点击拼出英文单词，点 CAST 施法攻击对手。词越长伤害越高、出手越快有速度加成；拼错单词会被反伤（雷系双倍、冰系冰冻、火系两段连击）。

## 运行

```bash
cd games/word-duel
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选字母 | 点击字母方块 / 键入对应字母键 |
| 退格 | Backspace / 再点已选字母 |
| 施法 | Enter / 点 CAST |
| 换 3 张 | 点 Swap 3 |
| 暂停 | Esc / P |

## 语言

默认英文；标题 / 暂停下拉可切中文；`?lang=zh` 可覆盖；选择持久化。en 与 zh 完整，未翻译语言不暴露。

## 验收命令（全绿）

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 物料

- `poster.jpg` / `poster-1920.jpg` — 海报
- `game.gif` — 列表页动画（480×270）
- `icon.png` / `favicon.png` — 图标
- `SEO.txt` — 中英 SEO 五关键词

## 目录

```
config/   design.json（设计源）/ levels.js（12 关）/ words.js（词库）/ locales.js / sdk.config.js / game.config.js
src/core/ i18n / audio（程序化 WebAudio）/ sdk（统一出口）
src/game/ sim.js（纯逻辑）
src/render/ index.js（程序化 Canvas）
src/ui/   ui.js
src/main.js 主入口 + window.__ll 调试契约
tests/    纯逻辑测试（24 条）
tools/    selfplay / verify.plan / audio-check / record-gif / make-poster
```
