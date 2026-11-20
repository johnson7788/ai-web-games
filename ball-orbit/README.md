# BALL ORBIT · 弹弓星海

> Slingshot meteor swarms through a falling asteroid belt. Bend shots around planets' gravity, charge comets, clear rows with a gravity ripple.

## 运行

```bash
cd ball-orbit
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 瞄准 | 鼠标/手指拖动 |
| 发射 | 松开 |
| 暂停 | Esc |
| 重开 | R（失败后） |

## 核心机制

- 底部弹弓发射一串流星；行星引力弯曲弹道（虚线预览）。
- 陨石硬度 = 数值，每撞 -1，归零碎裂；彗星撞击 ×3。
- 每回合后陨石带下坠一行，触底判负。
- 每清 50 硬度蓄一颗彗星；护盾陨石只吃彗星。
- 清整行触发「引力涟漪」把邻行吸歪。
- 12 波 + 三场景包（内环尘带 / 气态巨星 / 深空）。

## 测试与门禁

```bash
node --test                                   # 纯逻辑
node tools/selfplay.mjs                       # 3 策略遥测
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

```text
index.html / styles.css   入口与样式
config/                   数值 / 波次 / 场景 / 文案 / SDK（config-first）
src/core/                 i18n / save / sdk / audio（WebAudio 程序化）
src/game/                 sim（纯逻辑）/ board / rng
src/render/               星空 / 行星 / 陨石 / 流星 / 弹弓
src/ui/                   标题 / HUD / 暂停 / 结算 / 首次引导
src/main.js               装配 / 固定步长 / 事件分发 / __ll 契约
tools/                    验收计划 / selfplay / audio-check / 录 gif / 海报
```

## 调试契约

`window.__ll` 暴露 `state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart` / `save` / `ui` / `tutorial` / `debug.layout()`。
