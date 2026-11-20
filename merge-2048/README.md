# MERGE 2048 · 星际殖民地 2048

> 改造自「合到2048」——经典 2048 滑动合并 × 星际殖民地主题。数字=殖民舰吨位，合并=舰队整编；引力井锁定 + 跃迁引擎强制合并，12 关推进，三场景包。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 滑动合并 | 方向键 / WASD / 触屏滑动 |
| 跃迁引擎（选两个同值格强制合并） | E 键 / 「跃迁」按钮 |
| 暂停 / 继续 | Esc / P |
| 重开 | R（结算后） |
| 开始 / 重看引导 | Enter / How to play |

## 语言

默认英文；标题/暂停/设置右上角下拉可切中文。`?lang=zh` 可临时覆盖，选择持久化。

## 测试与门禁

```bash
/opt/homebrew/bin/node --test                      # 23 条纯逻辑测试
/opt/homebrew/bin/node tools/selfplay.mjs          # 3 策略遥测
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/   数值、关卡、文案、SDK、设计源
src/game/ 纯逻辑（sim/ai/rng）
src/render/ 三场景渲染
src/ui/   HUD/屏幕/引导
src/core/ i18n/sdk/audio
tools/    验收计划/自玩/音频校验
tests/    单元测试/最终截图
```
