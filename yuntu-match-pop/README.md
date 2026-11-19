# YUNTU MATCH POP

> 云图拼消 · 霓虹街机合成解谜

点一列，放下发光方块；相同方块相邻即合成，一路冲向每关的金色目标值。岩石逼你规划，连击给你暴分。

## 运行

```bash
cd yuntu-match-pop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 落块 | 点列（或数字键无，纯鼠标/触屏） |
| 炸弹 | 点 💣 再点列（花 50 钻石清底块） |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M / 🔊 按钮 |

## 规则

- 5 列 × 7 行；新块 70% 是 2、30% 是 4。
- 相邻同值方块（上下左右）合并：目标值 × 2^邻块数，上限 8192。
- 合并后上方方块下落，再连锁判定；分 += 合并值，钻石 += ⌊log₂/5⌋。
- 点满列 → 棋盘锁死（lose）。
- 任一方块值 ≥ 关卡目标 → 通关（win），按超目标值与得分评 1–3 星。
- 第 3 关起岩石（0 值障碍）按节奏落下；紧邻合并即震碎（+50 分）。

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`yuntu-match-pop-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`；en/zh 完整。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/make-final.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
```

## 目录

```
index.html / styles.css   入口与样式
config/                   配置、关卡、文案、SDK、design.json
src/core/                 i18n / sdk / audio
src/game/sim.js           纯逻辑（零 DOM，可无头测试）
src/render/index.js       Canvas 程序化渲染
src/ui/ui.js              DOM 屏幕显隐 + 语言
src/main.js               装配 + __ll 调试契约
src/vendor/pipysdk.js     本地 vendored SDK
tests/                    node --test
tools/                    selfplay / audio-check / verify.plan / make-final
```

## 调试契约

`window.__ll`：`state.phase` / `state.lang`、`start/pause/resume/restart/home`、`run/sim`、`tutorial`、`debug.*`、`save/ui`。
