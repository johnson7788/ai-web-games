# PIRATE ESCAPE RUN（海盗逃命）

> 霓虹街机风攀爬跑酷：点击左右两侧换道攀爬，躲开木板、收集金币星星、逃出不断上涨的海潮。

## 运行

```bash
cd pirate-escape-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态：`index.html` + ES Module，零依赖零外链，美术全部程序化 canvas，音频纯 WebAudio。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 向左换道攀爬 | A / ← / 点左侧 |
| 向右换道攀爬 | D / → / 点右侧 |
| 暂停 / 继续 | Esc |
| 静音 | M |
| 重开（结算后） | R / Space |

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖。

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```
