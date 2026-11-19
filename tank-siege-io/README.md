# TANK SIEGE IO

> 坦克围城 · 霓虹街机坦克防守。守住底部核心，击退一波波 AI 坦克。

## 运行

```bash
cd tank-siege-io
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左下虚拟摇杆 |
| 开火 | Space | 右下 FIRE 键 |
| 暂停 | Esc / P | — |
| 重开 | R | — |

## 语言

- 默认 **英文**，标题右上角 / 暂停屏可切 **中文**；`?lang=zh` 可覆盖。
- 所有可见文案走 `config/locales.js`（en / zh 完整）。

## 玩法

- 底部「核心」被摧毁或你的坦克被摧毁 = 失败。
- 清空一波敌人 → 下一波（敌人更多、地形更复杂：砖 / 岩石 / 钢墙）。
- 击杀掉落道具：加速 / 速射 / 护盾 / 维修核心 / 三连发；连续击杀叠连击倍率。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html         入口
styles.css         样式（霓虹街机）
config/            game.config / locales / design.json / sdk.config
src/core/          i18n / sdk / audio（程序化 WebAudio）
src/game/sim.js    纯逻辑（可 Node 无头自对弈）
src/render/        Canvas 2D 程序化渲染
src/ui/            UI 屏幕显隐 / 语言
src/main.js        主入口（60Hz 固定步长 + 调试契约 window.__ll）
tests/             单测
tools/             自对弈 / 音频验收 / 验收计划 / 海报
```
