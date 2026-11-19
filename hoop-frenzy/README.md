# HOOP FRENZY

> 霓虹灌篮 · Neon Arcade Dunk

## 运行

```bash
cd games/hoop-frenzy
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零依赖、零外链：纯 ES Module + 程序化 Canvas / DOM / WebAudio。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 出手（看力量条绿色区） | Space / 点击球场任意处 |
| 暂停 / 继续 | Esc 或 P |
| 重开本局 | R |
| 静音 | M |
| 玩法说明 | H 或右上角 `?` |

## 玩法

力量条持续扫动，在指针进入绿色甜区时点击出手，把能量球抛进左右交替的霓虹环。

- **空心** = 连击 + 加分（连击 ≥3 触发烈焰 +1）
- **擦板** = 得分但连击清零
- **失手** = 无分，倒计时继续烧
- 单球倒计时耗尽扣 1 命；3 命耗尽出局；拿到 **22 分**通关
- 每 4 球出现 **金环**（双倍分）；阶段越高环越小、漂移越快

## 语言

默认英文；标题右上角 / 暂停屏下拉可切中文。`?lang=zh` 可覆盖；选择写入 localStorage。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑
src/render/         canvas 渲染
src/ui/             UI
src/main.js         主入口
src/vendor/         pipysdk.js（vendored）
tests/              测试
tools/              自对弈 / 音频验收 / verify 计划
```

## 调试契约

`window.__ll`：`state.phase`（title/playing/paused/result）、`start/pause/resume/restart/home`、
`run/sim`、`tutorial`、`startTutorial`、`save/ui/share`、`debug.perfectShot/playToEnd/setTutorialDone`。
