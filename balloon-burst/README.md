# BALLOON BURST · 纸灯笼节

> 点掉同色纸灯笼群，在灯节倒计时结束前冲过目标分。

## 运行

```bash
cd balloon-burst
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 输入 |
| --- | --- |
| 点掉同色群（≥2 盏） | 鼠标点击 / 触屏点按 |
| 拖选另一组 | 按下拖动后松开 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

默认英文，右上角 / 暂停屏下拉可切中文；`?lang=zh` 临时覆盖，刷新保留。

## 测试与验收

```bash
node --test                                    # 纯逻辑测试
node tools/selfplay.mjs                        # 3 策略自对弈遥测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/      关卡、文案、设计源（design.json）、SDK 配置
src/game/    纯逻辑模拟（sim）
src/render/  Canvas 2D 渲染（三场景 + 灯笼）
src/ui/      UI 适配层
src/core/    i18n / audio / sdk / save
src/main.js  主入口（60Hz 固定步长 + 状态机 + __ll 调试契约）
tools/       自对弈 / 截图 / 录 gif / 音频验收
tests/final/ 验收截图与报告
```
