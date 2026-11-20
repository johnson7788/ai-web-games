# RING CYCLE · 彩环蹦蹦

糖果工厂传送带：糖球在旋转彩环阵里下落。左右操控糖球，落在与自己颜色相同的环上得分并保持同色链；连吃 5 个同色环触发「彩虹糖雨」。白环是万能安全捷径，木环是一次性跳板救急资源。12 个推进带轮换环阵（稀疏/移动/变色/窄格/无白），三大场景：果味车间、薄荷库、夜光仓。

## 运行

```bash
cd games/ring-cycle
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 左移 | A / ← |
| 右移 | D / → |
| 暂停 | Esc / P |
| 重开（死亡后） | R |

触屏直接拖动；建议横屏。

## 结构

```
config/    design.json / game.config.js / gameplay.js / levels.js / locales.js / sdk.config.js
src/       game(sim/spawner/rng) · render(theme/scene/rings/particles) · ui(screens/hud/tutorial) · core(i18n/save/audio/sdk) · main.js
tests/     纯逻辑测试（node --test）
tools/     selfplay / audio-check / screenshots / record-gif / poster / verify.plan.json
docs/      analysis.md / report.md / short.md / long.md
```

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```
