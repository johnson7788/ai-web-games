# DICE CASCADE — Rune Dice Temple

> 概率神殿：掷符文骰驱动弹珠台，骰面决定落区与倍率，三骰同面神殿门金光洞开。

## 运行

```bash
cd games/dice-cascade
python3 -m http.server 8124   # 打开 http://127.0.0.1:8124/
```

零构建、零运行期依赖（唯一例外站点 SDK，断网自动降级）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 押注骰位 | 点底部 1/2/3 骰位按钮 |
| 掷骰 | 点 ROLL |
| 收手保分 | 点 BANK（达到目标分可点） |
| 暂停 | Esc / P |
| 结算后重开 | R |

## 语言

- 默认 **英文**；标题/暂停/设置的下拉可切 **中文**，刷新保留，`?lang=zh` 可覆盖。
- 只暴露 en/zh（ja/ko/ar/ru 整块删除，符合「整语言完整才暴露」铁律）。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## TODO（WARN 项对账，G7 复盘）

- `vision-review` 均分 readable 7.8 / silhouette 6.8（WARN，未到 PASS）：顶部 HUD 与装饰石柱、钉阵点的视觉层级可再优化（HUD 间距已加宽，石柱装饰与 HUD 的距离感、钉点状态区分仍偏弱）。
