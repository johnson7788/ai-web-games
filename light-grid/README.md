# LIGHT GRID · 光网电路

> 电路点灯（Lights Out 变体）：点一个节点翻转它和上下左右，把整板点亮即通电过关。

## 运行

```bash
cd light-grid
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 点按节点 | 鼠标点击 / 触屏点按 |
| 移动光标 | 方向键 / WASD |
| 确认按下 | Enter / Space |
| 暂停 | Esc |
| 重开本关 | R（结算时） |
| 下一关 | Enter（过关结算时） |

## 语言

默认英文；标题 / 暂停 / 设置可切中文。`?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
只暴露 en/zh 两个完整语言。

## 测试 / 验收

```bash
node --test                                            # 纯逻辑（关卡可解性 + 玩法）
node tools/selfplay.mjs                                # 3 策略遥测 → tools/fun/autoplay.json
node tools/audio-check.mjs                             # 程序化音效 RMS 校验
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .      # 设计审计
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # Fun Gate
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .  # 截图评审
```

## 目录

```
config/     gameplay.js（规则）、levels.js（36 关库）、locales.js、design.json、sdk.config.js、game.config.js
src/game/   sim.js（纯逻辑）、solver.js（Gauss 求解器）
src/render/ theme.js（三场景色板）、index.js（Canvas 渲染 + 签名走线动画）
src/ui/     screens / hud / tutorial / index
src/core/   i18n / save / sdk / audio（程序化 WebAudio）
tools/      自玩 / 音频校验 / 截图 / GIF / 海报 / verify.plan.json
docs/       analysis.md / report.md / short.txt / long.md
```
