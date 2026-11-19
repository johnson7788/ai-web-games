# MR HAT ESCAPE

> 帽子先生大逃亡 — 霓虹街机风平台解谜：向右奔跑跳跃，捡钥匙开门，躲尖刺与锯片，收集星星拿三星评级，逃出 11 扇门。

## 运行

```bash
cd games/mr-hat-escape
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零构建：`index.html` + ES Module，纯 canvas/SVG/DOM 程序化美术，WebAudio 程序化音频，无 CDN/外链/素材文件。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 / 右移 | A / D 或 ← / →；触屏左下 ◀ ▶ |
| 跳跃（空中可二段跳） | Space；触屏右下 ▲ |
| 锚定滑轮钥匙 | Shift / H；触屏 Hold |
| 拖拽（吊桥 / KEY 字） | 鼠标按住拖动；触屏按住拖动 |
| 暂停 | Esc |
| 立即重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage，刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/make-poster.mjs
```

## 关卡

L1 第一步 · L2 浮岛 · L3 尖刺巷 · L4 锯片疾走 · L5 木箱垫脚 · L6 滑轮钥匙 · L7 吊桥 · L8 长路 · L9 天梯钥匙 · L10 钥匙词 · L11 最后一扇门。
