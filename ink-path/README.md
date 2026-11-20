# INK PATH

> 蛛丝星图 · 萤火虫蛛在星空网上织丝

一笔画改造：从起点星子出发，沿丝线一颗星连一颗星，中途不抬笔，走遍每颗星子织成整张星网。完成瞬间整张星网亮起涟漪 + 萤火虫群飞散。

## 运行

```bash
cd games/ink-path
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 织丝（点相邻星子延伸） | 鼠标点 / 触屏点 |
| 回退（点早前的星子） | 鼠标点 / 触屏点；键盘 U |
| 聚焦下一可走星子 | Tab |
| 确认聚焦星子 | Enter / Space |
| 暂停 / 继续 | Esc / P |
| 重开 | R |
| 静音 | M |

## 门禁

```bash
cd games/ink-path
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

交付细节见 `docs/DELIVERY.md`。
