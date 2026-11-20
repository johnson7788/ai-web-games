# KILN 2048 · 窑火2048

> 陶窑里的掉落合成游戏：投放釉球，同值相合，炼出 2048 天青出窑。

## 运行

```bash
cd kiln-2048
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 输入 |
| --- | --- |
| 移动投放点 | 鼠标/触屏拖动，或 ← → 精调 |
| 投下釉球 | 点击 / 空格 |
| 砸碎任意球 | 点重锤按钮再点球 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 同值釉球相碰合成翻倍（素坯 → 青釉 → 钧红 → … → 天青 2048）。
- 达关卡出窑阈值自动消除加分；2048 = 天青出窑，整屏暖光脉冲。
- 别让陶土堆过顶部失败线，否则窑满溢出判负。
- 12 关：大值干扰球 / 冰冻球（两次复烧解冻）/ 双色釉（隔次才能合）/ 重锤 / 窄窑腔。

## 语言

默认英文，可切中文（`?lang=zh` 或标题/暂停下拉）。仅暴露 en/zh。

## 测试与门禁

```bash
node --test                                             # 29 条纯逻辑测试
node tools/selfplay.mjs                                 # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 `docs/DELIVERY.md`。
