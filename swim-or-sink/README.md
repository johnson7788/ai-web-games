# SWIM OR SINK

> 游或沉没 · 水下生存问答

落水后面对一道道水下险情，在空气耗尽前选对自救动作，靠连击回气游出三片海域，拿星级评分。

## 运行

```bash
cd swim-or-sink
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零外链，纯静态 `index.html` + ES Module。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选择答案 | 1 / 2 / 3 或点选按钮 |
| 浮标（消除一个错误选项） | 🛟 按钮（仅 3 选 1 题） |
| 暂停 / 继续 | Esc 或 P |
| 重开 | R |
| 静音 | M |
| 菜单 | ⌂ |

## 玩法

- 3 个深度（浅水 / 深水 / 远海）共 12 道原创水下生存题。
- 答对推进并累积连击；答错扣 1 格空气，3 格耗尽即沉没（game over）。
- 每 3 连击回 1 格空气；通关一个深度回 1 格空气。
- 深水区为 3 选 1 题，远海区选项随机打乱，浮标每局限 1 次。
- 结算按剩余空气 + 最高连击评 1–3 星。

## 语言

- 默认英文；标题右上角 / 暂停屏下拉可切中文；`?lang=zh` 可覆盖。
- 所有可见文案走 `config/locales.js` 的 `t()`；题目文案在 `config/questions.js`（en/zh 双语）。

## 门禁自检

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
config/             配置（game.config / design / locales / questions / sdk.config）
src/core/           i18n / sdk / audio
src/game/           纯逻辑 sim（可 Node 直跑）
src/render/         canvas 程序化场景
src/ui/             UI 薄适配层
src/vendor/         pipysdk（本地 vendored）
tests/              测试
tools/              selfplay / verify.plan / audio-check / fun 产物
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase/lang`、`start()` / `pause()` / `resume()` / `restart()` / `home()`、`tutorial`、`debug.*`（answerCorrect / loadLevel / autoSolve 等）。
