# DUO QUIZ · 双人问答

同屏双人问答对战（DUO With Friends 式）。两人共用一屏：玩家1（蓝）左侧作答，玩家2（红）右侧作答。每题 4 选项，答对 +100 且越快加分越多；10 回合后总分高者获胜。

- 品类：问答 / 派对 / 休闲（同屏对战）
- 参考：DUO With Friends（只借鉴品类，题库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 背景 + DOM 双人选项 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/duo-quiz
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 玩家1：按键 `1-4` 或左侧按钮；玩家2：按键 `7/8/9/0` 或右侧按钮。
- 揭示后按 `Enter`/`Space` 或「下一题」继续。`Esc`/`P` 暂停。

## 规则与计分

- 20 题双语题库随机取 10 回合；每题 12 秒倒计时。
- 答对 = 100 + 速度分（最高 50，按剩余时间）；答错 0 分。
- 双方都答或超时即揭示；10 回合后比分定胜负（平局判和）。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（作答/计分/超时/胜负）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（规则/配色）/ questions（20 题双语）/ locales / sdk.config
src/game/    sim.js（纯逻辑：双人作答/计时/速度分/胜负，可注入 seed）
src/render/  index.js（背景/中线/获胜彩带）
src/ui/      ui.js（标题/暂停/结束 + 题干/计时 + 双人选项 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|done；`start/pause/resume/restart`；
`debug.state()` / `debug.answer(player,idx)` / `debug.answerCorrect(player)` / `debug.next()` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；题干与选项双语。