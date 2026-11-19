# SHEPHERD HERD

> 霓虹牧羊人 · Neon shepherd

在霓虹牧场上，你的光之羊群四处游荡。倒计时结束前，给每只羊各喂一次光种，全部喂饱即可过关。连续快速喂食触发**连击**，喂到**金色羊**奖励额外时间，别点错已喂过的羊，也别让羊群跑散。

## 运行

```bash
cd shepherd-herd
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 喂食 | 点击 / 点按羊 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M（或 HUD 上的 M 按钮） |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage（`shepherd-herd-lang`）。
- 所有文案走 `config/locales.js` 的 `t()`；en 与 zh 均完整。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露：`state.phase/lang`、`start` / `pause` / `resume` / `restart`、`run`、`tutorial`（`active/step/steps`）、`startTutorial`，以及 `debug.feedAll` / `debug.fastForward` / `debug.comboDemo` 等验收辅助。

## 目录

```
index.html           入口
styles.css           样式（霓虹街机 UI）
config/              配置、关卡、文案、SDK 配置、design.json
src/core/            i18n、存档、SDK、程序化音频
src/game/            sim（纯逻辑可测）、rng
src/render/          canvas 程序化渲染
src/ui/              UI 屏幕与多语言
src/vendor/          pipysdk（本地降级，热更新地址已置空）
tests/               单元测试
tools/               selfplay / audio-check / verify.plan / poster
```
