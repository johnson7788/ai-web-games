# ALIEN SIEGE

> 异星围攻 — 伪 3D 光线投射 FPS：紫雾殖民巷里，镭射标记集火、护盾背包扛弹幕，守住 12 波。

## 运行

```bash
cd alien-siege
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 移动 | WASD / 左摇杆 |
| 转向 | 鼠标 / 右半屏拖动 / ←→ |
| 射击 | 点击 / 空格 / FIRE 按钮 |
| 换弹 | R / 按钮 |
| 镭射标记 | E / 按钮 |
| 护盾背包 | 按住 Q / 按钮 |
| 暂停 | Esc |

## 语言

- 默认英文；标题右上角下拉可切中文；`?lang=zh` 临时覆盖，选择写入 localStorage 刷新保留。

## 测试 / 验收

```bash
node --test                                   # 纯逻辑测试
node tools/selfplay.mjs                       # 3 策略遥测
node tools/audio-check.mjs                    # 程序化音频 RMS
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 物料

- `poster.jpg`（1280×720）：`node tools/make-poster.mjs`
- `game.gif`（480×270，≤2MB）：`node tools/record-gif.mjs`

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 波次 / 设计源 / 文案 / SDK 配置
src/core/                 i18n / audio / sdk
src/game/                 sim（纯逻辑）/ map（DDA 光线投射）/ rng
src/render/               raycasting 渲染 + 三场景色板
src/ui/                   screens / hud / tutorial / 装配
src/main.js               装配 + 固定步长 + __ll 契约
tests/                    node:test 纯逻辑 + 验收截图
tools/                    selfplay / verify plan / audio-check / record-gif / make-poster
docs/                     源码分析 + SEO + 交付报告
```
