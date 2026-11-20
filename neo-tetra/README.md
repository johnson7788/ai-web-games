# NEO TETRA

> 霓虹炼金炉俄罗斯方块：元素晶块、熔炼消行、白热态、12 矿层。

## 运行

```bash
cd games/neo-tetra
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 左 / 右移 | ← / → 或 A / D |
| 旋转 / 反转 | ↑ / X / W · Z |
| 软降 / 硬降 | ↓ / S · Space |
| 暂存 | C |
| 暂停 | Esc / P |

触屏：左右滑移动、下滑软降、点按旋转，另有 HOLD / DROP 按钮。

## 语言

默认英文，右上角 / 暂停 / 设置可切中文；`?lang=zh` 可临时覆盖；选择写入 localStorage（`neo-tetra-lang`）。

## 测试与门禁

```bash
cd games/neo-tetra
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/final
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/        配置（design.json / game.config / gameplay / levels / locales / sdk.config）
src/game/      纯逻辑（sim / tetromino / board / rng）
src/render/    Canvas 渲染（场景包 / 晶块 / ghost / next / hold / 粒子）
src/ui/        屏幕 / HUD / 首次引导
src/core/      i18n / 存档 / SDK 出口 / 程序化音频
tools/         selfplay / audio-check / verify.plan / record-gif / make-poster
tests/         node:test 纯逻辑 + final 验收截图
```

## 调试契约

`window.__ll` 暴露：`state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart` / `save` / `ui` / `tutorial` / `debug.layout()`。
