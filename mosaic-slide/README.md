# MOSAIC SLIDE · 琉璃拼图坊

点击缺口旁的彩色琉璃碎片，把它滑进缺口，一片片拼回对称的玫瑰花窗——拼好的瞬间，整扇窗会被阳光点亮。

- 零构建纯静态：`python3 -m http.server 8124` 即可跑（ES Module + Canvas2D）。
- 12 关 3 场景：工坊晨光 / 彩窗午后 / 烛光夜殿；六边形切、限时、旋转块、盲拼、双图交替、6×6 终章。
- 默认英文 + 中文；首次进入交互式引导（可跳过/重看/持久化）。
- 存档/埋点/广告只走 `src/core/sdk.js` 统一出口。

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

契约见 `docs/README.md`；交付报告见 `docs/DELIVERY.md`。
