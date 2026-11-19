# ESCAPE BATTLE RUN · 逃生大作战

> 霓虹街机 · 俯视角竞技场逃生。收集能量晶体、躲避追击无人机、能量爆发清场、冲高波次。

## 运行

```bash
cd games/escape-battle-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，零外部依赖，美术/音频全部程序化（canvas / WebAudio）。

## 操作

| 动作 | 桌面 | 移动端 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 拖动虚拟摇杆 |
| 能量爆发 | Space / J | 「Nova」按钮 |
| 暂停 | Esc / P | — |
| 重开 | R | 结算「重开」按钮 |

## 语言

- 默认英文；`?lang=zh` 可覆盖，标题右上角可切中文。
- 文案走 `config/locales.js`，en/zh 完整。

## 门禁

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

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 · 文案 · 设计源 · SDK 配置
src/game/sim.js           纯逻辑（可无 DOM 测试 / selfplay）
src/render/               canvas 程序化渲染
src/core/                 audio / i18n / sdk
src/main.js               60Hz 装配 + 调试契约
tests/                    13 条断言
tools/                    selfplay / audio-check / verify.plan
```

## 调试契约

`window.__ll` 暴露 `state.phase/lang`、`start/pause/resume/restart/home`、`run`、`tutorial`（active/step/steps/skip/startTutorial）、`debug`。
