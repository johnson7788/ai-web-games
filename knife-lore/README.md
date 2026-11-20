# KNIFE LORE

> 刀客向旋转的卷轴桩掷出手里剑，绝不刮到自己插下的刀。

Throw shuriken into a spinning scroll post, never nick your own blades, and cleave 12 ink-wash posts across three worlds.

## 运行

```bash
cd games/knife-lore
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 掷刀 | 点击画布 / 空格 |
| 斩铁（揭示安全角） | Z / HUD 按钮 |
| 暂停 | Esc / P |
| 重试失败关 | R |

## 玩法

中心卷轴桩持续旋转，掷刀固定插在命中角（桩底）；撞到已插的刀 = 崩刀判负；每关固定刀数/转速/转向，集满即绽裂过关、解锁下一关。12 关三大场景包：竹庭（绿）/ 暮城（朱红）/ 雪岳（蓝白）；桩形：圆 / 方 / 双桩 / 移动桩；推进：转速 / 间歇反转 / 加速脉冲。每 3 关解锁一次「斩铁」；双桩对称 ±15° 额外分。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 `docs/report.md`。
