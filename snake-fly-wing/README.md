# NEON SERPENT

> 霓虹飞蛇 — 驾驶发光飞蛇，穿越合成波峡谷

## 运行

```bash
cd games/snake-fly-wing
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 拍翼上升 | 空格 / W / ↑ / 点按 / 点击 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 发光飞蛇会不断下坠，**拍翼**让它上升，穿过发光的霓虹缺口。
- 撞上柱子损失一节身体（= 一次容错），身体耗尽即坠落；撞到顶部/底部也会坠落。
- **红心**加长身体，**宝石**开启护盾（自动巡航 + 无敌 + 冲刺），**集齐 3 颗星**触发狂热（无敌 + 磁吸 + 双倍分）。
- 连击越高，每过一扇门得分越多；**岩石门**更窄但 +3 分。每 5 分进入新 zone，速度随之上升。

## 语言

- 默认**英文**；`?lang=zh` 可切中文；下拉选择写入 localStorage 保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 验收门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 调试契约

`window.__ll` 暴露：`state.{phase,lang}`、`start/pause/resume/restart/home`、`run/sim`、
`tutorial.{active,step,steps,current,skip}`、`startTutorial`、`save/load`、`debug.{state,hud,autoPlayToDeath,fastForward}`。
