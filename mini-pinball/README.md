# MINI PINBALL

> 迷你弹球 · Neon Arcade · Flick & Break

霓虹街机气质的发射弹球：拖拽瞄准发光弹球，松开发射，靠弹性反弹打破所有发光方块清关。
9 关逐步引入圆形挡板（弹射链）、橡皮细条（掉落加分光球）与复杂阵型；连击倍率 + 星级评定（按发射数）。

## 运行

```bash
cd mini-pinball
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 拖拽瞄准 | 鼠标 / 手指在画面拖动 |
| 发射 | 松开拖拽 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题 / 暂停屏下拉可切 **中文**；`?lang=zh` 可覆盖。

## 门禁

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
```

## 目录

```
index.html           入口
styles.css           样式（霓虹街机）
config/              数值 / 关卡 / 文案 / 设计源 / SDK 配置
src/core/            sdk / i18n / audio
src/game/sim.js      纯逻辑（可测）
src/render/          Canvas 2D 程序化渲染
src/ui/              UI 屏幕显隐与多语言
src/main.js          主入口 + 调试契约
src/vendor/pipysdk.js 本地 vendored SDK
tests/               单元测试
tools/               自对弈 / 音频验收 / 验收计划
```
