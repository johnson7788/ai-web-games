# GET ON BUS 3D

> 霓虹快线 · Neon shuttle pick-up & drop-off

一款「永远停不下来」的霓虹穿梭巴士：按住油门在横穿车流里抢 gap，松开刹车掐点避让；
在绿色标记接客、金色标记送客赚金币，贴脸擦过车流攒连击，捡护盾/氮气道具，冲刺终点拿 1–3 星。

## 运行

```bash
cd get-on-bus-3d
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 油门（加速） | 按住 Space / ↑ / W，或长按屏幕 |
| 刹车（减速到怠速） | 松开 |
| 暂停 / 继续 | Esc |
| 重开本关 | HUD ↻ |

## 语言

- 默认 **英文**；标题/暂停屏右上角可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`get-on-bus-3d-lang`）。

## 测试与验收

```bash
node --test                                    # ≥10 断言
node tools/selfplay.mjs                        # greedy/random/noinput → tools/fun/autoplay.json
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
index.html          入口
styles.css          霓虹街机样式
config/             配置（game.config / levels / locales / design.json / sdk.config）
src/core/           i18n、存档（Sdk 封装）、SDK、音频
src/game/sim.js     纯逻辑模拟（可无头测试 / selfplay）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         主入口（60Hz 固定步长 + 标准调试契约）
tools/              自对弈 / 音频验收 / verify.plan.json
tests/              单元测试
```
