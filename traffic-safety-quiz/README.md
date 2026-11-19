# TRAFFIC SAFETY QUIZ

> 交通安全小卫士 — 判断路况、保持连击、抢时间

## 运行

```bash
cd traffic-safety-quiz
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 判定「安全」 | 点 ✓ SAFE / 按 A 或 1 |
| 判定「危险」 | 点 ✗ UNSAFE / 按 D 或 2 |
| 上一题 / 下一题 | ‹ › / ← → |
| 暂停 / 继续 | Esc / ⏸ |
| 重开本局 | R / ↻ |
| 静音 | M / 🔊 |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新后保留。

## 测试与门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

> 注：本仓库 shell 里 `node` 是坏掉的 nvm-lazy 函数，请用 `/opt/homebrew/bin/node`。

## 目录

```
index.html          入口
styles.css          霓虹街机风样式
config/             数值 / 题库 / 文案 / 设计源 / SDK 配置
src/core/           i18n / sdk / audio（纯 WebAudio）
src/game/sim.js     纯逻辑（无 DOM，可 Node 测试）
src/render/         Canvas 程序化场景
src/ui/             DOM UI + 教程
src/vendor/         pipysdk（本地降级）
tests/              单元测试 + final 验收截图
tools/              自对弈 / 音频验收 / verify plan
```

## 调试契约

`window.__ll` 暴露：`state.phase` / `start()` / `pause()` / `resume()` / `restart()` / `run` / `tutorial` / `debug.win()`。
