# KLOTSKI NUMBERS

> 霓虹数字华容道 · Neon number klotski

把打乱的数字块沿空格一行行滑回原位——归位触发连击，步数和时间决定星级，提示与重洗是有限的救命道具。

## 运行

```bash
cd klotski-numbers
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 滑动数字块 | 点击 / 点按与空格同行或同列的块 |
| 提示 | H 键 / HUD「Hint」按钮 |
| 重洗 | S 键 / HUD「Shuffle」按钮 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题/暂停屏右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`klotski-numbers-lang`），刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`。

## 测试

```bash
node --test
```

## 验收

```bash
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
index.html           入口
styles.css           样式
config/              配置与文案（design.json = 机器可读设计源）
src/core/            i18n / sdk / audio
src/game/            sim（纯逻辑）/ solver（自对弈求解器）
src/render/          canvas 程序化霓虹渲染
src/ui/             UI
src/main.js          主入口
tests/               测试
tools/               工具与验收计划
tools/fun/           设计审计/玩测遥测/视觉评审/音频报告
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase` / `start` / `pause` / `resume` / `restart` / `run` / `tutorial` / `startTutorial` / `debug`。
