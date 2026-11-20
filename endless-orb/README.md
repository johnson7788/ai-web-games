# ENDLESS ORB

霓虹街机技巧游戏：点击把光子钉进旋转的能量星核，撞到已钉光子即坍缩，清空 12 环触发脉冲涟漪。

## 运行

```bash
cd games/endless-orb
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 输入 |
| --- | --- |
| 发射光子 | 点击 / 触屏 / 空格 |
| 暂停 / 继续 | Esc / P |
| 回标题 | `__ll.restart()` |
| 再来一局 | 死亡/通关后按 R |

## 玩法

- 中心能量核持续旋转；光子直线向上，钉在触达的核边缘。
- 撞到已钉光子 → 判负；达到目标钉数 → 清环（脉冲涟漪签名）。
- 12 环推进：单核 / 反向 / 摇摆 / 变速 / 极性反转 / 双核互绕 / 黑洞核。
- 每 20 钉一颗「过载重光子」（占两格）；每清一环三选一升级。

## 语言

- 默认英文，中文完整；`?lang=zh` 可覆盖。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 调试契约

`window.__ll`：`state.phase / lang / setLang / run / start / pause / resume / restart / tutorial / save / ui / debug.{layout,jump,pin}`。
