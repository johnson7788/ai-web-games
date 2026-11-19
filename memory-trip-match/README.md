# MEMORY TRIP MATCH

> 记忆旅行·翻牌 — 霓虹记忆配对之旅

## 运行

```bash
cd memory-trip-match
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 玩法

- 开局短暂亮出所有牌（记忆），随后盖牌。
- 点两张牌翻开；配对的保持翻开并累积连击；翻错 1.5s 后盖回并断连击。
- 第 5 关起出现**岩石卡**：要先敲裂才能翻开。
- 步数耗尽判负；步数越少星级越高（1–3 星）。
- 每关 2 次**提示**（窥牌）。

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 翻牌 | 点击 / 触屏点牌 |
| 提示 | H 或点 HUD「Hint」 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认**英文**；`?lang=zh` 或右上角下拉可切**中文**。
- 文案走 `config/locales.js`，en/zh 完整。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
index.html          入口
styles.css          样式
config/             game.config / levels / locales / sdk.config / design.json
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑（可测）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         主入口 + 调试契约
tools/              selfplay / audio-check / verify.plan
tests/              单元测试
```

## 调试契约

`window.__ll` 暴露 `{ state, start, pause, resume, restart, run, sim, tutorial, startTutorial, save, load, share, debug }`。
