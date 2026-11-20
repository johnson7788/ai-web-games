# BEAT BALL

> 鼓面疾行 — 太鼓球在巨型太鼓面上向纵深滚动，躲开按节拍落下的鼓槌、踩中发光节拍点连击刷分。

## 运行

```bash
cd beat-ball
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左变道 | ← / A / 左滑 |
| 右变道 | → / D / 右滑 |
| 跳跃 | Space / 点按或上滑 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`beat-ball-lang`），刷新保留。

## 测试与验收

```bash
node --test                                   # 纯逻辑（sim/levels）
node tools/selfplay.mjs                       # greedy/random/noinput 遥测
node tools/audio-check.mjs                    # 音频离屏渲染
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
```

## 物料

`poster.jpg` / `poster-1920.jpg` / `game.gif` / `SEO.txt` / `icon.png` / `favicon.png`。

## 调试契约

`window.__ll`：`state.phase` / `start(i)` / `pause` / `resume` / `restart` / `home` / `debug.state()` / `debug.loadLevel(i)` / `debug.startSeeded(i,seed)` / `debug.fastForward()`。

## 交付

见 `docs/DELIVERY.md`（源码分析 / 改造点 / 门禁输出 / 物料 / 已知问题）。
