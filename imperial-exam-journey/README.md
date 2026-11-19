# IMPERIAL EXAM JOURNEY · 进京赶考

> 书生沿驿道进京赶考：从被擦去部分笔画的纸卷认出四字成语，打字作答向前赶路；连击加分、攒星夺状元。

## 运行

```bash
cd games/imperial-exam-journey
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零依赖、零外链：美术全程序化 Canvas，音频全 WebAudio 合成。

## 操作

| 动作 | 键 / 触点 |
| --- | --- |
| 选择难度 | 标题屏三档按钮（简单 +1 / 复杂 +1.5 / 困难 +2） |
| 输入成语 | 底部输入框（IME 中文） |
| 提交答案 | Enter / 底部 ↵ 按钮 |
| 使用提示笺 | ✎ 按钮（每累计 5 分得 1 张，每过 1 座驿站再 +1） |
| 暂停 | Esc / P / 右上 ⏸ |
| 结算后重开 | R / Retry |

## 玩法

- 纸卷上是**被擦去部分笔画**的四字成语（程序化擦除，难度越高擦得越多）。
- 每轮 **15 秒**，答对前进并得分，答错打断连击、时间继续；归零结束。
- **连击**：连续答对 → 得分倍率 1.0→1.2→…→×2.0 封顶。
- **星级**：按剩余时间给 1–3 星，累计星级决定结算头衔（秀才→举人→贡士→进士→状元）。
- **驿站**：每答对 4 题抵达一座驿站（里程碑），奖励 1 张提示笺。
- 题库打穿 = 抵达京城金榜题名。

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。`?lang=zh` 可覆盖。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 目录

```
index.html          入口
styles.css          样式（含竖屏提示 / 教程卡片固定底部居中）
config/             game.config / idioms（题库）/ locales / sdk.config / design.json
src/core/           i18n / save / sdk / audio
src/game/           sim.js（纯逻辑）/ rng.js
src/render/         index.js / erase.js（程序化笔画擦除）
src/ui/             index.js / tutorial.js
src/main.js         60Hz 固定步长装配 + window.__ll 调试契约
src/vendor/pipysdk.js  本地 SDK（runtimeConfigUrl/appConfigUrl 置空，0 外链）
tests/              单测（node --test）
tools/              自玩 / 音频校验 / 验收计划 / 截图 / 海报
```
