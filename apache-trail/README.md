# APACHE TRAIL

> 阿帕奇小径 · 落日峡谷跑者

## 运行

```bash
cd apache-trail
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 | A / ← / 左下 ◀ |
| 右移 | D / → / 左下 ▶ |
| 跳跃 / 二段跳 | Space / W / ↑ / 右下 ▲ |
| 抓墙 | 空中朝墙按住方向 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

默认英文，`?lang=zh` 可覆盖，标题/暂停下拉可切中英文（`config/locales.js`，en/zh 完整）。

## 测试 / 验收

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

## 调试契约

`window.__ll` 暴露 `state.phase/lang`、`start/pause/resume/restart`、`run`、`tutorial{active,step,steps}`、`startTutorial`、`debug.loadLevel/winNow/state`。
