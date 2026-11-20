# HOP CHARGE · 风灯跳塔

> 夜色屋顶间，提灯小狸猫按住蓄力、松开起跳，落进中心连击翻倍。

## 运行

```bash
cd games/hop-charge
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 蓄力 | 按住鼠标 / 触屏 / 空格 |
| 起跳 | 松开 |
| 暂停 | Esc / P |
| 重开 | R |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏的下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。

## 测试与验收

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

## 目录

```
index.html          入口
styles.css          样式
config/             数值 / 关卡 / 文案 / design.json / sdk.config
src/core/           i18n / save / audio / sdk
src/game/sim.js     纯逻辑（蓄力/落点判定/连击/星级）
src/render/         Canvas 2D 三场景 + 提灯小狸猫
src/ui/             UI 薄适配层
src/main.js         主入口 + 60Hz 固定步长 + 调试契约
tools/              自对弈 / 验收计划 / 音频检查 / 录 gif / 出物料
```
