# HOOK & GOLD · 钩金沉海

深海打捞主题的黄金矿工式网页游戏。摆动机械锚爪，钩起沉船宝藏拖上打捞船，限时凑够目标金额过关。

## 运行

```bash
cd games/hook-and-gold
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 发射锚爪 | 点击 / 空格 |
| 弃钩炸药 | D 键 / 顶部 💥 按钮 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

默认英文，右上角 / 暂停屏下拉可切中文；`?lang=zh` 临时覆盖；选择持久化。

## 目录

```
config/          数值 / 关卡 / 物件 / 文案 / SDK / 设计源（design.json）
src/core/        i18n / save / sdk / audio（程序化 WebAudio）
src/game/        sim（纯逻辑，可测）
src/render/      Canvas 2D 三场景渲染
src/ui/          UI 薄适配层
src/main.js      装配 / 固定步长 / 调试契约 window.__ll
tests/           node:test 纯逻辑
tools/           selfplay / verify.plan / record-gif / materials / audio-check
```

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```
