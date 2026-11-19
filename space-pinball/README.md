# SPACE PINBALL · 太空弹珠

> 复刻原型：Cocos Creator《太空弹球》。1:1 保留「弹簧发射 + 左右挡板 + 蹦床/偏转板/发射台 + 黑洞 + 虫洞 + 中央反应堆加速 + 按钮组/通道组/可升级碎片 + 掉球判负」核心循环；全面原创改造为深空星云霓虹弹球台：小行星岩石障碍、连击倍率、星核超新星双倍分、反应堆波次推进。

## 运行

```bash
cd games/space-pinball
python3 -m http.server 8124   # 或任意静态服务器
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 发射 | 按住 Space 蓄力，松开发射 | —（自动发射） |
| 左挡板 | ← / Z / A | 左半屏点按 |
| 右挡板 | → / M / D | 右半屏点按 |
| 轻推 | N | — |
| 暂停 | Esc / P | — |

## 门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 零依赖

纯静态 `index.html` + ES Module；美术全程序化 Canvas/SVG/DOM；音频纯 WebAudio 采样级合成；SDK 本地 vendored 降级。
